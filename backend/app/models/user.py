from datetime import datetime
from typing import Optional
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class OrganizationModel(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    head_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "users.id",
            use_alter=True,
            name="fk_organizations_head_user_id",
        ),
        nullable=True,
    )


class DepartmentModel(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('student', 'faculty', 'coordinator', 'admin')",
            name="check_user_role",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    organization_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=True
    )
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class StudentModel(Base):
    __tablename__ = "students"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    roll_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    batch: Mapped[str] = mapped_column(String(50), nullable=False)


class DeanAssignmentModel(Base):
    __tablename__ = "dean_assignments"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), primary_key=True
    )


class MentorAssignmentModel(Base):
    __tablename__ = "mentor_assignments"

    mentor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.user_id"), primary_key=True
    )
