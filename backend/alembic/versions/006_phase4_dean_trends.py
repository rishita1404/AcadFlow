"""Phase 4: Dean trends and export optimization schema.

Revision ID: 006_phase4_dean_trends
Revises: 005_phase3_interventions_collision
Create Date: 2026-11-24 04:30:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "006_phase4_dean_trends"
down_revision: Union[str, None] = "005_phase3_interventions_collision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Optimize multi-week trend lookups across risk_snapshots table
    op.create_index(
        "ix_risk_snapshots_computed_band",
        "risk_snapshots",
        ["computed_at", "band"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_risk_snapshots_computed_band", table_name="risk_snapshots")
