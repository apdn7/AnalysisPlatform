from ap.common.pydn.dblib import sqlite


def migrate_delta_time_in_cfg_trace_key(app_db_src):
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
