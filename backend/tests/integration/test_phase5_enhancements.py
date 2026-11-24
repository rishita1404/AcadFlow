"""
Phase 5 Integration Tests:
- Faculty "Needs attention this week" list: students who missed 2+ consecutive classes
  or dropped a risk band since last week, with what changed and suggested next step.
- Attendance upload preview warnings: unknown IDs, 100% present rows, duplicate sessions.
- Attendance upload undo: batch restoration, session cleanup, risk recomputation, audit logging.
- Central RBAC & scope checks returning 403 on out-of-scope access.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models import (
    AttendanceRecordModel,
    AttendanceUploadBatchModel,
    AuditLogModel,
    ClassSessionModel,
    CourseModel,
    CourseStaffModel,
    DepartmentModel,
    EnrolmentModel,
    RiskSnapshotModel,
    SemesterModel,
    StudentModel,
    UserModel,
)


def _auth_headers(user_id: int, role: str, email: str = "user@acadflow.edu"):
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def phase5_setup(db_session: Session):
    dept = db_session.query(DepartmentModel).filter_by(code="CSE5").first()
    if not dept:
        dept = DepartmentModel(name="Computer Science 5", code="CSE5")
        db_session.add(dept)
        db_session.flush()

    sem = db_session.query(SemesterModel).filter_by(name="Fall 2026 Phase 5").first()
    if not sem:
        sem = SemesterModel(
            name="Fall 2026 Phase 5",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 12, 15),
        )
        db_session.add(sem)
        db_session.flush()

    # Faculty 1 (teaches course 1)
    fac1_user = db_session.query(UserModel).filter_by(email="fac1_p5@acadflow.edu").first()
    if not fac1_user:
        fac1_user = UserModel(name="Prof. One", email="fac1_p5@acadflow.edu", role="faculty", department_id=dept.id, password_hash="dummyhash")
        db_session.add(fac1_user)
        db_session.flush()

    # Faculty 2 (teaches course 2, not course 1)
    fac2_user = db_session.query(UserModel).filter_by(email="fac2_p5@acadflow.edu").first()
    if not fac2_user:
        fac2_user = UserModel(name="Prof. Two", email="fac2_p5@acadflow.edu", role="faculty", department_id=dept.id, password_hash="dummyhash")
        db_session.add(fac2_user)
        db_session.flush()

    # Student 1
    stu1_user = db_session.query(UserModel).filter_by(email="stu1_p5@acadflow.edu").first()
    if not stu1_user:
        stu1_user = UserModel(name="Student One", email="stu1_p5@acadflow.edu", role="student", department_id=dept.id, password_hash="dummyhash")
        db_session.add(stu1_user)
        db_session.flush()
        stu1 = StudentModel(user_id=stu1_user.id, roll_no="CS501", batch="2026")
        db_session.add(stu1)
        db_session.flush()
    else:
        stu1 = db_session.query(StudentModel).filter_by(user_id=stu1_user.id).first()

    # Student 2
    stu2_user = db_session.query(UserModel).filter_by(email="stu2_p5@acadflow.edu").first()
    if not stu2_user:
        stu2_user = UserModel(name="Student Two", email="stu2_p5@acadflow.edu", role="student", department_id=dept.id, password_hash="dummyhash")
        db_session.add(stu2_user)
        db_session.flush()
        stu2 = StudentModel(user_id=stu2_user.id, roll_no="CS502", batch="2026")
        db_session.add(stu2)
        db_session.flush()
    else:
        stu2 = db_session.query(StudentModel).filter_by(user_id=stu2_user.id).first()

    # Course 1 (assigned to fac1)
    course1 = db_session.query(CourseModel).filter_by(code="CS501").first()
    if not course1:
        course1 = CourseModel(
            code="CS501",
            name="Advanced Systems",
            department_id=dept.id,
            semester_id=sem.id,
            total_classes=40,
        )
        db_session.add(course1)
        db_session.flush()

    staff1 = db_session.query(CourseStaffModel).filter_by(course_id=course1.id, user_id=fac1_user.id).first()
    if not staff1:
        db_session.add(CourseStaffModel(course_id=course1.id, user_id=fac1_user.id, role="instructor"))

    # Course 2 (assigned to fac2)
    course2 = db_session.query(CourseModel).filter_by(code="CS502").first()
    if not course2:
        course2 = CourseModel(
            code="CS502",
            name="Networks",
            department_id=dept.id,
            semester_id=sem.id,
            total_classes=40,
        )
        db_session.add(course2)
        db_session.flush()

    staff2 = db_session.query(CourseStaffModel).filter_by(course_id=course2.id, user_id=fac2_user.id).first()
    if not staff2:
        db_session.add(CourseStaffModel(course_id=course2.id, user_id=fac2_user.id, role="instructor"))

    # Enrol students in Course 1
    for s in (stu1, stu2):
        enr = db_session.query(EnrolmentModel).filter_by(student_id=s.user_id, course_id=course1.id).first()
        if not enr:
            db_session.add(EnrolmentModel(student_id=s.user_id, course_id=course1.id, enrolled_on=date(2026, 8, 15)))

    db_session.commit()

    return {
        "dept": dept,
        "sem": sem,
        "fac1": fac1_user,
        "fac2": fac2_user,
        "stu1": stu1,
        "stu1_user": stu1_user,
        "stu2": stu2,
        "stu2_user": stu2_user,
        "course1": course1,
        "course2": course2,
    }


def test_needs_attention_forbidden_for_student(client: TestClient, phase5_setup):
    headers = _auth_headers(phase5_setup["stu1_user"].id, "student", phase5_setup["stu1_user"].email)
    resp = client.get("/api/v1/courses/needs-attention", headers=headers)
    assert resp.status_code == 403
    assert "FORBIDDEN" in str(resp.json()).upper()


def test_needs_attention_unassigned_course_forbidden(client: TestClient, phase5_setup):
    # fac2 tries to access needs-attention for course1 which is taught by fac1
    headers = _auth_headers(phase5_setup["fac2"].id, "faculty", phase5_setup["fac2"].email)
    resp = client.get(f"/api/v1/courses/needs-attention?course_id={phase5_setup['course1'].id}", headers=headers)
    assert resp.status_code == 403
    assert "FORBIDDEN" in str(resp.json()).upper()


def test_needs_attention_detects_consecutive_absences(client: TestClient, db_session: Session, phase5_setup):
    course1 = phase5_setup["course1"]
    stu1 = phase5_setup["stu1"]
    fac1 = phase5_setup["fac1"]

    today = date.today()
    d1 = today - timedelta(days=2)
    d2 = today - timedelta(days=4)

    # Create 2 sessions
    s1 = ClassSessionModel(course_id=course1.id, held_on=d1, is_cancelled=False)
    s2 = ClassSessionModel(course_id=course1.id, held_on=d2, is_cancelled=False)
    db_session.add_all([s1, s2])
    db_session.flush()

    now = datetime.now(timezone.utc)
    # Mark stu1 absent for both consecutive sessions
    r1 = AttendanceRecordModel(student_id=stu1.user_id, session_id=s1.id, status="absent", marked_by=fac1.id, marked_at=now)
    r2 = AttendanceRecordModel(student_id=stu1.user_id, session_id=s2.id, status="absent", marked_by=fac1.id, marked_at=now)
    db_session.add_all([r1, r2])
    db_session.commit()

    headers = _auth_headers(fac1.id, "faculty", fac1.email)
    resp = client.get(f"/api/v1/courses/needs-attention?course_id={course1.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1

    stu1_item = next((item for item in data if item["student_id"] == stu1.user_id), None)
    assert stu1_item is not None
    assert stu1_item["consecutive_absences"] >= 2
    assert "consecutive_absences" in stu1_item["reasons"]
    assert "Missed 2 consecutive classes" in stu1_item["what_changed"]
    assert "suggested_next_step" in stu1_item


def test_needs_attention_detects_band_drop(client: TestClient, db_session: Session, phase5_setup):
    course1 = phase5_setup["course1"]
    stu2 = phase5_setup["stu2"]
    fac1 = phase5_setup["fac1"]

    now = datetime.now(timezone.utc)
    # Older snapshot (7 days ago): Safe
    snap_old = RiskSnapshotModel(
        student_id=stu2.user_id,
        computed_at=now - timedelta(days=8),
        score=Decimal("15.0"),
        band="Safe",
        worst_course_id=course1.id,
    )
    # Recent snapshot (today): Dropped to Critical / Needs support
    snap_new = RiskSnapshotModel(
        student_id=stu2.user_id,
        computed_at=now,
        score=Decimal("82.0"),
        band="Critical",
        worst_course_id=course1.id,
    )
    db_session.add_all([snap_old, snap_new])
    db_session.commit()

    headers = _auth_headers(fac1.id, "faculty", fac1.email)
    resp = client.get(f"/api/v1/courses/needs-attention?course_id={course1.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    stu2_item = next((item for item in data if item["student_id"] == stu2.user_id), None)
    assert stu2_item is not None
    assert "band_drop" in stu2_item["reasons"]
    assert "dropped from Safe to Needs support" in stu2_item["what_changed"]
    assert stu2_item["current_band_label"] == "Needs support"


def test_attendance_preview_warnings(client: TestClient, db_session: Session, phase5_setup):
    course1 = phase5_setup["course1"]
    fac1 = phase5_setup["fac1"]

    # Pre-record a session to trigger duplicate session warning
    dup_date = date.today() - timedelta(days=10)
    sess = ClassSessionModel(course_id=course1.id, held_on=dup_date, is_cancelled=False)
    db_session.add(sess)
    db_session.flush()
    rec = AttendanceRecordModel(
        student_id=phase5_setup["stu1"].user_id,
        session_id=sess.id,
        status="present",
        marked_by=fac1.id,
        marked_at=datetime.now(timezone.utc),
    )
    db_session.add(rec)
    db_session.commit()

    # Upload CSV with:
    # 1. Unknown student ID (UNKNOWN_X)
    # 2. 100% present session on 2026-11-20
    # 3. Duplicate session date (dup_date)
    csv_content = f"""roll_no,date,status
CS501,2026-11-20,present
CS502,2026-11-20,present
UNKNOWN_X,2026-11-20,present
CS501,{dup_date.isoformat()},present
"""
    headers = _auth_headers(fac1.id, "faculty", fac1.email)
    files = {"file": ("preview_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    resp = client.post(
        f"/api/v1/courses/{course1.id}/attendance/preview",
        headers=headers,
        files=files,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["preview"] is True
    assert "warnings" in data
    assert "UNKNOWN_X" in data["warnings"]["unknown_ids"]
    assert "2026-11-20" in data["warnings"]["all_present_rows"]
    assert dup_date.isoformat() in data["warnings"]["duplicate_sessions"]
    assert len(data["warning_messages"]) >= 3


def test_attendance_preview_forbidden_for_student(client: TestClient, phase5_setup):
    course1 = phase5_setup["course1"]
    stu1_user = phase5_setup["stu1_user"]

    csv_content = "roll_no,date,status\nCS501,2026-11-20,present\n"
    headers = _auth_headers(stu1_user.id, "student", stu1_user.email)
    files = {"file": ("preview.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    resp = client.post(
        f"/api/v1/courses/{course1.id}/attendance/preview",
        headers=headers,
        files=files,
    )
    assert resp.status_code == 403
    assert "FORBIDDEN" in str(resp.json()).upper()


def test_attendance_undo_success_and_audit(client: TestClient, db_session: Session, phase5_setup):
    course1 = phase5_setup["course1"]
    fac1 = phase5_setup["fac1"]

    upload_date = date(2026, 11, 22)
    csv_content = f"""roll_no,date,status
CS501,{upload_date.isoformat()},present
CS502,{upload_date.isoformat()},absent
"""
    headers = _auth_headers(fac1.id, "faculty", fac1.email)
    files = {"file": ("upload_undo.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {"course_id": str(course1.id), "change_reason": "Testing undo flow"}

    # 1. Perform upload
    upload_resp = client.post(
        f"/api/v1/attendance/upload?course_id={course1.id}",
        headers=headers,
        files=files,
        data=data,
    )
    assert upload_resp.status_code == 200
    upload_data = upload_resp.json()
    batch_id = upload_data.get("batch_id")
    assert batch_id is not None

    # Verify session and records created
    sess_created = db_session.scalar(
        db_session.query(ClassSessionModel).filter_by(course_id=course1.id, held_on=upload_date).statement
    )
    assert sess_created is not None

    # 2. Undo upload
    undo_resp = client.post(
        f"/api/v1/courses/{course1.id}/attendance/undo?batch_id={batch_id}",
        headers=headers,
    )
    assert undo_resp.status_code == 200
    undo_data = undo_resp.json()
    assert undo_data["success"] is True
    assert undo_data["reverted_created"] >= 2

    # Verify session and records are cleaned up
    sess_after = db_session.scalar(
        db_session.query(ClassSessionModel).filter_by(course_id=course1.id, held_on=upload_date).statement
    )
    assert sess_after is None

    # Verify batch marked as undone
    batch = db_session.get(AttendanceUploadBatchModel, batch_id)
    assert batch.is_undone is True
    assert batch.undone_at is not None

    # Verify audit log entry exists
    audit_entry = db_session.query(AuditLogModel).filter_by(
        entity_id=str(batch_id)
    ).first()
    assert audit_entry is not None


def test_attendance_undo_unauthorized_faculty_forbidden(client: TestClient, phase5_setup):
    course1 = phase5_setup["course1"]
    fac2 = phase5_setup["fac2"]  # teaches course 2, not course 1

    headers = _auth_headers(fac2.id, "faculty", fac2.email)
    resp = client.post(
        f"/api/v1/courses/{course1.id}/attendance/undo",
        headers=headers,
    )
    assert resp.status_code == 403
    assert "FORBIDDEN" in str(resp.json()).upper()


def test_attendance_undo_forbidden_for_student(client: TestClient, phase5_setup):
    course1 = phase5_setup["course1"]
    stu1_user = phase5_setup["stu1_user"]

    headers = _auth_headers(stu1_user.id, "student", stu1_user.email)
    resp = client.post(
        f"/api/v1/courses/{course1.id}/attendance/undo",
        headers=headers,
    )
    assert resp.status_code == 403
    assert "FORBIDDEN" in str(resp.json()).upper()
