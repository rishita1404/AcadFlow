from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
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
