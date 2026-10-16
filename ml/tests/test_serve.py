from fastapi.testclient import TestClient
from serve.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
