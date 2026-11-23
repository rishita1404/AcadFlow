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


def _is_redis_listening(host: str = "127.0.0.1", port: int = 6379) -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        res = s.connect_ex((host, port))
        s.close()
        return res == 0
    except Exception:
        return False


redis_client = None

try:
    import redis.asyncio as aioredis

    url = settings.REDIS_URL or ""
    is_remote = not ("localhost" in url or "127.0.0.1" in url)

    if is_remote or _is_redis_listening():
        redis_kwargs = {
            "decode_responses": True,
            "socket_connect_timeout": 3.0,
            "socket_timeout": 3.0,
        }
        if url.startswith("rediss://"):
            import ssl

            redis_kwargs["ssl_cert_reqs"] = ssl.CERT_NONE

        redis_client = aioredis.from_url(url, **redis_kwargs)
        logger.info(
            "Configured Redis client with URL: %s",
            url.split("@")[-1] if "@" in url else url,
        )
    else:
        logger.info("Local Redis not detected on 127.0.0.1:6379. Using in-memory fallback.")
        redis_client = DummyRedis()
except Exception as e:
    logger.warning("Redis initialization error: %s. Using in-memory fallback.", e)
    redis_client = DummyRedis()
