"""
Notification Model — AcadFlow (full implementation replacing stub)

Stores real-time alerts for students and faculty:
- Attendance buffer warnings (yellow / red)
- Deadline reminders (3-day, 1-day, overdue)
- Risk band change alerts
- Missed submission alerts
- Bulk attendance upload results

kind values: 'warning' | 'reminder' | 'alert' | 'info' | 'critical'
"""

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


class NotificationModel(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('warning', 'reminder', 'alert', 'info', 'critical')",
            name="check_notification_kind",
        ),
        Index("ix_notifications_recipient_created", "recipient_id", "created_at"),
        Index("ix_notifications_recipient_unread", "recipient_id", "is_read"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    # Optional references for deep-linking
    course_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    assignment_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # Deduplication: prevents flooding the same alert
    dedup_key: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, unique=True
    )
