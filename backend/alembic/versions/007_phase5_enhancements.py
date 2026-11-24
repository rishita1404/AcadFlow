"""Phase 5: Attendance upload batches and undo tracking schema.

Revision ID: 007_phase5_enhancements
Revises: 006_phase4_dean_trends
Create Date: 2026-11-24 13:50:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007_phase5_enhancements"
down_revision: Union[str, None] = "006_phase4_dean_trends"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_upload_batches",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("records_created", sa.Integer(), server_default="0", nullable=False),
        sa.Column("records_updated", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sessions_created", sa.Integer(), server_default="0", nullable=False),
        sa.Column("backup_data", sa.Text(), nullable=True),
        sa.Column("is_undone", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("undone_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["undone_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_upload_batches_course_uploaded",
        "attendance_upload_batches",
        ["course_id", "uploaded_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_upload_batches_course_uploaded", table_name="attendance_upload_batches")
    op.drop_table("attendance_upload_batches")
