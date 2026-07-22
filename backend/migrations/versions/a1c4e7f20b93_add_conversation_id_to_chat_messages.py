"""add conversation_id to chat_messages

Revision ID: a1c4e7f20b93
Revises: 5a7a26e8267d
Create Date: 2026-07-22 09:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e7f20b93'
down_revision: Union[str, Sequence[str], None] = '5a7a26e8267d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        # Nullable: existing rows keep NULL and read as one legacy conversation.
        batch_op.add_column(sa.Column('conversation_id', sa.String(length=64), nullable=True))
        batch_op.create_index('ix_chat_messages_conversation_id', ['conversation_id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.drop_index('ix_chat_messages_conversation_id')
        batch_op.drop_column('conversation_id')
