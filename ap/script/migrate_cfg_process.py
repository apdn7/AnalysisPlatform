from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcess, CfgProcessColumn

create_is_show_file_name = """ALTER TABLE cfg_process ADD COLUMN is_show_file_name BOOLEAN;"""
update_is_show_file_name = """UPDATE cfg_process SET is_show_file_name = 0;"""
create_is_import = """ALTER TABLE cfg_process ADD COLUMN is_import BOOLEAN;"""
update_is_import = """UPDATE cfg_process SET is_import = 1;"""
create_process_factid = """ALTER TABLE cfg_process ADD COLUMN process_factid TEXT;"""
remove_process_factname = """ALTER TABLE cfg_process DROP COLUMN process_factname;"""
create_master_type = """ALTER TABLE cfg_process ADD COLUMN master_type TEXT;"""
create_elt_func = """ALTER TABLE cfg_process ADD COLUMN etl_func TEXT;"""
update_master_type_and_table_name = """UPDATE cfg_process
SET master_type = 'SOFTWARE_WORKSHOP_MEASUREMENT',
    table_name = CONCAT('measurement_', table_name)
WHERE master_type IS NULL AND process_factid IS NOT NULL AND process_factid != '';"""
update_suffix_table_name = """UPDATE cfg_process
SET table_name = CASE
    WHEN table_name LIKE 'measurement_%' THEN REPLACE(table_name, 'measurement_', '') || '_measurement'
    WHEN table_name LIKE 'history_%' THEN REPLACE(table_name, 'history_', '') || '_history'
    ELSE table_name END
WHERE master_type IS NOT NULL AND process_factid IS NOT NULL AND process_factid != '';
"""


def migrate_cfg_process(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    migrate_cfg_process_add_is_show_file_name(app_db)
    migrate_cfg_process_add_is_import(app_db)
    migrate_cfg_process_add_process_factid(app_db)
    migrate_cfg_process_add_master_type(app_db)
    migrate_cfg_process_remove_process_factname(app_db)
    migrate_cfg_process_add_process_etl_func(app_db)
    app_db.disconnect()


def migrate_cfg_process_add_is_show_file_name(app_db):
    is_col_existing = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.is_show_file_name.name)
    if not is_col_existing:
        app_db.execute_sql(create_is_show_file_name)
        app_db.execute_sql(update_is_show_file_name)


def migrate_cfg_process_add_process_factid(app_db):
    is_col_process_factid = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.process_factid.name)
    if not is_col_process_factid:
        app_db.execute_sql(create_process_factid)


def migrate_cfg_process_remove_process_factname(app_db):
    is_col_process_factname = app_db.is_column_existing(CfgProcess.__table__.name, 'process_factname')
    if is_col_process_factname:
        app_db.execute_sql(remove_process_factname)


def migrate_cfg_process_add_master_type(app_db):
    is_col_master_type = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.master_type.name)
    if not is_col_master_type:
        app_db.execute_sql(create_master_type)
        app_db.execute_sql(update_master_type_and_table_name)

    app_db.execute_sql(update_suffix_table_name)


def migrate_cfg_process_add_process_etl_func(app_db):
    is_col_process_etl_func = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.etl_func.name)
    if not is_col_process_etl_func:
        app_db.execute_sql(create_elt_func)


def migrate_cfg_process_add_is_import(app_db):
    is_col_existing = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.is_import.name)
    if not is_col_existing:
        app_db.execute_sql(create_is_import)
        app_db.execute_sql(update_is_import)
