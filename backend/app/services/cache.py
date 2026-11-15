"""
Redis Cache-Aside Service — AcadFlow.

Provides high-performance caching for coordinator summaries, directory aggregates,
and live metrics with automatic graceful fallback if Redis is down or unreachable.
Single source of truth attendance calculations are always preserved.
"""
from __future__ import annotations

import fnmatch
import json
import logging
import time
from typing import Any, Callable, Optional

from app.core.config import settings

logger = logging.getLogger("acadflow.cache")

_redis_client = None
_redis_available = True
_mem_cache: dict[str, tuple[float, Any]] = {}


def get_redis_client():
    global _redis_client, _redis_available
    if not _redis_available:
        return None
    if _redis_client is None:
        try:
            import redis
            client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=1.0,
                socket_connect_timeout=1.0,
            )
            # Test ping
            client.ping()
            _redis_client = client
            _redis_available = True
            logger.info("Connected to Redis cache at %s", settings.REDIS_URL)
        except Exception as e:
            logger.warning("Redis unavailable (%s); falling back gracefully to direct database queries", e)
            _redis_available = False
            _redis_client = None
    return _redis_client


def get_cached_json(key: str) -> Optional[Any]:
    """Retrieve and deserialize cached JSON from Redis (or in-memory fallback), or None if missing."""
    try:
        client = get_redis_client()
        if client is not None:
            val = client.get(key)
            if val is not None:
                return json.loads(val)
    except Exception as e:
        logger.debug("Redis cache get error on '%s': %s", key, e)

    # In-memory fallback
    now = time.time()
    if key in _mem_cache:
        expire_at, val = _mem_cache[key]
        if now < expire_at:
            return val
        else:
            del _mem_cache[key]
    return None


def set_cached_json(key: str, value: Any, ttl: int = 60) -> bool:
    """Serialize and store JSON in Redis and in-memory fallback with specified TTL in seconds."""
    stored = False
    try:
        client = get_redis_client()
        if client is not None:
            client.setex(key, ttl, json.dumps(value, default=str))
            stored = True
    except Exception as e:
        logger.debug("Redis cache set error on '%s': %s", key, e)
    _mem_cache[key] = (time.time() + ttl, value)
    return True


def delete_cache_patterns(*patterns: str) -> int:
    """Invalidate cache keys matching given glob patterns across Redis and in-memory cache."""
    deleted_total = 0
    try:
        client = get_redis_client()
        if client is not None:
            for pattern in patterns:
                keys = client.keys(pattern)
                if keys:
                    deleted_total += client.delete(*keys)
    except Exception as e:
        logger.debug("Redis cache delete error for '%s': %s", patterns, e)

    # In-memory pattern cleanup
    mem_keys = list(_mem_cache.keys())
    for pat in patterns:
        for k in mem_keys:
            if fnmatch.fnmatch(k, pat) and k in _mem_cache:
                del _mem_cache[k]
                deleted_total += 1

    return deleted_total


def invalidate_department_cache(department_id: int | str) -> int:
    """
    Invalidate all coordinator summary and student directory caches
    for the specified department.
    """
    dept_str = str(department_id)
    return delete_cache_patterns(
        f"coordinator:summary:{dept_str}*",
        f"coordinator:directory:{dept_str}*",
        f"coordinator:summary:ALL*",
    )
