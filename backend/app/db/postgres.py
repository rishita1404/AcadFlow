from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Ensure sync psycopg driver for PostgreSQL 16
sync_database_url = settings.DATABASE_URL
if sync_database_url.startswith("postgresql+asyncpg://"):
    sync_database_url = sync_database_url.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    )
elif sync_database_url.startswith("postgresql://"):
    sync_database_url = sync_database_url.replace(
        "postgresql://", "postgresql+psycopg://"
    )

engine = create_engine(sync_database_url, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
