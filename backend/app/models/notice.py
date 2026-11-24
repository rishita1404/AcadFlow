from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NoticeModel(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), default="general")  # form, hackathon, exam, circular, event, other
    priority: Mapped[str] = mapped_column(String(20), default="normal")   # normal / important
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="sent")  # draft / sent / archived
    audience_spec: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON spec
    audience_summary: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_correction_for_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("notices.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NoticeRecipientModel(Base):
    __tablename__ = "notice_recipients"

    notice_id: Mapped[int] = mapped_column(Integer, ForeignKey("notices.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    done_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class NoticeDeadlineModel(Base):
    __tablename__ = "notice_deadlines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notice_id: Mapped[int] = mapped_column(Integer, ForeignKey("notices.id"))
    kind: Mapped[str] = mapped_column(String(30))  # deadline / event
    at: Mapped[str] = mapped_column(String(30))    # ISO datetime string
    label: Mapped[str] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(30), default="detected")  # detected / manual
    confirmed_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class AudiencePresetModel(Base):
    __tablename__ = "audience_presets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100))
    spec: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
