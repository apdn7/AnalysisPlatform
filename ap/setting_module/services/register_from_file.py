# import tkinter as tk
# from tkinter import filedialog
# import datetime
import datetime

from sqlalchemy.orm import scoped_session

from ap.api.common.services.utils import get_specific_v2_type_based_on_column_names
from ap.api.setting_module.services.polling_frequency import add_import_job, add_import_job_params
from ap.api.setting_module.services.show_latest_record import (
    gen_preview_data_check_dict,
    get_latest_records,
    preview_csv_data,
)
from ap.api.setting_module.services.v2_etl_services import get_preview_processes_v2
from ap.common.common_utils import (
    API_DATETIME_FORMAT,
    add_months,
    convert_time,
    get_month_diff,
    get_sorted_files,
)
from ap.common.constants import (
    FILE_NAME,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    CacheType,
    DataColumnType,
    DataType,
    DBType,
    MasterDBType,
    MaxGraphNumber,
    PagePath,
    max_graph_number,
)
from ap.common.multiprocess_sharing import EventExpireCache, EventQueue
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services.jp_to_romaji_utils import to_romaji

# from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    make_session,
)
from ap.setting_module.schemas import DataSourceSchema, ProcessSchema
from ap.setting_module.services.process_config import create_or_update_process_cfg
from ap.trace_data.transaction_model import TransactionData


def get_url_to_redirect(request, proc_ids, page):
    col_ids = []
    for proc_id in proc_ids:
        proc_cfg = CfgProcess.get_proc_by_id(proc_id)
        # Case redirect to FPP page (filter 20 data type Real or Integer)
        if page in PagePath.FPP.value:
            max_graph = max_graph_number[MaxGraphNumber.FPP_MAX_GRAPH.name]
            data_types_allow = [DataType.INTEGER.name, DataType.REAL.name]
            col_ids.extend(
                [str(col.id) for col in proc_cfg.columns if col.data_type in data_types_allow][:max_graph],
            )
        else:
            col_ids.extend([str(col.id) for col in proc_cfg.columns if col.is_serial_no or col.is_get_date])
    target_col_ids = ','.join(col_ids)

    # get start_datetime and end_datetime
    trans_data = TransactionData(proc_ids[0])
    with DbProxy(gen_data_source_of_universal_db(proc_ids[0]), True, immediate_isolation_level=True) as db_instance:
        max_datetime = trans_data.get_max_date_time_by_process_id(db_instance)
        min_datetime = trans_data.get_min_date_time_by_process_id(db_instance)

    host_url = request.host_url
    param_is_dummy_datetime = '&is_dummy_datetime=1' if page in PagePath.FPP.value else ''
    month_diff = get_month_diff(min_datetime, max_datetime)
    if page in PagePath.FPP.value and month_diff > 1:
        min_datetime = add_months(max_datetime, -1)
    min_datetime = convert_time(min_datetime, format_str=API_DATETIME_FORMAT)
    max_datetime = convert_time(max_datetime, format_str=API_DATETIME_FORMAT)

    end_procs = ','.join([str(_id) for _id in proc_ids])

    # get target page from bookmark
    target_url = f'{host_url}{page}?columns={target_col_ids}&start_datetime={min_datetime}&end_datetime={max_datetime}&end_procs=[{end_procs}]&load_gui_from_url=1{param_is_dummy_datetime}&page={page.split("/")[1]}'  # noqa
    return target_url


# def get_latest_records_core(dic_preview: dict, limit: int = 5):
#     cols_with_types = []
#     headers = normalize_list(dic_preview.get('header'))
#     headers = [normalize_str(col) for col in headers]
#     data_types = dic_preview.get('dataType')
#     same_values = dic_preview.get('same_values')
#     is_v2_history = dic_preview.get('v2_type') == DBType.V2_HISTORY
#     if headers and data_types:
#         column_raw_name = dic_preview.get('org_headers')
#         cols_with_types = gen_cols_with_types(headers, data_types, same_values, is_v2_history, column_raw_name)
#     cols = headers
#
#     # get rows
#     df_rows = dic_preview.get('content', None)
#     previewed_files = dic_preview.get('previewed_files')
#
#     # change name if romaji cols is duplicated
#     cols_with_types, cols_duplicated = change_duplicated_columns(cols_with_types)
#     has_ct_col = True
#     dummy_datetime_idx = None
#     if DataType.DATETIME.value not in data_types:
#         dummy_datetime_idx = 0
#         cols_with_types.insert(
#             dummy_datetime_idx,
#             {
#                 'column_name': DATETIME_DUMMY,
#                 'data_type': DataType.DATETIME.name,
#                 'romaji': DATETIME_DUMMY,
#                 'is_date': True,
#                 'check_same_value': {'is_null': False, 'is_same': False},
#             },
#         )
#         cols.insert(dummy_datetime_idx, DATETIME_DUMMY)
#         if is_valid_list(df_rows):
#             df_rows = gen_dummy_datetime(df_rows)
#
#     if DATETIME_DUMMY in cols or DataType.DATETIME.value not in data_types:
#         dummy_datetime_idx = 0
#         has_ct_col = False
#
#     rows = []
#     if is_valid_list(df_rows):
#         data_type_by_cols = {}
#         for col_data in cols_with_types:
#             data_type_by_cols[col_data['column_name']] = col_data['data_type']
#         # convert to correct dtypes
#         for col in df_rows.columns:
#             try:
#                 if data_type_by_cols[col] == DataType.INTEGER.name:
#                     df_rows[col] = df_rows[col].astype('float64').astype('Int64')
#
#                 if data_type_by_cols[col] == DataType.TEXT.name:
#                     # fill na to '' for string column
#                     df_rows[col] = df_rows[col].astype('string').fillna('')
#             except Exception:
#                 continue
#         rows = transform_df_to_rows(cols, df_rows, limit)
#
#     # Set raw data type base on data_type
#     for col_data in cols_with_types:
#         if col_data['data_type'] == DataType.DATETIME.name:
#             col_data['raw_data_type'] = RawDataTypeDB.DATETIME.value
#         if col_data['data_type'] == DataType.DATE.name:
#             col_data['raw_data_type'] = RawDataTypeDB.DATE.value
#         if col_data['data_type'] == DataType.TIME.name:
#             col_data['raw_data_type'] = RawDataTypeDB.TIME.value
#         elif col_data['data_type'] == DataType.INTEGER.name:
#             col_data['raw_data_type'] = RawDataTypeDB.INTEGER.value
#         elif col_data['data_type'] == DataType.REAL.name:
#             col_data['raw_data_type'] = RawDataTypeDB.REAL.value
#         elif col_data['data_type'] == DataType.BOOLEAN.name:
#             col_data['raw_data_type'] = RawDataTypeDB.BOOLEAN.value
#         elif col_data['data_type'] == DataType.TEXT.name:
#             col_data['raw_data_type'] = RawDataTypeDB.TEXT.value
#
#     is_rdb = False
#     return cols_with_types, rows, cols_duplicated, previewed_files, has_ct_col, dummy_datetime_idx, is_rdb


def get_proc_config_infos(dic_preview: dict, limit: int = 5, is_v2=False, process_names=[]) -> dict:
    process_configs = []
    if not is_v2:
        process_names = [None]

    is_file_path = dic_preview['is_file_path']
    datasource_config = {
        'name': datetime.datetime.utcnow().timestamp().__str__(),
        'type': DBType.V2.name if is_v2 else DBType.CSV.name,
        'master_type': DBType.V2.name if is_v2 else DBType.CSV.name,
        'csv_detail': {
            'directory': dic_preview.get('file_name') if is_file_path else dic_preview.get('directory'),
            'delimiter': 'Auto',
            'csv_columns': None,
            'is_file_path': is_file_path,
        },
    }

    for process_name in process_names:
        latest_rec = get_latest_records(
            None,
            None,
            file_name=dic_preview.get('file_name'),
            directory=dic_preview.get('directory'),
            limit=limit,
            is_v2_datasource=is_v2,
            filtered_process_name=process_name,
        )
        if not latest_rec:
            return {
                'cols': [],
                'rows': [],
                'cols_duplicated': [],
                'fail_limit': None,
                'has_ct_col': None,
                'dummy_datetime_idx': None,
                'is_rdb': False,
            }

        (
            cols_with_types,
            rows,
            cols_duplicated,
            previewed_files,
            has_ct_col,
            dummy_datetime_idx,
            is_rdb,
            file_name_col_idx,
        ) = latest_rec
        dic_preview_limit = gen_preview_data_check_dict(rows, previewed_files)
        data_group_type = {key: DataColumnType[key].value for key in DataColumnType.get_keys()}
        process_config = {
            'origin_name': process_name,
            'name_jp': process_name,
            'name_en': to_romaji(process_name) if process_name else process_name,
            'name_local': '',
            'cols': cols_with_types,
            'rows': rows,
            'cols_duplicated': cols_duplicated,
            'fail_limit': dic_preview_limit,
            'has_ct_col': has_ct_col,
            'dummy_datetime_idx': None if is_rdb else dummy_datetime_idx,
            'data_group_type': data_group_type,
            'is_rdb': is_rdb,
            'file_name_col_idx': file_name_col_idx,
        }
        process_configs.append(process_config)

        datasource_config['csv_detail']['csv_columns'] = cols_with_types
    process_configs = sorted(process_configs, key=lambda process_config: process_config['name_en'], reverse=True)
    return {
        'processConfigs': process_configs,
        'datasourceConfig': datasource_config,
    }


def proc_config_infos_for_v2(dic_preview: dict) -> dict:
    [cols_with_types, _, _, _, _, _, _] = get_latest_records(None, 0)
    is_file_path = dic_preview['is_file_path']
    data_src_dict = {
        'name': datetime.datetime.utcnow().timestamp().__str__(),
        'type': DBType.CSV.name,
        'master_type': MasterDBType.V2.name,
        'csv_detail': {
            'directory': dic_preview['file_name'] if is_file_path else dic_preview.get('directory'),
            'delimiter': 'Auto',
            'csv_columns': cols_with_types,
            'is_file_path': is_file_path,
        },
    }
    proc_config_infos = []

    return {
        'processConfigs': proc_config_infos,
        'datasourceConfig': data_src_dict,
    }


def get_latest_records_for_register_by_file(file_name: str = None, directory: str = None, limit: int = 5):
    delimiter = 'Auto'
    skip_head = None
    etl_func = ''

    dic_preview = preview_csv_data(
        directory,
        etl_func,
        delimiter,
        limit,
        return_df=True,
        max_records=1000,
        file_name=file_name,
        skip_head=skip_head,
        show_file_name_column=True,
    )

    dic_preview['is_file_path'] = file_name is not None
    column_raw_name = dic_preview.get('org_headers')
    master_type = get_specific_v2_type_based_on_column_names(column_raw_name)
    if master_type is not None:
        # In case of V2
        sorted_files = [file_name] if file_name else get_sorted_files(directory)
        v2_process_names = get_preview_processes_v2(
            sorted_files,
            maximum_files=MAXIMUM_V2_PREVIEW_ZIP_FILES,
        )
        data_src_dict = get_proc_config_infos(dic_preview, limit=limit, is_v2=True, process_names=v2_process_names)
        data_src_dict['datasourceConfig']['detail_master_type'] = master_type
        return data_src_dict

    # In case of OTHER
    return get_proc_config_infos(dic_preview, limit=limit)


def generate_process_config(meta_session: scoped_session, proc_config, data_source_id: int) -> CfgProcess:
    process_schema = ProcessSchema()
    request_process_config = proc_config.get('proc_config')
    request_unused_columns = []  # process not register, do need remove unused column
    request_process_config['data_source_id'] = data_source_id
    process: CfgProcess = process_schema.load(request_process_config)
    # New process, set id = None
    process.id = None
    # check is show file name
    process.is_show_file_name = any(col.column_raw_name == FILE_NAME for col in process.columns)

    return create_or_update_process_cfg(process, request_unused_columns, meta_session=meta_session)


def handle_importing_by_one_click(request):
    register_by_file_request_id = request.get('request_id')
    csv_info = request.get('csv_info')
    request_proc_configs = request.get('proc_configs')

    processes = []
    with make_session() as meta_session:
        for request_proc_config in request_proc_configs:
            # Do generate data source
            # need to create data source in the loop so that we can handle v2 case correctly
            cfg_data_source: CfgDataSource = DataSourceSchema().load(csv_info)
            if cfg_data_source.type == MasterDBType.V2.name:
                process_name = request_proc_config.get('proc_config').get('origin_name')
                cfg_data_source.name = f'{cfg_data_source.name}_{process_name}'
                cfg_data_source.csv_detail.process_name = process_name

            # register data source
            cfg_data_source = meta_session.merge(cfg_data_source)
            # add data source to db before creating process, so that we can get data source id
            meta_session.flush()

            # Do gen process config
            process = generate_process_config(meta_session, request_proc_config, cfg_data_source.id)
            processes.append(process)

    EventQueue.put(EventExpireCache(cache_type=CacheType.CONFIG_DATA))

    # get process ids before importing, this can make data stale
    # need to call list map, so that we can load all params data, otherwise the data will be staled
    params = list(map(add_import_job_params, processes))

    # Add import data job
    for param in params:
        add_import_job(
            process_id=param.process_id,
            process_name=param.process_name,
            data_source_id=param.data_source_id,
            data_source_type=param.data_source_type,
            run_now=True,
            is_user_request=True,
            register_by_file_request_id=register_by_file_request_id,
        )

    return [param.process_id for param in params]
