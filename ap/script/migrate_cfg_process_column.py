from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcessColumn

delete_operator_column = """ALTER TABLE cfg_process_column DROP COLUMN operator"""
delete_coef_column = """ALTER TABLE cfg_process_column DROP COLUMN coef"""
add_unit_column = """ALTER TABLE cfg_process_column ADD COLUMN unit TEXT;"""


def migrate_cfg_process_column(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    del_operator_and_coef(app_db)
    add_column_unit(app_db)
    app_db.disconnect()


def del_operator_and_coef(app_db):
    is_col_operator_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'operator')
    is_col_coef_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'coef')
    if is_col_operator_existing:
        app_db.execute_sql(delete_operator_column)
    if is_col_coef_existing:
        app_db.execute_sql(delete_coef_column)


def add_column_unit(app_db):
    is_col_unit_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, CfgProcessColumn.unit.name)
    if not is_col_unit_existing:
        app_db.execute_sql(add_unit_column)
