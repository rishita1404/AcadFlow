from typing import Any, Generator

from sqlalchemy.orm import Session

from app.core.authorization import can_access as auth_can_access
from app.db.postgres import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Provide a transactional sync database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def can_access(user: Any, action: str, resource: Any = None) -> bool:
    """Central RBAC check.

    Delegates to app.core.authorization.can_access when a user is provided.
    If user is None (unauthenticated development / backward compatibility),
    returns True so development requests without auth pass through.
    """
    if user is None:
        return True
    return auth_can_access(user, action, resource)
