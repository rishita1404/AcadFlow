"""
Integration tests for the risk engine end-to-end flow.
Member 3 (Raghav) — Evaluation 1

Tests the full workflow:
1. Create student + course in test DB
2. Record initial attendance
3. Get buffer and risk result
4. Change attendance
5. Verify risk result updates correctly

Uses the project's existing SQLite in-memory test infrastructure.

Run:
    cd backend && python -m pytest tests/integration/test_risk_integration.py -v
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    AssignmentModel,
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    RiskConfigModel,
    SemesterModel,
    StudentModel,
    SubmissionModel,
    UserModel,
)
from app.services.buffer import compute_attendance_buffer, compute_margin_score
from app.services.risk import compute_risk_score
from app.services.risk_data import calculate_student_course_risk


# ──────────────────────────────────────────────────────────────────────────────
# Helpers to build consistent test data
# ──────────────────────────────────────────────────────────────────────────────

def _seed_risk_config(db: Session) -> RiskConfigModel:
    config = RiskConfigModel(
        w_margin=Decimal("50"), w_trend=Decimal("20"),
        w_deadline=Decimal("20"), w_missed=Decimal("10"),
        t_watch=Decimal("30"), t_risk=Decimal("55"),
        t_critical=Decimal("80"), min_classes=8, version="v_test",
    )
    db.add(config)
    db.flush()
    return config


def _make_student_and_course(db: Session, suffix: str = ""):
    """Create a fresh student enrolled in a 60-class course."""
    dept = db.query(DepartmentModel).first()
    sem = db.query(SemesterModel).first()

    user = UserModel(
        name=f"Test Student {suffix}",
        email=f"test_risk_{suffix}@acadflow.edu",
        password_hash="hash",
        role="student",
        department_id=dept.id,
    )
    db.add(user)
    db.flush()

    student = StudentModel(user_id=user.id, roll_no=f"TST{suffix}", batch="2026")
    db.add(student)

    course = CourseModel(
        code=f"RIST{suffix}",
        name=f"Risk Test Course {suffix}",
        semester_id=sem.id,
        department_id=dept.id,
        total_classes=60,
    )
    db.add(course)
    db.flush()

    enrolment = EnrolmentModel(
        student_id=student.user_id,
        course_id=course.id,
        enrolled_on=date(2026, 7, 15),
    )
    db.add(enrolment)
    db.flush()

    return student, course


def _create_sessions_and_attendance(
    db: Session, student_id: int, course_id: int,
    n_sessions: int, n_present: int,
) -> list[ClassSessionModel]:
    """Create n_sessions class sessions; mark n_present as present."""
    sessions = []
    for i in range(n_sessions):
        cs = ClassSessionModel(
            course_id=course_id,
            held_on=date(2026, 8, 1) + __import__("datetime").timedelta(days=i),
            is_cancelled=False,
        )
        db.add(cs)
        db.flush()
        sessions.append(cs)

    for i, cs in enumerate(sessions):
        status = "present" if i < n_present else "absent"
        rec = AttendanceRecordModel(
            session_id=cs.id,
            student_id=student_id,
            status=status,
            marked_by=1,
            marked_at=datetime.now(timezone.utc),
        )
        db.add(rec)
    db.flush()
    return sessions


# ──────────────────────────────────────────────────────────────────────────────
# Integration tests
# ──────────────────────────────────────────────────────────────────────────────

class TestRiskCalculationIntegration:

    def test_insufficient_data_when_few_sessions(self, db_session: Session):
        """
        With only 5 sessions held (< min_classes=8), risk engine must
        return insufficient_data=True — not a misleading score.
        """
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "ins1")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 5, 5)

        data = calculate_student_course_risk(db_session, student.user_id, course.id)

        assert data["insufficient_data"] is True
        assert data["status_message"] == "Not enough data yet"

    def test_appendix_a_riya_via_db(self, db_session: Session):
        """
        Riya scenario via real DB queries:
        held=40 (but we use 10 for speed in tests, scaling proportionally)
        We use exact Appendix A: held=40, attended=30, total=60.
        """
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "riya")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 40, 30)

        data = calculate_student_course_risk(db_session, student.user_id, course.id)

        assert data["insufficient_data"] is False
        assert data["buffer"] == 5
        assert data["remaining"] == 20   # 60 - 40 = 20
        assert data["margin_points"] == pytest.approx(37.5, abs=0.1)

    def test_karan_negative_buffer_via_db(self, db_session: Session):
        """Karan: held=50, attended=30 → buffer=-5, margin=50."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "karan")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 50, 30)

        data = calculate_student_course_risk(db_session, student.user_id, course.id)

        assert data["buffer"] == -5
        assert data["margin_points"] == pytest.approx(50.0, abs=0.01)
        assert "Not recoverable" in data["status_message"]

    def test_attendance_change_updates_risk(self, db_session: Session):
        """
        Core Phase G requirement: changing attendance must change the
        risk result.  We verify the calculation changes deterministically.
        """
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "chg1")
        sessions = _create_sessions_and_attendance(
            db_session, student.user_id, course.id, 40, 20
        )
        # initial: attended=20, buffer = 20 - max(0,45-20) = 20-25 = -5 → margin=50
        data_before = calculate_student_course_risk(db_session, student.user_id, course.id)
        assert data_before["buffer"] == -5

        # Now correct one absent → present (total attended becomes 30)
        absent_sessions = [
            s for s in sessions
            if db_session.query(AttendanceRecordModel).filter_by(
                session_id=s.id, student_id=student.user_id
            ).first().status == "absent"
        ]
        # Change 10 absent records to present
        changed = 0
        for s in absent_sessions[:10]:
            rec = db_session.query(AttendanceRecordModel).filter_by(
                session_id=s.id, student_id=student.user_id
            ).first()
            rec.status = "present"
            changed += 1
        db_session.flush()

        data_after = calculate_student_course_risk(db_session, student.user_id, course.id)
        # attended=30, buffer=5 now
        assert data_after["buffer"] == 5
        assert data_after["buffer"] != data_before["buffer"]
        assert data_after["margin_points"] < data_before["margin_points"]

    def test_no_missed_penalty_without_submissions(self, db_session: Session):
        """PRD: student with no submissions yet has no missed-submission penalty."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "nosub")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 10, 8)

        data = calculate_student_course_risk(db_session, student.user_id, course.id)
        assert data["missed_points"] == 0.0

    def test_risk_score_deterministic(self, db_session: Session):
        """Same inputs always produce the same risk score."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "det1")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 20, 15)

        d1 = calculate_student_course_risk(db_session, student.user_id, course.id)
        d2 = calculate_student_course_risk(db_session, student.user_id, course.id)
        assert d1["score"] == d2["score"]
        assert d1["band"] == d2["band"]


class TestRiskAPIEndpoints:
    """Integration tests via the FastAPI test client."""

    def test_get_buffer_returns_200(self, client: TestClient, db_session: Session):
        """GET /attendance/students/{id}/courses/{cid}/buffer returns 200."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "api1")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 40, 30)

        resp = client.get(
            f"/api/v1/attendance/students/{student.user_id}/courses/{course.id}/buffer"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["buffer"] == 5
        assert body["insufficient_data"] is False

    def test_get_risk_score_returns_200(self, client: TestClient, db_session: Session):
        """GET /risk/students/{id}/courses/{cid} returns 200."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "api2")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 40, 30)

        resp = client.get(
            f"/api/v1/risk/students/{student.user_id}/courses/{course.id}"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "band" in body
        assert "score" in body
        assert "insufficient_data" in body

    def test_insufficient_data_flag_in_api(self, client: TestClient, db_session: Session):
        """API must set insufficient_data=true when held < min_classes."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "api3")
        _create_sessions_and_attendance(db_session, student.user_id, course.id, 5, 5)

        resp = client.get(
            f"/api/v1/risk/students/{student.user_id}/courses/{course.id}"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["insufficient_data"] is True
        assert body["score"] is None

    def test_nonexistent_student_returns_404(self, client: TestClient, db_session: Session):
        resp = client.get("/api/v1/risk/students/99999/courses/1")
        assert resp.status_code == 404

    def test_mark_attendance_returns_201(self, client: TestClient, db_session: Session):
        """POST /attendance/sessions creates a session; then POST …/mark records attendance."""
        _seed_risk_config(db_session)
        student, course = _make_student_and_course(db_session, "mark1")

        # Create session
        resp = client.post("/api/v1/attendance/sessions", json={
            "course_id": course.id,
            "held_on": "2026-08-10",
            "is_cancelled": False,
        })
        assert resp.status_code == 201
        session_id = resp.json()["id"]

        # Mark attendance
        resp2 = client.post(f"/api/v1/attendance/sessions/{session_id}/mark", json={
            "session_id": session_id,
            "records": [{"session_id": session_id, "student_id": student.user_id, "status": "present"}],
        })
        assert resp2.status_code == 201
        assert resp2.json()[0]["status"] == "present"
