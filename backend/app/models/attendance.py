from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClassSessionModel(Base):
    __tablename__ = "class_sessions"
    __table_args__ = (
        UniqueConstraint(
            "course_id", "held_on", name="uq_class_sessions_course_held_on"
        ),
        Index("ix_class_sessions_course_held_on", "course_id", "held_on"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id"))
    held_on: Mapped[date] = mapped_column(Date)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)


class AttendanceRecordModel(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "session_id", name="uq_attendance_records_student_session"
        ),
        CheckConstraint(
            "status IN ('present', 'absent', 'late')",
            name="check_attendance_status",
        ),
        Index("ix_attendance_records_session_id", "session_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.user_id"))
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("class_sessions.id"))
    status: Mapped[str] = mapped_column(String(20))
    marked_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AttendanceUploadBatchModel(Base):
    __tablename__ = "attendance_upload_batches"
    __table_args__ = (
        Index("ix_upload_batches_course_uploaded", "course_id", "uploaded_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id"), nullable=False)
    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    records_created: Mapped[int] = mapped_column(Integer, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, default=0)
    sessions_created: Mapped[int] = mapped_column(Integer, default=0)
    backup_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_undone: Mapped[bool] = mapped_column(Boolean, default=False)
    undone_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    undone_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

