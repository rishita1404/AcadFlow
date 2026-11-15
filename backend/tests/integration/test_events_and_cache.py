"""
Integration tests for Server-Sent Events (SSE) and Redis Cache-Aside.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models import DepartmentModel, UserModel
from app.services.cache import get_cached_json, invalidate_department_cache, set_cached_json
from app.services.event_bus import event_bus


def _get_token(client: TestClient, db: Session, role: str = "coordinator") -> str:
    email = f"test_{role}_sse@acadflow.edu"
    u = db.query(UserModel).filter(UserModel.email == email).first()
    dept = db.query(DepartmentModel).first()
    dept_id = dept.id if dept else 1

    if not u:
        u = UserModel(
            name=f"Test {role.title()}",
            email=email,
            password_hash=get_password_hash("AcadFlow@123"),
            role=role,
            department_id=dept_id,
        )
        db.add(u)
        db.commit()
        db.refresh(u)

    res = client.post("/api/v1/auth/login", data={"username": email, "password": "AcadFlow@123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_sse_endpoint_requires_auth(client: TestClient):
    res = client.get("/api/v1/events")
    assert res.status_code in (401, 403)


def test_sse_endpoint_connects(client: TestClient, db_session: Session):
    token = _get_token(client, db_session, role="coordinator")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/events?test=1", headers=headers)
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert "event: connected" in res.text


def test_cache_service_fallback_and_invalidation():
    key = "test:unit:key:1"
    data = {"status": "ok", "value": 42}

    # Should safely set and get (or return False/None if Redis is unavailable)
    set_res = set_cached_json(key, data, ttl=10)
    if set_res:
        val = get_cached_json(key)
        assert val == data

    # Invalidate should execute safely
    inv_count = invalidate_department_cache(1)
    assert isinstance(inv_count, int)
