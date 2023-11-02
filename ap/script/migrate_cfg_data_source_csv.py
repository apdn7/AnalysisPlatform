from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgDataSourceCSV

process_name_column = """alter table cfg_data_source_csv add process_name text;"""


def migrate_cfg_data_source_csv(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_process_name_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.process_name.name
    )

    if not is_process_name_existing:
        app_db.execute_sql(process_name_column)
    app_db.disconnect()
