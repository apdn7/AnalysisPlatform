import os

from apscheduler.executors.pool import ThreadPoolExecutor, ProcessPoolExecutor
from loguru import logger

from histview2.common.common_utils import resource_path

basedir = os.getcwd()


class Config(object):
    SECRET_KEY = '736670cb10a600b695a55839ca3a5aa54a7d7356cdef815d2ad6e19a2031182b'
    POSTS_PER_PAGE = 10
    PORT = 80
    parent_dir = os.path.dirname(basedir)
    os.environ['FLASK_ENV'] = os.environ.get('FLASK_ENV', 'development')
    R_PORTABLE = os.environ.get('R-PORTABLE')
    if not R_PORTABLE:
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

    BABEL_DEFAULT_LOCALE = "en"

    # yaml config files name
    YAML_CONFIG_BASIC = 'basic_config.yml'
    YAML_CONFIG_DB = 'db_config.yml'
    YAML_CONFIG_PROC = 'proc_config.yml'
    YAML_CONFIG_HISTVIEW2 = 'histview2_config.yml'
    YAML_TILE_INTERFACE_DN7 = 'tile_interface_dn7.yml'
    YAML_TILE_INTERFACE_AP = 'tile_interface_analysis_platform.yml'

    # run `python histview2/script/generate_db_secret_key.py` to generate DB_SECRET_KEY
    DB_SECRET_KEY = "4hlAxWLWt8Tyqi5i1zansLPEXvckXR2zrl_pDkxVa-A="

    # timeout
    SQLALCHEMY_ENGINE_OPTIONS = {'connect_args': {'timeout': 30}}

    # APScheduler
    SCHEDULER_EXECUTORS = {
        'default': ThreadPoolExecutor(100),
        'processpool': ProcessPoolExecutor(5)
    }

    SCHEDULER_JOB_DEFAULTS = {
        'coalesce': True,
        'max_instances': 1,
        'misfire_grace_time': 2 * 60
    }
    VERSION_FILE_PATH = resource_path('VERSION')
    BASE_DIR = basedir
    GA_TRACKING_ID = 'UA-156244372-2'
    PARTITION_NUMBER = 100

    COMPRESS_MIMETYPES = [
        "text/html",
        "text/css",
        "text/xml",
        "text/csv",
        "text/tsv",
        "application/json",
        "application/javascript",
    ]
    COMPRESS_LEVEL = 6
    COMPRESS_MIN_SIZE = 500


class ProdConfig(Config):
    DEBUG = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLITE_CONFIG_DIR = os.path.join(basedir, 'instance')
    UNIVERSAL_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'universal.sqlite3')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + UNIVERSAL_DB_FILE
    APP_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'app.sqlite3')
    SQLALCHEMY_DATABASE_APP_URI = 'sqlite:///' + APP_DB_FILE
    # have to keep SQLALCHEMY_BINDS before SCHEDULER_JOBSTORES -> avoid overwrite
    SQLALCHEMY_BINDS = {
        'app_metadata': SQLALCHEMY_DATABASE_APP_URI
    }
    # SCHEDULER_JOBSTORES = {
    #     'default': SQLAlchemyJobStore(url='sqlite:///' + os.path.join(basedir, 'instance', 'app.sqlite3'))
    # }
    YAML_CONFIG_DIR = os.path.join(basedir, 'histview2', 'config')


class DevConfig(Config):
    DEBUG = True
    SQLALCHEMY_TRACK_MODIFICATIONS = True
    SQLITE_CONFIG_DIR = os.path.join(basedir, 'instance')
    UNIVERSAL_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'universal.sqlite3')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + UNIVERSAL_DB_FILE
    APP_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'app.sqlite3')
    SQLALCHEMY_DATABASE_APP_URI = 'sqlite:///' + APP_DB_FILE
    # have to keep SQLALCHEMY_BINDS before SCHEDULER_JOBSTORES -> avoid overwrite
    SQLALCHEMY_BINDS = {
        'app_metadata': SQLALCHEMY_DATABASE_APP_URI
    }
    # SCHEDULER_JOBSTORES = {
    #     'default': SQLAlchemyJobStore(url='sqlite:///' + os.path.join(basedir, 'instance', 'app.sqlite3'))
    # }
    YAML_CONFIG_DIR = os.path.join(basedir, 'histview2', 'config')


class TestingConfig(Config):
    DEBUG = False
    TESTING = True
    SQLALCHEMY_TRACK_MODIFICATIONS = True
    SQLITE_CONFIG_DIR = os.path.join(basedir, 'tests', 'instances')
    UNIVERSAL_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'universal.sqlite3')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + UNIVERSAL_DB_FILE
    APP_DB_FILE = os.path.join(SQLITE_CONFIG_DIR, 'app.sqlite3')
    SQLALCHEMY_DATABASE_APP_URI = 'sqlite:///' + APP_DB_FILE

    SQLALCHEMY_BINDS = {
        'app_metadata': SQLALCHEMY_DATABASE_APP_URI
    }
    # SCHEDULER_JOBSTORES = {
    #     'default': SQLAlchemyJobStore(url='sqlite:///' + os.path.join(basedir, 'tests', 'instances', 'app.sqlite3'))
    # }
    YAML_CONFIG_DIR = os.path.join(basedir, 'tests', 'histview2', 'config')
    PARTITION_NUMBER = 2
