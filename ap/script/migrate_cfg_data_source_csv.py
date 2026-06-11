import sqlalchemy as sa
from ap.api.setting_module.services.show_latest_record import preview_csv_data
from ap.common.constants import DBType, RelationShip, DATA_TYPE_ESTIMATION_LIMIT, Encoding
from ap.common.pydn.dblib import sqlite
from ap.setting_module.models import (
    CfgDataSourceCSV,
    CfgProcessColumn,
    CfgProcess,
)

process_name_column = """alter table cfg_data_source_csv add process_name text;"""
dummy_header_column = """alter table cfg_data_source_csv add dummy_header boolean default false;"""
n_rows_column = """alter table cfg_data_source_csv add column n_rows integer;"""
is_transpose_column = """alter table cfg_data_source_csv add column is_transpose boolean default false;"""
is_file_path_column = """alter table cfg_data_source_csv add column is_file_path boolean default false;"""
is_file_checker = """alter table cfg_data_source_csv add column is_file_checker boolean default false;"""
auto_encoding_column = """alter table cfg_data_source_csv add column auto_encoding boolean default true;"""
encoding_column = """alter table cfg_data_source_csv add column encoding text;"""

update_dummy_header_default = "update cfg_data_source_csv set dummy_header = false where dummy_header is null;"
update_is_transpose_default = "update cfg_data_source_csv set is_transpose = false where is_transpose is null;"
update_is_file_path_default = "update cfg_data_source_csv set is_file_path = false where is_file_path is null;"
update_is_file_checker_default = "update cfg_data_source_csv set is_file_checker = false where is_file_checker is null;"


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
    is_file_path_column_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.is_file_path.name
    )
    is_file_checker_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.is_file_checker.name
    )
    is_encoding_column_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.encoding.name
    )
    is_auto_encoding_column_existing = app_db.is_column_existing(
        CfgDataSourceCSV.__table__.name, CfgDataSourceCSV.auto_encoding.name
    )

    if not is_process_name_existing:
        app_db.execute_sql(process_name_column)
    if not is_dummy_header_existing:
        app_db.execute_sql(dummy_header_column)
    else:
        app_db.execute_sql(update_dummy_header_default)
    if not is_n_rows_column_existing:
        app_db.execute_sql(n_rows_column)
    if not is_is_transpose_column_existing:
        app_db.execute_sql(is_transpose_column)
    else:
        app_db.execute_sql(update_is_transpose_default)
    if not is_file_path_column_existing:
        app_db.execute_sql(is_file_path_column)
    else:
        app_db.execute_sql(update_is_file_path_default)
    if not is_file_checker_existing:
        app_db.execute_sql(is_file_checker)
    else:
        app_db.execute_sql(update_is_file_checker_default)
    if not is_encoding_column_existing:
        app_db.execute_sql(encoding_column)
    if not is_auto_encoding_column_existing:
        app_db.execute_sql(auto_encoding_column)

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


def migrate_skip_head_value(conn):
    get_ds_csv_sql = "SELECT * FROM cfg_data_source_csv"
    data_sources = conn.execute(sa.text(get_ds_csv_sql) ).fetchall()
    data_sources: list[dict] = [data_source._asdict() for data_source in data_sources]
    for csv_detail in data_sources:
        # for existing csv data sources, convert skip_head from 0 to None if there is no dummy header generated
        if not csv_detail['dummy_header'] and csv_detail['skip_head'] == 0:
            csv_detail['skip_head'] = None
            cols_str = ','.join([k for k in csv_detail.keys()])
            param_str = ','.join([f':{key}' for key in csv_detail.keys()])
            conn.execute(
                sa.text(f'INSERT OR REPLACE INTO cfg_data_source_csv ({cols_str}) VALUES ({param_str})').bindparams(
                    *[sa.bindparam(key, value, literal_execute=True) for key, value in csv_detail.items()]
                )
            )


def migrate_csv_encoding(conn):
    get_ds_csv_sql = "SELECT * FROM cfg_data_source_csv"
    data_sources = conn.execute(sa.text(get_ds_csv_sql)).fetchall()
    data_sources: list[dict] = [data_source._asdict() for data_source in data_sources]
    for data_source in data_sources:
        # default encoding
        encoding = Encoding.UTF8.code
        try:
            dic_preview = preview_csv_data(
                folder_url=data_source.directory,
                etl_func=data_source.etl_func,
                csv_delimiter=data_source.delimiter,
                limit=10,
                return_df=True,
                max_records=DATA_TYPE_ESTIMATION_LIMIT,
                file_name=None,
                is_file_checker=data_source.is_file_checker,
                n_rows=data_source.n_rows,
            )
            encoding = dic_preview.get('encoding')
        except Exception:
            pass

        data_source['encoding'] = encoding
        cols_str = ','.join([k for k in data_source.keys()])
        param_str = ','.join([f':{key}' for key in data_source.keys()])
        conn.execute(
            sa.text(f'INSERT OR REPLACE INTO cfg_data_source_csv ({cols_str}) VALUES ({param_str})').bindparams(
                *[sa.bindparam(key, value, literal_execute=True) for key, value in data_source.items()]
            )
        )