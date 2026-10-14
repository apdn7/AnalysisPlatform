# import tkinter as tk
# from tkinter import filedialog
# import datetime
import datetime
from dataclasses import replace
from uuid import uuid4

from loguru import logger
from sqlalchemy.orm import scoped_session

from ap.api.common.services.utils import get_specific_v2_type_based_on_column_names
from ap.api.setting_module.services.polling_frequency import add_import_job, add_import_job_params
from ap.api.setting_module.services.preview_data import (
    PreviewDataset,
    PreviewRequestContext,
    PreviewSourceKind,
    PreviewStorageError,
    build_datasource_location_fingerprint,
    build_preview_fingerprint,
)
from ap.api.setting_module.services.preview_parquet import (
    get_datasource_preview_path,
    get_pending_preview_path,
    get_process_preview_path,
    read_pending_preview,
    read_preview,
    read_stored_preview,
    rewrite_process_preview,
    write_preview_atomic,
)
from ap.api.setting_module.services.show_latest_record import (
    build_preview_response,
    gen_preview_data_check_dict,
    load_external_preview_dataset,
    preview_csv_data,
)
from ap.api.setting_module.services.v2_etl_services import get_preview_processes_v2
from ap.common.common_utils import (
    add_months,
    convert_time,
    get_month_diff,
)
from ap.common.constants import (
    API_DATETIME_FORMAT,
    FILE_NAME,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    CsvDelimiter,
    DataColumnType,
    DataType,
    DBType,
    DefinedLabel,
    Encoding,
    MasterDBType,
    MaxGraphNumber,
    PagePath,
    max_graph_number,
)
from ap.common.path_utils import get_sorted_files
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.common.services.jp_to_romaji_utils import to_romaji

# from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    make_session,
)
from ap.setting_module.schemas import DataSourceSchema, ProcessSchema
from ap.setting_module.services.process_config import create_or_update_process_cfg
from ap.setting_module.services.quick_plot import (
    QuickPlotUploadError,
    associate_quick_plot_data_source,
    validate_quick_plot_registration,
)
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
    [first_proc_id, *_] = proc_ids
    trans_data = TransactionData(first_proc_id)
    with TxnDataConnection(process_id=first_proc_id, readonly_transaction=True) as data_con:
        max_datetime = trans_data.get_max_date_time_by_process_id(data_con)
        min_datetime = trans_data.get_min_date_time_by_process_id(data_con)

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


def get_proc_config_infos(
    dic_preview: dict,
    limit: int = 5,
    is_v2=False,
    process_names=None,
    auto_encoding: bool | None = None,
) -> dict:
    process_configs = []
    process_names = [None] if not is_v2 else process_names or []

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
            'encoding': dic_preview.get('encoding'),
        },
    }

    for process_name in process_names:
        context = PreviewRequestContext(
            data_source_id=None,
            process_id=None,
            table_name=None,
            file_name=dic_preview.get('file_name') if is_file_path else None,
            directory=dic_preview.get('directory'),
            process_factid=None,
            master_type=None,
            etl_func='',
            import_filter={},
            api_url=None,
            encoding=dic_preview.get('encoding'),
            auto_encoding=auto_encoding,
            delimiter=CsvDelimiter.Auto,
            is_v2_datasource=is_v2,
            filtered_process_name=process_name,
            requested_column_names=(),
            requested_raw_column_names=(),
            refresh_preview=False,
        )
        dataset = load_external_preview_dataset(context)
        preview_response = build_preview_response(dataset, limit=limit)
        preview_token = uuid4().hex
        write_preview_atomic(get_pending_preview_path(preview_token), dataset)
        cols_with_types = preview_response['cols']
        rows = preview_response['rows']
        is_rdb = preview_response['is_rdb']
        dic_preview_limit = gen_preview_data_check_dict(rows, preview_response['previewed_files'])
        data_group_type = {key: DataColumnType[key].value for key in DataColumnType.get_keys()}
        process_config = {
            'preview_token': preview_token,
            'origin_name': process_name,
            'name_jp': process_name,
            'name_en': to_romaji(process_name) if process_name else process_name,
            'name_local': '',
            'cols': cols_with_types,
            'rows': rows,
            'cols_duplicated': preview_response['cols_duplicated'],
            'fail_limit': dic_preview_limit,
            'has_ct_col': preview_response['has_ct_col'],
            'dummy_datetime_idx': None if is_rdb else preview_response['dummy_datetime_idx'],
            'data_group_type': data_group_type,
            'is_rdb': is_rdb,
            'file_name_col_idx': preview_response['file_name_col_idx'],
            'unique_rows_as_category': [],
            'unique_rows_as_real': [],
            'unique_rows_as_int': [],
            'unique_rows_as_int_cat': [],
            'labels': [DefinedLabel.get_by_dbtype(DBType.V2 if is_v2 else DBType.CSV).name],
        }
        process_configs.append(process_config)

        datasource_config['csv_detail']['csv_columns'] = cols_with_types
    process_configs = sorted(process_configs, key=lambda process_config: process_config['name_en'], reverse=True)
    return {
        'processConfigs': process_configs,
        'datasourceConfig': datasource_config,
    }


def get_latest_records_for_register_by_file(
    file_name: str | None = None,
    directory: str | None = None,
    limit: int = 5,
    encoding=Encoding.AUTO_DETECT.code,
):
    """Run the explicit external initial-preview scan for Register by File."""
    delimiter = 'Auto'
    skip_head = None
    etl_func = ''
    # Keep the original selection separate from the first scan's detected encoding.
    auto_encoding = not encoding or encoding == Encoding.AUTO_DETECT.code

    dic_preview = preview_csv_data(
        directory,
        etl_func,
        delimiter,
        limit,
        return_df=True,
        max_records=limit,
        file_name=file_name,
        skip_head=skip_head,
        show_file_name_column=True,
        encoding=encoding,
        auto_encoding=auto_encoding,
        fast_preview=True,
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
        data_src_dict = get_proc_config_infos(
            dic_preview,
            limit=limit,
            is_v2=True,
            process_names=v2_process_names,
            auto_encoding=auto_encoding,
        )
        data_src_dict['datasourceConfig']['detail_master_type'] = master_type
        return data_src_dict

    # In case of OTHER
    return get_proc_config_infos(dic_preview, limit=limit, auto_encoding=auto_encoding)


def generate_process_config(meta_session: scoped_session, proc_config, data_source_id: int) -> CfgProcess:
    process_schema = ProcessSchema()
    request_process_config = proc_config.get('proc_config')
    labels = proc_config.get('labels', [])
    # process not register, do need remove unused column
    request_unused_columns = proc_config.get('unused_columns', {}).get('columns', [])
    request_unused_columns_raw = [item['column_raw_name'] for item in request_unused_columns]
    request_process_config['data_source_id'] = data_source_id
    process: CfgProcess = process_schema.load(request_process_config)
    # New process, set id = None
    process.id = None
    # check is show file name
    process.is_show_file_name = any(col.column_raw_name == FILE_NAME for col in process.columns)

    return create_or_update_process_cfg(process, request_unused_columns_raw, labels, meta_session=meta_session)


def _build_registered_preview_context(process: CfgProcess) -> PreviewRequestContext:
    data_source = process.data_source
    csv_detail = data_source.csv_detail
    master_type = MasterDBType.__members__.get(process.master_type)
    process_columns = process.get_transaction_process_columns()
    return PreviewRequestContext(
        data_source_id=process.data_source_id,
        process_id=process.id,
        table_name=process.table_name,
        file_name=process.file_name or (csv_detail.directory if csv_detail and csv_detail.is_file_path else None),
        directory=csv_detail.directory if csv_detail else None,
        process_factid=process.process_factid,
        master_type=master_type,
        etl_func=(csv_detail.etl_func if csv_detail else None) or process.get_etl_func() or '',
        import_filter={
            column.column_raw_name: column.filter
            for column in process_columns
            if column.column_raw_name and column.filter
        },
        api_url=data_source.web_detail.url if data_source.web_detail else None,
        encoding=csv_detail.encoding if csv_detail else None,
        auto_encoding=csv_detail.auto_encoding if csv_detail else None,
        delimiter=csv_detail.delimiter if csv_detail else None,
        is_v2_datasource=data_source.type == DBType.V2.name,
        filtered_process_name=csv_detail.process_name if csv_detail else None,
        requested_column_names=(),
        requested_raw_column_names=(),
        refresh_preview=False,
    )


def promote_pending_preview(preview_token: str, process: CfgProcess) -> None:
    """Publish a registered datasource and Process preview before import is queued."""
    pending_dataset = read_pending_preview(preview_token)
    if pending_dataset is None:
        raise ValueError('Pending preview is unavailable or invalid')

    context = _build_registered_preview_context(process)
    location_fingerprint = build_datasource_location_fingerprint(context)
    datasource_dataset = PreviewDataset(
        dataframe=pending_dataset.dataframe,
        metadata=replace(
            pending_dataset.metadata,
            source_kind=PreviewSourceKind.EXTERNAL,
            data_source_id=process.data_source_id,
            process_id=None,
            fingerprint=location_fingerprint,
        ),
    )
    saved_columns = TransactionData(process).get_preview_column_metadata()
    write_preview_atomic(
        get_datasource_preview_path(context, location_fingerprint),
        datasource_dataset,
    )
    rewrite_process_preview(
        pending_dataset,
        get_process_preview_path(process.data_source_id, process.id),
        data_source_id=process.data_source_id,
        process_id=process.id,
        fingerprint=build_preview_fingerprint(
            context,
            source_type='process',
            selected_columns=tuple(column['column_name'] for column in saved_columns),
            process_column_configurations=saved_columns,
        ),
        columns=saved_columns,
    )
    get_pending_preview_path(preview_token).unlink(missing_ok=True)


def promote_registered_process_preview(process: CfgProcess) -> bool:
    """Publish a Process preview from the cached datasource preview at registration.

    This restores an immediate local preview for processes registered through the
    standard proc-config modal (which, unlike Register by File, has no pending
    preview token). It is best-effort: when no compatible datasource preview
    exists -- for example the user never pressed Preview Update, or the source
    identity differs -- the Process preview is simply left to be served from
    Internal data after the first import. It never accesses the external source.
    """
    if process.data_source_id is None:
        return False

    context = _build_registered_preview_context(process)
    location_fingerprint = build_datasource_location_fingerprint(context)
    process_path = get_process_preview_path(process.data_source_id, process.id)
    datasource_path = get_datasource_preview_path(context, location_fingerprint)
    saved_columns = TransactionData(process).get_preview_column_metadata()
    fingerprint = build_preview_fingerprint(
        context,
        source_type='process',
        selected_columns=tuple(column['column_name'] for column in saved_columns),
        process_column_configurations=saved_columns,
    )
    for candidate_path in dict.fromkeys((process_path, datasource_path)):
        try:
            candidate = (
                read_stored_preview(candidate_path)
                if candidate_path == process_path
                else read_preview(candidate_path, location_fingerprint)
            )
        except PreviewStorageError:
            logger.exception('Unable to read Preview candidate while registering Process {}', process.id)
            continue
        if candidate is None:
            continue

        source_column_keys = {
            key
            for column in candidate.metadata.columns
            for key in (column['column_name'], column.get('column_raw_name'))
            if key
        }
        compatible_columns = [
            column
            for column in saved_columns
            if column['column_name'] in source_column_keys
            or (column.get('column_raw_name') and column['column_raw_name'] in source_column_keys)
        ]
        if not compatible_columns:
            continue
        try:
            rewrite_process_preview(
                candidate,
                process_path,
                data_source_id=process.data_source_id,
                process_id=process.id,
                fingerprint=fingerprint,
                columns=compatible_columns,
            )
        except (KeyError, ValueError):
            logger.exception('Preview candidate does not match Process {} columns', process.id)
            continue
        return True
    return False


def handle_importing_by_one_click(request: dict) -> list[int]:
    """Create Register by File datasources/processes and queue their existing import jobs.

    Args:
        request: Existing registration payload, optionally including ``quick_plot_upload_id``.

    Returns:
        IDs of every process created by the registration.

    Raises:
        QuickPlotUploadError: If an optional Quick Plot upload is inactive or path-mismatched.
    """
    # Preserve all ordinary request fields while reading the optional Quick Plot ownership token.
    register_by_file_request_id = request.get('request_id')
    csv_info = request.get('csv_info')
    request_proc_configs = request.get('proc_configs')
    quick_plot_upload_id = request.get('quick_plot_upload_id')

    pending_preview_requests = []
    processes = []
    with make_session() as meta_session:
        # Validate upload ownership before creating any datasource or process in this transaction.
        quick_plot_upload = None
        registration_time = datetime.datetime.now(datetime.UTC)
        if quick_plot_upload_id:
            # Quick Plot may only own newly created datasources, never a client-selected existing datasource.
            if not isinstance(csv_info, dict) or not isinstance(csv_info.get('csv_detail'), dict):
                raise QuickPlotUploadError('Quick Plot requires a CSV datasource configuration.')
            csv_detail = csv_info['csv_detail']
            csv_columns = csv_detail.get('csv_columns') or []
            persisted_ids = [csv_info.get('id'), csv_detail.get('id')]
            persisted_ids.extend(csv_column.get('id') for csv_column in csv_columns if isinstance(csv_column, dict))
            if any(identifier is not None for identifier in persisted_ids):
                raise QuickPlotUploadError('Quick Plot cannot update an existing datasource.')

            # Bind ownership to the exact path that will be persisted by DataSourceSchema.
            csv_directory = csv_detail.get('directory')
            quick_plot_upload = validate_quick_plot_registration(
                meta_session,
                quick_plot_upload_id,
                csv_directory,
            )

        # V2 registrations intentionally create and map one datasource per discovered process.
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

            # Record ownership beside datasource creation so rollback cannot leave partial mappings.
            if quick_plot_upload is not None:
                associate_quick_plot_data_source(
                    meta_session,
                    quick_plot_upload,
                    cfg_data_source.id,
                    registration_time,
                )

            # Do gen process config
            process = generate_process_config(meta_session, request_proc_config, cfg_data_source.id)
            processes.append(process)
            preview_token = request_proc_config.get('preview_token')
            if not isinstance(preview_token, str):
                raise ValueError('Register by File requires a preview_token for every Process')
            pending_preview_requests.append((process.id, preview_token))

    for process_id, preview_token in pending_preview_requests:
        process = CfgProcess.get_proc_by_id(process_id)
        if process is None:
            raise ValueError(f'Process was not saved: {process_id}')
        promote_pending_preview(preview_token, process)

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
            interval_sec=param.polling_frequency,
            run_now=True,
            is_user_request=True,
            register_by_file_request_id=register_by_file_request_id,
        )

    return [param.process_id for param in params]
