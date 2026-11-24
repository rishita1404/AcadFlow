import logging
import os
import socket

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

logger = logging.getLogger("acadflow.db")

# To minimize site startup latency, use local persistent SQLite by default unless USE_POSTGRES=true
use_postgres_env = os.environ.get("USE_POSTGRES", "").lower() in ("true", "1", "yes")

sync_database_url = settings.DATABASE_URL
if sync_database_url.startswith("postgresql+asyncpg://"):
    sync_database_url = sync_database_url.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    )
elif sync_database_url.startswith("postgresql://"):
    sync_database_url = sync_database_url.replace(
        "postgresql://", "postgresql+psycopg://"
    )


is_connected = False
if use_postgres_env:
    try:
        connect_args = {"connect_timeout": 5}
        if "sslmode" not in sync_database_url and "supabase.co" in sync_database_url or "pooler.supabase.com" in sync_database_url:
            connect_args["sslmode"] = "require"
        engine = create_engine(
            sync_database_url, 
            echo=False, 
            pool_pre_ping=True,
            connect_args=connect_args
        )
        with engine.connect():
            is_connected = True
            logger.info("Connected to PostgreSQL successfully.")
    except Exception as e:
        is_connected = False
        logger.info("PostgreSQL unavailable (%s). Using local persistent SQLite (acadflow.db).", e)
else:
    logger.info("Using high-performance local persistent SQLite (acadflow.db).")

if not is_connected:
    from sqlalchemy import event

    db_file = os.environ.get(
        "ACADFLOW_DB_PATH",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "acadflow.db"))
    )
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False, "timeout": 30},
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
