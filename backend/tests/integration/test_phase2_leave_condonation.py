"""
Phase 2 Integration Tests: Leave Requests, Neutral Attendance Arithmetic,
Condonation Flow, 403 Scope Enforcement, and Audit Logging.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models import (
    AttendanceRecordModel,
    AuditLogModel,
    ClassSessionModel,
    CourseModel,
    CourseStaffModel,
    DeanAssignmentModel,
    DepartmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    RiskConfigModel,
    UserModel,
)
from app.models.leave import CondonationRequestModel, LeaveRequestModel
from app.services.attendance_stats import get_student_course_attendance


def _auth_headers(user_id: int, role: str = "student", email: str = "user@acadflow.edu"):
    token, _ = create_access_token({"sub": str(user_id), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def phase2_setup(db_session: Session):
    """Setup departments, users, mentor/dean assignments, courses and enrolments."""
    # Departments
    dept_cse = db_session.query(DepartmentModel).filter_by(code="CSE").first()
    dept_ece = DepartmentModel(name="Electronics & Communication", code="ECE")
    db_session.add(dept_ece)
    db_session.flush()

    # Risk Config
    cfg = db_session.query(RiskConfigModel).first()
    if not cfg:
        cfg = RiskConfigModel(
            w_margin=Decimal("0.35"),
            w_trend=Decimal("0.25"),
            w_deadline=Decimal("0.20"),
            w_missed=Decimal("0.20"),
            t_watch=Decimal("30"),
            t_risk=Decimal("60"),
            t_critical=Decimal("80"),
            min_classes=5,
            condonation_floor_pct=Decimal("65.0"),
            require_recommendation=True,
            version="v1",
        )
        db_session.add(cfg)
        db_session.flush()

    # Users
    student_user = db_session.query(UserModel).filter_by(email="student1@acadflow.edu").first()
    student_user_2 = db_session.query(UserModel).filter_by(email="student2@acadflow.edu").first()

    mentor_user = UserModel(
        name="Prof. Mentor",
        email="mentor_prof@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept_cse.id,
    )
    other_faculty = UserModel(
        name="Prof. Other",
        email="other_prof@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept_cse.id,
    )
    dean_cse = UserModel(
        name="Dean CSE",
        email="dean_cse@acadflow.edu",
        password_hash="hash",
        role="coordinator",
        department_id=dept_cse.id,
    )
    dean_ece = UserModel(
        name="Dean ECE",
        email="dean_ece@acadflow.edu",
        password_hash="hash",
        role="coordinator",
        department_id=dept_ece.id,
    )
    db_session.add_all([mentor_user, other_faculty, dean_cse, dean_ece])
    db_session.flush()

    # Assignments
    # student_user has mentor_user
    db_session.add(MentorAssignmentModel(mentor_id=mentor_user.id, student_id=student_user.id))
    # student_user_2 has NO mentor assigned
    # Dean assignments
    db_session.add(DeanAssignmentModel(user_id=dean_cse.id, department_id=dept_cse.id))
    db_session.add(DeanAssignmentModel(user_id=dean_ece.id, department_id=dept_ece.id))

    # Course
    course = CourseModel(
        code="CS601_P2",
        name="Phase 2 Operating Systems",
        semester_id=1,
        department_id=dept_cse.id,
        total_classes=60,
    )
    db_session.add(course)
    db_session.flush()

    # Course Staff: other_faculty is instructor of CS601_P2
    db_session.add(CourseStaffModel(course_id=course.id, user_id=other_faculty.id, role="instructor"))

    # Enrolments
    db_session.add(EnrolmentModel(student_id=student_user.id, course_id=course.id, enrolled_on=date(2026, 7, 15)))
    db_session.add(EnrolmentModel(student_id=student_user_2.id, course_id=course.id, enrolled_on=date(2026, 7, 15)))

    db_session.commit()

    return {
        "student": student_user,
        "student2": student_user_2,
        "mentor": mentor_user,
        "other_faculty": other_faculty,
        "dean_cse": dean_cse,
        "dean_ece": dean_ece,
        "course": course,
    }


def test_student_submit_leave_and_list(client: TestClient, phase2_setup: dict):
    student = phase2_setup["student"]
    headers = _auth_headers(student.id, role="student", email=student.email)

    payload = {
        "type": "medical",
        "date_from": "2026-10-10",
        "date_to": "2026-10-12",
        "reason": "Severe fever and clinical observation",
    }
    res = client.post("/api/v1/leave/requests", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["student_id"] == student.id
    assert data["type"] == "medical"
    assert data["status"] == "pending"

    # Test /me/leave-requests alias
    res_me = client.get("/api/v1/me/leave-requests", headers=headers)
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert len(me_data) >= 1
    assert me_data[0]["id"] == data["id"]


def test_leave_invalid_dates_rejected(client: TestClient, phase2_setup: dict):
    student = phase2_setup["student"]
    headers = _auth_headers(student.id, role="student", email=student.email)

    payload = {
        "type": "medical",
        "date_from": "2026-10-15",
        "date_to": "2026-10-10",  # from > to
        "reason": "Invalid dates",
    }
    res = client.post("/api/v1/leave/requests", json=payload, headers=headers)
    assert res.status_code == 400
    error_info = res.json().get("error", res.json().get("detail", {}))
    assert "date_from" in str(error_info) or "INVALID_DATE_RANGE" in str(error_info)


def test_leave_submit_wrong_role_403(client: TestClient, phase2_setup: dict):
    mentor = phase2_setup["mentor"]
    headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)

    payload = {
        "type": "duty",
        "date_from": "2026-10-10",
        "date_to": "2026-10-12",
        "reason": "Faculty cannot submit student leave",
    }
    res = client.post("/api/v1/leave/requests", json=payload, headers=headers)
    assert res.status_code == 403


def test_leave_decision_mentor_vs_other_faculty_403(client: TestClient, db_session: Session, phase2_setup: dict):
    student = phase2_setup["student"]
    mentor = phase2_setup["mentor"]
    other_faculty = phase2_setup["other_faculty"]

    # Student creates leave
    leave_req = LeaveRequestModel(
        student_id=student.id,
        type="medical",
        date_from=date(2026, 10, 10),
        date_to=date(2026, 10, 12),
        reason="Fever",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(leave_req)
    db_session.commit()

    # Other faculty (not mentor) attempts to decide -> 403 Forbidden
    other_headers = _auth_headers(other_faculty.id, role="faculty", email=other_faculty.email)
    res_other = client.post(
        f"/api/v1/leave/requests/{leave_req.id}/decide",
        json={"status": "approved", "decision_note": "Unallowed approval"},
        headers=other_headers,
    )
    assert res_other.status_code == 403

    # Assigned mentor decides -> 200 OK
    mentor_headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    res_mentor = client.post(
        f"/api/v1/leave/requests/{leave_req.id}/decide",
        json={"status": "approved", "decision_note": "Medical certificate verified"},
        headers=mentor_headers,
    )
    assert res_mentor.status_code == 200
    data = res_mentor.json()
    assert data["status"] == "approved"
    assert data["decision_note"] == "Medical certificate verified"
    assert data["decided_by"] == mentor.id


def test_leave_decision_dean_when_no_mentor(client: TestClient, db_session: Session, phase2_setup: dict):
    student2 = phase2_setup["student2"]  # has no mentor, belongs to CSE
    dean_cse = phase2_setup["dean_cse"]
    dean_ece = phase2_setup["dean_ece"]

    leave_req = LeaveRequestModel(
        student_id=student2.id,
        type="duty",
        date_from=date(2026, 11, 1),
        date_to=date(2026, 11, 3),
        reason="University hackathon finals",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(leave_req)
    db_session.commit()

    # Dean of ECE (wrong department) tries to decide -> 403 Forbidden
    ece_headers = _auth_headers(dean_ece.id, role="coordinator", email=dean_ece.email)
    res_ece = client.post(
        f"/api/v1/leave/requests/{leave_req.id}/decide",
        json={"status": "approved", "decision_note": "Wrong dept approval"},
        headers=ece_headers,
    )
    assert res_ece.status_code == 403

    # Dean of CSE (student's department) decides -> 200 OK
    cse_headers = _auth_headers(dean_cse.id, role="coordinator", email=dean_cse.email)
    res_cse = client.post(
        f"/api/v1/leave/requests/{leave_req.id}/decide",
        json={"status": "approved", "decision_note": "Approved by Dean of CSE"},
        headers=cse_headers,
    )
    assert res_cse.status_code == 200
    assert res_cse.json()["status"] == "approved"


def test_leave_neutral_attendance_arithmetic(client: TestClient, db_session: Session, phase2_setup: dict):
    """
    Verify leave-present arithmetic:
    An approved ML/DL counts as present ONLY for sessions where the student was marked absent.
    Held and total_classes do not change.
    """
    student = phase2_setup["student"]
    mentor = phase2_setup["mentor"]
    course = phase2_setup["course"]  # total_classes = 60

    # Create 10 sessions (held_on from Oct 1 to Oct 10)
    sessions = []
    for day in range(1, 11):
        sess = ClassSessionModel(
            course_id=course.id,
            held_on=date(2026, 10, day),
            lecture_no=1,
            is_cancelled=False,
        )
        db_session.add(sess)
        sessions.append(sess)
    db_session.flush()

    # Mark attendance: Student attended days 1-8 (8 present), missed days 9 and 10 (absent)
    for i, sess in enumerate(sessions):
        status = "present" if i < 8 else "absent"
        db_session.add(
            AttendanceRecordModel(
                session_id=sess.id,
                student_id=student.id,
                status=status,
                marked_by=mentor.id,
                marked_at=datetime.now(timezone.utc),
            )
        )
    db_session.commit()

    stats_before = get_student_course_attendance(db_session, student.id, course.id, min_classes=5)
    assert stats_before["held"] == 10
    assert stats_before["attended"] == 8
    assert stats_before["total_classes"] == 60
    assert stats_before["required"] == 45
    assert stats_before["remaining"] == 50
    assert stats_before["still_need"] == 37
    assert stats_before["buffer"] == 13

    # Submit and approve medical leave covering Oct 9 to Oct 10 (2 absent sessions)
    leave_req = LeaveRequestModel(
        student_id=student.id,
        type="medical",
        mode="full_day",
        date_from=date(2026, 10, 9),
        date_to=date(2026, 10, 10),
        reason="Dengue fever recovery",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(leave_req)
    db_session.commit()

    mentor_headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    decide_res = client.post(
        f"/api/v1/leave/requests/{leave_req.id}/decide",
        json={"status": "approved", "decision_note": "Medical excuse approved"},
        headers=mentor_headers,
    )
    assert decide_res.status_code == 200

    # After approval:
    # held = 10 (unchanged), total_classes = 60 (unchanged)
    # attended = 8 present + 2 ML = 10
    # required = 45, remaining = 50, still_need = 35, buffer = 15
    stats_after = get_student_course_attendance(db_session, student.id, course.id, min_classes=5)
    assert stats_after["held"] == 10
    assert stats_after["total_classes"] == 60
    assert stats_after["present_count"] == 8
    assert stats_after["ml_counted"] == 2
    assert stats_after["leave_counted"] == 2
    assert stats_after["attended"] == 10
    assert stats_after["required"] == 45
    assert stats_after["remaining"] == 50
    assert stats_after["still_need"] == 35
    assert stats_after["buffer"] == 15


def test_leave_required_fixtures_dl_and_lectures_mode(client: TestClient, db_session: Session, phase2_setup: dict):
    """
    Required fixtures:
    Case 1: 60-class course, held 40, 28 present, 12 absent, 2 covered by approved DL -> attended=30, still_need=15, buffer=5.
    Case 2: DL covers lectures 3 and 4 on a single date; student is present at lecture 3 and absent at lecture 4 -> leave_counted=1.
    """
    student = phase2_setup["student"]
    mentor = phase2_setup["mentor"]
    course = phase2_setup["course"]  # total_classes = 60

    base_date = date(2026, 9, 1)
    sessions = []
    # 38 sessions on consecutive days (lec 1) + 2 sessions on Oct 20 (lectures 3 and 4) = 40 held
    for i in range(38):
        s = ClassSessionModel(
            course_id=course.id,
            held_on=base_date + timedelta(days=i),
            lecture_no=1,
            is_cancelled=False,
        )
        db_session.add(s)
        sessions.append(s)
    lec3 = ClassSessionModel(course_id=course.id, held_on=date(2026, 10, 20), lecture_no=3, is_cancelled=False)
    lec4 = ClassSessionModel(course_id=course.id, held_on=date(2026, 10, 20), lecture_no=4, is_cancelled=False)
    db_session.add_all([lec3, lec4])
    db_session.flush()
    sessions.extend([lec3, lec4])

    # 27 present + lec3 present = 28 present; 11 absent + lec4 absent = 12 absent
    for idx, s in enumerate(sessions[:38]):
        st = "present" if idx < 27 else "absent"
        db_session.add(AttendanceRecordModel(session_id=s.id, student_id=student.id, status=st, marked_by=mentor.id, marked_at=datetime.now(timezone.utc)))
    db_session.add(AttendanceRecordModel(session_id=lec3.id, student_id=student.id, status="present", marked_by=mentor.id, marked_at=datetime.now(timezone.utc)))
    db_session.add(AttendanceRecordModel(session_id=lec4.id, student_id=student.id, status="absent", marked_by=mentor.id, marked_at=datetime.now(timezone.utc)))

    # Approved DL covering 2 absent sessions (sessions[27] and sessions[28])
    dl_full = LeaveRequestModel(
        student_id=student.id,
        type="duty",
        mode="full_day",
        date_from=sessions[27].held_on,
        date_to=sessions[28].held_on,
        reason="Hackathon DL",
        status="approved",
        decided_by=mentor.id,
        decided_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(dl_full)
    db_session.commit()

    stats = get_student_course_attendance(db_session, student.id, course.id, min_classes=5)
    assert stats["held"] == 40
    assert stats["present_count"] == 28
    assert stats["dl_counted"] == 2
    assert stats["attended"] == 30
    assert stats["still_need"] == 15
    assert stats["buffer"] == 5

    # Now replace with Case 2: DL covers lectures 3 and 4 on Oct 20 (lec3=present, lec4=absent)
    db_session.delete(dl_full)
    dl_lec = LeaveRequestModel(
        student_id=student.id,
        type="duty",
        mode="lectures",
        date_from=date(2026, 10, 20),
        date_to=date(2026, 10, 20),
        lecture_nos="[3, 4]",
        reason="Department seminar",
        status="approved",
        decided_by=mentor.id,
        decided_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(dl_lec)
    db_session.commit()

    stats_lec = get_student_course_attendance(db_session, student.id, course.id, min_classes=5)
    assert stats_lec["leave_counted"] == 1
    assert stats_lec["dl_counted"] == 1
    assert stats_lec["attended"] == 29
    # Buffer is preserved/neutral and not penalized!


def test_condonation_recommendation_and_403(client: TestClient, db_session: Session, phase2_setup: dict):
    student = phase2_setup["student"]
    mentor = phase2_setup["mentor"]

    # Unrelated faculty user (neither mentor nor course instructor)
    dept_cse = db_session.query(DepartmentModel).filter_by(code="CSE").first()
    unrelated_faculty = UserModel(
        name="Unrelated Prof",
        email="unrelated@acadflow.edu",
        password_hash="hash",
        role="faculty",
        department_id=dept_cse.id,
    )
    db_session.add(unrelated_faculty)
    db_session.commit()

    # Unrelated faculty attempts to recommend -> 403 Forbidden
    unrelated_headers = _auth_headers(unrelated_faculty.id, role="faculty", email=unrelated_faculty.email)
    res_unrelated = client.post(
        "/api/v1/condonation/recommend",
        json={"student_id": student.id, "semester_id": 1, "reason": "Attempt without scope"},
        headers=unrelated_headers,
    )
    assert res_unrelated.status_code == 403

    # Mentor recommends -> 201 Created
    mentor_headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    res_mentor = client.post(
        "/api/v1/condonation/recommend",
        json={"student_id": student.id, "semester_id": 1, "reason": "Hospitalization during midterms"},
        headers=mentor_headers,
    )
    assert res_mentor.status_code == 201
    data = res_mentor.json()
    assert data["student_id"] == student.id
    assert data["status"] == "recommended"
    assert data["recommended_by"] == mentor.id


def test_condonation_below_floor_rejected(client: TestClient, db_session: Session, phase2_setup: dict):
    student = phase2_setup["student"]
    mentor = phase2_setup["mentor"]
    course = phase2_setup["course"]

    # Seed 10 sessions, attended only 5 -> 50% attendance (< 65% floor)
    sessions = []
    for day in range(1, 11):
        sess = ClassSessionModel(
            course_id=course.id,
            held_on=date(2026, 9, day),
            is_cancelled=False,
        )
        db_session.add(sess)
        sessions.append(sess)
    db_session.flush()

    for i, sess in enumerate(sessions):
        status = "present" if i < 5 else "absent"
        db_session.add(
            AttendanceRecordModel(
                session_id=sess.id,
                student_id=student.id,
                status=status,
                marked_by=mentor.id,
                marked_at=datetime.now(timezone.utc),
            )
        )
    db_session.commit()

    mentor_headers = _auth_headers(mentor.id, role="faculty", email=mentor.email)
    res = client.post(
        "/api/v1/condonation/recommend",
        json={"student_id": student.id, "semester_id": 1, "reason": "Low attendance request"},
        headers=mentor_headers,
    )
    assert res.status_code == 400
    error_info = res.json().get("error", res.json().get("detail", {}))
    assert "BELOW_CONDONATION_FLOOR" in str(error_info) or "threshold" in str(error_info)


def test_condonation_queue_and_decision_by_dean(client: TestClient, db_session: Session, phase2_setup: dict):
    student = phase2_setup["student"]
    mentor = phase2_setup["mentor"]
    dean_cse = phase2_setup["dean_cse"]
    dean_ece = phase2_setup["dean_ece"]

    cond_req = CondonationRequestModel(
        student_id=student.id,
        semester_id=1,
        attendance_pct_at_request=Decimal("68.0"),
        reason="Represented state at national hackathon",
        status="recommended",
        recommended_by=mentor.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(cond_req)
    db_session.commit()

    # Non-dean student tries to access queue -> 403 Forbidden
    student_headers = _auth_headers(student.id, role="student", email=student.email)
    res_student_q = client.get("/api/v1/condonation/queue", headers=student_headers)
    assert res_student_q.status_code == 403

    # Dean of CSE accesses queue -> 200 OK
    cse_headers = _auth_headers(dean_cse.id, role="coordinator", email=dean_cse.email)
    res_queue = client.get("/api/v1/condonation/queue", headers=cse_headers)
    assert res_queue.status_code == 200
    queue_data = res_queue.json()
    assert len(queue_data) >= 1
    assert queue_data[0]["id"] == cond_req.id

    # Dean of ECE (cross-department) tries to decide -> 403 Forbidden
    ece_headers = _auth_headers(dean_ece.id, role="coordinator", email=dean_ece.email)
    res_ece_decide = client.post(
        f"/api/v1/condonation/{cond_req.id}/decide",
        json={"status": "approved", "decision_note": "Cross-dept decision"},
        headers=ece_headers,
    )
    assert res_ece_decide.status_code == 403

    # Dean of CSE decides -> 200 OK
    res_cse_decide = client.post(
        f"/api/v1/condonation/{cond_req.id}/decide",
        json={"status": "approved", "decision_note": "Condonation granted due to national merit"},
        headers=cse_headers,
    )
    assert res_cse_decide.status_code == 200
    assert res_cse_decide.json()["status"] == "approved"

    # Verify a profile note was logged in AuditLogModel
    profile_notes = db_session.query(AuditLogModel).filter_by(
        entity="student_notes",
        entity_id=str(student.id),
    ).all()
    assert len(profile_notes) >= 1
    assert "APPROVED" in profile_notes[-1].new_value.upper()
