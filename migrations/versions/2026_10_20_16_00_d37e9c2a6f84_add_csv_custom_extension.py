"""Add an optional source suffix filter for CSV data sources.

Revision ID: d37e9c2a6f84
Revises: b8c15d4e729a
Create Date: 2026-10-20 16:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = 'd37e9c2a6f84'
down_revision = 'b8c15d4e729a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('cfg_data_source_csv', schema=None) as batch_op:
        batch_op.add_column(sa.Column('custom_extension', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('cfg_data_source_csv', schema=None) as batch_op:
        batch_op.drop_column('custom_extension')
