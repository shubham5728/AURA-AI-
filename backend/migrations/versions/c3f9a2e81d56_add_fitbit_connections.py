"""add fitbit_connections

Revision ID: c3f9a2e81d56
Revises: b2d5f8a10c47
Create Date: 2026-07-22 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f9a2e81d56'
down_revision: Union[str, Sequence[str], None] = 'b2d5f8a10c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'fitbit_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('fitbit_user_id', sa.String(length=32), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_fitbit_user'),
    )
    op.create_index('ix_fitbit_connections_user_id', 'fitbit_connections', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_fitbit_connections_user_id', table_name='fitbit_connections')
    op.drop_table('fitbit_connections')
