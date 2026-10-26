from datetime import date
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SemesterModel(Base):
    __tablename__ = "semesters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)


class HolidayModel(Base):
    __tablename__ = "holidays"
    __table_args__ = (
        UniqueConstraint("semester_id", "date", name="uq_holidays_semester_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    semester_id: Mapped[int] = mapped_column(Integer, ForeignKey("semesters.id"))
    holiday_date: Mapped[date] = mapped_column("date", Date)
    label: Mapped[str] = mapped_column(String(100))


class CourseModel(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    short_name: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    semester_id: Mapped[int] = mapped_column(Integer, ForeignKey("semesters.id"))
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"))
    total_classes: Mapped[int] = mapped_column(Integer)


class CourseStaffModel(Base):
    __tablename__ = "course_staff"
    __table_args__ = (
        CheckConstraint(
            "role IN ('instructor', 'trainer', 'course_coordinator')",
            name="check_course_staff_role",
        ),
    )

    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(30), default="instructor")
