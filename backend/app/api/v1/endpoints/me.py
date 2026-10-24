"""
Personal Student & User Dashboard Endpoints (/me) — AcadFlow.

Implements PRD Section 9:
  GET  /me                     — current user profile
  GET  /me/permissions         — user duties and scope matrix for the UI role switcher
  GET  /me/dashboard           — student personalized dashboard (course cards, buffers, risk bands)
  POST /me/simulate            — what-if attendance simulation ("what if I miss N classes?")
  GET  /me/deadlines           — weekly assignment deadlines for calendar/heatmap view
  GET  /me/warnings            — active warning signals (buffer + risk alerts)
  GET  /me/calendar/{year}/{month}   — full monthly attendance calendar view
  POST /me/holidays            — mark a date as a planned absence
  DELETE /me/holidays/{date}   — unmark a planned absence
  GET  /me/holidays            — list all planned absences
  GET  /me/pressure-forecast/{year}/{month} — academic pressure heatmap for the month
  POST /me/check-reminders     — on-demand deadline reminder dispatch
"""

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.deps import get_db
from app.core.errors import ConflictError, NotFoundError, UnauthorizedError
from app.models import (
    AssignmentModel,
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    CourseStaffModel,
    EnrolmentModel,
    MentorAssignmentModel,
    RiskSnapshotModel,
    StudentHolidayModel,
    StudentModel,
    SubmissionModel,
    UserModel,
)
from app.services.buffer import compute_attendance_buffer
from app.services.calendar_service import build_attendance_calendar
from app.services.pressure_forecast import compute_monthly_pressure
from app.services.reminders import dispatch_deadline_reminders
from app.services.risk_data import (
    calculate_student_course_risk,
    get_attendance_inputs,
    load_risk_config,
)

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────


class UserProfileOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    roll_no: Optional[str] = None
    batch: Optional[str] = None


class UserPermissionsOut(BaseModel):
    primary_role: str
    duties: List[str]
    allowed_roles: List[str]
    department_id: Optional[int] = None


class WarningSignal(BaseModel):
    """A single active warning signal for the student."""
    kind: str          # 'buffer_critical' | 'buffer_warning' | 'deadline' | 'risk_band' | 'missed_sub'
    severity: str      # 'critical' | 'high' | 'medium' | 'low'
    title: str
    message: str
    course_id: Optional[int] = None
    course_code: Optional[str] = None
    assignment_id: Optional[int] = None
    value: Optional[float] = None  # The numeric trigger value (e.g. buffer=1, pct=68.5)


class CourseCardOut(BaseModel):
    course_id: int
    code: str
    name: str
    total_classes: int
    held: int
    attended: int
    required: Optional[int] = None
    still_need: Optional[int] = None
    remaining: Optional[int] = None
    buffer: Optional[int] = None
    attendance_pct: Optional[float] = None
    insufficient_data: bool
    risk_band: str
    risk_score: Optional[float] = None
    status_message: str
    # Warning signals for this course
    has_warning: bool = False
    warning_level: str = "safe"  # safe | watch | danger | critical


class StudentDashboardOut(BaseModel):
    student_id: int
    name: str
    roll_no: Optional[str] = None
    overall_attendance_pct: Optional[float] = None
    total_courses: int
    at_risk_courses_count: int
    critical_courses_count: int
    active_warnings: int
    courses: List[CourseCardOut]


class SimulateRequest(BaseModel):
    course_id: int
    miss_count: int = Field(
        ge=0, le=100, description="Number of additional upcoming classes to miss"
    )


class SimulateResponse(BaseModel):
    course_id: int
    miss_count: int
    current_buffer: Optional[int]
    simulated_buffer: Optional[int]
    current_attendance_pct: Optional[float]
    simulated_attendance_pct: Optional[float]
    is_recoverable: bool
    status_message: str
    impact_description: str


class DeadlineItemOut(BaseModel):
    assignment_id: int
    course_id: int
    course_code: str
    title: str
    kind: str
    due_at: datetime
    grace_hours: int
    hard_deadline: datetime
    status: str             # pending | submitted | missed | late
    days_remaining: int     # negative if overdue
    urgency: str            # normal | soon | urgent | overdue


class StudentHolidayIn(BaseModel):
    holiday_date: date
    reason: Optional[str] = Field(None, max_length=200)


class StudentHolidayOut(BaseModel):
    id: int
    holiday_date: date
    reason: Optional[str] = None
    is_future_plan: bool
    created_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# Helper: resolve user and optional student from JWT
# ──────────────────────────────────────────────────────────────────────────────


def _get_user_and_student(current_user: dict, db: Session) -> tuple[UserModel, Optional[StudentModel]]:
    user_id = int(current_user.get("sub", 0))
    user = db.get(UserModel, user_id)
    if not user:
        raise UnauthorizedError("User not found.")
    student = db.get(StudentModel, user_id)
    return user, student


def _get_student_id(current_user: dict, db: Session) -> int:
    user, student = _get_user_and_student(current_user, db)
    if not student:
        raise UnauthorizedError("This endpoint is only available to students.")
    return user.id


# ──────────────────────────────────────────────────────────────────────────────
# Profile & Permissions
# ──────────────────────────────────────────────────────────────────────────────


@router.get("", response_model=UserProfileOut, summary="Get current user profile")
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user.get("sub", 0))
    user = db.get(UserModel, user_id)
    if not user:
        raise NotFoundError("User not found.")

    roll_no = None
    if user.role == "student":
        student = db.get(StudentModel, user_id)
        if student:
            roll_no = student.roll_no

    return UserProfileOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        roll_no=roll_no,
    )


@router.get(
    "/permissions",
    response_model=UserPermissionsOut,
    summary="Get user permissions and duties",
)
def get_my_permissions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user.get("sub", 0))
    user = db.get(UserModel, user_id)
    if not user:
        raise NotFoundError("User not found.")

    duties: List[str] = []
    allowed_roles: List[str] = []

    if user.role == "student":
        duties = ["student"]
        allowed_roles = ["student"]
    elif user.role == "faculty":
        staff_roles = db.scalars(
            select(CourseStaffModel.role).where(CourseStaffModel.user_id == user_id)
        ).all()
        for r in staff_roles:
            if r and r not in duties:
                duties.append(r)
        
        mentee_count = db.scalar(
            select(func.count()).select_from(MentorAssignmentModel).where(
                MentorAssignmentModel.mentor_id == user_id
            )
        ) or 0
        if mentee_count > 0 and "mentor" not in duties:
            duties.append("mentor")
            
        if not duties:
            duties = ["instructor"]

        allowed_roles = ["faculty"]
        if "mentor" in duties:
            allowed_roles.append("mentor")
        if "course_coordinator" in duties:
            allowed_roles.append("coordinator")
    elif user.role == "coordinator":
        duties = ["coordinator"]
        allowed_roles = ["coordinator"]
    elif user.role == "admin":
        duties = ["admin"]
        allowed_roles = ["admin"]
    else:
        duties = [user.role]
        allowed_roles = [user.role]

    return UserPermissionsOut(
        primary_role=user.role,
        duties=duties,
        allowed_roles=allowed_roles,
        department_id=user.department_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Student Dashboard
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/dashboard",
    response_model=StudentDashboardOut,
    summary="Personalized dashboard for student or teaching staff",
)
def get_dashboard(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return a comprehensive dashboard:
    - For students: enrolled courses with buffer, attendance %, risk band, risk score
    - For faculty/staff: assigned courses with enrollment, attendance rate, at-risk count
    """
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id

    if student:
        roll_no = student.roll_no
        enrolled = list(
            db.scalars(
                select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
            ).all()
        )

        course_cards: list[CourseCardOut] = []
        total_held = 0
        total_attended = 0
        at_risk_count = 0
        critical_count = 0
        active_warnings = 0

        for cid in enrolled:
            course = db.get(CourseModel, cid)
            if not course:
                continue

            try:
                risk_data = calculate_student_course_risk(db, user_id, cid)
            except Exception:
                continue

            att_pct = risk_data.get("attendance_pct")
            buf = risk_data.get("buffer")
            band = risk_data.get("band", "Safe")
            score = risk_data.get("score")
            held = risk_data.get("held", 0)
            attended = risk_data.get("attended", 0)

            total_held += held
            total_attended += attended

            # Determine warning level and count
            warning_level = "safe"
            has_warning = False
            if band in ("Critical",):
                critical_count += 1
                at_risk_count += 1
                warning_level = "critical"
                has_warning = True
                active_warnings += 1
            elif band in ("At risk",):
                at_risk_count += 1
                warning_level = "danger"
                has_warning = True
                active_warnings += 1
            elif band == "Watch" or (buf is not None and buf <= 2):
                warning_level = "watch"
                has_warning = True

            course_cards.append(
                CourseCardOut(
                    course_id=cid,
                    code=course.code,
                    name=course.name,
                    total_classes=risk_data.get("total_classes", course.total_classes),
                    held=held,
                    attended=attended,
                    required=risk_data.get("required"),
                    still_need=risk_data.get("still_need"),
                    remaining=risk_data.get("remaining"),
                    buffer=buf,
                    attendance_pct=att_pct,
                    insufficient_data=risk_data.get("insufficient_data", False),
                    risk_band=band,
                    risk_score=score,
                    status_message=risk_data.get("status_message", ""),
                    has_warning=has_warning,
                    warning_level=warning_level,
                )
            )

        overall_pct = (
            round((total_attended / total_held) * 100, 2) if total_held > 0 else None
        )

        return StudentDashboardOut(
            student_id=user_id,
            name=user.name,
            roll_no=roll_no,
            overall_attendance_pct=overall_pct,
            total_courses=len(course_cards),
            at_risk_courses_count=at_risk_count,
            critical_courses_count=critical_count,
            active_warnings=active_warnings,
            courses=course_cards,
        )
    else:
        # Faculty / Staff Teaching Overview
        taught_course_ids = list(
            db.scalars(
                select(CourseStaffModel.course_id).where(CourseStaffModel.user_id == user.id)
            ).all()
        )
        if not taught_course_ids:
            taught_course_ids = list(db.scalars(select(CourseModel.id)).all())

        course_cards: list[CourseCardOut] = []
        total_held = 0
        total_attended = 0
        at_risk_count = 0
        critical_count = 0
        active_warnings = 0

        for cid in taught_course_ids:
            course = db.get(CourseModel, cid)
            if not course:
                continue

            total_classes = course.total_classes or 45
            held_sessions = list(
                db.scalars(
                    select(ClassSessionModel.id).where(
                        ClassSessionModel.course_id == cid,
                        ClassSessionModel.is_cancelled.is_(False),
                        ClassSessionModel.held_on <= date.today(),
                    )
                ).all()
            )
            held = len(held_sessions)

            enrolled_students = list(
                db.scalars(
                    select(EnrolmentModel.student_id).where(EnrolmentModel.course_id == cid)
                ).all()
            )
            enrolled_count = len(enrolled_students)

            att_pct = None
            avg_attended = 0
            if held > 0 and enrolled_count > 0:
                present_count = len(
                    list(
                        db.scalars(
                            select(AttendanceRecordModel.id).where(
                                AttendanceRecordModel.session_id.in_(held_sessions),
                                AttendanceRecordModel.status.in_(["present", "late"]),
                            )
                        ).all()
                    )
                )
                total_slots = held * enrolled_count
                att_pct = round((present_count / total_slots) * 100, 1) if total_slots > 0 else None
                avg_attended = round(present_count / enrolled_count) if enrolled_count > 0 else 0
                total_held += held
                total_attended += avg_attended

            # Find at-risk students enrolled in this course
            snaps = (
                list(
                    db.scalars(
                        select(RiskSnapshotModel).where(
                            RiskSnapshotModel.student_id.in_(enrolled_students)
                        )
                    ).all()
                )
                if enrolled_students
                else []
            )

            latest_band_by_student: dict[int, str] = {}
            for s in snaps:
                if s.student_id not in latest_band_by_student:
                    latest_band_by_student[s.student_id] = s.band

            crit_students = sum(1 for b in latest_band_by_student.values() if b == "Critical")
            risk_students = sum(1 for b in latest_band_by_student.values() if b in ("At risk", "Critical"))

            if crit_students > 0:
                band = "Critical"
                warning_level = "critical"
                has_warning = True
                critical_count += 1
                at_risk_count += 1
                active_warnings += crit_students
            elif risk_students > 0:
                band = "At risk"
                warning_level = "danger"
                has_warning = True
                at_risk_count += 1
                active_warnings += risk_students
            else:
                band = "Safe"
                warning_level = "safe"
                has_warning = False

            status_msg = f"{enrolled_count} students enrolled • {held} sessions held • {risk_students} at risk"

            course_cards.append(
                CourseCardOut(
                    course_id=cid,
                    code=course.code,
                    name=course.name,
                    total_classes=total_classes,
                    held=held,
                    attended=avg_attended,
                    required=int(total_classes * 0.75),
                    still_need=max(0, int(total_classes * 0.75) - held),
                    remaining=max(0, total_classes - held),
                    buffer=None,
                    attendance_pct=att_pct,
                    insufficient_data=(held == 0),
                    risk_band=band,
                    risk_score=att_pct,
                    status_message=status_msg,
                    has_warning=has_warning,
                    warning_level=warning_level,
                )
            )

        overall_pct = (
            round((total_attended / total_held) * 100, 2) if total_held > 0 else None
        )

        return StudentDashboardOut(
            student_id=user_id,
            name=user.name,
            roll_no=f"FACULTY-{user.role.upper()}",
            overall_attendance_pct=overall_pct,
            total_courses=len(course_cards),
            at_risk_courses_count=at_risk_count,
            critical_courses_count=critical_count,
            active_warnings=active_warnings,
            courses=course_cards,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Warning Signals
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/warnings",
    response_model=List[WarningSignal],
    summary="Active warning signals for the current user",
)
def get_my_warnings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return all active warning signals:
    - For students: buffer warnings, overdue/near deadlines, risk band alerts
    - For faculty/staff: at-risk/critical students enrolled in taught courses, assignment deadlines
    """
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id
    warnings: list[WarningSignal] = []
    now = datetime.now(timezone.utc)

    if student:
        enrolled = list(
            db.scalars(
                select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
            ).all()
        )

        for cid in enrolled:
            course = db.get(CourseModel, cid)
            if not course:
                continue

            try:
                risk_data = calculate_student_course_risk(db, user_id, cid)
            except Exception:
                continue

            buf = risk_data.get("buffer")
            att_pct = risk_data.get("attendance_pct")
            band = risk_data.get("band", "Safe")
            score = risk_data.get("score")

            # Buffer warnings
            if buf is not None:
                if buf < 0 or (att_pct is not None and att_pct < 75.0):
                    warnings.append(WarningSignal(
                        kind="buffer_critical",
                        severity="critical",
                        title=f"⛔ Attendance Unrecoverable — {course.code}",
                        message=(
                            f"Attendance in {course.code} is {att_pct:.1f}% "
                            f"(buffer={buf}). Attendance target cannot be met."
                        ),
                        course_id=cid,
                        course_code=course.code,
                        value=att_pct,
                    ))
                elif buf == 0:
                    warnings.append(WarningSignal(
                        kind="buffer_critical",
                        severity="high",
                        title=f"🚨 Zero Buffer — {course.code}",
                        message=f"You cannot miss any more classes in {course.code}!",
                        course_id=cid,
                        course_code=course.code,
                        value=0.0,
                    ))
                elif buf <= 2:
                    warnings.append(WarningSignal(
                        kind="buffer_warning",
                        severity="medium",
                        title=f"⚠️ Low Buffer — {course.code}",
                        message=f"Only {buf} class(es) buffer remaining in {course.code} ({att_pct:.1f}%).",
                        course_id=cid,
                        course_code=course.code,
                        value=float(buf),
                    ))

            # Risk band warnings
            if band in ("At risk", "Critical"):
                severity = "critical" if band == "Critical" else "high"
                warnings.append(WarningSignal(
                    kind="risk_band",
                    severity=severity,
                    title=f"{'🆘' if band == 'Critical' else '⚠️'} Risk Band: {band} — {course.code}",
                    message=f"Risk score {score:.1f}/100 in {course.code}. {', '.join(risk_data.get('factors', [])[:2])}",
                    course_id=cid,
                    course_code=course.code,
                    value=score,
                ))

        # Deadline warnings (overdue or due within 24h)
        if enrolled:
            urgent_assignments = db.scalars(
                select(AssignmentModel).where(
                    AssignmentModel.course_id.in_(enrolled),
                    AssignmentModel.is_published == True,  # noqa: E712
                    AssignmentModel.due_at >= now - timedelta(hours=1),
                    AssignmentModel.due_at <= now + timedelta(hours=24),
                )
            ).all()

            for asgn in urgent_assignments:
                existing_sub = db.scalar(
                    select(SubmissionModel).where(
                        SubmissionModel.assignment_id == asgn.id,
                        SubmissionModel.student_id == user_id,
                        SubmissionModel.status.in_(["on_time", "late", "excused"]),
                    )
                )
                if existing_sub:
                    continue

                course = db.get(CourseModel, asgn.course_id)
                due = asgn.due_at
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)

                hours_left = (due - now).total_seconds() / 3600
                if hours_left < 0:
                    msg = f"'{asgn.title}' was due {abs(int(hours_left))}h ago! Grace period active."
                    severity = "high"
                else:
                    msg = f"'{asgn.title}' is due in {int(hours_left)}h!"
                    severity = "critical" if hours_left < 2 else "high"

                warnings.append(WarningSignal(
                    kind="deadline",
                    severity=severity,
                    title=f"⏰ Deadline — {asgn.title[:40]}",
                    message=msg,
                    course_id=asgn.course_id,
                    course_code=course.code if course else "",
                    assignment_id=asgn.id,
                    value=max(0.0, hours_left),
                ))
    else:
        # Faculty / Staff: alert on students at risk in their courses + assignment deadlines
        taught_course_ids = list(
            db.scalars(
                select(CourseStaffModel.course_id).where(CourseStaffModel.user_id == user.id)
            ).all()
        )
        if not taught_course_ids:
            taught_course_ids = list(db.scalars(select(CourseModel.id)).all())

        for cid in taught_course_ids:
            course = db.get(CourseModel, cid)
            if not course:
                continue

            enrolled_student_ids = list(
                db.scalars(
                    select(EnrolmentModel.student_id).where(EnrolmentModel.course_id == cid)
                ).all()
            )
            if not enrolled_student_ids:
                continue

            snaps = list(
                db.scalars(
                    select(RiskSnapshotModel)
                    .where(RiskSnapshotModel.student_id.in_(enrolled_student_ids))
                    .order_by(RiskSnapshotModel.computed_at.desc())
                ).all()
            )

            seen_students = set()
            for s in snaps:
                if s.student_id in seen_students:
                    continue
                seen_students.add(s.student_id)

                if s.band in ("Critical", "At risk"):
                    st_user = db.get(UserModel, s.student_id)
                    st_model = db.get(StudentModel, s.student_id)
                    s_name = st_user.name if st_user else f"Student #{s.student_id}"
                    roll = f" ({st_model.roll_no})" if st_model and st_model.roll_no else ""
                    warnings.append(
                        WarningSignal(
                            kind="risk_band",
                            severity="critical" if s.band == "Critical" else "high",
                            title=f"{'🆘' if s.band == 'Critical' else '⚠️'} Student {s.band} — {course.code}",
                            message=f"{s_name}{roll} is in {s.band} band (Risk score: {float(s.score):.1f}).",
                            course_id=cid,
                            course_code=course.code,
                            value=float(s.score),
                        )
                    )

        if taught_course_ids:
            urgent_assignments = list(
                db.scalars(
                    select(AssignmentModel).where(
                        AssignmentModel.course_id.in_(taught_course_ids),
                        AssignmentModel.is_published.is_(True),
                        AssignmentModel.due_at >= now - timedelta(hours=1),
                        AssignmentModel.due_at <= now + timedelta(hours=48),
                    )
                ).all()
            )
            for asgn in urgent_assignments:
                course = db.get(CourseModel, asgn.course_id)
                due = asgn.due_at
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                hours_left = (due - now).total_seconds() / 3600
                warnings.append(
                    WarningSignal(
                        kind="deadline",
                        severity="high" if hours_left < 12 else "medium",
                        title=f"⏰ Assignment Due — {asgn.title[:40]}",
                        message=f"Submissions closing in {int(max(0, hours_left))}h for {course.code if course else ''}.",
                        course_id=asgn.course_id,
                        course_code=course.code if course else "",
                        assignment_id=asgn.id,
                        value=max(0.0, hours_left),
                    )
                )

    return warnings[:25]


# ──────────────────────────────────────────────────────────────────────────────
# What-if Simulation
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/simulate",
    response_model=SimulateResponse,
    summary="What-if attendance simulation",
)
def simulate_attendance(
    payload: SimulateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simulate the impact of missing N more classes on an attendance buffer.
    Returns current vs. simulated buffer and attendance percentage.
    """
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id
    course = db.get(CourseModel, payload.course_id)
    if not course:
        raise NotFoundError(f"Course {payload.course_id} not found.")

    config, _ = load_risk_config(db)

    if student:
        att = get_attendance_inputs(db, user_id, payload.course_id)
        attended = att["attended"]
        held = att["held"]
        total_classes = att["total_classes"]
        holiday_count = att["holiday_count"]
    else:
        # For faculty testing what-if simulator on this course:
        total_classes = course.total_classes or 45
        held_count = len(
            list(
                db.scalars(
                    select(ClassSessionModel.id).where(
                        ClassSessionModel.course_id == payload.course_id,
                        ClassSessionModel.is_cancelled.is_(False),
                        ClassSessionModel.held_on <= date.today(),
                    )
                ).all()
            )
        )
        held = held_count if held_count > 0 else 15
        attended = int(held * 0.75)
        holiday_count = 0

    curr = compute_attendance_buffer(
        attended=attended,
        held=held,
        total_classes=total_classes,
        min_classes=config.min_classes,
        holiday_count=holiday_count,
    )

    n_missed = payload.miss_count
    sim_held = min(total_classes, held + n_missed)

    sim = compute_attendance_buffer(
        attended=attended,
        held=sim_held,
        total_classes=total_classes,
        min_classes=config.min_classes,
        holiday_count=holiday_count,
    )

    is_recoverable = (sim["buffer"] is not None and sim["buffer"] >= 0) or (
        attended + (sim["remaining"] or 0) >= (sim["required"] or 0)
    )

    curr_pct = curr.get("attendance_pct")
    sim_pct = sim.get("attendance_pct")
    curr_buf = curr.get("buffer")
    sim_buf = sim.get("buffer")

    if not is_recoverable:
        impact = (
            f"Missing {n_missed} more class(es) would make the 75% target "
            f"UNRECOVERABLE. Attendance would drop to {sim_pct}%."
        )
        msg = impact
    elif sim_buf is not None and sim_buf == 0:
        impact = f"After {n_missed} miss(es), you'll have zero buffer — no more absences allowed."
        msg = impact
    else:
        pct_diff = round((sim_pct or 0) - (curr_pct or 0), 1)
        impact = (
            f"After {n_missed} miss(es): attendance {curr_pct}% → {sim_pct}% "
            f"({pct_diff}%), buffer {curr_buf} → {sim_buf}."
        )
        msg = f"Buffer drops to {sim_buf} with {sim_pct}% attendance."

    return SimulateResponse(
        course_id=payload.course_id,
        miss_count=n_missed,
        current_buffer=curr_buf,
        simulated_buffer=sim_buf,
        current_attendance_pct=curr_pct,
        simulated_attendance_pct=sim_pct,
        is_recoverable=is_recoverable,
        status_message=msg,
        impact_description=impact,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Deadlines
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/deadlines",
    response_model=List[DeadlineItemOut],
    summary="Upcoming deadlines with urgency for calendar/heatmap view",
)
def get_my_deadlines(
    days: int = Query(30, ge=1, le=120, description="Lookahead window in days"),
    include_past: bool = Query(False, description="Include recently past deadlines (last 7 days)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id

    if student:
        enrolled_courses = list(
            db.scalars(
                select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
            ).all()
        )
    else:
        enrolled_courses = list(
            db.scalars(
                select(CourseStaffModel.course_id).where(CourseStaffModel.user_id == user_id)
            ).all()
        )
        if not enrolled_courses:
            enrolled_courses = list(db.scalars(select(CourseModel.id)).all())

    if not enrolled_courses:
        return []

    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)
    lookback = now - timedelta(days=7) if include_past else now - timedelta(hours=1)

    assignments = list(
        db.scalars(
            select(AssignmentModel)
            .where(
                AssignmentModel.course_id.in_(enrolled_courses),
                AssignmentModel.is_published == True,  # noqa: E712
                AssignmentModel.due_at >= lookback,
                AssignmentModel.due_at <= cutoff,
            )
            .order_by(AssignmentModel.due_at.asc())
        ).all()
    )

    asgn_ids = [a.id for a in assignments]
    submissions = (
        list(
            db.scalars(
                select(SubmissionModel).where(
                    SubmissionModel.assignment_id.in_(asgn_ids),
                    SubmissionModel.student_id == user_id,
                )
            ).all()
        )
        if student
        else []
    )
    sub_map = {s.assignment_id: s.status for s in submissions}

    items: list[DeadlineItemOut] = []
    course_cache: dict[int, CourseModel] = {}

    for a in assignments:
        if a.course_id not in course_cache:
            course_cache[a.course_id] = db.get(CourseModel, a.course_id)
        c = course_cache[a.course_id]

        due = a.due_at
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        hard_deadline = due + timedelta(hours=a.grace_hours)
        days_remaining = (due.date() - now.date()).days

        if student:
            sub_status = sub_map.get(a.id, "pending")
            if sub_status == "pending" and due < now:
                if hard_deadline < now:
                    sub_status = "missed"
                else:
                    sub_status = "pending"  # In grace period

            # Urgency classification
            if sub_status in ("on_time", "late", "excused"):
                urgency = "submitted"
            elif days_remaining < 0:
                urgency = "overdue"
            elif days_remaining == 0:
                urgency = "urgent"
            elif days_remaining <= 2:
                urgency = "soon"
            else:
                urgency = "normal"
        else:
            sub_status = "active" if hard_deadline >= now else "closed"
            if days_remaining < 0:
                urgency = "overdue"
            elif days_remaining == 0:
                urgency = "urgent"
            elif days_remaining <= 2:
                urgency = "soon"
            else:
                urgency = "normal"

        items.append(
            DeadlineItemOut(
                assignment_id=a.id,
                course_id=a.course_id,
                course_code=c.code if c else "",
                title=a.title,
                kind=a.kind,
                due_at=due,
                grace_hours=a.grace_hours,
                hard_deadline=hard_deadline,
                status=sub_status,
                days_remaining=days_remaining,
                urgency=urgency,
            )
        )

    return items


# ──────────────────────────────────────────────────────────────────────────────
# Attendance Calendar
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/calendar/{year}/{month}",
    summary="Monthly attendance calendar view",
)
def get_attendance_calendar(
    year: int,
    month: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return a day-by-day calendar view for the user for a given month.

    Each day shows:
    - Actual attendance status (past days): present / absent / late (or conducted for faculty)
    - Future class schedule + student's planned holiday status
    - Whether the day is an institution holiday or weekend
    - Running attendance percentage up to that day

    Use POST /me/holidays to mark future dates as planned absences.
    """
    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12.",
        )
    if year < 2020 or year > 2100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Year must be between 2020 and 2100.",
        )

    user, _ = _get_user_and_student(current_user, db)
    calendar = build_attendance_calendar(db, user.id, year, month)

    # Convert dataclasses to dicts for JSON serialization
    return {
        "student_id": calendar.student_id,
        "year": calendar.year,
        "month": calendar.month,
        "month_name": calendar.month_name,
        "total_held_so_far": calendar.total_held_so_far,
        "total_attended_so_far": calendar.total_attended_so_far,
        "monthly_attendance_pct": calendar.monthly_attendance_pct,
        "days": [
            {
                "date": d.date,
                "weekday": d.weekday,
                "is_weekend": d.is_weekend,
                "is_institution_holiday": d.is_institution_holiday,
                "is_student_planned_holiday": d.is_student_planned_holiday,
                "has_class": d.has_class,
                "attendance_status": d.attendance_status,
                "attendance_pct_so_far": d.attendance_pct_so_far,
                "sessions": d.sessions,
                "is_past": d.is_past,
                "is_today": d.is_today,
            }
            for d in calendar.days
        ],
    }


# ──────────────────────────────────────────────────────────────────────────────
# Student-Planned Holidays
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/holidays",
    response_model=List[StudentHolidayOut],
    summary="List student's planned holidays / absences",
)
def list_my_holidays(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all dates the student has marked as planned absences."""
    user, student = _get_user_and_student(current_user, db)
    if not student:
        return []

    holidays = db.scalars(
        select(StudentHolidayModel)
        .where(StudentHolidayModel.student_id == user.id)
        .order_by(StudentHolidayModel.holiday_date.asc())
    ).all()

    return [
        StudentHolidayOut(
            id=h.id,
            holiday_date=h.holiday_date,
            reason=h.reason,
            is_future_plan=h.is_future_plan,
            created_at=h.created_at,
        )
        for h in holidays
    ]


@router.post(
    "/holidays",
    response_model=StudentHolidayOut,
    status_code=status.HTTP_201_CREATED,
    summary="Mark a date as a planned absence",
)
def mark_holiday(
    payload: StudentHolidayIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a future date as a planned absence (holiday).

    If this date already has a class session in any enrolled course,
    the system will factor this into the academic pressure forecast
    and attendance calendar view.

    **If a date is NOT marked → the system assumes you plan to attend class.**
    """
    user, student = _get_user_and_student(current_user, db)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planned absences are only applicable to student accounts.",
        )

    user_id = user.id

    # Check for duplicate
    existing = db.scalar(
        select(StudentHolidayModel).where(
            StudentHolidayModel.student_id == user_id,
            StudentHolidayModel.holiday_date == payload.holiday_date,
        )
    )
    if existing:
        raise ConflictError(
            f"Date {payload.holiday_date} is already marked as a planned holiday."
        )

    today = date.today()
    is_future = payload.holiday_date >= today

    holiday = StudentHolidayModel(
        student_id=user_id,
        holiday_date=payload.holiday_date,
        reason=payload.reason,
        is_future_plan=is_future,
        created_at=datetime.now(timezone.utc),
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)

    return StudentHolidayOut(
        id=holiday.id,
        holiday_date=holiday.holiday_date,
        reason=holiday.reason,
        is_future_plan=holiday.is_future_plan,
        created_at=holiday.created_at,
    )


@router.delete(
    "/holidays/{holiday_date}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unmark a planned holiday",
)
def delete_holiday(
    holiday_date: date,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a date from the student's planned holidays."""
    user, student = _get_user_and_student(current_user, db)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planned absences are only applicable to student accounts.",
        )

    user_id = user.id

    holiday = db.scalar(
        select(StudentHolidayModel).where(
            StudentHolidayModel.student_id == user_id,
            StudentHolidayModel.holiday_date == holiday_date,
        )
    )
    if not holiday:
        raise NotFoundError(f"No planned holiday found for date {holiday_date}.")

    db.delete(holiday)
    db.commit()
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Academic Pressure Forecast / Heatmap
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/pressure-forecast/{year}/{month}",
    summary="Academic pressure forecast / heatmap for a month",
)
def get_pressure_forecast(
    year: int,
    month: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return per-day academic pressure scores (0–100) for a given month.

    **Pressure score components:**
    - Deadline pressure (0–45): urgency of unsubmitted assignments due soon
    - Attendance pressure (0–30): days where missing class is risky
    - Exam proximity pressure (0–25): closeness to exam-type assignments
    """
    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12.",
        )

    user, _ = _get_user_and_student(current_user, db)
    summary = compute_monthly_pressure(db, user.id, year, month)

    return {
        "year": summary.year,
        "month": summary.month,
        "summary": {
            "avg_pressure_score": summary.avg_pressure_score,
            "max_pressure_score": summary.max_pressure_score,
            "max_pressure_date": summary.max_pressure_date,
            "high_pressure_days": summary.high_pressure_days,
            "critical_days": summary.critical_days,
            "total_deadlines": summary.total_deadlines,
            "total_exams": summary.total_exams,
            "must_attend_days": summary.must_attend_days,
        },
        "days": [
            {
                "date": d.date,
                "pressure_score": d.pressure_score,
                "deadline_pressure": d.deadline_pressure,
                "attendance_pressure": d.attendance_pressure,
                "exam_pressure": d.exam_pressure,
                "day_type": d.day_type,
                "must_attend": d.must_attend,
                "assignments_due": d.assignments_due,
                "has_class": d.has_class,
                "attendance_record": d.attendance_record,
                "is_student_holiday": d.is_student_holiday,
                "is_institution_holiday": d.is_institution_holiday,
                "warnings": d.warnings,
            }
            for d in summary.days
        ],
    }


# ──────────────────────────────────────────────────────────────────────────────
# On-demand reminder dispatch
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/check-reminders",
    summary="On-demand: dispatch deadline reminders for current student",
)
async def check_reminders(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trigger an immediate scan for upcoming deadlines and dispatch
    notification reminders for any that haven't already been sent.
    """
    user, student = _get_user_and_student(current_user, db)
    if not student:
        return {
            "status": "ok",
            "reminders_dispatched": 0,
            "message": "Only students receive assignment reminders.",
        }
    created = await dispatch_deadline_reminders(db, user.id)
    return {
        "status": "ok",
        "reminders_dispatched": created,
        "message": f"{created} new reminder(s) sent." if created else "No new reminders needed.",
    }


# ---------------------------------------------------------------------------
# Leave Planner Live Projection & Tasks Endpoints
# ---------------------------------------------------------------------------


class PlanProjectRequest(BaseModel):
    planned_dates: List[str] = Field(default_factory=list, description="List of YYYY-MM-DD strings planned as absent")


class CourseProjectionOut(BaseModel):
    course_id: int
    code: str
    name: str
    total_classes: int
    held: int
    attended: int
    current_buffer: Optional[int]
    planned_misses: int
    spare_misses_left: Optional[int]
    projected_final_percent: Optional[float]
    projected_band: str
    is_recoverable: bool
    status_message: str


class PlanProjectResponse(BaseModel):
    planned_days_count: int
    courses: List[CourseProjectionOut]
    is_recoverable: bool
    status_message: str


@router.post(
    "/plan/project",
    response_model=PlanProjectResponse,
    summary="Compute live leave projection across enrolled courses",
)
def project_leave_plan(
    payload: PlanProjectRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Computes date-based planned leave projection per course (Section B & C):
      spare_misses_left = buffer - planned
      projected_final_percent = (attended + remaining - planned) / total_classes
      spare < 0 -> 'Not recoverable by attendance alone'
    Projection never alters official risk scores.
    """
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id

    enrolled = list(
        db.scalars(
            select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
        ).all()
    ) if student else []

    if not enrolled:
        # Fallback for teaching staff testing planner
        enrolled = [c.id for c in db.scalars(select(CourseModel).limit(3)).all()]

    planned_count = len(payload.planned_dates)
    results: List[CourseProjectionOut] = []
    all_recoverable = True

    for cid in enrolled:
        course = db.get(CourseModel, cid)
        if not course:
            continue

        try:
            risk_data = calculate_student_course_risk(db, user_id, cid)
        except Exception:
            risk_data = {}

        total_classes = risk_data.get("total_classes", course.total_classes or 45)
        held = risk_data.get("held", 0)
        attended = risk_data.get("attended", 0)
        curr_buffer = risk_data.get("buffer")
        remaining = max(0, total_classes - held)

        # Count how many planned absences apply to this course
        # Default: 1 class missed per planned day up to remaining
        planned_misses = min(planned_count, remaining)

        spare_misses = (curr_buffer - planned_misses) if curr_buffer is not None else None
        projected_att = max(0, attended + (remaining - planned_misses))
        projected_pct = round((projected_att / total_classes) * 100, 2) if total_classes > 0 else 0.0

        if spare_misses is not None and spare_misses < 0:
            is_recoverable = False
            all_recoverable = False
            projected_band = "Critical"
            status_message = "Not recoverable by attendance alone"
        else:
            is_recoverable = True
            if projected_pct >= 75.0:
                projected_band = "Safe"
                status_message = f"Can miss up to {spare_misses} more class(es)" if spare_misses is not None else "On track"
            elif projected_pct >= 65.0:
                projected_band = "Watch"
                status_message = f"Borderline attendance ({projected_pct}%). Keep an eye."
            else:
                projected_band = "At risk"
                status_message = "Projected below 65%. Needs attention."

        results.append(
            CourseProjectionOut(
                course_id=cid,
                code=course.code,
                name=course.name,
                total_classes=total_classes,
                held=held,
                attended=attended,
                current_buffer=curr_buffer,
                planned_misses=planned_misses,
                spare_misses_left=spare_misses,
                projected_final_percent=projected_pct,
                projected_band=projected_band,
                is_recoverable=is_recoverable,
                status_message=status_message,
            )
        )

    return PlanProjectResponse(
        planned_days_count=planned_count,
        courses=results,
        is_recoverable=all_recoverable,
        status_message="Projection, not your official status",
    )


class TaskItemOut(BaseModel):
    id: int
    type: str  # 'assignment' | 'notice'
    title: str
    course_code: str
    course_name: str
    due_at: str
    days_remaining: Optional[int] = None
    submitted: bool = False
    submission_id: Optional[int] = None
    kind: str = "assignment"
    urgent: bool = False
    reminder_state: str = "scheduled"


@router.get("/tasks", response_model=List[TaskItemOut], summary="Combined tasks and deadlines for current user")
def get_my_tasks(
    days: int = Query(60, ge=1, le=365),
    course_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns unified task list (assignments + notice deadlines)
    with days remaining, submitted status, and reminder state.
    """
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id
    today = date.today()

    tasks: List[TaskItemOut] = []

    if student:
        enrolled_courses = list(
            db.scalars(
                select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
            ).all()
        )
        if course_id:
            enrolled_courses = [c for c in enrolled_courses if c == course_id]

        if enrolled_courses:
            # 1. Assignments
            assignments = db.scalars(
                select(AssignmentModel).where(
                    AssignmentModel.course_id.in_(enrolled_courses),
                    AssignmentModel.is_published.is_(True),
                )
            ).all()

            # Submissions by student
            subs = db.scalars(
                select(SubmissionModel).where(SubmissionModel.student_id == user_id)
            ).all()
            sub_map = {s.assignment_id: s for s in subs}

            for a in assignments:
                due_d = a.due_at.date() if hasattr(a.due_at, 'date') else None
                days_rem = (due_d - today).days if due_d else None
                c = db.get(CourseModel, a.course_id)
                sub = sub_map.get(a.id)

                tasks.append(
                    TaskItemOut(
                        id=a.id,
                        type="assignment",
                        title=a.title,
                        course_code=c.code if c else "GEN",
                        course_name=c.name if c else "General Course",
                        due_at=a.due_at.isoformat() if a.due_at else None,
                        days_remaining=days_rem,
                        submitted=sub is not None,
                        submission_id=sub.id if sub else None,
                        kind="assignment",
                        urgent=days_rem is not None and 0 <= days_rem <= 2,
                        reminder_state="sent" if sub else ("scheduled" if days_rem and days_rem >= 0 else "missed"),
                    )
                )

        # 2. Notice deadlines
        from app.models.notice import (
            NoticeDeadlineModel,
            NoticeModel,
            NoticeRecipientModel,
        )
        try:
            recipient_records = db.scalars(
                select(NoticeRecipientModel).where(NoticeRecipientModel.user_id == user_id)
            ).all()
            notice_ids = [r.notice_id for r in recipient_records]
            if notice_ids:
                deadlines = db.scalars(
                    select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id.in_(notice_ids))
                ).all()
                done_map = {r.notice_id: r.done_at is not None for r in recipient_records}

                for nd in deadlines:
                    n = db.get(NoticeModel, nd.notice_id)
                    if not n or n.status == "archived":
                        continue
                    due_str = nd.at[:10] if nd.at else str(today)
                    try:
                        due_d = datetime.fromisoformat(due_str).date()
                        days_rem = (due_d - today).days
                    except Exception:
                        days_rem = None

                    tasks.append(
                        TaskItemOut(
                            id=10000 + nd.id,
                            type="notice",
                            title=f"[Notice] {nd.label}",
                            course_code="NOTICE",
                            course_name=n.title if n else "Notice",
                            due_at=nd.at,
                            days_remaining=days_rem,
                            submitted=done_map.get(nd.notice_id, False),
                            kind=nd.kind,
                            urgent=n.urgent if n else False,
                            reminder_state="done" if done_map.get(nd.notice_id) else "scheduled",
                        )
                    )
        except Exception:
            pass  # Notice tables might not be populated yet

    else:
        # Faculty: assignments for courses they teach (via CourseStaffModel)
        from app.models.course import CourseStaffModel
        staff_course_ids = list(db.scalars(
            select(CourseStaffModel.course_id).where(CourseStaffModel.user_id == user_id)
        ).all())
        if staff_course_ids:
            assignments = db.scalars(
                select(AssignmentModel).where(AssignmentModel.course_id.in_(staff_course_ids))
            ).all()
        else:
            assignments = []
        for a in assignments:
            due_d = a.due_at.date() if hasattr(a.due_at, 'date') else None
            days_rem = (due_d - today).days if due_d else None
            c = db.get(CourseModel, a.course_id)
            tasks.append(
                TaskItemOut(
                    id=a.id,
                    type="assignment",
                    title=a.title,
                    course_code=c.code if c else "GEN",
                    course_name=c.name if c else "Course",
                    due_at=a.due_at.isoformat() if a.due_at else None,
                    days_remaining=days_rem,
                    submitted=False,
                    kind="assignment",
                    urgent=days_rem is not None and 0 <= days_rem <= 2,
                    reminder_state="scheduled",
                )
            )

    # Sort: pending first by due date, then submitted
    tasks.sort(key=lambda t: (t.submitted, t.days_remaining if t.days_remaining is not None else 9999))
    return tasks


class TimetableSlotOut(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_name: str
    teacher_name: str
    room_name: Optional[str] = None
    day: int  # 0=Mon .. 5=Sat
    day_name: str
    period_label: str
    kind: str
    section: Optional[str] = "A"


DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.get("/timetable", response_model=List[TimetableSlotOut], summary="Get current user weekly timetable")
def get_my_timetable(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns weekly timetable slots (Monday to Saturday) for current user.
    """
    from app.models.timetable import (
        RoomModel,
        TimetableSlotModel,
        TimetableVersionModel,
    )
    user, student = _get_user_and_student(current_user, db)
    user_id = user.id

    # Find latest published version
    version = db.scalar(
        select(TimetableVersionModel)
        .where(TimetableVersionModel.status == "published")
        .order_by(TimetableVersionModel.id.desc())
    )

    slots: List[TimetableSlotModel] = []
    if version:
        if student:
            enrolled = list(
                db.scalars(
                    select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
                ).all()
            )
            slots = db.scalars(
                select(TimetableSlotModel).where(
                    TimetableSlotModel.version_id == version.id,
                    TimetableSlotModel.course_id.in_(enrolled),
                )
            ).all()
        else:
            slots = db.scalars(
                select(TimetableSlotModel).where(
                    TimetableSlotModel.version_id == version.id,
                    TimetableSlotModel.teacher_id == user_id,
                )
            ).all()

    # If no slots found in DB yet, generate synthetic weekly timetable from courses
    if not slots:
        courses = db.scalars(select(CourseModel).limit(6)).all()
        results: List[TimetableSlotOut] = []
        slot_id = 1
        periods = ["09:00 - 10:00", "10:00 - 11:00", "11:15 - 12:15", "12:15 - 13:15", "14:00 - 15:00"]
        for d in range(5):  # Mon-Fri
            c1 = courses[d % len(courses)]
            c2 = courses[(d + 1) % len(courses)]
            results.append(
                TimetableSlotOut(
                    id=slot_id,
                    course_id=c1.id,
                    course_code=c1.code,
                    course_name=c1.name,
                    teacher_name="Faculty Staff",
                    room_name="Room 101",
                    day=d,
                    day_name=DAY_LABELS[d],
                    period_label=periods[0],
                    kind="lecture",
                    section="A",
                )
            )
            slot_id += 1
            results.append(
                TimetableSlotOut(
                    id=slot_id,
                    course_id=c2.id,
                    course_code=c2.code,
                    course_name=c2.name,
                    teacher_name="Faculty Staff",
                    room_name="Lab 201",
                    day=d,
                    day_name=DAY_LABELS[d],
                    period_label=periods[2],
                    kind="lab" if d % 2 == 1 else "lecture",
                    section="A",
                )
            )
            slot_id += 1
        return results

    results = []
    for s in slots:
        c = db.get(CourseModel, s.course_id)
        t = db.get(UserModel, s.teacher_id)
        r = db.get(RoomModel, s.room_id) if s.room_id else None
        results.append(
            TimetableSlotOut(
                id=s.id,
                course_id=s.course_id,
                course_code=c.code if c else "GEN",
                course_name=c.name if c else "Course",
                teacher_name=t.name if t else "Faculty",
                room_name=r.name if r else "Room 101",
                day=s.day,
                day_name=DAY_LABELS[s.day] if 0 <= s.day < len(DAY_LABELS) else "Unknown",
                period_label=s.period_label,
                kind=s.kind,
                section=s.section or "A",
            )
        )
    return results
