from ap.common.pydn.dblib import sqlite


def migrate_delta_time_in_cfg_trace_key(app_db_src):
    create_delta_time_and_cutoff(app_db_src)
    change_delta_time_and_cut_off_data_type(app_db_src)


def create_delta_time_and_cutoff(app_db_src):
    from ap.setting_module.models import CfgTraceKey

    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgTraceKey.__table__.name, CfgTraceKey.delta_time.name)
    is_cutoff_col_existing = app_db.is_column_existing(CfgTraceKey.__table__.name, CfgTraceKey.cut_off.name)

    create_column = """ALTER TABLE cfg_trace_key ADD delta_time INTEGER;"""
    create_cutoff_column = """ALTER TABLE cfg_trace_key ADD cut_off INTEGER;"""

    if not is_col_existing:
        app_db.execute_sql(create_column)
    if not is_cutoff_col_existing:
        app_db.execute_sql(create_cutoff_column)
    app_db.disconnect()


def change_delta_time_and_cut_off_data_type(app_db_src):
    from ap.setting_module.models import CfgTraceKey

    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()

    delta_time_column_type = app_db.get_column_type(CfgTraceKey.__tablename__, CfgTraceKey.delta_time.name)
    cut_off_column_type = app_db.get_column_type(CfgTraceKey.__tablename__, CfgTraceKey.cut_off.name)

    def change_column_to_real_sql(table, old_column, new_column):
        return [
            f'ALTER TABLE {table} ADD COLUMN {new_column} REAL;',
            f'UPDATE {table} SET {new_column} = CAST({old_column} AS REAL);',
            f'ALTER TABLE {table} DROP COLUMN {old_column};',
            f'ALTER TABLE {table} RENAME COLUMN {new_column} TO {old_column};',
        ]

    if delta_time_column_type != 'REAL':
        for sql in change_column_to_real_sql(
            CfgTraceKey.__tablename__,
            CfgTraceKey.delta_time.name,
            'delta_time_20240711',
        ):
            app_db.execute_sql(sql)

    if cut_off_column_type != 'REAL':
        for sql in change_column_to_real_sql(
            CfgTraceKey.__tablename__,
            CfgTraceKey.cut_off.name,
            'cut_off_20240711',
        ):
            app_db.execute_sql(sql)

    app_db.disconnect()
