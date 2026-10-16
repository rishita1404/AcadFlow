from typing import Any, Generator
from sqlalchemy.orm import Session

from app.db.postgres import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Provide a transactional sync database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def can_access(user: Any, action: str, resource: Any) -> bool:
    """STUB permission check.

    TODO: Security teammate (Himanshi) will replace this with real scope-based
    access control (can_access check).
    """
    return True
