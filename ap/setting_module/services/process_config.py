from __future__ import annotations

from typing import Any

import pandas as pd
from loguru import logger
from sqlalchemy.orm import scoped_session

from ap.api.setting_module.services.data_import import DbConnectionParam
from ap.api.setting_module.services.software_workshop_etl_services import (
    FACTORY_LINE_GROUP_LABEL,
)
from ap.api.setting_module.services.v2_etl_services import save_unused_columns
from ap.common.constants import (
    UNDER_SCORE,
    DBType,
    MasterDBType,
    ProcessStatus,
)
from ap.common.memoize import CustomCache
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import normalize_list
from ap.equations.utils import get_all_functions_info
from ap.setting_module.models import (
    CfgDataSource,
    CfgFilter,
    CfgLabel,
    CfgProcess,
    CfgProcessColumn,
    CfgVisualization,
    make_session,
    use_meta_session,
)
from ap.setting_module.schemas import (
    ContextSchemaDict,
    FilterSchema,
    ProcessColumnSchema,
    ProcessOnlySchema,
    ProcessPublicSchema,
    ProcessVisualizationSchema,
)
from ap.trace_data.transaction_model import TransactionData


def get_all_process(with_parent=True):
    process = CfgProcess.get_all(with_parent=with_parent) or []
    return process


def get_all_functions():
    all_functions_info = get_all_functions_info()
    all_functions_info = [function_info.model_dump() for function_info in all_functions_info]
    return all_functions_info


def get_all_process_no_nested(with_parent=True):
    process_only_schema = ProcessOnlySchema(many=True)
    processes = CfgProcess.get_all(with_parent=with_parent) or []
    return process_only_schema.dump(processes, many=True)


def get_process_cfg(proc_id):
    process_schema = ProcessPublicSchema()
    process = CfgProcess.query.get(proc_id) or {}
    if process and not process.name_en:
        process.name_en = to_romaji(process.name_jp)
    return process_schema.dump(process)


def get_process_columns(proc_id: int, *, show_graph: bool) -> list[dict[str, Any]]:
    proc_col_schema = ProcessColumnSchema(many=True, context=ContextSchemaDict(show_graph=show_graph))
    columns = CfgProcessColumn.query.filter(CfgProcessColumn.process_id == proc_id).all()
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
def create_or_update_process_cfg(
    process: CfgProcess,
    unused_columns: list[str],
    labels: list[str],
    meta_session: scoped_session = None,
) -> CfgProcess:
    dict_id_column_name = {}
    # We have a hack that is sending column with negative id to backend.
    # To keep function columns relationship.
    # Hence, we save a dictionary here, so that we can revert the ID later.
    for column in process.columns:
        # get id with name before save db
        dict_id_column_name[column.id] = column.column_name
        column.filter = column.filter if column.filter else None
        if column.id and column.id < 0:  # set None for new column
            column.id = None
        for function_col in column.function_details:
            if function_col.id and function_col.id < 0:
                function_col.id = None

    # merge to get `process.id`
    process = meta_session.merge(process)

    # need to flush if we create new process, to get `process.id`
    meta_session.flush()

    children_processes = CfgProcess.get_children(process.id, session=meta_session)
    for child_process in children_processes:
        child_process.name = process.name
        child_process.name_jp = process.name_jp
        child_process.name_en = process.name_en
        child_process.name_local = process.name_local
        child_process.status = process.status

    # update order if new
    if process.order is None:
        process.order = process.id - 1

    dict_column_name_with_id = {col.column_name: col.id for col in process.columns}
    # assign process function after save process columns
    for column in process.columns:
        for func_col in column.function_details:
            func_col.var_x = dict_column_name_with_id.get(dict_id_column_name.get(func_col.var_x))
            func_col.var_y = dict_column_name_with_id.get(dict_id_column_name.get(func_col.var_y))

    # use dict to avoid duplicated labels
    process_labels: dict[int, CfgLabel] = {}
    for label_name in labels:
        label = get_or_create_label(label_name, meta_session)
        process_labels[label.id] = label
    # sort label
    process.labels = sorted(process_labels.values(), key=lambda v: v.id)

    # update process function columns
    process = meta_session.merge(process)

    # save uncheck cols of v2 only
    process = save_unused_columns(process, unused_columns, meta_session=meta_session)

    return process


def get_or_create_label(label_name: str, meta_session) -> CfgLabel:
    label = CfgLabel.get_label_by_name(label_name, meta_session)

    if not label:
        label = CfgLabel(name=label_name)
        meta_session.add(label)
        # flush to get id
        meta_session.flush()
    return label


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
    if data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower(), DBType.WEB_API.name.lower()]:
        return output
    updated_at = data_source.db_detail.updated_at
    if data_source.type in [DBType.POSTGRES_SOFTWARE_WORKSHOP.name, DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name]:
        tables, process_fact_ids, master_types = get_list_process_software_workshop(data_source)
        output['tables'] = tables
        output['process_factids'] = process_fact_ids
        output['master_types'] = master_types
    else:
        output['tables'] = get_list_tables_and_views(data_source, updated_at)

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
    tables = get_list_tables_and_views(data_source.id, updated_at)
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
def get_list_tables_and_views(data_source, updated_at=None):
    # updated_at only for cache
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with ReadOnlyDbProxy(data_source) as db_instance:
        tables = db_instance.list_tables_and_views()

    tables = sorted(tables, key=lambda v: v.lower())
    return tables


@CustomCache.memoize(duration=300)
def get_list_process_software_workshop(data_source: CfgDataSource, updated_at=None):
    # updated_at only for cache
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with ReadOnlyDbProxy(data_source) as db_instance:
        software_workshop_def = data_source.software_workshop_def()
        sql = software_workshop_def.get_processes_query()
        cols, rows = db_instance.run_sql(sql)

    df_measurement = pd.DataFrame(rows, columns=cols)
    df_measurement['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.get_data_type()
    df_measurement['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name
    df_history = pd.DataFrame(rows, columns=cols)
    df_history['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.get_data_type()
    df_history['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name
    df = pd.concat([df_measurement, df_history]).sort_values(
        by=[software_workshop_def.child_equip_id, 'data_type'],
        ascending=[True, False],
    )

    process_fact_ids = df[software_workshop_def.child_equip_id].to_list()
    master_types = df['master_type'].to_list()
    table_names = (df[software_workshop_def.table_name] + UNDER_SCORE + df['data_type']).to_list()
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
        return {
            k: convert2serialize(v)
            for k, v in obj.__dict__.items()
            if not callable(v) and not k.startswith(UNDER_SCORE)
        }
    else:
        return obj


def get_ct_range(proc_id: int, columns: list[dict[str, Any]]):
    is_using_dummy_datetime = True in [col['is_get_date'] and col['is_dummy_datetime'] for col in columns]

    if not is_using_dummy_datetime:
        return []

    try:
        with TxnDataConnection(process_id=proc_id, readonly_transaction=True) as data_con:
            trans_data = TransactionData(proc_id)
            ct_range = trans_data.get_ct_range(data_con)
        return ct_range
    except Exception:
        return []


def update_process_status(process_id: int, status: ProcessStatus):
    with make_session() as meta_session:
        CfgProcess.update_status(meta_session, process_id, status)


@CustomCache.memoize(duration=300)
def get_processes_by_line_grp(data_source: CfgDataSource, updated_at=None):
    # updated_at only for cache
    software_workshop_def = data_source.software_workshop_def()
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with ReadOnlyDbProxy(data_source) as db_instance:
        sql = software_workshop_def.get_processes_by_line_groups_query()
        _, rows = db_instance.run_sql(sql)

    df_measurement = pd.DataFrame(rows)
    rename_cols = {col: col.lower() for col in df_measurement.columns}
    df_measurement['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.get_data_type()
    df_measurement['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name
    df_history = pd.DataFrame(rows)
    df_history['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.get_data_type()
    df_history['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name
    df = pd.concat([df_measurement, df_history])
    df = df.rename(columns=rename_cols)
    line_groups = []
    line_group_infos = []
    for line_group, group_df in df.groupby(FACTORY_LINE_GROUP_LABEL):
        line_groups.append(line_group)
        line_group_infos.append(group_df.to_dict(orient='records'))

    return line_groups, line_group_infos


def get_line_grp_info(db_connection_params: DbConnectionParam):
    output = {'line_groups': [], 'line_group_infos': []}
    data_source = db_connection_params.data_source_no_id()
    line_groups, line_group_infos = get_processes_by_line_grp(data_source, updated_at=None)
    output['line_groups'] = line_groups
    output['line_group_infos'] = line_group_infos

    return output
