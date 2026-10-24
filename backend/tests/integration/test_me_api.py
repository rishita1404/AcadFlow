"""
Integration tests for /api/v1/me personal dashboard and simulation endpoints.

Verifies:
- GET  /api/v1/me (profile)
- GET  /api/v1/me/permissions (role switcher duties)
- GET  /api/v1/me/dashboard (student course cards, buffers, attendance %)
- POST /api/v1/me/simulate (what-if attendance calculation)
- GET  /api/v1/me/deadlines (calendar view)
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models import AssignmentModel, CourseModel, EnrolmentModel


def _get_auth_headers(
    user_id: int, role: str = "student", email: str = "student1@acadflow.edu"
):
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


def test_me_profile_authenticated(client: TestClient):
    headers = _get_auth_headers(1, role="student", email="student1@acadflow.edu")
    res = client.get("/api/v1/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert data["email"] == "student1@acadflow.edu"
    assert data["role"] == "student"


def test_me_profile_unauthenticated_returns_401(client: TestClient):
    res = client.get("/api/v1/me")
    assert res.status_code == 401


def test_me_permissions_returns_duties(client: TestClient):
    headers = _get_auth_headers(1, role="student", email="student1@acadflow.edu")
    res = client.get("/api/v1/me/permissions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["primary_role"] == "student"
    assert "duties" in data
    assert "allowed_roles" in data


def test_me_dashboard_structure(client: TestClient, db_session: Session):
    # Create a course and enrolment for student 1
    course = CourseModel(
        code="CS501_DASH",
        name="Algorithms Dashboard Test",
        semester_id=1,
        department_id=1,
        total_classes=60,
    )
    db_session.add(course)
    db_session.flush()

    enrol = EnrolmentModel(
        student_id=1,
        course_id=course.id,
        enrolled_on=datetime.now(timezone.utc).date(),
    )
    db_session.add(enrol)
    db_session.commit()

    headers = _get_auth_headers(1, role="student", email="student1@acadflow.edu")
    res = client.get("/api/v1/me/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["student_id"] == 1
    assert "courses" in data
    assert len(data["courses"]) >= 1
    card = next(c for c in data["courses"] if c["course_id"] == course.id)
    assert card["code"] == "CS501_DASH"
    assert card["total_classes"] == 60


def test_me_simulate_what_if(client: TestClient, db_session: Session):
    course = CourseModel(
        code="CS_SIM",
        name="Simulation Test Course",
        semester_id=1,
        department_id=1,
        total_classes=60,
    )
    db_session.add(course)
    db_session.flush()

    headers = _get_auth_headers(1, role="student", email="student1@acadflow.edu")
    res = client.post(
        "/api/v1/me/simulate",
        headers=headers,
        json={"course_id": course.id, "miss_count": 3},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["course_id"] == course.id
    assert data["miss_count"] == 3
    assert "status_message" in data


def test_me_deadlines_returns_list(client: TestClient, db_session: Session):
    course = CourseModel(
        code="CS_DEADLINE",
        name="Deadline Test Course",
        semester_id=1,
        department_id=1,
        total_classes=40,
    )
    db_session.add(course)
    db_session.flush()

    asgn = AssignmentModel(
        course_id=course.id,
        title="Project Milestone 1",
        kind="assignment",
        due_at=datetime.now(timezone.utc) + timedelta(days=5),
        grace_hours=48,
        is_published=True,
    )
    db_session.add(asgn)
    enrol = EnrolmentModel(
        student_id=1,
        course_id=course.id,
        enrolled_on=datetime.now(timezone.utc).date(),
    )
    db_session.add(enrol)
    db_session.commit()

    headers = _get_auth_headers(1, role="student", email="student1@acadflow.edu")
    res = client.get("/api/v1/me/deadlines", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    matching = [i for i in items if i["assignment_id"] == asgn.id]
    assert len(matching) == 1
    assert matching[0]["title"] == "Project Milestone 1"
    assert matching[0]["status"] == "pending"


def test_me_faculty_dashboard_and_calendar(client: TestClient, db_session: Session):
    from app.models import UserModel
    faculty = UserModel(
        name="Faculty Test",
        email="faculty_test@acadflow.edu",
        password_hash="hash_fac",
        role="faculty",
        department_id=1,
    )
    db_session.add(faculty)
    db_session.commit()
    headers = _get_auth_headers(faculty.id, role="faculty", email="faculty_test@acadflow.edu")
    
    # Dashboard returns teaching card
    res = client.get("/api/v1/me/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["student_id"] == faculty.id
    assert "FACULTY" in data["roll_no"]
    assert "courses" in data

    # Warnings returns list (no 401)
    res_warn = client.get("/api/v1/me/warnings", headers=headers)
    assert res_warn.status_code == 200
    assert isinstance(res_warn.json(), list)

    # Calendar returns month view (no 401)
    res_cal = client.get("/api/v1/me/calendar/2026/10", headers=headers)
    assert res_cal.status_code == 200
    assert "days" in res_cal.json()

    # Holidays returns empty list for faculty
    res_hol = client.get("/api/v1/me/holidays", headers=headers)
    assert res_hol.status_code == 200
    assert res_hol.json() == []
