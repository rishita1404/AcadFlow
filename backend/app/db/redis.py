import logging
import socket

from app.core.config import settings

logger = logging.getLogger("acadflow.redis")


class DummyRedis:
    async def get(self, *args, **kwargs):
        raise ConnectionError("Redis unavailable")

    async def set(self, *args, **kwargs):
        raise ConnectionError("Redis unavailable")

    async def delete(self, *args, **kwargs):
        raise ConnectionError("Redis unavailable")

    async def incr(self, *args, **kwargs):
        raise ConnectionError("Redis unavailable")

    async def expire(self, *args, **kwargs):
        raise ConnectionError("Redis unavailable")

    async def ttl(self, *args, **kwargs):
        raise ConnectionError("Redis unavailable")


def _is_redis_listening() -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.05)
        res = s.connect_ex(("127.0.0.1", 6379))
        s.close()
        return res == 0
    except Exception:
        return False


redis_client = None

if _is_redis_listening():
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
        logger.info("Connected to Redis successfully.")
    except Exception as e:
        logger.warning("Redis initialization failed: %s. Using in-memory fallback.", e)
        redis_client = DummyRedis()
else:
    logger.info("Redis server is not running on port 6379. Using in-memory fallback immediately.")
    redis_client = DummyRedis()
