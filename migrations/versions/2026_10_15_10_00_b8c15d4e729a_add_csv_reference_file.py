"""Add the saved reference file for CSV data sources.

Revision ID: b8c15d4e729a
Revises: 7c1e5b9d2f40
Create Date: 2026-10-15 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = 'b8c15d4e729a'
down_revision = '7c1e5b9d2f40'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('cfg_data_source_csv', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reference_file', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('cfg_data_source_csv', schema=None) as batch_op:
        batch_op.drop_column('reference_file')
