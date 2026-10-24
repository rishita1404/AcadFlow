import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

logger = logging.getLogger("acadflow.db")

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
try:
    engine = create_engine(sync_database_url, echo=False)
    with engine.connect():
        is_connected = True
        logger.info("Connected to PostgreSQL successfully.")
except Exception as e:
    is_connected = False
    logger.warning("PostgreSQL connection failed (%s). Falling back to local persistent SQLite (acadflow.db).", e)

if not is_connected:
    db_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "acadflow.db"))
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
        echo=False,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
