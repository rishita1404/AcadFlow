"""
Notification Service — AcadFlow

Real database-backed notification CRUD and auto-generation.

Auto-generated notification triggers:
  - Buffer ≤ 2 classes  → 'warning'  (yellow)
  - Buffer ≤ 0 classes  → 'critical' (red)
  - Attendance pct < 75 → 'critical'
  - Assignment due in 3 days → 'reminder'
  - Assignment due in 1 day  → 'alert'
  - Missed submission        → 'warning'
  - Risk band change to 'At risk' / 'Critical' → 'alert' / 'critical'

Deduplication: one notification per (student, kind, dedup_key) per day.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import NotificationModel


# ─────────────────────────────────────────────────────────────────────────────
# Core CRUD helpers
# ─────────────────────────────────────────────────────────────────────────────


def _upsert_notification(
    db: Session,
    recipient_id: int,
    title: str,
    message: str,
    kind: str,
    dedup_key: str,
    course_id: Optional[int] = None,
    assignment_id: Optional[int] = None,
) -> Optional[NotificationModel]:
    """
    Create a notification if one with the same dedup_key doesn't already exist.
    Returns the new notification or None if it was a duplicate.
    """
    existing = db.scalar(
        select(NotificationModel).where(NotificationModel.dedup_key == dedup_key)
    )
    if existing:
        return None  # Already sent; avoid flooding

    notif = NotificationModel(
        recipient_id=recipient_id,
        title=title,
        message=message,
        kind=kind,
        course_id=course_id,
        assignment_id=assignment_id,
        is_read=False,
        created_at=datetime.now(timezone.utc),
        dedup_key=dedup_key,
    )
    db.add(notif)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return None  # Race condition duplicate
    return notif


# ─────────────────────────────────────────────────────────────────────────────
# Auto-trigger: Attendance Buffer Warnings
# ─────────────────────────────────────────────────────────────────────────────


def notify_attendance_buffer(
    db: Session,
    student_id: int,
    course_id: int,
    course_code: str,
    buffer: Optional[int],
    attendance_pct: Optional[float],
) -> None:
    """
    Generate buffer/attendance warnings after attendance changes.
    Called after any attendance mark or correction.
    """
    today_str = date.today().isoformat()

    if buffer is None:
        return  # Insufficient data; skip

    if buffer <= 0 or (attendance_pct is not None and attendance_pct < 75.0):
        kind = "critical"
        if buffer is not None and buffer < 0:
            title = f"⛔ Attendance Unrecoverable — {course_code}"
            msg = (
                f"Your attendance in {course_code} has dropped below the recovery point. "
                f"Current: {attendance_pct:.1f}% | Buffer: {buffer} (negative). "
                "Contact your faculty immediately."
            )
        else:
            title = f"🚨 Attendance Critical — {course_code}"
            msg = (
                f"Your attendance in {course_code} is {attendance_pct:.1f}% "
                f"with buffer = {buffer}. You cannot miss any more classes."
            )
        dedup_key = f"att_critical:{student_id}:{course_id}:{today_str}"
    elif buffer <= 2:
        kind = "warning"
        title = f"⚠️ Attendance Buffer Low — {course_code}"
        msg = (
            f"You can only miss {buffer} more class(es) in {course_code} "
            f"before falling below 75%. Current: {attendance_pct:.1f}%."
        )
        dedup_key = f"att_warning:{student_id}:{course_id}:{today_str}"
    else:
        return  # Buffer is healthy; no notification needed

    _upsert_notification(
        db=db,
        recipient_id=student_id,
        title=title,
        message=msg,
        kind=kind,
        dedup_key=dedup_key,
        course_id=course_id,
    )
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Auto-trigger: Deadline Reminders
# ─────────────────────────────────────────────────────────────────────────────


def notify_deadline_reminder(
    db: Session,
    student_id: int,
    assignment_id: int,
    assignment_title: str,
    course_code: str,
    course_id: int,
    due_at: datetime,
    days_remaining: int,
) -> None:
    """
    Generate a deadline reminder notification.
    Called by the reminder worker for each upcoming assignment.
    """
    if days_remaining <= 1:
        kind = "alert"
        title = f"🔔 Due Tomorrow — {assignment_title[:40]}"
        msg = (
            f"'{assignment_title}' for {course_code} is due in {days_remaining} day(s) "
            f"({due_at.strftime('%d %b %Y %H:%M')} UTC). Submit before the deadline!"
        )
    else:
        kind = "reminder"
        title = f"📅 Deadline in {days_remaining} days — {assignment_title[:35]}"
        msg = (
            f"Reminder: '{assignment_title}' for {course_code} is due in {days_remaining} day(s) "
            f"({due_at.strftime('%d %b %Y %H:%M')} UTC). Don't wait until the last minute."
        )

    dedup_date = due_at.date().isoformat()
    dedup_key = f"deadline:{student_id}:{assignment_id}:{days_remaining}:{dedup_date}"

    _upsert_notification(
        db=db,
        recipient_id=student_id,
        title=title,
        message=msg,
        kind=kind,
        dedup_key=dedup_key,
        course_id=course_id,
        assignment_id=assignment_id,
    )
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Auto-trigger: Missed Submission
# ─────────────────────────────────────────────────────────────────────────────


def notify_missed_submission(
    db: Session,
    student_id: int,
    assignment_id: int,
    assignment_title: str,
    course_code: str,
    course_id: int,
) -> None:
    """Notify student that an assignment was marked missed."""
    dedup_key = f"missed_sub:{student_id}:{assignment_id}"
    _upsert_notification(
        db=db,
        recipient_id=student_id,
        title=f"❌ Missed Submission — {assignment_title[:40]}",
        message=(
            f"You missed the submission for '{assignment_title}' in {course_code}. "
            "This negatively impacts your risk score. Contact your instructor if you need an extension."
        ),
        kind="warning",
        dedup_key=dedup_key,
        course_id=course_id,
        assignment_id=assignment_id,
    )
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Auto-trigger: Risk Band Change Alert
# ─────────────────────────────────────────────────────────────────────────────


def notify_risk_band_change(
    db: Session,
    student_id: int,
    course_id: int,
    course_code: str,
    old_band: str,
    new_band: str,
    score: float,
) -> None:
    """Notify student when their risk band worsens."""
    band_order = {"Safe": 0, "Watch": 1, "At risk": 2, "Critical": 3}
    old_rank = band_order.get(old_band, 0)
    new_rank = band_order.get(new_band, 0)

    if new_rank <= old_rank:
        return  # Band improved or unchanged; no alert needed

    kind = "critical" if new_band == "Critical" else "alert"
    today_str = date.today().isoformat()
    dedup_key = f"risk_band:{student_id}:{course_id}:{new_band}:{today_str}"

    emoji = "🆘" if new_band == "Critical" else "⚠️"
    _upsert_notification(
        db=db,
        recipient_id=student_id,
        title=f"{emoji} Risk Band Changed — {course_code}",
        message=(
            f"Your academic risk in {course_code} has escalated from "
            f"'{old_band}' to '{new_band}' (score: {score:.1f}/100). "
            "Review your attendance and pending assignments immediately."
        ),
        kind=kind,
        dedup_key=dedup_key,
        course_id=course_id,
    )
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Batch: Run all deadline reminders for a student
# ─────────────────────────────────────────────────────────────────────────────


def dispatch_deadline_reminders_for_student(
    db: Session,
    student_id: int,
    enrolled_course_ids: list[int],
) -> int:
    """
    Scan all upcoming assignments for a student and dispatch reminders.
    Returns count of notifications created.
    """
    from app.models import AssignmentModel, CourseModel, SubmissionModel

    now = datetime.now(timezone.utc)
    created = 0

    for course_id in enrolled_course_ids:
        course = db.get(CourseModel, course_id)
        if not course:
            continue

        assignments = db.scalars(
            select(AssignmentModel).where(
                AssignmentModel.course_id == course_id,
                AssignmentModel.is_published == True,  # noqa: E712
                AssignmentModel.due_at >= now,
                AssignmentModel.due_at <= now + timedelta(days=3),
            )
        ).all()

        for asgn in assignments:
            due = asgn.due_at
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)

            # Skip if already submitted
            existing_sub = db.scalar(
                select(SubmissionModel).where(
                    SubmissionModel.assignment_id == asgn.id,
                    SubmissionModel.student_id == student_id,
                    SubmissionModel.status.in_(["on_time", "late"]),
                )
            )
            if existing_sub:
                continue

            days_left = max(0, (due - now).days)
            notif = _upsert_notification(
                db=db,
                recipient_id=student_id,
                title=f"📅 Due in {days_left + 1} day(s) — {asgn.title[:40]}",
                message=(
                    f"'{asgn.title}' for {course.code} is due on "
                    f"{due.strftime('%d %b %Y %H:%M')} UTC."
                ),
                kind="alert" if days_left == 0 else "reminder",
                dedup_key=f"deadline:{student_id}:{asgn.id}:{days_left}:{due.date().isoformat()}",
                course_id=course_id,
                assignment_id=asgn.id,
            )
            if notif:
                created += 1

    if created:
        db.commit()
    return created
