"""remove hashed

Revision ID: a2e10a4ef7f4
Revises: 6d36f1142d66
Create Date: 2026-03-02 15:24:44.715623

"""

import sqlalchemy as sa
from alembic import op

from ap.common.cryptography_utils import encrypt

# revision identifiers, used by Alembic.
revision = 'a2e10a4ef7f4'
down_revision = '6d36f1142d66'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    rows = conn.execute(sa.text('select id, password from cfg_data_source_db where hashed = false')).all()
    for row in rows:
        conn.execute(
            sa.text('update cfg_data_source_db set password = :password where id = :id'),
            {'id': row.id, 'password': encrypt(row.password)},
        )

    with op.batch_alter_table('cfg_data_source_db', schema=None) as batch_op:
        batch_op.drop_column('hashed')


def downgrade():
    # add hashed columns
    with op.batch_alter_table('cfg_data_source_db', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hashed', sa.BOOLEAN(), nullable=False, server_default='false'))
    # make sure all hashed values is true
    op.execute(sa.text('update cfg_data_source_db set hashed = true where 1 = 1'))
