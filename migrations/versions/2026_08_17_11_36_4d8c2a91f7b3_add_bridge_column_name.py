"""Add the persisted bridge column name.

Revision ID: 4d8c2a91f7b3
Revises: e4849369303e
Create Date: 2026-08-17 11:36:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import Connection

from ap.common.common_utils import gen_bridge_column_name

# Revision identifiers used by Alembic.
revision = '4d8c2a91f7b3'
down_revision = 'e4849369303e'
branch_labels = None
depends_on = None

_BACKFILL_BATCH_SIZE = 1_000


def _backfill_bridge_column_names(connection: Connection) -> None:
    """Backfill missing bridge names with the existing runtime naming helper.

    Args:
        connection: Alembic migration connection for the metadata database.

    Raises:
        TypeError: If legacy data contains a null column name that the existing helper cannot normalize.
    """
    # Use a lightweight Core table so migration rows are not loaded into the application ORM session.
    process_columns = sa.table(
        'cfg_process_column',
        sa.column('id', sa.Integer()),
        sa.column('column_name', sa.String()),
        sa.column('bridge_column_name', sa.String(50)),
    )
    update_bridge_name = (
        sa.update(process_columns)
        .where(process_columns.c.id == sa.bindparam('target_id'))
        .values(bridge_column_name=sa.bindparam('generated_bridge_name'))
    )
    last_processed_id = 0

    # Bound each read and update batch to avoid materializing all process columns in migration memory.
    while True:
        rows = (
            connection.execute(
                sa.select(process_columns.c.id, process_columns.c.column_name)
                .where(
                    process_columns.c.id > last_processed_id,
                    process_columns.c.bridge_column_name.is_(None),
                )
                .order_by(process_columns.c.id)
                .limit(_BACKFILL_BATCH_SIZE)
            )
            .mappings()
            .all()
        )
        if not rows:
            break

        # Delegate normalization, sanitization, lowercasing, and truncation to the current source-of-truth helper.
        backfill_values = [
            {
                'target_id': row['id'],
                'generated_bridge_name': gen_bridge_column_name(row['id'], row['column_name']),
            }
            for row in rows
        ]
        connection.execute(update_bridge_name, backfill_values)
        last_processed_id = rows[-1]['id']


def upgrade() -> None:
    """Add the nullable physical column and backfill all existing process-column rows."""
    # The column remains nullable because its value depends on the auto-incremented ID assigned during INSERT.
    with op.batch_alter_table('cfg_process_column', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bridge_column_name', sa.String(length=50), nullable=True))

    # Backfill inside the Alembic transaction so an error rolls back both schema and data changes.
    _backfill_bridge_column_names(op.get_bind())


def downgrade() -> None:
    """Remove the persisted bridge column name."""
    # Existing transaction-table names are unchanged, so downgrade only removes the metadata column.
    with op.batch_alter_table('cfg_process_column', schema=None) as batch_op:
        batch_op.drop_column('bridge_column_name')
