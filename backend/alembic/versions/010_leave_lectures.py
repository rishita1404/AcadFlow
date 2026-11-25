"""Add lecture_no to class_sessions, mode/lecture_nos to leave_requests, and leave flags to risk_config.

Revision ID: 010_leave_lectures
Revises: 009_partB_timetable
Create Date: 2026-11-25 18:15:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "010_leave_lectures"
down_revision: Union[str, None] = "009_partB_timetable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if is_sqlite:
        bind.execute(sa.text("PRAGMA foreign_keys=OFF"))
    inspector = sa.inspect(bind)

    # 1. class_sessions: add lecture_no and relax unique constraint to (course_id, held_on, lecture_no)
    cs_cols = {c["name"] for c in inspector.get_columns("class_sessions")}
    cs_uqs = {u["name"] for u in inspector.get_unique_constraints("class_sessions") if u.get("name")}
    with op.batch_alter_table("class_sessions") as batch_op:
        if "lecture_no" not in cs_cols:
            batch_op.add_column(
                sa.Column("lecture_no", sa.Integer(), nullable=False, server_default="1")
            )
        if "uq_class_sessions_course_held_on" in cs_uqs:
            batch_op.drop_constraint("uq_class_sessions_course_held_on", type_="unique")
        if "uq_class_sessions_course_held_on_lecture" not in cs_uqs:
            batch_op.create_unique_constraint(
                "uq_class_sessions_course_held_on_lecture",
                ["course_id", "held_on", "lecture_no"],
            )

    # 2. leave_requests: add mode and lecture_nos
    lr_cols = {c["name"] for c in inspector.get_columns("leave_requests")}
    with op.batch_alter_table("leave_requests") as batch_op:
        if "mode" not in lr_cols:
            batch_op.add_column(
                sa.Column("mode", sa.String(length=20), nullable=False, server_default="full_day")
            )
        if "lecture_nos" not in lr_cols:
            batch_op.add_column(sa.Column("lecture_nos", sa.Text(), nullable=True))

    # 3. risk_config: add leave_dl_counts_as_present & leave_ml_counts_as_present
    rc_cols = {c["name"] for c in inspector.get_columns("risk_config")}
    with op.batch_alter_table("risk_config") as batch_op:
        if "leave_dl_counts_as_present" not in rc_cols:
            batch_op.add_column(
                sa.Column("leave_dl_counts_as_present", sa.Boolean(), nullable=True, server_default="1")
            )
        if "leave_ml_counts_as_present" not in rc_cols:
            batch_op.add_column(
                sa.Column("leave_ml_counts_as_present", sa.Boolean(), nullable=True, server_default="1")
            )

    if is_sqlite:
        bind.execute(sa.text("PRAGMA foreign_keys=ON"))


def downgrade() -> None:
    with op.batch_alter_table("risk_config") as batch_op:
        batch_op.drop_column("leave_ml_counts_as_present")
        batch_op.drop_column("leave_dl_counts_as_present")

    with op.batch_alter_table("leave_requests") as batch_op:
        batch_op.drop_column("lecture_nos")
        batch_op.drop_column("mode")

    with op.batch_alter_table("class_sessions") as batch_op:
        batch_op.drop_constraint("uq_class_sessions_course_held_on_lecture", type_="unique")
        batch_op.create_unique_constraint("uq_class_sessions_course_held_on", ["course_id", "held_on"])
        batch_op.drop_column("lecture_no")
