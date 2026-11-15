"""
Tests for Phase 4: Shadow-Mode Integration & Model Governance — AcadFlow.

Tests:
1. ML Client modes: 'off', 'shadow', 'assist'
2. Circuit breaker state machine and fallback execution
3. Admin ML comparison endpoint permissions and contract
4. Student 'What would change my score' counterfactual simulation
5. Shadow log persistence in database
"""

from __future__ import annotations

import asyncio
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.clients.ml_client import CircuitBreaker, MLClient
from app.core.tokens import create_access_token
from app.models.risk import RiskShadowLogModel
from app.models.user import UserModel
from app.services.shadow_logger import get_model_vs_rules_telemetry, record_shadow_evaluation_sync


def _make_auth_header(user_id: int, role: str, email: str = "user@acadflow.edu") -> dict:
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


def test_ml_client_mode_off():
    client = MLClient(mode="off")
    features = {"attendance_margin": 0.8, "current_attendance_pct": 65.0}
    res = asyncio.run(client.predict_risk(features, rule_fallback_score=75.0, rule_fallback_band="Critical"))
    assert res["is_fallback"] is True
    assert res["fallback_reason"] == "ml_mode_off"
    assert res["risk_score"] == 0.75
    assert res["risk_label"] == "Critical"


def test_circuit_breaker_tripping_and_fallback():
    # Use isolated circuit breaker to test threshold trip
    breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=0.5)
    client = MLClient(base_url="http://127.0.0.1:9999", mode="shadow", timeout=0.1, max_retries=0)
    client.breaker = breaker

    features = {"attendance_margin": 0.2, "current_attendance_pct": 90.0}

    # 1st failure
    res1 = asyncio.run(client.predict_risk(features, rule_fallback_score=20.0, rule_fallback_band="Safe"))
    assert res1["is_fallback"] is True
    assert breaker.state == "CLOSED"

    # 2nd failure -> trips to OPEN
    res2 = asyncio.run(client.predict_risk(features, rule_fallback_score=20.0, rule_fallback_band="Safe"))
    assert res2["is_fallback"] is True
    assert breaker.state == "OPEN"

    # 3rd request -> fails fast due to OPEN circuit without network
    res3 = asyncio.run(client.predict_risk(features, rule_fallback_score=20.0, rule_fallback_band="Safe"))
    assert res3["is_fallback"] is True
    assert res3["fallback_reason"] == "circuit_breaker_open"


def test_shadow_log_persistence(db_session):
    features = {
        "attendance_margin": 0.4,
        "attendance_trend_4w": -1.5,
        "deadline_pressure": 2.0,
        "missed_submissions_count": 0.0,
        "current_attendance_pct": 82.0,
        "past_quiz_avg": 78.0,
    }

    result = record_shadow_evaluation_sync(
        db_session,
        student_id=999,
        rule_score=35.0,
        rule_band="Watch",
        feature_dict=features,
        mode="shadow",
    )
    assert result is not None

    # Verify row was written to risk_shadow_logs
    log = db_session.scalars(
        select(RiskShadowLogModel).where(RiskShadowLogModel.student_id == 999)
    ).first()
    assert log is not None
    assert float(log.rule_score) == 35.0
    assert log.rule_band == "Watch"


def test_admin_ml_shadow_comparison_permissions(client: TestClient):
    # Unauthenticated -> 401/403
    r_unauth = client.get("/api/v1/admin/ml-shadow-comparison")
    assert r_unauth.status_code in (401, 403)

    # Student -> 403 Forbidden
    student_headers = _make_auth_header(user_id=101, role="student")
    r_student = client.get("/api/v1/admin/ml-shadow-comparison", headers=student_headers)
    assert r_student.status_code == 403

    # Admin -> 200 OK
    admin_headers = _make_auth_header(user_id=1, role="admin")
    r_admin = client.get("/api/v1/admin/ml-shadow-comparison", headers=admin_headers)
    assert r_admin.status_code == 200
    data = r_admin.json()
    assert "agreement_rate" in data
    assert "confusion_matrix" in data
    assert "fairness_panel" in data
    assert "current_model_version" in data


def test_student_what_if_endpoint(client: TestClient):
    student_headers = _make_auth_header(user_id=101, role="student")
    res = client.get("/api/v1/me/what-if", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert "disclaimer" in data
    assert "scenarios" in data
    assert isinstance(data["scenarios"], list)
    if len(data["scenarios"]) > 0:
        s0 = data["scenarios"][0]
        assert "action" in s0
        assert "impact" in s0
