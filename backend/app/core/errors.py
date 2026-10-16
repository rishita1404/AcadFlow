from fastapi import HTTPException, status


class EntityNotFoundError(HTTPException):
    def __init__(self, detail: str = "Entity not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class RateLimitExceededError(HTTPException):
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)
