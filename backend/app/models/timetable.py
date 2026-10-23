from typing import Optional
from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class RoomModel(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    room_type: Mapped[str] = mapped_column(String(30), default="classroom")


class TimetableVersionModel(Base):
    __tablename__ = "timetable_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"))
    semester_id: Mapped[int] = mapped_column(Integer, ForeignKey("semesters.id"))
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft / published / archived
    effective_from: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    published_at: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)


class PeriodConfigModel(Base):
    __tablename__ = "period_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("timetable_versions.id"))
    day: Mapped[int] = mapped_column(Integer)  # 0=Monday ... 5=Saturday
    start_time: Mapped[str] = mapped_column(String(10))  # "09:00"
    end_time: Mapped[str] = mapped_column(String(10))    # "10:00"
    label: Mapped[str] = mapped_column(String(30))       # "P1", "Break", etc.
    is_break: Mapped[bool] = mapped_column(Boolean, default=False)


class TimetableSlotModel(Base):
    __tablename__ = "timetable_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("timetable_versions.id"))
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id"))
    section: Mapped[Optional[str]] = mapped_column(String(10), default="A")
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    room_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("rooms.id"), nullable=True)
    day: Mapped[int] = mapped_column(Integer)  # 0=Mon .. 5=Sat
    period_label: Mapped[str] = mapped_column(String(30))
    kind: Mapped[str] = mapped_column(String(20), default="lecture")  # lecture / lab / tutorial
