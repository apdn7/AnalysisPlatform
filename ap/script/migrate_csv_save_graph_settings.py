from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgUserSetting

create_column = """ALTER TABLE cfg_user_setting ADD COLUMN save_graph_settings BOOLEAN;"""
update_datatype = """UPDATE cfg_user_setting SET save_graph_settings = 0;"""


def migrate_csv_save_graph_settings(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgUserSetting.__table__.name, CfgUserSetting.save_graph_settings.name)

    if not is_col_existing:
        app_db.execute_sql(create_column)
        app_db.execute_sql(update_datatype)
    app_db.disconnect()
