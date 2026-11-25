"""
Phase 4 Integration Tests: Dean Trends, Hotspots, Intervention Funnel,
Mentor Load, Excel Export, Scoping & 403 Permissions, and Audit Logging.
"""

import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.audit import AuditAction, audit_logger
from app.core.tokens import create_access_token
from app.models import (
    CourseModel,
    DeanAssignmentModel,
    DepartmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    RiskSnapshotModel,
    StudentModel,
    UserModel,
)
from app.models.intervention import InterventionModel


def _auth_headers(user_id: int, role: str = "coordinator", email: str = "dean@acadflow.edu"):
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def phase4_setup(db_session: Session):
    # Setup 2 departments
    dept1 = db_session.query(DepartmentModel).filter_by(code="CSE").first()
    if not dept1:
        dept1 = DepartmentModel(name="Computer Science", code="CSE")
        db_session.add(dept1)
        db_session.flush()

    dept2 = db_session.query(DepartmentModel).filter_by(code="ECE").first()
    if not dept2:
        dept2 = DepartmentModel(name="Electronics", code="ECE")
        db_session.add(dept2)
        db_session.flush()

    # Dean of Dept 1
    dean_dept1 = UserModel(
        name="Dean CSE Phase4",
        email="dean_cse_p4@acadflow.edu",
        password_hash="hash",
        role="coordinator",
        department_id=dept1.id,
    )
    # Dean of Dept 2
    dean_dept2 = UserModel(
        name="Dean ECE Phase4",
        email="dean_ece_p4@acadflow.edu",
        password_hash="hash",
        role="coordinator",
        department_id=dept2.id,
    )
    # Regular Faculty
    faculty_user = UserModel(
        name="Prof. Regular Phase4",
        email="faculty_p4@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept1.id,
    )
    # Mentor
    mentor_user = UserModel(
        name="Prof. Mentor Phase4",
        email="mentor_p4@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept1.id,
    )
    # Students in Dept 1
    student1 = UserModel(
        name="Student One P4",
        email="student1_p4@acadflow.edu",
        password_hash="hash",
        role="student",
        department_id=dept1.id,
    )
    student2 = UserModel(
        name="Student Two P4",
        email="student2_p4@acadflow.edu",
        password_hash="hash",
        role="student",
        department_id=dept1.id,
    )

    db_session.add_all([dean_dept1, dean_dept2, faculty_user, mentor_user, student1, student2])
    db_session.flush()

    # Dean assignments
    db_session.add(DeanAssignmentModel(user_id=dean_dept1.id, department_id=dept1.id))
    db_session.add(DeanAssignmentModel(user_id=dean_dept2.id, department_id=dept2.id))

    # Student profiles
    db_session.add(StudentModel(user_id=student1.id, roll_no="P4-001", batch="2026"))
    db_session.add(StudentModel(user_id=student2.id, roll_no="P4-002", batch="2026"))
    db_session.flush()

    # Mentor assignment
    db_session.add(MentorAssignmentModel(mentor_id=mentor_user.id, student_id=student1.id))
    db_session.add(MentorAssignmentModel(mentor_id=mentor_user.id, student_id=student2.id))

    # Course in Dept 1
    course1 = CourseModel(
        code="CS401",
        name="Cloud Systems",
        department_id=dept1.id,
        semester_id=1,
        total_classes=40,
    )
    db_session.add(course1)
    db_session.flush()

    # Enrolments
    db_session.add(EnrolmentModel(course_id=course1.id, student_id=student1.id, enrolled_on=date(2026, 7, 15)))
    db_session.add(EnrolmentModel(course_id=course1.id, student_id=student2.id, enrolled_on=date(2026, 7, 15)))

    # Risk snapshots for weekly trends
    now = datetime.now(timezone.utc)
    # Student 1 in Critical / Needs support
    db_session.add(
        RiskSnapshotModel(
            student_id=student1.id,
            computed_at=now - timedelta(days=2),
            score=Decimal("82.5"),
            band="Critical",
            worst_course_id=course1.id,
        )
    )
    # Student 2 in Watch
    db_session.add(
        RiskSnapshotModel(
            student_id=student2.id,
            computed_at=now - timedelta(days=2),
            score=Decimal("45.0"),
            band="Watch",
            worst_course_id=course1.id,
        )
    )
    # Previous week snapshot
    db_session.add(
        RiskSnapshotModel(
            student_id=student1.id,
            computed_at=now - timedelta(days=10),
            score=Decimal("78.0"),
            band="At risk",
            worst_course_id=course1.id,
        )
    )

    # Interventions for funnel
    db_session.add(
        InterventionModel(
            student_id=student1.id,
            course_id=course1.id,
            created_by=mentor_user.id,
            kind="talk",
            note="Met with student to discuss recovery plan",
            outcome="recovered",
            score_at_creation=Decimal("82.5"),
            band_at_creation="Critical",
            created_at=now - timedelta(days=1),
        )
    )

    db_session.commit()

    return {
        "dept1": dept1,
        "dept2": dept2,
        "dean_dept1": dean_dept1,
        "dean_dept2": dean_dept2,
        "faculty": faculty_user,
        "mentor": mentor_user,
        "student1": student1,
        "student2": student2,
        "course1": course1,
    }


def test_dean_get_department_trends_success(client: TestClient, phase4_setup):
    data = phase4_setup
    dean = data["dean_dept1"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/trends?weeks=8",
        headers=_auth_headers(dean.id, role="coordinator", email=dean.email),
    )
    assert resp.status_code == 200
    res = resp.json()

    assert res["department_id"] == dept.id
    assert res["weeks_analyzed"] == 8
    assert len(res["weekly_risk_trends"]) == 8

    # Check that latest week shows snapshots
    latest_week = res["weekly_risk_trends"][-1]
    assert latest_week["needs_support"] >= 1
    assert latest_week["watch"] >= 1

    # Check top hotspots
    assert len(res["top_hotspots"]) >= 1
    hotspot = res["top_hotspots"][0]
    assert hotspot["course_code"] == "CS401"
    assert hotspot["total_students"] == 2
    assert hotspot["students_needing_support"] >= 1

    # Check intervention funnel
    funnel = res["intervention_funnel"]
    assert funnel["flagged"] >= 1
    assert funnel["contacted"] >= 1
    assert funnel["recovered"] >= 1
    assert funnel["contact_rate_pct"] > 0
    assert funnel["recovery_rate_pct"] > 0


def test_cross_department_trends_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    dean_dept2 = data["dean_dept2"]
    dept1 = data["dept1"]

    # Dean of Dept 2 attempts to access Dept 1
    resp = client.get(
        f"/api/v1/departments/{dept1.id}/trends?weeks=8",
        headers=_auth_headers(dean_dept2.id, role="coordinator", email=dean_dept2.email),
    )
    assert resp.status_code == 403
    assert "FORBIDDEN" in str(resp.json()).upper()


def test_student_access_trends_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    student = data["student1"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/trends",
        headers=_auth_headers(student.id, role="student", email=student.email),
    )
    assert resp.status_code == 403


def test_unauthorized_faculty_access_trends_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    faculty = data["faculty"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/trends",
        headers=_auth_headers(faculty.id, role="faculty", email=faculty.email),
    )
    assert resp.status_code == 403


def test_dean_get_mentor_load_success(client: TestClient, phase4_setup):
    data = phase4_setup
    dean = data["dean_dept1"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/mentor-load",
        headers=_auth_headers(dean.id, role="coordinator", email=dean.email),
    )
    assert resp.status_code == 200
    res = resp.json()

    assert res["department_id"] == dept.id
    assert res["total_mentors"] >= 1
    assert res["total_mentees"] >= 2

    mentor_entry = next((m for m in res["mentors"] if m["mentor_id"] == data["mentor"].id), None)
    assert mentor_entry is not None
    assert mentor_entry["mentee_count"] == 2
    assert mentor_entry["high_risk_mentee_count"] >= 1
    assert mentor_entry["high_risk_share_pct"] == 50.0


def test_cross_department_mentor_load_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    dean_dept2 = data["dean_dept2"]
    dept1 = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept1.id}/mentor-load",
        headers=_auth_headers(dean_dept2.id, role="coordinator", email=dean_dept2.email),
    )
    assert resp.status_code == 403


def test_student_access_mentor_load_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    student = data["student1"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/mentor-load",
        headers=_auth_headers(student.id, role="student", email=student.email),
    )
    assert resp.status_code == 403


def test_dean_export_department_trends_excel(client: TestClient, phase4_setup):
    data = phase4_setup
    dean = data["dean_dept1"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/trends/export?weeks=8",
        headers=_auth_headers(dean.id, role="coordinator", email=dean.email),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment; filename=" in resp.headers["content-disposition"]

    # Verify openpyxl can read all 4 sheets
    wb = openpyxl.load_workbook(filename=io.BytesIO(resp.content))
    sheet_names = wb.sheetnames
    assert "Weekly Trends" in sheet_names
    assert "Course Hotspots" in sheet_names
    assert "Intervention Funnel" in sheet_names
    assert "Mentor Load" in sheet_names

    ws_trends = wb["Weekly Trends"]
    assert ws_trends.cell(row=1, column=1).value == "Week Label"

    ws_hotspots = wb["Course Hotspots"]
    assert ws_hotspots.cell(row=1, column=1).value == "Course Code"


def test_cross_department_export_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    dean_dept2 = data["dean_dept2"]
    dept1 = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept1.id}/trends/export",
        headers=_auth_headers(dean_dept2.id, role="coordinator", email=dean_dept2.email),
    )
    assert resp.status_code == 403


def test_student_export_returns_403(client: TestClient, phase4_setup):
    data = phase4_setup
    student = data["student1"]
    dept = data["dept1"]

    resp = client.get(
        f"/api/v1/departments/{dept.id}/trends/export",
        headers=_auth_headers(student.id, role="student", email=student.email),
    )
    assert resp.status_code == 403


def test_audit_log_written_for_dean_views(client: TestClient, phase4_setup):
    audit_logger.clear_memory_sink()
    data = phase4_setup
    dean = data["dean_dept1"]
    dept = data["dept1"]

    client.get(
        f"/api/v1/departments/{dept.id}/trends?weeks=8",
        headers=_auth_headers(dean.id, role="coordinator", email=dean.email),
    )
    client.get(
        f"/api/v1/departments/{dept.id}/mentor-load",
        headers=_auth_headers(dean.id, role="coordinator", email=dean.email),
    )

    events = audit_logger.get_recent_events(limit=10)
    dean_events = [e for e in events if e.get("action") == AuditAction.DEAN_RECORD_VIEW]
    assert len(dean_events) >= 2
