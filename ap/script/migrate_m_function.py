import os

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from ap.common.common_utils import create_sa_engine_for_migration
from ap.common.path_utils import get_dummy_data_path
from ap.common.pydn.dblib import sqlite


def migrate_existing_m_funcions(app_db_src):
    from ap.setting_module.models import CfgProcessFunctionColumn, MFunction, CfgProcessColumn

    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()

    cols = [
        (CfgProcessColumn.__table__.name, CfgProcessColumn.raw_data_type.name, 'TEXT', 'data_type'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.a.name, 'TEXT', 'coe_a_n_s'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.b.name, 'TEXT', 'coe_b_k_t'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.c.name, 'TEXT', 'coe_c'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.n.name, 'TEXT', 'coe_a_n_s'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.k.name, 'TEXT', 'coe_b_k_t'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.s.name, 'TEXT', 'coe_a_n_s'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.t.name, 'TEXT', 'coe_b_k_t'),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.order.name, 'INTEGER', None),
        (CfgProcessFunctionColumn.__table__.name, CfgProcessFunctionColumn.process_column_id.name, 'INTEGER', None),
        (MFunction.__table__.name, MFunction.a.name, 'TEXT', 'coe_a_n_s'),
        (MFunction.__table__.name, MFunction.b.name, 'TEXT', 'coe_b_k_t'),
        (MFunction.__table__.name, MFunction.c.name, 'TEXT', 'coe_c'),
        (MFunction.__table__.name, MFunction.n.name, 'TEXT', 'coe_a_n_s'),
        (MFunction.__table__.name, MFunction.k.name, 'TEXT', 'coe_b_k_t'),
        (MFunction.__table__.name, MFunction.s.name, 'TEXT', 'coe_a_n_s'),
        (MFunction.__table__.name, MFunction.t.name, 'TEXT', 'coe_b_k_t'),
        (MFunction.__table__.name, MFunction.function_name_en.name, 'TEXT', None),
        (MFunction.__table__.name, MFunction.function_name_jp.name, 'TEXT', None),
    ]
    for table, col, dtype, default_value in cols:
        is_col_existing = app_db.is_column_existing(table, col)
        is_default_col_existing = app_db.is_column_existing(table, default_value)
        if not is_col_existing:
            query = f"""ALTER TABLE {table} ADD '{col}' {dtype};"""
            app_db.execute_sql(query)
            if default_value and is_default_col_existing:
                query = f"""UPDATE {table} SET {col} = {default_value};"""
                app_db.execute_sql(query)
    app_db.disconnect()


def migrate_set_order_of_cfg_function_column_null(app_db_src):
    from ap.setting_module.models import CfgProcessFunctionColumn, MFunction, CfgProcessColumn

    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()

    is_col_existing = app_db.is_column_existing('cfg_process_function_column', 'order')
    if is_col_existing:
        sql = f'''
            ALTER TABLE 'cfg_process_function_column' DROP COLUMN "order";
            '''
        app_db.execute_sql(sql)
        sql = f'''
            ALTER TABLE 'cfg_process_function_column' ADD COLUMN "order" INTEGER;
            '''
        app_db.execute_sql(sql)
    app_db.disconnect()


def update_data_type_for_function_column_and_remove_unused_column(app_db_src):
    from ap.setting_module.models import CfgProcessFunctionColumn

    app_db = sqlite.SQLite3(app_db_src)
    app_db.connect()
    # remove unused column
    for col in ['coe_a_n_s', 'coe_b_k_t', 'coe_c']:
        table = CfgProcessFunctionColumn.__tablename__
        is_col_existing = app_db.is_column_existing(table, col)
        if is_col_existing:
            app_db.execute_sql(
                f'''
                ALTER TABLE {table} DROP COLUMN {col};
                ''',
            )
    app_db.disconnect()


def migrate_m_function_data(app_db_src):
    from ap.setting_module.models import MFunction

    # migrate columns in existing table
    migrate_existing_m_funcions(app_db_src)

    engine = create_sa_engine_for_migration('sqlite:///' + app_db_src)

    with engine.connect() as conn:
        m_function_count = conn.execute(text('select count(*) from m_function')).fetchone()[0]
        if m_function_count > 0:
            # delete old m_function data to update from dataset
            conn.execute(text('delete from m_function where 1=1'))
            conn.close()

    with engine.connect() as conn:
        session = Session(bind=conn)
        m_function_file = os.path.join(get_dummy_data_path(), '19.m_function.tsv')

        dtypes = {
            'a': pd.StringDtype(),
            'b': pd.StringDtype(),
            'c': pd.StringDtype(),
            'n': pd.StringDtype(),
            'k': pd.StringDtype(),
            's': pd.StringDtype(),
            't': pd.StringDtype(),
            'function_name_en': pd.StringDtype(),
            'function_name_jp': pd.StringDtype(),
        }
        records = (
            pd.read_csv(m_function_file, sep='\t', index_col=False, dtype=dtypes)
            .replace({pd.NA: None, np.nan: None})
            .to_dict('records')
        )
        for r in records:
            session.merge(MFunction(**r))
        session.commit()
        session.close()

    update_data_type_for_function_column_and_remove_unused_column(app_db_src)
