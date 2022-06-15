import json
import os
import traceback
from datetime import datetime

from apscheduler.triggers.date import DateTrigger
from flask import Blueprint, request, jsonify, Response
from flask_babel import gettext as _
from loguru import logger
from pytz import utc

from histview2 import background_jobs
from histview2.api.setting_module.services.common import is_local_client, save_user_settings, get_all_user_settings, \
    delete_user_setting_by_id, get_setting, get_page_top_setting, is_title_exist, parse_user_setting
from histview2.api.setting_module.services.data_import import add_shutdown_app_job
from histview2.api.setting_module.services.data_import import update_or_create_constant_by_type, check_db_con
from histview2.api.setting_module.services.filter_settings import save_filter_config, delete_cfg_filter_from_db
from histview2.api.setting_module.services.polling_frequency import change_polling_all_interval_jobs, add_import_job
from histview2.api.setting_module.services.process_delete import delete_proc_cfg_and_relate_jobs, del_data_source
from histview2.api.setting_module.services.save_load_user_setting import map_form, transform_settings
from histview2.api.setting_module.services.show_latest_record import get_latest_records, save_master_vis_config, \
    get_last_distinct_sensor_values, preview_csv_data, gen_preview_data_check_dict
from histview2.api.trace_data.services.proc_link import gen_global_id_job, show_proc_link_info
from histview2.api.trace_data.services.proc_link_simulation import sim_gen_global_id
from histview2.common.backup_db import add_backup_dbs_job
from histview2.common.common_utils import is_empty, \
    parse_int_value
from histview2.common.constants import WITH_IMPORT_OPTIONS, CfgConstantType, RelationShip, ProcessCfgConst, UI_ORDER_DB, \
    Action, appENV
from histview2.common.cryptography_utils import encrypt
from histview2.common.scheduler import JobType, scheduler
from histview2.common.services import http_content
from histview2.common.services.jp_to_romaji_utils import to_romaji
from histview2.common.services.sse import background_announcer
from histview2.common.yaml_utils import BasicConfigYaml
from histview2.setting_module.models import AppLog, CfgDataSource, make_session, \
    insert_or_update_config, crud_config, CfgCsvColumn, CfgDataSourceCSV, CfgProcess, CfgUserSetting
from histview2.setting_module.schemas import DataSourceSchema, ProcessSchema, CfgUserSettingSchema
from histview2.setting_module.services.background_process import get_job_detail_service
from histview2.setting_module.services.process_config import create_or_update_process_cfg, get_process_cfg, \
    query_database_tables, get_process_columns, get_process_filters, get_process_visualizations
from histview2.setting_module.services.trace_config import get_all_processes_traces_info, save_trace_config_to_db, \
    gen_cfg_trace

api_setting_module_blueprint = Blueprint(
    'api_setting_module',
    __name__,
    url_prefix='/histview2/api/setting'
)


@api_setting_module_blueprint.route('/update_polling_freq', methods=['POST'])
def update_polling_freq():
    data_update = json.loads(request.data)
    with_import_option = data_update.get(WITH_IMPORT_OPTIONS)
    freq_min = parse_int_value(data_update.get(CfgConstantType.POLLING_FREQUENCY.name)) or 0

    # save/update POLLING_FREQUENCY to db
    freq_sec = freq_min * 60
    update_or_create_constant_by_type(const_type=CfgConstantType.POLLING_FREQUENCY.name, value=freq_sec)

    # re-set trigger time for all jobs
    change_polling_all_interval_jobs(interval_sec=freq_sec, run_now=with_import_option)

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
                csv_columns = data_src.csv_detail.csv_columns
                csv_columns = [col for col in csv_columns if not is_empty(col.column_name)]
                data_src.csv_detail.csv_columns = csv_columns
                csv_detail_rec = insert_or_update_config(meta_session, csv_detail,
                                                         parent_obj=data_src_rec,
                                                         parent_relation_key=CfgDataSource.csv_detail.key,
                                                         parent_relation_type=RelationShip.ONE)

                # CRUD
                csv_columns = csv_detail.csv_columns
                crud_config(meta_session, csv_columns, CfgCsvColumn.data_source_id.key,
                            CfgCsvColumn.column_name.key,
                            parent_obj=csv_detail_rec,
                            parent_relation_key=CfgDataSourceCSV.csv_columns.key,
                            parent_relation_type=RelationShip.MANY)

            # db detail
            db_detail = data_src.db_detail
            if db_detail:
                # encrypt password
                db_detail.password = encrypt(db_detail.password)
                db_detail.hashed = True
                # avoid blank string
                db_detail.port = db_detail.port or None
                db_detail.schema = db_detail.schema or None
                insert_or_update_config(meta_session, db_detail,
                                        parent_obj=data_src_rec,
                                        parent_relation_key=CfgDataSource.db_detail.key,
                                        parent_relation_type=RelationShip.ONE)
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


# TODO: refactoring check connection without this function
@api_setting_module_blueprint.route('/database_tables', methods=['GET'])
def get_database_tables():
    db_tables = CfgDataSource.get_all()
    ds_schema = DataSourceSchema(many=True)
    dump_data = ds_schema.dumps(db_tables)
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


@api_setting_module_blueprint.route('/register_basic_config', methods=['POST'])
def regist_basic_config():
    params = json.loads(request.data)

    basic_config_yaml = BasicConfigYaml()

    # Get Port number from YML Config
    if params["info"]["port-no"] is None:
        params["info"]["port-no"] = basic_config_yaml.dic_config['info'].get("port-no", 80)

    # Set to show setting page as default
    if params["info"]["hide-setting-page"] is None:
        params["info"]["hide-setting-page"] = basic_config_yaml.dic_config['info'].get("hide-setting-page", False)

    result = basic_config_yaml.write_json_to_yml_file(params)

    if result:
        message = {'message': _('Basic Config saved'), 'is_error': False}
    else:
        message = {'message': _('Basic Config failed to save'), 'is_error': True}

    return jsonify(flask_message=message), 200


@api_setting_module_blueprint.route('/check_db_connection', methods=['POST'])
def check_db_connection():
    """Check if we can connect to database. Supported databases: SQLite, PostgreSQL, MSSQLServer.
    Returns:
        HTTP Response - (True + OK message) if connection can be established, return (False + NOT OK message) otherwise.
    """
    params = json.loads(request.data).get("db")
    db_type = params.get("db_type")
    host = params.get("host")
    port = params.get("port")
    dbname = params.get("dbname")
    schema = params.get("schema")
    username = params.get("username")
    password = params.get("password")

    result = check_db_con(db_type, host, port, dbname, schema, username, password)

    if result:
        message = {"db_type": db_type, 'message': _("Connected"), 'connected': True}
    else:
        message = {"db_type": db_type, 'message': _("Failed to connect"), 'connected': False}

    return jsonify(flask_message=message), 200


@api_setting_module_blueprint.route('/show_latest_records', methods=['POST'])
def show_latest_records():
    """[summary]
    Show 5 latest records
    Returns:
        [type] -- [description]
    """
    dic_form = request.form.to_dict()
    data_source_id = dic_form.get("databaseName")
    table_name = dic_form.get("tableName")
    limit = parse_int_value(dic_form.get("limit")) or 5
    cols_with_types, rows, cols_duplicated, previewed_files = get_latest_records(data_source_id, table_name, limit)
    dic_preview_limit = gen_preview_data_check_dict(rows, previewed_files)
    result = {'cols': cols_with_types,
              'rows': rows,
              'cols_duplicated': cols_duplicated,
              'fail_limit': dic_preview_limit,
              }

    return json.dumps(result, ensure_ascii=False, default=http_content.json_serial)


@api_setting_module_blueprint.route('/get_csv_resources', methods=['POST'])
def get_csv_resources():
    folder_url = request.json.get('url')
    etl_func = request.json.get('etl_func')
    csv_delimiter = request.json.get('delimiter')

    dic_output = preview_csv_data(folder_url, etl_func, csv_delimiter, 5)
    rows = dic_output['content']
    previewed_files = dic_output['previewed_files']
    dic_preview_limit = gen_preview_data_check_dict(rows, previewed_files)
    dic_output['fail_limit'] = dic_preview_limit

    return jsonify(dic_output)


@api_setting_module_blueprint.route('/job', methods=['POST'])
def get_background_jobs():
    return jsonify(background_jobs), 200


@api_setting_module_blueprint.route('/listen_background_job', methods=['GET'])
def listen_background_job():
    def stream():
        messages = background_announcer.listen()  # returns a queue.Queue
        while True:
            msg = messages.get()
            yield msg

    return Response(stream(), mimetype='text/event-stream')


@api_setting_module_blueprint.route('/check_folder', methods=['POST'])
def check_folder():
    try:
        data = request.json.get('url')
        return jsonify({
            'status': 200,
            'url': data,
            'is_exists': os.path.isdir(data) and os.path.exists(data),
            'dir': os.path.dirname(data)
        })
    except Exception:
        # raise
        return jsonify({
            'status': 500,
        })


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

    # delete config and add job to delete data
    delete_proc_cfg_and_relate_jobs(proc_id)

    return jsonify(result=dict()), 200


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
    except Exception as ex:
        traceback.print_exc()
        logger.error(ex)

    # backup database now
    add_backup_dbs_job(True)

    # add a job to check for shutdown time
    add_shutdown_app_job()

    return jsonify({}), 200


@api_setting_module_blueprint.route('/shutdown', methods=['POST'])
def shutdown():
    if not is_local_client(request):
        return jsonify({}), 403

    logger.info('SHUTTING DOWN...')
    os._exit(14)

    return jsonify({}), 200


@api_setting_module_blueprint.route('/proc_config', methods=['POST'])
def post_proc_config():
    process_schema = ProcessSchema()
    proc_data = process_schema.load(request.json.get('proc_config'))
    should_import_data = request.json.get('import_data')

    try:
        # get exists process from id
        proc_id = proc_data.get(ProcessCfgConst.PROC_ID.value)
        if proc_id:
            process = get_process_cfg(int(proc_id))
            if not process:
                return jsonify({
                    'status': 404,
                    'message': 'Not found {}'.format(proc_id),
                }), 200

        process = create_or_update_process_cfg(proc_data)

        # create process json
        process_schema = ProcessSchema()
        process_json = process_schema.dump(process) or {}

        # import data
        if should_import_data:
            add_import_job(process, run_now=True)

        return jsonify({
            'status': 200,
            'data': process_json,
        }), 200
    except Exception as ex:
        traceback.print_exc()
        return jsonify({
            'status': 500,
            'message': str(ex),
        }), 500


@api_setting_module_blueprint.route('/trace_config', methods=['GET'])
def get_trace_configs():
    """[Summary] Save orders to DB
    Returns: 200/500
    """
    try:
        procs = get_all_processes_traces_info()
        return {'trace_config': json.dumps({'procs': procs})}, 200
    except Exception:
        traceback.print_exc()
        return jsonify({}), 500


@api_setting_module_blueprint.route('/trace_config', methods=['POST'])
def save_trace_configs():
    """[Summary] Save trace_configs to DB
    Returns: 200/500
    """
    try:
        params = json.loads(request.data)
        save_trace_config_to_db(params)

        job_id = JobType.GEN_GLOBAL.name
        scheduler.add_job(job_id, gen_global_id_job, replace_existing=True,
                          trigger=DateTrigger(datetime.now().astimezone(utc), timezone=utc),
                          kwargs=dict(_job_id=job_id, _job_name=job_id, is_new_data_check=False))
    except Exception:
        traceback.print_exc()
        return jsonify({}), 500

    return jsonify({}), 200


@api_setting_module_blueprint.route('/ds_load_detail/<ds_id>', methods=['GET'])
def ds_load_detail(ds_id):
    ds_schema = DataSourceSchema()
    ds = CfgDataSource.get_ds(ds_id)
    return ds_schema.dumps(ds), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>', methods=['DELETE'])
def del_proc_config(proc_id):
    return jsonify({
        'status': 200,
        'data': {
            'proc_id': proc_id,
        }
    }), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>', methods=['GET'])
def get_proc_config(proc_id):
    process = get_process_cfg(proc_id)
    if process:
        tables = query_database_tables(process['data_source_id'])
        return jsonify({
            'status': 200,
            'data': process,
            'tables': tables
        }), 200
    else:
        return jsonify({
            'status': 404,
            'data': 'Not found'
        }), 200


@api_setting_module_blueprint.route('/proc_filter_config/<proc_id>', methods=['GET'])
def get_proc_config_filter_data(proc_id):
    process = get_process_cfg(proc_id)
    # filter_col_data = get_filter_col_data(process) or {}
    filter_col_data = {}
    if process:
        return jsonify({
            'status': 200,
            'data': process,
            'filter_col_data': filter_col_data,
        }), 200
    else:
        return jsonify({
            'status': 404,
            'data': {},
            'filter_col_data': {},
        }), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/columns', methods=['GET'])
def get_proc_column_config(proc_id):
    columns = get_process_columns(proc_id)
    if columns:
        return jsonify({
            'status': 200,
            'data': columns,
        }), 200
    else:
        return jsonify({
            'status': 404,
            'data': []
        }), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/filters', methods=['GET'])
def get_proc_filter_config(proc_id):
    filters = get_process_filters(proc_id)
    if filters:
        return jsonify({
            'status': 200,
            'data': filters,
        }), 200
    else:
        return jsonify({
            'status': 404,
            'data': []
        }), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/visualizations', methods=['GET'])
def get_proc_visualization_config(proc_id):
    proc_with_visual_settings = get_process_visualizations(proc_id)
    if proc_with_visual_settings:
        return jsonify({
            'status': 200,
            'data': proc_with_visual_settings,
        }), 200
    else:
        return jsonify({
            'status': 404,
            'data': []
        }), 200


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
        return jsonify({
            'data': sensor_data,
        }), 200
    else:
        return jsonify({
            'data': []
        }), 200


@api_setting_module_blueprint.route('/proc_config/<proc_id>/visualizations', methods=['POST'])
def post_master_visualizations_config(proc_id):
    try:
        save_master_vis_config(proc_id, request.json)
        proc_with_visual_settings = get_process_visualizations(proc_id)
        return jsonify({
            'status': 200,
            'data': proc_with_visual_settings,
        }), 200
    except Exception as ex:
        traceback.print_exc()
        return jsonify({
            'status': 500,
            'message': str(ex),
        }), 500


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


@api_setting_module_blueprint.route('/user_setting', methods=['POST'])
def save_user_setting():
    """[Summary] Save user settings to DB
    Returns: 200/500
    """
    try:
        params = json.loads(request.data)
        save_user_settings(params)

        # find setting id after creating a new setting
        setting = parse_user_setting(params)
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
    if not setting:
        return jsonify({}), 404

    return jsonify({'status': 200, 'data': setting}), 200


@api_setting_module_blueprint.route('/user_setting_page_top', methods=['GET'])
def get_user_setting_page_top():
    page = request.args.get("page")
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
    current_env = os.environ.get('ANALYSIS_INTERFACE_ENV', appENV.DEVELOPMENT.value)
    return jsonify({'status': 200, 'env': current_env}), 200


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
