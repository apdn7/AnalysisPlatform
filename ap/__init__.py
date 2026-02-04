import atexit
import contextlib
import logging
import os
import time
from collections.abc import Mapping
from datetime import datetime
from typing import Any

import flask_migrate
import pandas as pd
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
from sqlalchemy import MetaData, NullPool
from sqlalchemy.orm import DeclarativeBase, create_session, scoped_session

from ap.common.authorization import is_admin_request, is_authorized
from ap.common.common_utils import (
    NoDataFoundException,
    check_exist,
    find_babel_locale,
    init_config,
)
from ap.common.constants import (
    APP_DB_FILE,
    DATE_FORMAT_STR,
    DB_SECRET_KEY,
    DISABLE_CONFIG_FROM_EXTERNAL_KEY,
    ENABLE_DUMP_TRACE_LOG,
    EXTERNAL_API,
    GA_TRACKING_ID_KEY,
    HTML_CODE_304,
    INIT_APP_DB_FILE,
    INIT_BASIC_CFG_FILE,
    LAST_REQUEST_TIME,
    LOG_LEVEL,
    MAIN_THREAD,
    NO_CACHING_ENDPOINTS,
    PORT,
    PROCESS_QUEUE,
    REQUEST_THREAD_ID,
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
    FlaskGKey,
    MaxGraphNumber,
)
from ap.common.ga import GA, GA_TRACKING_ID, VERSION_FILE_NAME, AppGroup, AppSource, get_app_group
from ap.common.jobs.scheduler import CustomizeScheduler
from ap.common.logger import log_execution_time
from ap.common.path_utils import count_file_in_folder, make_dir, resource_path
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
    StartupSettings,
)
from ap.equations.error import FunctionErrors, FunctionFieldError

logger = logging.getLogger(__name__)

# Enable pandas copy on write optimization
# See more: <https://pandas.pydata.org/docs/user_guide/copy_on_write.html#copy-on-write-optimizations>
pd.options.mode.copy_on_write = True

# Should raise exception if we ever do this operation: df[a][b] = 2
# Because it might not modify dataframe.
pd.options.mode.chained_assignment = 'raise'

# Experiment this.
# future.infer_string Whether to infer sequence of str objects as pyarrow string dtype,
# which will be the default in pandas 3.0 (at which point this option will be deprecated).
# <https://github.com/pandas-dev/pandas/issues/60113>
pd.options.future.infer_string = False


# BRIDGE STATION - Refactor DN & OSS version
# get app version
version_file = resource_path(VERSION_FILE_NAME) or os.path.join(os.getcwd(), VERSION_FILE_NAME)
with open(version_file) as f:
    rows = f.readlines()
    rows.reverse()
    app_ver = rows.pop()
    if '%%VERSION%%' in app_ver:
        app_ver = 'v00.00.000.00000000'

    config_ver = str(rows.pop()).strip('\n') if len(rows) else '0'
    app_source = str(rows.pop()).strip('\n').replace('%%SOURCE%%', '') if len(rows) else AppSource.DN.value
    app_source = app_source if app_source else AppSource.DN.value

    # use global flag for app_version
    is_internal_version = app_source == AppSource.DN.value

    logger.info(f'app_ver: {app_ver}')
    logger.info(f'config_ver: {config_ver}')
    logger.info(f'app_source: {app_source}')


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
    """Base class for SQLAlchemy declarative models.

    This class serves as the foundation for all SQLAlchemy ORM models in the application.
    It extends SQLAlchemy's DeclarativeBase and provides standardized metadata with
    consistent naming conventions for database constraints.

    The naming conventions ensure that all database constraints (indexes, unique constraints,
    check constraints, foreign keys, and primary keys) follow a predictable pattern,
    making database schema management and migrations more maintainable.

    Attributes:
        metadata: SQLAlchemy MetaData instance with predefined naming conventions for
            database constraints:
            - ix: Index naming pattern
            - uq: Unique constraint naming pattern
            - ck: Check constraint naming pattern
            - fk: Foreign key constraint naming pattern
            - pk: Primary key constraint naming pattern

    Generated by Duo
    """

    metadata = MetaData(
        naming_convention={
            'ix': 'ix_%(column_0_label)s',
            'uq': 'uq_%(table_name)s_%(column_0_name)s',
            'ck': 'ck_%(table_name)s_`%(constraint_name)s`',
            'fk': 'fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s',
            'pk': 'pk_%(table_name)s',
        },
    )


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


def init_engine(uri, **kwargs: Mapping[str, Any]):
    global db_engine
    db_engine = sa.create_engine(uri, **kwargs)

    from ap.common.session.listener import SessionListener

    SessionListener.make_core_events(db, db_engine)
    # add trigger in CRUD config data
    SessionListener.add_listen_events(db)

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
        session = g.get(FlaskGKey.APP_DB_SESSION.name)
        if session:
            session.rollback()
            session.close()
    except Exception:
        pass

    # Flask g
    with contextlib.suppress(Exception):
        g.pop(FlaskGKey.APP_DB_SESSION.name)


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
    from .setting_module import create_module as setting_create_module
    from .table_viewer import create_module as table_viewer_create_module
    from .tile_interface import create_module as tile_interface_create_module
    from .trace_data import create_module as trace_data_create_module
    from .waveform_plot import create_module as waveform_plot_create_module

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
    init_engine(app.config['SQLALCHEMY_DATABASE_URI'], poolclass=NullPool)
    # reset import history when no universal db
    if should_reset_import_history:
        from ap.script.unlock_db import reset_import_history

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
    waveform_plot_create_module(app)

    app.add_url_rule('/', endpoint='tile_interface.tile_interface')

    basic_config_yaml = BasicConfigYaml(dic_yaml_config_file[YAML_CONFIG_BASIC])
    start_up_yaml = BasicConfigYaml(dic_yaml_config_file[YAML_START_UP])
    hide_setting_page = basic_config_yaml.get_node(['info', 'hide-setting-page'], False)
    default_log_level = basic_config_yaml.get_node(['info', LOG_LEVEL], ApLogLevel.INFO.name)
    is_default_log_level = default_log_level == ApLogLevel.INFO.name
    dic_yaml_config_instance[YAML_CONFIG_BASIC] = basic_config_yaml
    dic_yaml_config_instance[YAML_START_UP] = start_up_yaml
    # BRIDGE STATION - Refactor DN & OSS version
    dic_yaml_config_file[YAML_CONFIG_VERSION] = config_ver

    startup_settings = StartupSettings.from_dict(start_up_yaml.dic_config.get('setting_startup', {}))
    sub_title = startup_settings.subtitle
    # app config
    app.config[GA_TRACKING_ID_KEY] = GA_TRACKING_ID if startup_settings.enable_ga_tracking else ''
    app.config[ENABLE_DUMP_TRACE_LOG] = bool(startup_settings.enable_dump_trace_log)
    app.config[DISABLE_CONFIG_FROM_EXTERNAL_KEY] = bool(startup_settings.disable_config_from_external)
    # language
    lang = startup_settings.language
    if lang is None or not lang:
        lang = basic_config_yaml.get_node(['info', 'language'], False)
    lang = find_babel_locale(lang)
    lang = lang or app.config['BABEL_DEFAULT_LOCALE']

    # create prefix for cookie key to prevent using same cookie between ports when runiing app
    def key_port(key):
        port = startup_settings.port
        if not port:
            port = basic_config_yaml.get_node(['info', 'port-no'], '7770')
        return f'{port}_{key}'

    def get_locale():
        return request.cookies.get(key_port('locale')) or lang

    Babel(app, locale_selector=get_locale)

    # BRIDGE STATION - Refactor DN & OSS version
    user_group = os.environ.get('group', AppGroup.Dev.value)
    user_group = get_app_group(app_source, user_group)
    ga_info = GA.get_ga_info(version_file)
    dic_yaml_config_file[YAML_CONFIG_VERSION] = ga_info.config_version

    if is_main:
        with app.app_context():
            flask_migrate.upgrade()

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
        lambda: (
            scheduler.shutdown() if scheduler.state != STATE_STOPPED else logger.info('Scheduler is already shutdown')
        ),
    )

    @app.route('/ping')
    def ping():
        return 'Pong!', 200

    @app.context_processor
    def before_render():
        from ap.common.disk_usage import (
            get_disk_capacity_to_load_ui,
        )

        dict_capacity = get_disk_capacity_to_load_ui()
        is_admin = int(is_admin_request())
        # "hide_setting_page: true" apply only to ip address/pc address instead of localhost
        is_hide_setting_page = hide_setting_page and not is_admin_request()
        app_startup_time = (
            str(app.config.get('app_startup_time').strftime(DATE_FORMAT_STR))
            if app.config.get('app_startup_time')
            else 0
        )
        return {
            'app_context': {
                'disk_capacity': dict_capacity,
                'sub_title': sub_title,
                'is_admin': str(is_admin),
                'log_level': str(is_default_log_level),
                'hide_setting_page': str(is_hide_setting_page),
                'app_startup_time': app_startup_time,
                'app_group': ga_info.app_group.value,
                'app_version': str(ga_info.app_version).strip('\n'),
                'app_source': str(ga_info.app_source.value).strip('\n'),
                'app_type': ga_info.app_type.value,
                'app_os': ga_info.app_os.value,
                'ga_tracking_id': app.config['GA_TRACKING_ID'],
                'is_authorized': str(int(is_authorized())),
            },
        }

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

    @app.after_request
    def after_request_callback(response: Response):
        if 'event-stream' in str(request.accept_mimetypes):
            return response

        if not request.cookies.get(key_port('locale')):
            response.set_cookie(key_port('locale'), lang)

        # close app db session
        close_sessions()

        response.cache_control.public = True
        if request.endpoint and request.endpoint in NO_CACHING_ENDPOINTS:
            response.cache_control.no_cache = True

        # better performance
        if not request.content_type:
            response.cache_control.max_age = 60 * 5
            response.cache_control.must_revalidate = True

        response.direct_passthrough = False
        response.add_etag()
        response.make_conditional(request)
        if response.status_code == HTML_CODE_304:
            return response

        resource_type = request.base_url or ''
        is_ignore_content = any(resource_type.endswith(extension) for extension in LOG_IGNORE_CONTENTS)
        if not is_ignore_content:
            bind_user_info(request, response)

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

        response = json_dumps({'message': 'No data Found!'})
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
