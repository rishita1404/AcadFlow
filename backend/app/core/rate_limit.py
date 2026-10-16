class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute

    async def is_allowed(self, client_id: str) -> bool:
        # Check against Redis token bucket or sliding window
        return True
