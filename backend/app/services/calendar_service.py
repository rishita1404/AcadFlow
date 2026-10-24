"""
Calendar Service — AcadFlow

Builds a student's full attendance calendar view for a month:
  - Past days: actual attendance records (present / absent / late)
  - Future days: class schedule + student-planned holidays
  - Institution holidays clearly marked
  - Per-course breakdown

Used by GET /me/calendar/{year}/{month}
"""

from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    EnrolmentModel,
    HolidayModel,
    StudentHolidayModel,
)


@dataclass
class CalendarDay:
    """A single day in the attendance calendar view."""

    date: str                           # YYYY-MM-DD
    weekday: str                        # Mon / Tue / ...
    is_weekend: bool
    is_institution_holiday: bool
    is_student_planned_holiday: bool    # Student marked as planned absence
    has_class: bool                     # At least one enrolled course has session
    attendance_status: Optional[str]    # 'present' | 'absent' | 'late' | None
    attendance_pct_so_far: Optional[float]  # running % up to this day
    sessions: List[Dict]                # [{course_code, session_id, status}]
    is_past: bool                       # True if the day has already happened
    is_today: bool


@dataclass
class CalendarMonth:
    student_id: int
    year: int
    month: int
    month_name: str
    total_held_so_far: int              # sessions conducted this month up to today
    total_attended_so_far: int
    monthly_attendance_pct: Optional[float]
    days: List[CalendarDay]


WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def build_attendance_calendar(
    db: Session,
    student_id: int,
    year: int,
    month: int,
) -> CalendarMonth:
    """
    Build the full attendance calendar for one student for a month.

    Parameters
    ----------
    db         : SQLAlchemy session
    student_id : student's user_id
    year       : e.g. 2026
    month      : 1–12

    Returns
    -------
    CalendarMonth with day-by-day breakdown
    """
    first_day = date(year, month, 1)
    last_day_num = monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)
    today = date.today()

    # Enrolled courses (or courses taught if user is staff)
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

    # Course details
    courses: dict[int, CourseModel] = {}
    for cid in enrolled_course_ids:
        c = db.get(CourseModel, cid)
        if c:
            courses[cid] = c

    # Sessions this month
    sessions = db.scalars(
        select(ClassSessionModel).where(
            ClassSessionModel.course_id.in_(enrolled_course_ids),
            ClassSessionModel.held_on >= first_day,
            ClassSessionModel.held_on <= last_day,
            ClassSessionModel.is_cancelled == False,  # noqa: E712
        )
    ).all()

    # Map: date → list of (session_id, course_id)
    session_date_map: dict[date, list[tuple[int, int]]] = {}
    for s in sessions:
        session_date_map.setdefault(s.held_on, []).append((s.id, s.course_id))

    # Attendance records for this month's sessions
    session_ids = [s.id for s in sessions]
    att_records = db.scalars(
        select(AttendanceRecordModel).where(
            AttendanceRecordModel.student_id == student_id,
            AttendanceRecordModel.session_id.in_(session_ids),
        )
    ).all()
    att_record_map: dict[int, str] = {r.session_id: r.status for r in att_records}

    # Institution holidays
    inst_holidays = db.scalars(
        select(HolidayModel).where(
            HolidayModel.holiday_date >= first_day,
            HolidayModel.holiday_date <= last_day,
        )
    ).all()
    inst_holiday_dates: set[date] = {h.holiday_date for h in inst_holidays}

    # Student-planned holidays
    student_holidays = db.scalars(
        select(StudentHolidayModel).where(
            StudentHolidayModel.student_id == student_id,
            StudentHolidayModel.holiday_date >= first_day,
            StudentHolidayModel.holiday_date <= last_day,
        )
    ).all()
    student_holiday_dates: set[date] = {h.holiday_date for h in student_holidays}

    # Build per-day entries
    days_out: list[CalendarDay] = []
    running_held = 0
    running_attended = 0

    for day_num in range(1, last_day_num + 1):
        current = date(year, month, day_num)
        is_weekend = current.weekday() >= 5
        is_past = current < today
        is_today_ = current == today

        session_entries_today = session_date_map.get(current, [])
        has_class = len(session_entries_today) > 0

        # Build per-session breakdown
        sessions_info: list[dict] = []
        day_statuses: list[str] = []

        for (sid, cid) in session_entries_today:
            if is_staff:
                att_status = "conducted" if (is_past or is_today_) else "scheduled"
            elif is_past or is_today_:
                att_status = att_record_map.get(sid, "absent")
            else:
                # Future — predict based on student holiday
                att_status = "planned_absent" if current in student_holiday_dates else "expected_present"

            day_statuses.append(att_status)
            course = courses.get(cid)
            sessions_info.append({
                "session_id": sid,
                "course_id": cid,
                "course_code": course.code if course else f"course_{cid}",
                "status": att_status,
            })

            # Only count past/today sessions in the running total
            if is_past or is_today_:
                running_held += 1
                if is_staff or att_status in ("present", "late"):
                    running_attended += 1

        # Determine summary attendance status for the day
        overall_status: Optional[str] = None
        if sessions_info:
            if is_staff:
                overall_status = "conducted" if (is_past or is_today_) else "scheduled"
            elif is_past or is_today_:
                if all(s == "absent" for s in day_statuses):
                    overall_status = "absent"
                elif all(s in ("present", "late") for s in day_statuses):
                    overall_status = "present" if "late" not in day_statuses else "late"
                else:
                    overall_status = "partial"
            else:
                overall_status = "planned_absent" if current in student_holiday_dates else "expected_present"

        running_pct = (
            round((running_attended / running_held) * 100, 1)
            if running_held > 0 and (is_past or is_today_)
            else None
        )

        days_out.append(
            CalendarDay(
                date=current.isoformat(),
                weekday=WEEKDAY_NAMES[current.weekday()],
                is_weekend=is_weekend,
                is_institution_holiday=current in inst_holiday_dates,
                is_student_planned_holiday=current in student_holiday_dates,
                has_class=has_class,
                attendance_status=overall_status,
                attendance_pct_so_far=running_pct,
                sessions=sessions_info,
                is_past=is_past,
                is_today=is_today_,
            )
        )

    monthly_pct = (
        round((running_attended / running_held) * 100, 1) if running_held > 0 else None
    )

    return CalendarMonth(
        student_id=student_id,
        year=year,
        month=month,
        month_name=MONTH_NAMES[month],
        total_held_so_far=running_held,
        total_attended_so_far=running_attended,
        monthly_attendance_pct=monthly_pct,
        days=days_out,
    )
