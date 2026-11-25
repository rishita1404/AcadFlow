import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.db.mongo import mongo_client
from app.db.postgres import engine, sync_database_url
from app.db.postgres import is_connected as pg_connected
from app.db.redis import DummyRedis, redis_client

logger = logging.getLogger("acadflow.health")
router = APIRouter()

# Populated by app.main on startup
worker_tasks: dict = {}


@router.get("", tags=["Health"])
@router.get("/", tags=["Health"])
def get_health():
    """Health check endpoint."""
    return {"status": "ok"}


@router.get("/ready", tags=["Health"])
async def get_readiness():
    """Readiness probe reporting database, MongoDB, Redis, and background worker status."""
    db_status = {"ok": False, "backend": "postgresql" if pg_connected else "sqlite"}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status["ok"] = True
        db_status["target"] = sync_database_url.split("@")[-1] if pg_connected else str(engine.url)
    except Exception as exc:
        logger.warning("Readiness DB check failed: %s", exc)
        db_status["error"] = str(exc)

    mongo_status = {"ok": False}
    if mongo_client is not None:
        try:
            await mongo_client.admin.command("ping")
            mongo_status["ok"] = True
        except Exception as exc:
            logger.warning("Readiness MongoDB ping failed: %s", exc)
            mongo_status["error"] = str(exc)
    else:
        mongo_status["error"] = "MongoDB client not initialized"

    redis_status = {"ok": False}
    if redis_client is not None and not isinstance(redis_client, DummyRedis):
        try:
            await redis_client.ping()
            redis_status["ok"] = True
        except Exception as exc:
            logger.warning("Readiness Redis ping failed: %s", exc)
            redis_status["error"] = str(exc)
    else:
        redis_status["error"] = "Redis unavailable (using in-memory fallback)"

    workers_status = {}
    for name, task in worker_tasks.items():
        workers_status[name] = {
            "running": task is not None and not task.done(),
            "done": task.done() if task is not None else True,
        }

    return {
        "status": "ready" if db_status["ok"] else "degraded",
        "database": db_status,
        "mongodb": mongo_status,
        "redis": redis_status,
        "workers": workers_status,
    }
