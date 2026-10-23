from datetime import datetime
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
    category: Mapped[str] = mapped_column(String(50), default="general")  # Form, Event, Exam, Placement, General, Urgent
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="sent")  # draft / sent / archived
    audience_spec: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON spec
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NoticeRecipientModel(Base):
    __tablename__ = "notice_recipients"

    notice_id: Mapped[int] = mapped_column(Integer, ForeignKey("notices.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
