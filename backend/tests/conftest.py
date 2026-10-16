import sys
from pathlib import Path
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

@pytest.fixture
async def async_client():
    from httpx import AsyncClient
    from app.main import app
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

