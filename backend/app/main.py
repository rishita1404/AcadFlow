import asyncio
import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.middleware import SecurityHeadersMiddleware

logger = logging.getLogger("acadflow")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
    )

    # Security headers — must be added before CORS
    app.add_middleware(SecurityHeadersMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],   # Restrict in production via ALLOWED_ORIGINS env var
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.API_V1_STR)

    # ── Database Initialization & Background workers ──────────────────────────
    @app.on_event("startup")
    async def startup_event() -> None:
        """
        1. Ensure database tables are created.
        2. Auto-seed if database is empty.
        3. Launch background workers.
        """
        import os
        if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("TESTING"):
            return

        import app.models  # noqa: F401 - load all models
        from app.db.base import Base
        from app.db.postgres import SessionLocal, engine

        try:
            Base.metadata.create_all(bind=engine)
            with SessionLocal() as db:
                from sqlalchemy import select

                from app.models import UserModel
                first_user = db.scalar(select(UserModel.id).limit(1))
                if not first_user:
                    repo_root = Path(__file__).resolve().parent.parent.parent
                    if str(repo_root) not in sys.path:
                        sys.path.insert(0, str(repo_root))
                    from scripts.seed_data import seed_all
                    seed_all(session=db, engine=engine)
                    db.commit()
                    logger.info("Database auto-seeded with test accounts.")
        except Exception as e:
            logger.warning("Database startup init notice: %s", e)

        from app.workers.missed_submission_worker import run_missed_submission_worker
        from app.workers.reminder_worker import run_reminder_worker
        from app.workers.risk_worker import run_risk_recalculation_worker

        loop = asyncio.get_event_loop()
        loop.create_task(run_reminder_worker(), name="reminder_worker")
        loop.create_task(run_missed_submission_worker(), name="missed_submission_worker")
        loop.create_task(run_risk_recalculation_worker(), name="risk_worker")
        logger.info("Background workers started: reminder | missed_submission | risk")

    # ─────────────────────────────────────────────────────────────────────────

    @app.get("/")
    async def root():
        return {"message": "Welcome to AcadFlow API", "version": settings.VERSION}

    return app


app = create_app()
