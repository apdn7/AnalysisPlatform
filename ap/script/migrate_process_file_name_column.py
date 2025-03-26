from sqlalchemy import create_engine, null
from sqlalchemy.orm import load_only, Session

from ap.common.common_utils import create_sa_engine_for_migration
from ap.common.constants import DataColumnType
from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgProcess, CfgProcessColumn

create_file_name = """ALTER TABLE cfg_process ADD COLUMN file_name TEXT;"""
create_column_raw_name = """ALTER TABLE cfg_process_column ADD COLUMN column_raw_name TEXT;"""
update_column_raw_name = """UPDATE cfg_process_column SET column_raw_name = column_name;"""
create_column_type = """ALTER TABLE cfg_process ADD COLUMN column_type INTEGER;"""
create_datetime_column = """ALTER TABLE cfg_process ADD COLUMN datetime_format TEXT;"""
create_column_raw_dtype = """ALTER TABLE cfg_process_column ADD COLUMN raw_data_type TEXT;"""
update_column_raw_dtype = """UPDATE cfg_process_column SET raw_data_type = data_type;"""


def migrate_cfg_process_add_file_name(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.file_name.name)

    if not is_col_existing:
        app_db.execute_sql(create_file_name)

    migrate_cfg_process_add_datetime_format(app_db)
    app_db.disconnect()


def migrate_cfg_process_add_datetime_format(app_db):
    is_col_existing = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.datetime_format.name)
    if not is_col_existing:
        app_db.execute_sql(create_datetime_column)


def migrate_cfg_process_column_add_column_raw_name(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, CfgProcessColumn.column_raw_name.name)

    if not is_col_existing:
        app_db.execute_sql(create_column_raw_name)
        # app_db.execute_sql(update_column_raw_name)
    app_db.disconnect()


def migrate_cfg_process_column_add_column_raw_dtype(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, CfgProcessColumn.raw_data_type.name)

    if not is_col_existing:
        app_db.execute_sql(create_column_raw_dtype)
        app_db.execute_sql(update_column_raw_dtype)
    app_db.disconnect()


def migrate_cfg_process_column_add_column_type(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, CfgProcessColumn.column_type.name)

    if not is_col_existing:
        app_db.execute_sql(create_column_type)
    app_db.disconnect()


def migrate_cfg_process_column_add_parent_id(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_col_existing_in_cfgprocess_col = app_db.is_column_existing(
        CfgProcessColumn.__table__.name, CfgProcessColumn.parent_id.name
    )
    is_col_existing_in_cfgprocess = app_db.is_column_existing(CfgProcess.__table__.name, CfgProcess.parent_id.name)

    cfgprocess_column_query = (
        """ALTER TABLE cfg_process_column ADD COLUMN parent_id INTEGER REFERENCES cfg_process_column(id);"""
    )
    cfgprocess_query = """ALTER TABLE cfg_process ADD COLUMN parent_id INTEGER REFERENCES cfg_process(id);"""
    if not is_col_existing_in_cfgprocess_col:
        app_db.execute_sql(cfgprocess_column_query)

    if not is_col_existing_in_cfgprocess:
        app_db.execute_sql(cfgprocess_query)
    app_db.disconnect()


def migrate_cfg_process_column_change_all_generated_datetime_column_type(app_db_src):
    engine = create_sa_engine_for_migration('sqlite:///' + app_db_src)
    datetime_generated = 'DatetimeGenerated'
    with engine.connect() as conn:
        session = Session(bind=conn)
        base_proc = session.query(CfgProcess).options(load_only(CfgProcess.id)).filter_by(parent_id=null()).all()
        for proc in base_proc:
            proc_column_rows = session.query(CfgProcessColumn).filter_by(process_id=proc.id).all()
            cols_name = [col.column_name for col in proc_column_rows]
            if datetime_generated not in cols_name:
                continue
            rows_date_time = []
            rows_datetime_generated = []
            for row in proc_column_rows:
                column_type = row.column_type
                column_name = row.column_name
                if column_name != datetime_generated and column_type == DataColumnType.DATETIME.value:
                    rows_date_time.append(row)
                if row.column_name == datetime_generated and column_type != DataColumnType.DATETIME.value:
                    rows_datetime_generated.append(row)
            if len(rows_datetime_generated) == 1 and len(rows_date_time) == 0:
                rows_datetime_generated[-1].column_type = DataColumnType.DATETIME.value
                session.add(rows_datetime_generated[-1])
                session.commit()
    session.close()
