"""
Deadline Reminder Service — AcadFlow

Scans all enrolled students' upcoming assignments and dispatches
real DB-backed notification reminders.

Called by:
  - reminder_worker.py (background task)
  - POST /me/check-reminders (on-demand for current user)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssignmentModel, CourseModel, EnrolmentModel, SubmissionModel
from app.services.notification_service import notify_deadline_reminder


async def dispatch_deadline_reminders(db: Session, student_id: int) -> int:
    """
    Check upcoming assignment deadlines for a student and dispatch DB notifications.

    Parameters
    ----------
    db         : active SQLAlchemy session
    student_id : student's user_id to check

    Returns
    -------
    Number of new reminders dispatched
    """
    now = datetime.now(timezone.utc)
    dispatched = 0

    enrolled_courses: list[int] = list(
        db.scalars(
            select(EnrolmentModel.course_id).where(
                EnrolmentModel.student_id == student_id
            )
        ).all()
    )

    if not enrolled_courses:
        return 0

    # Check assignments due in the next 3 days
    window = now + timedelta(days=3)

    assignments = db.scalars(
        select(AssignmentModel).where(
            AssignmentModel.course_id.in_(enrolled_courses),
            AssignmentModel.is_published == True,  # noqa: E712
            AssignmentModel.due_at >= now,
            AssignmentModel.due_at <= window,
        )
    ).all()

    for asgn in assignments:
        due = asgn.due_at
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        # Skip if already submitted
        existing = db.scalar(
            select(SubmissionModel).where(
                SubmissionModel.assignment_id == asgn.id,
                SubmissionModel.student_id == student_id,
                SubmissionModel.status.in_(["on_time", "late", "excused"]),
            )
        )
        if existing:
            continue

        days_left = max(0, (due.date() - now.date()).days)
        course = db.get(CourseModel, asgn.course_id)
        course_code = course.code if course else f"course_{asgn.course_id}"

        notify_deadline_reminder(
            db=db,
            student_id=student_id,
            assignment_id=asgn.id,
            assignment_title=asgn.title,
            course_code=course_code,
            course_id=asgn.course_id,
            due_at=due,
            days_remaining=days_left,
        )
        dispatched += 1

    return dispatched
