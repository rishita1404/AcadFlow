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
from datetime import date
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


def derive_lecture_no_from_timetable(
    db: Session,
    course_id: int,
    held_on: date,
    section: Optional[str] = None,
) -> int:
    """Derive 1-based lecture_no from the latest published timetable slot for (course, weekday)."""
    from app.models.timetable import TimetableSlotModel, TimetableVersionModel

    q = (
        select(TimetableSlotModel.period_label)
        .join(TimetableVersionModel, TimetableSlotModel.version_id == TimetableVersionModel.id)
        .where(
            TimetableVersionModel.status == "published",
            TimetableSlotModel.course_id == course_id,
            TimetableSlotModel.day == held_on.weekday(),
        )
        .order_by(TimetableVersionModel.id.desc())
    )
    if section:
        q = q.where(TimetableSlotModel.section == section)
    lbl = db.scalar(q)
    if lbl:
        digits = "".join(ch for ch in str(lbl) if ch.isdigit())
        if digits:
            return int(digits)
    return 1


def _parse_leave_lectures(raw_val) -> set[int]:
    if not raw_val:
        return set()
    if isinstance(raw_val, list):
        return {int(x) for x in raw_val if str(x).strip().isdigit()}
    import json
    try:
        parsed = json.loads(str(raw_val))
        if isinstance(parsed, list):
            return {int(x) for x in parsed if str(x).strip().isdigit()}
    except Exception:
        pass
    return {int(p.strip()) for p in str(raw_val).split(",") if p.strip().isdigit()}


def _leave_covers_session(leave_row, held_on: date, lecture_no: int) -> bool:
    mode = getattr(leave_row, "mode", None) or "full_day"
    if mode == "lectures":
        if leave_row.date_from != held_on:
            return False
        lectures = _parse_leave_lectures(getattr(leave_row, "lecture_nos", None))
        return int(lecture_no or 1) in lectures
    return leave_row.date_from <= held_on <= leave_row.date_to


def _get_leave_count_flags(db: Session) -> tuple[bool, bool]:
    from app.core.config import settings
    from app.models.risk import RiskConfigModel

    cfg = db.scalar(select(RiskConfigModel).order_by(RiskConfigModel.id.desc()))
    dl_enabled = settings.LEAVE_DL_COUNTS_AS_PRESENT
    ml_enabled = settings.LEAVE_ML_COUNTS_AS_PRESENT
    if cfg is not None:
        if getattr(cfg, "leave_dl_counts_as_present", None) is not None:
            dl_enabled = bool(cfg.leave_dl_counts_as_present)
        if getattr(cfg, "leave_ml_counts_as_present", None) is not None:
            ml_enabled = bool(cfg.leave_ml_counts_as_present)
    return dl_enabled, ml_enabled


def compute_leave_counts_for_course(
    db: Session,
    student_id: int,
    course_id: int,
    enrolled_on: Optional[date] = None,
) -> dict:
    """
    Compute approved DL/ML sessions that count as present for a student in a course.
    Rule: A session counts as leave-present ONLY when the student's attendance
    record for that session is 'absent' AND an approved leave covers that date
    (and lecture_no in 'lectures' mode). Held and total_classes never change.
    """
    from app.models.leave import LeaveRequestModel

    dl_enabled, ml_enabled = _get_leave_count_flags(db)
    if not dl_enabled and not ml_enabled:
        return {
            "dl_counted": 0,
            "ml_counted": 0,
            "leave_counted": 0,
            "dl_session_ids": set(),
            "ml_session_ids": set(),
            "session_leave_type": {},
        }

    approved_leaves = db.scalars(
        select(LeaveRequestModel).where(
            LeaveRequestModel.student_id == student_id,
            LeaveRequestModel.status == "approved",
        )
    ).all()
    if not approved_leaves:
        return {
            "dl_counted": 0,
            "ml_counted": 0,
            "leave_counted": 0,
            "dl_session_ids": set(),
            "ml_session_ids": set(),
            "session_leave_type": {},
        }

    absent_q = (
        select(
            ClassSessionModel.id,
            ClassSessionModel.held_on,
            ClassSessionModel.lecture_no,
        )
        .join(
            AttendanceRecordModel,
            AttendanceRecordModel.session_id == ClassSessionModel.id,
        )
        .where(
            ClassSessionModel.course_id == course_id,
            ClassSessionModel.is_cancelled.is_(False),
            AttendanceRecordModel.student_id == student_id,
            AttendanceRecordModel.status == "absent",
        )
    )
    if enrolled_on:
        absent_q = absent_q.where(ClassSessionModel.held_on >= enrolled_on)

    dl_session_ids: set[int] = set()
    ml_session_ids: set[int] = set()
    session_leave_type: dict[int, str] = {}

    for sid, held_on, lecture_no in db.execute(absent_q).all():
        lec = int(lecture_no or 1)
        matched_type = None
        for lv in approved_leaves:
            if lv.type == "duty" and not dl_enabled:
                continue
            if lv.type == "medical" and not ml_enabled:
                continue
            if _leave_covers_session(lv, held_on, lec):
                matched_type = lv.type
                if lv.type == "duty":
                    break
        if matched_type == "duty":
            dl_session_ids.add(sid)
            session_leave_type[sid] = "DL"
        elif matched_type == "medical":
            ml_session_ids.add(sid)
            session_leave_type[sid] = "ML"

    return {
        "dl_counted": len(dl_session_ids),
        "ml_counted": len(ml_session_ids),
        "leave_counted": len(dl_session_ids) + len(ml_session_ids),
        "dl_session_ids": dl_session_ids,
        "ml_session_ids": ml_session_ids,
        "session_leave_type": session_leave_type,
    }


def get_student_course_attendance(
    db: Session,
    student_id: int,
    course_id: int,
    min_classes: Optional[int] = None,
) -> Dict[str, Optional[float | int | bool | str]]:
    """
    Compute authoritative attendance and buffer statistics for one student in one course.

    Approved DL/ML counts as present only for sessions where the student was marked absent.
    Held and total_classes do not change.
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

    # Count conducted, non-cancelled sessions (held does NOT change with leave)
    held_query = select(func.count(ClassSessionModel.id)).where(
        ClassSessionModel.course_id == course_id,
        ClassSessionModel.is_cancelled.is_(False),
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
            ClassSessionModel.is_cancelled.is_(False),
            AttendanceRecordModel.student_id == student_id,
            AttendanceRecordModel.status.in_(["present", "late"]),
        )
    )
    if enrolled_on:
        attended_query = attended_query.where(ClassSessionModel.held_on >= enrolled_on)
    present_and_late: int = db.scalar(attended_query) or 0

    leave_info = compute_leave_counts_for_course(
        db=db, student_id=student_id, course_id=course_id, enrolled_on=enrolled_on
    )
    dl_counted = leave_info["dl_counted"]
    ml_counted = leave_info["ml_counted"]
    leave_counted = leave_info["leave_counted"]
    attended = present_and_late + leave_counted

    min_required_sessions = _get_min_classes(db, min_classes)

    required = math.ceil(DEFAULT_THRESHOLD * total_classes)
    remaining = max(0, total_classes - held)

    # Minimum evidence rule: held < min_classes or held == 0 -> insufficient data
    if held < min_required_sessions or held == 0:
        return {
            "held": held,
            "attended": attended,
            "present_count": present_and_late,
            "dl_counted": dl_counted,
            "ml_counted": ml_counted,
            "leave_counted": leave_counted,
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
        status_message = "Your cushion: 0 classes, kept in reserve for illness and emergencies"
    else:
        status_message = f"Your cushion: {buffer} class{'es' if buffer != 1 else ''}, kept in reserve for illness and emergencies"

    return {
        "held": held,
        "attended": attended,
        "present_count": present_and_late,
        "dl_counted": dl_counted,
        "ml_counted": ml_counted,
        "leave_counted": leave_counted,
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


def get_department_attendance_summary(db: Session, department_id: int) -> Dict:
    """
    Aggregates department-wide attendance, risk breakdown, and course standings.
    Reads exclusively from real database records.
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

    # Calculate per-course standings
    course_standings = []
    for c in courses:
        c_summary = get_course_attendance_summary(db, c.id)
        course_standings.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "enrolled_count": c_summary["enrolled"],
            "students_with_data": c_summary["students_with_data"],
            "avg_attendance": c_summary["avg_attendance_pct"],
        })

    # Calculate per-student overall attendance and bands
    student_pcts: List[float] = []
    safe_count = 0
    watch_count = 0
    at_risk_count = 0
    critical_count = 0

    for sid in student_rows:
        overall = get_student_overall_attendance(db, sid)
        pct = overall.get("overall_attendance_pct")
        if pct is not None:
            student_pcts.append(float(pct))

        # Check latest risk snapshot band
        snap = db.scalar(
            select(RiskSnapshotModel)
            .where(RiskSnapshotModel.student_id == sid)
            .order_by(RiskSnapshotModel.computed_at.desc())
        )
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


def get_needs_attention_for_faculty(
    db: Session,
    user: dict,
    course_id: Optional[int] = None,
) -> List[dict]:
    """
    Phase 5: Retrieve students who need attention this week:
    - Missed 2 or more consecutive classes in a course, OR
    - Dropped a risk band since last week (e.g. Safe -> Watch, Watch -> Needs support).

    Scoped strictly to the faculty's assigned courses or mentor's mentees.
    Returns details on what changed and supportive suggested next steps.
    """
    from datetime import timedelta

    from app.core.errors import ForbiddenError, NotFoundError
    from app.models.course import CourseStaffModel
    from app.models.leave import LeaveRequestModel
    from app.models.user import MentorAssignmentModel

    actor_id = int(user["sub"]) if "sub" in user else user.get("id")
    user_role = user.get("role", "")

    if user_role == "student":
        raise ForbiddenError("Students cannot view faculty attention lists.")

    # 1. Determine scoped courses
    if course_id is not None:
        course = db.get(CourseModel, course_id)
        if not course:
            raise NotFoundError(f"Course {course_id} not found")
        if user_role in ("faculty", "trainer"):
            is_assigned = (
                db.scalar(
                    select(CourseStaffModel).where(
                        CourseStaffModel.course_id == course_id,
                        CourseStaffModel.user_id == actor_id,
                    )
                ) is not None
            )
            if not is_assigned:
                raise ForbiddenError("You are not assigned to instruct or view attention lists for this course.")
        target_courses = [course]
    else:
        if user_role in ("faculty", "trainer"):
            staff_course_ids = set(
                db.scalars(
                    select(CourseStaffModel.course_id).where(
                        CourseStaffModel.user_id == actor_id
                    )
                ).all()
            )
            query = select(CourseModel).where(CourseModel.id.in_(staff_course_ids))
            target_courses = list(db.scalars(query).all())
        else:
            target_courses = list(db.scalars(select(CourseModel)).all())

    # Mentor mentee filter if user is mentor and not instructor
    mentee_ids = set()
    if user_role == "mentor":
        mentee_ids = set(
            db.scalars(
                select(MentorAssignmentModel.student_id).where(
                    MentorAssignmentModel.mentor_id == actor_id
                )
            ).all()
        )

    results: List[dict] = []
    seen_student_course = set()

    # Preload approved leaves to avoid penalizing students on approved medical or duty leave
    approved_leaves = db.scalars(
        select(LeaveRequestModel).where(LeaveRequestModel.status == "approved")
    ).all()

    def _is_on_approved_leave(stu_id: int, s_date, lecture_no: int = 1) -> bool:
        for lv in approved_leaves:
            if lv.student_id == stu_id and _leave_covers_session(lv, s_date, lecture_no):
                return True
        return False

    BAND_RANK = {
        "safe": 0,
        "watch": 1,
        "at risk": 2,
        "at_risk": 2,
        "risk": 2,
        "critical": 3,
        "needs support": 3,
        "needs_support": 3,
    }

    for course in target_courses:
        is_instructor = db.scalar(
            select(CourseStaffModel).where(
                CourseStaffModel.course_id == course.id,
                CourseStaffModel.user_id == actor_id,
            )
        ) is not None
        # Enrolled students
        enrollment_query = (
            select(StudentModel, UserModel)
            .join(UserModel, UserModel.id == StudentModel.user_id)
            .join(EnrolmentModel, EnrolmentModel.student_id == StudentModel.user_id)
            .where(EnrolmentModel.course_id == course.id)
        )
        enrolled_pairs = db.execute(enrollment_query).all()

        # Sessions for this course (ordered most recent first)
        sessions = list(
            db.scalars(
                select(ClassSessionModel)
                .where(
                    ClassSessionModel.course_id == course.id,
                    ClassSessionModel.is_cancelled.is_(False),
                )
                .order_by(ClassSessionModel.held_on.desc())
            ).all()
        )

        session_ids = [s.id for s in sessions]
        attendance_map = {}
        if session_ids:
            records = db.scalars(
                select(AttendanceRecordModel).where(
                    AttendanceRecordModel.session_id.in_(session_ids)
                )
            ).all()
            for r in records:
                attendance_map[(r.student_id, r.session_id)] = r.status

        for student, user_obj in enrolled_pairs:
            stu_id = student.user_id
            pair_key = (stu_id, course.id)
            if pair_key in seen_student_course:
                continue

            # If mentor, filter to mentees unless user also teaches the course
            if user_role == "mentor" and mentee_ids and stu_id not in mentee_ids:
                if not is_instructor:
                    continue

            # 1. Consecutive absence check
            consecutive_count = 0
            missed_dates = []
            for sess in sessions:
                # If session is covered by approved leave, it counts as present (breaks absence streak)
                if _is_on_approved_leave(stu_id, sess.held_on, getattr(sess, "lecture_no", 1)):
                    break

                st = attendance_map.get((stu_id, sess.id))
                if st == "absent":
                    consecutive_count += 1
                    missed_dates.append(sess.held_on)
                elif st in ("present", "late"):
                    # Streak broken
                    break
                else:
                    # Unrecorded session, continue checking
                    continue

            has_consecutive = consecutive_count >= 2

            # 2. Risk band drop check
            snaps = list(
                db.scalars(
                    select(RiskSnapshotModel)
                    .where(RiskSnapshotModel.student_id == stu_id)
                    .order_by(RiskSnapshotModel.computed_at.desc())
                ).all()
            )

            has_dropped_band = False
            prev_band_str = None
            curr_band_str = None
            if len(snaps) >= 2:
                curr_snap = snaps[0]
                target_cutoff = curr_snap.computed_at - timedelta(days=5)
                prev_snap = next(
                    (s for s in snaps[1:] if s.computed_at <= target_cutoff),
                    snaps[1],
                )
                curr_rank = BAND_RANK.get(curr_snap.band.lower(), 0)
                prev_rank = BAND_RANK.get(prev_snap.band.lower(), 0)
                if curr_rank > prev_rank:
                    has_dropped_band = True
                    curr_band_str = curr_snap.band
                    prev_band_str = prev_snap.band
                else:
                    curr_band_str = curr_snap.band
                    prev_band_str = prev_snap.band
            elif len(snaps) == 1:
                curr_band_str = snaps[0].band

            if has_consecutive or has_dropped_band:
                seen_student_course.add(pair_key)
                reasons = []
                what_parts = []
                if has_consecutive:
                    reasons.append("consecutive_absences")
                    fmt_dates = [
                        d.strftime("%b %d") if hasattr(d, "strftime") else str(d)
                        for d in missed_dates[:2]
                    ]
                    what_parts.append(
                        f"Missed {consecutive_count} consecutive classes ({', '.join(fmt_dates)})"
                    )
                if has_dropped_band:
                    reasons.append("band_drop")
                    pb_label = (
                        "Needs support"
                        if prev_band_str and prev_band_str.lower() in ("critical", "needs support", "needs_support")
                        else (prev_band_str or "Watch")
                    )
                    cb_label = (
                        "Needs support"
                        if curr_band_str and curr_band_str.lower() in ("critical", "needs support", "needs_support")
                        else (curr_band_str or "Needs support")
                    )
                    what_parts.append(f"Risk band dropped from {pb_label} to {cb_label} since last week")

                display_band = (
                    "Needs support"
                    if curr_band_str and curr_band_str.lower() in ("critical", "needs support", "needs_support")
                    else (curr_band_str or "Watch")
                )

                if display_band == "Needs support" or has_dropped_band:
                    step = "Schedule an in-person discussion or log an intervention"
                elif has_consecutive:
                    step = "Reach out to check in on recent missed classes"
                else:
                    step = "Review attendance cushion and check in"

                results.append({
                    "student_id": stu_id,
                    "roll_no": student.roll_no,
                    "name": user_obj.name,
                    "email": user_obj.email,
                    "course_id": course.id,
                    "course_code": course.code,
                    "course_name": course.name,
                    "current_band": curr_band_str or "Watch",
                    "current_band_label": display_band,
                    "previous_band": prev_band_str,
                    "consecutive_absences": consecutive_count,
                    "missed_dates": [str(d) for d in missed_dates],
                    "reasons": reasons,
                    "what_changed": "; ".join(what_parts),
                    "suggested_next_step": step,
                    "score": float(snaps[0].score) if snaps else None,
                })

    # Sort results: Critical / Needs support first, then by consecutive absences descending
    results.sort(
        key=lambda x: (
            0 if x["current_band_label"] == "Needs support" else 1,
            -x["consecutive_absences"],
        )
    )
    return results

