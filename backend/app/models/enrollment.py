from datetime import date
from sqlalchemy import Date, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EnrolmentModel(Base):
    __tablename__ = "enrolments"
    __table_args__ = (
        Index("ix_enrolments_course_id", "course_id"),
    )

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.user_id"), primary_key=True
    )
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), primary_key=True
    )
    enrolled_on: Mapped[date] = mapped_column(Date, nullable=False)
