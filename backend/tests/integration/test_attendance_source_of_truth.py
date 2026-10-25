"""
Integration tests: Single Source of Truth for Attendance — AcadFlow.

Asserts that the SAME student shows the SAME attendance percentage across all 6 API surfaces:
  1. Student dashboard  — GET /api/v1/me/dashboard
  2. Attendance buffer  — GET /api/v1/attendance/students/{sid}/courses/{cid}/buffer
  3. Faculty roster     — GET /api/v1/students?course_id={cid}
  4. Mentor mentees     — GET /api/v1/mentor/students/{sid}/courses
  5. Risk endpoint      — GET /api/v1/risk/students/{sid}/courses/{cid}
  6. Coordinator dir    — GET /api/v1/coordinator/students

Also tests:
  - Percentage updates consistently after a new session is marked
  - Coordinator overview/course table use real counts, not hardcoded numbers
  - Two courses with different data return different course averages
  - No-data case returns None everywhere, never 100.0
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    SemesterModel,
    StudentModel,
    UserModel,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _tok(user_id: int, role: str, email: str) -> dict:
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


def _seed_sessions(
    db: Session,
    course_id: int,
    student_id: int,
    n_held: int,
    n_attended: int,
    start_day: int = 1,
    marked_by: int = 1,
) -> list[ClassSessionModel]:
    """Create n_held sessions for course; mark n_attended as present for student."""
    sessions = []
    for i in range(n_held):
        cs = ClassSessionModel(
            course_id=course_id,
            held_on=date(2026, 9, start_day + i),
            is_cancelled=False,
        )
        db.add(cs)
        db.flush()
        sessions.append(cs)

    for i, cs in enumerate(sessions):
        status = "present" if i < n_attended else "absent"
        db.add(
            AttendanceRecordModel(
                session_id=cs.id,
                student_id=student_id,
                status=status,
                marked_by=marked_by,
                marked_at=datetime.now(timezone.utc),
            )
        )
    db.flush()
    return sessions


# ─────────────────────────────────────────────────────────────────────────────
# Main fixture: one student enrolled in one course, 14/20 = 70.0%
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def sot_context(db_session: Session):
    """
    Seed a self-contained scenario:
      - dept, sem already in db_session (from conftest)
      - faculty user, mentor user, coordinator user
      - student enrolled in COURSE_A (14/20 attended → 70.0%)
      - student enrolled in COURSE_B (0/0 → insufficient data)
      - mentor assigned to student
      Returns a dict of ids and auth tokens.
    """
    dept = db_session.query(DepartmentModel).first()
    sem = db_session.query(SemesterModel).first()

    # ── Users ──────────────────────────────────────────────────────────────
    def _user(name, email, role):
        u = UserModel(name=name, email=email, password_hash="x", role=role,
                      department_id=dept.id)
        db_session.add(u)
        db_session.flush()
        return u

    stu_user = _user("SOT Student", "sot_stu@acadflow.edu", "student")
    fac_user = _user("SOT Faculty", "sot_fac@acadflow.edu", "faculty")
    mentor_user = _user("SOT Mentor", "sot_mentor@acadflow.edu", "faculty")
    coord_user = _user("SOT Coordinator", "sot_coord@acadflow.edu", "coordinator")

    # ── Student profile ────────────────────────────────────────────────────
    student = StudentModel(user_id=stu_user.id, roll_no="SOT001", batch="2026")
    db_session.add(student)
    db_session.flush()

    # ── Mentor assignment ──────────────────────────────────────────────────
    db_session.add(MentorAssignmentModel(mentor_id=mentor_user.id, student_id=student.user_id))

    # ── Courses ────────────────────────────────────────────────────────────
    course_a = CourseModel(
        code="SOT_CA", name="Source-of-Truth Course A",
        semester_id=sem.id, department_id=dept.id, total_classes=60,
    )
    course_b = CourseModel(
        code="SOT_CB", name="Source-of-Truth Course B",
        semester_id=sem.id, department_id=dept.id, total_classes=60,
    )
    db_session.add_all([course_a, course_b])
    db_session.flush()

    # ── Enrolments ─────────────────────────────────────────────────────────
    db_session.add(EnrolmentModel(student_id=student.user_id, course_id=course_a.id,
                                   enrolled_on=date(2026, 9, 1)))
    db_session.add(EnrolmentModel(student_id=student.user_id, course_id=course_b.id,
                                   enrolled_on=date(2026, 9, 1)))
    db_session.flush()

    # ── Attendance: 14 of 20 sessions present in COURSE_A ─────────────────
    _seed_sessions(db_session, course_a.id, student.user_id, n_held=20, n_attended=14,
                   marked_by=fac_user.id)
    # COURSE_B has NO sessions at all (insufficient data)

    db_session.commit()

    return {
        "student_id": student.user_id,
        "course_a_id": course_a.id,
        "course_b_id": course_b.id,
        "fac_user_id": fac_user.id,
        "mentor_user_id": mentor_user.id,
        "coord_user_id": coord_user.id,
        "dept_id": dept.id,
        # Auth tokens
        "stu_tok": _tok(stu_user.id, "student", stu_user.email),
        "fac_tok": _tok(fac_user.id, "faculty", fac_user.email),
        "mentor_tok": _tok(mentor_user.id, "faculty", mentor_user.email),
        "coord_tok": _tok(coord_user.id, "coordinator", coord_user.email),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — All 6 endpoints return 70.0%
# ─────────────────────────────────────────────────────────────────────────────

class TestSingleSourceOfTruth:
    """14 attended / 20 held = 70.0% on every surface."""

    EXPECTED_PCT = 70.0

    def test_buffer_endpoint(self, client: TestClient, sot_context: dict):
        """GET /api/v1/attendance/students/{sid}/courses/{cid}/buffer → 70.0%"""
        sid = sot_context["student_id"]
        cid = sot_context["course_a_id"]
        res = client.get(
            f"/api/v1/attendance/students/{sid}/courses/{cid}/buffer",
            headers=sot_context["stu_tok"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["attendance_pct"] == self.EXPECTED_PCT, (
            f"Buffer endpoint returned {data['attendance_pct']!r} expected {self.EXPECTED_PCT}"
        )
        assert data["insufficient_data"] is False
        assert data["held"] == 20
        assert data["attended"] == 14

    def test_student_dashboard(self, client: TestClient, sot_context: dict):
        """GET /api/v1/me/dashboard → overall_attendance_pct == 70.0 (only 1 course with data)"""
        res = client.get("/api/v1/me/dashboard", headers=sot_context["stu_tok"])
        assert res.status_code == 200, res.text
        data = res.json()
        # Find our course in the courses list
        courses = data.get("courses", [])
        sot_course = next(
            (c for c in courses if c.get("course_id") == sot_context["course_a_id"]),
            None,
        )
        assert sot_course is not None, f"Course not found in dashboard courses: {courses}"
        assert sot_course.get("attendance_pct") == self.EXPECTED_PCT, (
            f"Dashboard course attendance_pct = {sot_course.get('attendance_pct')!r}, expected {self.EXPECTED_PCT}"
        )

    def test_faculty_roster(self, client: TestClient, sot_context: dict):
        """GET /api/v1/students?course_id={cid} → student attendance_pct == 70.0"""
        cid = sot_context["course_a_id"]
        sid = sot_context["student_id"]
        res = client.get(
            f"/api/v1/students?course_id={cid}",
            headers=sot_context["fac_tok"],
        )
        assert res.status_code == 200, res.text
        # /students returns a paginated response: {"items": [...], "total": ...}
        data = res.json()
        students = data["items"] if isinstance(data, dict) and "items" in data else data
        sot_student = next((s for s in students if s["user_id"] == sid), None)
        assert sot_student is not None, f"Student {sid} not in roster: {students}"
        assert sot_student.get("attendance_pct") == self.EXPECTED_PCT, (
            f"Faculty roster attendance_pct = {sot_student.get('attendance_pct')!r}, expected {self.EXPECTED_PCT}"
        )

    def test_mentor_mentee_courses(self, client: TestClient, sot_context: dict):
        """GET /api/v1/mentor/students/{sid}/courses → attendance_pct == 70.0"""
        sid = sot_context["student_id"]
        cid = sot_context["course_a_id"]
        res = client.get(
            f"/api/v1/mentor/students/{sid}/courses",
            headers=sot_context["mentor_tok"],
        )
        assert res.status_code == 200, res.text
        courses = res.json()
        sot_course = next((c for c in courses if c.get("course_id") == cid), None)
        assert sot_course is not None, f"Course {cid} not in mentee courses: {courses}"
        assert sot_course.get("attendance_pct") == self.EXPECTED_PCT, (
            f"Mentor mentee courses attendance_pct = {sot_course.get('attendance_pct')!r}, expected {self.EXPECTED_PCT}"
        )

    def test_risk_endpoint(self, client: TestClient, sot_context: dict):
        """GET /api/v1/risk/students/{sid}/courses/{cid} → attendance_pct == 70.0"""
        sid = sot_context["student_id"]
        cid = sot_context["course_a_id"]
        res = client.get(
            f"/api/v1/risk/students/{sid}/courses/{cid}",
            headers=sot_context["fac_tok"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data.get("attendance_pct") == self.EXPECTED_PCT, (
            f"Risk endpoint attendance_pct = {data.get('attendance_pct')!r}, expected {self.EXPECTED_PCT}"
        )

    def test_coordinator_student_directory(self, client: TestClient, sot_context: dict):
        """GET /api/v1/coordinator/students → attendance_percentage == 70.0 for our student"""
        sid = sot_context["student_id"]
        dept_id = sot_context["dept_id"]
        res = client.get(
            f"/api/v1/coordinator/students?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200, res.text
        students = res.json()
        sot_student = next((s for s in students if s.get("student_id") == sid), None)
        assert sot_student is not None, f"Student {sid} not in coordinator list: {students}"
        att = sot_student.get("attendance_percentage")
        # 70.0 exactly since only course_a has data (course_b has 0 sessions)
        assert att == self.EXPECTED_PCT, (
            f"Coordinator directory attendance_percentage = {att!r}, expected {self.EXPECTED_PCT}"
        )

    def test_no_password_hash_in_coordinator_response(self, client: TestClient, sot_context: dict):
        """Coordinator student directory must never expose password_hash."""
        dept_id = sot_context["dept_id"]
        res = client.get(
            f"/api/v1/coordinator/students?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200
        for rec in res.json():
            assert "password_hash" not in rec, "password_hash leaked in coordinator response!"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — All surfaces update after a new session is marked
# ─────────────────────────────────────────────────────────────────────────────

class TestAttendanceUpdatePropagates:
    """Mark 1 more session → 15/21 = 71.4% everywhere."""

    NEW_EXPECTED_PCT = 71.4

    def _add_session_and_mark_present(
        self, db_session: Session, course_id: int, student_id: int, fac_id: int
    ):
        cs = ClassSessionModel(
            course_id=course_id,
            held_on=date(2026, 9, 25),  # beyond the 20 already seeded (1–20)
            is_cancelled=False,
        )
        db_session.add(cs)
        db_session.flush()
        db_session.add(
            AttendanceRecordModel(
                session_id=cs.id,
                student_id=student_id,
                status="present",
                marked_by=fac_id,
                marked_at=datetime.now(timezone.utc),
            )
        )
        db_session.commit()

    def test_buffer_updates(self, client: TestClient, sot_context: dict, db_session: Session):
        self._add_session_and_mark_present(db_session, sot_context["course_a_id"], sot_context["student_id"], sot_context["fac_user_id"])
        sid, cid = sot_context["student_id"], sot_context["course_a_id"]
        res = client.get(
            f"/api/v1/attendance/students/{sid}/courses/{cid}/buffer",
            headers=sot_context["stu_tok"],
        )
        assert res.status_code == 200
        assert res.json()["attendance_pct"] == self.NEW_EXPECTED_PCT, res.json()

    def test_risk_updates(self, client: TestClient, sot_context: dict, db_session: Session):
        self._add_session_and_mark_present(db_session, sot_context["course_a_id"], sot_context["student_id"], sot_context["fac_user_id"])
        sid, cid = sot_context["student_id"], sot_context["course_a_id"]
        res = client.get(
            f"/api/v1/risk/students/{sid}/courses/{cid}",
            headers=sot_context["fac_tok"],
        )
        assert res.status_code == 200
        assert res.json()["attendance_pct"] == self.NEW_EXPECTED_PCT, res.json()

    def test_faculty_roster_updates(self, client: TestClient, sot_context: dict, db_session: Session):
        self._add_session_and_mark_present(db_session, sot_context["course_a_id"], sot_context["student_id"], sot_context["fac_user_id"])
        sid, cid = sot_context["student_id"], sot_context["course_a_id"]
        res = client.get(f"/api/v1/students?course_id={cid}", headers=sot_context["fac_tok"])
        assert res.status_code == 200
        data = res.json()
        students = data["items"] if isinstance(data, dict) and "items" in data else data
        sot_student = next((s for s in students if s["user_id"] == sid), None)
        assert sot_student is not None
        assert sot_student.get("attendance_pct") == self.NEW_EXPECTED_PCT, sot_student


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — Coordinator overview uses real counts, not hardcoded numbers
# ─────────────────────────────────────────────────────────────────────────────

class TestCoordinatorUsesRealData:

    def test_overview_not_hardcoded(self, client: TestClient, sot_context: dict):
        """average_attendance_pct must not be 78.5 or any other hardcoded constant."""
        dept_id = sot_context["dept_id"]
        res = client.get(
            f"/api/v1/coordinator/overview?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        # Must not be any of the old hardcoded values
        assert data.get("average_attendance_pct") not in (78.5, 82.4, None.__class__), (
            f"Suspiciously hardcoded average_attendance_pct: {data.get('average_attendance_pct')}"
        )
        # enrolled count must match real enrolment rows, not fake 45
        courses = data.get("courses", [])
        for c in courses:
            assert c.get("enrolled_count") != 45, (
                f"Hardcoded enrolled_count=45 detected in course {c}"
            )

    def test_two_courses_have_different_averages(self, client: TestClient, sot_context: dict, db_session: Session):
        """
        Add a second student enrolled only in course_b with 18/20 = 90.0%.
        course_a should average 70.0 (one student), course_b should average 90.0.
        They must differ, proving the coordinator is not returning a single hardcoded value.
        """
        dept = db_session.query(DepartmentModel).first()
        sem = db_session.query(SemesterModel).first()

        # New student
        u2 = UserModel(name="SOT Student2", email="sot_stu2@acadflow.edu",
                       password_hash="x", role="student", department_id=dept.id)
        db_session.add(u2)
        db_session.flush()
        s2 = StudentModel(user_id=u2.id, roll_no="SOT002", batch="2026")
        db_session.add(s2)
        db_session.flush()

        # Enrol in course_b only
        cid_b = sot_context["course_b_id"]
        db_session.add(EnrolmentModel(student_id=s2.user_id, course_id=cid_b,
                                       enrolled_on=date(2026, 9, 1)))
        db_session.flush()

        # 18/20 in course_b
        _seed_sessions(db_session, cid_b, s2.user_id, n_held=20, n_attended=18,
                       marked_by=1)
        db_session.commit()

        dept_id = sot_context["dept_id"]
        res = client.get(
            f"/api/v1/coordinator/courses?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200, res.text
        courses = res.json()

        course_a = next((c for c in courses if c["id"] == sot_context["course_a_id"]), None)
        course_b = next((c for c in courses if c["id"] == cid_b), None)

        assert course_a is not None, "course_a not in coordinator courses"
        assert course_b is not None, "course_b not in coordinator courses"

        avg_a = course_a.get("avg_attendance")
        avg_b = course_b.get("avg_attendance")

        # course_a: only student1 enrolled, 14/20 = 70.0%
        assert avg_a == 70.0, f"course_a avg_attendance expected 70.0 got {avg_a}"
        # course_b: student1 enrolled (0/20 = 0.0%) + student2 (18/20 = 90.0%) → avg = 45.0
        # This proves two different courses produce two different real averages,
        # not a single hardcoded value.
        assert avg_b == 45.0, f"course_b avg_attendance expected 45.0 got {avg_b}"
        assert avg_a != avg_b, "Both courses have identical average — still hardcoded?"

    def test_enrolled_count_matches_real_enrolments(self, client: TestClient, sot_context: dict):
        """enrolled_count for course_a must be 1 (exactly the 1 student we seeded)."""
        dept_id = sot_context["dept_id"]
        cid_a = sot_context["course_a_id"]
        res = client.get(
            f"/api/v1/coordinator/courses?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200, res.text
        courses = res.json()
        course_a = next((c for c in courses if c["id"] == cid_a), None)
        assert course_a is not None
        enrolled = course_a.get("enrolled_count")
        assert enrolled == 1, f"enrolled_count expected 1 got {enrolled}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — No-data case returns None everywhere, never 100.0
# ─────────────────────────────────────────────────────────────────────────────

class TestNoDataReturnsNone:
    """COURSE_B has zero sessions → insufficient_data=True, attendance_pct=None."""

    def test_buffer_no_data(self, client: TestClient, sot_context: dict):
        sid = sot_context["student_id"]
        cid = sot_context["course_b_id"]
        res = client.get(
            f"/api/v1/attendance/students/{sid}/courses/{cid}/buffer",
            headers=sot_context["stu_tok"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["insufficient_data"] is True
        assert data["attendance_pct"] is None, (
            f"Expected None for no-data, got {data['attendance_pct']!r}"
        )
        assert data["attendance_pct"] != 100.0, "No-data case defaulted to 100.0!"

    def test_risk_no_data(self, client: TestClient, sot_context: dict):
        sid = sot_context["student_id"]
        cid = sot_context["course_b_id"]
        res = client.get(
            f"/api/v1/risk/students/{sid}/courses/{cid}",
            headers=sot_context["fac_tok"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["insufficient_data"] is True
        assert data["attendance_pct"] is None, (
            f"Risk no-data: expected None, got {data['attendance_pct']!r}"
        )

    def test_faculty_roster_no_data(self, client: TestClient, sot_context: dict):
        """Students in course_b roster should have null attendance_pct."""
        cid = sot_context["course_b_id"]
        sid = sot_context["student_id"]
        res = client.get(
            f"/api/v1/students?course_id={cid}",
            headers=sot_context["fac_tok"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        students = data["items"] if isinstance(data, dict) and "items" in data else data
        sot_student = next((s for s in students if s["user_id"] == sid), None)
        assert sot_student is not None
        pct = sot_student.get("attendance_pct")
        assert pct is None, f"Expected None for no-data student, got {pct!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — Hardcoded constants sanity (no 78.5, 25.0, 45, 100.0 in live data)
# ─────────────────────────────────────────────────────────────────────────────

class TestNoHardcodedConstants:
    """The API must not return the old fake constants for a real data scenario."""

    FORBIDDEN_CONSTANTS = {78.5, 25.0, 82.4}

    def test_coordinator_overview_no_fake_constants(self, client: TestClient, sot_context: dict):
        dept_id = sot_context["dept_id"]
        res = client.get(
            f"/api/v1/coordinator/overview?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200
        data = res.json()
        avg = data.get("average_attendance_pct")
        assert avg not in self.FORBIDDEN_CONSTANTS, (
            f"Hardcoded constant {avg!r} detected in coordinator overview"
        )

    def test_coordinator_students_no_enrolled_courses_4(self, client: TestClient, sot_context: dict):
        """enrolled_courses must be the real count, not hardcoded 4."""
        dept_id = sot_context["dept_id"]
        sid = sot_context["student_id"]
        res = client.get(
            f"/api/v1/coordinator/students?department_id={dept_id}",
            headers=sot_context["coord_tok"],
        )
        assert res.status_code == 200
        students = res.json()
        sot_student = next((s for s in students if s.get("student_id") == sid), None)
        assert sot_student is not None
        enrolled = sot_student.get("enrolled_courses")
        # Our student is enrolled in 2 courses
        assert enrolled == 2, f"enrolled_courses expected 2 got {enrolled}"
        assert enrolled != 4, "Hardcoded enrolled_courses=4 detected!"
