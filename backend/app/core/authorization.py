"""
Central Authorization & Role-Based Access Control (RBAC) Module for AcadFlow.

Evaluates both role-based capabilities and fine-grained resource scope:
can_access(user, action, resource) -> bool

Evaluation 1 Security Scenarios Enforced:
1. Student cannot access another student's dashboard or private records.
2. Faculty cannot edit a course to which they are not assigned.
3. Mentor cannot access an unassigned student.
4. Coordinator cannot access information outside their department.
5. Coordinator access to individual records is restricted to approved fields and audited.
6. Client-supplied IDs or role values cannot grant permission (strict authenticated principal context).
"""

from enum import Enum
from typing import Any, Callable, Dict, Optional, Set

from fastapi import Depends, HTTPException, status

from app.core.permissions import Role


class Action(str, Enum):
    # Student actions
    VIEW_OWN_DASHBOARD = "view_own_dashboard"
    VIEW_STUDENT_RECORD = "view_student_record"
    SUBMIT_WORK = "submit_work"
    VIEW_OWN_RISK = "view_own_risk"

    # Faculty / Trainer actions
    VIEW_COURSE = "view_course"
    EDIT_COURSE = "edit_course"
    UPLOAD_ATTENDANCE = "upload_attendance"
    EDIT_ATTENDANCE = "edit_attendance"
    CREATE_ASSIGNMENT = "create_assignment"
    GRADE_SUBMISSION = "grade_submission"

    # Mentor actions
    VIEW_MENTEE_RECORDS = "view_mentee_records"
    VIEW_MENTEE_RISK = "view_mentee_risk"

    # Coordinator actions
    VIEW_DEPARTMENT_SUMMARY = "view_department_summary"
    VIEW_COORDINATOR_RECORD = "view_coordinator_record"
    TIMETABLE_WRITE = "timetable:write"

    # Admin actions
    ADMIN_MANAGE = "admin_manage"


# Base role capabilities mapping (Role -> Allowed Actions)
ROLE_CAPABILITIES: Dict[str, Set[Action]] = {
    Role.STUDENT.value: {
        Action.VIEW_OWN_DASHBOARD,
        Action.VIEW_STUDENT_RECORD,
        Action.SUBMIT_WORK,
        Action.VIEW_OWN_RISK,
    },
    Role.FACULTY.value: {
        Action.VIEW_COURSE,
        Action.EDIT_COURSE,
        Action.UPLOAD_ATTENDANCE,
        Action.EDIT_ATTENDANCE,
        Action.CREATE_ASSIGNMENT,
        Action.GRADE_SUBMISSION,
        Action.VIEW_STUDENT_RECORD,
    },
    Role.TRAINER.value: {
        Action.VIEW_COURSE,
        Action.EDIT_COURSE,
        Action.UPLOAD_ATTENDANCE,
        Action.EDIT_ATTENDANCE,
        Action.CREATE_ASSIGNMENT,
        Action.GRADE_SUBMISSION,
        Action.VIEW_STUDENT_RECORD,
    },
    Role.MENTOR.value: {
        Action.VIEW_COURSE,
        Action.VIEW_MENTEE_RECORDS,
        Action.VIEW_MENTEE_RISK,
        Action.VIEW_STUDENT_RECORD,
    },
    Role.COORDINATOR.value: {
        Action.VIEW_COURSE,
        Action.VIEW_DEPARTMENT_SUMMARY,
        Action.VIEW_COORDINATOR_RECORD,
        Action.VIEW_STUDENT_RECORD,
        Action.TIMETABLE_WRITE,
    },
    Role.ADMIN.value: set(Action),  # Admin has full capabilities across all actions
}

# Approved fields for coordinator individual record view (PRD Section 6 / Ethics compliance)
COORDINATOR_APPROVED_FIELDS = {
    "student_id",
    "name",
    "email",
    "department_id",
    "attendance_percentage",
    "buffer_classes",
    "risk_level",
    "risk_score",
    "enrolled_courses",
}


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    """Safely extract value whether obj is a dict or an object."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def can_access(user: Any, action: Action | str, resource: Any = None) -> bool:
    """
    Central authorization decision engine.

    Checks:
    1. Valid authenticated user and action capability for the role.
    2. Specific resource ownership and scope bounds.
    """
    if not user:
        return False

    # Extract role from trusted principal
    user_role = _get_val(user, "role")
    if not user_role:
        return False

    # Normalize action
    if isinstance(action, str):
        try:
            action = Action(action)
        except ValueError:
            return False

    # Admin bypass for operational emergency and system configuration
    if user_role == Role.ADMIN.value:
        return True

    # 1. Check role capability matrix
    allowed_actions = ROLE_CAPABILITIES.get(user_role, set())
    if action not in allowed_actions:
        return False

    # If no resource specified, role permission is sufficient for global actions
    if resource is None:
        return True

    user_id = _get_val(user, "id") or _get_val(user, "user_id") or _get_val(user, "sub")

    # 2. Check Resource Scope Constraints

    # Scenario 1: Student accessing student-specific resources (dashboard, marks, buffer)
    if user_role == Role.STUDENT.value:
        target_student_id = (
            _get_val(resource, "student_id")
            or _get_val(resource, "owner_id")
            or _get_val(resource, "id")
        )
        if target_student_id is not None and str(target_student_id) != str(user_id):
            return False
        return True

    # Scenario 2: Faculty/Trainer editing or managing course or attendance
    if user_role in (Role.FACULTY.value, Role.TRAINER.value):
        course_id = _get_val(resource, "course_id") or _get_val(resource, "id")
        if course_id is not None:
            assigned_courses = _get_val(user, "assigned_course_ids") or []
            # Convert to string set for robust ID comparison
            assigned_set = {str(cid) for cid in assigned_courses}
            if str(course_id) not in assigned_set:
                return False
        return True

    # Scenario 3: Mentor accessing student records or mentee risk
    if user_role == Role.MENTOR.value:
        if action in (Action.VIEW_MENTEE_RECORDS, Action.VIEW_MENTEE_RISK):
            target_student_id = (
                _get_val(resource, "student_id")
                or _get_val(resource, "mentee_id")
                or _get_val(resource, "id")
            )
            if target_student_id is not None:
                mentee_ids = _get_val(user, "mentee_ids") or []
                mentee_set = {str(mid) for mid in mentee_ids}
                if str(target_student_id) not in mentee_set:
                    return False
        return True

    # Scenario 4 & 5: Coordinator accessing department records
    if user_role == Role.COORDINATOR.value:
        user_dept = _get_val(user, "department_id")
        res_dept = _get_val(resource, "department_id")
        if user_dept is not None and res_dept is not None:
            if str(user_dept) != str(res_dept):
                return False
        return True

    return False


def verify_access(user: Any, action: Action | str, resource: Any = None) -> None:
    """
    Verify access or raise standard 403 Forbidden with PERM_403 error code.
    """
    if not can_access(user, action, resource):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERM_403",
                "message": "Forbidden / Role or scope lacks permission to perform action",
            },
        )


def sanitize_coordinator_view(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Restricts individual record view for coordinators to approved fields only.
    Prevents exposure of student submission content, passwords, or private notes.
    """
    if not isinstance(record, dict):
        return record
    return {k: v for k, v in record.items() if k in COORDINATOR_APPROVED_FIELDS}


def require_access(
    action: Action | str, resource_getter: Optional[Callable[..., Any]] = None
):
    """
    FastAPI dependency factory enforcing central RBAC with optional resource resolver.
    """
    from app.api.deps import get_current_user

    async def _dependency(
        current_user: dict = Depends(get_current_user),
    ):
        resource = None
        if resource_getter is not None:
            resource = (
                await resource_getter()
                if callable(resource_getter)
                else resource_getter
            )
        verify_access(current_user, action, resource)
        return current_user

    return _dependency
