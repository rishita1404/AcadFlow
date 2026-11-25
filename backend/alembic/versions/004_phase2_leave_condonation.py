"""Phase 2: Leave requests and condonation schema.

Revision ID: 004_phase2_leave_condonation
Revises: 003_phase1_reframe_language
Create Date: 2026-11-24 04:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "004_phase2_leave_condonation"
down_revision: Union[str, None] = "003_phase1_reframe_language"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. leave_requests table
    op.create_table(
        "leave_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("type IN ('medical', 'duty')", name="check_leave_type"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="check_leave_status"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leave_requests_student_id", "leave_requests", ["student_id"])

    # 2. condonation_requests table
    op.create_table(
        "condonation_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("attendance_pct_at_request", sa.Numeric(5, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="recommended"),
        sa.Column("recommended_by", sa.Integer(), nullable=False),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('recommended', 'approved', 'rejected')", name="check_condonation_status"),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recommended_by"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_condonation_requests_student_id", "condonation_requests", ["student_id"])

    # 3. Add condonation config to risk_config
    with op.batch_alter_table("risk_config") as batch_op:
        batch_op.add_column(
            sa.Column("condonation_floor_pct", sa.Numeric(5, 2), nullable=True, server_default="65.0")
        )
        batch_op.add_column(
            sa.Column("require_recommendation", sa.Boolean(), nullable=True, server_default="1")
        )


def downgrade() -> None:
    with op.batch_alter_table("risk_config") as batch_op:
        batch_op.drop_column("require_recommendation")
        batch_op.drop_column("condonation_floor_pct")

    op.drop_index("ix_condonation_requests_student_id", table_name="condonation_requests")
    op.drop_table("condonation_requests")
    op.drop_index("ix_leave_requests_student_id", table_name="leave_requests")
    op.drop_table("leave_requests")
