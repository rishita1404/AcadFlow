"""
Single Source of Truth for Attendance Statistics — AcadFlow.

Provides unified, authoritative attendance calculations for:
- Student course attendance & buffer
- Student overall attendance
- Course attendance summary
- Department attendance summary

Rounding & No-Data Rule:
- attendance_pct = round((attended / held) * 100, 1)
- None when held == 0 or below minimum-evidence limit (insufficient data).
- NEVER defaults to 100.0.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    RiskConfigModel,
    RiskSnapshotModel,
    StudentModel,
    UserModel,
)
from app.services.buffer import DEFAULT_MIN_CLASSES, DEFAULT_THRESHOLD


def _get_min_classes(db: Session, override: Optional[int] = None) -> int:
    if override is not None:
        return override
    cfg = db.scalar(select(RiskConfigModel).limit(1))
    return int(cfg.min_classes) if cfg and cfg.min_classes is not None else DEFAULT_MIN_CLASSES


def get_student_course_attendance(
    db: Session,
    student_id: int,
    course_id: int,
    min_classes: Optional[int] = None,
) -> Dict[str, Optional[float | int | bool | str]]:
    """
    Compute authoritative attendance and buffer statistics for one student in one course.

    Reads ONLY from class_sessions and attendance_records tables.
    Returns:
        held, attended, attendance_pct, buffer, required, still_need,
        remaining, insufficient_data, total_classes, status_message
    """
    course = db.get(CourseModel, course_id)
    total_classes = course.total_classes if course and course.total_classes else 45

    enrolment = db.scalar(
        select(EnrolmentModel).where(
            EnrolmentModel.student_id == student_id,
            EnrolmentModel.course_id == course_id,
        )
    )
    enrolled_on = enrolment.enrolled_on if enrolment else None

    # Count conducted, non-cancelled sessions
    held_query = select(func.count(ClassSessionModel.id)).where(
        ClassSessionModel.course_id == course_id,
        ClassSessionModel.is_cancelled == False,  # noqa: E712
    )
    if enrolled_on:
        held_query = held_query.where(ClassSessionModel.held_on >= enrolled_on)
    held: int = db.scalar(held_query) or 0

    # Count attended sessions (present or late)
    attended_query = (
        select(func.count(AttendanceRecordModel.id))
        .join(
            ClassSessionModel,
            AttendanceRecordModel.session_id == ClassSessionModel.id,
        )
        .where(
            ClassSessionModel.course_id == course_id,
            ClassSessionModel.is_cancelled == False,  # noqa: E712
            AttendanceRecordModel.student_id == student_id,
            AttendanceRecordModel.status.in_(["present", "late"]),
        )
    )
    if enrolled_on:
        attended_query = attended_query.where(ClassSessionModel.held_on >= enrolled_on)
    attended: int = db.scalar(attended_query) or 0

    min_required_sessions = _get_min_classes(db, min_classes)

    required = math.ceil(DEFAULT_THRESHOLD * total_classes)
    remaining = max(0, total_classes - held)

    # Minimum evidence rule: held < min_classes or held == 0 -> insufficient data
    if held < min_required_sessions or held == 0:
        return {
            "held": held,
            "attended": attended,
            "attendance_pct": None,
            "buffer": None,
            "required": required,
            "still_need": None,
            "remaining": remaining,
            "insufficient_data": True,
            "total_classes": total_classes,
            "status_message": "Not enough data yet",
        }

    still_need = max(0, required - attended)
    buffer = remaining - still_need
    attendance_pct = round((attended / held) * 100, 1)

    if buffer < 0:
        status_message = "Not recoverable by attendance alone"
    elif buffer == 0:
        status_message = "Cannot miss any more classes"
    else:
        status_message = f"Can miss up to {buffer} more class(es)"

    return {
        "held": held,
        "attended": attended,
        "attendance_pct": attendance_pct,
        "buffer": buffer,
        "required": required,
        "still_need": still_need,
        "remaining": remaining,
        "insufficient_data": False,
        "total_classes": total_classes,
        "status_message": status_message,
    }


def get_student_overall_attendance(
    db: Session,
    student_id: int,
    min_classes: Optional[int] = None,
) -> Dict[str, Optional[float | int | bool]]:
    """
    Compute overall attendance across all enrolled courses for a student.

    Returns:
        total_held, total_attended, overall_attendance_pct, insufficient_data
    """
    enrolled_courses = db.scalars(
        select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == student_id)
    ).all()

    if not enrolled_courses:
        return {
            "total_held": 0,
            "total_attended": 0,
            "overall_attendance_pct": None,
            "insufficient_data": True,
        }

    total_held = 0
    total_attended = 0
    any_course_has_data = False

    for cid in enrolled_courses:
        stats = get_student_course_attendance(db, student_id, cid, min_classes=min_classes)
        total_held += int(stats["held"] or 0)
        total_attended += int(stats["attended"] or 0)
        if stats["attendance_pct"] is not None:
            any_course_has_data = True

    if total_held == 0 or not any_course_has_data:
        return {
            "total_held": total_held,
            "total_attended": total_attended,
            "overall_attendance_pct": None,
            "insufficient_data": True,
        }

    overall_pct = round((total_attended / total_held) * 100, 1)
    return {
        "total_held": total_held,
        "total_attended": total_attended,
        "overall_attendance_pct": overall_pct,
        "insufficient_data": False,
    }


def get_course_attendance_summary(db: Session, course_id: int) -> Dict[str, Optional[int | float]]:
    """
    Course average = mean of per-student attendance_pct over enrolled students that have data.

    Returns:
        {enrolled, students_with_data, avg_attendance_pct}
    """
    enrolled_student_ids = db.scalars(
        select(EnrolmentModel.student_id).where(EnrolmentModel.course_id == course_id)
    ).all()

    enrolled = len(enrolled_student_ids)
    if enrolled == 0:
        return {
            "course_id": course_id,
            "enrolled": 0,
            "students_with_data": 0,
            "avg_attendance_pct": None,
        }

    student_pcts: List[float] = []
    for sid in enrolled_student_ids:
        stats = get_student_course_attendance(db, sid, course_id)
        pct = stats.get("attendance_pct")
        if pct is not None:
            student_pcts.append(float(pct))

    students_with_data = len(student_pcts)
    avg_attendance_pct = (
        round(sum(student_pcts) / students_with_data, 1)
        if students_with_data > 0
        else None
    )

    return {
        "course_id": course_id,
        "enrolled": enrolled,
        "students_with_data": students_with_data,
        "avg_attendance_pct": avg_attendance_pct,
    }


def batch_get_students_attendance(
    db: Session,
    student_ids: List[int],
    min_classes: Optional[int] = None,
) -> Dict[int, Dict[str, Any]]:
    """
    Batch compute authoritative attendance and buffer statistics for multiple students.
    Uses bulk queries to prevent N+1 query patterns while strictly preserving
    the exact same formulas as get_student_course_attendance and get_student_overall_attendance.
    """
    if not student_ids:
        return {}

    min_required_sessions = _get_min_classes(db, min_classes)

    # 1. Fetch enrolments for these students
    enrolments = db.scalars(
        select(EnrolmentModel).where(EnrolmentModel.student_id.in_(student_ids))
    ).all()

    student_enrolments: Dict[int, List[EnrolmentModel]] = {sid: [] for sid in student_ids}
    course_ids = set()
    for e in enrolments:
        student_enrolments.setdefault(e.student_id, []).append(e)
        course_ids.add(e.course_id)

    # 2. Fetch courses total_classes
    courses = db.scalars(select(CourseModel).where(CourseModel.id.in_(course_ids))).all() if course_ids else []
    course_total_classes = {c.id: (c.total_classes if c.total_classes else 45) for c in courses}

    # 3. Fetch non-cancelled sessions for these courses
    sessions = db.scalars(
        select(ClassSessionModel).where(
            ClassSessionModel.course_id.in_(course_ids),
            ClassSessionModel.is_cancelled == False,  # noqa: E712
        )
    ).all() if course_ids else []

    course_sessions: Dict[int, List[ClassSessionModel]] = {}
    session_ids = set()
    for s in sessions:
        course_sessions.setdefault(s.course_id, []).append(s)
        session_ids.add(s.id)

    # 4. Fetch attendance records for these students and sessions
    records = db.scalars(
        select(AttendanceRecordModel).where(
            AttendanceRecordModel.student_id.in_(student_ids),
            AttendanceRecordModel.session_id.in_(session_ids),
            AttendanceRecordModel.status.in_(["present", "late"]),
        )
    ).all() if session_ids else []

    student_attended_sessions: Dict[int, set] = {sid: set() for sid in student_ids}
    for r in records:
        student_attended_sessions.setdefault(r.student_id, set()).add(r.session_id)

    results: Dict[int, Dict[str, Any]] = {}

    for sid in student_ids:
        enrol_list = student_enrolments.get(sid, [])
        if not enrol_list:
            results[sid] = {
                "overall_attendance_pct": None,
                "total_held": 0,
                "total_attended": 0,
                "min_buffer": None,
                "enrolled_course_ids": [],
                "course_stats": {},
            }
            continue

        total_held = 0
        total_attended = 0
        any_course_has_data = False
        buffers: List[int] = []
        course_stats: Dict[int, Dict[str, Any]] = {}
        enrolled_cids: List[int] = []

        attended_session_set = student_attended_sessions.get(sid, set())

        for enrolment in enrol_list:
            cid = enrolment.course_id
            enrolled_cids.append(cid)
            tot_cls = course_total_classes.get(cid, 45)
            enrolled_on = enrolment.enrolled_on

            all_sessions = course_sessions.get(cid, [])
            if enrolled_on:
                held_sessions = [s for s in all_sessions if s.held_on >= enrolled_on]
            else:
                held_sessions = all_sessions

            held = len(held_sessions)
            held_sids = {s.id for s in held_sessions}
            attended = len(attended_session_set.intersection(held_sids))

            total_held += held
            total_attended += attended

            required = math.ceil(DEFAULT_THRESHOLD * tot_cls)
            remaining = max(0, tot_cls - held)

            if held < min_required_sessions or held == 0:
                course_stats[cid] = {
                    "held": held,
                    "attended": attended,
                    "attendance_pct": None,
                    "buffer": None,
                    "insufficient_data": True,
                }
            else:
                any_course_has_data = True
                still_need = max(0, required - attended)
                buf = remaining - still_need
                pct = round((attended / held) * 100, 1)
                buffers.append(buf)
                course_stats[cid] = {
                    "held": held,
                    "attended": attended,
                    "attendance_pct": pct,
                    "buffer": buf,
                    "insufficient_data": False,
                }

        if total_held == 0 or not any_course_has_data:
            overall_pct = None
        else:
            overall_pct = round((total_attended / total_held) * 100, 1)

        min_buffer = min(buffers) if buffers else None

        results[sid] = {
            "overall_attendance_pct": overall_pct,
            "total_held": total_held,
            "total_attended": total_attended,
            "min_buffer": min_buffer,
            "enrolled_course_ids": enrolled_cids,
            "course_stats": course_stats,
        }

    return results


def get_department_attendance_summary(db: Session, department_id: int) -> Dict:
    """
    Aggregates department-wide attendance, risk breakdown, and course standings.
    Reads exclusively from real database records using batch processing.
    """
    dept = db.get(DepartmentModel, department_id)
    dept_name = "CSE AI"
    if dept:
        dept_name = (
            "CSE AI"
            if ("Artificial Intelligence" in dept.name or dept.code in ("CSE-AI", "AIML"))
            else dept.name
        )

    # Department students
    student_rows = db.scalars(
        select(StudentModel.user_id)
        .join(UserModel, StudentModel.user_id == UserModel.id)
        .where(UserModel.department_id == department_id)
    ).all()
    total_students = len(student_rows)

    # Department courses
    courses = db.scalars(
        select(CourseModel).where(CourseModel.department_id == department_id)
    ).all()
    total_courses = len(courses)

    # Calculate per-course standings and batch student stats
    batch_stats = batch_get_students_attendance(db, student_rows)

    # Pre-fetch latest risk snapshot for each student
    snaps = db.scalars(
        select(RiskSnapshotModel)
        .where(RiskSnapshotModel.student_id.in_(student_rows))
        .order_by(RiskSnapshotModel.student_id, RiskSnapshotModel.computed_at.desc())
    ).all() if student_rows else []
    snap_map: Dict[int, RiskSnapshotModel] = {}
    for s in snaps:
        if s.student_id not in snap_map:
            snap_map[s.student_id] = s

    course_standings = []
    for c in courses:
        c_pcts = []
        c_enrolled = 0
        for sid in student_rows:
            st_data = batch_stats.get(sid, {})
            c_data = st_data.get("course_stats", {}).get(c.id)
            if c_data is not None:
                c_enrolled += 1
                if c_data["attendance_pct"] is not None:
                    c_pcts.append(c_data["attendance_pct"])
        avg_pct = round(sum(c_pcts) / len(c_pcts), 1) if c_pcts else None
        course_standings.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "enrolled_count": c_enrolled,
            "students_with_data": len(c_pcts),
            "avg_attendance": avg_pct,
        })

    # Calculate per-student overall attendance and bands
    student_pcts: List[float] = []
    safe_count = 0
    watch_count = 0
    at_risk_count = 0
    critical_count = 0

    for sid in student_rows:
        overall = batch_stats.get(sid, {})
        pct = overall.get("overall_attendance_pct")
        if pct is not None:
            student_pcts.append(float(pct))

        # Check latest risk snapshot band
        snap = snap_map.get(sid)
        band = snap.band.lower() if snap else ""
        if "critical" in band:
            critical_count += 1
        elif "risk" in band or "at-risk" in band:
            at_risk_count += 1
        elif "watch" in band:
            watch_count += 1
        elif "safe" in band:
            safe_count += 1
        else:
            # Fallback based on attendance if no snapshot exists
            if pct is None:
                pass
            elif pct >= 85:
                safe_count += 1
            elif pct >= 75:
                watch_count += 1
            elif pct >= 60:
                at_risk_count += 1
            else:
                critical_count += 1

    students_at_risk_count = at_risk_count + critical_count
    avg_attendance_pct = (
        round(sum(student_pcts) / len(student_pcts), 1)
        if student_pcts
        else None
    )

    return {
        "department_id": department_id,
        "department_name": dept_name,
        "total_students": total_students,
        "total_courses": total_courses,
        "average_attendance_pct": avg_attendance_pct,
        "students_at_risk_count": students_at_risk_count,
        "bands": {
            "safe": safe_count,
            "watch": watch_count,
            "at_risk": at_risk_count,
            "critical": critical_count,
        },
        "courses": course_standings,
    }
