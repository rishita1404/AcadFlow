import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from fastapi.testclient import TestClient
from serve.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
