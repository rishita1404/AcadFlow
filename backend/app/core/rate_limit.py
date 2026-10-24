"""
Redis-Backed Sliding-Window Rate Limiter for AcadFlow.

Implements PRD Section 6 / Week 4 requirements:
- Key patterns:
  - rl:login:{ip}: Rate-limit on login routes (e.g. 10 req/min).
  - rl:upload:{user_id}: Rate-limit on attendance and assignment uploads (e.g. 5 req/min).
- HTTP 429 Too Many Requests with 'Retry-After' header and RATE_429 error code.
- Anti-spoofing: only trusts X-Forwarded-For / X-Real-IP if peer is a configured trusted proxy.
- Safe Failure Policy: falls back to an in-memory sliding window if Redis is temporarily unreachable.
"""

import ipaddress
import time
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, Request, status

from app.db.redis import redis_client

DEFAULT_TRUSTED_PROXIES = [
    "127.0.0.1",
    "::1",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
]


def is_ip_trusted(ip_str: str, trusted_networks: List[str]) -> bool:
    """Check if an IP address belongs to a trusted proxy subnet."""
    try:
        ip = ipaddress.ip_address(ip_str)
        for net in trusted_networks:
            if ip in ipaddress.ip_network(net, strict=False):
                return True
    except ValueError:
        pass
    return False


def get_client_ip(request: Request, trusted_proxies: Optional[List[str]] = None) -> str:
    """
    Safely resolve client IP address without trusting spoofed forwarded headers.
    """
    trusted = trusted_proxies or DEFAULT_TRUSTED_PROXIES
    direct_peer = request.client.host if request.client else "127.0.0.1"

    # Only inspect forwarding headers if direct peer is a trusted reverse proxy (e.g., NGINX)
    if is_ip_trusted(direct_peer, trusted):
        # Prefer X-Real-IP set by NGINX
        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip:
            return x_real_ip.strip()

        # Or parse leftmost client IP in X-Forwarded-For
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            client_candidate = x_forwarded_for.split(",")[0].strip()
            return client_candidate

    return direct_peer


class RateLimiter:
    def __init__(
        self,
        requests_per_minute: int = 60,
        window_seconds: int = 60,
        client=None,
        key_prefix: str = "rl",
        fail_closed: bool = False,
    ):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self.client = client if client is not None else redis_client
        self.key_prefix = key_prefix
        self.fail_closed = fail_closed
        # In-memory sliding window fallback: key -> list of timestamp floats
        self._memory_windows: Dict[str, List[float]] = {}

    def _format_key(self, identifier: str) -> str:
        return f"{self.key_prefix}:{identifier}"

    async def is_allowed(self, identifier: str) -> Tuple[bool, int]:
        """
        Sliding-window check using Redis sorted sets (ZADD/ZREMRANGEBYSCORE).
        Returns: (is_allowed: bool, retry_after_seconds: int)
        """
        now = time.time()
        window_start = now - self.window_seconds
        key = self._format_key(identifier)

        try:
            # Atomic sliding-window pipeline
            pipe = self.client.pipeline()
            # 1. Remove entries older than sliding window
            pipe.zremrangebyscore(key, "-inf", window_start)
            # 2. Count requests in current window
            pipe.zcard(key)
            # 3. Add current timestamp
            pipe.zadd(key, {str(now): now})
            # 4. Set TTL on the set
            pipe.expire(key, self.window_seconds + 1)
            results = await pipe.execute()

            current_count = results[1]
            if current_count >= self.requests_per_minute:
                # Limit exceeded: calculate retry-after
                oldest_entries = await self.client.zrange(key, 0, 0, withscores=True)
                retry_after = self.window_seconds
                if oldest_entries:
                    oldest_ts = oldest_entries[0][1]
                    retry_after = max(1, int(self.window_seconds - (now - oldest_ts)))
                return False, retry_after

            return True, 0

        except Exception:
            # Fallback policy when Redis is offline
            timestamps = self._memory_windows.setdefault(key, [])
            # Prune old timestamps
            self._memory_windows[key] = [t for t in timestamps if t > window_start]
            timestamps = self._memory_windows[key]

            if len(timestamps) >= self.requests_per_minute:
                oldest = timestamps[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                return False, retry_after

            timestamps.append(now)
            return True, 0

    async def check(self, identifier: str) -> None:
        """
        Enforce rate limit or raise 429 Too Many Requests with RATE_429 error code.
        """
        allowed, retry_after = await self.is_allowed(identifier)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": {
                        "code": "RATE_429",
                        "message": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )


# Preconfigured instances for PRD routes
login_rate_limiter = RateLimiter(
    requests_per_minute=10, window_seconds=60, key_prefix="rl:login"
)
upload_rate_limiter = RateLimiter(
    requests_per_minute=5, window_seconds=60, key_prefix="rl:upload"
)
