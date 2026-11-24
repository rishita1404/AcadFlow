"""Part A: Targeted audience notices, recipient snapshot, and presets schema.

Revision ID: 008_partA_notices
Revises: 007_phase5_enhancements
Create Date: 2026-11-24 16:00:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '008_partA_notices'
down_revision: Union[str, None] = '007_phase5_enhancements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # 1. notices table
    if "notices" not in tables:
        op.create_table(
            "notices",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("sender_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False, server_default="general"),
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
            sa.Column("urgent", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("link", sa.String(length=500), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="sent"),
            sa.Column("audience_spec", sa.Text(), nullable=True),
            sa.Column("audience_summary", sa.String(length=255), nullable=True),
            sa.Column("is_correction_for_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["is_correction_for_id"], ["notices.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        columns = [c["name"] for c in inspector.get_columns("notices")]
        with op.batch_alter_table("notices") as batch_op:
            if "link" not in columns:
                batch_op.add_column(sa.Column("link", sa.String(length=500), nullable=True))
            if "priority" not in columns:
                batch_op.add_column(sa.Column("priority", sa.String(length=20), server_default="normal", nullable=False))
            if "audience_summary" not in columns:
                batch_op.add_column(sa.Column("audience_summary", sa.String(length=255), nullable=True))
            if "is_correction_for_id" not in columns:
                batch_op.add_column(sa.Column("is_correction_for_id", sa.Integer(), nullable=True))
                batch_op.create_foreign_key("fk_notices_correction", "notices", ["is_correction_for_id"], ["id"])

    # 2. notice_recipients table
    if "notice_recipients" not in tables:
        op.create_table(
            "notice_recipients",
            sa.Column("notice_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(length=255), nullable=True),
            sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["notice_id"], ["notices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("notice_id", "user_id"),
        )
    else:
        columns = [c["name"] for c in inspector.get_columns("notice_recipients")]
        with op.batch_alter_table("notice_recipients") as batch_op:
            if "reason" not in columns:
                batch_op.add_column(sa.Column("reason", sa.String(length=255), nullable=True))
            if "read_at" not in columns:
                batch_op.add_column(sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))

    # 3. notice_deadlines table
    if "notice_deadlines" not in tables:
        op.create_table(
            "notice_deadlines",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("notice_id", sa.Integer(), nullable=False),
            sa.Column("kind", sa.String(length=30), nullable=False),
            sa.Column("at", sa.String(length=30), nullable=False),
            sa.Column("label", sa.String(length=100), nullable=False),
            sa.Column("source", sa.String(length=30), nullable=False, server_default="detected"),
            sa.Column("confirmed_by", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["notice_id"], ["notices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["confirmed_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    # 4. audience_presets table
    if "audience_presets" not in tables:
        op.create_table(
            "audience_presets",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("spec", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_audience_presets_user_id", "audience_presets", ["user_id"])

    # 5. risk_config table
    risk_cols = [c["name"] for c in inspector.get_columns("risk_config")]
    with op.batch_alter_table("risk_config") as batch_op:
        if "notice_reach_threshold" not in risk_cols:
            batch_op.add_column(sa.Column("notice_reach_threshold", sa.Integer(), nullable=True, server_default="100"))
        if "notice_daily_rate_limit" not in risk_cols:
            batch_op.add_column(sa.Column("notice_daily_rate_limit", sa.Integer(), nullable=True, server_default="20"))

    # 6. students table
    student_cols = [c["name"] for c in inspector.get_columns("students")]
    with op.batch_alter_table("students") as batch_op:
        if "section" not in student_cols:
            batch_op.add_column(sa.Column("section", sa.String(length=20), nullable=True, server_default="A"))


def downgrade() -> None:
    with op.batch_alter_table('students') as batch_op:
        batch_op.drop_column('section')

    with op.batch_alter_table('risk_config') as batch_op:
        batch_op.drop_column('notice_daily_rate_limit')
        batch_op.drop_column('notice_reach_threshold')

    op.drop_index('ix_audience_presets_user_id', table_name='audience_presets')
    op.drop_table('audience_presets')

    with op.batch_alter_table('notice_recipients') as batch_op:
        batch_op.drop_column('read_at')
        batch_op.drop_column('reason')

    with op.batch_alter_table('notices') as batch_op:
        batch_op.drop_constraint('fk_notices_correction', type_='foreignkey')
        batch_op.drop_column('is_correction_for_id')
        batch_op.drop_column('audience_summary')
        batch_op.drop_column('priority')
        batch_op.drop_column('link')
