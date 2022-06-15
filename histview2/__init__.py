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
from loguru import logger
from sqlalchemy import create_engine, event
from sqlalchemy.orm import scoped_session, create_session

from histview2.common.common_utils import check_exist, make_dir, find_babel_locale
from histview2.common.common_utils import set_sqlite_params
from histview2.common.constants import FlaskGKey, SQLITE_CONFIG_DIR, PARTITION_NUMBER, UNIVERSAL_DB_FILE, APP_DB_FILE, \
    TESTING
from histview2.common.logger import log_execution
from histview2.common.services.request_time_out_handler import requestTimeOutAPI
from histview2.common.trace_data_log import get_log_attr, TraceErrKey

db = SQLAlchemy()
migrate = Migrate()
scheduler = APScheduler()
ma = Marshmallow()
wtforms_json.init()

background_jobs = {}

LOG_IGNORE_CONTENTS = ('.html', '.js', '.css', '.ico', '.png')
# yaml config files
dic_yaml_config_file = dict(basic=None, db=None, proc=None, histview2=None, version='0', ti_dn7=None,
                            ti_analysis_platform=None)
dic_config = {'db_secret_key': None, SQLITE_CONFIG_DIR: None, PARTITION_NUMBER: None, APP_DB_FILE: None,
              UNIVERSAL_DB_FILE: None, TESTING: None}

# last request time
dic_request_info = {'last_request_time': datetime.utcnow()}

# ############## init application metadata db ###############
db_engine = None


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
    from flask import request

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

    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    init_engine(app, app.config['SQLALCHEMY_DATABASE_APP_URI'])

    # reset import history when no universal db
    if should_reset_import_history:
        from histview2.script.hot_fix.fix_db_issues import reset_import_history
        reset_import_history(app)

    # yaml files path
    yaml_config_dir = app.config.get('YAML_CONFIG_DIR')
    dic_yaml_config_file['basic'] = os.path.join(yaml_config_dir, app.config['YAML_CONFIG_BASIC'])
    dic_yaml_config_file['db'] = os.path.join(yaml_config_dir, app.config['YAML_CONFIG_DB'])
    dic_yaml_config_file['proc'] = os.path.join(yaml_config_dir, app.config['YAML_CONFIG_PROC'])
    dic_yaml_config_file['histview2'] = os.path.join(yaml_config_dir, app.config['YAML_CONFIG_HISTVIEW2'])
    dic_yaml_config_file['ti_dn7'] = os.path.join(yaml_config_dir, app.config['YAML_TILE_INTERFACE_DN7'])
    dic_yaml_config_file['ti_analysis_platform'] = os.path.join(yaml_config_dir, app.config['YAML_TILE_INTERFACE_AP'])

    # db secret key
    dic_config['DB_SECRET_KEY'] = app.config['DB_SECRET_KEY']

    # sqlalchemy echo flag
    app.config['SQLALCHEMY_ECHO'] = app.config.get('DEBUG')

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

    from histview2.common.yaml_utils import BasicConfigYaml
    basic_config_yaml = BasicConfigYaml()
    basic_config = basic_config_yaml.dic_config
    hide_setting_page = BasicConfigYaml.get_node(basic_config, ['info', 'hide-setting-page'], False)
    lang = BasicConfigYaml.get_node(basic_config, ['info', 'language'], False)
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

        yaml_ver = rows[1] if len(rows) > 1 else '0'
        dic_yaml_config_file['version'] = yaml_ver

        app_location = rows[2] if len(rows) > 2 else 'DN'
        app_location = str(app_location).strip('\n')
        app_location = app_location if app_location != '' else 'DN'

    # start scheduler (Notice: start scheduler at the end , because it may run job before above setting info was set)
    if scheduler.state != STATE_STOPPED:
        scheduler.shutdown(wait=False)

    scheduler.init_app(app)
    scheduler.start()

    # Shut down the scheduler when exiting the app
    atexit.register(lambda: scheduler.shutdown() if scheduler.state !=
                                                    STATE_STOPPED else print('Scheduler is already shutdown'))

    @app.before_request
    def before_request_callback():
        g.request_start_time = time.time()
        # get the last time user request
        global dic_request_info

        resource_type = request.base_url or ''
        is_ignore_content = any(resource_type.endswith(extension) for extension in LOG_IGNORE_CONTENTS)
        if not is_ignore_content:
            dic_request_info['last_request_time'] = datetime.utcnow()
            req_logger = bind_user_info(request)
            req_logger.info("REQUEST ")
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
            from histview2.common.disk_usage import get_disk_capacity_to_load_UI, add_disk_capacity_into_response
            dict_capacity = get_disk_capacity_to_load_UI()
            add_disk_capacity_into_response(response, dict_capacity)
            if not request.cookies.get('locale'):
                response.set_cookie('locale', lang)

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
            res_logger = bind_user_info(request, response)
            res_logger.info("RESPONSE")
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
        return Response(response=response, status=500)
        # return render_template('500.html'), 500

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

    @app.errorhandler(requestTimeOutAPI)
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
    from histview2.common.common_utils import sql_regexp, set_sqlite_params
    from sqlalchemy import event

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
