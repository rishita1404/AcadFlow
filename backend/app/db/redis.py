try:
    import redis.asyncio as aioredis

    from app.core.config import settings

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception:

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

    redis_client = DummyRedis()
