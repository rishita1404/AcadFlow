import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

VENDOR_DIR = ML_DIR / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from fastapi.testclient import TestClient
from serve.main import app, load_model_artifacts

load_model_artifacts()
client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_ready():
    res = client.get("/ready")
    assert res.status_code == 200
    assert res.json()["status"] == "ready"
    assert "model_version" in res.json()


def test_predict_single_valid():
    payload = {
        "attendance_margin": 0.85,
        "attendance_trend_4w": -5.5,
        "deadline_pressure": 3,
        "missed_submissions_count": 2,
        "current_attendance_pct": 68.0,
        "past_quiz_avg": 65.0,
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_label"] in ["Critical", "At Risk", "Watch", "Safe"]
    assert "model_version" in data
    assert isinstance(data["factors"], list)
    assert len(data["factors"]) > 0


def test_predict_validation_out_of_range():
    # attendance_margin must be <= 1.0
    payload = {
        "attendance_margin": 1.5,
        "attendance_trend_4w": 0.0,
        "deadline_pressure": 0,
        "missed_submissions_count": 0,
        "current_attendance_pct": 80.0,
        "past_quiz_avg": 70.0,
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 422  # Pydantic validation error


def test_predict_extra_field_forbidden():
    payload = {
        "attendance_margin": 0.5,
        "attendance_trend_4w": 0.0,
        "deadline_pressure": 0,
        "missed_submissions_count": 0,
        "current_attendance_pct": 80.0,
        "past_quiz_avg": 70.0,
        "unknown_field": "disallowed",
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 422


def test_predict_batch():
    payload = {
        "items": [
            {
                "attendance_margin": 0.1,
                "attendance_trend_4w": 2.0,
                "deadline_pressure": 1,
                "missed_submissions_count": 0,
                "current_attendance_pct": 92.0,
                "past_quiz_avg": 85.0,
            },
            {
                "attendance_margin": 0.95,
                "attendance_trend_4w": -8.0,
                "deadline_pressure": 4,
                "missed_submissions_count": 3,
                "current_attendance_pct": 60.0,
                "past_quiz_avg": 55.0,
            },
        ]
    }
    res = client.post("/predict/batch", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["batch_size"] == 2
    assert len(data["predictions"]) == 2
    assert data["predictions"][0]["risk_score"] < data["predictions"][1]["risk_score"]


def test_drift_endpoint():
    res = client.get("/drift")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "overall_drift" in data
    assert "features" in data


def test_metrics_endpoint():
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "acadflow_predictions_total" in res.text
