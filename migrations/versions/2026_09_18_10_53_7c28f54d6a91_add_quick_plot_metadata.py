"""Add Quick Plot upload and datasource retention metadata.

Revision ID: 7c28f54d6a91
Revises: 4d8c2a91f7b3
Create Date: 2026-09-18 10:53:38.000000

"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers used by Alembic.
revision = '7c28f54d6a91'
down_revision = '4d8c2a91f7b3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create Quick Plot upload ownership and datasource-retention tables."""
    # Create upload metadata first because each datasource mapping requires an owning upload.
    op.create_table(
        'cfg_quick_plot_upload',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('original_filename', sa.String(), nullable=False),
        sa.Column('stored_filename', sa.String(), nullable=False),
        sa.Column('stored_path', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('uploaded_at', sa.String(), nullable=False),
        sa.Column('file_expires_at', sa.String(), nullable=False),
        sa.Column('last_error', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_cfg_quick_plot_upload')),
        sa.UniqueConstraint('stored_path', name=op.f('uq_cfg_quick_plot_upload_stored_path')),
    )
    op.create_index(
        op.f('ix_cfg_quick_plot_upload_file_expires_at'),
        'cfg_quick_plot_upload',
        ['file_expires_at'],
        unique=False,
    )

    # Cascade ownership deletion and manual datasource deletion while retaining retry rows on service failures.
    op.create_table(
        'cfg_quick_plot_data_source',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('quick_plot_upload_id', sa.String(length=32), nullable=False),
        sa.Column('data_source_id', sa.Integer(), nullable=False),
        sa.Column('registered_at', sa.String(), nullable=False),
        sa.Column('expires_at', sa.String(), nullable=False),
        sa.Column('last_error', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ['data_source_id'],
            ['cfg_data_source.id'],
            name=op.f('fk_cfg_quick_plot_data_source_data_source_id_cfg_data_source'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['quick_plot_upload_id'],
            ['cfg_quick_plot_upload.id'],
            name=op.f('fk_cfg_quick_plot_data_source_quick_plot_upload_id_cfg_quick_plot_upload'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_cfg_quick_plot_data_source')),
    )
    op.create_index(
        op.f('ix_cfg_quick_plot_data_source_data_source_id'),
        'cfg_quick_plot_data_source',
        ['data_source_id'],
        unique=True,
    )
    op.create_index(
        op.f('ix_cfg_quick_plot_data_source_expires_at'),
        'cfg_quick_plot_data_source',
        ['expires_at'],
        unique=False,
    )
    op.create_index(
        op.f('ix_cfg_quick_plot_data_source_quick_plot_upload_id'),
        'cfg_quick_plot_data_source',
        ['quick_plot_upload_id'],
        unique=False,
    )


def downgrade() -> None:
    """Remove Quick Plot metadata without touching datasource or uploaded-file contents."""
    # Drop the child table first to satisfy SQLite foreign-key dependency ordering.
    op.drop_index(
        op.f('ix_cfg_quick_plot_data_source_quick_plot_upload_id'),
        table_name='cfg_quick_plot_data_source',
    )
    op.drop_index(
        op.f('ix_cfg_quick_plot_data_source_expires_at'),
        table_name='cfg_quick_plot_data_source',
    )
    op.drop_index(
        op.f('ix_cfg_quick_plot_data_source_data_source_id'),
        table_name='cfg_quick_plot_data_source',
    )
    op.drop_table('cfg_quick_plot_data_source')

    # Upload metadata can be removed after no mapping foreign keys remain.
    op.drop_index(
        op.f('ix_cfg_quick_plot_upload_file_expires_at'),
        table_name='cfg_quick_plot_upload',
    )
    op.drop_table('cfg_quick_plot_upload')
