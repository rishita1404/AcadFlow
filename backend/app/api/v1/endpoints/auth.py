"""Auth endpoints: register, login, refresh, logout, me.

Security implementation (Member 2):
- Login lockout via app.core.lockout
- JWT access + refresh tokens via app.core.tokens (with Redis revocation)
- argon2id/bcrypt password hashing via app.core.security
- Role-scoped JWT claims
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.deps import get_db
from app.core.errors import ConflictError, UnauthorizedError
from app.core.lockout import check_lockout, lockout_policy, record_failure, record_success
from app.core.security import get_password_hash, verify_password
from app.core.tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
    revoke_token,
)
from app.models import UserModel
from app.schemas.common import EmailStr

router = APIRouter()

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

VALID_ROLES = {"student", "faculty", "coordinator", "admin"}


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    role: str = Field(default="student")
    department_id: Optional[int] = None
    organization_id: Optional[int] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    refresh_token: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class UserMeResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REFRESH_COOKIE = "acadflow_refresh"
COOKIE_SECURE = False  # set True in production (HTTPS)
COOKIE_HTTPONLY = True
COOKIE_SAMESITE = "lax"


def _set_refresh_cookie(
    response: Response, token: str, max_age: int = 7 * 24 * 3600
) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=max_age,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/api/v1/auth")


def _build_claims(user: UserModel) -> dict:
    return {"sub": str(user.id), "email": user.email, "role": user.role}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", tags=["Auth"])
async def get_auth_index():
    return {"endpoint": "auth", "status": "active"}


@router.post(
    "/register",
    response_model=UserMeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account (open — no auth required for self-registration)."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{payload.role}'. Must be one of: {sorted(VALID_ROLES)}",
        )

    existing = db.scalar(
        select(UserModel).where(UserModel.email == payload.email.lower())
    )
    if existing:
        raise ConflictError(f"An account with email '{payload.email}' already exists.")

    user = UserModel(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        department_id=payload.department_id,
        organization_id=payload.organization_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserMeResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
    )


@router.post("/login", response_model=TokenResponse, tags=["Auth"])
async def login(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Login with email + password (JSON or form-data). Returns access token; sets HttpOnly refresh cookie."""
    content_type = request.headers.get("content-type", "")
    raw_email = None
    raw_password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            raw_email = body.get("email") or body.get("username")
            raw_password = body.get("password")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            raw_email = form.get("username") or form.get("email")
            raw_password = form.get("password")
        except Exception:
            pass

    if not raw_email or not raw_password:
        raise UnauthorizedError("Invalid email or password.")

    email = str(raw_email).lower().strip()

    # 1. Lockout gate
    is_locked, retry_secs = await lockout_policy.is_locked(email)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked. Retry after {retry_secs} seconds.",
            headers={"Retry-After": str(retry_secs)},
        )

    # 2. Look up user
    user = db.scalar(select(UserModel).where(UserModel.email == email))

    # 3. Verify password (constant-time even on user-not-found path)
    if not user or not verify_password(raw_password, user.password_hash):
        if user:
            await lockout_policy.record_failed_attempt(email)
        raise UnauthorizedError("Invalid email or password.")

    # 4. Check DB-level lockout (set by a previous migration / manual lock)
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is locked. Contact an administrator.",
        )

    # 5. Success — clear lockout, issue tokens
    await lockout_policy.reset_lockout(email)

    claims = _build_claims(user)
    access_token, access_exp = create_access_token(claims)
    refresh_token, _ = create_refresh_token(claims)

    _set_refresh_cookie(response, refresh_token)

    expires_in = int((access_exp - datetime.now(timezone.utc)).total_seconds())
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse, tags=["Auth"])
def refresh_token(
    response: Response,
    body: Optional[RefreshRequest] = None,
    acadflow_refresh: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """Rotate refresh token. Old token is revoked; new pair issued.
    Accepts token via HttpOnly cookie or request body {"refresh_token": "..."}.
    """
    token = None
    if body and body.refresh_token:
        token = body.refresh_token
    elif acadflow_refresh:
        token = acadflow_refresh

    if not token:
        raise UnauthorizedError("Refresh token missing.")

    payload = decode_token(token, token_type="refresh")
    if not payload:
        _clear_refresh_cookie(response)
        raise UnauthorizedError("Refresh token invalid or expired.")

    user_id = int(payload.get("sub", 0))
    user = db.get(UserModel, user_id)
    if not user:
        _clear_refresh_cookie(response)
        raise UnauthorizedError("User no longer exists.")

    # Revoke old refresh token, issue new pair
    revoke_token(token)
    claims = _build_claims(user)
    access_token, access_exp = create_access_token(claims)
    new_refresh, _ = create_refresh_token(claims)

    _set_refresh_cookie(response, new_refresh)
    expires_in = int((access_exp - datetime.now(timezone.utc)).total_seconds())
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        refresh_token=new_refresh,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["Auth"])
def logout(
    response: Response,
    acadflow_refresh: Optional[str] = Cookie(default=None),
):
    """Revoke refresh token and clear cookie."""
    if acadflow_refresh:
        revoke_token(acadflow_refresh)
    _clear_refresh_cookie(response)
    return None


@router.get("/me", response_model=UserMeResponse, tags=["Auth"])
def me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return current user profile from access token (Bearer)."""
    user_id = int(current_user.get("sub", 0))
    user = db.get(UserModel, user_id)
    if not user:
        raise UnauthorizedError("User not found.")
    return UserMeResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
    )
