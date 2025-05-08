from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcessColumn

create_column = """ALTER TABLE cfg_process_column ADD COLUMN predict_type TEXT;"""
update_datatype = """UPDATE cfg_process_column SET predict_type = data_type;"""


def migrate_csv_datatype(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'predict_type')

    if not is_col_existing:
        app_db.execute_sql(create_column)
        app_db.execute_sql(update_datatype)
    app_db.disconnect()
