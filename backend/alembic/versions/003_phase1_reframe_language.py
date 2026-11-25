"""Phase 1: Reframe student-facing language and buffer contract.

Revision ID: 003_phase1_reframe_language
Revises: 002_new_features
Create Date: 2026-11-24 03:45:00
"""

from typing import Sequence, Union

revision: str = "003_phase1_reframe_language"
down_revision: Union[str, None] = "002_new_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 1: Reframe student-facing buffer terminology, reserve cushion semantics,
    # and supportive eligibility copy. Schema remains compatible with 002_new_features.
    pass


def downgrade() -> None:
    pass
