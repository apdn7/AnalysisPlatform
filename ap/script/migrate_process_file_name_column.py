from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcess, CfgProcessColumn

create_file_name = """ALTER TABLE cfg_process ADD COLUMN file_name TEXT;"""
create_column_raw_name = """ALTER TABLE cfg_process_column ADD COLUMN column_raw_name TEXT;"""
update_column_raw_name = """UPDATE cfg_process_column SET column_raw_name = column_name;"""
create_column_type = """ALTER TABLE cfg_process ADD COLUMN column_type INTEGER;"""


def migrate_cfg_process_add_file_name(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.file_name.name)

    if not is_col_existing:
        app_db.execute_sql(create_file_name)
    app_db.disconnect()


def migrate_cfg_process_column_add_column_raw_name(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, CfgProcessColumn.column_raw_name.name)

    if not is_col_existing:
        app_db.execute_sql(create_column_raw_name)
        # app_db.execute_sql(update_column_raw_name)
    app_db.disconnect()


def migrate_cfg_process_column_add_column_type(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, CfgProcessColumn.column_type.name)

    if not is_col_existing:
        app_db.execute_sql(create_column_type)
    app_db.disconnect()
