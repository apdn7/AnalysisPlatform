import json
import os
import traceback

import flask
from flask import Blueprint, Response, jsonify, request
from flask_babel import gettext as _

from ap import background_jobs, dic_config
from ap.api.common.services.show_graph_services import check_path_exist
from ap.api.setting_module.services.autolink import SortMethod, get_processes_id_order
from ap.api.setting_module.services.common import (
    delete_user_setting_by_id,
    get_all_user_settings,
    get_page_top_setting,
    get_setting,
    is_local_client,
    is_title_exist,
    save_user_settings,
)
from ap.api.setting_module.services.data_import import (
    check_db_con,
    update_or_create_constant_by_type,
)
from ap.api.setting_module.services.filter_settings import (
    delete_cfg_filter_from_db,
    save_filter_config,
)
from ap.api.setting_module.services.polling_frequency import (
    add_import_job,
    change_polling_all_interval_jobs,
)
from ap.api.setting_module.services.process_delete import (
    del_data_source,
    delete_proc_cfg_and_relate_jobs,
)
from ap.api.setting_module.services.save_load_user_setting import map_form, transform_settings
from ap.api.setting_module.services.show_latest_record import (
    gen_preview_data_check_dict,
    gen_v2_columns_with_types,
    get_last_distinct_sensor_values,
    get_latest_records,
    preview_csv_data,
    preview_v2_data,
    save_master_vis_config,
)
from ap.api.setting_module.services.shutdown_app import shut_down_app
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job, add_restructure_indexes_job, show_proc_link_info
from ap.api.trace_data.services.proc_link_simulation import sim_gen_global_id
from ap.common.backup_db import backup_config_db
from ap.common.common_utils import (
    add_seconds,
    get_files,
    get_hostname,
    is_empty,
    parse_int_value,
    remove_non_ascii_chars,
)
from ap.common.constants import (
    ANALYSIS_INTERFACE_ENV,
    FISCAL_YEAR_START_MONTH,
    OSERR,
    SHUTDOWN,
    UI_ORDER_DB,
    WITH_IMPORT_OPTIONS,
    Action,
    AppEnv,
    CfgConstantType,
    CSVExtTypes,
    DataColumnType,
    JobStatus,
    JobType,
    ProcessCfgConst,
    RelationShip,
)
from ap.common.cryptography_utils import encrypt
from ap.common.logger import logger
from ap.common.scheduler import lock
from ap.common.services.http_content import json_dumps
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.sse import AnnounceEvent, background_announcer
from ap.setting_module.models import (
    AppLog,
    CfgCsvColumn,
    CfgDataSource,
    CfgDataSourceCSV,
    CfgProcess,
    CfgUserSetting,
    crud_config,
    insert_or_update_config,
    make_session,
)
from ap.setting_module.schemas import CfgUserSettingSchema, DataSourceSchema, ProcessSchema
from ap.setting_module.services.background_process import get_background_jobs_service, get_job_detail_service
from ap.setting_module.services.process_config import (
    create_or_update_process_cfg,
    get_ct_range,
    get_process_cfg,
    get_process_columns,
    get_process_filters,
    get_process_visualizations,
    query_database_tables,
)
from ap.setting_module.services.register_from_file import get_chm_url_to_redirect
from ap.setting_module.services.trace_config import (
    gen_cfg_trace,
    get_all_processes_traces_info,
    trace_config_crud,
)

api_setting_module_blueprint = Blueprint('api_setting_module', __name__, url_prefix='/ap/api/setting')


@api_setting_module_blueprint.route('/update_polling_freq', methods=['POST'])
def update_polling_freq():
    data_update = json.loads(request.data)
    with_import_option = data_update.get(WITH_IMPORT_OPTIONS)
    freq_min = parse_int_value(data_update.get(CfgConstantType.POLLING_FREQUENCY.name)) or 0

    # save/update POLLING_FREQUENCY to db
    freq_sec = freq_min * 60
    update_or_create_constant_by_type(const_type=CfgConstantType.POLLING_FREQUENCY.name, value=freq_sec)

    is_user_request = bool(with_import_option and freq_min == 0)
    # re-set trigger time for all jobs
    change_polling_all_interval_jobs(interval_sec=freq_sec, run_now=with_import_option, is_user_request=is_user_request)

    message = {'message': _('Database Setting saved.'), 'is_error': False}

    return jsonify(flask_message=message), 200


@api_setting_module_blueprint.route('/data_source_save', methods=['POST'])
def save_datasource_cfg():
    """
    Expected: ds_config = {"db_0001": {"master-name": name, "host": localhost, ...}}
    """
    try:
        data_src: CfgDataSource = DataSourceSchema().load(request.json)

        with make_session() as meta_session:
            # data source
            data_src_rec = insert_or_update_config(meta_session, data_src, exclude_columns=[CfgDataSource.order.key])

            # csv detail
            csv_detail = data_src.csv_detail
            if csv_detail:
                # csv_detail.dummy_header = csv_detail.dummy_header == 'true' if csv_detail.dummy_header else None
                csv_columns = data_src.csv_detail.csv_columns
                csv_columns = [col for col in csv_columns if not is_empty(col.column_name)]
                data_src.csv_detail.csv_columns = csv_columns
                csv_detail_rec = insert_or_update_config(
                    meta_session,
                    csv_detail,
                    parent_obj=data_src_rec,
                    parent_relation_key=CfgDataSource.csv_detail.key,
                    parent_relation_type=RelationShip.ONE,
                )

                # CRUD
                csv_columns = csv_detail.csv_columns
                crud_config(
                    meta_session,
                    csv_columns,
                    CfgCsvColumn.data_source_id.key,
                    CfgCsvColumn.column_name.key,
                    parent_obj=csv_detail_rec,
                    parent_relation_key=CfgDataSourceCSV.csv_columns.key,
                    parent_relation_type=RelationShip.MANY,
                )

            # db detail
            db_detail = data_src.db_detail
            if db_detail:
                # encrypt password
                db_detail.password = encrypt(db_detail.password)
                db_detail.hashed = True
                # avoid blank string
                db_detail.port = db_detail.port or None
                db_detail.schema = db_detail.schema or None
                insert_or_update_config(
                    meta_session,
                    db_detail,
                    parent_obj=data_src_rec,
                    parent_relation_key=CfgDataSource.db_detail.key,
                    parent_relation_type=RelationShip.ONE,
                )
    except Exception as e:
        logger.exception(e)
        message = {'message': _('Database Setting failed to save'), 'is_error': True}
        return jsonify(flask_message=message), 500

    message = {'message': _('Database Setting saved.'), 'is_error': False}
    ds = None
    if data_src_rec and data_src_rec.id:
        ds_schema = DataSourceSchema()
        ds = CfgDataSource.get_ds(data_src_rec.id)
        ds = ds_schema.dumps(ds)
    return jsonify(id=data_src_rec.id, data_source=ds, flask_message=message), 200


@api_setting_module_blueprint.route('/v2_data_source_save', methods=['POST'])
def save_v2_datasource_cfg():
    """
    Expected: ds_config = [{"db_0001": {"master-name": name, "host": localhost, ...}}]
    """
    try:
        datasources = request.json
        v2_datasources = []
        for v2_data_src in datasources:
            v2_columns = gen_v2_columns_with_types(v2_data_src)
            # update data_source columns
            v2_data_src['csv_detail']['csv_columns'] = v2_columns
            v2_data_src['csv_detail']['dummy_header'] = False

            data_src: CfgDataSource = DataSourceSchema().load(v2_data_src)

            with make_session() as meta_session:
                # data source
                data_src_rec = insert_or_update_config(
                    meta_session,
                    data_src,
                    exclude_columns=[CfgDataSource.order.key],
                )

                # csv detail
                csv_detail = data_src.csv_detail
                if csv_detail:
                    csv_columns = data_src.csv_detail.csv_columns
                    csv_columns = [col for col in csv_columns if not is_empty(col.column_name)]
                    data_src.csv_detail.csv_columns = csv_columns
                    csv_detail_rec = insert_or_update_config(
                        meta_session,
                        csv_detail,
                        parent_obj=data_src_rec,
                        parent_relation_key=CfgDataSource.csv_detail.key,
                        parent_relation_type=RelationShip.ONE,
                    )

                    # CRUD
                    csv_columns = csv_detail.csv_columns
                    crud_config(
                        meta_session,
                        csv_columns,
                        CfgCsvColumn.data_source_id.key,
                        CfgCsvColumn.column_name.key,
                        parent_obj=csv_detail_rec,
                        parent_relation_key=CfgDataSourceCSV.csv_columns.key,
                        parent_relation_type=RelationShip.MANY,
                    )

            if data_src_rec and data_src_rec.id:
                ds_schema = DataSourceSchema()
                ds = CfgDataSource.get_ds(data_src_rec.id)
                ds = ds_schema.dumps(ds)
                v2_datasources.append({'id': data_src_rec.id, 'data_source': ds})

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
    ds_schema = DataSourceSchema(many=True)
    dump_data = ds_schema.dumps(db_tables)
    list_ds = json.loads(dump_data)
    for ds in list_ds:
        ds['en_name'] = to_romaji(ds['name'])
    dump_data = json_dumps(list_ds)
    return dump_data, 200 if db_tables else 500


@api_setting_module_blueprint.route('/database_tables_source', methods=['GET'])
def get_database_tables_source():
    db_source = CfgDataSource.get_all_db_source()
    ds_schema = DataSourceSchema(many=True)
    dump_data = ds_schema.dumps(db_source)
    return dump_data, 200 if db_source else 500


@api_setting_module_blueprint.route('/database_table/<db_id>', methods=['GET'])
def get_database_table(db_id):
    if not db_id:
        return jsonify({'tables': [], 'msg': 'Invalid data source id'}), 400

    tables = query_database_tables(db_id)

    if tables is None:
        return jsonify({'tables': [], 'msg': 'Invalid data source id'}), 400
    else:
        return jsonify(tables), 200


@api_setting_module_blueprint.route('/check_db_connection', methods=['POST'])
def check_db_connection():
    """Check if we can connect to database. Supported databases: SQLite, PostgreSQL, MSSQLServer.
    Returns:
        HTTP Response - (True + OK message) if connection can be established, return (False + NOT OK message) otherwise.
    """
    params = json.loads(request.data).get('db')
    db_type = params.get('db_type')
    host = params.get('host')
    port = params.get('port')
    dbname = params.get('dbname')
    schema = params.get('schema')
    username = params.get('username')
    password = params.get('password')

    result = None
    try:
        result = check_db_con(db_type, host, port, dbname, schema, username, password)
    except Exception as e:
        logger.exception(e)

    if result:
        message = {'db_type': db_type, 'message': _('Connected'), 'connected': True}
    else:
        message = {'db_type': db_type, 'message': _('Failed to connect'), 'connected': False}

    return jsonify(flask_message=message), 200


@api_setting_module_blueprint.route('/show_latest_records', methods=['POST'])
def show_latest_records():
    """[summary]
    Show 5 latest records
    Returns:
        [type] -- [description]
    """
    dic_form = request.form.to_dict()
    data_source_id = dic_form.get('databaseName') or dic_form.get('processDsID')
    table_name = dic_form.get('tableName') or None
    file_name = dic_form.get('fileName') or None
    limit = parse_int_value(dic_form.get('limit')) or 10
    folder = dic_form.get('folder') or None
    latest_rec = get_latest_records(data_source_id, table_name, file_name, folder, limit)

    result = {
        'cols': [],
        'rows': [],
        'cols_duplicated': [],
        'fail_limit': None,
        'has_ct_col': None,
        'dummy_datetime_idx': None,
        'is_rdb': False,
    }
    if latest_rec:
        (
            cols_with_types,
            rows,
            cols_duplicated,
            previewed_files,
            has_ct_col,
            dummy_datetime_idx,
            is_rdb,
        ) = latest_rec
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
        }

    return json_dumps(result)


@api_setting_module_blueprint.route('/get_csv_resources', methods=['POST'])
def get_csv_resources():
    folder_url = request.json.get('url')
    etl_func = request.json.get('etl_func')
    csv_delimiter = request.json.get('delimiter')
    isV2_datasource = request.json.get('isV2')
    line_skip = request.json.get('line_skip') or ''

    if isV2_datasource:
        dic_output = preview_v2_data(folder_url, csv_delimiter, 5)
    else:
        dic_output = preview_csv_data(folder_url, etl_func, csv_delimiter, line_skip=line_skip, limit=5)
    rows = dic_output['content']
    previewed_files = dic_output['previewed_files']
    dic_preview_limit = gen_preview_data_check_dict(rows, previewed_files)
    dic_output['fail_limit'] = dic_preview_limit

    return jsonify(dic_output), 200


@api_setting_module_blueprint.route('/job', methods=['POST'])
def get_background_jobs():
    return jsonify(background_jobs), 200


@api_setting_module_blueprint.route('/listen_background_job/<is_force>/<uuid>/<main_tab_uuid>', methods=['GET'])
def listen_background_job(is_force: str, uuid: str, main_tab_uuid: str):
    is_reject = False
    is_force = int(is_force)
    compare_time = add_seconds(seconds=-background_announcer.FORCE_SECOND)
    with lock:
        start_time = None
        if background_announcer.is_exist(uuid):
            if is_force:
                start_time = background_announcer.get_start_date(uuid)
                if start_time >= compare_time:
                    is_reject = True
            elif not background_announcer.is_exist(uuid, main_tab_uuid=main_tab_uuid):
                is_reject = True

        logger.debug(
            f'[SSE] {"Rejected" if is_reject else "Accepted"}: UUID = {uuid}; main_tab_uuid = {main_tab_uuid};'
            f' is_force = {is_force}; compare_time = {compare_time}; start_time = {start_time};',
        )

        if is_reject:
            return Response('SSE Rejected', status=202)

        return Response(
            background_announcer.init_stream_sse(uuid, main_tab_uuid),
            mimetype='text/event-stream',
        )


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
            is_not_empty = True

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


@api_setting_module_blueprint.route('/job_detail/<job_id>', methods=['GET'])
def get_job_detail(job_id):
    """[Summary] Get get job details
    Returns:
        [json] -- [job details content]
    """
    job_details = get_job_detail_service(job_id=job_id)
    return jsonify(job_details), 200


@api_setting_module_blueprint.route('/delete_process', methods=['POST'])
def delete_proc_from_db():
    # get proc_id
    params = json.loads(request.data)
    proc_id = params.get('proc_id')
    proc_id = int(proc_id) or None

    # delete config and add job to delete data
    delete_proc_cfg_and_relate_jobs(proc_id)

    return jsonify(result={}), 200


@api_setting_module_blueprint.route('/save_order/<order_name>', methods=['POST'])
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

    except Exception:
        traceback.print_exc()
        return jsonify({}), 500

    return jsonify({}), 200


@api_setting_module_blueprint.route('/delete_datasource_cfg', methods=['POST'])
def delete_datasource_cfg():
    params = json.loads(request.data)
    data_source_id = params.get('db_code')
    if data_source_id:
        del_data_source(data_source_id)

    return jsonify(id=data_source_id), 200


@api_setting_module_blueprint.route('/stop_job', methods=['POST'])
def stop_jobs():
    try:
        if not is_local_client(request):
            return jsonify({}), 403

        # save log to db
        with make_session() as meta_session:
            t_app_log = AppLog()
            t_app_log.ip = request.environ.get('X-Forwarded-For') or request.remote_addr
            t_app_log.action = Action.SHUTDOWN_APP.name
            t_app_log.description = request.user_agent.string
            meta_session.add(t_app_log)

        # backup database now
        # add_backup_dbs_job(True)
        backup_config_db()
    except Exception as ex:
        traceback.print_exc()
        logger.error(ex)

    # add a job to check for shutdown time
    # add_shutdown_app_job()
    shut_down_app()

    return jsonify({}), 200


@api_setting_module_blueprint.route('/shutdown', methods=['POST'])
def shutdown():
    dic_config[SHUTDOWN] = True
    response = flask.make_response(jsonify({}))
    response.set_cookie('locale', '', 0)
    return response, 200


@api_setting_module_blueprint.route('/proc_config', methods=['POST'])
def post_proc_config():
    process_schema = ProcessSchema()
    proc_data = process_schema.load(request.json.get('proc_config'))
    unused_columns = request.json.get('unused_columns', [])
    should_import_data = request.json.get('import_data')

    try:
        # get exists process from id
        proc_id = proc_data.get(ProcessCfgConst.PROC_ID.value)
        if proc_id:
            process = get_process_cfg(int(proc_id))
            if not process:
                return (
                    jsonify(
                        {
                            'status': 404,
                            'message': 'Not found {}'.format(proc_id),
                        },
                    ),
                    200,
                )

        process = create_or_update_process_cfg(proc_data, unused_columns)

        # create process json
        process_schema = ProcessSchema()
        process_json = process_schema.dump(process) or {}

        # import data
        if should_import_data:
            add_import_job(process, run_now=True, is_user_request=True)

        return (
            jsonify(
                {
                    'status': 200,
                    'data': process_json,
                },
            ),
            200,
        )
    except Exception as ex:
        traceback.print_exc()
        return (
            jsonify(
                {
                    'status': 500,
                    'message': str(ex),
                },
            ),
            500,
        )


@api_setting_module_blueprint.route('/trace_config', methods=['GET'])
def get_trace_configs():
    """[Summary] Save orders to DB
    Returns: 200/500
    """
    try:
        procs = get_all_processes_traces_info()
        # generate english name for process
        for proc_data in procs:
            if not proc_data['name_en']:
                proc_data['name_en'] = to_romaji(proc_data['name'])
        return {'trace_config': json_dumps({'procs': procs})}, 200
    except Exception:
        traceback.print_exc()
        return jsonify({}), 500


@api_setting_module_blueprint.route('/trace_config', methods=['POST'])
def save_trace_configs():
    """[Summary] Save trace_configs to DB
    Returns: 200/500
    """

    try:
        traces = json.loads(request.data)
        trace_config_crud(traces)
        add_restructure_indexes_job()
        add_gen_proc_link_job(is_user_request=True)
    except Exception:
        traceback.print_exc()
        return json_dumps({}), 500

    return json_dumps({}), 200


@api_setting_module_blueprint.route('/ds_load_detail/<ds_id>', methods=['GET'])
def ds_load_detail(ds_id):
    ds_schema = DataSourceSchema()
    ds = CfgDataSource.get_ds(ds_id)
    return ds_schema.dumps(ds), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>', methods=['DELETE'])
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
    if process:
        tables = query_database_tables(process['data_source_id'])
        return jsonify({'status': 200, 'data': process, 'tables': tables}), 200
    else:
        return jsonify({'status': 404, 'data': 'Not found'}), 200


@api_setting_module_blueprint.route('/proc_filter_config/<proc_id>', methods=['GET'])
def get_proc_config_filter_data(proc_id):
    process = get_process_cfg(proc_id)
    # filter_col_data = get_filter_col_data(process) or {}
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
                },
            ),
            200,
        )


@api_setting_module_blueprint.route('/proc_config/<proc_id>/columns', methods=['GET'])
def get_proc_column_config(proc_id):
    columns = get_process_columns(proc_id)
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
    columns = get_process_columns(proc_id)
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
def save_filter_config_configs():
    """[Summary] Save filter_config to DB
    Returns: 200/500
    """
    try:
        params = json.loads(request.data)
        filter_id = save_filter_config(params)

        proc_id = params.get('processId')
        process = get_process_cfg(proc_id)
    except Exception:
        traceback.print_exc()
        return jsonify({}), 500

    return jsonify({'proc': process, 'filter_id': filter_id}), 200


@api_setting_module_blueprint.route('/filter_config/<filter_id>', methods=['DELETE'])
def delete_filter_config(filter_id):
    """[Summary] delete filter_config from DB
    Returns: 200/500
    """
    try:
        delete_cfg_filter_from_db(filter_id)
    except Exception:
        traceback.print_exc()
        return jsonify({}), 500

    return jsonify({}), 200


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
def post_master_visualizations_config(proc_id):
    try:
        save_master_vis_config(proc_id, request.json)
        proc_with_visual_settings = get_process_visualizations(proc_id)
        return (
            jsonify(
                {
                    'status': 200,
                    'data': proc_with_visual_settings,
                },
            ),
            200,
        )
    except Exception as ex:
        traceback.print_exc()
        return (
            jsonify(
                {
                    'status': 500,
                    'message': str(ex),
                },
            ),
            500,
        )


@api_setting_module_blueprint.route('/simulate_proc_link', methods=['POST'])
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

    return jsonify(nodes=dic_proc_cnt, edges=dic_edge_cnt), 200


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
def save_user_setting():
    """[Summary] Save user settings to DB
    Returns: 200/500
    """
    try:
        params = json.loads(request.data)
        setting = save_user_settings(params)

        # find setting id after creating a new setting
        if not setting.id:
            setting = CfgUserSetting.get_by_title(setting.title)[0]
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


@api_setting_module_blueprint.route('/get_v2_ordered_processes', methods=['POST'])
def get_v2_auto_link_ordered_processes():
    try:
        params = json.loads(request.data)
        groups_processes = get_processes_id_order(params, method=SortMethod.FunctionCountReversedOrder)
        return jsonify({'status': 'ok', 'ordered_processes': groups_processes}), 200
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
    show_proc_link_job = request.args.get('show_proc_link_job')
    error_page = request.args.get('error_page')
    ignore_job_types = []
    if not show_proc_link_job or show_proc_link_job == 'false':
        ignore_job_types.append(JobType.GEN_GLOBAL.name)
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
    dic_jobs['rows'] = rows
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
def register_source_and_proc():
    input_json = request.json
    with make_session() as meta_session:
        try:
            data_src: CfgDataSource = DataSourceSchema().load(input_json.get('csv_info'))

            # data source
            data_src_rec = insert_or_update_config(meta_session, data_src, exclude_columns=[CfgDataSource.order.key])

            # csv detail
            csv_detail = data_src.csv_detail
            if csv_detail:
                # csv_detail.dummy_header = csv_detail.dummy_header == 'true' if csv_detail.dummy_header else None
                csv_columns = data_src.csv_detail.csv_columns
                csv_columns = [col for col in csv_columns if not is_empty(col.column_name)]
                data_src.csv_detail.csv_columns = csv_columns
                csv_detail_rec = insert_or_update_config(
                    meta_session,
                    csv_detail,
                    parent_obj=data_src_rec,
                    parent_relation_key=CfgDataSource.csv_detail.key,
                    parent_relation_type=RelationShip.ONE,
                )

                # CRUD
                csv_columns = csv_detail.csv_columns
                crud_config(
                    meta_session,
                    csv_columns,
                    CfgCsvColumn.data_source_id.key,
                    CfgCsvColumn.column_name.key,
                    parent_obj=csv_detail_rec,
                    parent_relation_key=CfgDataSourceCSV.csv_columns.key,
                    parent_relation_type=RelationShip.MANY,
                )
            process_schema = ProcessSchema()
            proc_config = request.json.get('proc_config')
            proc_config['data_source_id'] = data_src_rec.id
            proc_data = process_schema.load(proc_config)
            unused_columns = request.json.get('unused_columns', [])
            should_import_data = request.json.get('import_data')

            process = create_or_update_process_cfg(proc_data, unused_columns)

            # create process json
            process_schema = ProcessSchema()
            process_json = process_schema.dump(process) or {}

            # import data
            if should_import_data:
                add_import_job(process, run_now=True, is_user_request=True)
        except Exception as e:
            logger.exception(e)
            meta_session.rollback()
            message = {'message': _('Database Setting failed to save'), 'is_error': True}
            return jsonify(flask_message=message), 500

    message = {'message': _('Database Setting saved.'), 'is_error': False}
    ds = None
    if data_src_rec and data_src_rec.id and process:
        ds_schema = DataSourceSchema()
        ds = CfgDataSource.get_ds(data_src_rec.id)
        ds = ds_schema.dumps(ds)

        data_register_data = {
            'status': JobStatus.PROCESSING.name,
            'process_id': process.id,
            'is_first_imported': False,
        }
        background_announcer.announce(data_register_data, AnnounceEvent.DATA_REGISTER.name)
    return jsonify(id=data_src_rec.id, data_source=ds, process_info=process_json, flask_message=message), 200


@api_setting_module_blueprint.route('/redirect_to_chm_page/<proc_id>', methods=['GET'])
def redirect_to_chm_page(proc_id):
    target_url = get_chm_url_to_redirect(request, proc_id)
    return jsonify(url=target_url), 200
