import os

from apscheduler.executors.pool import ProcessPoolExecutor, ThreadPoolExecutor
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

from ap.common.common_utils import resource_path
from ap.common.logger import logger

basedir = os.getcwd()


class Config(object):
    SECRET_KEY = '736670cb10a600b695a55839ca3a5aa54a7d7356cdef815d2ad6e19a2031182b'
    POSTS_PER_PAGE = 10
    PORT = 80
    os.environ['FLASK_ENV'] = os.environ.get('FLASK_ENV', 'production')
    CICD_BASE_DIR = os.environ.get('CICD_BASE_DIR')
    parent_dir = CICD_BASE_DIR if CICD_BASE_DIR else os.path.dirname(basedir)

    R_PORTABLE = os.path.join(parent_dir, 'R-Portable', 'bin')
    os.environ['PATH'] = '{};{}'.format(R_PORTABLE, os.environ.get('PATH', ''))

    # R-PORTABLEを設定する。
    os.environ['R-PORTABLE'] = os.path.join(parent_dir, 'R-Portable')

    ORACLE_PATH = os.path.join(parent_dir, 'Oracle-Portable')
    os.environ['PATH'] = '{};{}'.format(ORACLE_PATH, os.environ.get('PATH', ''))

    ORACLE_PATH_WITH_VERSION = os.path.join(ORACLE_PATH, 'instantclient_21_3')
    os.environ['PATH'] = '{};{}'.format(ORACLE_PATH_WITH_VERSION, os.environ.get('PATH', ''))

    logger.info(os.environ['PATH'])
    print(R_PORTABLE)

    BABEL_DEFAULT_LOCALE = 'en'

    # run `python ap/script/generate_db_secret_key.py` to generate DB_SECRET_KEY
    DB_SECRET_KEY = '4hlAxWLWt8Tyqi5i1zansLPEXvckXR2zrl_pDkxVa-A='

    # CREATE_ENGINE_PARAMS = {'timeout': 180, 'isolation_level': 'IMMEDIATE'}
    CREATE_ENGINE_PARAMS = {'timeout': 60 * 5}
    # timeout
    SQLALCHEMY_ENGINE_OPTIONS = {'connect_args': CREATE_ENGINE_PARAMS}
    # SQLALCHEMY_POOL_SIZE = 20
    # SQLALCHEMY_MAX_OVERFLOW = 0

    # APScheduler
    SCHEDULER_EXECUTORS = {
        'default': ProcessPoolExecutor(5),
        'threadpool': ThreadPoolExecutor(100),
    }

    SCHEDULER_JOB_DEFAULTS = {'coalesce': True, 'max_instances': 1, 'misfire_grace_time': 2 * 60}
    VERSION_FILE_PATH = resource_path('VERSION')
    BASE_DIR = basedir
    GA_TRACKING_ID = 'G-9DJ9TV72B5'

    COMPRESS_MIMETYPES = [
        'text/html',
        'text/css',
        'text/xml',
        'text/csv',
        'text/tsv',
        'application/json',
        'application/javascript',
    ]
    COMPRESS_LEVEL = 6
    COMPRESS_MIN_SIZE = 500

    INIT_CONFIG_DIR = os.path.join(basedir, 'init')
    INIT_LOG_DIR = os.path.join(basedir, 'log')
    INIT_APP_DB_FILE = os.path.join(INIT_CONFIG_DIR, 'app.sqlite3')
    INIT_BASIC_CFG_FILE = os.path.join(INIT_CONFIG_DIR, 'basic_config.yml')


class ProdConfig(Config):
    DEBUG = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLITE_CONFIG_DIR = os.path.join(basedir, 'instance')
    APP_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'app.sqlite3')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + APP_DB_FILE
    SCHEDULER_FULL_PATH = os.path.join(SQLITE_CONFIG_DIR, 'scheduler.sqlite3')
    SCHEDULER_JOBSTORES = {
        'default': SQLAlchemyJobStore(url='sqlite:///' + SCHEDULER_FULL_PATH),
    }
    YAML_CONFIG_DIR = os.path.join(basedir, 'ap', 'config')
    UNIVERSAL_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'transaction')


class DevConfig(Config):
    DEBUG = True
    SQLALCHEMY_TRACK_MODIFICATIONS = True
    SQLITE_CONFIG_DIR = os.path.join(basedir, 'instance')
    APP_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'app.sqlite3')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + APP_DB_FILE
    SCHEDULER_FULL_PATH = os.path.join(SQLITE_CONFIG_DIR, 'scheduler.sqlite3')
    SCHEDULER_JOBSTORES = {
        'default': SQLAlchemyJobStore(url='sqlite:///' + SCHEDULER_FULL_PATH),
    }
    YAML_CONFIG_DIR = os.path.join(basedir, 'ap', 'config')
    UNIVERSAL_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'transaction')


class TestingConfig(Config):
    DEBUG = False
    TESTING = True
    SQLALCHEMY_TRACK_MODIFICATIONS = True
    SQLITE_CONFIG_DIR = os.path.join(basedir, 'tests', 'instances')
    APP_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'app.sqlite3')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + APP_DB_FILE
    SCHEDULER_FULL_PATH = os.path.join(SQLITE_CONFIG_DIR, 'scheduler.sqlite3')
    SCHEDULER_JOBSTORES = {
        'default': SQLAlchemyJobStore(url='sqlite:///' + SCHEDULER_FULL_PATH),
    }
    YAML_CONFIG_DIR = os.path.join(basedir, 'tests', 'ap', 'config')
    UNIVERSAL_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'transaction')
