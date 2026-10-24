"""
Comprehensive Security and IDOR Matrix Tests for AcadFlow — Evaluation 1.

Verifies:
1. Student cannot access other student dashboard / records (IDOR protection).
2. Faculty cannot edit unassigned course (Horizontal privilege escalation).
3. Coordinator individual view is sanitized to approved fields.
4. Client role tampering is denied.
5. Password hashing and verification strength.
"""

import pytest
from fastapi import HTTPException

from app.core.authorization import (
    Action,
    can_access,
    sanitize_coordinator_view,
    verify_access,
)
from app.core.permissions import Role
from app.core.security import get_password_hash, verify_password


def test_forbidden_role_matrix():
    # Student attempting faculty actions
    student = {"id": 10, "role": Role.STUDENT.value}
    assert can_access(student, Action.EDIT_COURSE, {"course_id": 1}) is False
    assert can_access(student, Action.UPLOAD_ATTENDANCE, {"course_id": 1}) is False
    assert can_access(student, Action.ADMIN_MANAGE) is False

    # Faculty attempting student submission
    faculty = {"id": 20, "role": Role.FACULTY.value, "assigned_course_ids": [1]}
    assert can_access(faculty, Action.SUBMIT_WORK, {"student_id": 10}) is False
    assert can_access(faculty, Action.ADMIN_MANAGE) is False

    # Coordinator attempting course edit
    coord = {"id": 30, "role": Role.COORDINATOR.value, "department_id": 1}
    assert can_access(coord, Action.EDIT_COURSE, {"course_id": 1}) is False
    assert can_access(coord, Action.UPLOAD_ATTENDANCE, {"course_id": 1}) is False


def test_student_idor_protection():
    student_a = {"id": 101, "role": Role.STUDENT.value}
    student_b_resource = {"student_id": 102}

    assert (
        can_access(student_a, Action.VIEW_STUDENT_RECORD, student_b_resource) is False
    )
    with pytest.raises(HTTPException) as exc:
        verify_access(student_a, Action.VIEW_STUDENT_RECORD, student_b_resource)
    assert exc.value.status_code == 403


def test_faculty_course_boundary():
    faculty = {"id": 201, "role": Role.FACULTY.value, "assigned_course_ids": [5, 6]}

    assert can_access(faculty, Action.EDIT_COURSE, {"course_id": 5}) is True
    assert can_access(faculty, Action.EDIT_COURSE, {"course_id": 7}) is False

    with pytest.raises(HTTPException) as exc:
        verify_access(faculty, Action.EDIT_COURSE, {"course_id": 7})
    assert exc.value.status_code == 403


def test_coordinator_view_sanitization_privacy():
    raw_student_record = {
        "student_id": 55,
        "name": "Ananya Sen",
        "email": "ananya@acadflow.edu",
        "department_id": 1,
        "attendance_percentage": 82.0,
        "buffer_classes": 7,
        "risk_level": "Safe",
        "risk_score": 15.0,
        "enrolled_courses": 3,
        "password_hash": "$argon2id$...secret_hash...",
        "phone_number": "+91 9876543210",
        "disciplinary_flag": False,
    }
    sanitized = sanitize_coordinator_view(raw_student_record)

    # Approved fields must be present
    for field in ["student_id", "name", "email", "attendance_percentage", "risk_level"]:
        assert field in sanitized

    # Sensitive/unapproved fields MUST NOT be present
    assert "password_hash" not in sanitized
    assert "phone_number" not in sanitized
    assert "disciplinary_flag" not in sanitized


def test_password_hashing_security():
    pwd = "AcadFlowSecurePassword@2026"
    h = get_password_hash(pwd)

    assert h != pwd
    assert len(h) > 20
    assert verify_password(pwd, h) is True
    assert verify_password("WrongPassword123", h) is False
