from ap.common.constants import DataColumnType
from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcessColumn

delete_operator_column = """ALTER TABLE cfg_process_column DROP COLUMN operator"""
delete_coef_column = """ALTER TABLE cfg_process_column DROP COLUMN coef"""
add_unit_column = """ALTER TABLE cfg_process_column ADD COLUMN unit TEXT;"""
add_is_file_name_column = """ALTER TABLE cfg_process_column ADD COLUMN is_file_name BOOLEAN default false;"""


def migrate_cfg_process_column(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    del_operator_and_coef(app_db)
    add_column_unit(app_db)
    add_column_is_file_name(app_db)
    migrate_column_raw_name(app_db)
    migrate_is_serial_no(app_db)
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


def add_column_is_file_name(app_db):
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'is_file_name')
    if not is_col_existing:
        app_db.execute_sql(add_is_file_name_column)

        # migrate data
        sql_update = """UPDATE cfg_process_column
        SET is_file_name = '1'
        WHERE column_name == 'FileName';"""

        app_db.execute_sql(sql_update)

    # make sure to migrate 'null' into '0'
    sql_update = """UPDATE cfg_process_column
    SET is_file_name = '0'
    WHERE is_file_name IS NULL;"""

    app_db.execute_sql(sql_update)


def migrate_column_raw_name(app_db):
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'column_raw_name')
    if is_col_existing:
        # migrate data
        sql_update = """UPDATE cfg_process_column
        SET column_raw_name = column_name
        WHERE column_raw_name is null;"""

        app_db.execute_sql(sql_update)


def migrate_is_serial_no(app_db):
    # for old dbs where is_serial_no is true for both serial and main_serial
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'column_type')
    if is_col_existing:
        sql_update = f"""UPDATE cfg_process_column
        SET is_serial_no = 0
        WHERE column_type is {DataColumnType.SERIAL.value};"""

        app_db.execute_sql(sql_update)
