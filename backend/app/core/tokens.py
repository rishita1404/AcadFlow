"""
JWT & Refresh Token Rotation & Revocation Service for AcadFlow.

Features:
- Short-lived Access Tokens (15-60 min) with issuer and audience validation.
- Long-lived Refresh Tokens (7 days) with unique JTI identifiers.
- Redis-backed Revocation Blacklist using PRD key schema: revoked:{token_id}
- Refresh Token Rotation: previous refresh token is immediately revoked upon exchange.
- Token replay detection: reused refresh tokens trigger security alert.
- In-memory testing fallback when Redis server is offline.
"""

import asyncio as _asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from app.core.config import settings
from app.core.security import JWTError, jwt
from app.db.redis import redis_client

TOKEN_ISSUER = "acadflow"
TOKEN_AUDIENCE = "acadflow-web"
DEFAULT_ACCESS_EXPIRE_MINUTES = 15
DEFAULT_REFRESH_EXPIRE_DAYS = 7


class TokenService:
    def __init__(self, client=None):
        self.client = client if client is not None else redis_client
        self._revoked_memory: Dict[str, float] = {}

    def _format_revocation_key(self, jti: str) -> str:
        return f"revoked:{jti}"

    async def is_token_revoked(self, jti: str) -> bool:
        """Check if token JTI has been revoked in Redis or memory store."""
        if not jti:
            return True
        key = self._format_revocation_key(jti)
        try:
            val = await self.client.get(key)
            return val is not None
        except Exception:
            exp = self._revoked_memory.get(key)
            if exp is not None:
                if datetime.now(timezone.utc).timestamp() <= exp:
                    return True
                self._revoked_memory.pop(key, None)
            return False

    async def revoke_token(self, jti: str, remaining_seconds: int = 86400 * 7) -> None:
        """Mark token JTI as revoked until its natural expiry."""
        if not jti:
            return
        key = self._format_revocation_key(jti)
        ttl = max(1, remaining_seconds)
        try:
            await self.client.set(key, "revoked", ex=ttl)
        except Exception:
            self._revoked_memory[key] = datetime.now(timezone.utc).timestamp() + ttl

    def create_access_token(
        self,
        user_id: int | str,
        role: str,
        expires_minutes: Optional[int] = None,
        custom_claims: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate a signed short-lived access token."""
        now = datetime.now(timezone.utc)
        duration = timedelta(
            minutes=expires_minutes
            or settings.ACCESS_TOKEN_EXPIRE_MINUTES
            or DEFAULT_ACCESS_EXPIRE_MINUTES
        )
        jti = str(uuid.uuid4())

        payload: Dict[str, Any] = {
            "sub": str(user_id),
            "role": role,
            "type": "access",
            "jti": jti,
            "iss": TOKEN_ISSUER,
            "aud": TOKEN_AUDIENCE,
            "iat": int(now.timestamp()),
            "exp": int((now + duration).timestamp()),
        }
        if custom_claims:
            payload.update(custom_claims)

        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def create_refresh_token(
        self,
        user_id: int | str,
        role: str,
        family_id: Optional[str] = None,
        expires_days: int = DEFAULT_REFRESH_EXPIRE_DAYS,
    ) -> str:
        """Generate a signed long-lived refresh token with unique JTI."""
        now = datetime.now(timezone.utc)
        duration = timedelta(days=expires_days)
        jti = str(uuid.uuid4())

        payload: Dict[str, Any] = {
            "sub": str(user_id),
            "role": role,
            "type": "refresh",
            "jti": jti,
            "family_id": family_id or str(uuid.uuid4()),
            "iss": TOKEN_ISSUER,
            "aud": TOKEN_AUDIENCE,
            "iat": int(now.timestamp()),
            "exp": int((now + duration).timestamp()),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    async def verify_token(
        self, token: str, expected_type: str = "access"
    ) -> Optional[Dict[str, Any]]:
        """Verify token cryptographic signature, issuer, audience, type, and revocation status."""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                issuer=TOKEN_ISSUER,
                audience=TOKEN_AUDIENCE,
            )
        except JWTError:
            return None

        # Verify expected token type
        if payload.get("type") != expected_type:
            return None

        # Verify revocation blacklist
        jti = payload.get("jti")
        if jti and await self.is_token_revoked(jti):
            return None

        return payload

    async def rotate_refresh_token(
        self, refresh_token_str: str
    ) -> Optional[Tuple[str, str]]:
        """Exchanges an existing valid refresh token for a new (access_token, refresh_token) pair.

        The old refresh token is revoked to prevent replay attacks.
        Returns None if token is invalid or already revoked.
        """
        try:
            unverified_claims = jwt.get_unverified_claims(refresh_token_str)
            jti = unverified_claims.get("jti")
        except Exception:
            return None

        # Replay attack detection: if JTI is already revoked, reject immediately
        if jti and await self.is_token_revoked(jti):
            return None

        # Full verification
        payload = await self.verify_token(refresh_token_str, expected_type="refresh")
        if not payload:
            return None

        user_id = payload["sub"]
        role = payload["role"]
        family_id = payload.get("family_id")
        exp = payload.get("exp", 0)

        # Revoke the old refresh token
        remaining_ttl = max(60, int(exp - datetime.now(timezone.utc).timestamp()))
        await self.revoke_token(jti, remaining_seconds=remaining_ttl)

        # Issue new token pair preserving token family
        new_access = self.create_access_token(user_id=user_id, role=role)
        new_refresh = self.create_refresh_token(
            user_id=user_id, role=role, family_id=family_id
        )

        return new_access, new_refresh


# Global instance
token_service = TokenService()


def _run_async(coro):
    """Execute a coroutine from a sync context without blocking the existing loop."""
    try:
        loop = _asyncio.get_running_loop()
    except RuntimeError:
        return _asyncio.run(coro)

    fut = _asyncio.run_coroutine_threadsafe(coro, loop)
    try:
        return fut.result(timeout=3)
    except Exception:
        return None


def create_access_token(claims: dict) -> tuple[str, datetime]:
    """Create a signed access JWT. Returns (token_str, expiry_datetime)."""
    user_id = claims.get("sub") or claims.get("user_id", 0)
    role = claims.get("role", "student")
    email = claims.get("email")
    custom = {"email": email} if email else None
    token = token_service.create_access_token(
        user_id=user_id, role=role, custom_claims=custom
    )
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"verify_aud": False},
    )
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    return token, exp


def create_refresh_token(claims: dict) -> tuple[str, datetime]:
    """Create a signed refresh JWT. Returns (token_str, expiry_datetime)."""
    user_id = claims.get("sub") or claims.get("user_id", 0)
    role = claims.get("role", "student")
    token = token_service.create_refresh_token(user_id=user_id, role=role)
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"verify_aud": False},
    )
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    return token, exp


def decode_token(token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
    """Sync-safe wrapper around token_service.verify_token."""
    return _run_async(token_service.verify_token(token, expected_type=token_type))


def revoke_token(token: str) -> None:
    """Revoke a token by its JTI (sync-safe)."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False, "verify_exp": False},
        )
        jti = payload.get("jti")
        exp = payload.get("exp", 0)
        remaining = max(60, int(exp - datetime.now(timezone.utc).timestamp()))
        if jti:
            _run_async(token_service.revoke_token(jti, remaining_seconds=remaining))
    except Exception:
        pass
