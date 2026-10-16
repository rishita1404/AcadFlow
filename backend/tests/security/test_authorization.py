import pytest
from fastapi import HTTPException
from app.core.authorization import (
    Action,
    can_access,
    verify_access,
    sanitize_coordinator_view,
    COORDINATOR_APPROVED_FIELDS,
)
from app.core.permissions import Role


def test_student_cannot_access_other_student_records():
    student_1 = {"id": 101, "role": Role.STUDENT.value}
    student_2_resource = {"student_id": 102, "details": "private marks and attendance"}
    student_1_resource = {"student_id": 101, "details": "own records"}

    # Own records allowed
    assert can_access(student_1, Action.VIEW_STUDENT_RECORD, student_1_resource) is True
    assert can_access(student_1, Action.VIEW_OWN_DASHBOARD, student_1_resource) is True

    # Other student's records denied
    assert can_access(student_1, Action.VIEW_STUDENT_RECORD, student_2_resource) is False
    assert can_access(student_1, Action.VIEW_OWN_DASHBOARD, student_2_resource) is False

    with pytest.raises(HTTPException) as exc_info:
        verify_access(student_1, Action.VIEW_STUDENT_RECORD, student_2_resource)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "PERM_403"


def test_faculty_cannot_edit_unassigned_course():
    faculty = {
        "id": 201,
        "role": Role.FACULTY.value,
        "assigned_course_ids": [10, 11]
    }
    assigned_course = {"course_id": 10, "name": "AI Systems"}
    unassigned_course = {"course_id": 99, "name": "Advanced Physics"}

    # Assigned course edits allowed
    assert can_access(faculty, Action.EDIT_COURSE, assigned_course) is True
    assert can_access(faculty, Action.UPLOAD_ATTENDANCE, assigned_course) is True

    # Unassigned course edits strictly denied
    assert can_access(faculty, Action.EDIT_COURSE, unassigned_course) is False
    assert can_access(faculty, Action.UPLOAD_ATTENDANCE, unassigned_course) is False

    with pytest.raises(HTTPException) as exc_info:
        verify_access(faculty, Action.EDIT_COURSE, unassigned_course)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "PERM_403"


def test_mentor_cannot_access_unassigned_student():
    mentor = {
        "id": 301,
        "role": Role.MENTOR.value,
        "mentee_ids": [501, 502]
    }
    assigned_mentee = {"student_id": 501}
    unassigned_student = {"student_id": 999}

    # Assigned mentee allowed
    assert can_access(mentor, Action.VIEW_MENTEE_RECORDS, assigned_mentee) is True
    assert can_access(mentor, Action.VIEW_MENTEE_RISK, assigned_mentee) is True

    # Unassigned student denied
    assert can_access(mentor, Action.VIEW_MENTEE_RECORDS, unassigned_student) is False
    assert can_access(mentor, Action.VIEW_MENTEE_RISK, unassigned_student) is False

    with pytest.raises(HTTPException) as exc_info:
        verify_access(mentor, Action.VIEW_MENTEE_RISK, unassigned_student)
    assert exc_info.value.status_code == 403


def test_coordinator_cannot_access_outside_department():
    coordinator = {
        "id": 401,
        "role": Role.COORDINATOR.value,
        "department_id": "CS"
    }
    same_dept_resource = {"department_id": "CS", "record_id": 1}
    other_dept_resource = {"department_id": "MECH", "record_id": 2}

    assert can_access(coordinator, Action.VIEW_DEPARTMENT_SUMMARY, same_dept_resource) is True
    assert can_access(coordinator, Action.VIEW_DEPARTMENT_SUMMARY, other_dept_resource) is False

    with pytest.raises(HTTPException) as exc_info:
        verify_access(coordinator, Action.VIEW_DEPARTMENT_SUMMARY, other_dept_resource)
    assert exc_info.value.status_code == 403


def test_coordinator_record_field_sanitization():
    raw_record = {
        "student_id": 501,
        "name": "Alice Smith",
        "email": "alice@acadflow.edu",
        "department_id": "CS",
        "attendance_percentage": 82.5,
        "buffer_classes": 3,
        "risk_level": "medium",
        "risk_score": 0.42,
        "enrolled_courses": ["CS101", "CS102"],
        # Prohibited sensitive fields
        "password_hash": "$2b$12$secretpasswordhash",
        "submission_content": "import os; os.system('run assignment')",
        "private_counseling_notes": "Sensitive behavioral notes",
    }

    sanitized = sanitize_coordinator_view(raw_record)

    # Approved fields retained
    assert sanitized["student_id"] == 501
    assert sanitized["attendance_percentage"] == 82.5
    assert sanitized["risk_score"] == 0.42

    # Sensitive fields removed
    assert "password_hash" not in sanitized
    assert "submission_content" not in sanitized
    assert "private_counseling_notes" not in sanitized
    assert set(sanitized.keys()).issubset(COORDINATOR_APPROVED_FIELDS)


def test_client_supplied_role_or_id_tampering_denied():
    # User principal authenticated as student (ID 101)
    authenticated_student = {
        "id": 101,
        "role": Role.STUDENT.value
    }
    
    # Attacker passes resource claiming role='admin' or targeting other student
    tampered_resource = {
        "role": "admin",
        "student_id": 202
    }
    
    # Action requiring faculty privileges
    assert can_access(authenticated_student, Action.EDIT_COURSE, tampered_resource) is False
    # Action on another student's record
    assert can_access(authenticated_student, Action.VIEW_STUDENT_RECORD, tampered_resource) is False


def test_admin_full_access():
    admin = {"id": 1, "role": Role.ADMIN.value}
    resource = {"student_id": 999, "course_id": 888, "department_id": "UNKNOWN"}

    assert can_access(admin, Action.EDIT_COURSE, resource) is True
    assert can_access(admin, Action.VIEW_STUDENT_RECORD, resource) is True
    assert can_access(admin, Action.ADMIN_MANAGE, resource) is True
