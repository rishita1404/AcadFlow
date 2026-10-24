"""FastAPI dependency functions for authentication and authorization.

get_current_user  — extracts + validates Bearer JWT using Member 2's tokens module.
get_current_user_optional — same but returns None instead of 401 (for public-ish routes).
require_roles     — raises 403 if caller's role not in the allowed set.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.tokens import token_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", auto_error=False
)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Validate Bearer access token and return its decoded claims dict.

    Claims contain: sub (user_id str), email, role.
    Raises HTTP 401 if token is absent, malformed, expired, or revoked.
    """
    payload = await token_service.verify_token(token, expected_type="access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
) -> Optional[dict]:
    """Like get_current_user but returns None for unauthenticated requests."""
    if not token:
        return None
    return await token_service.verify_token(token, expected_type="access")


def require_roles(*roles: str):
    """Factory: returns a FastAPI dependency that allows only the listed roles (admin always passes)."""
    allowed = set(roles) | {"admin"}

    def _checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{current_user.get('role')}'",
            )
        return current_user

    return _checker
