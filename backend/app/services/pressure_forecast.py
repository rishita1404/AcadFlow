"""
Academic Pressure Forecast Service — AcadFlow

Generates a per-day "pressure score" (0–100) for a student over a given month.
Used to render the calendar heatmap and academic pressure dashboard.

Pressure score components:
  1. Deadline pressure  (0–45): weight × urgency of upcoming assignments
  2. Attendance risk    (0–30): days the student MUST attend to stay safe
  3. Exam proximity     (0–25): how close an exam-type assignment is

The heatmap also returns:
  - attendance_necessity: whether missing a class that day would be dangerous
  - day_label: 'exam' | 'deadline' | 'class' | 'holiday' | 'weekend'
  - warnings: list of human-readable string warnings for that day
"""

from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AssignmentModel,
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    EnrolmentModel,
    HolidayModel,
    StudentHolidayModel,
    SubmissionModel,
)
from app.services.buffer import DEFAULT_THRESHOLD, compute_attendance_buffer
from app.services.risk_data import get_attendance_inputs, load_risk_config

# ─────────────────────────────────────────────────────────────────────────────
# Output schemas (dataclasses — serialized to dict for the API)
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class DayPressure:
    """Pressure breakdown for a single calendar day."""

    date: str                        # ISO format: YYYY-MM-DD
    pressure_score: float            # 0–100
    deadline_pressure: float         # 0–45
    attendance_pressure: float       # 0–30
    exam_pressure: float             # 0–25
    day_type: str                    # 'exam' | 'deadline' | 'class' | 'holiday' | 'weekend' | 'free'
    must_attend: bool                # True → missing this class is dangerous
    assignments_due: List[Dict]      # list of {id, title, kind, course_code, grace_hours}
    has_class: bool                  # True if any enrolled course has a session this day
    attendance_record: Optional[str] # 'present' | 'absent' | 'late' | None (no session)
    is_student_holiday: bool         # Student marked this as planned absence
    is_institution_holiday: bool     # Institution holiday
    warnings: List[str]              # Human-readable warnings


@dataclass
class MonthlyPressureSummary:
    """Aggregated summary for the pressure forecast dashboard."""

    year: int
    month: int
    avg_pressure_score: float
    max_pressure_score: float
    max_pressure_date: str
    high_pressure_days: int          # days where score > 60
    critical_days: int               # days where score > 80
    total_deadlines: int
    total_exams: int
    must_attend_days: int            # days where missing class is dangerous
    days: List[DayPressure]


# ─────────────────────────────────────────────────────────────────────────────
# Core computation
# ─────────────────────────────────────────────────────────────────────────────


def compute_monthly_pressure(
    db: Session,
    student_id: int,
    year: int,
    month: int,
) -> MonthlyPressureSummary:
    """
    Compute the full monthly academic pressure forecast for a student.

    Parameters
    ----------
    db         : active SQLAlchemy session
    student_id : student's user_id
    year       : calendar year (e.g. 2026)
    month      : calendar month (1–12)

    Returns
    -------
    MonthlyPressureSummary with per-day breakdowns
    """
    # ── Date range ────────────────────────────────────────────────────────────
    first_day = date(year, month, 1)
    last_day_num = monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)

    # ── Student enrollments (or courses taught if user is staff) ─────────────
    enrolled_course_ids: list[int] = list(
        db.scalars(
            select(EnrolmentModel.course_id).where(
                EnrolmentModel.student_id == student_id
            )
        ).all()
    )
    if not enrolled_course_ids:
        from app.models.course import CourseStaffModel
        enrolled_course_ids = list(
            db.scalars(
                select(CourseStaffModel.course_id).where(
                    CourseStaffModel.user_id == student_id
                )
            ).all()
        )
    if not enrolled_course_ids:
        enrolled_course_ids = list(db.scalars(select(CourseModel.id)).all())

    from app.models.user import StudentModel
    is_staff = db.get(StudentModel, student_id) is None

    # ── Pre-fetch data for the month ──────────────────────────────────────────

    # Assignments due in this month (+ 1 week look-ahead for urgency)
    look_ahead = last_day + timedelta(days=7)
    assignments = db.scalars(
        select(AssignmentModel).where(
            AssignmentModel.course_id.in_(enrolled_course_ids),
            AssignmentModel.is_published == True,  # noqa: E712
            AssignmentModel.due_at >= datetime(year, month, 1, tzinfo=timezone.utc) - timedelta(days=1),
            AssignmentModel.due_at <= datetime(look_ahead.year, look_ahead.month, look_ahead.day, tzinfo=timezone.utc),
        )
    ).all()

    # Course lookup
    courses: dict[int, CourseModel] = {}
    for cid in enrolled_course_ids:
        c = db.get(CourseModel, cid)
        if c:
            courses[cid] = c

    # Existing submissions
    asgn_ids = [a.id for a in assignments]
    submissions = db.scalars(
        select(SubmissionModel).where(
            SubmissionModel.assignment_id.in_(asgn_ids),
            SubmissionModel.student_id == student_id,
        )
    ).all()
    submitted_map: dict[int, str] = {s.assignment_id: s.status for s in submissions}

    # Class sessions this month
    sessions = db.scalars(
        select(ClassSessionModel).where(
            ClassSessionModel.course_id.in_(enrolled_course_ids),
            ClassSessionModel.held_on >= first_day,
            ClassSessionModel.held_on <= last_day,
            ClassSessionModel.is_cancelled == False,  # noqa: E712
        )
    ).all()
    # Map date → list of session ids
    session_map: dict[date, list[int]] = {}
    for s in sessions:
        session_map.setdefault(s.held_on, []).append(s.id)

    # Attendance records for those sessions
    all_session_ids = [s.id for s in sessions]
    records = db.scalars(
        select(AttendanceRecordModel).where(
            AttendanceRecordModel.student_id == student_id,
            AttendanceRecordModel.session_id.in_(all_session_ids),
        )
    ).all()
    record_map: dict[int, str] = {r.session_id: r.status for r in records}

    # Institution holidays this month (from all semesters)
    inst_holidays_rows = db.scalars(
        select(HolidayModel).where(
            HolidayModel.holiday_date >= first_day,
            HolidayModel.holiday_date <= last_day,
        )
    ).all()
    inst_holiday_dates: set[date] = {h.holiday_date for h in inst_holidays_rows}

    # Student-planned holidays this month
    student_holidays_rows = db.scalars(
        select(StudentHolidayModel).where(
            StudentHolidayModel.student_id == student_id,
            StudentHolidayModel.holiday_date >= first_day,
            StudentHolidayModel.holiday_date <= last_day,
        )
    ).all()
    student_holiday_dates: set[date] = {h.holiday_date for h in student_holidays_rows}

    # Attendance buffer per course (needed for must_attend computation)
    config, _ = load_risk_config(db)
    course_buffers: dict[int, int | None] = {}
    for cid in enrolled_course_ids:
        try:
            att = get_attendance_inputs(db, student_id, cid)
            buf = compute_attendance_buffer(
                attended=att["attended"],
                held=att["held"],
                total_classes=att["total_classes"],
                threshold=DEFAULT_THRESHOLD,
                min_classes=config.min_classes,
                holiday_count=att["holiday_count"],
            )
            course_buffers[cid] = buf["buffer"]
        except (ValueError, Exception):
            course_buffers[cid] = None

    # ── Build per-day pressure ────────────────────────────────────────────────
    days_output: list[DayPressure] = []
    today = date.today()

    for day_num in range(1, last_day_num + 1):
        current_date = date(year, month, day_num)
        is_weekend = current_date.weekday() >= 5  # 5=Sat, 6=Sun
        is_inst_holiday = current_date in inst_holiday_dates
        is_student_holiday = current_date in student_holiday_dates
        has_class = current_date in session_map
        warnings: list[str] = []

        # ── Attendance record for this day ─────────────────────────────────
        att_status: Optional[str] = None
        if has_class and current_date <= today:
            if is_staff:
                att_status = "conducted"
            else:
                sids = session_map[current_date]
                statuses = [record_map.get(sid) for sid in sids if sid in record_map]
                if statuses:
                    att_status = statuses[0]  # Take first session's status
                else:
                    att_status = "absent"  # Session happened but no record → absent

        # ── Assignments due on this day ─────────────────────────────────────
        due_assignments: list[dict] = []
        for a in assignments:
            due_date = a.due_at
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)
            if due_date.date() == current_date:
                sub_status = submitted_map.get(a.id, "pending")
                course = courses.get(a.course_id)
                due_assignments.append({
                    "id": a.id,
                    "title": a.title,
                    "kind": a.kind,
                    "course_code": course.code if course else "",
                    "grace_hours": a.grace_hours,
                    "status": sub_status,
                })

        # ── Deadline pressure (0–45) ────────────────────────────────────────
        deadline_pressure = 0.0
        exam_pressure = 0.0

        for a in assignments:
            due_date = a.due_at
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)

            due_d = due_date.date()
            if due_d < current_date:
                continue  # Past deadline; skip

            days_until = (due_d - current_date).days

            if days_until > 7:
                continue  # Too far away to contribute

            sub_status = submitted_map.get(a.id, "pending")
            if sub_status in ("on_time", "late", "excused"):
                continue  # Already submitted

            # Urgency curve: 1.0 on due day → 0.05 at 7 days out
            urgency = max(0.0, 1.0 - (days_until / 7.0))
            weight = 45.0 * urgency

            if a.kind == "exam":
                exam_contribution = 25.0 * urgency
                exam_pressure = max(exam_pressure, exam_contribution)
                if days_until <= 1:
                    warnings.append(f"📝 Exam '{a.title}' is due {'today' if days_until == 0 else 'tomorrow'}!")
            else:
                deadline_pressure = min(45.0, deadline_pressure + weight)
                if days_until == 0:
                    warnings.append(f"⏰ '{a.title}' is due TODAY!")
                elif days_until == 1:
                    warnings.append(f"🔔 '{a.title}' due tomorrow")

        # ── Attendance pressure: must_attend logic (0–30) ───────────────────
        attendance_pressure = 0.0
        must_attend = False

        if has_class and current_date >= today:
            # If student plans to skip this day, would it break their buffer?
            for cid in enrolled_course_ids:
                buf = course_buffers.get(cid)
                if buf is not None and buf <= 1:
                    must_attend = True
                    attendance_pressure = max(attendance_pressure, 30.0)
                    course = courses.get(cid)
                    cname = course.code if course else f"course {cid}"
                    warnings.append(
                        f"⚠️ You MUST attend {cname} — missing this class may breach 75% attendance!"
                    )
                elif buf is not None and buf <= 3:
                    attendance_pressure = max(attendance_pressure, 15.0)
                    course = courses.get(cid)
                    cname = course.code if course else f"course {cid}"
                    warnings.append(f"📊 Low buffer in {cname} (buffer={buf})")

        if is_student_holiday and has_class:
            warnings.append("📅 You've marked this as a planned absence — check attendance impact!")

        # ── Day type ────────────────────────────────────────────────────────
        has_exam = any(a["kind"] == "exam" for a in due_assignments)
        if is_inst_holiday:
            day_type = "holiday"
        elif is_weekend:
            day_type = "weekend"
        elif has_exam:
            day_type = "exam"
        elif due_assignments:
            day_type = "deadline"
        elif has_class:
            day_type = "class"
        else:
            day_type = "free"

        # ── Total pressure score ────────────────────────────────────────────
        pressure_score = round(
            min(100.0, deadline_pressure + attendance_pressure + exam_pressure), 1
        )

        days_output.append(
            DayPressure(
                date=current_date.isoformat(),
                pressure_score=pressure_score,
                deadline_pressure=round(deadline_pressure, 1),
                attendance_pressure=round(attendance_pressure, 1),
                exam_pressure=round(exam_pressure, 1),
                day_type=day_type,
                must_attend=must_attend,
                assignments_due=due_assignments,
                has_class=has_class,
                attendance_record=att_status,
                is_student_holiday=is_student_holiday,
                is_institution_holiday=is_inst_holiday,
                warnings=warnings,
            )
        )

    # ── Monthly summary ───────────────────────────────────────────────────────
    all_scores = [d.pressure_score for d in days_output]
    max_score = max(all_scores) if all_scores else 0.0
    max_day = next((d.date for d in days_output if d.pressure_score == max_score), "")
    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0
    high_pressure = sum(1 for s in all_scores if s > 60)
    critical_days = sum(1 for s in all_scores if s > 80)
    total_deadlines = sum(len(d.assignments_due) for d in days_output)
    total_exams = sum(
        1 for d in days_output for a in d.assignments_due if a["kind"] == "exam"
    )
    must_attend_days = sum(1 for d in days_output if d.must_attend)

    return MonthlyPressureSummary(
        year=year,
        month=month,
        avg_pressure_score=avg_score,
        max_pressure_score=max_score,
        max_pressure_date=max_day,
        high_pressure_days=high_pressure,
        critical_days=critical_days,
        total_deadlines=total_deadlines,
        total_exams=total_exams,
        must_attend_days=must_attend_days,
        days=days_output,
    )
