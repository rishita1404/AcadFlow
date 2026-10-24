"""
Redis-Backed Session Management for AcadFlow.

Implements PRD Section 6 / Lab 7 session-cookie login:
- Cryptographically secure unpredictable session identifiers (secrets.token_urlsafe).
- Server-side session storage with sliding expiration.
- Safe cookie settings (HttpOnly, Secure in production, SameSite=Lax).
- Graceful session revocation on logout.
- No plaintext credentials or passwords stored in session data or logs.
"""

import json
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.db.redis import redis_client

DEFAULT_SESSION_TTL_SECONDS = 86400 * 7  # 7 days
SESSION_COOKIE_NAME = "acadflow_session"


class SessionStore:
    """
    Session store supporting Redis with in-memory fallback for isolated testing.
    """

    def __init__(self, client=None, default_ttl: int = DEFAULT_SESSION_TTL_SECONDS):
        self.client = client if client is not None else redis_client
        self.default_ttl = default_ttl
        self._memory_fallback: Dict[str, tuple[str, float]] = {}

    def _format_key(self, session_id: str) -> str:
        return f"session:{session_id}"

    async def create_session(
        self,
        user_id: int | str,
        role: str,
        metadata: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
    ) -> str:
        """Create a new server-side session with cryptographically secure ID."""
        session_id = secrets.token_urlsafe(32)
        ttl = ttl or self.default_ttl

        session_data = {
            "session_id": session_id,
            "user_id": str(user_id),
            "role": role,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_accessed": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {},
        }
        encoded = json.dumps(session_data)
        key = self._format_key(session_id)

        try:
            await self.client.set(key, encoded, ex=ttl)
        except Exception:
            # In-memory fallback if Redis is unavailable
            expiry = datetime.now(timezone.utc).timestamp() + ttl
            self._memory_fallback[key] = (encoded, expiry)

        return session_id

    async def get_session(
        self, session_id: str, touch: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Validate and retrieve session data; optionally refreshes sliding expiration."""
        if not session_id or len(session_id) < 16:
            return None

        key = self._format_key(session_id)
        encoded: Optional[str] = None

        try:
            encoded = await self.client.get(key)
            if encoded and touch:
                await self.client.expire(key, self.default_ttl)
        except Exception:
            item = self._memory_fallback.get(key)
            if item:
                val, exp = item
                if datetime.now(timezone.utc).timestamp() <= exp:
                    encoded = val
                    if touch:
                        self._memory_fallback[key] = (
                            val,
                            datetime.now(timezone.utc).timestamp() + self.default_ttl,
                        )
                else:
                    self._memory_fallback.pop(key, None)

        if not encoded:
            return None

        try:
            return json.loads(encoded)
        except Exception:
            return None

    async def destroy_session(self, session_id: str) -> bool:
        """Revoke/delete an active session."""
        if not session_id:
            return False

        key = self._format_key(session_id)
        deleted = False

        try:
            res = await self.client.delete(key)
            deleted = bool(res)
        except Exception:
            deleted = self._memory_fallback.pop(key, None) is not None

        return deleted


# Global instance
session_store = SessionStore()


def get_session_cookie_settings(is_production: bool = False) -> Dict[str, Any]:
    """
    Standard secure cookie attributes.
    """
    return {
        "key": SESSION_COOKIE_NAME,
        "httponly": True,
        "samesite": "lax",
        "secure": is_production,
        "max_age": DEFAULT_SESSION_TTL_SECONDS,
        "path": "/",
    }
