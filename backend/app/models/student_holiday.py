"""
Student Holiday (Planned Day-Off) Model — AcadFlow

Students can mark future dates as planned holidays/absences.
- If a date is marked → student will be absent that day.
- If not marked → system assumes student plans to attend.

Used by the calendar view and the academic pressure forecast engine.
"""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
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


class StudentHolidayModel(Base):
    """A student-planned absence (future date) or retroactive self-reported absence."""

    __tablename__ = "student_holidays"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "holiday_date", name="uq_student_holidays_student_date"
        ),
        Index("ix_student_holidays_student_date", "student_id", "holiday_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.user_id", ondelete="CASCADE")
    )
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=True)
    is_future_plan: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="True = planned future absence; False = retroactive"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
