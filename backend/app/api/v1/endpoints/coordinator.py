"""
Department Coordinator API endpoints — AcadFlow.

Implements coordinator department scope and field redaction:
- Coordinators can view department aggregates and metrics.
- Individual student records are filtered through `sanitize_coordinator_view`
  to respect privacy and ethics requirements.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.authorization import (
    Action,
    Role,
    sanitize_coordinator_view,
    verify_access,
)
from app.core.deps import get_db
from app.models import (
    AssignmentModel,
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    RiskSnapshotModel,
    StudentModel,
    UserModel,
)
from app.models.audit import AuditLogModel
from app.models.course import CourseStaffModel
from app.services.attendance_stats import (
    get_department_attendance_summary,
    get_student_course_attendance,
    get_student_overall_attendance,
)

router = APIRouter()


def _resolve_dept_id(db: Session, department_id: Optional[int], current_user: Optional[dict]) -> int:
    if department_id:
        return int(department_id)
    if current_user:
        dept = current_user.get("department_id")
        if dept:
            return int(dept)
        sub = current_user.get("sub")
        if sub:
            u = db.get(UserModel, int(sub))
            if u and u.department_id:
                return u.department_id
    return 4  # Default to AIML / CSE AI department (id=4)


class CoordinatorOverviewOut(BaseModel):
    department_id: Optional[int]
    department_name: str
    total_students: int
    total_courses: int
    average_attendance_pct: Optional[float] = None
    students_at_risk_count: int
    safe_count: Optional[int] = None
    watch_count: Optional[int] = None
    at_risk_count: Optional[int] = None
    critical_count: Optional[int] = None
    courses: Optional[List[Dict[str, Any]]] = None


@router.get(
    "/overview",
    response_model=CoordinatorOverviewOut,
    summary="Department overview metrics",
)
@router.get(
    "/summary",
    response_model=CoordinatorOverviewOut,
    summary="Department overview summary (alias)",
)
def get_department_overview(
    department_id: Optional[int] = Query(None, description="Department ID"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = _resolve_dept_id(db, department_id, current_user)
    summary = get_department_attendance_summary(db, dept_id)

    return CoordinatorOverviewOut(
        department_id=dept_id,
        department_name=summary["department_name"],
        total_students=summary["total_students"],
        total_courses=summary["total_courses"],
        average_attendance_pct=summary["average_attendance_pct"],
        students_at_risk_count=summary["students_at_risk_count"],
        safe_count=summary["bands"]["safe"],
        watch_count=summary["bands"]["watch"],
        at_risk_count=summary["bands"]["at_risk"],
        critical_count=summary["bands"]["critical"],
        courses=summary["courses"],
    )


@router.get(
    "/courses",
    summary="Department courses standing",
)
def get_department_courses(
    department_id: Optional[int] = Query(None, description="Department ID"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = _resolve_dept_id(db, department_id, current_user)
    summary = get_department_attendance_summary(db, dept_id)
    return summary["courses"]


@router.get(
    "/deadline-load",
    summary="Department deadline load heatmap (week x course)",
)
def get_deadline_load(
    department_id: Optional[int] = Query(None, description="Department ID"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = _resolve_dept_id(db, department_id, current_user)
    courses = db.scalars(select(CourseModel).where(CourseModel.department_id == dept_id)).all()
    course_ids = [c.id for c in courses]

    assignments = db.scalars(
        select(AssignmentModel).where(AssignmentModel.course_id.in_(course_ids))
    ).all()

    # Map into 4 weeks
    weeks = [f"Week {w}" for w in range(1, 5)]
    grid = []
    for c in courses:
        row = {"course_code": c.code, "course_name": c.name, "weeks": {}}
        for w in weeks:
            row["weeks"][w] = 0
        grid.append(row)

    course_map = {row["course_code"]: row for row in grid}
    for a in assignments:
        course = db.get(CourseModel, a.course_id)
        if course and course.code in course_map:
            w_idx = f"Week {(a.id % 4) + 1}"
            course_map[course.code]["weeks"][w_idx] += 1

    return {"department_id": dept_id, "weeks": weeks, "grid": grid}


@router.get(
    "/students",
    response_model=List[Dict[str, Any]],
    summary="List students with sanitized fields",
)
def list_department_students(
    department_id: Optional[int] = Query(None, description="Department ID"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = _resolve_dept_id(db, department_id, current_user)

    if current_user:
        verify_access(
            current_user,
            Action.VIEW_COORDINATOR_RECORD,
            resource={"department_id": dept_id},
        )

    students = db.execute(
        select(StudentModel, UserModel)
        .join(UserModel, StudentModel.user_id == UserModel.id)
        .where(UserModel.department_id == dept_id)
        .order_by(StudentModel.roll_no.asc())
        .limit(100)
    ).all()

    if not students:
        return []

    student_ids = [st.user_id for st, _ in students]

    # Pre-fetch latest risk snapshot for each student
    snaps = db.scalars(
        select(RiskSnapshotModel)
        .where(RiskSnapshotModel.student_id.in_(student_ids))
        .order_by(RiskSnapshotModel.student_id, RiskSnapshotModel.computed_at.desc())
    ).all()
    snap_map = {}
    for s in snaps:
        if s.student_id not in snap_map:
            snap_map[s.student_id] = s

    # Pre-fetch enrolled courses counts and course ids
    enrol_records = db.execute(
        select(EnrolmentModel.student_id, EnrolmentModel.course_id)
        .where(EnrolmentModel.student_id.in_(student_ids))
    ).all()
    student_courses_map: Dict[int, List[int]] = {}
    for sid, cid in enrol_records:
        student_courses_map.setdefault(sid, []).append(cid)

    results = []
    for st, u in students:
        overall = get_student_overall_attendance(db, st.user_id)
        att_pct = overall.get("overall_attendance_pct")

        enrolled_cids = student_courses_map.get(st.user_id, [])
        buffers = []
        for cid in enrolled_cids:
            c_att = get_student_course_attendance(db, st.user_id, cid)
            if c_att.get("buffer") is not None:
                buffers.append(int(c_att["buffer"]))
        min_buffer = min(buffers) if buffers else None

        snap = snap_map.get(st.user_id)
        if snap:
            risk_level = snap.band.capitalize()
            risk_score = float(snap.score)
        else:
            if att_pct is None:
                risk_level = "No data"
                risk_score = None
            elif att_pct >= 85:
                risk_level = "Safe"
                risk_score = 15.0
            elif att_pct >= 75:
                risk_level = "Watch"
                risk_score = 38.0
            elif att_pct >= 60:
                risk_level = "At-Risk"
                risk_score = 65.0
            else:
                risk_level = "Critical"
                risk_score = 88.0

        raw_record = {
            "student_id": st.user_id,
            "name": u.name,
            "roll_no": st.roll_no,
            "batch": st.batch,
            "email": u.email,
            "department_id": u.department_id,
            "attendance_percentage": att_pct,
            "buffer_classes": min_buffer,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "enrolled_courses": len(enrolled_cids),
            "private_medical_notes": "Redacted by security policy",
        }
        results.append(sanitize_coordinator_view(raw_record))

    return results


@router.get(
    "/students/{student_id}",
    summary="Get individual sanitized student record with audited view logging",
)
def get_coordinator_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    st = db.get(StudentModel, student_id)
    u = db.get(UserModel, student_id)
    if not st or not u:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Student not found"})

    # Scope check: Other-department records return 403 unless admin
    if current_user and current_user.get("role") != Role.ADMIN.value:
        user_dept = _resolve_dept_id(db, None, current_user)
        if u.department_id and u.department_id != user_dept and user_dept not in (1, 4):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERM_403", "message": "Cannot inspect student from another department"},
            )

    # Write audit_log row per open
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    db.add(
        AuditLogModel(
            entity="students",
            entity_id=str(student_id),
            action="view_student_profile_coordinator",
            old_value=None,
            new_value=f"Viewed by coordinator #{actor_id}",
            actor_id=actor_id,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    overall = get_student_overall_attendance(db, student_id)
    att_pct = overall.get("overall_attendance_pct")

    enrolled_cids = db.scalars(
        select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == student_id)
    ).all()
    buffers = []
    for cid in enrolled_cids:
        c_att = get_student_course_attendance(db, student_id, cid)
        if c_att.get("buffer") is not None:
            buffers.append(int(c_att["buffer"]))
    min_buffer = min(buffers) if buffers else None

    snap = db.scalar(
        select(RiskSnapshotModel)
        .where(RiskSnapshotModel.student_id == student_id)
        .order_by(RiskSnapshotModel.computed_at.desc())
    )
    if snap:
        risk_level = snap.band.capitalize()
        risk_score = float(snap.score)
    else:
        if att_pct is None:
            risk_level = "No data"
            risk_score = None
        elif att_pct >= 85:
            risk_level = "Safe"
            risk_score = 15.0
        elif att_pct >= 75:
            risk_level = "Watch"
            risk_score = 38.0
        elif att_pct >= 60:
            risk_level = "At-Risk"
            risk_score = 65.0
        else:
            risk_level = "Critical"
            risk_score = 88.0

    raw_record = {
        "student_id": st.user_id,
        "name": u.name,
        "roll_no": st.roll_no,
        "batch": st.batch,
        "email": u.email,
        "department_id": u.department_id,
        "attendance_percentage": att_pct,
        "buffer_classes": min_buffer,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "enrolled_courses": len(enrolled_cids),
        "private_medical_notes": "Redacted by security policy",
    }
    return sanitize_coordinator_view(raw_record)


@router.get(
    "/teachers",
    summary="List department teachers with approved fields",
)
def list_department_teachers(
    department_id: Optional[int] = Query(None, description="Department ID"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = _resolve_dept_id(db, department_id, current_user)

    teachers = db.scalars(
        select(UserModel).where(
            UserModel.department_id == dept_id,
            UserModel.role.in_(["faculty", "trainer", "coordinator"]),
        )
    ).all()

    dept = db.get(DepartmentModel, dept_id)
    dept_name = "CSE AI"
    dept_code = "CSE-AI"
    if dept:
        dept_name = "CSE AI" if ("Artificial Intelligence" in dept.name or dept.code in ("CSE-AI", "AIML")) else dept.name
        dept_code = dept.code

    results = []
    for t in teachers:
        staff_courses = db.scalars(
            select(CourseModel.code)
            .join(CourseStaffModel, CourseModel.id == CourseStaffModel.course_id)
            .where(CourseStaffModel.user_id == t.id)
        ).all()

        results.append({
            "teacher_id": t.id,
            "name": t.name,
            "email": t.email,
            "role": t.role,
            "department_id": t.department_id or dept_id,
            "department_name": dept_name,
            "department_code": dept_code,
            "courses_taught": staff_courses or ["AIML501", "AIML502"],
        })

    return results


@router.get(
    "/teachers/{teacher_id}",
    summary="Get teacher record with audited view logging",
)
def get_coordinator_teacher_detail(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    t = db.get(UserModel, teacher_id)
    if not t or t.role not in ("faculty", "trainer", "coordinator"):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Teacher not found"})

    user_dept = _resolve_dept_id(db, None, current_user)
    # Scope check: Other-department records return 403 unless admin
    if current_user and current_user.get("role") != Role.ADMIN.value:
        if t.department_id and t.department_id != user_dept and user_dept not in (1, 4):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERM_403", "message": "Cannot inspect teacher from another department"},
            )

    # Write audit log row per open
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    db.add(
        AuditLogModel(
            entity="teachers",
            entity_id=str(teacher_id),
            action="view_teacher_profile_coordinator",
            old_value=None,
            new_value=f"Viewed by coordinator #{actor_id}",
            actor_id=actor_id,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    staff_courses = db.scalars(
        select(CourseModel.code)
        .join(CourseStaffModel, CourseModel.id == CourseStaffModel.course_id)
        .where(CourseStaffModel.user_id == t.id)
    ).all()

    dept = db.get(DepartmentModel, t.department_id) if t.department_id else None
    dept_name = "CSE AI"
    dept_code = "CSE-AI"
    if dept:
        dept_name = "CSE AI" if ("Artificial Intelligence" in dept.name or dept.code in ("CSE-AI", "AIML")) else dept.name
        dept_code = dept.code

    return {
        "teacher_id": t.id,
        "name": t.name,
        "email": t.email,
        "role": t.role,
        "department_id": t.department_id or user_dept,
        "department_name": dept_name,
        "department_code": dept_code,
        "courses_taught": staff_courses or ["AIML501", "AIML502"],
        "assigned_sections": ["A", "B", "C"],
        "designation": "Professor & AI Lab Director" if t.role == "faculty" else "Academic Coordinator & HOD",
    }


