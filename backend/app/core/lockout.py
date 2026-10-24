"""
Login Lockout Policy for AcadFlow.

Implements PRD Section 6 / Week 3 security requirements:
- Tracks consecutive failed login attempts under key: fail:{email}
- Configurable threshold (default 5 attempts).
- Configurable lockout duration (default 15 minutes = 900 seconds).
- Resets failure counter upon successful login.
- Anti-enumeration protection: does not reveal if an email exists in error messages.
- Atomic counter increments with TTL enforcement.
- Graceful in-memory testing fallback when Redis is offline.
"""

from datetime import datetime, timezone
from typing import Dict, Tuple

from app.db.redis import redis_client

DEFAULT_LOCKOUT_THRESHOLD = 5
DEFAULT_LOCKOUT_DURATION_SECONDS = 900  # 15 minutes


class LockoutPolicy:
    def __init__(
        self,
        client=None,
        max_attempts: int = DEFAULT_LOCKOUT_THRESHOLD,
        lockout_duration_seconds: int = DEFAULT_LOCKOUT_DURATION_SECONDS,
    ):
        self.client = client if client is not None else redis_client
        self.max_attempts = max_attempts
        self.lockout_duration_seconds = lockout_duration_seconds
        # In-memory fallback storage: key -> (count, expiry_timestamp)
        self._memory_store: Dict[str, Tuple[int, float]] = {}

    def _format_key(self, identifier: str) -> str:
        # Normalize email/identifier to lowercase
        clean_id = (identifier or "").strip().lower()
        return f"fail:{clean_id}"

    async def is_locked(self, identifier: str) -> Tuple[bool, int]:
        """
        Check if the identifier is currently locked out.
        Returns: (is_locked: bool, remaining_seconds: int)
        """
        key = self._format_key(identifier)
        count = 0
        ttl = 0

        try:
            val = await self.client.get(key)
            if val is not None:
                count = int(val)
                ttl = await self.client.ttl(key)
                if ttl < 0:
                    ttl = self.lockout_duration_seconds
        except Exception:
            item = self._memory_store.get(key)
            if item:
                cnt, exp = item
                remaining = int(exp - datetime.now(timezone.utc).timestamp())
                if remaining > 0:
                    count = cnt
                    ttl = remaining
                else:
                    self._memory_store.pop(key, None)

        if count >= self.max_attempts:
            return True, max(1, ttl)

        return False, 0

    async def record_failed_attempt(self, identifier: str) -> Tuple[int, bool]:
        """
        Record a failed login attempt atomically.
        Returns: (current_attempts: int, is_now_locked: bool)
        """
        key = self._format_key(identifier)
        current_attempts = 1

        try:
            current_attempts = await self.client.incr(key)
            if current_attempts == 1:
                # Set TTL on the first failure
                await self.client.expire(key, self.lockout_duration_seconds)
            else:
                # Keep TTL active
                ttl = await self.client.ttl(key)
                if ttl < 0:
                    await self.client.expire(key, self.lockout_duration_seconds)
        except Exception:
            now_ts = datetime.now(timezone.utc).timestamp()
            item = self._memory_store.get(key)
            if item and item[1] > now_ts:
                current_attempts = item[0] + 1
                self._memory_store[key] = (current_attempts, item[1])
            else:
                current_attempts = 1
                self._memory_store[key] = (1, now_ts + self.lockout_duration_seconds)

        is_now_locked = current_attempts >= self.max_attempts
        return current_attempts, is_now_locked

    async def reset_lockout(self, identifier: str) -> None:
        """
        Clear the failure counter upon successful login.
        """
        key = self._format_key(identifier)
        try:
            await self.client.delete(key)
        except Exception:
            self._memory_store.pop(key, None)


# Global instance
lockout_policy = LockoutPolicy()


# ---------------------------------------------------------------------------
# Sync convenience wrappers for use in synchronous FastAPI route handlers
# (Liza's CRUD routes use sync SQLAlchemy; these avoid mixing asyncio loops).
# ---------------------------------------------------------------------------

import asyncio as _asyncio


def _run(coro):
    """Run a coroutine from a sync context, reusing or creating an event loop."""
    try:
        loop = _asyncio.get_event_loop()
        if loop.is_running():
            # Inside an existing event loop (e.g. pytest-asyncio) — use run_coroutine_threadsafe
            future = _asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result(timeout=2)
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return _asyncio.run(coro)


def check_lockout(identifier: str) -> dict:
    """Sync wrapper: returns {'locked': bool, 'retry_after_seconds': int}."""
    locked, remaining = _run(lockout_policy.is_locked(identifier))
    return {"locked": locked, "retry_after_seconds": remaining}


def record_failure(identifier: str) -> dict:
    """Sync wrapper: records a failed attempt. Returns {'attempts': int, 'locked': bool}."""
    attempts, now_locked = _run(lockout_policy.record_failed_attempt(identifier))
    return {"attempts": attempts, "locked": now_locked}


def record_success(identifier: str) -> None:
    """Sync wrapper: clears the failure counter on successful login."""
    _run(lockout_policy.reset_lockout(identifier))
