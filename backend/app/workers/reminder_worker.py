"""
Reminder Worker — AcadFlow

Background worker that periodically scans for upcoming assignment deadlines
and dispatches DB-backed notification reminders to all enrolled students.

Run interval: every 6 hours (configured via REMINDER_INTERVAL_HOURS env var).

Called from: backend/app/main.py on startup (asyncio background task).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("reminder_worker")

INTERVAL_HOURS = int(os.getenv("REMINDER_INTERVAL_HOURS", "6"))


async def run_reminder_worker() -> None:
    """
    Background loop: dispatch deadline reminders for all students every N hours.
    """
    logger.info("Reminder worker started (interval=%dh).", INTERVAL_HOURS)

    # Import here to avoid circular imports at module load time
    from app.db.postgres import SessionLocal
    from app.models import EnrolmentModel, StudentModel
    from app.services.reminders import dispatch_deadline_reminders
    from sqlalchemy import select

    while True:
        try:
            with SessionLocal() as db:
                # Fetch all student IDs
                student_ids = list(db.scalars(select(StudentModel.user_id)).all())
                total_dispatched = 0

                for sid in student_ids:
                    try:
                        count = await dispatch_deadline_reminders(db, sid)
                        total_dispatched += count
                    except Exception as exc:
                        logger.warning(
                            "Reminder dispatch failed for student %d: %s", sid, exc
                        )

                logger.info(
                    "[%s] Reminder worker: %d students scanned, %d reminders sent.",
                    datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                    len(student_ids),
                    total_dispatched,
                )

        except Exception as exc:
            logger.error("Reminder worker loop error: %s", exc)

        await asyncio.sleep(INTERVAL_HOURS * 3600)
