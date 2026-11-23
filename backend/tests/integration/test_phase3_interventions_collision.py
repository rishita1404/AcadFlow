"""
Phase 3 Integration Tests: Intervention Log, Role Scoping (Dean Read-Only, Student 403),
Timeline with Score Delta, Human Outcome Update, and Deadline Collision Warning.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.audit import audit_logger
from app.core.tokens import create_access_token
from app.models import (
    AssignmentModel,
    CourseModel,
    CourseStaffModel,
    DeanAssignmentModel,
    DepartmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    RiskConfigModel,
    RiskSnapshotModel,
    StudentModel,
    UserModel,
)
from app.models.intervention import InterventionModel


def _auth_headers(user_id: int, role: str = "faculty", email: str = "faculty@acadflow.edu"):
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def phase3_setup(db_session: Session):
    dept_cse = db_session.query(DepartmentModel).filter_by(code="CSE").first()
    dept_ece = db_session.query(DepartmentModel).filter_by(code="ECE").first()
    if not dept_ece:
        dept_ece = DepartmentModel(name="Electronics & Comm", code="ECE")
        db_session.add(dept_ece)
        db_session.flush()

    student_user = db_session.query(UserModel).filter_by(email="student1@acadflow.edu").first()
    student_user_2 = db_session.query(UserModel).filter_by(email="student2@acadflow.edu").first()

    mentor_user = UserModel(
        name="Dr. Mentor Phase3",
        email="mentor_p3@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept_cse.id,
    )
    instructor_user = UserModel(
        name="Prof. Instructor Phase3",
        email="instructor_p3@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept_cse.id,
    )
    unrelated_faculty = UserModel(
        name="Prof. Unrelated Phase3",
        email="unrelated_p3@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept_cse.id,
    )
    dean_cse = UserModel(
        name="Dean CSE Phase3",
        email="dean_cse_p3@acadflow.edu",
        password_hash="hash",
        role="coordinator",
        department_id=dept_cse.id,
    )
    dean_ece = UserModel(
        name="Dean ECE Phase3",
        email="dean_ece_p3@acadflow.edu",
        password_hash="hash",
        role="coordinator",
        department_id=dept_ece.id,
    )
    db_session.add_all([mentor_user, instructor_user, unrelated_faculty, dean_cse, dean_ece])
    db_session.flush()

    # Mentor assignment
    db_session.add(MentorAssignmentModel(mentor_id=mentor_user.id, student_id=student_user.id))

    # Dean assignments
    db_session.add(DeanAssignmentModel(user_id=dean_cse.id, department_id=dept_cse.id))
    db_session.add(DeanAssignmentModel(user_id=dean_ece.id, department_id=dept_ece.id))

    # Course
    course = CourseModel(
        code="CS701_P3",
        name="Distributed Systems",
        semester_id=1,
        department_id=dept_cse.id,
        total_classes=60,
    )
    db_session.add(course)
    db_session.flush()

    # Course Staff: instructor_user is instructor
    db_session.add(CourseStaffModel(course_id=course.id, user_id=instructor_user.id, role="instructor"))

    # Enrolment
    db_session.add(EnrolmentModel(student_id=student_user.id, course_id=course.id, enrolled_on=date(2026, 7, 15)))

    # Risk Snapshot for student
    snap = RiskSnapshotModel(
        student_id=student_user.id,
        computed_at=datetime.now(timezone.utc) - timedelta(days=2),
        score=Decimal("65.00"),
        band="Critical",
        worst_course_id=course.id,
    )
    db_session.add(snap)

    db_session.commit()

    return {
        "student": student_user,
        "student2": student_user_2,
        "mentor": mentor_user,
        "instructor": instructor_user,
        "unrelated": unrelated_faculty,
        "dean_cse": dean_cse,
        "dean_ece": dean_ece,
        "course": course,
    }


def test_create_intervention_mentor_success(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]
    mentor = phase3_setup["mentor"]
    course = phase3_setup["course"]

    headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    payload = {
        "student_id": student.id,
        "course_id": course.id,
        "kind": "talk",
        "note": "One-on-one advising session regarding academic pressure and missed classes.",
        "follow_up_on": "2026-11-28",
    }
    res = client.post("/api/v1/interventions", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["student_id"] == student.id
    assert data["kind"] == "talk"
    assert data["outcome"] == "open"
    assert data["score_at_creation"] == 65.0
    assert data["band_at_creation"] == "Critical"
    assert data["created_by"] == mentor.id


def test_create_intervention_instructor_success(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]
    instructor = phase3_setup["instructor"]
    course = phase3_setup["course"]

    headers = _auth_headers(instructor.id, role="faculty", email=instructor.email)
    payload = {
        "student_id": student.id,
        "course_id": course.id,
        "kind": "email",
        "note": "Sent remedial assignment materials and lecture summary notes.",
    }
    res = client.post("/api/v1/interventions", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["kind"] == "email"


def test_create_intervention_dean_read_only_403(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]
    dean_cse = phase3_setup["dean_cse"]

    headers = _auth_headers(dean_cse.id, role="coordinator", email=dean_cse.email)
    payload = {
        "student_id": student.id,
        "kind": "referral",
        "note": "Dean attempting to log action directly",
    }
    res = client.post("/api/v1/interventions", json=payload, headers=headers)
    assert res.status_code == 403


def test_create_intervention_student_forbidden_403(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]

    headers = _auth_headers(student.id, role="student", email=student.email)
    payload = {
        "student_id": student.id,
        "kind": "talk",
        "note": "Student attempting to create intervention",
    }
    res = client.post("/api/v1/interventions", json=payload, headers=headers)
    assert res.status_code == 403


def test_create_intervention_unrelated_faculty_403(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]
    unrelated = phase3_setup["unrelated"]

    headers = _auth_headers(unrelated.id, role="faculty", email=unrelated.email)
    payload = {
        "student_id": student.id,
        "kind": "call",
        "note": "Unrelated faculty attempting to intervene",
    }
    res = client.post("/api/v1/interventions", json=payload, headers=headers)
    assert res.status_code == 403


def test_view_interventions_timeline_and_score_delta(client: TestClient, db_session: Session, phase3_setup: dict):
    student = phase3_setup["student"]
    mentor = phase3_setup["mentor"]
    course = phase3_setup["course"]

    # Create intervention with score_at_creation = 70.0
    intervention = InterventionModel(
        student_id=student.id,
        course_id=course.id,
        created_by=mentor.id,
        kind="talk",
        note="Initial intervention meeting",
        follow_up_on=date(2026, 11, 25),
        outcome="open",
        score_at_creation=Decimal("70.00"),
        band_at_creation="Critical",
        created_at=datetime.now(timezone.utc) - timedelta(days=5),
    )
    db_session.add(intervention)

    # Current risk snapshot is 65.0 (improved by 5 points)
    # Score change = current_score - score_at_creation = 65.0 - 70.0 = -5.0
    db_session.commit()

    headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    res = client.get(f"/api/v1/interventions/students/{student.id}", headers=headers)
    assert res.status_code == 200
    timeline = res.json()
    assert len(timeline) >= 1
    item = timeline[0]
    assert item["score_at_creation"] == 70.0
    assert item["current_score"] == 65.0
    assert item["score_change"] == -5.0


def test_view_interventions_student_forbidden_403(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]
    headers = _auth_headers(student.id, role="student", email=student.email)
    res = client.get(f"/api/v1/interventions/students/{student.id}", headers=headers)
    assert res.status_code == 403


def test_view_interventions_dean_audited(client: TestClient, phase3_setup: dict):
    student = phase3_setup["student"]
    dean_cse = phase3_setup["dean_cse"]

    headers = _auth_headers(dean_cse.id, role="coordinator", email=dean_cse.email)
    res = client.get(f"/api/v1/interventions/students/{student.id}", headers=headers)
    assert res.status_code == 200

    # Cross department dean gets 403
    dean_ece = phase3_setup["dean_ece"]
    ece_headers = _auth_headers(dean_ece.id, role="coordinator", email=dean_ece.email)
    res_ece = client.get(f"/api/v1/interventions/students/{student.id}", headers=ece_headers)
    assert res_ece.status_code == 403


def test_update_intervention_outcome_human_driven(client: TestClient, db_session: Session, phase3_setup: dict):
    student = phase3_setup["student"]
    mentor = phase3_setup["mentor"]
    dean_cse = phase3_setup["dean_cse"]

    intervention = InterventionModel(
        student_id=student.id,
        created_by=mentor.id,
        kind="talk",
        note="Mentoring discussion",
        outcome="open",
        score_at_creation=Decimal("65.00"),
        band_at_creation="Critical",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(intervention)
    db_session.commit()

    # Dean is read-only -> 403 Forbidden on update
    dean_headers = _auth_headers(dean_cse.id, role="coordinator", email=dean_cse.email)
    res_dean = client.patch(
        f"/api/v1/interventions/{intervention.id}",
        json={"outcome": "recovered"},
        headers=dean_headers,
    )
    assert res_dean.status_code == 403

    # Mentor updates outcome -> 200 OK
    mentor_headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    res_mentor = client.patch(
        f"/api/v1/interventions/{intervention.id}",
        json={"outcome": "recovered", "note": "Student attended all sessions this week and recovered eligibility."},
        headers=mentor_headers,
    )
    assert res_mentor.status_code == 200
    data = res_mentor.json()
    assert data["outcome"] == "recovered"
    assert data["closed_at"] is not None


def test_deadline_collision_preview(client: TestClient, db_session: Session, phase3_setup: dict):
    course = phase3_setup["course"]
    mentor = phase3_setup["mentor"]
    target_date = datetime(2026, 11, 20, 18, 0, tzinfo=timezone.utc)

    # Create 3 assignments within 7 days of target_date (Nov 18, Nov 19, Nov 21)
    asgn1 = AssignmentModel(
        course_id=course.id,
        title="Lab 3 Report",
        kind="lab file",
        due_at=datetime(2026, 11, 18, 23, 59, tzinfo=timezone.utc),
    )
    asgn2 = AssignmentModel(
        course_id=course.id,
        title="Quiz 2",
        kind="exam",
        due_at=datetime(2026, 11, 19, 14, 0, tzinfo=timezone.utc),
    )
    asgn3 = AssignmentModel(
        course_id=course.id,
        title="Project Milestone",
        kind="assignment",
        due_at=datetime(2026, 11, 21, 23, 59, tzinfo=timezone.utc),
    )
    db_session.add_all([asgn1, asgn2, asgn3])
    db_session.commit()

    headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    payload = {
        "course_id": course.id,
        "proposed_due_at": "2026-11-20T18:00:00Z",
    }
    res = client.post("/api/v1/assignments/collision-preview", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["has_collision_warning"] is True
    assert data["window_count"] == 3
    assert data["warning_threshold"] == 3
    assert "2026-11-18" in data["daily_counts"]
    assert data["daily_counts"]["2026-11-18"] == 1
    assert data["lightest_nearby_date"] is not None
    assert "Caution" in data["message"]
