"""
Part A Integration Tests — AcadFlow
Targeted Audience Notices, Guardrails, Snapshotting, Deadlines Opt-In, Unread Tracking, and Corrections.
"""

from __future__ import annotations
from decimal import Decimal

import json
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import (
    CourseModel,
    CourseStaffModel,
    DepartmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    RiskConfigModel,
    SemesterModel,
    StudentModel,
    UserModel,
)
from app.models.audit import AuditLogModel
from app.models.notice import (
    AudiencePresetModel,
    NoticeDeadlineModel,
    NoticeModel,
    NoticeRecipientModel,
)

BASE = "/api/v1"


def _register(client: TestClient, email: str, role: str = "student", name: str = None):
    return client.post(f"{BASE}/auth/register", json={
        "name": name or email.split("@")[0].replace(".", " ").title(),
        "email": email,
        "password": "AcadFlow@123",
        "role": role,
    })


def _login(client: TestClient, email: str, password: str = "AcadFlow@123"):
    return client.post(f"{BASE}/auth/login", data={"username": email, "password": password})


def _bearer(client: TestClient, email: str, password: str = "AcadFlow@123") -> dict:
    res = _login(client, email, password)
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    token = res.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


def _setup_partA_data(client: TestClient, db: Session):
    dept1 = db.scalar(select(DepartmentModel).where(DepartmentModel.name == "PartA Dept 1"))
    if not dept1:
        dept1 = DepartmentModel(name="PartA Dept 1", code="PAD1")
        db.add(dept1)

    dept2 = db.scalar(select(DepartmentModel).where(DepartmentModel.name == "PartA Dept 2"))
    if not dept2:
        dept2 = DepartmentModel(name="PartA Dept 2", code="PAD2")
        db.add(dept2)

    sem = db.scalar(select(SemesterModel))
    if not sem:
        sem = SemesterModel(name="Fall 2026", start_date=date(2026, 8, 1), end_date=date(2026, 12, 15))
        db.add(sem)

    db.commit()

    # Pre-register users
    fac1_email = "parta_fac1@acadflow.edu"
    fac2_email = "parta_fac2@acadflow.edu"
    dean_email = "parta_dean@acadflow.edu"
    stu1_email = "parta_stu1@acadflow.edu"
    stu2_email = "parta_stu2@acadflow.edu"

    _register(client, fac1_email, role="faculty", name="Faculty One")
    _register(client, fac2_email, role="faculty", name="Faculty Two")
    _register(client, dean_email, role="coordinator", name="Dean One")
    _register(client, stu1_email, role="student", name="Student One")
    _register(client, stu2_email, role="student", name="Student Two")

    fac1_u = db.scalar(select(UserModel).where(UserModel.email == fac1_email))
    fac1_u.department_id = dept1.id

    fac2_u = db.scalar(select(UserModel).where(UserModel.email == fac2_email))
    fac2_u.department_id = dept2.id

    dean_u = db.scalar(select(UserModel).where(UserModel.email == dean_email))
    dean_u.department_id = dept1.id

    stu1_u = db.scalar(select(UserModel).where(UserModel.email == stu1_email))
    stu1_u.department_id = dept1.id
    st1 = db.scalar(select(StudentModel).where(StudentModel.user_id == stu1_u.id))
    if not st1:
        st1 = StudentModel(user_id=stu1_u.id, roll_no="PA001", batch="2026", section="A")
        db.add(st1)
    else:
        st1.roll_no = "PA001"
        st1.batch = "2026"
        st1.section = "A"

    stu2_u = db.scalar(select(UserModel).where(UserModel.email == stu2_email))
    stu2_u.department_id = dept2.id
    st2 = db.scalar(select(StudentModel).where(StudentModel.user_id == stu2_u.id))
    if not st2:
        st2 = StudentModel(user_id=stu2_u.id, roll_no="PA002", batch="2026", section="B")
        db.add(st2)
    else:
        st2.roll_no = "PA002"
        st2.batch = "2026"
        st2.section = "B"

    c1 = db.scalar(select(CourseModel).where(CourseModel.code == "PA101"))
    if not c1:
        c1 = CourseModel(code="PA101", name="PartA Course 1", department_id=dept1.id, semester_id=sem.id, total_classes=30)
        db.add(c1)
        db.flush()

    c2 = db.scalar(select(CourseModel).where(CourseModel.code == "PA102"))
    if not c2:
        c2 = CourseModel(code="PA102", name="PartA Course 2 (Unassigned)", department_id=dept1.id, semester_id=sem.id, total_classes=30)
        db.add(c2)
        db.flush()

    if not db.scalar(select(CourseStaffModel).where(CourseStaffModel.course_id == c1.id, CourseStaffModel.user_id == fac1_u.id)):
        db.add(CourseStaffModel(course_id=c1.id, user_id=fac1_u.id, role="instructor"))

    if not db.scalar(select(EnrolmentModel).where(EnrolmentModel.course_id == c1.id, EnrolmentModel.student_id == stu1_u.id)):
        db.add(EnrolmentModel(course_id=c1.id, student_id=stu1_u.id, enrolled_on=date.today()))

    if not db.scalar(select(MentorAssignmentModel).where(MentorAssignmentModel.mentor_id == fac1_u.id, MentorAssignmentModel.student_id == stu1_u.id)):
        db.add(MentorAssignmentModel(mentor_id=fac1_u.id, student_id=stu1_u.id))

    db.commit()

    return {
        "dept1": dept1,
        "dept2": dept2,
        "fac1": fac1_u,
        "fac2": fac2_u,
        "dean": dean_u,
        "stu1": stu1_u,
        "stu2": stu2_u,
        "course1": c1,
        "course2": c2,
        "fac1_email": fac1_email,
        "fac2_email": fac2_email,
        "dean_email": dean_email,
        "stu1_email": stu1_email,
        "stu2_email": stu2_email,
    }


def test_student_cannot_preview_or_create_notice_403(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    stu_headers = _bearer(client, data["stu1_email"])

    res1 = client.post(f"{BASE}/notices/audience/preview", json={"recipient_type": "students"}, headers=stu_headers)
    assert res1.status_code == 403
    assert "PERM_403" in res1.text

    res2 = client.post(f"{BASE}/notices", json={"title": "Test", "body": "Body text"}, headers=stu_headers)
    assert res2.status_code == 403
    assert "PERM_403" in res2.text


def test_faculty_cannot_broadcast_to_everyone_403(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res1 = client.post(f"{BASE}/notices", json={
        "title": "Global Notice",
        "body": "Attempting broadcast to all",
        "audience_spec": json.dumps({"type": "all"}),
    }, headers=fac_headers)
    assert res1.status_code == 403
    assert "PERM_403" in res1.text

    res2 = client.post(f"{BASE}/notices", json={
        "title": "Dept Broadcast",
        "body": "Attempting whole department",
        "audience_spec": json.dumps({"preset": "Whole department"}),
    }, headers=fac_headers)
    assert res2.status_code == 403
    assert "PERM_403" in res2.text


def test_faculty_cannot_target_outside_department_403(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res = client.post(f"{BASE}/notices", json={
        "title": "Cross-Dept Attempt",
        "body": "Targeting outside dept",
        "audience_spec": json.dumps({"recipient_type": "students", "department_id": data["dept2"].id}),
    }, headers=fac_headers)
    assert res.status_code == 403
    assert "PERM_403" in res.text


def test_faculty_cannot_target_unassigned_course_403(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res = client.post(f"{BASE}/notices", json={
        "title": "Unassigned Course Attempt",
        "body": "Targeting Course 2",
        "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course2"].id}),
    }, headers=fac_headers)
    assert res.status_code == 403
    assert "PERM_403" in res.text


def test_faculty_attendance_band_unscoped_403(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res = client.post(f"{BASE}/notices", json={
        "title": "Unscoped Band Notice",
        "body": "Notice text",
        "audience_spec": json.dumps({
            "recipient_type": "students",
            "attendance_band": "Needs support",
        }),
    }, headers=fac_headers)
    assert res.status_code == 403
    assert "PERM_403" in res.text


def test_empty_audience_returns_422(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res = client.post(f"{BASE}/notices", json={
        "title": "Empty Audience Notice",
        "body": "Nobody will receive this",
        "audience_spec": json.dumps({
            "recipient_type": "students",
            "course_id": data["course1"].id,
            "batch": "1999",
        }),
    }, headers=fac_headers)
    assert res.status_code == 422
    assert "EMPTY_AUDIENCE" in res.text


def test_daily_rate_limiting_429(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    cfg = db_session.scalar(select(RiskConfigModel))
    old_limit = cfg.notice_daily_rate_limit if cfg else 20
    if not cfg:
        cfg = RiskConfigModel(
            w_margin=Decimal("0.4"),
            w_trend=Decimal("0.3"),
            w_deadline=Decimal("0.2"),
            w_missed=Decimal("0.1"),
            t_watch=Decimal("60"),
            t_risk=Decimal("40"),
            t_critical=Decimal("20"),
            version="v1",
            notice_daily_rate_limit=2,
        )
        db_session.add(cfg)
    else:
        cfg.notice_daily_rate_limit = 2
    db_session.commit()

    try:
        res1 = client.post(f"{BASE}/notices", json={
            "title": "Rate Notice 1",
            "body": "Body 1",
            "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
        }, headers=fac_headers)
        assert res1.status_code == 201

        res2 = client.post(f"{BASE}/notices", json={
            "title": "Rate Notice 2",
            "body": "Body 2",
            "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
        }, headers=fac_headers)
        assert res2.status_code == 201

        res3 = client.post(f"{BASE}/notices", json={
            "title": "Rate Notice 3",
            "body": "Body 3",
            "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
        }, headers=fac_headers)
        assert res3.status_code == 429
        assert "RATE_LIMIT_EXCEEDED" in res3.text
    finally:
        if cfg:
            cfg.notice_daily_rate_limit = old_limit
            db_session.commit()


def test_audience_preview_and_presets(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    prev_res = client.post(f"{BASE}/notices/audience/preview", json={
        "recipient_type": "students",
        "course_id": data["course1"].id,
    }, headers=fac_headers)
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["count"] == 1
    assert prev_data["student_count"] == 1
    assert prev_data["teacher_count"] == 0
    assert len(prev_data["recipients_sample"]) == 1
    assert prev_data["recipients_sample"][0]["email"] == data["stu1_email"]
    assert "audience_summary" in prev_data

    preset_res = client.post(f"{BASE}/notices/presets", json={
        "name": "My PA101 Section A Preset",
        "spec": {"recipient_type": "students", "course_id": data["course1"].id, "section": "A"},
    }, headers=fac_headers)
    assert preset_res.status_code == 201
    assert preset_res.json()["saved"] is True

    list_res = client.get(f"{BASE}/notices/presets", headers=fac_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert any(p["name"] == "My course sections" for p in list_data["system_presets"])
    assert any(cp["name"] == "My PA101 Section A Preset" for cp in list_data["custom_presets"])


def test_roll_numbers_with_out_of_scope_exclusion(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res = client.post(f"{BASE}/notices/audience/preview", json={
        "recipient_type": "students",
        "roll_numbers": ["PA001", "PA002", "INVALID999"],
    }, headers=fac_headers)

    assert res.status_code == 200
    d = res.json()
    assert d["count"] == 1
    assert len(d["excluded"]) == 2
    excluded_rolls = {ex["roll_no"] for ex in d["excluded"]}
    assert "PA002" in excluded_rolls
    assert "INVALID999" in excluded_rolls


def test_deadlines_opt_in(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac_headers = _bearer(client, data["fac1_email"])

    res_a = client.post(f"{BASE}/notices", json={
        "title": "Notice Without Synced Deadlines",
        "body": "Project due by 20 Dec 2026",
        "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
        "deadlines": [{"kind": "deadline", "at": "2026-12-20T23:59:00+05:30", "label": "Project Submission"}],
        "add_to_deadlines": False,
    }, headers=fac_headers)
    assert res_a.status_code == 201
    notice_a_id = res_a.json()["id"]
    assert res_a.json()["deadlines_count"] == 0

    dls_a = db_session.scalars(select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == notice_a_id)).all()
    assert len(dls_a) == 0

    res_b = client.post(f"{BASE}/notices", json={
        "title": "Notice With Synced Deadlines",
        "body": "Final report due 25 Dec 2026",
        "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
        "deadlines": [{"kind": "deadline", "at": "2026-12-25T23:59:00+05:30", "label": "Final Report"}],
        "add_to_deadlines": True,
    }, headers=fac_headers)
    assert res_b.status_code == 201
    notice_b_id = res_b.json()["id"]
    assert res_b.json()["deadlines_count"] == 1

    dls_b = db_session.scalars(select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == notice_b_id)).all()
    assert len(dls_b) == 1
    assert dls_b[0].label == "Final Report"


def test_unread_recipients_and_scoping_403(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac1_headers = _bearer(client, data["fac1_email"])
    fac2_headers = _bearer(client, data["fac2_email"])
    stu1_headers = _bearer(client, data["stu1_email"])

    res_pub = client.post(f"{BASE}/notices", json={
        "title": "Reading Test Notice",
        "body": "Notice body text",
        "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
    }, headers=fac1_headers)
    assert res_pub.status_code == 201
    nid = res_pub.json()["id"]

    res_un = client.get(f"{BASE}/notices/{nid}/unread", headers=fac1_headers)
    assert res_un.status_code == 200
    assert res_un.json()["total_unread"] == 1
    assert res_un.json()["unread_recipients"][0]["email"] == data["stu1_email"]

    res_un_fac2 = client.get(f"{BASE}/notices/{nid}/unread", headers=fac2_headers)
    assert res_un_fac2.status_code == 403
    assert "PERM_403" in res_un_fac2.text

    res_read = client.post(f"{BASE}/notices/{nid}/read", headers=stu1_headers)
    assert res_read.status_code == 200

    res_un_after = client.get(f"{BASE}/notices/{nid}/unread", headers=fac1_headers)
    assert res_un_after.status_code == 200
    assert res_un_after.json()["total_unread"] == 0


def test_send_correction_notifies_snapshot_and_audits(client: TestClient, db_session: Session):
    data = _setup_partA_data(client, db_session)
    fac1_headers = _bearer(client, data["fac1_email"])
    fac2_headers = _bearer(client, data["fac2_email"])

    orig_res = client.post(f"{BASE}/notices", json={
        "title": "Original Exam Room Notice",
        "body": "Exam in Hall 101",
        "audience_spec": json.dumps({"recipient_type": "students", "course_id": data["course1"].id}),
    }, headers=fac1_headers)
    assert orig_res.status_code == 201
    orig_id = orig_res.json()["id"]

    corr_fail = client.post(f"{BASE}/notices/{orig_id}/correction", json={
        "title": "Unauthorized Correction",
        "body": "Body",
    }, headers=fac2_headers)
    assert corr_fail.status_code == 403

    corr_res = client.post(f"{BASE}/notices/{orig_id}/correction", json={
        "title": "Correction: Exam Room Changed to Hall 202",
        "body": "Please report to Hall 202 instead of 101.",
    }, headers=fac1_headers)
    assert corr_res.status_code == 201
    corr_data = corr_res.json()
    assert corr_data["is_correction_for_id"] == orig_id
    assert corr_data["recipient_count"] == 1
    assert "Correction for #" in corr_data["audience_summary"]

    corr_id = corr_data["id"]
    rec = db_session.scalar(select(NoticeRecipientModel).where(NoticeRecipientModel.notice_id == corr_id))
    assert rec is not None
    assert f"Correction for Notice #{orig_id}" in rec.reason

    audit = db_session.scalar(
        select(AuditLogModel).where(
            AuditLogModel.entity == "notices",
            AuditLogModel.action == "notice_correction",
            AuditLogModel.entity_id == str(corr_id),
        )
    )
    assert audit is not None
    assert str(orig_id) in audit.old_value
