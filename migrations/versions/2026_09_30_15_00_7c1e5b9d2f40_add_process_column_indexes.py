"""Add indexes used by Variable Select process column queries.

Revision ID: 7c1e5b9d2f40
Revises: 4d8c2a91f7b3
Create Date: 2026-09-30 15:00:00.000000

"""

from alembic import op

# Revision identifiers used by Alembic.
revision = '7c1e5b9d2f40'
down_revision = '7c28f54d6a91'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Index the process and function detail foreign keys (single-column to keep the implicit id order)."""
    with op.batch_alter_table('cfg_process_column', schema=None) as batch_op:
        batch_op.create_index('ix_cfg_process_column_process_id', ['process_id'], unique=False)

    with op.batch_alter_table('cfg_process_function_column', schema=None) as batch_op:
        batch_op.create_index('ix_cfg_process_function_column_process_column_id', ['process_column_id'], unique=False)


def downgrade() -> None:
    """Drop the Variable Select indexes."""
    with op.batch_alter_table('cfg_process_function_column', schema=None) as batch_op:
        batch_op.drop_index('ix_cfg_process_function_column_process_column_id')

    with op.batch_alter_table('cfg_process_column', schema=None) as batch_op:
        batch_op.drop_index('ix_cfg_process_column_process_id')
