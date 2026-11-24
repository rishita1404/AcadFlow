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
    # 1. Update notices table
    with op.batch_alter_table('notices') as batch_op:
        batch_op.add_column(sa.Column('link', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('priority', sa.String(length=20), server_default='normal', nullable=False))
        batch_op.add_column(sa.Column('audience_summary', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('is_correction_for_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_notices_correction', 'notices', ['is_correction_for_id'], ['id'])

    # 2. Update notice_recipients table
    with op.batch_alter_table('notice_recipients') as batch_op:
        batch_op.add_column(sa.Column('reason', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('read_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Create audience_presets table
    op.create_table(
        'audience_presets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('spec', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audience_presets_user_id', 'audience_presets', ['user_id'])

    # 4. Add thresholds to risk_config
    with op.batch_alter_table('risk_config') as batch_op:
        batch_op.add_column(sa.Column('notice_reach_threshold', sa.Integer(), nullable=True, server_default='100'))
        batch_op.add_column(sa.Column('notice_daily_rate_limit', sa.Integer(), nullable=True, server_default='20'))

    # 5. Add section to students table
    with op.batch_alter_table('students') as batch_op:
        batch_op.add_column(sa.Column('section', sa.String(length=20), nullable=True, server_default='A'))


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
