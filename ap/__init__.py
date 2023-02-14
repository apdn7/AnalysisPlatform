import atexit
import os
import time
from datetime import datetime

import wtforms_json
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from flask import Flask, render_template, Response, g, json
from flask_apscheduler import APScheduler, STATE_STOPPED
from flask_babel import Babel
from flask_compress import Compress
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from ap.common.logger import logger
from sqlalchemy import create_engine, event
from sqlalchemy.orm import scoped_session, create_session

from ap.common.common_utils import check_exist, make_dir, find_babel_locale, NoDataFoundException
from ap.common.common_utils import set_sqlite_params, init_config
from ap.common.constants import FlaskGKey, SQLITE_CONFIG_DIR, PARTITION_NUMBER, UNIVERSAL_DB_FILE, APP_DB_FILE, \
    TESTING, YAML_CONFIG_VERSION, YAML_CONFIG_BASIC, YAML_CONFIG_DB, YAML_CONFIG_PROC, YAML_CONFIG_AP, \
    INIT_APP_DB_FILE, INIT_BASIC_CFG_FILE, REQUEST_THREAD_ID, YAML_START_UP, LOG_LEVEL, AP_LOG_LEVEL
from ap.common.logger import log_execution
from ap.common.services.request_time_out_handler import RequestTimeOutAPI, set_request_g_dict
from ap.common.trace_data_log import get_log_attr, TraceErrKey
from ap.common.yaml_utils import YAML_CONFIG_BASIC_FILE_NAME, YAML_CONFIG_AP_FILE_NAME, \
    YAML_CONFIG_PROC_FILE_NAME, YAML_CONFIG_DB_FILE_NAME, BasicConfigYaml, YAML_START_UP_FILE_NAME

db = SQLAlchemy(session_options={'autoflush': False})
migrate = Migrate()
scheduler = APScheduler()
ma = Marshmallow()
wtforms_json.init()

background_jobs = {}

LOG_IGNORE_CONTENTS = ('.html', '.js', '.css', '.ico', '.png')
# yaml config files
dic_yaml_config_file = dict(basic=None, db=None, proc=None, ap=None, version=0)
dic_config = {'db_secret_key': None, SQLITE_CONFIG_DIR: None, PARTITION_NUMBER: None, APP_DB_FILE: None,
              UNIVERSAL_DB_FILE: None, TESTING: None}

# last request time
dic_request_info = {'last_request_time': datetime.utcnow()}

# ############## init application metadata db ###############
db_engine = None

# basic yaml
dic_yaml_config_instance = {}


def init_engine(app, uri, **kwargs):
    global db_engine
    # By default, sqlalchemy does not overwrite table. Then no need to manually check file exists neither table exists.
    # https://docs.sqlalchemy.org/en/14/core/metadata.html?highlight=create_all#sqlalchemy.schema.MetaData.create_all
    db.create_all(app=app)
    db_engine = create_engine(uri, **kwargs)

    @event.listens_for(db_engine, 'connect')
    def do_connect(dbapi_conn, connection_record):
        set_sqlite_params(dbapi_conn)

    return db_engine


Session = scoped_session(lambda: create_session(
    bind=db_engine,
    autoflush=True,
    autocommit=False,
    expire_on_commit=True
))


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
    try:
        g.pop(FlaskGKey.APP_DB_SESSION)
    except Exception:
        pass


# ##########################################################


def create_app(object_name=None):
    """Create and configure an instance of the Flask application."""
    from flask import request
    from .api import create_module as api_create_module
    from .tile_interface import create_module as tile_interface_create_module
    from .setting_module import create_module as setting_create_module
    from .trace_data import create_module as trace_data_create_module
    from .analyze import create_module as analyze_create_module
    from .table_viewer import create_module as table_viewer_create_module
    from .scatter_plot import create_module as scatter_plot_create_module
    from .heatmap import create_module as heatmap_create_module
    from .categorical_plot import create_module as categorical_create_module
    from .ridgeline_plot import create_module as ridgeline_create_module
    from .parallel_plot import create_module as parallel_create_module
    from .sankey_plot import create_module as sankey_create_module
    from .co_occurrence import create_module as co_occurrence_create_module
    from .multiple_scatter_plot import create_module as multiple_scatter_create_module
    from .common.logger import bind_user_info
    from .script.convert_user_setting import convert_user_setting_url
    from .script.migrate_csv_datatype import migrate_csv_datatype
    from .script.migrate_csv_dummy_datetime import migrate_csv_dummy_datetime
    from .script.migrate_csv_save_graph_settings import migrate_csv_save_graph_settings

    app = Flask(__name__)
    app.config.from_object(object_name)

    app.config.update(
        SCHEDULER_JOBSTORES={
            'default': SQLAlchemyJobStore(
                url=app.config['SQLALCHEMY_DATABASE_APP_URI'])
        },
    )
    # table partition number
    dic_config[PARTITION_NUMBER] = app.config[PARTITION_NUMBER]

    # db directory
    dic_config[SQLITE_CONFIG_DIR] = app.config[SQLITE_CONFIG_DIR]

    # db files
    dic_config[APP_DB_FILE] = app.config[APP_DB_FILE]
    dic_config[UNIVERSAL_DB_FILE] = app.config[UNIVERSAL_DB_FILE]

    # testing param
    dic_config[TESTING] = app.config.get(TESTING, None)

    # check and create instance folder before run db init
    if not check_exist(dic_config[SQLITE_CONFIG_DIR]):
        make_dir(dic_config[SQLITE_CONFIG_DIR])

    should_reset_import_history = False
    if not check_exist(app.config['UNIVERSAL_DB_FILE']):
        should_reset_import_history = True

    # check and copy appDB to instance if not existing
    init_config(app.config[APP_DB_FILE], app.config[INIT_APP_DB_FILE])

    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    init_engine(app, app.config['SQLALCHEMY_DATABASE_APP_URI'])
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
    dic_config['DB_SECRET_KEY'] = app.config['DB_SECRET_KEY']

    # sqlalchemy echo flag
    app.config['SQLALCHEMY_ECHO'] = app.config.get('DEBUG')

    dic_config['INIT_LOG_DIR'] = app.config.get('INIT_LOG_DIR')

    babel = Babel(app)
    Compress(app)

    api_create_module(app)
    scatter_plot_create_module(app)
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
    app.add_url_rule('/', endpoint='tile_interface.tile_interface')

    basic_config_yaml = BasicConfigYaml(dic_yaml_config_file[YAML_CONFIG_BASIC])
    start_up_yaml = BasicConfigYaml(dic_yaml_config_file[YAML_START_UP])
    hide_setting_page = basic_config_yaml.get_node(['info', 'hide-setting-page'], False)
    default_log_level = basic_config_yaml.get_node(['info', LOG_LEVEL], AP_LOG_LEVEL.INFO.name)
    is_default_log_level = default_log_level == AP_LOG_LEVEL.INFO.name
    dic_yaml_config_instance[YAML_CONFIG_BASIC] = basic_config_yaml
    dic_yaml_config_instance[YAML_START_UP] = start_up_yaml

    lang = start_up_yaml.get_node(['setting_startup', 'language'], None)
    sub_title = start_up_yaml.get_node(['setting_startup', 'subtitle'], '')

    if lang is None or not lang:
        lang = basic_config_yaml.get_node(['info', 'language'], False)

    lang = find_babel_locale(lang)
    lang = lang or app.config["BABEL_DEFAULT_LOCALE"]

    @babel.localeselector
    def get_locale():
        return request.cookies.get('locale') or lang

    # get app version
    version_file = app.config.get('VERSION_FILE_PATH') or os.path.join(os.getcwd(), 'VERSION')
    with open(version_file) as f:
        rows = f.readlines()
        app_ver = rows[0]
        if '%%VERSION%%' in app_ver:
            app_ver = 'v00.00.000.00000000'

        dic_yaml_config_file[YAML_CONFIG_VERSION] = rows[1] if len(rows) > 1 else '0'

        app_location = rows[2] if len(rows) > 2 else 'DN'
        app_location = str(app_location).strip('\n')
        app_location = app_location if app_location != '' else 'DN'

    # Universal DB init
    init_db(app)

    # migrate csv datatype
    migrate_csv_datatype(app.config['APP_DB_FILE'])
    migrate_csv_dummy_datetime(app.config['APP_DB_FILE'])
    migrate_csv_save_graph_settings(app.config['APP_DB_FILE'])

    # convert_user_setting()
    convert_user_setting_url()

    # start scheduler (Notice: start scheduler at the end , because it may run job before above setting info was set)
    if scheduler.state != STATE_STOPPED:
        scheduler.shutdown(wait=False)

    scheduler.init_app(app)
    print('SCHEDULER START!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    scheduler.start()

    # Shut down the scheduler when exiting the app
    atexit.register(
        lambda: scheduler.shutdown() if scheduler.state != STATE_STOPPED else print('Scheduler is already shutdown'))

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
        if not is_ignore_content:
            dic_request_info['last_request_time'] = datetime.utcnow()
            bind_user_info(request)
            browser_info = request.user_agent.browser or 'chrome'
            print("user's browser:", browser_info)
            browser_info = str(browser_info).lower()
            is_good_browser = any(name in browser_info in browser_info for name in ('chrome', 'edge'))
            # if request.headers.environ.get('HTTP_SEC_CH_UA') and 'chrome' not in request.user_agent.browser.lower():
            if not dic_config.get(TESTING) and not is_good_browser:
                return render_template('none.html', **{
                    "title": "お使いのブラウザーはサポートされていません。",
                    "message": "現在のバージョンはChromeブラウザのみをサポートしています！",
                    "action": "Chrome を今すぐダウンロード: ",
                    "url": "https://www.google.com/chrome/"
                })

    @app.after_request
    def after_request_callback(response: Response):
        if 'event-stream' in str(request.accept_mimetypes):
            return response

        # In case of text/html request, add information of disk capacity to show up on UI.
        if 'text/html' in str(request.accept_mimetypes) or 'text/html' in str(response.headers):
            from ap.common.disk_usage import get_disk_capacity_to_load_UI, add_disk_capacity_into_response
            dict_capacity = get_disk_capacity_to_load_UI()
            add_disk_capacity_into_response(response, dict_capacity)
            if not request.cookies.get('locale'):
                response.set_cookie('locale', lang)
            response.set_cookie('sub_title', sub_title)

        # close app db session
        close_sessions()

        response.cache_control.public = True

        # better performance
        if not request.content_type:
            response.cache_control.max_age = 60 * 5
            response.cache_control.must_revalidate = True

        # check everytime (acceptable performance)
        # response.cache_control.no_cache = True

        response.add_etag()
        response.make_conditional(request)
        if response.status_code == 304:
            return response

        resource_type = request.base_url or ''
        is_ignore_content = any(resource_type.endswith(extension) for extension in LOG_IGNORE_CONTENTS)
        if not is_ignore_content:
            bind_user_info(request, response)
            response.set_cookie('log_level', str(is_default_log_level))
            response.set_cookie('hide_setting_page', str(hide_setting_page))
            response.set_cookie('app_version', str(app_ver).strip('\n'))
            response.set_cookie('app_location', str(app_location).strip('\n'))

        return response

    @app.errorhandler(404)
    def page_not_found(e):
        # note that we set the 404 status explicitly
        return render_template('404.html'), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        # close app db session
        close_sessions()
        logger.exception(e)

        response = json.dumps({
            "code": e.code,
            "message": str(e),
            "dataset_id": get_log_attr(TraceErrKey.DATASET)
        })
        status = 500
        return Response(response=response, status=status)
        # return render_template('500.html'), 500

    @app.errorhandler(NoDataFoundException)
    def no_data_found(e):
        # close app db session
        close_sessions()
        logger.exception(e)

        response = json.dumps({"message": str('No data Found!')})
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
        response = json.dumps({
            "code": e.status_code,
            "message": e.message,
        })
        return Response(response=response, status=408)

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        # close app db session
        close_sessions()
        Session.remove()

    return app


@log_execution()
def init_db(app):
    """
    init db with some parameter
    :return:
    """
    from .common.common_utils import sql_regexp, set_sqlite_params
    db.create_all(app=app)
    # Universal DB init
    # if not universal_db_exists():

    universal_engine = db.get_engine(app)

    @event.listens_for(universal_engine, 'connect')
    def do_connect(dbapi_conn, connection_record):
        set_sqlite_params(dbapi_conn)

    @event.listens_for(universal_engine, "begin")
    def do_begin(dbapi_conn):
        dbapi_conn.connection.create_function('REGEXP', 2, sql_regexp)


@log_execution()
def get_basic_yaml_obj():
    return dic_yaml_config_instance[YAML_CONFIG_BASIC]


@log_execution()
def get_start_up_yaml_obj():
    return dic_yaml_config_instance[YAML_START_UP]
