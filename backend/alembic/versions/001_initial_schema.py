"""Initial schema for AcadFlow (18 tables matching PRD and 3NF).

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-10-16 18:05:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. departments
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_departments_name"),
        sa.UniqueConstraint("code", name="uq_departments_code"),
    )

    # 2. organizations (created before users, circular FK head_user_id added later)
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("head_user_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_organizations_name"),
    )

    # 3. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("failed_logins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('student', 'faculty', 'coordinator', 'admin')",
            name="check_user_role",
        ),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Add circular foreign key for organizations.head_user_id
    op.create_foreign_key(
        "fk_organizations_head_user_id",
        "organizations",
        "users",
        ["head_user_id"],
        ["id"],
        use_alter=True,
    )

    # 4. students
    op.create_table(
        "students",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("roll_no", sa.String(length=50), nullable=False),
        sa.Column("batch", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_students_roll_no", "students", ["roll_no"], unique=True)

    # 5. dean_assignments
    op.create_table(
        "dean_assignments",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "department_id"),
    )

    # 6. mentor_assignments
    op.create_table(
        "mentor_assignments",
        sa.Column("mentor_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("mentor_id", "student_id"),
    )

    # 7. semesters
    op.create_table(
        "semesters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. holidays
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("semester_id", "date", name="uq_holidays_semester_date"),
    )

    # 9. courses
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("total_classes", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_courses_code", "courses", ["code"], unique=True)

    # 10. course_staff
    op.create_table(
        "course_staff",
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.CheckConstraint(
            "role IN ('instructor', 'trainer', 'course_coordinator')",
            name="check_course_staff_role",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("course_id", "user_id", "role"),
    )

    # 11. enrolments
    op.create_table(
        "enrolments",
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("enrolled_on", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("student_id", "course_id"),
    )
    op.create_index("ix_enrolments_course_id", "enrolments", ["course_id"], unique=False)

    # 12. class_sessions
    op.create_table(
        "class_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("held_on", sa.Date(), nullable=False),
        sa.Column("is_cancelled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_id", "held_on", name="uq_class_sessions_course_held_on"),
    )
    op.create_index(
        "ix_class_sessions_course_held_on",
        "class_sessions",
        ["course_id", "held_on"],
        unique=False,
    )

    # 13. attendance_records
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("marked_by", sa.Integer(), nullable=False),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('present', 'absent', 'late')",
            name="check_attendance_status",
        ),
        sa.ForeignKeyConstraint(["marked_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["class_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "session_id", name="uq_attendance_records_student_session"),
    )
    op.create_index("ix_attendance_records_session_id", "attendance_records", ["session_id"], unique=False)

    # 14. assignments
    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("grace_hours", sa.Integer(), server_default="48", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint(
            "kind IN ('assignment', 'lab file', 'review', 'exam')",
            name="check_assignment_kind",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assignments_course_id_due_at",
        "assignments",
        ["course_id", "due_at"],
        unique=False,
    )

    # 15. submissions
    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("file_key", sa.String(length=255), nullable=True),
        sa.Column("file_hash", sa.String(length=128), nullable=True),
        sa.Column("dedupe_key", sa.String(length=100), nullable=False),
        sa.CheckConstraint(
            "status IN ('on_time', 'late', 'missed', 'excused')",
            name="check_submission_status",
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dedupe_key", name="uq_submissions_dedupe_key"),
        sa.UniqueConstraint(
            "assignment_id",
            "student_id",
            "version",
            name="uq_submissions_assignment_student_version",
        ),
    )

    # 16. risk_config
    op.create_table(
        "risk_config",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("w_margin", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("w_trend", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("w_deadline", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("w_missed", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("t_watch", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("t_risk", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("t_critical", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("min_classes", sa.Integer(), server_default="8", nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 17. risk_snapshots
    op.create_table(
        "risk_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("band", sa.String(length=20), nullable=False),
        sa.Column("worst_course_id", sa.Integer(), nullable=False),
        sa.Column("config_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["config_id"], ["risk_config.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worst_course_id"], ["courses.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_risk_snapshots_student_computed",
        "risk_snapshots",
        ["student_id", "computed_at"],
        unique=False,
    )

    # 18. audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("entity", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # Drop circular FK first
    op.drop_constraint("fk_organizations_head_user_id", "organizations", type_="foreignkey")

    # Drop in reverse topological order
    op.drop_table("audit_log")
    op.drop_table("risk_snapshots")
    op.drop_table("risk_config")
    op.drop_table("submissions")
    op.drop_table("assignments")
    op.drop_table("attendance_records")
    op.drop_table("class_sessions")
    op.drop_table("enrolments")
    op.drop_table("course_staff")
    op.drop_table("courses")
    op.drop_table("holidays")
    op.drop_table("semesters")
    op.drop_table("mentor_assignments")
    op.drop_table("dean_assignments")
    op.drop_table("students")
    op.drop_table("users")
    op.drop_table("organizations")
    op.drop_table("departments")
