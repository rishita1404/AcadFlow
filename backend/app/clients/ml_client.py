import httpx

from app.core.config import settings


class MLClient:
    def __init__(self, base_url: str = settings.ML_SERVICE_URL):
        self.base_url = base_url

    async def get_risk_prediction(self, features: dict) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/predict", json=features, timeout=5.0
            )
            return response.json()
