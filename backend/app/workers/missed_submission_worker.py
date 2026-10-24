"""
Missed Submission Worker — AcadFlow

Background worker that periodically scans for assignments whose hard deadline
(due_at + grace_hours) has passed and marks any missing submissions as 'missed'.

Also dispatches a missed-submission notification to the student.

Run interval: every 1 hour (configured via MISSED_SUB_INTERVAL_HOURS env var).

Called from: backend/app/main.py on startup (asyncio background task).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("missed_submission_worker")

INTERVAL_HOURS = int(os.getenv("MISSED_SUB_INTERVAL_HOURS", "1"))


async def run_missed_submission_worker() -> None:
    """
    Background loop: mark missed submissions and send notifications every N hours.
    """
    logger.info("Missed submission worker started (interval=%dh).", INTERVAL_HOURS)

    from sqlalchemy import select

    from app.db.postgres import SessionLocal
    from app.models import (
        AssignmentModel,
        CourseModel,
        EnrolmentModel,
        SubmissionModel,
    )
    from app.services.notification_service import notify_missed_submission

    while True:
        try:
            with SessionLocal() as db:
                now = datetime.now(timezone.utc)
                marked_count = 0

                # Find all published assignments whose hard deadline has passed
                assignments = db.scalars(
                    select(AssignmentModel).where(
                        AssignmentModel.is_published == True,  # noqa: E712
                    )
                ).all()

                for asgn in assignments:
                    due = asgn.due_at
                    if due.tzinfo is None:
                        due = due.replace(tzinfo=timezone.utc)
                    hard_deadline = due + timedelta(hours=asgn.grace_hours)

                    if hard_deadline >= now:
                        continue  # Still within grace period

                    # Get all enrolled students for this course
                    enrolled_ids = list(
                        db.scalars(
                            select(EnrolmentModel.student_id).where(
                                EnrolmentModel.course_id == asgn.course_id
                            )
                        ).all()
                    )

                    for sid in enrolled_ids:
                        # Check if submission already exists (any status)
                        existing = db.scalar(
                            select(SubmissionModel).where(
                                SubmissionModel.assignment_id == asgn.id,
                                SubmissionModel.student_id == sid,
                            )
                        )

                        if existing:
                            continue  # Already submitted (or already missed)

                        # Create 'missed' submission record
                        missed_sub = SubmissionModel(
                            assignment_id=asgn.id,
                            student_id=sid,
                            version=1,
                            status="missed",
                            submitted_at=None,
                            file_key=None,
                            file_hash=None,
                            dedupe_key=f"missed:{asgn.id}:{sid}",
                        )
                        try:
                            db.add(missed_sub)
                            db.flush()
                            marked_count += 1

                            # Dispatch notification
                            course = db.get(CourseModel, asgn.course_id)
                            notify_missed_submission(
                                db=db,
                                student_id=sid,
                                assignment_id=asgn.id,
                                assignment_title=asgn.title,
                                course_code=course.code if course else "",
                                course_id=asgn.course_id,
                            )
                        except Exception:
                            db.rollback()

                db.commit()

                logger.info(
                    "[%s] Missed submission worker: %d new 'missed' records created.",
                    now.strftime("%Y-%m-%d %H:%M UTC"),
                    marked_count,
                )

        except Exception as exc:
            logger.error("Missed submission worker loop error: %s", exc)

        await asyncio.sleep(INTERVAL_HOURS * 3600)
