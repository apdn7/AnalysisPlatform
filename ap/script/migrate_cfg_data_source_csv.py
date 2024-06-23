from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import CfgDataSourceCSV, CfgProcessColumn, CfgProcess

process_name_column = """alter table cfg_data_source_csv add process_name text;"""
dummy_header_column = """alter table cfg_data_source_csv add dummy_header boolean;"""
n_rows_column = """alter table cfg_data_source_csv add column n_rows integer;"""
is_transpose_column = """alter table cfg_data_source_csv add column is_transpose boolean;"""


def migrate_cfg_data_source_csv(app_db_src):
    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    is_process_name_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.process_name.name
    )
    is_dummy_header_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.dummy_header.name
    )
    is_n_rows_column_existing = app_db.is_column_existing(CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.n_rows.name)
    is_is_transpose_column_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.is_transpose.name
    )
    if not is_process_name_existing:
        app_db.execute_sql(process_name_column)
    if not is_dummy_header_existing:
        app_db.execute_sql(dummy_header_column)
    if not is_n_rows_column_existing:
        app_db.execute_sql(n_rows_column)
    if not is_is_transpose_column_existing:
        app_db.execute_sql(is_transpose_column)

    migrate_cfg_process_column(app_db)
    app_db.disconnect()


def migrate_cfg_process_column(app_db):
    is_english_name_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'english_name')
    is_name_en_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'name_en')

    is_name_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'name')

    is_name_jp_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'name_jp')

    is_name_local_existing = app_db.is_column_existing(CfgProcessColumn.__table__.name, 'name_local')

    if is_english_name_existing and not is_name_en_existing:
        app_db.execute_sql("""ALTER TABLE cfg_process_column ADD name_en text;""")
        app_db.execute_sql("""UPDATE cfg_process_column SET name_en = english_name;""")
        # app_db.execute_sql("""ALTER TABLE cfg_process_column DROP english_name;""")

    if is_name_existing and not is_name_jp_existing:
        app_db.execute_sql("""ALTER TABLE cfg_process_column ADD name_jp text;""")
        app_db.execute_sql("""UPDATE cfg_process_column SET name_jp = name;""")
        # app_db.execute_sql("""ALTER TABLE cfg_process_column DROP name;""")

    if not is_name_local_existing:
        app_db.execute_sql("""ALTER TABLE cfg_process_column ADD name_local text;""")
    is_process_name_jp_existing = app_db.is_column_existing(CfgProcess.__table__.name, 'name_jp')

    is_process_name_en_existing = app_db.is_column_existing(CfgProcess.__table__.name, 'name_en')

    is_process_name_local_existing = app_db.is_column_existing(CfgProcess.__table__.name, 'name_local')

    if not is_process_name_jp_existing:
        app_db.execute_sql("""ALTER TABLE cfg_process ADD name_jp text;""")
        app_db.execute_sql("""UPDATE cfg_process SET name_jp = name;""")
    if not is_process_name_en_existing:
        app_db.execute_sql("""ALTER TABLE cfg_process ADD name_en text;""")
        # app_db.execute_sql("""UPDATE cfg_process SET name_en = name;""")
        # insert to_romaji value
    if not is_process_name_local_existing:
        app_db.execute_sql("""ALTER TABLE cfg_process ADD name_local text;""")
