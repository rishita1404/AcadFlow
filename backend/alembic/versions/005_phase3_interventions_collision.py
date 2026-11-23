"""Phase 3: Intervention log and deadline collision warning schema.

Revision ID: 005_phase3_interventions_collision
Revises: 004_phase2_leave_condonation
Create Date: 2026-11-24 04:15:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_phase3_interventions_collision"
down_revision: Union[str, None] = "004_phase2_leave_condonation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. interventions table
    op.create_table(
        "interventions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("follow_up_on", sa.Date(), nullable=True),
        sa.Column("outcome", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("score_at_creation", sa.Numeric(5, 2), nullable=False),
        sa.Column("band_at_creation", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "kind IN ('talk', 'call', 'email', 'referral', 'other')",
            name="check_intervention_kind",
        ),
        sa.CheckConstraint(
            "outcome IN ('open', 'recovered', 'not_recovered', 'escalated')",
            name="check_intervention_outcome",
        ),
        sa.ForeignKeyConstraint(["student_id"], ["students.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interventions_student_id", "interventions", ["student_id"])

    # 2. Add collision_warning_threshold to risk_config
    with op.batch_alter_table("risk_config") as batch_op:
        batch_op.add_column(
            sa.Column("collision_warning_threshold", sa.Integer(), nullable=True, server_default="3")
        )


def downgrade() -> None:
    with op.batch_alter_table("risk_config") as batch_op:
        batch_op.drop_column("collision_warning_threshold")

    op.drop_index("ix_interventions_student_id", table_name="interventions")
    op.drop_table("interventions")
