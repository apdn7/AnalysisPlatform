from functools import lru_cache
from typing import Union

from sqlalchemy.orm import scoped_session

from ap.api.setting_module.services.v2_etl_services import is_v2_data_source, save_unused_columns
from ap.common.constants import (
    ID,
    DataColumnType,
    DataType,
    DBType,
    ProcessCfgConst,
)
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.equations.utils import get_all_functions_info
from ap.setting_module.models import (
    CfgDataSource,
    CfgFilter,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    CfgVisualization,
    crud_config,
    insert_or_update_config,
    make_session,
)
from ap.setting_module.schemas import (
    FilterSchema,
    ProcessColumnSchema,
    ProcessOnlySchema,
    ProcessSchema,
    ProcessVisualizationSchema,
)
from ap.trace_data.transaction_model import TransactionData


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
    for column in columns:
        # modify data type based on function column
        if column.function_details and column.function_details[-1].return_type:
            column.data_type = column.function_details[-1].return_type

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


def create_or_update_process_cfg(proc_data, unused_columns):
    need_to_deleted_cols = []
    transaction_ds = gen_data_source_of_universal_db(proc_data[ID])
    # get existing columns from transaction table
    if proc_data[ID] and len(unused_columns) and is_v2_data_source(process_id=proc_data[ID]):
        with DbProxy(transaction_ds, True, immediate_isolation_level=False):
            origin_proc_data = TransactionData(proc_data[ID])
            for col in unused_columns:
                col_dat = origin_proc_data.get_cfg_column_by_name(col, is_compare_bridge_column_name=False)
                if col_dat:
                    need_to_deleted_cols.append(col_dat.bridge_column_name)
    with make_session() as meta_session:
        # save process config
        process: CfgProcess = insert_or_update_config(
            meta_session=meta_session,
            data=proc_data,
            key_names=CfgProcess.id.key,
            model=CfgProcess,
        )
        meta_session.commit()

        # create column alchemy object + assign process id
        columns = proc_data[ProcessCfgConst.PROC_COLUMNS.value]
        for proc_column in columns:
            # transform data type
            proc_column.predict_type = proc_column.data_type
            if proc_column.data_type in (DataType.EU_REAL_SEP.name, DataType.REAL_SEP.name):
                proc_column.data_type = DataType.REAL.name
            if proc_column.data_type in (DataType.EU_INTEGER_SEP.name, DataType.INTEGER_SEP.name):
                proc_column.data_type = DataType.INTEGER.name

            proc_column.process_id = process.id
            # transform english name
            if not proc_column.name_en:
                proc_column.name_en = to_romaji(proc_column.column_name)

            # modify column_type (DataColumnType) for main::date and main::time
            # if proc_column.data_type in DataColumnType.get_keys():
            #     proc_column.column_type = DataColumnType[proc_column.data_type].value

        # re-fill function columns to avoid deleting it
        function_columns = CfgProcessColumn.get_by_column_types(
            [DataColumnType.GENERATED_EQUATION.value],
            proc_ids=[process.id],
            session=meta_session,
        )
        columns.extend(function_columns)

        # save columns
        crud_config(
            meta_session=meta_session,
            data=columns,
            parent_key_names=CfgProcessColumn.process_id.key,
            key_names=CfgProcessColumn.column_name.key,
            model=CfgProcessColumn,
        )

    # save uncheck cols of v2 only
    save_unused_columns(process.id, unused_columns)

    # create table transaction_process
    with DbProxy(transaction_ds, True, immediate_isolation_level=True) as db_instance:
        trans_data = TransactionData(process.id)
        trans_data.create_table(db_instance)
        # delete unused columns
        if len(need_to_deleted_cols):
            # todo: upgrade sqlite3 into 3.40 to delete column
            trans_data.delete_columns(db_instance, need_to_deleted_cols)
    # cols = [{'name': col.bridge_column_name, 'type': col.data_type} for col in columns]
    # with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
    #     # create table for transaction data
    #     db_instance.create_table(gen_transaction_table_name(process.id), cols)

    return process


def query_database_tables(db_id):
    with make_session() as mss:
        data_source = mss.query(CfgDataSource).get(db_id)
        if not data_source:
            return None

        output = {'ds_type': data_source.type, 'tables': []}
        # return None if CSV
        if data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]:
            return output

        updated_at = data_source.db_detail.updated_at
        output['tables'] = get_list_tables_and_views(data_source.id, updated_at)

    return output


@lru_cache(maxsize=20)
def get_list_tables_and_views(data_source_id, updated_at=None):
    # updated_at only for cache
    print('database config updated_at:', updated_at, ', so cache can not be used')
    with DbProxy(data_source_id) as db_instance:
        tables = db_instance.list_tables_and_views()

    tables = sorted(tables, key=lambda v: v.lower())
    return tables


# def get_ds_tables(ds_id):
#     try:
#         tables = query_database_tables(ds_id)
#         return tables['tables'] or []
#     except Exception:
#         return []


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


def gen_function_column(process_columns, session: Union[scoped_session, PostgreSQL]):
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
