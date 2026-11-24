"""
Part B Integration Tests — AcadFlow
Timetable Manager: non-blocking clash detection, 5-step wizard capabilities,
room master management, versioning & restore, diff preview, targeted notifications, and RBAC 403 guards.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    NotificationModel,
    SemesterModel,
    StudentModel,
    UserModel,
)
from app.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.models.audit import AuditLogModel
from app.models.timetable import (
    PeriodConfigModel,
    RoomModel,
    TimetableSlotModel,
    TimetableVersionModel,
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


def _setup_timetable_data(client: TestClient, db: Session):
    dept1 = db.scalar(select(DepartmentModel).where(DepartmentModel.name == "TT Dept 1"))
    if not dept1:
        dept1 = DepartmentModel(name="TT Dept 1", code="TTD1")
        db.add(dept1)

    dept2 = db.scalar(select(DepartmentModel).where(DepartmentModel.name == "TT Dept 2"))
    if not dept2:
        dept2 = DepartmentModel(name="TT Dept 2", code="TTD2")
        db.add(dept2)

    sem = db.scalar(select(SemesterModel))
    if not sem:
        sem = SemesterModel(name="2026 Odd Sem", is_active=True)
        db.add(sem)

    db.flush()

    # Users
    # 1. Coordinator for Dept 1
    _register(client, "partb_coord1@acadflow.edu", role="coordinator")
    coord1 = db.scalar(select(UserModel).where(UserModel.email == "partb_coord1@acadflow.edu"))
    coord1.department_id = dept1.id

    # 2. Coordinator for Dept 2
    _register(client, "partb_coord2@acadflow.edu", role="coordinator")
    coord2 = db.scalar(select(UserModel).where(UserModel.email == "partb_coord2@acadflow.edu"))
    coord2.department_id = dept2.id

    # 3. Regular Faculty in Dept 1 (not coordinator)
    _register(client, "partb_faculty1@acadflow.edu", role="faculty")
    fac1 = db.scalar(select(UserModel).where(UserModel.email == "partb_faculty1@acadflow.edu"))
    fac1.department_id = dept1.id

    # 4. Another Faculty in Dept 1
    _register(client, "partb_faculty2@acadflow.edu", role="faculty")
    fac2 = db.scalar(select(UserModel).where(UserModel.email == "partb_faculty2@acadflow.edu"))
    fac2.department_id = dept1.id

    # 5. Student in Dept 1, Section A
    _register(client, "partb_student1@acadflow.edu", role="student")
    stu1 = db.scalar(select(UserModel).where(UserModel.email == "partb_student1@acadflow.edu"))
    stu1.department_id = dept1.id
    stu_record1 = db.get(StudentModel, stu1.id)
    if not stu_record1:
        stu_record1 = StudentModel(user_id=stu1.id, roll_no="26TT001", batch="2026", section="A")
        db.add(stu_record1)
    else:
        stu_record1.section = "A"

    # Courses in Dept 1
    c1 = db.scalar(select(CourseModel).where(CourseModel.code == "CS101_TT"))
    if not c1:
        c1 = CourseModel(code="CS101_TT", name="Data Structures", semester_id=sem.id, department_id=dept1.id, total_classes=40)
        db.add(c1)

    c2 = db.scalar(select(CourseModel).where(CourseModel.code == "CS102_TT"))
    if not c2:
        c2 = CourseModel(code="CS102_TT", name="Algorithms", semester_id=sem.id, department_id=dept1.id, total_classes=40)
        db.add(c2)

    db.flush()

    # Enrol student in c1 and c2
    e1 = db.scalar(select(EnrolmentModel).where(EnrolmentModel.student_id == stu1.id, EnrolmentModel.course_id == c1.id))
    if not e1:
        db.add(EnrolmentModel(student_id=stu1.id, course_id=c1.id, enrolled_on=date.today()))

    e2 = db.scalar(select(EnrolmentModel).where(EnrolmentModel.student_id == stu1.id, EnrolmentModel.course_id == c2.id))
    if not e2:
        db.add(EnrolmentModel(student_id=stu1.id, course_id=c2.id, enrolled_on=date.today()))

    # Rooms
    r1 = db.scalar(select(RoomModel).where(RoomModel.name == "TT_Room_101"))
    if not r1:
        r1 = RoomModel(name="TT_Room_101", capacity=60, room_type="classroom", department_id=dept1.id)
        db.add(r1)

    r2 = db.scalar(select(RoomModel).where(RoomModel.name == "TT_Lab_201"))
    if not r2:
        r2 = RoomModel(name="TT_Lab_201", capacity=40, room_type="lab", department_id=dept1.id)
        db.add(r2)

    db.commit()
    return {
        "dept1": dept1,
        "dept2": dept2,
        "sem": sem,
        "coord1": coord1,
        "coord2": coord2,
        "fac1": fac1,
        "fac2": fac2,
        "stu1": stu1,
        "c1": c1,
        "c2": c2,
        "r1": r1,
        "r2": r2,
    }


def test_student_cannot_edit_or_publish_timetable_403(client: TestClient, db_session: Session):
    """Students attempting to create draft, save draft, or publish timetable must receive 403."""
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")
    stu_headers = _bearer(client, "partb_student1@acadflow.edu")

    # 1. Draft create
    res1 = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Student Attempt",
    }, headers=stu_headers)
    assert res1.status_code == 403
    assert "PERM_403" in res1.text

    # Coordinator creates a draft version
    res_c = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Target Version",
    }, headers=coord1_headers)
    vid = res_c.json()["id"]

    # 2. Student draft save
    res2 = client.put(f"{BASE}/timetable/draft", json={
        "version_id": vid,
        "slots": [],
    }, headers=stu_headers)
    assert res2.status_code == 403
    assert "PERM_403" in res2.text

    # 3. Student publish
    res3 = client.post(f"{BASE}/timetable/publish", json={
        "version_id": vid,
    }, headers=stu_headers)
    assert res3.status_code == 403
    assert "PERM_403" in res3.text


def test_faculty_non_coordinator_cannot_edit_timetable_403(client: TestClient, db_session: Session):
    """Faculty who are not coordinators or deans cannot edit or publish timetable (403)."""
    data = _setup_timetable_data(client, db_session)
    fac_headers = _bearer(client, "partb_faculty1@acadflow.edu")

    res = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Faculty Attempt",
    }, headers=fac_headers)
    assert res.status_code == 403
    assert "PERM_403" in res.text


def test_cross_department_coordinator_cannot_edit_403(client: TestClient, db_session: Session):
    """Coordinator of Dept 2 attempting to create/publish timetable for Dept 1 must receive 403."""
    data = _setup_timetable_data(client, db_session)
    coord2_headers = _bearer(client, "partb_coord2@acadflow.edu")

    res = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Cross Dept Attempt",
    }, headers=coord2_headers)
    assert res.status_code == 403
    assert "PERM_403" in res.text


def test_non_blocking_draft_save_and_validate(client: TestClient, db_session: Session):
    """
    Saving a draft always succeeds (warn never block, 200).
    Draft validation returns 200 with structured clash warnings.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Create a draft version
    res_create = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Test Draft",
    }, headers=coord1_headers)
    assert res_create.status_code == 201
    vid = res_create.json()["id"]

    # 2. Save draft with intentional teacher clash (same teacher fac1 on Monday P1 in two different courses)
    save_payload = {
        "version_id": vid,
        "slots": [
            {
                "course_id": data["c1"].id,
                "section": "A",
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 0,
                "period_label": "P1",
                "start_time": "09:00",
                "end_time": "10:00",
                "kind": "lecture",
            },
            {
                "course_id": data["c2"].id,
                "section": "B",
                "teacher_id": data["fac1"].id,  # SAME teacher, same time
                "room_id": data["r2"].id,
                "day": 0,
                "period_label": "P1",
                "start_time": "09:00",
                "end_time": "10:00",
                "kind": "lecture",
            },
        ],
    }
    res_save = client.put(f"{BASE}/timetable/draft", json=save_payload, headers=coord1_headers)
    assert res_save.status_code == 200
    save_data = res_save.json()
    assert save_data["saved"] is True
    assert save_data["clashes_count"] >= 1
    assert any(c["type"] == "teacher" for c in save_data["clashes"])

    # 3. Validate endpoint returns 200 non-blocking with clash details
    res_val = client.post(f"{BASE}/timetable/draft/validate", json={"version_id": vid}, headers=coord1_headers)
    assert res_val.status_code == 200
    val_data = res_val.json()
    assert val_data["valid"] is False
    assert val_data["clashes_count"] >= 1


def test_back_to_back_classes_no_clash_vs_partial_overlap_clash(client: TestClient, db_session: Session):
    """
    Back-to-back classes (e.g. 09:00-10:00 and 10:00-11:00) do NOT clash.
    Partial overlap (e.g. 09:00-10:30 and 10:00-11:00) DOES clash.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Back-to-back classes for same teacher in same room
    b2b_slots = [
        {
            "course_id": data["c1"].id,
            "section": "A",
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 1,  # Tuesday
            "period_label": "P1",
            "start_time": "09:00",
            "end_time": "10:00",
            "kind": "lecture",
        },
        {
            "course_id": data["c2"].id,
            "section": "A",
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 1,  # Tuesday
            "period_label": "P2",
            "start_time": "10:00",
            "end_time": "11:00",  # Back to back!
            "kind": "lecture",
        },
    ]
    res_b2b = client.post(f"{BASE}/timetable/draft/validate", json={"slots": b2b_slots}, headers=coord1_headers)
    assert res_b2b.status_code == 200
    assert res_b2b.json()["clashes_count"] == 0, f"Back-to-back falsely reported as clash: {res_b2b.json()}"

    # 2. Partial overlap: 09:00-10:30 and 10:00-11:00 (30 min clash)
    overlap_slots = [
        {
            "course_id": data["c1"].id,
            "section": "A",
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 2,  # Wednesday
            "period_label": "P1",
            "start_time": "09:00",
            "end_time": "10:30",
            "kind": "lab",
        },
        {
            "course_id": data["c2"].id,
            "section": "A",
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 2,  # Wednesday
            "period_label": "P2",
            "start_time": "10:00",
            "end_time": "11:00",
            "kind": "lecture",
        },
    ]
    res_overlap = client.post(f"{BASE}/timetable/draft/validate", json={"slots": overlap_slots}, headers=coord1_headers)
    assert res_overlap.status_code == 200
    assert res_overlap.json()["clashes_count"] >= 1


def test_publish_with_conflicts_guard_and_confirmation(client: TestClient, db_session: Session):
    """
    Publishing with conflicts without explicit confirmation returns 422.
    Publishing with conflicts confirmed (publish_with_conflicts=True) succeeds and logs audit.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Create draft
    res_create = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Clash Version",
    }, headers=coord1_headers)
    vid = res_create.json()["id"]

    # 2. Add conflicting slots (double booked room TT_Room_101)
    client.put(f"{BASE}/timetable/draft", json={
        "version_id": vid,
        "slots": [
            {
                "course_id": data["c1"].id,
                "section": "A",
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 3,
                "period_label": "P1",
                "start_time": "09:00",
                "end_time": "10:00",
                "kind": "lecture",
            },
            {
                "course_id": data["c2"].id,
                "section": "B",
                "teacher_id": data["fac2"].id,
                "room_id": data["r1"].id,  # Same room, same time
                "day": 3,
                "period_label": "P1",
                "start_time": "09:00",
                "end_time": "10:00",
                "kind": "lecture",
            },
        ],
    }, headers=coord1_headers)

    # 3. Attempt publish without confirmation -> 422
    res_pub_fail = client.post(f"{BASE}/timetable/publish", json={
        "version_id": vid,
        "publish_with_conflicts": False,
    }, headers=coord1_headers)
    assert res_pub_fail.status_code == 422
    assert "TIMETABLE_CLASHES_EXIST" in res_pub_fail.text

    # 4. Attempt publish with confirmation -> 200
    res_pub_ok = client.post(f"{BASE}/timetable/publish", json={
        "version_id": vid,
        "publish_with_conflicts": True,
        "effective_from": "2026-08-01",
    }, headers=coord1_headers)
    assert res_pub_ok.status_code == 200
    pub_data = res_pub_ok.json()
    assert pub_data["published"] is True
    assert pub_data["is_published_with_conflicts"] is True

    # 5. Check audit log
    audit_entry = db_session.scalar(
        select(AuditLogModel)
        .where(
            AuditLogModel.entity == "timetable_versions",
            AuditLogModel.entity_id == str(vid),
            AuditLogModel.action == "timetable_publish_with_conflicts",
        )
    )
    assert audit_entry is not None


def test_publish_clean_timetable_and_audits(client: TestClient, db_session: Session):
    """Publishing a clean timetable succeeds with is_published_with_conflicts=False and audits."""
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Create draft
    res_create = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Clean Version",
    }, headers=coord1_headers)
    vid = res_create.json()["id"]

    # 2. Add non-conflicting slots
    client.put(f"{BASE}/timetable/draft", json={
        "version_id": vid,
        "slots": [
            {
                "course_id": data["c1"].id,
                "section": "A",
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 4,
                "period_label": "P1",
                "start_time": "09:00",
                "end_time": "10:00",
                "kind": "lecture",
            },
            {
                "course_id": data["c2"].id,
                "section": "A",
                "teacher_id": data["fac2"].id,
                "room_id": data["r2"].id,
                "day": 4,
                "period_label": "P2",
                "start_time": "10:00",
                "end_time": "11:00",
                "kind": "lecture",
            },
        ],
    }, headers=coord1_headers)

    # 3. Publish
    res_pub = client.post(f"{BASE}/timetable/publish", json={
        "version_id": vid,
        "publish_with_conflicts": False,
        "effective_from": "2026-08-10",
    }, headers=coord1_headers)
    assert res_pub.status_code == 200
    assert res_pub.json()["is_published_with_conflicts"] is False

    # 4. Check audit log
    audit_entry = db_session.scalar(
        select(AuditLogModel)
        .where(
            AuditLogModel.entity == "timetable_versions",
            AuditLogModel.entity_id == str(vid),
            AuditLogModel.action == "timetable_publish",
        )
    )
    assert audit_entry is not None


def test_publish_preview_calculates_diff_and_affected_counts(client: TestClient, db_session: Session):
    """POST /timetable/publish-preview returns formatted slot diffs and affected counts."""
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Create and publish version 1
    res_v1 = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version 1",
    }, headers=coord1_headers)
    vid1 = res_v1.json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": vid1,
        "slots": [
            {
                "course_id": data["c1"].id,
                "section": "A",
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 0,  # Monday
                "period_label": "P1",
                "kind": "lecture",
            }
        ],
    }, headers=coord1_headers)
    client.post(f"{BASE}/timetable/publish", json={"version_id": vid1}, headers=coord1_headers)

    # 2. Create version 2 with moved slot (Monday -> Tuesday)
    res_v2 = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version 2",
    }, headers=coord1_headers)
    vid2 = res_v2.json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": vid2,
        "slots": [
            {
                "course_id": data["c1"].id,
                "section": "A",
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 1,  # Tuesday (Moved from Mon)
                "period_label": "P2",
                "kind": "lecture",
            }
        ],
    }, headers=coord1_headers)

    # 3. Request publish preview
    res_prev = client.post(f"{BASE}/timetable/publish-preview", json={"version_id": vid2}, headers=coord1_headers)
    assert res_prev.status_code == 200
    prev_data = res_prev.json()
    assert prev_data["affected_teachers_count"] >= 1
    assert prev_data["affected_students_count"] >= 1
    assert len(prev_data["diff_summary"]) >= 1
    assert any("moved" in s.lower() for s in prev_data["diff_summary"])


def test_restore_version_creates_new_draft_and_preserves_past_data(client: TestClient, db_session: Session):
    """POST /timetable/versions/{id}/restore creates a new draft version, copies slots, and audits."""
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Create a historical version with 1 slot
    res_v = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Historical Version",
    }, headers=coord1_headers)
    vid = res_v.json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": vid,
        "slots": [
            {
                "course_id": data["c1"].id,
                "section": "A",
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 0,
                "period_label": "P1",
                "kind": "lecture",
            }
        ],
    }, headers=coord1_headers)

    # 2. Restore historical version
    res_restore = client.post(f"{BASE}/timetable/versions/{vid}/restore", headers=coord1_headers)
    assert res_restore.status_code == 200
    restore_data = res_restore.json()
    assert restore_data["restored"] is True
    new_vid = restore_data["new_version_id"]
    assert new_vid != vid
    assert restore_data["slots_copied"] == 1

    # Check new version exists as draft
    new_v = db_session.get(TimetableVersionModel, new_vid)
    assert new_v is not None
    assert new_v.status == "draft"
    assert new_v.restored_from_id == vid

    # Check audit log
    audit_entry = db_session.scalar(
        select(AuditLogModel)
        .where(
            AuditLogModel.entity == "timetable_versions",
            AuditLogModel.entity_id == str(new_vid),
            AuditLogModel.action == "timetable_version_restore",
        )
    )
    assert audit_entry is not None


def test_room_master_management_and_scoping(client: TestClient, db_session: Session):
    """
    Rooms CRUD:
    - Coordinator can create, update, and delete rooms for own department.
    - Cross-department coordinator gets 403.
    - Student gets 403.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")
    coord2_headers = _bearer(client, "partb_coord2@acadflow.edu")
    stu_headers = _bearer(client, "partb_student1@acadflow.edu")

    # 1. Student cannot create room (403)
    res_stu = client.post(f"{BASE}/timetable/rooms", json={
        "name": "Student Room",
        "capacity": 30,
        "room_type": "classroom",
        "department_id": data["dept1"].id,
    }, headers=stu_headers)
    assert res_stu.status_code == 403

    # 2. Cross-dept coordinator cannot create room for Dept 1 (403)
    res_cross = client.post(f"{BASE}/timetable/rooms", json={
        "name": "Cross Room",
        "capacity": 30,
        "room_type": "classroom",
        "department_id": data["dept1"].id,
    }, headers=coord2_headers)
    assert res_cross.status_code == 403

    # 3. Dept 1 coordinator can create room
    res_ok = client.post(f"{BASE}/timetable/rooms", json={
        "name": "Dept1_New_Room",
        "capacity": 55,
        "room_type": "lab",
        "department_id": data["dept1"].id,
    }, headers=coord1_headers)
    assert res_ok.status_code == 201
    room_id = res_ok.json()["id"]

    # 4. Update room
    res_up = client.patch(f"{BASE}/timetable/rooms/{room_id}", json={
        "capacity": 70,
    }, headers=coord1_headers)
    assert res_up.status_code == 200
    assert res_up.json()["capacity"] == 70

    # 5. Cross-dept coordinator cannot update room in Dept 1 (403)
    res_cross_up = client.patch(f"{BASE}/timetable/rooms/{room_id}", json={
        "capacity": 100,
    }, headers=coord2_headers)
    assert res_cross_up.status_code == 403

    # 6. Delete room
    res_del = client.delete(f"{BASE}/timetable/rooms/{room_id}", headers=coord1_headers)
    assert res_del.status_code == 200


def test_replaced_teacher_is_notified_and_grouped_notifications_per_person(client: TestClient, db_session: Session):
    """
    Publish notification delivery:
    - Replaced teacher is notified of the reassignment.
    - Newly assigned teacher is notified.
    - Enrolled student is notified.
    - Each affected user receives one grouped notification containing only their own changes.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # 1. Publish Initial Version: Course 1 taught by Faculty 1
    draft_res = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version 1 Initial",
        "effective_from": "2026-09-01",
    }, headers=coord1_headers)
    assert draft_res.status_code == 201
    v1_id = draft_res.json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": v1_id,
        "slots": [{
            "course_id": data["c1"].id,
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 0,
            "period_label": "P1",
            "start_time": "09:00",
            "end_time": "10:00",
            "section": "A",
            "kind": "lecture",
        }],
    }, headers=coord1_headers)

    pub1 = client.post(f"{BASE}/timetable/publish", json={"version_id": v1_id}, headers=coord1_headers)
    assert pub1.status_code == 200

    # Clear notifications from initial publish
    db_session.query(NotificationModel).delete()
    db_session.commit()

    # 2. Create Version 2: Replaces Faculty 1 with Faculty 2 on Course 1
    draft2_res = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version 2 Replaced Teacher",
        "effective_from": "2026-10-01",
    }, headers=coord1_headers)
    assert draft2_res.status_code == 201
    v2_id = draft2_res.json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": v2_id,
        "slots": [{
            "course_id": data["c1"].id,
            "teacher_id": data["fac2"].id,  # Replaced fac1 with fac2
            "room_id": data["r1"].id,
            "day": 0,
            "period_label": "P1",
            "start_time": "09:00",
            "end_time": "10:00",
            "section": "A",
            "kind": "lecture",
        }],
    }, headers=coord1_headers)

    pub2 = client.post(f"{BASE}/timetable/publish", json={"version_id": v2_id}, headers=coord1_headers)
    assert pub2.status_code == 200

    # 3. Verify notifications
    fac1_notifs = db_session.scalars(
        select(NotificationModel).where(NotificationModel.recipient_id == data["fac1"].id)
    ).all()
    assert len(fac1_notifs) == 1
    assert "reassigned" in fac1_notifs[0].message.lower()

    fac2_notifs = db_session.scalars(
        select(NotificationModel).where(NotificationModel.recipient_id == data["fac2"].id)
    ).all()
    assert len(fac2_notifs) == 1
    assert "assigned to you" in fac2_notifs[0].message.lower()

    stu1_notifs = db_session.scalars(
        select(NotificationModel).where(NotificationModel.recipient_id == data["stu1"].id)
    ).all()
    assert len(stu1_notifs) == 1
    assert "instructor changed to" in stu1_notifs[0].message


def test_no_diff_means_zero_notifications(client: TestClient, db_session: Session):
    """
    When publishing a new timetable version with zero slot changes vs published,
    zero notifications are created.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # Version A
    v_a = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version A",
    }, headers=coord1_headers).json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": v_a,
        "slots": [{
            "course_id": data["c1"].id,
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 2,
            "period_label": "P2",
            "start_time": "10:00",
            "end_time": "11:00",
            "section": "A",
            "kind": "lecture",
        }],
    }, headers=coord1_headers)
    client.post(f"{BASE}/timetable/publish", json={"version_id": v_a}, headers=coord1_headers)

    # Clear notifications
    db_session.query(NotificationModel).delete()
    db_session.commit()

    # Version B: identical slot
    v_b = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version B Identical",
    }, headers=coord1_headers).json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": v_b,
        "slots": [{
            "course_id": data["c1"].id,
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 2,
            "period_label": "P2",
            "start_time": "10:00",
            "end_time": "11:00",
            "section": "A",
            "kind": "lecture",
        }],
    }, headers=coord1_headers)

    pub_b = client.post(f"{BASE}/timetable/publish", json={"version_id": v_b}, headers=coord1_headers)
    assert pub_b.status_code == 200

    # Assert exactly 0 notifications created
    notifs_count = db_session.scalar(select(NotificationModel))
    assert notifs_count is None


def test_multi_period_lab_clash_detection_and_back_to_back(client: TestClient, db_session: Session):
    """
    Test multi-period lab clash behavior:
    - Lab spanning multiple periods (14:00 - 16:00) clashes with another class in the same room (15:00 - 16:00).
    - Lab does NOT clash with back-to-back classes (13:00 - 14:00 or 16:00 - 17:00).
    """
    from app.api.v1.endpoints.timetable import detect_clashes

    data = _setup_timetable_data(client, db_session)
    room = data["r1"]

    # Slot 1: 2-period lab spanning 14:00 to 16:00
    lab_slot = TimetableSlotModel(
        version_id=1,
        course_id=data["c1"].id,
        teacher_id=data["fac1"].id,
        room_id=room.id,
        day=0,
        period_label="P5-P6",
        start_time="14:00",
        end_time="16:00",
        section="A",
        kind="lab",
    )

    # Slot 2: Overlapping lecture in same room during 15:00 to 16:00
    overlap_slot = TimetableSlotModel(
        version_id=1,
        course_id=data["c2"].id,
        teacher_id=data["fac2"].id,
        room_id=room.id,
        day=0,
        period_label="P6",
        start_time="15:00",
        end_time="16:00",
        section="B",
        kind="lecture",
    )

    # Slot 3: Back-to-back lecture right before the lab (13:00 - 14:00)
    before_slot = TimetableSlotModel(
        version_id=1,
        course_id=data["c2"].id,
        teacher_id=data["fac2"].id,
        room_id=room.id,
        day=0,
        period_label="P4",
        start_time="13:00",
        end_time="14:00",
        section="B",
        kind="lecture",
    )

    # Slot 4: Back-to-back lecture right after the lab (16:00 - 17:00)
    after_slot = TimetableSlotModel(
        version_id=1,
        course_id=data["c2"].id,
        teacher_id=data["fac2"].id,
        room_id=room.id,
        day=0,
        period_label="P7",
        start_time="16:00",
        end_time="17:00",
        section="B",
        kind="lecture",
    )

    # 1. Lab + Overlapping slot -> MUST CLASH
    clashes_with_overlap = detect_clashes([lab_slot, overlap_slot], db=db_session)
    assert len(clashes_with_overlap) == 1
    assert clashes_with_overlap[0]["type"] in ("room", "room_overlap")

    # 2. Lab + Back-to-back before + Back-to-back after -> MUST NOT CLASH
    clashes_back_to_back = detect_clashes([lab_slot, before_slot, after_slot], db=db_session)
    assert len(clashes_back_to_back) == 0


def test_restoring_version_leaves_past_attendance_and_sessions_untouched(client: TestClient, db_session: Session):
    """
    Restoring a timetable version creates a fresh draft but guarantees that
    all past sessions and student attendance records are completely untouched.
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")

    # Create past session and attendance record
    past_date = date.today() - timedelta(days=14)
    past_sess = ClassSessionModel(
        course_id=data["c1"].id,
        held_on=past_date,
        is_cancelled=False,
    )
    db_session.add(past_sess)
    db_session.flush()

    past_att = AttendanceRecordModel(
        student_id=data["stu1"].id,
        session_id=past_sess.id,
        status="present",
        marked_by=data["fac1"].id,
        marked_at=datetime.now(timezone.utc),
    )
    db_session.add(past_att)
    db_session.commit()

    saved_sess_id = past_sess.id
    saved_att_id = past_att.id

    # Create and publish a version
    v_orig = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version for Past Test",
    }, headers=coord1_headers).json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": v_orig,
        "slots": [{
            "course_id": data["c1"].id,
            "teacher_id": data["fac1"].id,
            "room_id": data["r1"].id,
            "day": 1,
            "period_label": "P1",
            "start_time": "09:00",
            "end_time": "10:00",
            "section": "A",
            "kind": "lecture",
        }],
    }, headers=coord1_headers)
    client.post(f"{BASE}/timetable/publish", json={"version_id": v_orig}, headers=coord1_headers)

    # Restore the version
    res_restore = client.post(f"{BASE}/timetable/versions/{v_orig}/restore", headers=coord1_headers)
    assert res_restore.status_code == 200

    # Verify past session and attendance record are 100% intact
    sess_check = db_session.get(ClassSessionModel, saved_sess_id)
    assert sess_check is not None
    assert sess_check.held_on == past_date
    assert sess_check.is_cancelled is False

    att_check = db_session.get(AttendanceRecordModel, saved_att_id)
    assert att_check is not None
    assert att_check.status == "present"
    assert att_check.student_id == data["stu1"].id


def test_teacher_own_timetable_shows_both_classes_in_clashing_slot_with_conflict_marker(client: TestClient, db_session: Session):
    """
    Teacher own schedule (/timetable/me) must return both classes in a clashing slot
    with conflict markers (is_clash=True and clash_reason).
    """
    data = _setup_timetable_data(client, db_session)
    coord1_headers = _bearer(client, "partb_coord1@acadflow.edu")
    fac1_headers = _bearer(client, "partb_faculty1@acadflow.edu")

    # Publish timetable with teacher clash: fac1 assigned to two courses at Tue 10:00-11:00
    v_clash = client.post(f"{BASE}/timetable/versions", json={
        "department_id": data["dept1"].id,
        "semester_id": data["sem"].id,
        "name": "Version Teacher Clash",
    }, headers=coord1_headers).json()["id"]

    client.put(f"{BASE}/timetable/draft", json={
        "version_id": v_clash,
        "slots": [
            {
                "course_id": data["c1"].id,
                "teacher_id": data["fac1"].id,
                "room_id": data["r1"].id,
                "day": 1,
                "period_label": "P2",
                "start_time": "10:00",
                "end_time": "11:00",
                "section": "A",
                "kind": "lecture",
            },
            {
                "course_id": data["c2"].id,
                "teacher_id": data["fac1"].id,
                "room_id": data["r2"].id,
                "day": 1,
                "period_label": "P2",
                "start_time": "10:00",
                "end_time": "11:00",
                "section": "B",
                "kind": "lecture",
            },
        ],
    }, headers=coord1_headers)

    # Publish with conflicts confirmed
    pub_res = client.post(f"{BASE}/timetable/publish", json={
        "version_id": v_clash,
        "publish_with_conflicts": True,
    }, headers=coord1_headers)
    assert pub_res.status_code == 200

    # Query teacher's own timetable
    me_res = client.get(f"{BASE}/timetable/me", headers=fac1_headers)
    assert me_res.status_code == 200
    slots = me_res.json()

    # Find the slots on Day 1, P2
    clashing_slots = [s for s in slots if s["day"] == 1 and s["period_label"] == "P2"]
    assert len(clashing_slots) == 2, "Teacher schedule must return both classes in the clashing slot"
    for s in clashing_slots:
        assert s["is_clash"] is True, "Slot must be flagged with is_clash=True"
        assert s["clash_reason"] is not None, "Slot must include clash_reason"

