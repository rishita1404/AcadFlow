"""Part B: Timetable versioning, clash tolerance, and rooms schema.

Revision ID: 009_partB_timetable
Revises: 008_partA_notices
Create Date: 2026-11-24 17:00:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '009_partB_timetable'
down_revision: Union[str, None] = '008_partA_notices'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # 1. rooms table
    if "rooms" not in tables:
        op.create_table(
            "rooms",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("capacity", sa.Integer(), nullable=True),
            sa.Column("room_type", sa.String(length=30), nullable=False, server_default="classroom"),
            sa.Column("department_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name", name="uq_rooms_name"),
        )
    else:
        columns = [c["name"] for c in inspector.get_columns("rooms")]
        with op.batch_alter_table("rooms") as batch_op:
            if "department_id" not in columns:
                batch_op.add_column(sa.Column("department_id", sa.Integer(), nullable=True))
                batch_op.create_foreign_key("fk_rooms_department", "departments", ["department_id"], ["id"])

    # 2. timetable_versions table
    if "timetable_versions" not in tables:
        op.create_table(
            "timetable_versions",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("department_id", sa.Integer(), nullable=False),
            sa.Column("semester_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("effective_from", sa.String(length=50), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=False),
            sa.Column("published_at", sa.String(length=100), nullable=True),
            sa.Column("conflicts_json", sa.Text(), nullable=True),
            sa.Column("is_published_with_conflicts", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("restored_from_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["restored_from_id"], ["timetable_versions.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        columns = [c["name"] for c in inspector.get_columns("timetable_versions")]
        with op.batch_alter_table("timetable_versions") as batch_op:
            if "name" not in columns:
                batch_op.add_column(sa.Column("name", sa.String(length=100), nullable=True))
            if "conflicts_json" not in columns:
                batch_op.add_column(sa.Column("conflicts_json", sa.Text(), nullable=True))
            if "is_published_with_conflicts" not in columns:
                batch_op.add_column(sa.Column("is_published_with_conflicts", sa.Boolean(), server_default=sa.text("false"), nullable=False))
            if "restored_from_id" not in columns:
                batch_op.add_column(sa.Column("restored_from_id", sa.Integer(), nullable=True))
                batch_op.create_foreign_key("fk_timetable_versions_restored", "timetable_versions", ["restored_from_id"], ["id"])

    # 3. period_configs table
    if "period_configs" not in tables:
        op.create_table(
            "period_configs",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("version_id", sa.Integer(), nullable=False),
            sa.Column("day", sa.Integer(), nullable=False),
            sa.Column("start_time", sa.String(length=10), nullable=False),
            sa.Column("end_time", sa.String(length=10), nullable=False),
            sa.Column("label", sa.String(length=30), nullable=False),
            sa.Column("is_break", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.ForeignKeyConstraint(["version_id"], ["timetable_versions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    # 4. timetable_slots table
    if "timetable_slots" not in tables:
        op.create_table(
            "timetable_slots",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("version_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=False),
            sa.Column("section", sa.String(length=10), nullable=True, server_default="A"),
            sa.Column("teacher_id", sa.Integer(), nullable=False),
            sa.Column("room_id", sa.Integer(), nullable=True),
            sa.Column("day", sa.Integer(), nullable=False),
            sa.Column("period_label", sa.String(length=30), nullable=False),
            sa.Column("start_time", sa.String(length=10), nullable=True),
            sa.Column("end_time", sa.String(length=10), nullable=True),
            sa.Column("kind", sa.String(length=20), nullable=False, server_default="lecture"),
            sa.ForeignKeyConstraint(["version_id"], ["timetable_versions.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        columns = [c["name"] for c in inspector.get_columns("timetable_slots")]
        with op.batch_alter_table("timetable_slots") as batch_op:
            if "start_time" not in columns:
                batch_op.add_column(sa.Column("start_time", sa.String(length=10), nullable=True))
            if "end_time" not in columns:
                batch_op.add_column(sa.Column("end_time", sa.String(length=10), nullable=True))

    # 5. courses table (short_name for timetable grid display)
    course_cols = [c["name"] for c in inspector.get_columns("courses")]
    with op.batch_alter_table("courses") as batch_op:
        if "short_name" not in course_cols:
            batch_op.add_column(sa.Column("short_name", sa.String(length=20), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('timetable_slots') as batch_op:
        batch_op.drop_column('end_time')
        batch_op.drop_column('start_time')

    with op.batch_alter_table('rooms') as batch_op:
        batch_op.drop_constraint('fk_rooms_department', type_='foreignkey')
        batch_op.drop_column('department_id')

    with op.batch_alter_table('timetable_versions') as batch_op:
        batch_op.drop_constraint('fk_timetable_versions_restored', type_='foreignkey')
        batch_op.drop_column('restored_from_id')
        batch_op.drop_column('is_published_with_conflicts')
        batch_op.drop_column('conflicts_json')
        batch_op.drop_column('name')
