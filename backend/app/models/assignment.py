from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AssignmentModel(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('assignment', 'lab file', 'review', 'exam')",
            name="check_assignment_kind",
        ),
        Index("ix_assignments_course_id_due_at", "course_id", "due_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    grace_hours: Mapped[int] = mapped_column(Integer, default=48, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
