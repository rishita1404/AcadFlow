from datetime import datetime
from typing import Optional
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SubmissionModel(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "student_id",
            "version",
            name="uq_submissions_assignment_student_version",
        ),
        CheckConstraint(
            "status IN ('on_time', 'late', 'missed', 'excused')",
            name="check_submission_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assignments.id"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.user_id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    file_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
