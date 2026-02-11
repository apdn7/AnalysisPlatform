"""clean up database

Revision ID: 5db269a8c04b
Revises: 70c90e89a142
Create Date: 2025-09-09 11:15:00.000000

"""

from migrations.versions import remove_orphaned_data

# revision identifiers, used by Alembic.
revision = '5db269a8c04b'
down_revision = '70c90e89a142'
branch_labels = None
depends_on = None


def upgrade():
    remove_orphaned_data()


def downgrade(): ...
