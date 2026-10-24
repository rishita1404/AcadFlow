"""
Risk Data Service — AcadFlow Risk Engine (Member 3: Raghav)

Handles all database queries needed to feed the pure calculation functions.
Keeps DB I/O separate from math so calculation functions stay unit-testable.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AssignmentModel,
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    EnrolmentModel,
    RiskConfigModel,
    RiskSnapshotModel,
    SubmissionModel,
)
from app.services.buffer import (
    DEFAULT_THRESHOLD,
    compute_attendance_buffer,
)
from app.services.risk import (
    DEFAULT_RISK_CONFIG,
    RiskConfig,
    RiskScoreResult,
    compute_risk_score,
)

# ──────────────────────────────────────────────────────────────────────────────
# Load RiskConfig from DB (with fallback to defaults)
# ──────────────────────────────────────────────────────────────────────────────


def load_risk_config(db: Session) -> tuple[RiskConfig, Optional[int]]:
    """
    Load the latest risk_config row from the database.

    Returns (RiskConfig dataclass, config_id).
    Falls back to DEFAULT_RISK_CONFIG and None if no row exists.
    """
    row = db.scalars(
        select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1)
    ).first()

    if row is None:
        return DEFAULT_RISK_CONFIG, None

    try:
        config = RiskConfig(
            w_margin=float(row.w_margin),
            w_trend=float(row.w_trend),
            w_deadline=float(row.w_deadline),
            w_missed=float(row.w_missed),
            t_watch=float(row.t_watch),
            t_risk=float(row.t_risk),
            t_critical=float(row.t_critical),
            min_classes=int(row.min_classes),
        )
        return config, row.id
    except (ValueError, TypeError):
        # Corrupt config row; use defaults and do not crash
        return DEFAULT_RISK_CONFIG, None


# ──────────────────────────────────────────────────────────────────────────────
# Attendance data retrieval
# ──────────────────────────────────────────────────────────────────────────────


def get_attendance_inputs(
    db: Session,
    student_id: int,
    course_id: int,
    enrolled_on: Optional[date] = None,
) -> dict:
    """
    Query the database for raw attendance counts for one student / course pair.

    Respects:
    - Mid-semester enrollment (only sessions on/after enrolled_on counted)
    - Cancelled sessions excluded from held count
    - Holidays excluded from remaining count (future sessions)
    - 'present' and 'late' both count as attended (PRD-aligned)

    Returns dict with: held, attended, total_classes, holiday_count, enrollment_date
    """
    # ── Total planned classes ───────────────────────────────────────────────
    course = db.get(CourseModel, course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found.")
    total_classes = course.total_classes

    # ── Enrollment date guard ───────────────────────────────────────────────
    if enrolled_on is None:
        enrolment = db.scalar(
            select(EnrolmentModel).where(
                EnrolmentModel.student_id == student_id,
                EnrolmentModel.course_id == course_id,
            )
        )
        enrolled_on = enrolment.enrolled_on if enrolment else None

    # ── Sessions held (not cancelled, on/after enrolled_on if set) ──────────
    held_query = select(func.count(ClassSessionModel.id)).where(
        ClassSessionModel.course_id == course_id,
        ClassSessionModel.is_cancelled == False,  # noqa: E712
    )
    if enrolled_on:
        held_query = held_query.where(ClassSessionModel.held_on >= enrolled_on)
    held: int = db.scalar(held_query) or 0

    # ── Sessions attended (present or late) ─────────────────────────────────
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

    # ── Holiday count (future sessions only — already-held holidays don't
    #    affect remaining).  Approximate: count holidays in semester after today.
    from app.models.course import HolidayModel  # avoid circular at module level

    today = date.today()
    holiday_count_q = select(func.count(HolidayModel.id)).where(
        HolidayModel.semester_id == course.semester_id,
        HolidayModel.holiday_date > today,
    )
    holiday_count: int = db.scalar(holiday_count_q) or 0

    return {
        "held": held,
        "attended": attended,
        "total_classes": total_classes,
        "holiday_count": holiday_count,
        "enrolled_on": enrolled_on,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Attendance slope (trend)
# ──────────────────────────────────────────────────────────────────────────────


def get_attendance_slope(
    db: Session,
    student_id: int,
    course_id: int,
    weeks: int = 2,
) -> Optional[float]:
    """
    Compute the attendance % change per week over the last `weeks` weeks.

    Returns None when fewer than `weeks` weeks of data are available.
    """
    today = date.today()
    cutoff = today - timedelta(weeks=weeks)

    # Sessions in last N weeks
    recent_sessions = db.scalars(
        select(ClassSessionModel)
        .where(
            ClassSessionModel.course_id == course_id,
            ClassSessionModel.is_cancelled == False,  # noqa: E712
            ClassSessionModel.held_on >= cutoff,
            ClassSessionModel.held_on <= today,
        )
        .order_by(ClassSessionModel.held_on)
    ).all()

    if len(recent_sessions) < 2:
        return None

    # Build weekly attendance %
    weekly: dict[int, list[bool]] = {}
    session_ids = [s.id for s in recent_sessions]
    records = db.scalars(
        select(AttendanceRecordModel).where(
            AttendanceRecordModel.session_id.in_(session_ids),
            AttendanceRecordModel.student_id == student_id,
        )
    ).all()
    record_map = {r.session_id: r.status for r in records}

    for s in recent_sessions:
        week_num = (s.held_on - cutoff).days // 7
        weekly.setdefault(week_num, [])
        weekly[week_num].append(record_map.get(s.id, "absent") in ("present", "late"))

    week_keys = sorted(weekly.keys())
    if len(week_keys) < 2:
        return None

    pcts = [(sum(weekly[wk]) / len(weekly[wk])) * 100 for wk in week_keys]
    # Simple slope: (last_pct - first_pct) / num_intervals
    slope = (pcts[-1] - pcts[0]) / (len(pcts) - 1)
    return round(slope, 2)


# ──────────────────────────────────────────────────────────────────────────────
# Deadline and missed-submission counts
# ──────────────────────────────────────────────────────────────────────────────


def get_submission_inputs(
    db: Session,
    student_id: int,
    course_id: int,
) -> dict:
    """
    Return upcoming unsubmitted deadline count and missed submission stats.
    """
    now = datetime.now(timezone.utc)
    deadline_cutoff = now + timedelta(days=14)

    # Assignments for this course
    assignment_ids = db.scalars(
        select(AssignmentModel.id).where(
            AssignmentModel.course_id == course_id,
            AssignmentModel.is_published == True,  # noqa: E712
        )
    ).all()

    if not assignment_ids:
        return {
            "upcoming_deadline_count": 0,
            "missed_count": 0,
            "total_submissions": 0,
        }

    # Existing submissions for this student
    submissions = db.scalars(
        select(SubmissionModel).where(
            SubmissionModel.assignment_id.in_(assignment_ids),
            SubmissionModel.student_id == student_id,
        )
    ).all()
    submitted_assignment_ids = {s.assignment_id for s in submissions}

    # Upcoming unsubmitted: published, due within 14 days, not submitted
    upcoming = db.scalars(
        select(AssignmentModel).where(
            AssignmentModel.id.in_(assignment_ids),
            AssignmentModel.due_at > now,
            AssignmentModel.due_at <= deadline_cutoff,
        )
    ).all()
    upcoming_deadline_count = sum(
        1 for a in upcoming if a.id not in submitted_assignment_ids
    )

    # Missed submissions
    missed_count = sum(1 for s in submissions if s.status == "missed")
    total_submissions = len(submissions)

    return {
        "upcoming_deadline_count": upcoming_deadline_count,
        "missed_count": missed_count,
        "total_submissions": total_submissions,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Full risk calculation for one student / course
# ──────────────────────────────────────────────────────────────────────────────


def calculate_student_course_risk(
    db: Session,
    student_id: int,
    course_id: int,
    config: Optional[RiskConfig] = None,
    config_id: Optional[int] = None,
) -> dict:
    """
    Orchestrate data retrieval + calculation for one student in one course.

    Returns a dict suitable for serialising to the API or persisting as a
    RiskSnapshotModel row.
    """
    if config is None:
        config, config_id = load_risk_config(db)

    # ── Attendance inputs ───────────────────────────────────────────────────
    att = get_attendance_inputs(db, student_id, course_id)
    buf_result = compute_attendance_buffer(
        attended=att["attended"],
        held=att["held"],
        total_classes=att["total_classes"],
        threshold=DEFAULT_THRESHOLD,
        min_classes=config.min_classes,
        holiday_count=att["holiday_count"],
    )

    # ── Trend ───────────────────────────────────────────────────────────────
    slope = get_attendance_slope(db, student_id, course_id)

    # ── Deadlines / missed subs ─────────────────────────────────────────────
    sub_inputs = get_submission_inputs(db, student_id, course_id)

    # ── Risk score ──────────────────────────────────────────────────────────
    result: RiskScoreResult = compute_risk_score(
        buffer=buf_result["buffer"],
        remaining=buf_result["remaining"] or 0,
        attendance_slope=slope,
        upcoming_deadline_count=sub_inputs["upcoming_deadline_count"],
        missed_count=sub_inputs["missed_count"],
        total_submissions=sub_inputs["total_submissions"],
        insufficient_data=buf_result["insufficient_data"],
        config=config,
    )

    return {
        "student_id": student_id,
        "course_id": course_id,
        "config_id": config_id,
        # buffer info
        "held": att["held"],
        "attended": att["attended"],
        "total_classes": att["total_classes"],
        "required": buf_result["required"],
        "still_need": buf_result["still_need"],
        "remaining": buf_result["remaining"],
        "buffer": buf_result["buffer"],
        "attendance_pct": buf_result["attendance_pct"],
        "holiday_count": att["holiday_count"],
        # status
        "insufficient_data": result.insufficient_data,
        "status_message": buf_result["status_message"],
        # risk score
        "score": result.score,
        "band": result.band,
        "margin_points": result.margin_points,
        "trend_points": result.trend_points,
        "deadline_points": result.deadline_points,
        "missed_points": result.missed_points,
        "factors": result.factors,
        "computed_at": datetime.now(timezone.utc),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Persist snapshot
# ──────────────────────────────────────────────────────────────────────────────


def persist_risk_snapshot(
    db: Session,
    student_id: int,
    course_id: int,
) -> dict:
    """
    Recalculate risk for a student/course and save a RiskSnapshotModel row.

    Used by the attendance update endpoint and the risk worker.
    Returns the full calculation dict.
    """
    config, config_id = load_risk_config(db)
    data = calculate_student_course_risk(
        db, student_id, course_id, config=config, config_id=config_id
    )

    if not data["insufficient_data"] and data["score"] is not None:
        from decimal import Decimal

        snapshot = RiskSnapshotModel(
            student_id=student_id,
            computed_at=data["computed_at"],
            score=Decimal(str(data["score"])),
            band=data["band"],
            worst_course_id=course_id,
            config_id=config_id,
        )
        db.add(snapshot)
        db.commit()

    return data
