"""
Risk Recalculation Worker — AcadFlow

Background worker that periodically recalculates risk snapshots for all enrolled
students across all courses and persists them to the risk_snapshots table.

Run interval: every 12 hours (configured via RISK_WORKER_INTERVAL_HOURS env var).
Called from: backend/app/main.py on startup (asyncio background task).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("risk_worker")

INTERVAL_HOURS = int(os.getenv("RISK_WORKER_INTERVAL_HOURS", "12"))


async def run_risk_recalculation_worker() -> None:
    """
    Background loop: recalculate all student-course risk snapshots every N hours.
    """
    logger.info("Risk recalculation worker started (interval=%dh).", INTERVAL_HOURS)

    from app.db.postgres import SessionLocal
    from app.models import EnrolmentModel
    from app.services.risk_data import persist_risk_snapshot
    from sqlalchemy import select

    while True:
        try:
            with SessionLocal() as db:
                enrolments = db.execute(
                    select(EnrolmentModel.student_id, EnrolmentModel.course_id)
                ).all()

                success = 0
                errors = 0
                for student_id, course_id in enrolments:
                    try:
                        persist_risk_snapshot(db, student_id, course_id)
                        success += 1
                    except Exception as exc:
                        errors += 1
                        logger.debug(
                            "Risk snapshot failed student=%d course=%d: %s",
                            student_id, course_id, exc,
                        )

                logger.info(
                    "[%s] Risk worker: %d snapshots updated, %d errors.",
                    datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                    success,
                    errors,
                )

        except Exception as exc:
            logger.error("Risk worker loop error: %s", exc)

        await asyncio.sleep(INTERVAL_HOURS * 3600)
