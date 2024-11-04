from __future__ import annotations

import logging

import pandas as pd
from sqlalchemy.orm import scoped_session

from ap.api.common.services.show_graph_database import preprocess_column
from ap.api.setting_module.services.software_workshop_etl_services import (
    child_equips_table,
    get_processes_stmt,
)
from ap.api.setting_module.services.v2_etl_services import is_v2_data_source, save_unused_columns
from ap.common.constants import (
    ID,
    TABLE_PROCESS_NAME,
    UNDER_SCORE,
    DataType,
    DBType,
    MasterDBType,
)
from ap.common.memoize import CustomCache
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import normalize_list
from ap.equations.utils import get_all_functions_info
from ap.setting_module.models import (
    CfgDataSource,
    CfgFilter,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    CfgVisualization,
    make_session,
    use_meta_session,
)
from ap.setting_module.schemas import (
    FilterSchema,
    ProcessColumnSchema,
    ProcessOnlySchema,
    ProcessSchema,
    ProcessVisualizationSchema,
)
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)


def get_all_process(with_parent=True):
    process = CfgProcess.get_all(with_parent) or []
    return process


def get_all_functions():
    all_functions_info = get_all_functions_info()
    all_functions_info = [function_info.model_dump() for function_info in all_functions_info]
    return all_functions_info


def get_all_process_no_nested(with_parent=True):
    process_only_schema = ProcessOnlySchema(many=True)
    processes = CfgProcess.get_all(with_parent) or []
    return process_only_schema.dump(processes, many=True)


def get_process_cfg(proc_id):
    process_schema = ProcessSchema()
    process = CfgProcess.query.get(proc_id) or {}
    if process and not process.name_en:
        process.name_en = to_romaji(process.name_jp)
    return process_schema.dump(process)


def get_process_columns(proc_id):
    proc_col_schema = ProcessColumnSchema(many=True)
    columns = CfgProcessColumn.query.filter(CfgProcessColumn.process_id == proc_id).all() or []
    columns = map(preprocess_column, columns)
    return proc_col_schema.dump(columns)


def get_process_filters(proc_id):
    proc_filter_schema = FilterSchema(many=True)
    filters = CfgFilter.query.filter(CfgFilter.process_id == proc_id).all() or []
    return proc_filter_schema.dump(filters)


def get_process_visualizations(proc_id):
    proc_vis_schema = ProcessVisualizationSchema()
    process = CfgProcess.query.get(proc_id) or {}
    return proc_vis_schema.dump(process)


def get_all_visualizations():
    return list({cfg.filter_detail_id for cfg in CfgVisualization.get_filter_ids()})


# def get_all_process_cfg_with_nested():
#     process_schema = ProcessSchema(many=True)
#     processes = CfgProcess.get_all() or []
#     return process_schema.dump(processes, many=True)


@use_meta_session()
def create_or_update_process_cfg(proc_data, unused_columns, meta_session: scoped_session = None):
    is_create_new = False
    need_to_deleted_cols = []
    transaction_ds = gen_data_source_of_universal_db(proc_data[ID])
    # get existing columns from transaction table
    if proc_data[ID] and len(unused_columns) and is_v2_data_source(process_id=proc_data[ID]):
        with DbProxy(transaction_ds, True, immediate_isolation_level=False):
            origin_proc_data = TransactionData(proc_data[ID], meta_session=meta_session)
            for col in unused_columns:
                col_dat = origin_proc_data.get_cfg_column_by_name(col, is_compare_bridge_column_name=False)
                if col_dat:
                    need_to_deleted_cols.append(col_dat.bridge_column_name)

    # create column alchemy object + assign process id
    process = CfgProcess(**proc_data)
    columns = process.columns
    dict_id_column_name = {}
    for proc_column in columns:
        # transform data type
        proc_column.predict_type = proc_column.data_type
        if proc_column.data_type in (DataType.EU_REAL_SEP.name, DataType.REAL_SEP.name):
            proc_column.data_type = DataType.REAL.name
        if proc_column.data_type in (DataType.EU_INTEGER_SEP.name, DataType.INTEGER_SEP.name):
            proc_column.data_type = DataType.INTEGER.name

        # transform english name
        if not proc_column.name_en:
            proc_column.name_en = to_romaji(proc_column.column_name)

        # get id with name before save db
        dict_id_column_name[proc_column.id] = proc_column.column_name
        if proc_column.id and proc_column.id < 0:  # set None for new column
            proc_column.id = None
        for function_col in proc_column.function_details:
            if function_col.id and function_col.id < 0:
                function_col.id = None

    if process.id:
        # update process
        process_exist: CfgProcess = meta_session.query(CfgProcess).get(process.id)
        process.data_source = process_exist.data_source
        process = meta_session.merge(process)

        # Update child processes with parent_id
        sys_name = proc_data.get('name')
        name_jp = proc_data.get('name_jp')
        name_en = proc_data.get('name_en')
        name_local = proc_data.get('name_local')
        child_processes = meta_session.query(CfgProcess).filter_by(parent_id=process.id).all()
        for child_process in child_processes:
            child_process.name = sys_name
            child_process.name_jp = name_jp
            child_process.name_en = name_en
            child_process.name_local = name_local

    else:
        # insert new process
        meta_session.add(process)
        is_create_new = True

    meta_session.flush()
    # Update process order
    if is_create_new and not process.order:
        process.update_order(meta_session, process.id, process.id - 1)
    dict_column_name_with_id = {col.column_name: col.id for col in process.columns}
    # assign process function after save process columns
    for column in process.columns:
        for func_col in column.function_details:
            func_col: CfgProcessFunctionColumn
            func_col.var_x = dict_column_name_with_id.get(dict_id_column_name.get(func_col.var_x))
            func_col.var_y = dict_column_name_with_id.get(dict_id_column_name.get(func_col.var_y))

    # update process function columns
    meta_session.merge(process)

    # save uncheck cols of v2 only
    save_unused_columns(process.id, unused_columns, meta_session=meta_session)

    # create table transaction_process
    with DbProxy(transaction_ds, True, immediate_isolation_level=True) as db_instance:
        trans_data = TransactionData(process.id, meta_session=meta_session)
        trans_data.create_table(db_instance)
        # delete unused columns
        if len(need_to_deleted_cols):
            trans_data.delete_columns(db_instance, need_to_deleted_cols)

    return process


def query_database_tables(db_id, process=None):
    with make_session() as mss:
        data_source = mss.query(CfgDataSource).get(db_id)

    if not data_source:
        return None

    output = {'ds_type': data_source.type, 'tables': [], 'process_factids': [], 'master_types': []}
    if process:
        # if process register tables = selected table
        output['tables'] = [process.get('table_name', '')]
        output['process_factids'] = [process.get('process_factid', '')]
        output['master_types'] = [process.get('master_type', '')]
        return output
    # return None if CSV
    if data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]:
        return output

    updated_at = data_source.db_detail.updated_at
    if data_source.type == DBType.SOFTWARE_WORKSHOP.name:
        tables, process_fact_ids, master_types = get_list_process_software_workshop(data_source.id)
        output['tables'] = tables
        output['process_factids'] = process_fact_ids
        output['master_types'] = master_types
    else:
        output['tables'] = get_list_tables_and_views(data_source.id, updated_at)

    return output


def query_database_tables_core(data_source: CfgDataSource, table_prefix):
    if not data_source:
        return None

    detail_master_types = []
    output = {'ds_type': data_source.type, 'master_type': data_source.master_type, 'tables': []}
    # return None if CSV
    if data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]:
        if data_source.csv_detail.directory:
            detail_master_types.append(MasterDBType.V2.name)
        if data_source.csv_detail.second_directory:
            detail_master_types.append(MasterDBType.V2_HISTORY.name)
        output['detail_master_types'] = detail_master_types
        return output

    updated_at = data_source.db_detail.updated_at
    tables = get_list_tables_and_views(data_source, updated_at)
    partitions = None
    # Edge server does not have logic of EFA
    # if data_source.master_type == MasterDBType.EFA.name:
    #     if table_prefix or data_source.is_direct_import:
    #         table_name, partitions, _ = get_efa_partitions(tables, table_prefix)
    #         tables = [table_name]
    #     else:
    #         partitions = []
    #         tables = EFA_TABLES

    output['tables'] = tables
    output['partitions'] = partitions

    return output


@CustomCache.memoize(duration=300)
def get_list_tables_and_views(data_source_id, updated_at=None):
    # updated_at only for cache
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with DbProxy(data_source_id) as db_instance:
        tables = db_instance.list_tables_and_views()

    tables = sorted(tables, key=lambda v: v.lower())
    return tables


@CustomCache.memoize(duration=300)
def get_list_process_software_workshop(data_source_id, updated_at=None):
    # updated_at only for cache
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with DbProxy(data_source_id) as db_instance:
        stmt = get_processes_stmt(limit=None)
        sql, params = db_instance.gen_sql_and_params(stmt)
        cols, rows = db_instance.run_sql(sql, params=params)

    df_measurement = pd.DataFrame(rows)
    df_measurement['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.get_data_type()
    df_measurement['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name
    df_history = pd.DataFrame(rows)
    df_history['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.get_data_type()
    df_history['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name
    df = pd.concat([df_measurement, df_history]).sort_values(
        by=[child_equips_table.c.child_equip_id.name, 'data_type'],
        ascending=[True, False],
    )

    process_fact_ids = df[child_equips_table.c.child_equip_id.name].to_list()
    master_types = df['master_type'].to_list()
    table_names = (df['data_type'] + UNDER_SCORE + df[TABLE_PROCESS_NAME]).to_list()
    table_names = normalize_list(table_names)

    return table_names, process_fact_ids, master_types


def convert2serialize(obj):
    if isinstance(obj, dict):
        return {k: convert2serialize(v) for k, v in obj.items()}
    elif hasattr(obj, '_ast'):
        return convert2serialize(obj._ast())
    elif not isinstance(obj, str) and hasattr(obj, '__iter__'):
        return [convert2serialize(v) for v in obj]
    elif hasattr(obj, '__dict__'):
        return {k: convert2serialize(v) for k, v in obj.__dict__.items() if not callable(v) and not k.startswith('_')}
    else:
        return obj


def get_ct_range(proc_id, columns):
    is_using_dummy_datetime = True in [col['is_get_date'] and col['is_dummy_datetime'] for col in columns]

    if not is_using_dummy_datetime:
        return []

    try:
        with DbProxy(gen_data_source_of_universal_db(proc_id), True) as db_instance:
            trans_data = TransactionData(proc_id)
            ct_range = trans_data.get_ct_range(db_instance)
        # cycle_cls = find_cycle_class(proc_id)
        # ct_range = (
        #     db.session.query(cycle_cls.id, cycle_cls.time)
        #     .filter(cycle_cls.process_id == proc_id)
        #     .with_entities(
        #         func.min(cycle_cls.time).label('min_time'),
        #         func.max(cycle_cls.time).label('max_time'),
        #     )
        #     .first()
        # )
        return ct_range
    except Exception:
        return []


def gen_function_column(process_columns, session: scoped_session | PostgreSQL):
    for process_column in process_columns:
        if process_column.function_config is None:
            continue

        dict_function_column = {
            'function_id': process_column.function_config.get('function_id'),
            'var_x': process_column.function_config.get('var_x'),
            'var_y': process_column.function_config.get('var_y'),
            'coe_a_n_s': process_column.function_config.get('coe_a_n_s'),
            'coe_b_k_t': process_column.function_config.get('coe_b_k_t'),
            'coe_c': process_column.function_config.get('coe_c'),
            'return_type': process_column.function_config.get('return_type'),
            'note': process_column.function_config.get('note'),
        }

        if process_column.function_config.get('function_column_id'):  # In case of exist record
            dict_function_column['id'] = process_column.function_config.get('function_column_id')

        select_cols = []
        rows = []
        for col, value in dict_function_column.items():
            select_cols.append(col)
            rows.append(value if value != '' else None)
        rows = [tuple(rows)]

        if isinstance(session, scoped_session):
            CfgProcessFunctionColumn.insert_records(select_cols, rows, session)
        else:
            session.bulk_insert(CfgProcessFunctionColumn.get_table_name(), select_cols, rows)
