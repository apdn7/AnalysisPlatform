# import tkinter as tk
# from tkinter import filedialog
# import datetime
import datetime

from sqlalchemy.orm import scoped_session

from ap.api.common.services.utils import get_specific_v2_type_based_on_column_names
from ap.api.setting_module.services.polling_frequency import add_import_job
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
    is_empty,
)
from ap.common.constants import (
    FILE_NAME,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    CacheType,
    DataColumnType,
    DBType,
    MasterDBType,
    PagePath,
    RelationShip,
)
from ap.common.memoize import set_all_cache_expired
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services.jp_to_romaji_utils import to_romaji

# from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.setting_module.models import (
    CfgCsvColumn,
    CfgDataSource,
    CfgDataSourceCSV,
    CfgProcess,
    crud_config,
    insert_or_update_config,
    make_session,
)
from ap.setting_module.schemas import DataSourceSchema, ProcessSchema
from ap.setting_module.services.process_config import create_or_update_process_cfg
from ap.trace_data.transaction_model import TransactionData

# def browse(resource_type):
#     window = tk.Tk()
#     window.wm_attributes('-topmost', 1)
#     window.withdraw()  # this supress the tk window
#
#     dialog = filedialog.askdirectory
#     if resource_type != RegisterDatasourceType.DIRECTORY.value:
#         dialog = filedialog.askopenfilename
#     f_path = dialog(parent=window)
#     return f_path, resource_type


def get_url_to_redirect(request, proc_ids, page):
    col_ids = []
    for proc_id in proc_ids:
        proc_cfg = CfgProcess.get_proc_by_id(proc_id)
        col_ids.extend([str(col.id) for col in proc_cfg.columns if col.is_serial_no or col.is_get_date])
    target_col_ids = ','.join(col_ids)

    # get start_datetime and end_datetime
    trans_data = TransactionData(proc_ids[0])
    with DbProxy(gen_data_source_of_universal_db(proc_ids[0]), True, immediate_isolation_level=True) as db_instance:
        max_datetime = trans_data.get_max_date_time_by_process_id(db_instance)
        min_datetime = trans_data.get_min_date_time_by_process_id(db_instance)

    host_url = request.host_url
    month_diff = get_month_diff(min_datetime, max_datetime)
    if page in PagePath.FPP.value and month_diff > 1:
        min_datetime = add_months(max_datetime, -1)
    min_datetime = convert_time(min_datetime, format_str=API_DATETIME_FORMAT)
    max_datetime = convert_time(max_datetime, format_str=API_DATETIME_FORMAT)

    end_procs = ','.join([str(_id) for _id in proc_ids])

    # get target page from bookmark
    target_url = f'{host_url}{page}?columns={target_col_ids}&start_datetime={min_datetime}&end_datetime={max_datetime}&end_procs=[{end_procs}]&load_gui_from_url=1&page={page.split("/")[1]}'  # noqa
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
#         if col_data['data_type'] == DataType.BIG_INT.name:
#             col_data['raw_data_type'] = RawDataTypeDB.BIG_INT.value
#         elif col_data['data_type'] == DataType.INTEGER.name:
#             if col_data['is_big_int']:
#                 col_data['raw_data_type'] = RawDataTypeDB.BIG_INT.value
#             else:
#                 col_data['raw_data_type'] = RawDataTypeDB.INTEGER.value
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

    # with BridgeStationModel.get_db_proxy() as db_instance:  # type: PostgreSQL
    #     # Generate data source
    #     data_src: CfgDataSource = DataSourceSchema().load(data_src_dict)
    #     data_source_id = generate_data_source(db_instance, data_src)
    #     generate_data_source_csv(db_instance, data_source_id, data_src)
    #     generate_csv_columns(db_instance, data_source_id, data_src)
    #
    #     # Generate data table
    #     dict_tables = query_database_tables_db_instance(data_source_id, db_instance=db_instance)
    #     detail_master_types = dict_tables.get('detail_master_types')
    #     cfg_data_source, cfg_data_tables = generate_data_table(
    #         db_instance,
    #         data_source_id,
    #         detail_master_types=detail_master_types,
    #     )
    #
    #     temp_process_ids = []
    #     for cfg_data_table in cfg_data_tables:
    #         # Do scan file
    #         generate_csv_management(db_instance, cfg_data_table.id)
    #
    #         # Do scan master
    #         generate_master_data(db_instance, cfg_data_table.id)
    #
    #         # Do scan data type and gen process config
    #         generate_data_type(db_instance, cfg_data_table.id)
    #
    #         # Do get process config info and data sample
    #         process_id_with_data_table_ids = MappingFactoryMachine.get_process_id_with_data_table_id(
    #             db_instance,
    #             [cfg_data_table.id],
    #         )
    #         process_ids = {x.get('process_id') for x in process_id_with_data_table_ids}
    #         temp_process_ids.extend(process_ids)
    #         for process_id in process_ids:
    #             proc_info_dict = get_process_config_info(process_id, db_instance=db_instance)
    #             proc_config_infos.append(proc_info_dict)
    #
    #     # Do remove pickle sample file
    #     for process_id in temp_process_ids:
    #         delete_preview_data_file_folder(process_id)
    #
    #     db_instance.connection.rollback()

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


def generate_data_source(
    meta_session: scoped_session,
    request_data_source: CfgDataSource,
) -> CfgDataSource:
    return insert_or_update_config(
        meta_session,
        request_data_source,
        exclude_columns=[CfgDataSource.order.key],
        autocommit=False,
    )


def generate_data_source_csv(
    meta_session: scoped_session,
    request_data_source: CfgDataSource,
    cfg_data_source: CfgDataSource,
) -> CfgDataSourceCSV:
    csv_columns = request_data_source.csv_detail.csv_columns
    csv_columns = [col for col in csv_columns if not is_empty(col.column_name)]
    request_data_source.csv_detail.csv_columns = csv_columns
    return insert_or_update_config(
        meta_session,
        request_data_source.csv_detail,
        parent_obj=cfg_data_source,
        parent_relation_key=CfgDataSource.csv_detail.key,
        parent_relation_type=RelationShip.ONE,
        autocommit=False,
    )


def generate_csv_columns(
    meta_session: scoped_session,
    request_data_source: CfgDataSource,
    cfg_data_source_csv: CfgDataSourceCSV,
):
    crud_config(
        meta_session,
        request_data_source.csv_detail.csv_columns,
        CfgCsvColumn.data_source_id.key,
        CfgCsvColumn.column_name.key,
        parent_obj=cfg_data_source_csv,
        parent_relation_key=CfgDataSourceCSV.csv_columns.key,
        parent_relation_type=RelationShip.MANY,
        autocommit=False,
    )


# def generate_data_table(
#     db_instance: PostgreSQL,
#     data_source_id: int,
#     proc_data: ProcessSchema = None,
#     detail_master_types=None,
# ) -> tuple[BSCfgDataSource, list[BSCfgDataTable]]:
#     # insert cfg process & cfg process column
#     serial_col = None
#     datetime_col = None
#     for col in (proc_data or {'columns': []}).get('columns'):
#         if col.is_get_date:
#             datetime_col = col.column_raw_name
#         elif col.is_serial_no:
#             serial_col = col.column_raw_name
#
#     # Gen data table
#     cfg_data_source = BSCfgDataSource(
#         BSCfgDataSource.get_by_id(db_instance, data_source_id),
#         db_instance=db_instance,
#         is_cascade=True,
#     )
#     cfg_data_source, cfg_data_tables = gen_config_data_db_instance(
#         cfg_data_source,
#         serial_col,
#         datetime_col,
#         None,
#         None,
#         None,
#         detail_master_types,
#         db_instance=db_instance,
#     )  # type: BSCfgDataSource, list[BSCfgDataTable]
#
#     for cfg_data_table in cfg_data_tables:
#         get_n_save_partition_range_time_from_factory_db_db_instance(
#             cfg_data_table,
#             is_scan=True,
#             db_instance=db_instance,
#         )
#
#     return cfg_data_source, cfg_data_tables
#
#
# def generate_csv_management(db_instance: PostgreSQL, data_table_id: int):
#     split_cols = BSCfgDataTableColumn.get_split_columns(db_instance, data_table_id)
#     columns = BSCfgDataTableColumn.get_column_names_by_data_group_types(db_instance, data_table_id, split_cols)
#
#     # Do scan file
#     scan_files_generator = scan_files(data_table_id, columns, db_instance=db_instance)
#     list(scan_files_generator)
#
#
# def generate_master_data(db_instance: PostgreSQL, data_table_id: int):
#     save_scan_master_target_files(db_instance, data_table_id)
#     scan_master_generator = scan_master(data_table_id, db_instance=db_instance)
#     list(scan_master_generator)
#
#
# def generate_data_type(db_instance: PostgreSQL, data_table_id: int):
#     scan_data_type_generator = scan_data_type(data_table_id, db_instance=db_instance)
#     list(scan_data_type_generator)
#
#
# def get_all_process_ids(db_instance: PostgreSQL, data_table_id: int) -> set[int]:
#     process_id_rows = MappingFactoryMachine.get_process_id_with_data_table_id(db_instance, [data_table_id])
#     return {row.get(MData.Columns.process_id.name) for row in process_id_rows}
#
#
# def update_process_infos(db_instance: PostgreSQL, process_ids: set[int], proc_configs: list[dict]):
#     for process_id in process_ids:
#         proc = BSCfgProcess.get_by_process_id(db_instance, process_id, is_cascade_column=True)
#         for request_proc_config in proc_configs:
#             proc_config = request_proc_config['proc_config']
#             if proc_config.get('origin_name_en', '') == proc.name_en or proc_config.get('name', '') == proc.name:
#                 del proc_config['origin_name_en']
#                 proc_config = ProcessSchema().load(proc_config)
#                 unused_columns = (request_proc_config.get('unused_columns') or {}).get('columns', [])
#                 unused_column_raw_names = [unused_column.get('column_raw_name') for unused_column in unused_columns]
#                 update_process_info(
#                     db_instance,
#                     process_id,
#                     proc,
#                     proc_config,
#                     unused_columns=unused_column_raw_names,
#                 )
#                 break
#
#
# def update_process_info(
#     db_instance: PostgreSQL,
#     process_id: int,
#     existing_process,
#     request_process,
#     unused_columns: list[str] = None,
# ):
#     transaction_data_obj = TransactionData(process_id, db_instance=db_instance)
#     transaction_data_obj.cast_data_type_for_columns(db_instance, existing_process, request_process)
#     existing_process_columns = existing_process.columns
#
#     # Update process names & flag is_show_file_name
#     BSCfgProcess.update_by_conditions(
#         db_instance,
#         {
#             BSCfgProcess.Columns.name.name: request_process.get('name'),
#             BSCfgProcess.Columns.name_jp.name: request_process.get('name_jp'),
#             BSCfgProcess.Columns.name_local.name: request_process.get('name_local'),
#             BSCfgProcess.Columns.name_en.name: request_process.get('name_en'),
#             BSCfgProcess.Columns.is_show_file_name.name: False,
#         },
#         dic_conditions={BSCfgProcess.Columns.id.name: process_id},
#     )
#
#     # Delete column if it was uncheck
#     for delete_column_name in {DataGroupType.FileName.name, *unused_columns}:
#         target_column = next(
#             filter(
#                 lambda column: column.column_raw_name == delete_column_name,
#                 existing_process_columns,
#             ),
#             None,
#         )
#
#         dic_conditions = {BSCfgProcessColumn.Columns.id.name: target_column.id}
#         BSCfgProcessColumn.delete_by_condition(db_instance, dic_conditions, mode=0)
#         MData.update_by_conditions(db_instance, {MData.Columns.is_hide.name: True}, dic_conditions=dic_conditions)
#
#     # Update process columns
#     for request_process_column in request_process['columns']:
#         existing_process_column = next(
#             filter(
#                 lambda column: column.column_raw_name == request_process_column.column_raw_name,
#                 existing_process_columns,
#             ),
#             None,
#         )
#
#         if existing_process_column is None:
#             raise Exception('Missing column -> It maybe be bug relate to database session!')
#
#         dic_update_values = {}
#         # Update name english
#         if existing_process_column.name_en != request_process_column.name_en:
#             dic_update_values[BSCfgProcessColumn.Columns.name_en.name] = (
#                 request_process_column.name_en if not is_empty(request_process_column.name_en) else EMPTY_STRING
#             )
#
#         # Update name japanese
#         if existing_process_column.name_jp != request_process_column.name_jp:
#             dic_update_values[BSCfgProcessColumn.Columns.name_jp.name] = (
#                 request_process_column.name_jp if not is_empty(request_process_column.name_jp) else EMPTY_STRING
#             )
#
#         # Update name local
#         if existing_process_column.name_local != request_process_column.name_local:
#             dic_update_values[BSCfgProcessColumn.Columns.name_local.name] = (
#                 request_process_column.name_local if not is_empty(request_process_column.name_local) else EMPTY_STRING
#             )
#
#         # Update format
#         if existing_process_column.format != request_process_column.format:
#             dic_update_values[BSCfgProcessColumn.Columns.format.name] = (
#                 request_process_column.format if not is_empty(request_process_column.format) else None
#             )
#
#         # Update raw data type and data type
#         if existing_process_column.raw_data_type != request_process_column.raw_data_type:
#             dic_update_values[BSCfgProcessColumn.Columns.raw_data_type.name] = request_process_column.raw_data_type
#             dic_update_values[
#                 BSCfgProcessColumn.Columns.data_type.name
#             ] = RawDataTypeDB.convert_raw_data_type_to_data_type(request_process_column.raw_data_type)
#
#         if dic_update_values:
#             BSCfgProcessColumn.update_by_conditions(
#                 db_instance,
#                 dic_update_values,
#                 dic_conditions={BSCfgProcessColumn.Columns.id.name: existing_process_column.id},
#             )
#
#
# def pull_csv_data(db_instance, cfg_data_table):
#     job_info = JobInfo()
#     job_type = JobType.PULL_CSV_DATA
#     job_info.job_type = job_type
#     etl_service = ETLController.get_etl_service(cfg_data_table, db_instance=db_instance)
#     pull_csv_generator = pull_csv(
#         JobType.PULL_CSV_DATA,
#         etl_service,
#         job_info,
#         ignore_add_job=True,
#         db_instance=db_instance,
#     )
#     list(pull_csv_generator)


def generate_process_config(meta_session: scoped_session, proc_config, data_source_id: int) -> CfgProcess:
    process_schema = ProcessSchema()
    request_process_config = proc_config.get('proc_config')
    request_unused_columns = []  # process not register, do need remove unused column
    request_process_config['data_source_id'] = data_source_id
    del request_process_config['origin_name']
    # New process, set id = None
    request_process_config['id'] = None
    proc_data = process_schema.load(request_process_config)
    for column in proc_data['columns']:
        # check is show file name
        if column.column_raw_name == FILE_NAME:
            proc_data[CfgProcess.is_show_file_name.name] = True
            break

    cfg_process = create_or_update_process_cfg(proc_data, request_unused_columns, meta_session=meta_session)

    return cfg_process


def handle_importing_by_one_click(request):
    register_by_file_request_id = request.get('request_id')
    csv_info = request.get('csv_info')
    request_proc_configs = request.get('proc_configs')

    # Detect truly detail master type (There are only 2 types: V2 or V2_HISTORY)
    detail_master_type = csv_info.get('detail_master_type', MasterDBType.OTHERS.name)
    if 'detail_master_type' in csv_info:
        if detail_master_type in [MasterDBType.V2_HISTORY.name, MasterDBType.V2_MULTI_HISTORY.name]:
            csv_info['csv_detail']['second_directory'] = csv_info['csv_detail']['directory']
            csv_info['csv_detail']['directory'] = None
            detail_master_type = MasterDBType.V2_HISTORY.name
        elif detail_master_type in [MasterDBType.V2.name, MasterDBType.V2_MULTI.name]:
            detail_master_type = MasterDBType.V2.name
        del csv_info['detail_master_type']

    processes = []
    with make_session() as meta_session:
        for request_proc_config in request_proc_configs:
            # Do generate data source
            request_data_source: CfgDataSource = DataSourceSchema().load(csv_info)
            if request_data_source.type == MasterDBType.V2.name:
                process_name = request_proc_config.get('proc_config').get('origin_name')
                request_data_source.name = f'{request_data_source.name}_{process_name}'
                request_data_source.csv_detail.process_name = process_name

            cfg_data_source = generate_data_source(meta_session, request_data_source)
            cfg_data_source_csv = generate_data_source_csv(meta_session, request_data_source, cfg_data_source)
            generate_csv_columns(meta_session, request_data_source, cfg_data_source_csv)

            # Do gen process config
            process = generate_process_config(meta_session, request_proc_config, cfg_data_source.id)
            processes.append(process)

    set_all_cache_expired(CacheType.CONFIG_DATA)

    # Add import data job
    for process in processes:  # type: CfgProcess
        add_import_job(
            process,
            run_now=True,
            is_user_request=True,
            register_by_file_request_id=register_by_file_request_id,
        )

    return [proc.id for proc in processes]
