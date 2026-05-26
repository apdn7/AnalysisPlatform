from __future__ import annotations

import itertools
import json
import os
import tempfile
from contextlib import suppress
from datetime import datetime
from pathlib import Path
from typing import Any

import flask
import flask_migrate
import numpy as np
import pandas as pd
import requests.exceptions
from apscheduler.triggers.date import DateTrigger
from flask import Blueprint, Response, jsonify, request
from flask_babel import get_locale
from flask_babel import gettext as _
from loguru import logger
from pytz import utc

from ap import background_jobs, close_sessions, dic_config, max_graph_config, scheduler
from ap.api.common.services.show_graph_services import check_path_exist, sorted_function_details
from ap.api.common.services.web_apis import APIConnection, check_web_con
from ap.api.efa.services.etl import ETLException
from ap.api.setting_module.services.autolink import Autolink
from ap.api.setting_module.services.common import (
    delete_user_setting_by_id,
    get_all_user_settings,
    get_page_top_setting,
    get_setting,
    is_title_exist,
    save_user_settings,
)
from ap.api.setting_module.services.data_import import (
    DbConnectionParam,
    WebConnectionParam,
    check_db_con,
)
from ap.api.setting_module.services.equations import (
    EquationSampleData,
    validate_functions,
)
from ap.api.setting_module.services.filter_settings import (
    delete_cfg_filter_by_ids,
    delete_cfg_filter_from_db,
    save_filter_config,
)
from ap.api.setting_module.services.import_function_column import (
    MainSerialFunctionColumnHandler,
    add_new_columns_to_transaction_table,
    add_required_jobs_after_update_transaction_table,
    get_main_function_column_handlers,
    update_transaction_table,
    update_transaction_table_job,
)
from ap.api.setting_module.services.polling_frequency import (
    add_bulk_register_process_job,
    add_delete_transaction_data_job,
    add_export_job,
    add_idle_monitoring_job,
    change_polling_all_interval_jobs,
    handle_update_polling,
    has_important_changes,
)
from ap.api.setting_module.services.process_delete import (
    del_data_source,
    delete_proc_cfg_and_relate_jobs,
    delete_pulled_data_folders,
    delete_transaction_when_initial_process,
    initialize_proc_config,
)
from ap.api.setting_module.services.save_load_user_setting import map_form, transform_settings
from ap.api.setting_module.services.show_latest_record import (
    check_datasource_connection,
    gen_preview_data_check_dict,
    gen_v2_columns_with_types,
    get_last_distinct_sensor_values,
    get_latest_record_from_preview_file,
    get_latest_records,
    get_preview_data_files,
    get_sample_from_preview_data,
    preview_csv_data,
    preview_v2_data,
    save_master_vis_config,
    save_preview_ds_file,
    save_preview_process_file,
)
from ap.api.setting_module.services.shutdown_app import shut_down_app
from ap.api.trace_data.services.proc_link import (
    add_gen_proc_link_job,
    get_first_valid_value_for_proc_link_preview,
    proc_link_count_job,
    show_proc_link_info,
)
from ap.api.trace_data.services.proc_link_simulation import sim_gen_global_id
from ap.common.authorization import is_authorized, login_required
from ap.common.clean_expired_request import add_job_delete_expired_request
from ap.common.common_utils import (
    SQLiteFormatStrings,
    WebAuthenticationType,
    get_current_timestamp,
    get_hostname,
    is_none_or_empty,
    parse_int_value,
)
from ap.common.constants import (
    ANALYSIS_INTERFACE_ENV,
    DATA_CACHE_FOLDER,
    DEFAULT_IMPORT_LIMIT,
    EMPTY_STRING,
    FILE_NAME,
    FISCAL_YEAR_START_MONTH,
    OSERR,
    SHUTDOWN,
    UI_ORDER_DB,
    UNDER_SCORE,
    UNIVERSAL_DB_FILE,
    WITH_CHANGE_ALL_FREQ_SAME_DS,
    WITH_IMPORT_OPTIONS,
    Action,
    AnnounceEvent,
    AppEnv,
    CfgConstantType,
    CSVExtTypes,
    DataColumnType,
    DBType,
    DefinedLabel,
    FormulaType,
    JobStatus,
    JobType,
    MasterDBType,
    ProcessCfgConst,
    ProcessStatus,
    SampleDataDisplayMode,
)
from ap.common.custom_exception import DatabaseConnectionError
from ap.common.datetime_format_utils import convert_datetime_format
from ap.common.db_maintenance import backup_config_db
from ap.common.memoize import clear_cache
from ap.common.multiprocess_sharing import EventAddJob, EventBackgroundAnnounce, EventQueue, EventRemoveJobs
from ap.common.multiprocess_sharing.events import EventKillJobs
from ap.common.path_utils import get_error_trace_path, get_export_setting_path, get_files, get_log_path, make_dir
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.common.scheduler import run_after_request
from ap.common.services.http_content import json_dumps, orjson_dumps
from ap.common.services.import_export_config_and_master_data import (
    backup_instance_folder,
    cleanup_backup_data,
    clear_db_n_data,
    clear_event_queue,
    create_archive,
    create_archive_log_folder,
    delete_file_and_folder_by_path,
    delete_folder_data,
    export_data,
    import_config_and_master,
    pause_event_queue,
    pause_job_running,
    resume_event_queue,
    revert_instance_folder,
    wait_done_jobs,
)
from ap.common.services.import_export_config_n_data import download_zip_file
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import remove_non_ascii_chars
from ap.common.services.sse import MessageAnnouncer
from ap.conversion_formula import JudgeFormula, conversion_formula, gen_formula_type
from ap.import_filter.utils import get_import_filters_from_process
from ap.setting_module.models import (
    AppLog,
    CfgConstant,
    CfgDataSource,
    CfgDataSourceDB,
    CfgExport,
    CfgLabel,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    MFunction,
    make_session,
)
from ap.setting_module.schemas import (
    AutolinkInSchema,
    CfgUserSettingSchema,
    DataSourcePublicSchema,
    DataSourceSchema,
    ExportConfigSchema,
    LabelSchema,
    ProcessSchema,
    ProcessVisualizationSchema,
    SWProcessSchema,
)
from ap.setting_module.services.background_process import get_background_jobs_service, get_job_detail_service
from ap.setting_module.services.backup_and_restore.jobs import add_backup_data_job, add_restore_data_job
from ap.setting_module.services.process_config import (
    create_or_update_process_cfg,
    get_ct_range,
    get_line_grp_info,
    get_or_create_label,
    get_process_cfg,
    get_process_columns,
    get_process_filters,
    get_process_visualizations,
    query_database_tables,
)
from ap.setting_module.services.register_from_file import (
    get_latest_records_for_register_by_file,
    get_url_to_redirect,
    handle_importing_by_one_click,
)
from ap.setting_module.services.trace_config import (
    gen_cfg_trace,
    get_all_processes_traces_info,
    trace_config_crud,
)
from ap.trace_data.transaction_model import TransactionData

api_setting_module_blueprint = Blueprint('api_setting_module', __name__, url_prefix='/ap/api/setting')


@api_setting_module_blueprint.route('/update_polling_freq', methods=['POST'])
@login_required
def update_polling_freq():
    try:
        data_update = json.loads(request.data)

        with_import_option = data_update.get(WITH_IMPORT_OPTIONS)
        polling_freq_str = data_update.get('polling_frequency')
        data_source_id = data_update.get('data_source_id')
        with_change_all_freq_same_ds = data_update.get(WITH_CHANGE_ALL_FREQ_SAME_DS)

        polling_freq = parse_int_value(polling_freq_str) if polling_freq_str is not None else None
        data_src_type = CfgDataSource.get_by_id(data_source_id).type

        if with_change_all_freq_same_ds:
            data_src_ids_by_src_type = CfgDataSource.get_ids_by_type(data_src_type)
        else:
            data_src_ids_by_src_type = [data_source_id]

        for data_source_id in data_src_ids_by_src_type:
            with make_session() as meta_session:
                CfgDataSource.update_polling_freq(
                    meta_session, data_source_id=data_source_id, polling_frequency=polling_freq
                )
            data_src = CfgDataSource.get_by_id(data_source_id)
            handle_update_polling(data_src, with_import_option, True)

    except Exception as e:
        logger.exception(e)
        message = {'message': _('Failed to change polling frequency'), 'is_error': True}
        return jsonify(flask_message=message), 500

    message = {
        'message': _('changedPollingFreq'),
        'is_error': False,
        'data_source_ids': data_src_ids_by_src_type,
        'data_src_type': data_src_type,
    }
    return jsonify(flask_message=message), 200


@api_setting_module_blueprint.route('/data_source_save', methods=['POST'])
@login_required
def save_datasource_cfg():
    """Expected: ds_config = {"db_0001": {"master-name": name, "host": localhost, ...}}"""
    try:
        data_src_req: CfgDataSource = DataSourceSchema().load(request.json)
        is_polling_freq_changed, is_pull_from_changed = has_important_changes(data_src_req)

        with make_session() as meta_session:
            data_src = meta_session.merge(data_src_req)

        with_import_option = request.json.get(WITH_IMPORT_OPTIONS) or is_pull_from_changed
        handle_update_polling(data_src, with_import_option, is_polling_freq_changed)
    except Exception as e:
        logger.exception(e)
        message = {'message': _('Database Setting failed to save'), 'is_error': True}
        return jsonify(flask_message=message), 500

    message = {'message': _('Database Setting saved.'), 'is_error': False}

    ds = None
    if data_src and data_src.id:
        ds = DataSourcePublicSchema().dumps(data_src)

    return jsonify(id=data_src.id, data_source=ds, flask_message=message), 200


@api_setting_module_blueprint.route('/v2_data_source_save', methods=['POST'])
@login_required
def save_v2_datasource_cfg():
    """Expected: ds_config = [{"db_0001": {"master-name": name, "host": localhost, ...}}]"""
    try:
        datasources = request.json
        v2_datasources = []
        for v2_data_src in datasources:
            v2_columns = gen_v2_columns_with_types(v2_data_src)
            # update data_source columns
            v2_data_src['csv_detail']['csv_columns'] = v2_columns
            v2_data_src['csv_detail']['dummy_header'] = False

            data_src: CfgDataSource = DataSourceSchema().load(v2_data_src)
            is_polling_freq_changed, is_pull_from_changed = has_important_changes(data_src)

            with make_session() as meta_session:
                # data source
                data_src_rec = meta_session.merge(data_src)

            if data_src_rec and data_src_rec.id:
                ds_schema = DataSourceSchema()
                ds = CfgDataSource.get_ds(data_src_rec.id)
                ds = ds_schema.dumps(ds)
                v2_datasources.append({'id': data_src_rec.id, 'data_source': ds})

            with_import_option = v2_data_src.get(WITH_IMPORT_OPTIONS) or is_pull_from_changed
            handle_update_polling(data_src_rec, with_import_option, is_polling_freq_changed)

        message = {'message': _('Database Setting saved.'), 'is_error': False}
        return jsonify(data=v2_datasources, flask_message=message), 200

    except Exception as e:
        logger.exception(e)
        message = {'message': _('Database Setting failed to save'), 'is_error': True}
    return jsonify(flask_message=message), 500


# TODO: refactoring check connection without this function
@api_setting_module_blueprint.route('/database_tables', methods=['GET'])
def get_database_tables():
    db_tables = CfgDataSource.get_all()
    ds_schema = DataSourcePublicSchema(many=True)
    dump_data = ds_schema.dumps(db_tables)
    list_ds = json.loads(dump_data)
    for ds in list_ds:
        ds['en_name'] = to_romaji(ds['name'])
    dump_data = json_dumps(list_ds)
    return dump_data, 200 if db_tables else 500


@api_setting_module_blueprint.route('/database_tables_source', methods=['GET'])
def get_database_tables_source():
    db_source = CfgDataSource.get_all_db_source()
    ds_schema = DataSourcePublicSchema(many=True)
    dump_data = ds_schema.dumps(db_source)
    return dump_data, 200 if db_source else 500


@api_setting_module_blueprint.route('/database_table/<db_id>', methods=['GET'])
def get_database_table(db_id):
    response_dict = {'tables': [], 'process_factids': [], 'master_types': [], 'msg': 'Invalid data source id'}
    if not db_id:
        return jsonify(response_dict), 400

    tables = query_database_tables(db_id)

    if tables is None:
        return jsonify(response_dict), 400
    else:
        return jsonify(tables), 200


@api_setting_module_blueprint.route('/check_db_connection', methods=['POST'])
def check_db_connection():
    """Check if we can connect to database. Supported databases: SQLite, PostgreSQL, MSSQLServer.
    Returns:
        HTTP Response - (True + OK message) if connection can be established, return (False + NOT OK message) otherwise.
    """
    params = DbConnectionParam.model_validate(json.loads(request.data).get('db'))
    result = None
    try:
        result = check_db_con(params)
    except Exception as e:
        logger.exception(e)

    if result:
        message = {'db_type': params.db_type, 'message': _('Connected'), 'connected': True}
    else:
        message = {'db_type': params.db_type, 'message': _('Failed to connect'), 'connected': False}

    return jsonify(flask_message=message), 200


@api_setting_module_blueprint.route('/check_web_connection', methods=['POST'])
def check_web_connection():
    """Check connection for web API
    Returns:
        HTTP Response - (True + OK message) if connection can be established, return (False + NOT OK message) otherwise.
    """
    params = WebConnectionParam.model_validate(json.loads(request.data))
    username = params.username or None
    password = params.password or None
    authentication_type = params.authentication_type or WebAuthenticationType.NONE

    api_url = params.url
    connection = APIConnection(url=api_url, message=None, connected=False)

    try:
        connection = check_web_con(
            api_url, username=username, password=password, authentication_type=authentication_type
        )
        connection.message = [_('Connected')]
    except Exception as e:
        logger.exception(e)
        if isinstance(e, requests.exceptions.HTTPError):
            # 401:
            if e.response.status_code == 401:
                connection.message = _('Failed to authorized. Please check your credentials.')
            # 404:
            elif e.response.status_code == 404:
                connection.message = _('Failed to find connect to URL. Please check your URL.')
            # others:
            else:
                connection.message = _('Failed to connect to URL')
        else:
            connection.message = [_('Failed to connect')]

    return jsonify(flask_message=connection.as_dict()), 200


@api_setting_module_blueprint.route('/show_latest_records_for_register_by_file', methods=['POST'])
def show_latest_records_for_register_by_file():
    """[summary]
    Show 5 latest records
    Returns:
        [type] -- [description]
    """
    dic_form = request.form.to_dict()
    file_name = dic_form.get('fileName') or None
    limit = parse_int_value(dic_form.get('limit')) or 10
    folder = dic_form.get('folder') or None
    latest_rec = get_latest_records_for_register_by_file(file_name, folder, limit)
    return json_dumps(latest_rec)


@api_setting_module_blueprint.route('/show_latest_records', methods=['POST'])
def show_latest_records():
    """[summary]
    Show 5 latest records
    Returns:
        [type] -- [description]
    """
    # TODO: make show latest records works with pydantic
    dic_form = request.form.to_dict()
    data_source_id = dic_form.get('databaseName') or dic_form.get('processDsID')
    table_name = dic_form.get('tableName') or None
    file_name = dic_form.get('fileName') or None
    limit = parse_int_value(dic_form.get('limit')) or 10
    folder = dic_form.get('folder') or None
    current_process_id = dic_form.get('currentProcessId', None)
    process_factid = dic_form.get('processFactId', None)
    master_type = dic_form.get('masterType', None)
    master_type = MasterDBType[master_type] if master_type else None
    etl_func = dic_form.get('etlFunc', '')
    import_filter = json.loads(dic_form.get('filter') or '{}')
    api_url = dic_form.get('apiUrl', None)

    response_code = 200
    result = {
        'cols': [],
        'rows': [],
        'cols_duplicated': [],
        'fail_limit': None,
        'has_ct_col': None,
        'dummy_datetime_idx': None,
        'is_rdb': False,
        'file_name_col_idx': None,
        'transform_error': False,
        'unique_rows_as_category': [],
        'unique_rows_as_real': [],
        'unique_rows_as_int': [],
    }
    preview_data = None
    old_cols_from_file = None

    if current_process_id and current_process_id != 'null' and not file_name:
        preview_file_name = get_preview_data_files(
            data_source_id, table_name, process_factid, master_type, etl_func, current_process_id
        )
        if preview_file_name:
            try:
                with open(preview_file_name, encoding='utf-8') as file:
                    preview_data = get_latest_record_from_preview_file(file, current_process_id, limit)
                    old_cols_from_file = [col['column_name'] for col in preview_data.get('cols', [])]
            except Exception as e:
                logger.exception(e)

        # For registered process: Try connecting to datasource
        try:
            data_source: CfgDataSource = CfgDataSource.query.get(data_source_id)
            check_datasource_connection(data_source)
        except (FileNotFoundError, DatabaseConnectionError) as e:
            logger.exception(e)
            # If the data source cannot be accessed, data is loaded from a pre-saved JSON file.
            if preview_data:
                return json_dumps(preview_data), response_code
            result['message'] = _('Unable to connect to data source. No preview data available.')
            return json_dumps(result), response_code

    # Try to get data from source first
    try:
        latest_rec = get_latest_records(
            data_source_id,
            table_name,
            file_name,
            folder,
            limit,
            current_process_id,
            process_factid=process_factid,
            master_type=master_type,
            etl_func=etl_func,
            api_url=api_url,
            import_filter=import_filter,
        )
        if latest_rec:
            (
                cols_with_types,
                rows,
                cols_duplicated,
                previewed_files,
                has_ct_col,
                dummy_datetime_idx,
                is_rdb,
                file_name_col_idx,
                unique_rows_as_category,
                unique_rows_as_real,
                unique_rows_as_int,
                unique_rows_as_int_cat,
                labels,
            ) = latest_rec

            # === Column change check section ===
            column_changed_message = None
            if old_cols_from_file is not None:
                new_cols = [col['column_name'] for col in cols_with_types]
                if set(old_cols_from_file) != set(new_cols) or old_cols_from_file != new_cols:
                    column_changed_message = _(
                        'The data source columns have changed. The imported data may no longer be accurate.'
                        ' Please reinitialize the process and re-register.'
                    )

            dic_preview_limit = gen_preview_data_check_dict(rows, previewed_files)
            data_group_type = {key: DataColumnType[key].value for key in DataColumnType.get_keys()}
            result = {
                'cols': cols_with_types,
                'rows': rows,
                'cols_duplicated': cols_duplicated,
                'fail_limit': dic_preview_limit,
                'has_ct_col': has_ct_col,
                'dummy_datetime_idx': None if is_rdb else dummy_datetime_idx,
                'data_group_type': data_group_type,
                'is_rdb': is_rdb,
                'file_name_col_idx': file_name_col_idx,
                'transform_error': False,
                'unique_rows_as_category': unique_rows_as_category,
                'unique_rows_as_real': unique_rows_as_real,
                'unique_rows_as_int': unique_rows_as_int,
                'unique_rows_as_int_cat': unique_rows_as_int_cat,
                'labels': [DefinedLabel(label).name for label in labels],
            }
            # Save the fetched data to JSON file
            save_preview_ds_file(
                int(data_source_id),
                result,
                table_name=table_name,
                process_factid=process_factid,
                master_type=master_type,
                etl_func=etl_func,
            )
            result['message'] = column_changed_message
            result = json_dumps(result)
            return result, response_code
    except ETLException as e:
        result['transform_error'] = e.get_message()
        response_code = e.status_code
        return json_dumps(result), response_code
    except Exception as e:
        logger.exception(e)
        return json_dumps(result), response_code


@api_setting_module_blueprint.route('/get_csv_resources', methods=['POST'])
def get_csv_resources():
    folder_url = request.json.get('url')
    etl_func = request.json.get('etl_func')
    csv_delimiter = request.json.get('delimiter')
    is_v2 = request.json.get('isV2')
    skip_head = request.json.get('skip_head')
    skip_head = None if skip_head is None else int(skip_head)
    n_rows = request.json.get('n_rows')
    n_rows = None if n_rows is None else int(n_rows)
    is_transpose = request.json.get('is_transpose')
    is_file = request.json.get('is_file')
    is_file_checker = request.json.get('is_file_checker') or False

    # todo: is_show_raw_data to handle raw data for datasource preview, but datetime is wrong <- check it again
    if is_v2:
        dic_output = preview_v2_data(
            folder_url,
            csv_delimiter,
            5,
            file_name=folder_url if is_file else None,
            is_show_raw_data=False,
        )
    else:
        dic_output = preview_csv_data(
            folder_url,
            etl_func,
            csv_delimiter,
            skip_head=skip_head,
            n_rows=n_rows,
            is_transpose=is_transpose,
            limit=5,
            file_name=folder_url if is_file else None,
            is_show_raw_data=False,
            is_file_checker=is_file_checker,
        )
    rows = dic_output['content']
    previewed_files = dic_output['previewed_files']
    dic_preview_limit = gen_preview_data_check_dict(rows, previewed_files)
    dic_output['fail_limit'] = dic_preview_limit

    return jsonify(dic_output), 200


@api_setting_module_blueprint.route('/job', methods=['POST'])
def get_background_jobs():
    return jsonify(background_jobs), 200


@api_setting_module_blueprint.route('/listen_background_job/<uuid>', methods=['GET'])
def listen_background_job(uuid: str):
    """Create a streamer for communicating with front-end.
    We don't need to check if this streamer is duplicated or not,
    because only one-client (one target browser) can communicate with this at a time.
    """
    streamer = MessageAnnouncer.create_streamer(uuid)
    return Response(streamer.stream(), mimetype='text/event-stream')


@api_setting_module_blueprint.route('/check_folder', methods=['POST'])
def check_folder():
    try:
        data = request.json.get('url')
        is_file = request.json.get('isFile') or False
        is_existing = os.path.isfile(data) if is_file else (os.path.isdir(data) and os.path.exists(data))
        extension = [CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value, CSVExtTypes.ZIP.value]
        is_valid_file = True
        if not is_file:
            os.listdir(data)
            is_not_empty = False
            files = get_files(data, depth_from=1, depth_to=100, extension=extension)
            for file in files:
                is_not_empty = any(file.lower().endswith(ext) for ext in extension)
                if is_not_empty:
                    break
        else:
            is_valid_file = any(data.lower().endswith(ext) for ext in extension)
            is_not_empty = os.path.isfile(data)

        is_valid = is_existing and is_not_empty
        err_msg = _('File not found')  # empty folder
        file_not_valid = _('File not valid')
        return jsonify(
            {
                'status': 200,
                'url': data,
                'is_exists': is_existing,
                'dir': os.path.dirname(data),
                'not_empty_dir': is_not_empty,
                'is_valid': is_valid,
                'err_msg': err_msg if not is_valid else file_not_valid if not is_valid_file else '',
                'is_valid_file': is_valid_file,
            },
        )
    except OSError as e:
        # raise
        return jsonify({'status': 500, 'err_msg': _(OSERR[e.errno]), 'is_valid': False})


@api_setting_module_blueprint.route('/check_folder_or_file', methods=['POST'])
def check_folder_or_file():
    try:
        data = request.json.get('path')
        return jsonify(
            {
                'status': 200,
                'isFile': os.path.isfile(data),
                'isFolder': os.path.isdir(data),
            },
        )
    except OSError as e:
        # raise
        return jsonify(
            {
                'status': 500,
                'err_msg': _(OSERR[e.errno]),
                'isFile': False,
                'isFolder': False,
            },
        )


@api_setting_module_blueprint.route('/job_detail/<job_id>', methods=['GET'])
def get_job_detail(job_id):
    """[Summary] Get get job details
    Returns:
        [json] -- [job details content]
    """
    job_details = get_job_detail_service(job_id=job_id)
    return jsonify(job_details), 200


@api_setting_module_blueprint.route('/delete_process', methods=['POST'])
@login_required
def delete_proc_from_db():
    # get proc_id
    params = json.loads(request.data)
    proc_id = params.get('proc_id')
    proc_id = int(proc_id) or None

    # delete config and add job to delete data
    deleted_process_ids = delete_proc_cfg_and_relate_jobs(proc_id)

    return jsonify({'deleted_processes': deleted_process_ids}), 200


@api_setting_module_blueprint.route('/save_order/<order_name>', methods=['POST'])
@login_required
def save_order(order_name):
    """[Summary] Save orders to DB
    Returns: 200/500
    """
    try:
        orders = json.loads(request.data)
        with make_session() as meta_session:
            if order_name == UI_ORDER_DB:
                for key, val in orders.items():
                    CfgDataSource.update_order(meta_session, key, val)
            else:
                for key, val in orders.items():
                    CfgProcess.update_order(meta_session, key, val)

    except Exception as e:
        logger.exception(e)
        return jsonify({}), 500

    return jsonify({}), 200


@api_setting_module_blueprint.route('/delete_datasource_cfg', methods=['POST'])
@login_required
def delete_datasource_cfg():
    params = json.loads(request.data)
    data_source_id = params.get('db_code')
    if data_source_id:
        del_data_source(data_source_id)

    return jsonify(id=data_source_id), 200


@api_setting_module_blueprint.route('/stop_job', methods=['POST'])
@login_required
def stop_jobs():
    try:
        # Interrupt import/update jobs before shutdown app
        target_job_types = [
            JobType.CSV_IMPORT,
            JobType.FACTORY_IMPORT,
            JobType.FACTORY_PAST_IMPORT,
            JobType.WEB_API_IMPORT,
            JobType.IMPORT_DATA,
            JobType.USER_BACKUP_DATABASE,
            JobType.USER_RESTORE_DATABASE,
            JobType.UPDATE_TRANSACTION_TABLE,
        ]
        for proc in CfgProcess.query.all():  # type: CfgProcess
            EventQueue.put(EventKillJobs(job_types=target_job_types, process_id=proc.id))

        # save log to db
        with make_session() as meta_session:
            t_app_log = AppLog()
            t_app_log.ip = request.environ.get('X-Forwarded-For') or request.remote_addr
            t_app_log.action = Action.SHUTDOWN_APP.name
            t_app_log.description = request.user_agent.string
            meta_session.add(t_app_log)

        # backup database now
        backup_config_db()
    except Exception as e:
        logger.exception(e)

    # add a job to check for shutdown time
    # add_shutdown_app_job()
    shut_down_app()

    return jsonify({}), 200


@api_setting_module_blueprint.route('/shutdown', methods=['POST'])
@login_required
def shutdown():
    dic_config[SHUTDOWN] = True
    response = flask.make_response(jsonify({}))
    return response, 200


@api_setting_module_blueprint.route('/sw_register', methods=['POST'])
def post_sw_register():
    """Software workshop datasource bulk register and import"""
    ja_locale = False
    with suppress(Exception):
        ja_locale = get_locale().language == 'ja'
    try:
        payload = json.loads(request.data)
        datasource = payload.get('datasource')
        processes = payload.get('processes')
        is_directly_import = payload.get('is_directly_import') or False
        # to register datasource and return ids
        data_src_req: CfgDataSource = DataSourceSchema().load(datasource)
        is_polling_freq_changed, is_pull_from_changed = has_important_changes(data_src_req)

        if (
            data_src_req.db_detail is not None
            and data_src_req.id
            and datasource.get('db_detail', {}).get('password', None) == EMPTY_STRING
        ):
            db = CfgDataSourceDB.get_by_id(data_src_req.id)
            if db is not None:
                data_src_req.db_detail.password = db.password

        with make_session() as meta_session:
            data_src = meta_session.merge(data_src_req)

        with_import_option = datasource.get(WITH_IMPORT_OPTIONS) or is_pull_from_changed
        handle_update_polling(data_src, with_import_option, is_polling_freq_changed)

        output_procs = []
        if processes:
            # to combine process data with parent datasource id
            for item in processes:
                process_id = item.get(ProcessCfgConst.PROC_ID.value, None)
                if process_id:
                    # in case of the process is already existing, do not re-register
                    continue
                master_type = str(item.get(ProcessCfgConst.MASTER_TYPE.value))
                master_type = MasterDBType[master_type] if MasterDBType.has_key(master_type) else None
                master_type_suffix = master_type.get_data_type()

                # same method of generating table_name as get_list_process_software_workshop
                table_name = f'{item.get(ProcessCfgConst.TABLE_NAME.value, "")}{UNDER_SCORE}{master_type_suffix}'
                proc_name = f'{data_src.name}{UNDER_SCORE}{table_name}'
                proc_name_en = to_romaji(proc_name)
                process_factid = str(item.get(ProcessCfgConst.CHILD_EQUIP_ID.value))

                # save processes then update it later
                # make process data
                sw_process = {
                    ProcessCfgConst.DATA_SOURCE_ID.value: data_src.id,
                    ProcessCfgConst.PROC_NAME.value: proc_name_en,
                    ProcessCfgConst.TABLE_NAME.value: table_name,
                    ProcessCfgConst.FACT_ID.value: process_factid,
                    ProcessCfgConst.MASTER_TYPE.value: master_type.name,
                    ProcessCfgConst.NAME_JP.value: proc_name if ja_locale else None,
                    ProcessCfgConst.PROC_NAME_EN.value: proc_name_en,
                    ProcessCfgConst.NAME_LOCAL.value: proc_name_en if not ja_locale else None,
                    ProcessCfgConst.STATUS.value: ProcessStatus.INITIALIZING.value,
                }
                # register SW process with all detected columns
                process: CfgProcess = SWProcessSchema().load(sw_process)

                # generate default label
                process_labels: dict[int, CfgLabel] = {}
                with make_session() as meta_session:
                    defined_label = DefinedLabel.get_by_dbtype(DBType[data_src.type])
                    label_name = defined_label.name
                    label = get_or_create_label(label_name, meta_session)
                    process_labels[label.id] = label
                # sort label
                process.labels = sorted(process_labels.values(), key=lambda v: v.id)

                # to register process
                with make_session() as meta_session:
                    process = meta_session.merge(process)

                output_procs.append(ProcessSchema().dump(process))

            add_bulk_register_process_job(
                proc_ids=[proc.get('id') for proc in output_procs],
                is_directly_import=is_directly_import,
                ds_id=data_src.id,
            )

        message = {'message': _('Database Setting saved.'), 'is_error': False}
        ds = None
        if data_src and data_src.id:
            ds = DataSourceSchema().dumps(data_src)
        return jsonify(
            id=data_src.id,
            data_source=ds,
            processes=output_procs,
            flask_message=message,
        ), 200
    except Exception as e:
        logger.exception(e)
        message = {'message': _('Database Setting failed to save'), 'is_error': True}
        return jsonify(flask_message=message), 500


@run_after_request
def add_update_transaction_table_job(
    process: CfgProcess,
    old_main_serial_cfg_process_column: CfgProcessColumn,
    is_show_warning_message: bool,
    next_run_time: datetime,
):
    EventQueue.put(
        EventAddJob(
            fn=update_transaction_table_job,
            kwargs={
                'process_id': process.id,
                'old_main_serial_cfg_process_column': old_main_serial_cfg_process_column,
                'is_show_warning_message': is_show_warning_message,
            },
            job_type=JobType.UPDATE_TRANSACTION_TABLE,
            process_id=process.id,
            replace_existing=True,
            trigger=DateTrigger(next_run_time, timezone=utc),
            next_run_time=next_run_time,
            max_instances=1,
        ),
    )


@api_setting_module_blueprint.route('/proc_config', methods=['POST'])
@login_required
def post_proc_config():
    process_schema = ProcessSchema()
    request_process: CfgProcess = process_schema.load(request.json.get('proc_config'))
    init_parent = request.json.get('init_parent')
    unused_columns = request.json.get('unused_columns', [])
    labels = request.json.get('labels', [])
    # validate function column
    function_columns = itertools.chain.from_iterable(col.function_details for col in request_process.columns)
    sorted_functions = sorted(function_columns, key=lambda x: x.order)
    validate_functions(request_process.columns, sorted_functions)

    try:
        # initialize data before import
        if init_parent and request_process.parent_id:
            # to initialize parent
            # remove all jobs of parent process in this step
            delete_transaction_when_initial_process(request_process.parent_id)

        # get exists process from id
        old_main_serial_cfg_process_column: CfgProcessColumn | None = None
        is_new_proc = is_none_or_empty(request_process.id)
        if not is_new_proc:
            # Getting process from `CfgProcess` again is necessary.
            # In case if user A delete process `proc_id`, and user B update process `proc_id`,
            # we need to prevent user B performing that action.
            exist_process = CfgProcess.get_proc_by_id(request_process.id)

            if not exist_process:
                return (
                    jsonify(
                        {
                            'status': 404,
                            'message': f'Not found {request_process.id}',
                        },
                    ),
                    200,
                )

            exist_judge_col_id = next((col.id for col in exist_process.columns if col.is_judge), None)
            request_judge_col_id = next((col.id for col in request_process.columns if col.is_judge), None)
            judge_col_ids = {
                col_id
                for col_id in (exist_judge_col_id, request_judge_col_id)
                if exist_judge_col_id != request_judge_col_id and col_id is not None
            }

            filter_ids = [item.id for item in exist_process.filters if item.column_id in judge_col_ids]
            delete_cfg_filter_by_ids(filter_ids)

            old_main_serial_cfg_process_column = exist_process.get_main_serial_column(is_isolation_object=True)

            # Remove import jobs before running update transaction table job
            target_jobs = [
                JobType.IMPORT_DATA,
                JobType.CSV_IMPORT,
                JobType.FACTORY_IMPORT,
                JobType.FACTORY_PAST_IMPORT,
                JobType.WEB_API_IMPORT,
                JobType.USER_BACKUP_DATABASE,
                JobType.USER_RESTORE_DATABASE,
                JobType.UPDATE_TRANSACTION_TABLE,
            ]
            EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=exist_process.id))

        # Do update cfg_process, cfg_process_column, cfg_process_unused_column
        processes_to_queue_jobs = []
        with make_session() as session:
            request_process.status = ProcessStatus.REGISTERED.value
            process = create_or_update_process_cfg(request_process, unused_columns, labels, meta_session=session)
            process = process.clone()
            output_data = process_schema.dump(process)
            # save preview_process by process id
            save_preview_process_file(
                output_data['data_source_id'],
                output_data['id'],
                output_data['table_name'],
                output_data['process_factid'],
                output_data['master_type'],
                output_data['etl_func'],
            )

            if is_new_proc:
                # In case new process, do update transaction table immediately
                list(update_transaction_table(process, old_main_serial_cfg_process_column=None, meta_session=session))
                processes_to_queue_jobs.append(process)
            else:
                # If there are new function columns, add the columns into transaction table first to make show graph
                # feature work normally
                add_new_columns_to_transaction_table(process, meta_session=session)

                main_function_column_handlers = get_main_function_column_handlers(process=process)
                is_show_warning_message = False
                for handler in main_function_column_handlers:
                    if isinstance(handler, MainSerialFunctionColumnHandler):
                        is_show_warning_message = handler.is_show_warning_message(old_main_serial_cfg_process_column)

                # Add UPDATE_TRANSACTION_TABLE job
                next_run_time = datetime.now().astimezone(utc)
                add_update_transaction_table_job(
                    process,
                    old_main_serial_cfg_process_column,
                    is_show_warning_message,
                    next_run_time,
                )
                processes_to_queue_jobs = CfgProcess.get_all_parents_and_children_processes(
                    request_process.id,
                    session=session,
                )

        for process in processes_to_queue_jobs:
            add_required_jobs_after_update_transaction_table(process, is_new_process=is_new_proc)

        return (
            jsonify(
                {
                    'status': 200,
                    'data': output_data,
                },
            ),
            200,
        )
    except Exception as e:
        logger.exception(e)
        return (
            jsonify(
                {
                    'status': 500,
                    'message': str(e),
                },
            ),
            500,
        )


@api_setting_module_blueprint.route('/initialize_proc/<process_id>', methods=['POST'])
@login_required
def initialize_process(process_id):
    try:
        initialize_proc_config(process_id)
        return jsonify({'message': 'Delete file transaction successfully'}), 200
    except Exception as e:
        logger.exception(e)
        return jsonify({'message': 'Failed to initialize process'}), 500


@api_setting_module_blueprint.route('/trace_config', methods=['GET'])
def get_trace_configs():
    """[Summary] Save orders to DB
    Returns: 200/500
    """
    try:
        trace_configs = get_all_processes_traces_info(with_parent=False)
        dumped_trace_configs = [p.model_dump() for p in trace_configs]
        return orjson_dumps({'traceConfigs': dumped_trace_configs}), 200
    except Exception as e:
        logger.exception(e)
        return jsonify({}), 500


@api_setting_module_blueprint.route('/trace_config', methods=['POST'])
@login_required
def save_trace_configs():
    """[Summary] Save trace_configs to DB
    Returns: 200/500
    """
    try:
        traces = json.loads(request.data)
        trace_config_crud(traces)
        add_gen_proc_link_job(is_user_request=True)
    except Exception as e:
        logger.exception(e)
        return json_dumps({}), 500

    return json_dumps({}), 200


@api_setting_module_blueprint.route('/ds_load_detail/<ds_id>', methods=['GET'])
def ds_load_detail(ds_id):
    ds_schema = DataSourcePublicSchema()
    ds = CfgDataSource.get_ds(ds_id)
    return ds_schema.dumps(ds), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>', methods=['DELETE'])
@login_required
def del_proc_config(proc_id):
    return (
        jsonify(
            {
                'status': 200,
                'data': {
                    'proc_id': proc_id,
                },
            },
        ),
        200,
    )


@api_setting_module_blueprint.route('/proc_config/<proc_id>', methods=['GET'])
def get_proc_config(proc_id):
    process = get_process_cfg(proc_id)
    parent_and_child_processes = CfgProcess.get_all_parents_and_children_processes(proc_id)
    col_id_in_funcs = CfgProcessFunctionColumn.get_all_cfg_col_ids()
    if process:
        tables = query_database_tables(process['data_source_id'], process=process)
        return (
            jsonify(
                {
                    'status': 200,
                    'data': process,
                    'tables': tables,
                    'col_id_in_funcs': col_id_in_funcs,
                    'has_parent_or_children': len(parent_and_child_processes) > 1,
                    'is_imported': int(process.get('status') or 0) == ProcessStatus.REGISTERED.value,
                },
            ),
            200,
        )
    else:
        return jsonify({'status': 404, 'data': 'Not found'}), 200


@api_setting_module_blueprint.route('/proc_filter_config/<proc_id>', methods=['GET'])
def get_proc_config_filter_data(proc_id):
    process = get_process_cfg(proc_id)
    # filter_col_data = get_filter_col_data(process) or {}
    columns = process.get('columns')
    process['columns'] = [column for column in columns if column.get(CfgProcessColumn.function_details.key) is not None]
    filter_col_data = {}
    if process:
        if not process['name_en']:
            process['name_en'] = to_romaji(process['name'])
        return (
            jsonify(
                {
                    'status': 200,
                    'data': process,
                    'filter_col_data': filter_col_data,
                    'is_authorized': is_authorized(),
                },
            ),
            200,
        )
    else:
        return (
            jsonify(
                {
                    'status': 404,
                    'data': {},
                    'filter_col_data': {},
                    'is_authorized': is_authorized(),
                },
            ),
            200,
        )


@api_setting_module_blueprint.route('/proc_table_viewer_columns/<proc_id>', methods=['GET'])
def get_table_viewer_columns(proc_id):
    process = get_process_cfg(proc_id)
    columns = []
    for column in process.get('columns'):
        if len(column.get(CfgProcessColumn.function_details.key)) > 0:
            continue

        if column.get(CfgProcessColumn.column_raw_name.name) == FILE_NAME:
            continue

        if column.get(CfgProcessColumn.is_dummy_datetime.name):
            continue

        columns.append(column)

    process['columns'] = columns
    if process:
        if not process['name_en']:
            process['name_en'] = to_romaji(process['name'])
        return (
            json_dumps(
                {
                    'status': 200,
                    'data': process,
                    'filter_col_data': {},
                },
            ),
            200,
        )
    else:
        return (
            json_dumps(
                {
                    'status': 404,
                    'data': {},
                    'filter_col_data': {},
                },
            ),
            200,
        )


@api_setting_module_blueprint.route('/proc_config/<proc_id>/columns', methods=['GET'])
def get_proc_column_config(proc_id):
    columns = get_process_columns(proc_id, show_graph=True)
    if columns:
        return (
            jsonify(
                {
                    'status': 200,
                    'data': columns,
                },
            ),
            200,
        )
    else:
        return (
            jsonify(
                {
                    'status': 404,
                    'data': [],
                },
            ),
            200,
        )


@api_setting_module_blueprint.route('/proc_config/<proc_id>/get_ct_range', methods=['GET'])
def get_proc_ct_range(proc_id):
    columns = get_process_columns(proc_id, show_graph=True)
    ct_range = get_ct_range(proc_id, columns)
    return (
        jsonify(
            {
                'status': 200,
                'data': ct_range,
            },
        ),
        200,
    )


@api_setting_module_blueprint.route('/proc_config/<proc_id>/filters', methods=['GET'])
def get_proc_filter_config(proc_id):
    filters = get_process_filters(proc_id)
    if filters:
        return (
            jsonify(
                {
                    'status': 200,
                    'data': filters,
                },
            ),
            200,
        )
    else:
        return jsonify({'status': 404, 'data': []}), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/visualizations', methods=['GET'])
def get_proc_visualization_config(proc_id):
    proc_with_visual_settings = get_process_visualizations(proc_id)
    if proc_with_visual_settings:
        return (
            jsonify(
                {
                    'status': 200,
                    'data': proc_with_visual_settings,
                },
            ),
            200,
        )
    else:
        return jsonify({'status': 404, 'data': []}), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/traces_with/<start_proc_id>', methods=['GET'])
def get_proc_traces_with_start_proc(proc_id, start_proc_id):
    start_proc_id = int(start_proc_id) if str(start_proc_id).isnumeric() else None
    proc_id = int(proc_id) if str(proc_id).isnumeric() else None
    has_traces_with_start_proc = check_path_exist(proc_id, start_proc_id)
    if has_traces_with_start_proc:
        return jsonify(
            {
                'status': 200,
                'data': True,
            },
        )
    else:
        return jsonify({'status': 404, 'data': False})


@api_setting_module_blueprint.route('/filter_config', methods=['POST'])
@login_required
def save_filter_config_configs():
    """[Summary] Save filter_config to DB
    Returns: 200/500
    """
    try:
        params = json.loads(request.data)
        filter_id = save_filter_config(params)

        proc_id = params.get('processId')
        process = get_process_cfg(proc_id)
    except Exception as e:
        logger.exception(e)
        return jsonify({}), 500

    return jsonify({'proc': process, 'filter_id': filter_id}), 200


@api_setting_module_blueprint.route('/filter_config/<filter_id>', methods=['DELETE'])
@login_required
def delete_filter_config(filter_id):
    """[Summary] delete filter_config from DB
    Returns: 200/500
    """
    try:
        delete_cfg_filter_from_db(filter_id)
    except Exception as e:
        logger.exception(e)
        return jsonify({'filter_id': filter_id}), 500

    return jsonify({'filter_id': filter_id}), 200


@api_setting_module_blueprint.route('/distinct_sensor_values/<cfg_col_id>', methods=['GET'])
def get_sensor_distinct_values(cfg_col_id):
    sensor_data = get_last_distinct_sensor_values(cfg_col_id)
    if sensor_data:
        return (
            jsonify(
                {
                    'data': sensor_data,
                },
            ),
            200,
        )
    else:
        return jsonify({'data': []}), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/visualizations', methods=['POST'])
@login_required
def post_master_visualizations_config(proc_id):
    proc = save_master_vis_config(proc_id, request.json)
    if proc is not None:
        data = ProcessVisualizationSchema().dump(proc)
        return jsonify({'status': 200, 'data': data}), 200

    # there is no such proc, this is a bad request
    return jsonify({'status': 404, 'message': f'Non exist process id {proc_id}'}), 404


@api_setting_module_blueprint.route('/simulate_proc_link', methods=['POST'])
@login_required
def simulate_proc_link():
    """[Summary] simulate proc link id
    Returns: 200/500
    """
    traces = json.loads(request.data)
    cfg_traces = [gen_cfg_trace(trace) for trace in traces]

    dic_proc_cnt, dic_edge_cnt = sim_gen_global_id(cfg_traces)

    # if there is no key in dic, set zero
    for cfg_trace in cfg_traces:
        self_proc_id = cfg_trace.self_process_id
        target_proc_id = cfg_trace.target_process_id
        edge_id = f'{self_proc_id}-{target_proc_id}'

        if dic_proc_cnt.get(self_proc_id) is None:
            dic_proc_cnt[self_proc_id] = 0

        if dic_proc_cnt.get(target_proc_id) is None:
            dic_proc_cnt[target_proc_id] = 0

        if dic_edge_cnt.get(edge_id) is None:
            dic_edge_cnt[edge_id] = 0

    return orjson_dumps(nodes=dic_proc_cnt, edges=dic_edge_cnt), 200


@api_setting_module_blueprint.route('/count_proc_link', methods=['POST'])
def count_proc_link():
    """[Summary] count proc link id
    Returns: 200/500
    """
    dic_proc_cnt, dic_edge_cnt = show_proc_link_info()
    return jsonify(nodes=dic_proc_cnt, edges=dic_edge_cnt), 200


@api_setting_module_blueprint.route('/to_eng', methods=['POST'])
def to_eng():
    request_col = request.json
    col_english_name = to_romaji(request_col['colname'])
    return jsonify({'status': 200, 'data': col_english_name}), 200


@api_setting_module_blueprint.route('/list_to_english', methods=['POST'])
def list_to_english():
    request_json = request.json
    raw_english_names = request_json.get('english_names') or []
    romaji_english_names = [to_romaji(raw_name) for raw_name in raw_english_names]

    return jsonify({'status': 200, 'data': romaji_english_names}), 200


@api_setting_module_blueprint.route('/list_normalize_ascii', methods=['POST'])
def list_normalize_ascii():
    request_json = request.json
    raw_input_names = request_json.get('names') or []
    normalized_names = [remove_non_ascii_chars(raw_name) for raw_name in raw_input_names]

    return jsonify({'status': 200, 'data': normalized_names}), 200


@api_setting_module_blueprint.route('/user_setting', methods=['POST'])
@login_required
def save_user_setting():
    """[Summary] Save user settings to DB
    Returns: 200/500
    """
    try:
        data = json.loads(request.data)
        params = data.get('data')
        exclude_columns = data.get('exclude_columns')
        setting = save_user_settings(params, exclude_columns)

        setting = CfgUserSettingSchema().dump(setting)
    except Exception as ex:
        logger.exception(ex)
        return jsonify({'status': 'error'}), 500

    return jsonify({'status': 200, 'data': setting}), 200


@api_setting_module_blueprint.route('/user_settings', methods=['GET'])
def get_user_settings():
    settings = get_all_user_settings()
    return jsonify({'status': 200, 'data': settings}), 200


@api_setting_module_blueprint.route('/user_setting/<setting_id>', methods=['GET'])
def get_user_setting(setting_id):
    setting_id = parse_int_value(setting_id)
    setting = get_setting(setting_id)
    hostname = get_hostname()
    if not setting:
        return jsonify({}), 404

    return jsonify({'status': 200, 'data': setting, 'hostname': hostname}), 200


@api_setting_module_blueprint.route('/user_setting_page_top', methods=['GET'])
def get_user_setting_page_top():
    page = request.args.get('page')
    if not page:
        return jsonify({}), 400

    setting = get_page_top_setting(page) or {}

    return jsonify({'status': 200, 'data': setting}), 200


@api_setting_module_blueprint.route('/user_setting/<setting_id>', methods=['DELETE'])
@login_required
def delete_user_setting(setting_id):
    """[Summary] delete user_setting from DB
    Returns: 200/500
    """
    try:
        setting_id = parse_int_value(setting_id)
        if not setting_id:
            return jsonify({}), 400

        delete_user_setting_by_id(setting_id)

    except Exception as ex:
        logger.exception(ex)
        return jsonify({}), 500

    return jsonify({}), 200


@api_setting_module_blueprint.route('/get_env', methods=['GET'])
def get_current_env():
    current_env = os.environ.get(ANALYSIS_INTERFACE_ENV, AppEnv.PRODUCTION.value)
    return jsonify({'status': 200, 'env': current_env}), 200


@api_setting_module_blueprint.route('/get_fiscal_year_default', methods=['GET'])
def get_fiscal_year():
    fy = os.environ.get('fiscal_year_start_month', FISCAL_YEAR_START_MONTH)
    return jsonify({'status': 200, 'fiscal_year_start_month': fy}), 200


@api_setting_module_blueprint.route('/load_user_setting', methods=['POST'])
def load_user_setting():
    request_data = json.loads(request.data)
    setting_id = request_data.get('setting_id')
    dic_orig_settings = request_data.get('dic_original_setting')
    active_form = request_data.get('active_form')
    shared_setting = request_data.get('shared_user_setting')
    if setting_id:
        setting_id = parse_int_value(setting_id)
        dic_setting = get_setting(setting_id)
        if not dic_setting:
            return jsonify({}), 404

    else:
        dic_setting = {}
        dic_src_settings = {'dataForm': shared_setting}

        dic_des_setting = dic_orig_settings
        if active_form and active_form in dic_orig_settings:
            dic_des_setting = {active_form: dic_orig_settings[active_form]}

        mapping_groups = map_form(dic_src_settings, dic_des_setting)

        dic_setting['settings'] = transform_settings(mapping_groups)

    return jsonify({'status': 200, 'data': dic_setting}), 200


@api_setting_module_blueprint.route('/check_exist_title_setting', methods=['POST'])
def check_exist_title_setting():
    """[Summary] Check input title setting is exist on DB or not
    Returns: status: 200/500 and is_exist: True/False
    """
    try:
        params = json.loads(request.data)
        is_exist = is_title_exist(params.get('title'))
    except Exception as ex:
        logger.exception(ex)
        return jsonify({'status': 'error'}), 500

    return jsonify({'status': 'ok', 'is_exist': is_exist}), 200


@api_setting_module_blueprint.route('/get_autolink_groups', methods=['POST'])
def get_autolink_groups():
    try:
        r = AutolinkInSchema.model_validate_json(request.data)
        groups = Autolink.get_autolink_groups(r.process_ids)
        return jsonify({'status': 'ok', 'groups': groups}), 200
    except Exception as ex:
        logger.exception(ex)
        return jsonify({'status': 'error'}), 500


@api_setting_module_blueprint.route('/get_jobs', methods=['GET'])
def get_jobs():
    offset = request.args.get('offset')
    per_page = request.args.get('limit')
    sort = request.args.get('sort')
    order = request.args.get('order')
    show_past_import_job = request.args.get('show_past_import_job')
    error_page = request.args.get('error_page')
    ignore_job_types = []
    if not show_past_import_job or show_past_import_job == 'false':
        ignore_job_types.append(JobType.FACTORY_PAST_IMPORT.name)

    if offset and per_page:
        offset = int(offset)
        per_page = int(per_page)
        page = offset // per_page + 1
    else:
        page = 1
        per_page = 50

    dic_jobs = {}
    rows, jobs = get_background_jobs_service(page, per_page, sort, order, ignore_job_types, error_page)
    dic_jobs['rows'] = [row.model_dump(by_alias=True) for row in rows]
    dic_jobs['total'] = jobs.total

    return jsonify(dic_jobs), 200


# @api_setting_module_blueprint.route('/browser/<resource_type>', methods=['GET'])
# def open_browser(resource_type):
#     selected_path, path_kind = browse(resource_type)
#     return jsonify({'path': selected_path, 'kind': path_kind}), 200


@api_setting_module_blueprint.route('/check_duplicated_db_source', methods=['POST'])
def check_duplicated_db_source_name():
    dbs_name = json.loads(request.data).get('name', '')
    is_duplicated = CfgDataSource.check_duplicated_name(dbs_name)
    return jsonify({'is_duplicated': is_duplicated}), 200


@api_setting_module_blueprint.route('/check_duplicated_process_name', methods=['POST'])
def check_duplicated_process_name():
    params = json.loads(request.data)
    name_en = params.get('name_en', '')
    name_jp = params.get('name_jp', '')
    name_local = params.get('name_local', '')
    is_duplicated_en, is_duplicated_jp, is_duplicated_local = CfgProcess.check_duplicated_name(
        name_en,
        name_jp,
        name_local,
    )
    return jsonify({'is_duplicated': [is_duplicated_en, is_duplicated_jp, is_duplicated_local]}), 200


@api_setting_module_blueprint.route('/register_source_and_proc', methods=['POST'])
@login_required
def register_source_and_proc():
    try:
        new_process_ids = handle_importing_by_one_click(request.json)

        data_register_data = {
            'RegisterByFileRequestID': request.json.get('RegisterByFileRequestID'),
            'status': JobStatus.PROCESSING.name,
            'is_first_imported': False,
        }
        EventQueue.put(EventBackgroundAnnounce(data=data_register_data, event=AnnounceEvent.DATA_REGISTER))
    except Exception as e:
        logger.exception(e)
        data = {'message': _('Database Setting failed to save'), 'is_error': True, 'detail': str(e)}
        return jsonify(data), 500

    data = {'message': _('Database Setting saved.'), 'is_error': False, 'processIds': new_process_ids}
    return jsonify(data), 200


@api_setting_module_blueprint.route('/redirect_to_page', methods=['POST'])
def redirect_to_page():
    page = request.json.get('page')
    proc_ids = request.json.get('processIds')
    target_url = get_url_to_redirect(request, proc_ids, page)
    return jsonify(url=target_url), 200


@api_setting_module_blueprint.route('/zip_export_database', methods=['GET'])
def zip_export_database():
    """Zip export

    Returns:
        [type] -- [description]
    """
    response = export_data()
    return response


@api_setting_module_blueprint.route('/zip_export_log', methods=['GET'])
def zip_export_log_folder():
    """Zip export log folder

    Returns:
        [type] -- [description]
    """
    start_date = request.args.get('start_date', None)
    end_date = request.args.get('end_date', None)

    archive = create_archive_log_folder(get_log_path(), start_date, end_date)
    return download_zip_file(archive_file=archive)


@api_setting_module_blueprint.route('/zip_export_error', methods=['GET'])
def zip_export_error_folder():
    """Zip export error folder

    Returns:
        [type] -- [description]
    """
    archive = create_archive(get_error_trace_path())
    return download_zip_file(archive_file=archive)


@api_setting_module_blueprint.route('/function_config/sample_data', methods=['POST'])
def equations_sample_data():
    # convert json to EquationSampleData
    equation_sample_data = EquationSampleData.model_validate_json(request.data)
    return orjson_dumps(equation_sample_data.sample_data())


@api_setting_module_blueprint.route('/function_config/get_function_infos', methods=['POST'])
def get_function_infos():
    process_id = json.loads(request.data).get('process_id', None)
    dict_sample_data = json.loads(request.data).get('dic_sample_data', {})
    cfg_process_columns: list[CfgProcessColumn] = CfgProcessColumn.get_by_process_id(process_id)
    dict_cfg_process_column = {cfg_process_column.id: cfg_process_column for cfg_process_column in cfg_process_columns}
    result = []

    # dictionary to store mapping column ids to function column ids
    # since function ids are sorted by order, we will update this when iterating
    # to make sure a function column is used by varX, varY with correct column id and function column id
    seen_function_column_ids = {}

    for function_detail in sorted_function_details(cfg_process_columns):
        process_col: CfgProcessColumn = dict_cfg_process_column[function_detail.process_column_id]
        function_id = function_detail.function_id
        m_function: MFunction = MFunction.get_by_id(function_id)
        var_x = function_detail.var_x
        var_y = function_detail.var_y
        var_x_name = ''
        x_data_type = ''
        var_y_name = ''
        y_data_type = ''
        var_x_data = []
        var_y_data = []
        var_x_function_column_id = None
        var_y_function_column_id = None

        if var_x:
            column_x: CfgProcessColumn = dict_cfg_process_column[var_x]
            var_x_name = column_x.shown_name
            x_data_type = column_x.data_type
            var_x_data = dict_sample_data[str(var_x)]
            if column_x.function_details:
                var_x_function_column_id = seen_function_column_ids.get(var_x)

        if var_y:
            column_y: CfgProcessColumn = dict_cfg_process_column[var_y]
            var_y_name = column_y.shown_name
            y_data_type = column_y.data_type
            var_y_data = dict_sample_data[str(var_y)]
            if column_y.function_details:
                var_y_function_column_id = seen_function_column_ids.get(var_y)

        seen_function_column_ids[function_detail.process_column_id] = function_detail.id

        # TODO: change if Khanh san change EquationSampleData
        equation_sample_data = EquationSampleData(
            equation_id=function_id,
            X=var_x_data,
            x_data_type=x_data_type,
            Y=var_y_data,
            y_data_type=y_data_type,
            **function_detail.as_dict(),
        )
        sample_data = equation_sample_data.sample_data()
        sample_datas = sample_data.sample_data
        output_type = sample_data.output_type
        # update data type
        process_col.data_type = output_type
        dict_sample_data[str(process_col.id)] = sample_datas
        function_info = {
            'functionName': m_function.function_type,
            'output': function_detail.return_type,
            'isMainSerialNo': False if m_function.is_me_function else process_col.is_serial_no,
            'isMainDatetime': False if m_function.is_me_function else process_col.is_get_date,
            'systemName': process_col.name_en,
            'japaneseName': process_col.name_jp,
            'localName': process_col.name_local,
            'varXName': var_x_name,
            'varYName': var_y_name,
            'a': function_detail.a,
            'b': function_detail.b,
            'c': function_detail.c,
            'n': function_detail.n,
            'k': function_detail.k,
            's': function_detail.s,
            't': function_detail.t,
            'note': function_detail.note,
            'sampleDatas': sample_datas,
            'isChecked': False,
            'processColumnId': process_col.id,
            'functionColumnId': function_detail.id,
            'functionId': function_id,
            'varX': {
                'processColumnId': var_x,
                'functionColumnId': var_x_function_column_id,
            },
            'varY': {
                'processColumnId': var_y,
                'functionColumnId': var_y_function_column_id,
            },
            'index': function_detail.order,
        }
        result.append(function_info)

    result = sorted(result, key=lambda k: k['index'])
    return orjson_dumps({'functionData': result})


@api_setting_module_blueprint.route('/function_config/delete_function_columns', methods=['POST'])
@login_required
def delete_function_column_config():
    """[Summary] delete function column from DB
    Returns: 200/500
    """
    data = json.loads(request.data)
    column_ids = data.get('column_ids', [])
    function_column_ids = data.get('function_column_ids', [])
    try:
        with make_session() as session:
            CfgProcessColumn.delete_by_ids(column_ids, session=session)
            CfgProcessFunctionColumn.delete_by_ids(function_column_ids, session=session)
    except Exception as e:
        logger.exception(e)
        return json_dumps({}), 500

    return json_dumps({}), 200


@api_setting_module_blueprint.route('/backup_data', methods=['POST'])
def backup_data():
    """[Summary] backup data from DB
    Returns: 200/500
    """
    data = json.loads(request.data)
    process_id = data.get('process_id')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    if process_id:
        target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT, JobType.FACTORY_PAST_IMPORT]
        EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=process_id))
    add_backup_data_job(process_id, start_time, end_time)
    return json_dumps({}), 200


@api_setting_module_blueprint.route('/restore_data', methods=['POST'])
def restore_data():
    """[Summary] restore data from file
    Returns: 200/500
    """
    data = json.loads(request.data)
    process_id = data.get('process_id')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    if process_id:
        target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT, JobType.FACTORY_PAST_IMPORT]
        EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=process_id))
    add_restore_data_job(process_id, start_time, end_time)
    return json_dumps({}), 200


@api_setting_module_blueprint.route('/delete_log_data', methods=['DELETE'])
@login_required
def delete_log_data():
    log_path = get_log_path()
    delete_file_and_folder_by_path(log_path)
    return {}, 200


@api_setting_module_blueprint.route('/delete_folder_data', methods=['DELETE'])
@login_required
def delete_folder_data_api():
    delete_folder_data(ignore_folder=DATA_CACHE_FOLDER)
    return {}, 200


@api_setting_module_blueprint.route('/clear_cache', methods=['POST'])
@login_required
def clear_cache_api():
    """[Summary] delete cache in backend, only used for test"""
    clear_cache()
    return json_dumps({}), 200


@api_setting_module_blueprint.route('/datetime_format', methods=['POST'])
def format_datetime_data():
    format_col = 'format_col'
    data = json.loads(request.data)
    format_values = data.get('data', [])
    data_type = data.get('dataType', '')
    is_generated_datetime_col = data.get('isGeneratedDatetime', None)
    datetime_format = data.get('format', '')
    if is_generated_datetime_col:
        datetime_format = f'{SQLiteFormatStrings.DATE.value} {SQLiteFormatStrings.TIME.value}'
    client_timezone = data.get('clientTimezone', '')
    dic_data_type = {
        format_col: data_type,
    }
    df = pd.DataFrame(columns=[format_col], data=format_values)
    df = convert_datetime_format(df, dic_data_type, datetime_format, client_timezone)
    return orjson_dumps(df[format_col].tolist())


@api_setting_module_blueprint.route('/formula_validate', methods=['POST'])
def formula_validate():
    data = json.loads(request.data)
    formula: str = data.get('formula', EMPTY_STRING)
    col_type: int | None = data.get('col_type', None)
    data_type: str | None = data.get('data_type', None)
    is_registered: bool = data.get('is_registered', False)
    formula_type = gen_formula_type(col_type, data_type)
    match formula_type:
        case FormulaType.JUDGE:
            judge_formula = JudgeFormula.from_formula(formula)
            is_valid = judge_formula is not None
            if is_registered and is_valid:
                column_id = data.get('column_id')
                is_valid = CfgProcessColumn.validate_registered_formula(new_formula=judge_formula, column_id=column_id)
                return orjson_dumps(
                    {'is_valid': is_valid, 'msg': _('InvalidInputImportedJudgeMsg') if not is_valid else ''}
                )
            # Formula for judge must be parsed correctly
            return orjson_dumps({'is_valid': is_valid, 'msg': _('InvalidInputFormulaMsg') if not is_valid else ''})
        case FormulaType.DATETIME | FormulaType.DATE | FormulaType.TIME:
            # User can input whatever they want in datetime / date / time
            return orjson_dumps({'is_valid': True, 'msg': ''})
        case None:
            # Only rows have formula can be input => None must be invalid
            return orjson_dumps({'is_valid': False, 'msg': _('InvalidInputFormulaMsg')})
        case _:
            raise NotImplementedError('Unknown formula type')


@api_setting_module_blueprint.route('/formula_convert', methods=['POST'])
def formula_convert():
    data = json.loads(request.data)
    values: list[Any] = data.get('data', [])
    formula: str = data.get('formula', EMPTY_STRING)
    is_sample_data = data.get('is_sample_data', None)
    display_mode = data.get('display_mode', None)
    col_type: int | None = data.get('col_type', None)
    data_type: str | None = data.get('data_type', None)
    conversion = conversion_formula(formula=formula, data_type=data_type, col_type=col_type)
    # TODO: if show_latest_record is refactored to properly return null values,
    #  conversion from empty string to nan is no longer needed
    #  https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/174
    formatted_series = pd.Series(values, dtype=pd.StringDtype()).replace(EMPTY_STRING, np.nan)
    if conversion is None:
        return orjson_dumps({'data': []})

    formatted_series = conversion.convert(formatted_series)
    if is_sample_data:
        formatted_series = conversion.revert(formatted_series)
    if display_mode == SampleDataDisplayMode.UNIQUE.value:
        formatted_series = formatted_series.unique()
    return orjson_dumps({'data': formatted_series})


@api_setting_module_blueprint.route('/proc_link_preview', methods=['POST'])
def proc_link_preview():
    data = json.loads(request.data)
    process_id = data.get('process_id', None)

    try:
        samples = []
        if process_id:
            # get_sample_transaction
            trans_data = TransactionData(process_id)
            with TxnDataConnection(process_id=process_id, readonly_transaction=True) as data_con:
                link_cols = trans_data.cfg_process.get_linking_columns()
                samples = trans_data.get_sample_data(data_con, columns=link_cols)
                samples = get_first_valid_value_for_proc_link_preview(samples)
                if samples.empty:
                    # get data from preview_data of process
                    etl_func = trans_data.cfg_process.etl_func
                    file_name = get_preview_data_files(
                        trans_data.cfg_process.data_source_id, etl_func=etl_func, process_id=process_id
                    )
                    if file_name:
                        with open(file_name, encoding='utf-8') as file:
                            samples = get_latest_record_from_preview_file(file, process_id)
                            samples = get_sample_from_preview_data(samples, link_cols).replace('', pd.NA)
                            samples = get_first_valid_value_for_proc_link_preview(samples)

                # after get data from transaction and preview file, if samples is empty => return None for all column
                if samples.empty:
                    samples = pd.DataFrame([[None] * len(samples.columns)], columns=samples.columns)
                else:
                    samples = samples.iloc[:1].to_dict(orient='records')[0]
        return orjson_dumps({'process_id': process_id, 'data': samples})
    except ValueError:
        pass


@api_setting_module_blueprint.route('/zip_import_database', methods=['POST'])
def zip_import_database():
    """Zip import

    Returns:
        [type] -- [description]
    """
    # clear running jobs, events and pause scheduler
    pause_job_running()
    wait_done_jobs()
    pause_event_queue()
    close_sessions()
    clear_cache()
    try:
        # remove all pulled data
        delete_pulled_data_folders(CfgProcess.get_all_ids())

        # Backup current config before importing data from upload file
        backup_instance_folder()
        # ↓--- Save uploaded file to export_setting folder ---↓
        file = request.files['file']
        file_path = os.path.join(get_export_setting_path(), file.filename)
        dirname = get_export_setting_path()
        Path(dirname).mkdir(parents=True, exist_ok=True)
        file.save(file_path)
        # ↑--- Save uploaded file to export_setting folder ---↑

        # ↓--- import data from upload file ---↓
        import_config_and_master(file_path)
        # ↑--- import data from upload file ---↑

        # ↓--- Resume scheduler, migrate and clean up ---↓
        flask_migrate.upgrade()
        scheduler.resume()
        clear_event_queue()
        resume_event_queue()
        make_dir(dic_config[UNIVERSAL_DB_FILE])

        CfgConstant.initialize_disk_usage_limit()
        CfgConstant.initialize_max_graph_constants()

        for key, value in max_graph_config.items():
            max_graph_config[key] = CfgConstant.get_value_by_type_first(key, int)

        add_idle_monitoring_job()

        change_polling_all_interval_jobs(run_now=True)

        proc_link_count_job(is_user_request=True)
        add_job_delete_expired_request()

        cleanup_backup_data()
        response = {'status': 200, 'page': 'config?#data_source'}
        return json_dumps(response), 200
        # ↑--- Resume scheduler and clean up ---↑

    except Exception as e:
        logger.exception(e)
        revert_instance_folder()
        scheduler.resume()
        resume_event_queue()

        return json_dumps({'status': 500, 'page': 'config?#data_source'}), 500


@api_setting_module_blueprint.route('/reset_transaction_data', methods=['DELETE'])
@login_required
def reset_transaction_data():
    pause_job_running(remove_scheduler_jobs=False)
    wait_done_jobs()
    pause_event_queue()

    http_status = 200
    data = {}
    try:
        # reset transaction
        clear_db_n_data()
        # reset_is_show_file_name()
        clear_cache()
        # remove all pulled data
        delete_pulled_data_folders(CfgProcess.get_all_ids())
        logger.debug('Done "TRANSACTION_CLEAN"')

        data = {'message': _('Transaction data is deleted.'), 'is_error': False}
    except Exception as e:
        logger.exception(e)
        data = {'message': _('Transaction data is deleted.'), 'is_error': True}
        http_status = 500

    scheduler.resume()
    resume_event_queue()
    EventQueue.put(EventBackgroundAnnounce(data=data, event=AnnounceEvent.CLEAR_TRANSACTION_DATA))
    return {}, http_status


@api_setting_module_blueprint.route('/import_filters/<process_id>', methods=['GET'])
def get_import_filter_from_process(process_id):
    process = CfgProcess.get_proc_by_id(process_id)
    if process:
        import_filters = get_import_filters_from_process(process)
        return orjson_dumps(data=import_filters), 200

    return {}, 404


@api_setting_module_blueprint.route('/preview_software_workshop', methods=['POST'])
def preview_software_workshop():
    params = DbConnectionParam.model_validate(json.loads(request.data).get('db'))
    connection_result = None
    try:
        connection_result = check_db_con(params)
    except Exception as e:
        logger.exception(e)

    if connection_result:
        message = {'db_type': params.db_type, 'message': _('Connected'), 'connected': True}
    else:
        message = {'db_type': params.db_type, 'message': _('Failed to connect'), 'connected': False}
        return jsonify(db_info=[], flask_message=message), 200

    output = get_line_grp_info(params)
    # list all registered processes (all status)
    processes = CfgProcess.get_by_data_source_id(params.id) if params.id else []
    output['processes'] = processes
    return orjson_dumps(db_info=output, flask_message=message), 200


@api_setting_module_blueprint.route('/update_import_limit', methods=['POST'])
def update_import_limit():
    data_update = json.loads(request.data)
    import_limit = parse_int_value(data_update.get(CfgConstantType.IMPORT_LIMIT.name)) or DEFAULT_IMPORT_LIMIT
    origin_limit = CfgConstant.get_names_values_by_type(const_type=CfgConstantType.IMPORT_LIMIT.name)
    origin_limit = DEFAULT_IMPORT_LIMIT if not origin_limit else parse_int_value(origin_limit.value)
    is_increase = import_limit == 0 or (origin_limit != 0 and origin_limit < import_limit)
    CfgConstant.create_or_update_by_type(const_type=CfgConstantType.IMPORT_LIMIT.name, const_value=import_limit)
    add_delete_transaction_data_job(run_now=True, is_increase=is_increase)
    return {}, 200


@api_setting_module_blueprint.route('/export_config', methods=['POST'])
def post_export_config():
    try:
        export_config: CfgExport = ExportConfigSchema().loads(request.data)
        export_config.updated_at = get_current_timestamp()
        with make_session() as session:
            export_config = session.merge(export_config)
        add_export_job(export_config)
    except Exception as e:
        logger.exception(e)
        message = {'message': f'Export setting failed to save. Reason: {e}', 'is_error': True}
        return jsonify(flask_message=message), 500

    message = {'message': _('Export setting saved.'), 'is_error': False}
    config_data = ExportConfigSchema().dumps(export_config)
    return jsonify(export_config=config_data, flask_message=message), 200


@api_setting_module_blueprint.route('/export_config', methods=['GET'])
def get_export_config():
    try:
        export_configs: list[CfgExport] = CfgExport.get_all()
        config_data = [ExportConfigSchema().dumps(export_config) for export_config in export_configs]
    except Exception as e:
        logger.exception(e)
        message = {'message': f'Export setting failed to save. Reason: {e}', 'is_error': True}
        return jsonify(flask_message=message), 500

    message = {'message': _('Get setting successfully.'), 'is_error': False}
    return jsonify(export_configs=config_data, flask_message=message), 200


@api_setting_module_blueprint.route('/export_config/<export_config_id>', methods=['DELETE'])
def delete_export_config(export_config_id):
    config_id = int(export_config_id) or None
    cfg_export: CfgExport = CfgExport.get_by_id(config_id)
    EventQueue.put(
        EventRemoveJobs(
            job_types=JobType.jobs_include_export_id(), process_id=cfg_export.process_id, export_id=cfg_export.id
        )
    )
    try:
        with make_session() as meta_session:
            CfgExport.delete_by_id(meta_session, config_id)
    except Exception as e:
        logger.exception(e)
        return jsonify({}), 500
    return jsonify({}), 200


@api_setting_module_blueprint.route('/check_folder_path', methods=['POST'])
def check_export_folder_path():
    try:
        params = json.loads(request.data)
        folder_path = params.get('folder_path')
        if not folder_path:
            is_valid = False
            message = _('Folder path is required.')
        elif not os.path.exists(folder_path):
            is_valid = False
            message = _('Folder path does not exist.')
        else:
            # Create a temporary file in the given folder
            with tempfile.TemporaryFile(dir=folder_path):
                pass
            is_valid = True
            message = None
    except (PermissionError, OSError) as e:
        is_valid = False
        message = str(e)

    return jsonify({'is_valid': is_valid, 'message': message}), 200


@api_setting_module_blueprint.route('/labels', methods=['GET'])
def all_labels():
    labels = CfgLabel.query.all()
    return LabelSchema(many=True).dump(labels)


@api_setting_module_blueprint.route('/labels_in_use', methods=['GET'])
def get_labels_in_use():
    labels = CfgLabel.query.filter(CfgLabel.processes.any()).all()
    return LabelSchema(many=True).dump(labels)


@api_setting_module_blueprint.route('/labels/<int:label_id>', methods=['DELETE'])
def delete_label(label_id: int):
    with make_session() as session:
        deleted = CfgLabel.delete_by_id(label_id, session)
    if not deleted:
        return {'error': 'No existed label'}, 404
    return {'id': label_id}, 200


@api_setting_module_blueprint.route('/labels/process/<int:process_id>', methods=['GET'])
def process_label(process_id: int):
    process = CfgProcess.get_proc_by_id(process_id)
    labels = process.labels if process else []
    return LabelSchema(many=True).dump(labels)
