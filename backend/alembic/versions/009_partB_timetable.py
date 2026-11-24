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
    # 1. Update timetable_versions table
    with op.batch_alter_table('timetable_versions') as batch_op:
        batch_op.add_column(sa.Column('name', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('conflicts_json', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('is_published_with_conflicts', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('restored_from_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_timetable_versions_restored', 'timetable_versions', ['restored_from_id'], ['id'])

    # 2. Update rooms table
    with op.batch_alter_table('rooms') as batch_op:
        batch_op.add_column(sa.Column('department_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_rooms_department', 'departments', ['department_id'], ['id'])

    # 3. Update timetable_slots table
    with op.batch_alter_table('timetable_slots') as batch_op:
        batch_op.add_column(sa.Column('start_time', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('end_time', sa.String(length=10), nullable=True))


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
