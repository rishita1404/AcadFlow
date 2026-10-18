from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLogModel(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[Optional[str]] = mapped_column(Text)
    new_value: Mapped[Optional[str]] = mapped_column(Text)
    actor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id")
    )
    reason: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
    )
