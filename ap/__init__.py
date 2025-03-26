import atexit
import contextlib
import logging
import os
import time
from datetime import datetime

import sqlalchemy as sa
import wtforms_json
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, Response, g, render_template
from flask_apscheduler import STATE_STOPPED
from flask_babel import Babel
from flask_compress import Compress
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from pytz import utc
from sqlalchemy import NullPool
from sqlalchemy.orm import DeclarativeBase, create_session, scoped_session

from ap.common.common_utils import (
    DATE_FORMAT_STR,
    NoDataFoundException,
    check_exist,
    count_file_in_folder,
    find_babel_locale,
    init_config,
    make_dir,
)
from ap.common.constants import (
    ANNOUNCE_UPDATE_TIME,
    APP_DB_FILE,
    DB_SECRET_KEY,
    EXTERNAL_API,
    HTML_CODE_304,
    INIT_APP_DB_FILE,
    INIT_BASIC_CFG_FILE,
    LAST_REQUEST_TIME,
    LIMIT_CHECKING_NEWER_VERSION_TIME,
    LOG_LEVEL,
    MAIN_THREAD,
    PORT,
    PROCESS_QUEUE,
    REQUEST_THREAD_ID,
    SERVER_ADDR,
    SHUTDOWN,
    SQLITE_CONFIG_DIR,
    TESTING,
    UNIVERSAL_DB_FILE,
    YAML_CONFIG_AP,
    YAML_CONFIG_BASIC,
    YAML_CONFIG_DB,
    YAML_CONFIG_PROC,
    YAML_CONFIG_VERSION,
    YAML_START_UP,
    ApLogLevel,
    AppGroup,
    AppSource,
    FlaskGKey,
    MaxGraphNumber,
)
from ap.common.jobs.scheduler import CustomizeScheduler
from ap.common.logger import log_execution_time
from ap.common.services.http_content import json_dumps
from ap.common.services.request_time_out_handler import RequestTimeOutAPI, set_request_g_dict
from ap.common.trace_data_log import TraceErrKey, get_log_attr
from ap.common.yaml_utils import (
    YAML_CONFIG_AP_FILE_NAME,
    YAML_CONFIG_BASIC_FILE_NAME,
    YAML_CONFIG_DB_FILE_NAME,
    YAML_CONFIG_PROC_FILE_NAME,
    YAML_START_UP_FILE_NAME,
    BasicConfigYaml,
)
from ap.equations.error import FunctionErrors, FunctionFieldError
from ap.script.migrate_delta_time import migrate_delta_time_in_cfg_trace_key
from ap.script.migrate_m_function import migrate_m_function_data
from ap.script.migrate_m_unit import migrate_m_unit_data

logger = logging.getLogger(__name__)

dic_config = {
    MAIN_THREAD: None,
    PROCESS_QUEUE: None,
    DB_SECRET_KEY: None,
    SQLITE_CONFIG_DIR: None,
    APP_DB_FILE: None,
    UNIVERSAL_DB_FILE: None,
    TESTING: None,
    SHUTDOWN: None,
    PORT: None,
}

max_graph_config = {
    MaxGraphNumber.AGP_MAX_GRAPH.name: None,
    MaxGraphNumber.FPP_MAX_GRAPH.name: None,
    MaxGraphNumber.RLP_MAX_GRAPH.name: None,
    MaxGraphNumber.CHM_MAX_GRAPH.name: None,
    MaxGraphNumber.SCP_MAX_GRAPH.name: None,
    MaxGraphNumber.MSP_MAX_GRAPH.name: None,
    MaxGraphNumber.STP_MAX_GRAPH.name: None,
}


class BaseSqlalchemy(DeclarativeBase):
    pass


# set to NullPool until we know how to handle QueuePool
db = SQLAlchemy(
    model_class=BaseSqlalchemy,
    session_options={'autoflush': False},
    engine_options={'poolclass': NullPool},
)
migrate = Migrate()
scheduler = CustomizeScheduler(BackgroundScheduler(timezone=utc))
ma = Marshmallow()
wtforms_json.init()

background_jobs = {}

LOG_IGNORE_CONTENTS = ('.html', '.js', '.css', '.ico', '.png')
# yaml config files
dic_yaml_config_file = {'basic': None, 'db': None, 'proc': None, 'ap': None, 'version': 0}

# last request time
dic_request_info = {LAST_REQUEST_TIME: datetime.utcnow()}

# ############## init application metadata db ###############
db_engine = None

# basic yaml
dic_yaml_config_instance = {}


def init_engine(app, uri, **kwargs):
    global db_engine
    # By default, sqlalchemy does not overwrite table. Then no need to manually check file exists neither table exists.
    # https://docs.sqlalchemy.org/en/14/core/metadata.html?highlight=create_all#sqlalchemy.schema.MetaData.create_all
    with app.app_context():
        db.create_all()
    db_engine = sa.create_engine(uri, **kwargs)

    @sa.event.listens_for(db_engine, 'begin')
    def do_begin(dbapi_conn):
        dbapi_conn.execute(sa.text('BEGIN IMMEDIATE'))

    @sa.event.listens_for(db_engine, 'commit')
    def do_expire(dbapi_conn):
        """
        Expire all objects in `db.session` everytime meta session perform a commit.
        This makes `db.session` removes all cached and queries to database again to get the newest objects
        """
        db.session.expire_all()

    return db_engine


Session = scoped_session(
    lambda: create_session(bind=db_engine, autoflush=False, autocommit=False, expire_on_commit=True),
)


def close_sessions():
    # close universal db session
    try:
        db.session.rollback()
        db.session.close()
    except Exception:
        pass

    # close app db session
    try:
        session = g.get(FlaskGKey.APP_DB_SESSION)
        if session:
            session.rollback()
            session.close()
    except Exception:
        pass

    # Flask g
    with contextlib.suppress(Exception):
        g.pop(FlaskGKey.APP_DB_SESSION)


# ##########################################################


def create_app(object_name=None, is_main=False):
    """Create and configure an instance of the Flask application."""
    from flask import request

    from .aggregate_plot import create_module as agp_create_module
    from .analyze import create_module as analyze_create_module
    from .api import create_module as api_create_module
    from .calendar_heatmap import create_module as calendar_heatmap_create_module
    from .categorical_plot import create_module as categorical_create_module
    from .co_occurrence import create_module as co_occurrence_create_module
    from .common.logger import bind_user_info
    from .heatmap import create_module as heatmap_create_module
    from .multiple_scatter_plot import create_module as multiple_scatter_create_module
    from .parallel_plot import create_module as parallel_create_module
    from .ridgeline_plot import create_module as ridgeline_create_module
    from .sankey_plot import create_module as sankey_create_module
    from .scatter_plot import create_module as scatter_plot_create_module
    from .script.migrate_cfg_data_source_csv import migrate_cfg_data_source_csv
    from .script.migrate_cfg_process import migrate_cfg_process
    from .script.migrate_cfg_process_column import migrate_cfg_process_column
    from .script.migrate_csv_datatype import migrate_csv_datatype
    from .script.migrate_csv_dummy_datetime import migrate_csv_dummy_datetime
    from .script.migrate_csv_save_graph_settings import migrate_csv_save_graph_settings
    from .script.migrate_process_file_name_column import (
        migrate_cfg_process_add_file_name,
        migrate_cfg_process_column_add_column_raw_dtype,
        migrate_cfg_process_column_add_column_raw_name,
        migrate_cfg_process_column_add_column_type,
        migrate_cfg_process_column_add_parent_id,
        migrate_cfg_process_column_change_all_generated_datetime_column_type,
    )
    from .setting_module import create_module as setting_create_module
    from .table_viewer import create_module as table_viewer_create_module
    from .tile_interface import create_module as tile_interface_create_module
    from .trace_data import create_module as trace_data_create_module

    app = Flask(__name__)
    app.config.from_object(object_name)

    # app.config.update(
    #     SCHEDULER_JOBSTORES={'default': SQLAlchemyJobStore(url=app.config['SQLALCHEMY_DATABASE_APP_URI'])},
    # )

    # db directory
    dic_config[SQLITE_CONFIG_DIR] = app.config[SQLITE_CONFIG_DIR]

    # db files
    dic_config[APP_DB_FILE] = app.config[APP_DB_FILE]
    dic_config[UNIVERSAL_DB_FILE] = app.config[UNIVERSAL_DB_FILE]
    make_dir(dic_config[UNIVERSAL_DB_FILE])

    # testing param
    dic_config[TESTING] = app.config.get(TESTING, None)

    # check and create instance folder before run db init
    if not check_exist(dic_config[SQLITE_CONFIG_DIR]):
        make_dir(dic_config[SQLITE_CONFIG_DIR])

    should_reset_import_history = False
    if not count_file_in_folder(app.config['UNIVERSAL_DB_FILE']):
        should_reset_import_history = True

    # check and copy appDB to instance if not existing
    init_config(app.config[APP_DB_FILE], app.config[INIT_APP_DB_FILE])

    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    # set to NullPool until we know how to handle QueuePool
    init_engine(app, app.config['SQLALCHEMY_DATABASE_URI'], poolclass=NullPool)
    # reset import history when no universal db
    if should_reset_import_history:
        from ap.script.hot_fix.fix_db_issues import reset_import_history

        reset_import_history(app)

    # yaml files path
    yaml_config_dir = app.config.get('YAML_CONFIG_DIR')
    dic_yaml_config_file[YAML_CONFIG_BASIC] = os.path.join(yaml_config_dir, YAML_CONFIG_BASIC_FILE_NAME)
    dic_yaml_config_file[YAML_CONFIG_DB] = os.path.join(yaml_config_dir, YAML_CONFIG_DB_FILE_NAME)
    dic_yaml_config_file[YAML_CONFIG_PROC] = os.path.join(yaml_config_dir, YAML_CONFIG_PROC_FILE_NAME)
    dic_yaml_config_file[YAML_CONFIG_AP] = os.path.join(yaml_config_dir, YAML_CONFIG_AP_FILE_NAME)
    dic_yaml_config_file[YAML_START_UP] = os.path.join(os.getcwd(), YAML_START_UP_FILE_NAME)

    # check and copy basic config file if not existing
    init_config(dic_yaml_config_file[YAML_CONFIG_BASIC], app.config[INIT_BASIC_CFG_FILE])

    # db secret key
    dic_config[DB_SECRET_KEY] = app.config[DB_SECRET_KEY]

    # sqlalchemy echo flag
    app.config['SQLALCHEMY_ECHO'] = app.config.get('DEBUG')

    dic_config['INIT_LOG_DIR'] = app.config.get('INIT_LOG_DIR')

    Compress(app)

    api_create_module(app)
    scatter_plot_create_module(app)
    calendar_heatmap_create_module(app)
    heatmap_create_module(app)
    setting_create_module(app)
    trace_data_create_module(app)
    analyze_create_module(app)
    table_viewer_create_module(app)
    categorical_create_module(app)
    ridgeline_create_module(app)
    parallel_create_module(app)
    sankey_create_module(app)
    co_occurrence_create_module(app)
    multiple_scatter_create_module(app)
    tile_interface_create_module(app)
    agp_create_module(app)
    app.add_url_rule('/', endpoint='tile_interface.tile_interface')

    basic_config_yaml = BasicConfigYaml(dic_yaml_config_file[YAML_CONFIG_BASIC])
    start_up_yaml = BasicConfigYaml(dic_yaml_config_file[YAML_START_UP])
    hide_setting_page = basic_config_yaml.get_node(['info', 'hide-setting-page'], False)
    default_log_level = basic_config_yaml.get_node(['info', LOG_LEVEL], ApLogLevel.INFO.name)
    is_default_log_level = default_log_level == ApLogLevel.INFO.name
    dic_yaml_config_instance[YAML_CONFIG_BASIC] = basic_config_yaml
    dic_yaml_config_instance[YAML_START_UP] = start_up_yaml

    lang = start_up_yaml.get_node(['setting_startup', 'language'], None)
    sub_title = start_up_yaml.get_node(['setting_startup', 'subtitle'], '')

    if lang is None or not lang:
        lang = basic_config_yaml.get_node(['info', 'language'], False)

    lang = find_babel_locale(lang)
    lang = lang or app.config['BABEL_DEFAULT_LOCALE']

    # create prefix for cookie key to prevent using same cookie between ports when runiing app
    def key_port(key):
        port = start_up_yaml.get_node(
            ['setting_startup', 'port'],
            basic_config_yaml.get_node(['info', 'port-no'], '7770'),
        )
        return f'{port}_{key}'

    def get_locale():
        return request.cookies.get(key_port('locale')) or lang

    Babel(app, locale_selector=get_locale)

    # get app version
    version_file = app.config.get('VERSION_FILE_PATH') or os.path.join(os.getcwd(), 'VERSION')
    with open(version_file) as f:
        rows = f.readlines()
        rows.reverse()
        app_ver = rows.pop()
        if '%%VERSION%%' in app_ver:
            app_ver = 'v00.00.000.00000000'

        config_ver = rows.pop() if len(rows) else '0'

        dic_yaml_config_file[YAML_CONFIG_VERSION] = config_ver

        app_source = str(rows.pop()).strip('\n') if len(rows) else AppSource.DN.value
        app_source = app_source if app_source else AppSource.DN.value

        user_group = os.environ.get('group', AppGroup.Dev.value)
        user_group = get_app_group(app_source, user_group)

    # Universal DB init
    # init_db(app)

    if is_main:
        # migrate csv datatype
        migrate_csv_datatype(app.config[APP_DB_FILE])
        migrate_csv_dummy_datetime(app.config[APP_DB_FILE])
        migrate_csv_save_graph_settings(app.config[APP_DB_FILE])
        migrate_cfg_data_source_csv(app.config[APP_DB_FILE])
        migrate_cfg_process_add_file_name(app.config[APP_DB_FILE])
        migrate_cfg_process_column_add_column_raw_name(app.config[APP_DB_FILE])
        migrate_cfg_process_column_add_column_raw_dtype(app.config[APP_DB_FILE])
        migrate_cfg_process_column_add_column_type(app.config[APP_DB_FILE])
        migrate_cfg_process_column_add_parent_id(app.config[APP_DB_FILE])
        migrate_cfg_process_column(app.config[APP_DB_FILE])
        migrate_cfg_process(app.config[APP_DB_FILE])
        migrate_cfg_process_column_change_all_generated_datetime_column_type(app.config[APP_DB_FILE])

        # migrate function data
        migrate_m_function_data(app.config[APP_DB_FILE])
        # migrate delta_time
        migrate_delta_time_in_cfg_trace_key(app.config[APP_DB_FILE])

        # migrate m_unit
        migrate_m_unit_data(app.config[APP_DB_FILE])

    # start scheduler (Notice: start scheduler at the end , because it may run job before above setting info was set)
    if scheduler.state != STATE_STOPPED:
        scheduler.shutdown(wait=False)

    if not app.config.get('SCHEDULER_TIMEZONE'):
        # set timezone for scheduler before init job
        # all job will run in UTC instead of local time
        app.config['SCHEDULER_TIMEZONE'] = utc
    scheduler.init_app(app)

    # Shut down the scheduler when exiting the app
    atexit.register(
        lambda: scheduler.shutdown()
        if scheduler.state != STATE_STOPPED
        else logger.info('Scheduler is already shutdown'),
    )

    @app.route('/ping')
    def ping():
        return 'Pong!', 200

    @app.before_request
    def before_request_callback():
        g.request_start_time = time.time()
        # get the last time user request
        global dic_request_info

        # get api request thread id
        thread_id = request.form.get(REQUEST_THREAD_ID, None)
        set_request_g_dict(thread_id)

        resource_type = request.base_url or ''
        is_ignore_content = any(resource_type.endswith(extension) for extension in LOG_IGNORE_CONTENTS)
        if not is_ignore_content and request.blueprint != EXTERNAL_API:
            bind_user_info(request)

            # if not dic_config.get(TESTING):
            #     is_valid_browser, is_valid_version = check_client_browser(request)
            #     if not is_valid_version:
            #         # safari not valid version
            #         g.is_valid_version = True
            #
            #     if not is_valid_browser:
            #         # browser not valid
            #         content = {
            #             'title': _('InvalidBrowserTitle'),
            #             'message': _('InvalidBrowserContent'),
            #         }
            #         return render_template('none.html', **content)

    @app.after_request
    def after_request_callback(response: Response):
        if 'event-stream' in str(request.accept_mimetypes):
            return response

        # In case of text/html request, add information of disk capacity to show up on UI.
        if 'text/html' in str(request.accept_mimetypes) or 'text/html' in str(response.headers):
            from ap.common.disk_usage import (
                add_disk_capacity_into_response,
                get_disk_capacity_to_load_ui,
            )

            dict_capacity = get_disk_capacity_to_load_ui()
            add_disk_capacity_into_response(response, dict_capacity)
            if not request.cookies.get(key_port('locale')):
                response.set_cookie(key_port('locale'), lang)

            is_admin = int(is_admin_request(request))
            response.set_cookie(key_port('is_admin'), str(is_admin))
            response.set_cookie(key_port('sub_title'), sub_title)
            response.set_cookie(key_port('user_group'), user_group)

        # close app db session
        close_sessions()

        response.cache_control.public = True

        # better performance
        if not request.content_type:
            response.cache_control.max_age = 60 * 5
            response.cache_control.must_revalidate = True

        # check everytime (acceptable performance)
        # response.cache_control.no_cache = True
        response.direct_passthrough = False
        response.add_etag()
        response.make_conditional(request)
        if response.status_code == HTML_CODE_304:
            return response

        resource_type = request.base_url or ''
        is_ignore_content = any(resource_type.endswith(extension) for extension in LOG_IGNORE_CONTENTS)
        if not is_ignore_content:
            # "hide_setting_page: true" apply only to ip address/pc address instead of localhost
            is_hide_setting_page = hide_setting_page and not is_admin_request(request)
            bind_user_info(request, response)
            response.set_cookie(key_port('log_level'), str(is_default_log_level))
            response.set_cookie(key_port('hide_setting_page'), str(is_hide_setting_page))
            response.set_cookie(key_port('app_version'), str(app_ver).strip('\n'))
            response.set_cookie(key_port('app_location'), str(app_source).strip('\n'))

        if app.config.get('app_startup_time'):
            response.set_cookie(
                key_port('app_startup_time'),
                str(app.config.get('app_startup_time').strftime(DATE_FORMAT_STR)),
            )
        response.set_cookie(key_port('announce_update_time'), str(ANNOUNCE_UPDATE_TIME))
        response.set_cookie(key_port('limit_checking_newer_version_time'), str(LIMIT_CHECKING_NEWER_VERSION_TIME))

        return response

    @app.errorhandler(404)
    def page_not_found(e):
        # note that we set the 404 status explicitly
        return render_template('404.html', do_not_send_ga=True), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        # close app db session
        close_sessions()
        logger.exception(e)

        response = json_dumps({'code': e.code, 'message': str(e), 'dataset_id': get_log_attr(TraceErrKey.DATASET)})
        status = 500
        return Response(response=response, status=status)
        # return render_template('500.html'), 500

    @app.errorhandler(NoDataFoundException)
    def no_data_found(e):
        # close app db session
        close_sessions()
        logger.exception(e)

        response = json_dumps({'message': str('No data Found!')})
        status = 500
        return Response(response=response, status=status)

    # @app.errorhandler(Exception)
    # def unhandled_exception(e):
    #     # close app db session
    #     close_sessions()
    #     logger.exception(e)
    #
    #     response = json.dumps({
    #         "code": e.status_code,
    #         "message": e.message,
    #         "dataset_id": get_log_attr(TraceErrKey.DATASET)
    #     })
    #     return Response(response=response)

    @app.errorhandler(RequestTimeOutAPI)
    def request_timeout_api_error(e):
        """Return JSON instead of HTML for HTTP errors."""
        # close app db session
        close_sessions()

        # logger.error(e)

        # start with the correct headers and status code from the error
        # replace the body with JSON

        response = json_dumps(
            {
                'code': e.status_code,
                'message': e.message,
            },
        )
        return Response(response=response, status=408)

    @app.errorhandler(FunctionFieldError)
    def function_field_api_error(e: FunctionFieldError):
        status = 400
        response = json_dumps(e.parse())
        return Response(response=response, status=status)

    @app.errorhandler(FunctionErrors)
    def functions_api_error(e: FunctionErrors):
        status = 400
        response = json_dumps(e.parse())
        return Response(response=response, status=status)

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        # close app db session
        close_sessions()
        Session.remove()

    return app


@log_execution_time()
def get_basic_yaml_obj():
    return dic_yaml_config_instance[YAML_CONFIG_BASIC]


@log_execution_time()
def get_start_up_yaml_obj():
    return dic_yaml_config_instance[YAML_START_UP]


def get_app_group(app_source, user_group):
    if user_group and user_group.lower() == AppGroup.Dev.value.lower():
        user_group = AppGroup.Dev.value
    elif app_source:
        if app_source == AppSource.DN.value or user_group.lower() == AppGroup.DN.value.lower():
            user_group = AppGroup.DN.value
        else:
            user_group = AppGroup.Ext.value
    else:
        user_group = AppGroup.Dev.value

    return user_group


def is_admin_request(request):
    from ap.common.disk_usage import (
        get_ip_address,
    )

    server_ip = get_ip_address()
    server_ip = [server_ip] + SERVER_ADDR
    client_ip = request.remote_addr
    is_admin = client_ip in server_ip
    return is_admin
