"""
Integration tests for Core Web Vitals telemetry ingestion and Prometheus metrics endpoint.
"""
from fastapi.testclient import TestClient


def test_ingest_web_vitals_success(client: TestClient):
    payload = {
        "name": "LCP",
        "value": 1450.5,
        "delta": 1450.5,
        "id": "v3-1698765432-1",
        "rating": "good",
        "page": "/login",
    }
    res = client.post("/api/v1/metrics/web-vitals", json=payload)
    assert res.status_code == 204


def test_metrics_prometheus_exposition(client: TestClient):
    # Ingest a metric first
    client.post(
        "/api/v1/metrics/web-vitals",
        json={"name": "CLS", "value": 0.04, "rating": "good", "page": "/student/home"},
    )

    # Scrape /metrics
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "web_vitals_cls_ratio_bucket" in res.text
    assert "web_vitals_lcp_seconds_bucket" in res.text


def test_ingest_web_vitals_invalid_name_fails(client: TestClient):
    res = client.post(
        "/api/v1/metrics/web-vitals",
        json={"name": "INVALID_METRIC", "value": 100.0},
    )
    assert res.status_code == 422
