"""add appointments and wearable_readings

Revision ID: b2d5f8a10c47
Revises: a1c4e7f20b93
Create Date: 2026-07-22 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2d5f8a10c47'
down_revision: Union[str, Sequence[str], None] = 'a1c4e7f20b93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'appointments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('doctor_name', sa.String(length=128), nullable=False),
        sa.Column('specialty', sa.String(length=96), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_appointments_user_id', 'appointments', ['user_id'])
    op.create_index('ix_appointments_scheduled_at', 'appointments', ['scheduled_at'])

    op.create_table(
        'wearable_readings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('measured_on', sa.Date(), nullable=False),
        sa.Column('steps', sa.Integer(), nullable=True),
        sa.Column('resting_hr', sa.Integer(), nullable=True),
        sa.Column('sleep_hours', sa.Float(), nullable=True),
        sa.Column('source', sa.String(length=48), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'measured_on', 'source', name='uq_wearable_day'),
    )
    op.create_index('ix_wearable_readings_user_id', 'wearable_readings', ['user_id'])
    op.create_index('ix_wearable_readings_measured_on', 'wearable_readings', ['measured_on'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_wearable_readings_measured_on', table_name='wearable_readings')
    op.drop_index('ix_wearable_readings_user_id', table_name='wearable_readings')
    op.drop_table('wearable_readings')
    op.drop_index('ix_appointments_scheduled_at', table_name='appointments')
    op.drop_index('ix_appointments_user_id', table_name='appointments')
    op.drop_table('appointments')
