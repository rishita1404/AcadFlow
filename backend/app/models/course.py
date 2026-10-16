from datetime import date
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
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)


class HolidayModel(Base):
    __tablename__ = "holidays"
    __table_args__ = (
        UniqueConstraint("semester_id", "date", name="uq_holidays_semester_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    semester_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("semesters.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)


class CourseModel(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    semester_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("semesters.id"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False
    )
    total_classes: Mapped[int] = mapped_column(Integer, nullable=False)


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
    role: Mapped[str] = mapped_column(String(30), primary_key=True)
