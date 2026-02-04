"""process status

Revision ID: 8c67a5836a9d
Revises: 5db269a8c04a
Create Date: 2025-10-09 15:02:20.866129

"""

import sqlalchemy as sa
from alembic import op

from ap.common.constants import ProcessStatus
from migrations.versions import remove_orphaned_data

# revision identifiers, used by Alembic.
revision = '8c67a5836a9d'
down_revision = '5db269a8c04a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('cfg_process', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('status', sa.Integer(), server_default=str(ProcessStatus.REGISTERED.value), nullable=False)
        )

    # update default value from is_import
    op.execute(
        sa.text(
            f'UPDATE cfg_process SET "status" = CASE is_import '
            f'WHEN 0 THEN {ProcessStatus.INITIALIZED.value} '
            f'ELSE {ProcessStatus.REGISTERED.value} '
            f'END'
        )
    )
    # drop unused column
    op.drop_column('cfg_process', 'is_import')

    # ### end Alembic commands ###


def downgrade():
    op.add_column('cfg_process', sa.Column('is_import', sa.BOOLEAN(), nullable=True, default=True))
    op.execute(
        sa.text(
            f"""
UPDATE cfg_process
SET is_import = CASE status WHEN {ProcessStatus.REGISTERED.value}
                    THEN TRUE
                    ELSE FALSE
                END
"""
        )
    )

    # In case INITIALIZING, processes are created without any columns => remove processes
    op.execute(
        sa.text(
            f"""
DELETE FROM cfg_process WHERE status = '{ProcessStatus.INITIALIZING.value}'
"""
        )
    )

    # To make sure delete orphaned data that related to INITIALIZING processes
    remove_orphaned_data()

    op.drop_column('cfg_process', 'status')
