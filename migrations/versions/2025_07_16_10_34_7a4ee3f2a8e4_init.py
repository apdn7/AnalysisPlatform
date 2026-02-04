"""init

Revision ID: 7a4ee3f2a8e4
Revises: 2c48f948d437
Create Date: 2025-07-16 10:34:58.967316

"""

import sqlalchemy as sa
from alembic import op

from migrations.versions import col_exists, remove_orphaned_data

# revision identifiers, used by Alembic.
revision = '7a4ee3f2a8e4'
down_revision = '2c48f948d437'
branch_labels = None
depends_on = None


def get_all_tables():
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT name FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%alembic%' AND name NOT LIKE '%_temp';
            """,
        ),
    )
    return result.scalars().all()


def import_data_from_temp_table(table: str):
    temp_table = f'{table}_temp'
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    try:
        inspector.get_columns(table)
    except sa.exc.NoSuchTableError:
        return

    # Get columns from the new table
    columns = [col['name'] for col in inspector.get_columns(table)]
    columns = [f'"{c}"' for c in columns]
    column_list = ', '.join(columns)

    op.execute(sa.text(f'INSERT INTO {table} ({column_list}) SELECT {column_list} FROM {temp_table}'))
    op.execute(sa.text(f'DROP TABLE {temp_table}'))


def table_exists(table: str):
    conn = op.get_bind()
    return bool(
        conn.execute(sa.text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}';")).scalars().all()
    )


def fix_migration_relationship():
    def fix_parent_null(table: str, column: str, parent_table: str, parent_column: str):
        if not table_exists(table) or not table_exists(parent_table):
            return

        if table == 'cfg_process_function_column' and not col_exists(table, 'process_column_id'):
            op.execute(sa.text(f'ALTER TABLE {table} ADD COLUMN process_column_id INTEGER'))

        op.execute(sa.text(f'DELETE FROM {table} WHERE {column} IS NULL'))
        op.execute(
            sa.text(
                f"""
DELETE FROM {table}
WHERE NOT EXISTS (
    SELECT 1 FROM {parent_table} parent WHERE parent.{parent_column} = {table}.{column}
)"""
            )
        )

    def fix_parent_maybe_null(table: str, column: str, parent_table: str, parent_column: str):
        if not table_exists(table) or not table_exists(parent_table):
            return

        op.execute(
            sa.text(
                f"""
DELETE FROM {table}
WHERE {column} IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM {parent_table} parent WHERE parent.{parent_column} = {table}.{column}
)"""
            )
        )

    # cfg_csv_column -> cfg_data_source
    fix_parent_null('cfg_csv_column', 'data_source_id', 'cfg_data_source', 'id')

    # cfg_data_source_csv -> cfg_data_source
    fix_parent_null('cfg_data_source_csv', 'id', 'cfg_data_source', 'id')

    # cfg_data_source_db -> cfg_data_source
    fix_parent_null('cfg_data_source_db', 'id', 'cfg_data_source', 'id')

    # cfg process -> cfg_data_source
    fix_parent_null('cfg_process', 'data_source_id', 'cfg_data_source', 'id')
    # self references
    fix_parent_maybe_null('cfg_process', 'parent_id', 'cfg_process', 'id')

    # cfg_process_column -> cfg_process
    fix_parent_null('cfg_process_column', 'process_id', 'cfg_process', 'id')
    # self references
    fix_parent_maybe_null('cfg_process_column', 'parent_id', 'cfg_process_column', 'id')

    # cfg_process_unused_column -> cfg_process
    fix_parent_null('cfg_process_unused_column', 'process_id', 'cfg_process', 'id')

    # cfg_process_function_column -> cfg_process_column
    fix_parent_null('cfg_process_function_column', 'process_column_id', 'cfg_process_column', 'id')

    # cfg_filter -> cfg_process
    fix_parent_null('cfg_filter', 'process_id', 'cfg_process', 'id')
    # self references
    fix_parent_maybe_null('cfg_filter', 'parent_id', 'cfg_filter', 'id')

    # cfg_filter_detail -> cfg_filter
    fix_parent_null('cfg_filter_detail', 'filter_id', 'cfg_filter', 'id')
    # self references
    fix_parent_maybe_null('cfg_filter_detail', 'parent_detail_id', 'cfg_filter_detail', 'id')

    # cfg_import_filter -> cfg_process_column
    fix_parent_null('cfg_import_filter', 'column_id', 'cfg_process_column', 'id')

    # cfg_import_filter_detail -> cfg_import_filter
    fix_parent_null('cfg_import_filter_detail', 'filter_id', 'cfg_import_filter', 'id')

    # cfg_option -> cfg_request
    fix_parent_null('cfg_option', 'req_id', 'cfg_request', 'id')

    # cfg_trace -> cfg_process
    fix_parent_null('cfg_trace', 'self_process_id', 'cfg_process', 'id')
    fix_parent_null('cfg_trace', 'target_process_id', 'cfg_process', 'id')

    # cfg_trace_key -> cfg_trace
    fix_parent_null('cfg_trace_key', 'trace_id', 'cfg_trace', 'id')
    # cfg_trace_key -> cfg_process_column
    fix_parent_null('cfg_trace_key', 'self_column_id', 'cfg_process_column', 'id')
    fix_parent_null('cfg_trace_key', 'target_column_id', 'cfg_process_column', 'id')

    # cfg_visualization -> cfg_process
    fix_parent_null('cfg_visualization', 'process_id', 'cfg_process', 'id')
    # cfg_visualization -> cfg_process_column
    fix_parent_null('cfg_visualization', 'control_column_id', 'cfg_process_column', 'id')
    fix_parent_maybe_null('cfg_visualization', 'filter_column_id', 'cfg_process_column', 'id')
    # cfg_visualization -> cfg_filter_detail
    fix_parent_maybe_null('cfg_visualization', 'filter_detail_id', 'cfg_filter_detail', 'id')

    # t_proc_link -> cfg_process
    fix_parent_null('t_proc_link', 'process_id', 'cfg_process', 'id')
    fix_parent_null('t_proc_link', 'target_process_id', 'cfg_process', 'id')


def fix_migration_cfg_data_source_csv():
    op.execute(sa.text('UPDATE cfg_data_source_csv SET is_transpose = false WHERE is_transpose IS NULL'))


def fix_migration_cfg_process_column():
    # see `Sprint261/BAS4/250417_パフォーマンス調査`
    op.execute(sa.text('UPDATE cfg_process_column SET is_dummy_datetime = false WHERE is_dummy_datetime IS NULL'))
    op.execute(sa.text('UPDATE cfg_process_column SET is_auto_increment = false WHERE is_auto_increment IS NULL'))


def fix_migration_cfg_visualization():
    # see `Sprint271/250820_BlockAssy調査`
    op.execute(
        sa.text(
            """
UPDATE cfg_visualization
SET created_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'
WHERE created_at IS NULL;
"""
        )
    )
    op.execute(
        sa.text(
            """
UPDATE cfg_visualization
SET updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'
WHERE updated_at IS NULL;
"""
        )
    )


def fix_migration_polling_freq_in_cfg_constant():
    op.execute(
        sa.text(
            """
    UPDATE cfg_constant
    SET value = 0
    WHERE type = 'POLLING_FREQUENCY' and value IS NULL;
"""
        )
    )


def fix_delete_data_for_mfunction_and_munit():
    op.execute(sa.text('DROP TABLE IF EXISTS m_function'))
    op.execute(sa.text('DROP TABLE IF EXISTS m_unit'))


def fix_migration_t_job_management_datetime_null():
    op.execute(sa.text('DELETE FROM t_job_management WHERE start_tm IS NULL or end_tm IS NULL'))


def fix_migration():
    """Test with many old app.sqlite3 to make sure we can fix migration correctly
    DELETE should always be called first before UPDATE
    """
    fix_migration_relationship()
    fix_migration_cfg_data_source_csv()
    fix_migration_cfg_process_column()
    fix_migration_cfg_visualization()
    fix_migration_polling_freq_in_cfg_constant()
    fix_delete_data_for_mfunction_and_munit()
    fix_migration_t_job_management_datetime_null()


def upgrade():
    fix_migration()
    remove_orphaned_data()

    all_tables = get_all_tables()
    for table in all_tables:
        temp_table = f'{table}_temp'
        op.execute(sa.text(f'ALTER TABLE {table} RENAME TO {temp_table}'))

    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'cfg_filter',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=True),
        sa.Column('filter_type', sa.VARCHAR(), nullable=False),
        sa.Column('process_id', sa.INTEGER(), nullable=False),
        sa.Column('column_id', sa.INTEGER(), nullable=True),
        sa.Column('parent_id', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_filter_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['parent_id'],
            ['cfg_filter.id'],
            name='fk_cfg_filter_parent_id_cfg_filter',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['process_id'],
            ['cfg_process.id'],
            name='fk_cfg_filter_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_filter'),
    )
    op.create_table(
        'm_unit',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('quantity_jp', sa.VARCHAR(), nullable=False),
        sa.Column('quantity_en', sa.VARCHAR(), nullable=False),
        sa.Column('unit', sa.VARCHAR(), nullable=False),
        sa.Column('type', sa.VARCHAR(), nullable=True),
        sa.Column('base', sa.INTEGER(), nullable=True),
        sa.Column('conversion', sa.FLOAT(), nullable=True),
        sa.Column('denominator', sa.FLOAT(), nullable=True),
        sa.Column('offset', sa.FLOAT(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_m_unit'),
    )
    op.create_table(
        'm_function',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('function_type', sa.VARCHAR(), nullable=False),
        sa.Column('function_name_en', sa.VARCHAR(), nullable=False),
        sa.Column('function_name_jp', sa.VARCHAR(), nullable=False),
        sa.Column('description_en', sa.VARCHAR(), nullable=False),
        sa.Column('description_jp', sa.VARCHAR(), nullable=False),
        sa.Column('x_type', sa.VARCHAR(), nullable=False),
        sa.Column('y_type', sa.VARCHAR(), nullable=True),
        sa.Column('return_type', sa.VARCHAR(), nullable=False),
        sa.Column('show_serial', sa.BOOLEAN(), nullable=False),
        sa.Column('a', sa.VARCHAR(), nullable=True),
        sa.Column('b', sa.VARCHAR(), nullable=True),
        sa.Column('c', sa.VARCHAR(), nullable=True),
        sa.Column('n', sa.VARCHAR(), nullable=True),
        sa.Column('k', sa.VARCHAR(), nullable=True),
        sa.Column('s', sa.VARCHAR(), nullable=True),
        sa.Column('t', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_m_function'),
    )
    op.create_table(
        'cfg_data_source_db',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('host', sa.VARCHAR(), nullable=True),
        sa.Column('port', sa.INTEGER(), nullable=True),
        sa.Column('dbname', sa.VARCHAR(), nullable=False),
        sa.Column('schema', sa.VARCHAR(), nullable=True),
        sa.Column('username', sa.VARCHAR(), nullable=True),
        sa.Column('password', sa.VARCHAR(), nullable=True),
        sa.Column('hashed', sa.BOOLEAN(), nullable=False),
        sa.Column('use_os_timezone', sa.BOOLEAN(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['id'],
            ['cfg_data_source.id'],
            name='fk_cfg_data_source_db_id_cfg_data_source',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_data_source_db'),
    )
    op.create_table(
        't_data_trace_log',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('date_time', sa.VARCHAR(), nullable=False),
        sa.Column('dataset_id', sa.VARCHAR(), nullable=False),
        sa.Column('event_type', sa.VARCHAR(), nullable=True),
        sa.Column('event_action', sa.VARCHAR(), nullable=False),
        sa.Column('target', sa.VARCHAR(), nullable=False),
        sa.Column('exe_time', sa.INTEGER(), nullable=False),
        sa.Column('data_size', sa.INTEGER(), nullable=True),
        sa.Column('rows', sa.INTEGER(), nullable=True),
        sa.Column('cols', sa.INTEGER(), nullable=True),
        sa.Column('dumpfile', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_t_data_trace_log'),
    )
    op.create_table(
        'cfg_process_unused_column',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('process_id', sa.INTEGER(), nullable=False),
        sa.Column('column_name', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['process_id'],
            ['cfg_process.id'],
            name='fk_cfg_process_unused_column_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_process_unused_column'),
    )
    op.create_table(
        'cfg_import_filter_detail',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('value', sa.VARCHAR(), nullable=False),
        sa.Column('filter_id', sa.INTEGER(), nullable=False),
        sa.ForeignKeyConstraint(
            ['filter_id'],
            ['cfg_import_filter.id'],
            name='fk_cfg_import_filter_detail_filter_id_cfg_import_filter',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_import_filter_detail'),
    )
    op.create_table(
        'cfg_data_source',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('type', sa.VARCHAR(), nullable=False),
        sa.Column('comment', sa.VARCHAR(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_data_source'),
    )
    op.create_table(
        'cfg_constant',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('type', sa.VARCHAR(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=True),
        sa.Column('value', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_constant'),
    )
    op.create_table(
        'cfg_visualization',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('process_id', sa.INTEGER(), nullable=False),
        sa.Column('control_column_id', sa.INTEGER(), nullable=False),
        sa.Column('filter_column_id', sa.INTEGER(), nullable=True),
        sa.Column('filter_value', sa.VARCHAR(), nullable=True),
        sa.Column('is_from_data', sa.BOOLEAN(), nullable=False),
        sa.Column('filter_detail_id', sa.INTEGER(), nullable=True),
        sa.Column('ucl', sa.FLOAT(), nullable=True),
        sa.Column('lcl', sa.FLOAT(), nullable=True),
        sa.Column('upcl', sa.FLOAT(), nullable=True),
        sa.Column('lpcl', sa.FLOAT(), nullable=True),
        sa.Column('ymax', sa.FLOAT(), nullable=True),
        sa.Column('ymin', sa.FLOAT(), nullable=True),
        sa.Column('act_from', sa.VARCHAR(), nullable=True),
        sa.Column('act_to', sa.VARCHAR(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.Column('deleted_at', sa.VARCHAR(), nullable=True),
        sa.ForeignKeyConstraint(
            ['control_column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_visualization_control_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['filter_column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_visualization_filter_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['filter_detail_id'],
            ['cfg_filter_detail.id'],
            name='fk_cfg_visualization_filter_detail_id_cfg_filter_detail',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['process_id'],
            ['cfg_process.id'],
            name='fk_cfg_visualization_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_visualization'),
    )
    op.create_table(
        't_job_management',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('job_type', sa.VARCHAR(), nullable=False),
        sa.Column('db_code', sa.INTEGER(), nullable=True),
        sa.Column('db_name', sa.VARCHAR(), nullable=True),
        sa.Column('process_id', sa.INTEGER(), nullable=True),
        sa.Column('process_name', sa.VARCHAR(), nullable=True),
        sa.Column('start_tm', sa.VARCHAR(), nullable=False),
        sa.Column('end_tm', sa.VARCHAR(), nullable=True),
        sa.Column('status', sa.VARCHAR(), nullable=False),
        sa.Column('done_percent', sa.FLOAT(), nullable=False),
        sa.Column('duration', sa.FLOAT(), nullable=False),
        sa.Column('error_msg', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_t_job_management'),
    )
    op.create_table(
        'cfg_import_filter',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('column_id', sa.INTEGER(), nullable=False),
        sa.Column('filter_function', sa.VARCHAR(), nullable=False),
        sa.Column('filter_from_position', sa.INTEGER(), nullable=True),
        sa.ForeignKeyConstraint(
            ['column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_import_filter_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_import_filter'),
    )
    op.create_table(
        'cfg_process',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('name_jp', sa.VARCHAR(), nullable=True),
        sa.Column('name_en', sa.VARCHAR(), nullable=True),
        sa.Column('name_local', sa.VARCHAR(), nullable=True),
        sa.Column('data_source_id', sa.INTEGER(), nullable=False),
        sa.Column('table_name', sa.VARCHAR(), nullable=True),
        sa.Column('master_type', sa.VARCHAR(), nullable=True),
        sa.Column('comment', sa.VARCHAR(), nullable=True),
        sa.Column('is_show_file_name', sa.BOOLEAN(), nullable=True),
        sa.Column('file_name', sa.VARCHAR(), nullable=True),
        sa.Column('process_factid', sa.VARCHAR(), nullable=True),
        sa.Column('etl_func', sa.VARCHAR(), nullable=True),
        sa.Column('parent_id', sa.INTEGER(), nullable=True),
        sa.Column('is_import', sa.BOOLEAN(), nullable=True),
        sa.Column('datetime_format', sa.VARCHAR(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['data_source_id'],
            ['cfg_data_source.id'],
            name='fk_cfg_process_data_source_id_cfg_data_source',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['parent_id'],
            ['cfg_process.id'],
            name='fk_cfg_process_parent_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_process'),
    )
    op.create_table(
        'cfg_trace_key',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('trace_id', sa.INTEGER(), nullable=False),
        sa.Column('self_column_id', sa.INTEGER(), nullable=False),
        sa.Column('self_column_substr_from', sa.INTEGER(), nullable=True),
        sa.Column('self_column_substr_to', sa.INTEGER(), nullable=True),
        sa.Column('target_column_id', sa.INTEGER(), nullable=False),
        sa.Column('target_column_substr_from', sa.INTEGER(), nullable=True),
        sa.Column('target_column_substr_to', sa.INTEGER(), nullable=True),
        sa.Column('delta_time', sa.FLOAT(), nullable=True),
        sa.Column('cut_off', sa.FLOAT(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['self_column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_trace_key_self_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['target_column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_trace_key_target_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['trace_id'],
            ['cfg_trace.id'],
            name='fk_cfg_trace_key_trace_id_cfg_trace',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_trace_key'),
    )
    op.create_table(
        't_abnormal_trace_log',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('date_time', sa.VARCHAR(), nullable=False),
        sa.Column('dataset_id', sa.INTEGER(), nullable=False),
        sa.Column('log_level', sa.VARCHAR(), nullable=False),
        sa.Column('event_type', sa.VARCHAR(), nullable=True),
        sa.Column('event_action', sa.VARCHAR(), nullable=False),
        sa.Column('location', sa.VARCHAR(), nullable=False),
        sa.Column('return_code', sa.VARCHAR(), nullable=False),
        sa.Column('message', sa.VARCHAR(), nullable=False),
        sa.Column('dumpfile', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_t_abnormal_trace_log'),
    )
    op.create_table(
        'cfg_process_column',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('process_id', sa.INTEGER(), nullable=False),
        sa.Column('column_name', sa.VARCHAR(), nullable=False),
        sa.Column('column_raw_name', sa.VARCHAR(), nullable=True),
        sa.Column('name_en', sa.VARCHAR(), nullable=True),
        sa.Column('name_jp', sa.VARCHAR(), nullable=True),
        sa.Column('name_local', sa.VARCHAR(), nullable=True),
        sa.Column('data_type', sa.VARCHAR(), nullable=False),
        sa.Column('raw_data_type', sa.VARCHAR(), nullable=True),
        sa.Column('column_type', sa.INTEGER(), nullable=True),
        sa.Column('is_serial_no', sa.BOOLEAN(), nullable=False),
        sa.Column('is_get_date', sa.BOOLEAN(), nullable=False),
        sa.Column('is_dummy_datetime', sa.BOOLEAN(), nullable=False),
        sa.Column('is_auto_increment', sa.BOOLEAN(), nullable=False),
        sa.Column('is_file_name', sa.BOOLEAN(), nullable=False),
        sa.Column('parent_id', sa.INTEGER(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=True),
        sa.Column('unit', sa.VARCHAR(), nullable=True),
        sa.Column('judge_positive_value', sa.VARCHAR(), nullable=True),
        sa.Column('judge_positive_display', sa.VARCHAR(), nullable=True),
        sa.Column('judge_negative_display', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['parent_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_process_column_parent_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['process_id'],
            ['cfg_process.id'],
            name='fk_cfg_process_column_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_process_column'),
    )
    op.create_table(
        'cfg_trace',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('self_process_id', sa.INTEGER(), nullable=False),
        sa.Column('target_process_id', sa.INTEGER(), nullable=False),
        sa.Column('is_trace_backward', sa.BOOLEAN(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['self_process_id'],
            ['cfg_process.id'],
            name='fk_cfg_trace_self_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['target_process_id'],
            ['cfg_process.id'],
            name='fk_cfg_trace_target_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_trace'),
    )
    op.create_table(
        'cfg_request',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('params', sa.VARCHAR(), nullable=True),
        sa.Column('odf', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_request'),
    )
    op.create_table(
        'cfg_csv_column',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('data_source_id', sa.INTEGER(), nullable=False),
        sa.Column('column_name', sa.VARCHAR(), nullable=False),
        sa.Column('data_type', sa.VARCHAR(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['data_source_id'],
            ['cfg_data_source_csv.id'],
            name='fk_cfg_csv_column_data_source_id_cfg_data_source_csv',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_csv_column'),
    )
    op.create_table(
        'cfg_filter_detail',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('filter_id', sa.INTEGER(), nullable=False),
        sa.Column('parent_detail_id', sa.INTEGER(), nullable=True),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('filter_condition', sa.VARCHAR(), nullable=False),
        sa.Column('filter_function', sa.VARCHAR(), nullable=False),
        sa.Column('filter_from_pos', sa.INTEGER(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['filter_id'],
            ['cfg_filter.id'],
            name='fk_cfg_filter_detail_filter_id_cfg_filter',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['parent_detail_id'],
            ['cfg_filter_detail.id'],
            name='fk_cfg_filter_detail_parent_detail_id_cfg_filter_detail',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_filter_detail'),
    )
    op.create_table(
        't_proc_link',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('job_id', sa.INTEGER(), nullable=True),
        sa.Column('process_id', sa.INTEGER(), nullable=False),
        sa.Column('target_process_id', sa.INTEGER(), nullable=False),
        sa.Column('matched_count', sa.INTEGER(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['job_id'],
            ['t_job_management.id'],
            name='fk_t_proc_link_job_id_t_job_management',
        ),
        sa.ForeignKeyConstraint(
            ['process_id'],
            ['cfg_process.id'],
            name='fk_t_proc_link_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['target_process_id'],
            ['cfg_process.id'],
            name='fk_t_proc_link_target_process_id_cfg_process',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_t_proc_link'),
    )
    with op.batch_alter_table('t_proc_link', schema=None) as batch_op:
        batch_op.execute(sa.text('DROP INDEX IF EXISTS ix_t_proc_link_job_id;'))
        batch_op.create_index('ix_t_proc_link_job_id', ['job_id'], unique=False)

    op.create_table(
        't_app_log',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('ip', sa.VARCHAR(), nullable=False),
        sa.Column('action', sa.VARCHAR(), nullable=False),
        sa.Column('description', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_t_app_log'),
    )
    op.create_table(
        'cfg_option',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('option', sa.VARCHAR(), nullable=False),
        sa.Column('req_id', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['req_id'],
            ['cfg_request.id'],
            name='fk_cfg_option_req_id_cfg_request',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_option'),
    )
    op.create_table(
        'cfg_data_source_csv',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('directory', sa.VARCHAR(), nullable=False),
        sa.Column('skip_head', sa.INTEGER(), nullable=True),
        sa.Column('skip_tail', sa.INTEGER(), nullable=False),
        sa.Column('n_rows', sa.INTEGER(), nullable=True),
        sa.Column('is_transpose', sa.BOOLEAN(), nullable=False),
        sa.Column('delimiter', sa.VARCHAR(), nullable=False),
        sa.Column('etl_func', sa.VARCHAR(), nullable=True),
        sa.Column('process_name', sa.VARCHAR(), nullable=True),
        sa.Column('dummy_header', sa.BOOLEAN(), nullable=False),
        sa.Column('is_file_checker', sa.BOOLEAN(), nullable=False),
        sa.Column('is_file_path', sa.BOOLEAN(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['id'],
            ['cfg_data_source.id'],
            name='fk_cfg_data_source_csv_id_cfg_data_source',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_data_source_csv'),
    )
    op.create_table(
        'cfg_process_function_column',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('process_column_id', sa.INTEGER(), nullable=False),
        sa.Column('function_id', sa.INTEGER(), nullable=False),
        sa.Column('var_x', sa.INTEGER(), nullable=False),
        sa.Column('var_y', sa.INTEGER(), nullable=True),
        sa.Column('return_type', sa.VARCHAR(), nullable=False),
        sa.Column('a', sa.VARCHAR(), nullable=True),
        sa.Column('b', sa.VARCHAR(), nullable=True),
        sa.Column('c', sa.VARCHAR(), nullable=True),
        sa.Column('n', sa.VARCHAR(), nullable=True),
        sa.Column('k', sa.VARCHAR(), nullable=True),
        sa.Column('s', sa.VARCHAR(), nullable=True),
        sa.Column('t', sa.VARCHAR(), nullable=True),
        sa.Column('note', sa.VARCHAR(), nullable=True),
        sa.Column('order', sa.INTEGER(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(
            ['process_column_id'],
            ['cfg_process_column.id'],
            name='fk_cfg_process_function_column_process_column_id_cfg_process_column',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_process_function_column'),
    )
    op.create_table(
        'cfg_user_setting',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('key', sa.VARCHAR(), nullable=False),
        sa.Column('title', sa.VARCHAR(), nullable=False),
        sa.Column('page', sa.VARCHAR(), nullable=False),
        sa.Column('created_by', sa.VARCHAR(), nullable=False),
        sa.Column('priority', sa.INTEGER(), nullable=False),
        sa.Column('use_current_time', sa.BOOLEAN(), nullable=False),
        sa.Column('description', sa.VARCHAR(), nullable=False),
        sa.Column('share_info', sa.BOOLEAN(), nullable=False),
        sa.Column('save_graph_settings', sa.BOOLEAN(), nullable=False),
        sa.Column('settings', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', sa.VARCHAR(), nullable=False),
        sa.Column('updated_at', sa.VARCHAR(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_cfg_user_setting'),
    )
    # ### end Alembic commands ###

    for table in all_tables:
        import_data_from_temp_table(table)


def downgrade():
    with op.batch_alter_table('t_proc_link', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_t_proc_link_job_id'))
