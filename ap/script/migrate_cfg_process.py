from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcess, CfgProcessColumn

create_is_show_file_name = """ALTER TABLE cfg_process ADD COLUMN is_show_file_name BOOLEAN;"""
update_is_show_file_name = """UPDATE cfg_process SET is_show_file_name = 0;"""


def migrate_cfg_process_add_is_show_file_name(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.is_show_file_name.name)
    if not is_col_existing:
        app_db.execute_sql(create_is_show_file_name)
        app_db.execute_sql(update_is_show_file_name)
    app_db.disconnect()
