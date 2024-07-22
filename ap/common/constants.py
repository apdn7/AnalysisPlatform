from __future__ import annotations

from enum import Enum, auto
from typing import Optional

import numpy as np
import pandas as pd
from dateutil import tz

MATCHED_FILTER_IDS = 'matched_filter_ids'
UNMATCHED_FILTER_IDS = 'unmatched_filter_ids'
NOT_EXACT_MATCH_FILTER_IDS = 'not_exact_match_filter_ids'
STRING_COL_IDS = 'string_col_ids'
DIC_STR_COLS = 'dic_str_cols'
SAMPLE_DATA = 'sample_data'
VAR_X = 'X'
VAR_Y = 'Y'
MULTIPLE_VALUES_CONNECTOR = '|'
DEFAULT_NONE_VALUE = pd.NA

SQL_COL_PREFIX = '__'
SQL_IN_MAX = 900
SQL_LIMIT = 5_000_000
ACTUAL_RECORD_NUMBER = 'actual_record_number'
ACTUAL_RECORD_NUMBER_TRAIN = 'actual_record_number_train'
ACTUAL_RECORD_NUMBER_TEST = 'actual_record_number_test'
REMOVED_OUTLIER_NAN_TRAIN = 'removed_outlier_nan_train'
REMOVED_OUTLIER_NAN_TEST = 'removed_outlier_nan_test'
CAST_INF_VALS = 'cast_inf_vals'

YAML_CONFIG_BASIC = 'basic'
YAML_START_UP = 'start_up'
YAML_CONFIG_DB = 'db'
YAML_CONFIG_PROC = 'proc'
YAML_CONFIG_AP = 'ap'
YAML_CONFIG_VERSION = 'version'
YAML_TILE_INTERFACE_DN7 = 'ti_dn7'
YAML_TILE_INTERFACE_AP = 'ti_analysis_platform'
TILE_RESOURCE_URL = '/ap/tile_interface/resources/'
DB_BACKUP_SUFFIX = '_old'
NORMAL_MODE_MAX_RECORD = 10000
MAX_COL_IN_TILES = 4
MAX_COL_IN_USAGE = 3

DEFAULT_WARNING_DISK_USAGE = 80
DEFAULT_ERROR_DISK_USAGE = 90

TRACING_KEY_DELIMITER_SYMBOL = '___'
SHOW_GRAPH_TEMP_TABLE_NAME = 'tmp_show_graph'
SHOW_GRAPH_TEMP_TABLE_COL = 'cycle_id'

DATETIME_DUMMY = 'DatetimeDummy'
FILE_NAME = 'FileName'
MAX_DATETIME_STEP_PER_DAY = 8640  # 10s/step -> 6steps * 60min * 24hrs

RESAMPLING_SIZE = 10_000

LOG_LEVEL = 'log_level'

# fiscal year start month
FISCAL_YEAR_START_MONTH = 4

MAX_SAFE_INTEGER = 9007199254740991
DELIMITER_KW = 'sep'
ENCODING_KW = 'encoding'

MSP_CONTOUR_ADJUST = 0.4227
MSP_AS_HEATMAP_FROM = 10
AS_HEATMAP_MATRIX = 'as_heatmap_matrix'
HEATMAP_MATRIX = 'heatmap_matrix'
MAX_INT_CAT_VALUE = 128
COLORS_ENCODE = 'colors_encode'
FULL_DIV = 'full_div'

DUMMY_V2_PROCESS_NAME = 'DUMMY_V2_PROCESS_NAME'
MIN_DATETIME_LEN = 10

DATA_NAME_V2_SUFFIX = '01'
CONSTRAINT_RANGE = 'constraint_range'
SELECTED = 'selected'


class ApLogLevel(Enum):
    DEBUG = auto()
    INFO = auto()


class FilterFunc(Enum):
    MATCHES = auto()
    ENDSWITH = auto()
    STARTSWITH = auto()
    CONTAINS = auto()
    REGEX = auto()
    SUBSTRING = auto()
    OR_SEARCH = auto()
    AND_SEARCH = auto()


class CsvDelimiter(Enum):
    CSV = ','
    TSV = '\t'
    DOT = '.'
    SMC = ';'
    Auto = None


class DBType(Enum):
    POSTGRESQL = 'postgresql'
    MSSQLSERVER = 'mssqlserver'
    SQLITE = 'sqlite'
    ORACLE = 'oracle'
    MYSQL = 'mysql'
    CSV = 'csv'
    V2 = 'v2'
    V2_MULTI = 'v2_multi'
    V2_HISTORY = 'v2_history'

    @classmethod
    def from_str(cls, s: str) -> Optional['DBType']:
        for e in DBType:
            if s == e.name:
                return e

    def is_db(self):
        return self in [
            DBType.POSTGRESQL,
            DBType.MSSQLSERVER,
            DBType.SQLITE,
            DBType.ORACLE,
            DBType.MYSQL,
        ]


class ErrorMsg(Enum):
    W_PCA_INTEGER = auto()
    E_PCA_NON_NUMERIC = auto()

    E_ALL_NA = auto()
    E_ZERO_VARIANCE = auto()
    E_EMPTY_DF = auto()


# YAML Keywords
YAML_INFO = 'info'
YAML_R_PATH = 'r-path'
YAML_PROC = 'proc'
YAML_SQL = 'sql'
YAML_FROM = 'from'
YAML_SELECT_OTHER_VALUES = 'select-other-values'
YAML_MASTER_NAME = 'master-name'
YAML_WHERE_OTHER_VALUES = 'where-other-values'
YAML_FILTER_TIME = 'filter-time'
YAML_FILTER_LINE_MACHINE_ID = 'filter-line-machine-id'
YAML_MACHINE_ID = 'machine-id'
YAML_DATE_COL = 'date-column'
YAML_AUTO_INCREMENT_COL = 'auto_increment_column'
YAML_SERIAL_COL = 'serial-column'
YAML_SELECT_PREFIX = 'select-prefix'
YAML_CHECKED_COLS = 'checked-columns'
YAML_COL_NAMES = 'column-names'
YAML_DATA_TYPES = 'data-types'
YAML_ALIASES = 'alias-names'
YAML_MASTER_NAMES = 'master-names'
YAML_OPERATORS = 'operators'
YAML_COEFS = 'coefs'
YAML_COL_NAME = 'column_name'
YAML_ORIG_COL_NAME = 'column_name'
YAML_VALUE_LIST = 'value_list'
YAML_VALUE_MASTER = 'value_masters'
YAML_SQL_STATEMENTS = 'sql_statements'
YAML_TRACE = 'trace'
YAML_TRACE_BACK = 'back'
YAML_TRACE_FORWARD = 'forward'
YAML_CHART_INFO = 'chart-info'
YAML_DEFAULT = 'default'
YAML_THRESH_H = 'thresh_high'
YAML_THRESH_L = 'thresh_low'
YAML_Y_MAX = 'y_max'
YAML_Y_MIN = 'y_min'
YAML_TRACE_SELF_COLS = 'self-alias-columns'
YAML_TRACE_TARGET_COLS = 'target-orig-columns'
YAML_TRACE_MATCH_SELF = 'self-substr'
YAML_TRACE_MATCH_TARGET = 'target-substr'
YAML_DB = 'db'
YAML_UNIVERSAL_DB = 'universal_db'
# YAML_ETL_FUNC = 'etl_func'
YAML_PROC_ID = 'proc_id'
YAML_PASSWORD = 'password'
YAML_HASHED = 'hashed'
# YAML_DELIMITER = 'delimiter'

# JSON Keywords
GET02_VALS_SELECT = 'GET02_VALS_SELECT'
ARRAY_FORMVAL = 'ARRAY_FORMVAL'
ARRAY_PLOTDATA = 'array_plotdata'
SERIAL_DATA = 'serial_data'
SERIAL_COLUMNS = 'serial_columns'
COMMON_INFO = 'common_info'
DATETIME_COL = 'datetime_col'
CYCLE_IDS = 'cycle_ids'
ARRAY_Y = 'array_y'
ARRAY_Z = 'array_z'
ORIG_ARRAY_Z = 'orig_array_z'
ARRAY_Y_MIN = 'array_y_min'
ARRAY_Y_MAX = 'array_y_max'
ARRAY_Y_TYPE = 'array_y_type'
SLOT_FROM = 'slot_from'
SLOT_TO = 'slot_to'
SLOT_COUNT = 'slot_count'
# IQR = 'iqr'
ARRAY_X = 'array_x'
Y_MAX = 'y-max'
Y_MIN = 'y-min'
# Y_MAX_ORG = 'y_max_org'
# Y_MIN_ORG = 'y_min_org'
# TIME_RANGE = 'time_range'
# TOTAL = 'total'
EMD_TYPE = 'emdType'
DUPLICATE_SERIAL_SHOW = 'duplicated_serial'
DUPLICATED_SERIALS_COUNT = 'dup_check'

UNLINKED_IDXS = 'unlinked_idxs'
NONE_IDXS = 'none_idxs'
ORG_NONE_IDXS = 'org_none_idxs'
INF_IDXS = 'inf_idxs'
NEG_INF_IDXS = 'neg_inf_idxs'
UPPER_OUTLIER_IDXS = 'upper_outlier_idxs'
LOWER_OUTLIER_IDXS = 'lower_outlier_idxs'

SCALE_SETTING = 'scale_setting'
SCALE_THRESHOLD = 'scale_threshold'
SCALE_AUTO = 'scale_auto'
SCALE_COMMON = 'scale_common'
SCALE_FULL = 'scale_full'
KDE_DATA = 'kde_data'
SCALE_Y = 'scale_y'
SCALE_X = 'scale_x'
SCALE_COLOR = 'scale_color'

CHART_INFOS = 'chart_infos'
CHART_INFOS_ORG = 'chart_infos_org'
COMMON = 'COMMON'
SELECT_ALL = 'All'
NO_FILTER = 'NO_FILTER'
START_PROC = 'start_proc'
START_DATE = 'START_DATE'
START_TM = 'START_TIME'
START_DT = 'start_dt'
COND_PROCS = 'cond_procs'
COND_PROC = 'cond_proc'
END_PROC = 'end_proc'
END_DATE = 'END_DATE'
END_TM = 'END_TIME'
END_DT = 'end_dt'
IS_REMOVE_OUTLIER = 'remove_outlier'
REMOVE_OUTLIER_OBJECTIVE_VAR = 'remove_outlier_objective_var'
REMOVE_OUTLIER_EXPLANATORY_VAR = 'remove_outlier_explanatory_var'
REMOVE_OUTLIER_TYPE = 'remove_outlier_type'
REMOVE_OUTLIER_REAL_ONLY = 'is_remove_outlier_real_only'
ABNORMAL_COUNT = 'abnormal_count'
FINE_SELECT = 'fine_select'
TBLS = 'TBLS'
FILTER_PARTNO = 'filter-partno'
FILTER_MACHINE = 'machine_id'
CATE_PROC = 'end_proc_cate'
GET02_CATE_SELECT = 'GET02_CATE_SELECT'
CATEGORY_DATA = 'category_data'
FILTER_DATA = 'filter_data'
CATE_PROCS = 'cate_procs'
TIMES = 'times'
TIME_NUMBERINGS = 'time_numberings'
ELAPSED_TIME = 'elapsed_time'
COLORS = 'colors'
H_LABEL = 'h_label'
V_LABEL = 'v_label'
TIME_MIN = 'time_min'
TIME_MAX = 'time_max'
X_THRESHOLD = 'x_threshold'
Y_THRESHOLD = 'y_threshold'
X_SERIAL = 'x_serial'
Y_SERIAL = 'y_serial'
SORT_KEY = 'sort_key'
FILTER_ON_DEMAND = 'filter_on_demand'
DIV_FROM_TO = 'div_from_to'
PROC_LINK_ORDER = 'proc_link_order'

UNIQUE_SERIAL = 'unique_serial'
UNIQUE_SERIAL_TRAIN = 'unique_serial_train'
UNIQUE_SERIAL_TEST = 'unique_serial_test'
WITH_IMPORT_OPTIONS = 'with_import'
# GET_PARAM = 'get_param'
PROCS = 'procs'
CLIENT_TIMEZONE = 'client_timezone'
DATA_SIZE = 'data_size'
X_OPTION = 'xOption'
SERIAL_PROCESS = 'serialProcess'
SERIAL_COLUMN = 'serialColumn'
SERIAL_ORDER = 'serialOrder'
TEMP_X_OPTION = 'TermXOption'
TEMP_SERIAL_PROCESS = 'TermSerialProcess'
TEMP_SERIAL_COLUMN = 'TermSerialColumn'
TEMP_SERIAL_ORDER = 'TermSerialOrder'
THRESHOLD_BOX = 'thresholdBox'
SCATTER_CONTOUR = 'scatter_contour'
SHOW_ONLY_CONTOUR = 'is_show_contour_only'
ORDER_ARRAY_FORMVAL = 'order_array_formval'
DF_ALL_PROCS = 'dfProcs'
DF_ALL_COLUMNS = 'dfColumns'
CHART_TYPE = 'chartType'
EXPORT_FROM = 'export_from'
AVAILABLE_ORDERS = 'available_ordering_columns'
IS_NOMINAL_SCALE = 'is_nominal_scale'
NOMINAL_VARS = 'nominal_vars'

# CATEGORICAL PLOT
CATE_VARIABLE = 'categoryVariable'
CATE_VALUE_MULTI = 'categoryValueMulti'
PART_NO = 'PART_NO'
MACHINE_ID = 'MACHINE_ID'
COMPARE_TYPE = 'compareType'
CATEGORICAL = 'var'
# TERM = 'term'
RL_CATEGORY = 'category'
RL_CYCLIC_TERM = 'cyclicTerm'
RL_DIRECT_TERM = 'directTerm'
TIME_CONDS = 'time_conds'
# CATE_CONDS = 'cate_conds'
# LINE_NO = 'LINE_NO'
# YAML_LINE_LIST = 'line-list'
# FILTER_OTHER = 'filter-other'
THRESH_HIGH = 'thresh-high'
THRESH_LOW = 'thresh-low'
PRC_MAX = 'prc-max'
PRC_MIN = 'prc-min'
ACT_FROM = 'act-from'
ACT_TO = 'act-to'
CYCLIC_DIV_NUM = 'cyclicTermDivNum'
CYCLIC_INTERVAL = 'cyclicTermInterval'
CYCLIC_WINDOW_LEN = 'cyclicTermWindowLength'
CYCLIC_TERMS = 'cyclic_terms'
END_PROC_ID = 'end_proc_id'
END_PROC_NAME = 'end_proc_name'
END_COL_ID = 'end_col_id'
END_COL_NAME = 'end_col_name'
END_COL_SHOW_NAME = 'end_col_show_name'
RANK_COL = 'before_rank_values'
SUMMARIES = 'summaries'
IS_RESAMPLING = 'is_resampling'
CAT_DISTRIBUTE = 'category_distributed'
CAT_SUMMARY = 'cat_summary'
FMT = 'fmt'
N = 'n'
N_PCTG = 'n_pctg'
N_NA = 'n_na'
N_NA_PCTG = 'n_na_pctg'
N_TOTAL = 'n_total'
UNIQUE_CATEGORIES = 'unique_categories'
UNIQUE_DIV = 'unique_div'
UNIQUE_COLOR = 'unique_color'
CAT_UNIQUE_LIMIT = 200
IS_OVER_UNIQUE_LIMIT = 'isOverUniqueLimit'
DIC_CAT_FILTERS = 'dic_cat_filters'
TEMP_CAT_EXP = 'temp_cat_exp'
TEMP_CAT_PROCS = 'temp_cat_procs'
DIV_BY_DATA_NUM = 'dataNumber'
DIV_BY_CAT = 'div'
COLOR_VAR = 'colorVar'
IS_DATA_LIMITED = 'isDataLimited'
COL_DETAIL = 'col_detail'
# RANK_VAL = 'rank_value'
COL_TYPE = 'type'
ORG_ARRAY_Y = 'org_array_y'
CAT_ON_DEMAND = 'cat_on_demand'

# Cat Expansion
CAT_EXP_BOX = 'catExpBox'
CAT_EXP_BOX_NAME = 'catExpBoxName'

# Order columns
INDEX_ORDER_COLS = 'indexOrderColumns'
THIN_DATA_GROUP_COUNT = 'thinDataGroupCounts'

# validate data flag
IS_VALIDATE_DATA = 'isValidateData'
# Substring column name in universal db
SUB_STRING_COL_NAME = '{}_From_{}_To_{}'
SUB_STRING_REGEX = r'^(.+)_From_(\d+)_To_(\d+)$'

# CHM & HMp
HM_STEP = 'step'
HM_MODE = 'mode'
HM_FUNCTION_REAL = 'function_real'
HM_FUNCTION_CATE = 'function_cate'
HM_TRIM = 'remove_outlier'
CELL_SUFFIX = '_cell'
AGG_COL = 'agg_col'
TIME_COL = 'time'
TIME_COL_LOCAL = 'time_local'
INDEX = 'index'
COLOR_BAR_TTTLE = 'color_bar_title'
UNIQUE_INT_DIV = 'unique_int_div'
IS_CAT_COLOR = 'is_cat_color'

REQUEST_THREAD_ID = 'thread_id'
SERIALS = 'serials'
DATETIME = 'datetime'

AGP_COLOR_VARS = 'aggColorVar'
DIVIDE_OFFSET = 'divideOffset'
DIVIDE_FMT = 'divideFormat'
DIVIDE_FMT_COL = 'divide_format'
COLOR_NAME = 'color_name'
DATA = 'data'
SHOWN_NAME = 'shown_name'
COL_DATA_TYPE = 'data_type'
DIVIDE_CALENDAR_DATES = 'divDates'
DIVIDE_CALENDAR_LABELS = 'divFormats'

#  data group type of column
DATA_GROUP_TYPE = 'data_group_type'
IS_SERIAL_NO = 'is_serial_no'
IS_INT_CATEGORY = 'is_int_category'


class HMFunction(Enum):
    max = auto()
    min = auto()
    mean = auto()
    std = auto()
    range = auto()
    median = auto()
    count = auto()
    count_per_hour = auto()
    count_per_min = auto()
    first = auto()
    last = auto()
    time_per_count = auto()
    iqr = auto()
    ratio = 'Ratio[%]'


class RelationShip(Enum):
    ONE = auto()
    MANY = auto()


class AbsPath(Enum):
    SHOW = auto()
    HIDE = auto()


class DataType(Enum):
    NULL = 0
    INTEGER = 1
    REAL = 2
    TEXT = 3
    DATETIME = 4
    REAL_SEP = 5
    INTEGER_SEP = 6
    EU_REAL_SEP = 7
    EU_INTEGER_SEP = 8
    K_SEP_NULL = 9
    BIG_INT = 10
    BOOLEAN = 11
    DATE = 12
    TIME = 13


class DataTypeEncode(Enum):
    NULL = ''
    INTEGER = 'Int'
    REAL = 'Real'
    TEXT = 'Str'
    CATEGORY = 'Int(Cat)'
    DATETIME = 'CT'
    BIG_INT = 'BigInt'


class JobStatus(Enum):
    def __str__(self):
        return str(self.name)

    PENDING = 0
    PROCESSING = 1
    DONE = 2
    KILLED = 3
    FAILED = 4
    FATAL = 5  # error when insert to db commit, file lock v...v ( we need re-run these files on the next job)

    @classmethod
    def failed_statuses(cls):
        return [
            cls.FAILED.name,
            cls.FATAL.name,
        ]


class Outliers(Enum):
    NOT_OUTLIER = 0
    IS_OUTLIER = 1


class FlaskGKey(Enum):
    TRACE_ERR = auto()
    YAML_CONFIG = auto()
    APP_DB_SESSION = auto()
    DEBUG_SHOW_GRAPH = auto()
    MEMOIZE = auto()
    THREAD_ID = auto()


class DebugKey(Enum):
    IS_DEBUG_MODE = auto()
    GET_DATA_FROM_DB = auto()


class MemoizeKey(Enum):
    STOP_USING_CACHE = auto()


# error message for dangling jobs
FORCED_TO_BE_FAILED = 'DANGLING JOB. FORCED_TO_BE_FAILED'
DEFAULT_POLLING_FREQ = 180  # default is import every 3 minutes


class CfgConstantType(Enum):
    def __str__(self):
        return str(self.name)

    # CHECKED_COLUMN = 0  # TODO define value
    # GUI_TYPE = 1
    # FILTER_REGEX = 2
    # PARTNO_LIKE = 3
    POLLING_FREQUENCY = auto()
    ETL_JSON = auto()
    UI_ORDER = auto()
    USE_OS_TIMEZONE = auto()
    TS_CARD_ORDER = auto()
    EFA_HEADER_EXISTS = auto()
    DISK_USAGE_CONFIG = auto()
    CHECK_DB_LOCK = auto()
    CONVERTED_USER_SETTING_URL = auto()
    MAX_GRAPH_NUMBER = auto()


# UI order types
UI_ORDER_DB = 'tblDbConfig'
# UI_ORDER_PROC = 'tblProcConfig'

# SQL
# SQL_PERCENT = '%'
SQL_REGEX_PREFIX = 'RAINBOW7_REGEX:'
SQL_REGEXP_FUNC = 'REGEXP'

# DATA TRACE LOG CONST
# Measurement Protocol Server
MPS = 'www.google-analytics.com'
R_PORTABLE = 'R-Portable'
R_LIB_VERSION = 'R_LIB_VERSION'

# Message
MSG_DB_CON_FAILED = 'Database connection failed! Please check your database connection information'
MSG_NOT_SUPPORT_DB = 'This application does not support this type of database!'

# encoding
ENCODING_SHIFT_JIS = 'cp932'
ENCODING_UTF_8 = 'utf-8'
ENCODING_UTF_8_BOM = 'utf-8-sig'
ENCODING_ASCII = 'ascii'

# Web socket
LISTEN_BACKGROUND_TIMEOUT = 10  # seconds

# Dictionary Key

# WRAPR keys
WR_CTGY = 'ctgy'
WR_HEAD = 'head'
WR_RPLC = 'rplc'
WR_VALUES = 'values'
WR_HEADER_NAMES = 'header_name'
WR_TYPES = 'types'
# RIDGELINE
RL_GROUPS = 'groups'
RL_EMD = 'emd'
RL_DATA = 'data'
RL_RIDGELINES = 'ridgelines'
SENSOR_ID = 'sensor_id'
# RL_ARRAY_X = 'array_x'
RL_CATE_NAME = 'cate_name'
# RL_PERIOD = 'From|To'
RL_SENSOR_NAME = 'sensor_name'
PROC_NAME = 'proc_name'
PROC_MASTER_NAME = 'proc_master_name'
RL_KDE = 'kde_data'
RL_DEN_VAL = 'kde'
RL_ORG_DEN = 'origin_kde'
RL_TRANS_VAL = 'transform_val'
RL_TRANS_DEN = 'trans_kde'
RL_XAXIS = 'rlp_xaxis'
RL_YAXIS = 'rlp_yaxis'
RL_HIST_LABELS = 'hist_labels'
RL_HIST_COUNTS = 'hist_counts'
RL_DATA_COUNTS = 'data_counts'
RL_CATES = 'categories'

# SkD
# SKD_TARGET_PROC_CLR = '#65c5f1'

# tile interface
# TILE_INTERFACE = 'tile_interface'
SECTIONS = 'sections'
DN7_TILE = 'dn7'
AP_TILE = 'analysis_platform'
SEARCH_USAGE = 'usage'
TILE_MASTER = 'tile_master'
TILE_JUMP_CFG = 'jump'
RCMDS = 'recommends'
UN_AVAILABLE = 'unavailable'
ALL_TILES = 'all'
TILES = 'tiles'
# UNDER_SCORE = '_'
TITLE = 'title'
HOVER = 'hover'
DESCRIPTION = 'description'
EXAMPLE = 'example'
ICON_PATH = 'icon_path'
PAGE = 'page'
PNG_PATH = 'png_path'
LINK_ADD = 'link_address'
ROW = 'row'
COLUMN = 'column'
ENG = 'en'


# actions
class Action(Enum):
    def __str__(self):
        return str(self.name)

    SHUTDOWN_APP = auto()


class YType(Enum):
    NORMAL = 0
    INF = 1
    NEG_INF = -1
    NONE = 2
    OUTLIER = 3
    NEG_OUTLIER = -3
    UNLINKED = -4


class ProcessCfgConst(Enum):
    PROC_ID = 'id'
    PROC_COLUMNS = 'columns'


class EFAColumn(Enum):
    def __str__(self):
        return str(self.name)

    Line = auto()
    Process = auto()
    Machine = auto()


EFA_HEADER_FLAG = '1'


class Operator(Enum):
    def __str__(self):
        return str(self.name)

    PLUS = '+'
    MINUS = '-'
    PRODUCT = '*'
    DEVIDE = '/'
    REGEX = 'regex'


class AggregateBy(Enum):
    DAY = 'Day'
    HOUR = 'Hour'


# App Config keys
DB_SECRET_KEY = 'DB_SECRET_KEY'
SQLITE_CONFIG_DIR = 'SQLITE_CONFIG_DIR'
UNIVERSAL_DB_FILE = 'UNIVERSAL_DB_FILE'
APP_DB_FILE = 'APP_DB_FILE'
INIT_APP_DB_FILE = 'INIT_APP_DB_FILE'
INIT_BASIC_CFG_FILE = 'INIT_BASIC_CFG_FILE'
TESTING = 'TESTING'
CAST_DATA_TYPE_ERROR_MSG = 'Cast Data Type Error'

DATA_TYPE_ERROR_MSG = 'There is an error with the data type.'
DATA_TYPE_DUPLICATE_MSG = 'There are duplicate records in the data file.'
DATA_TYPE_ERROR_EMPTY_DATA = 'The data file is empty.'


class DataImportErrorTypes(Enum):
    COL_NOT_FOUND = 1
    TABLE_NOT_FOUND = 2
    EMPTY_DATA_FILE = 3
    DB_LOCKED = 4

    UNKNOWN = 100


UNKNOWN_ERROR_TEXT = 'An unknown error occurred'

ErrorMsgText = {
    DataImportErrorTypes.COL_NOT_FOUND: 'It is possible that a column could not be found.',
    DataImportErrorTypes.TABLE_NOT_FOUND: 'The table could not be found.',
    DataImportErrorTypes.EMPTY_DATA_FILE: 'The data file is empty.',
    DataImportErrorTypes.DB_LOCKED: 'The database is locked and data cannot be written.',
}

ErrorMsgFromDB = {
    DataImportErrorTypes.DB_LOCKED: 'database is locked',
    DataImportErrorTypes.TABLE_NOT_FOUND: 'no such table',
}

AUTO_BACKUP = 'auto-backup-universal'
ANALYSIS_INTERFACE_ENV = 'ANALYSIS_INTERFACE_ENV'


class AppEnv(Enum):
    PRODUCTION = 'prod'
    DEVELOPMENT = 'dev'
    TEST = 'test'


THIN_DATA_CHUNK = 4000
THIN_DATA_COUNT = THIN_DATA_CHUNK * 3

# variables correlation
CORRS = 'corrs'
CORR = 'corr'
PCORR = 'pcorr'
NTOTALS = 'ntotals'

# Heatmap
MAX_TICKS = 8
AGG_FUNC = 'agg_function'
CATE_VAL = 'cate_value'
END_COL = 'end_col'
X_TICKTEXT = 'x_ticktext'
X_TICKVAL = 'x_tickvals'
Y_TICKTEXT = 'y_ticktext'
Y_TICKVAL = 'y_tickvals'
ACT_CELLS = 'actual_num_cell'

OBJ_VAR = 'objectiveVar'
JUMP_WITH_OBJ_ID = 'objective_var'
EXCLUDED_COLUMNS = 'excluded_columns'

CAT_TOTAL = 'cat_total'
IS_CAT_LIMITED = 'is_cat_limited'
IS_CATEGORY = 'is_category'
MAX_CATEGORY_SHOW = 30

# PCA
SHORT_NAMES = 'short_names'
DATAPOINT_INFO = 'data_point_info'
PLOTLY_JSON = 'plotly_jsons'
DIC_SENSOR_HEADER = 'dic_sensor_headers'


# chart type
class ChartType(Enum):
    HEATMAP = 'heatmap'
    SCATTER = 'scatter'
    VIOLIN = 'violin'
    HEATMAP_BY_INT = 'heatmap_by_int'


# Scp sub request params
MATRIX_COL = 'colNumber'
COLOR_ORDER = 'scpColorOrder'


# COLOR ORDER
class ColorOrder(Enum):
    DATA = 1
    TIME = 2
    ELAPSED_TIME = 3


# import export debug info
DIC_FORM_NAME = 'dic_form'
DF_NAME = 'df'
CONFIG_DB_NAME = 'config_db'
USER_SETTING_NAME = 'user_setting'


# Disk usage warning level
class DiskUsageStatus(Enum):
    Normal = 0
    Warning = 1
    Full = 2


class MaxGraphNumber(Enum):
    AGP_MAX_GRAPH = auto()
    FPP_MAX_GRAPH = auto()
    RLP_MAX_GRAPH = auto()
    CHM_MAX_GRAPH = auto()
    SCP_MAX_GRAPH = auto()
    MSP_MAX_GRAPH = auto()
    STP_MAX_GRAPH = auto()


max_graph_number = {
    MaxGraphNumber.AGP_MAX_GRAPH.name: 18,
    MaxGraphNumber.FPP_MAX_GRAPH.name: 20,
    MaxGraphNumber.RLP_MAX_GRAPH.name: 20,
    MaxGraphNumber.CHM_MAX_GRAPH.name: 18,
    MaxGraphNumber.SCP_MAX_GRAPH.name: 49,
    MaxGraphNumber.MSP_MAX_GRAPH.name: 100,
    MaxGraphNumber.STP_MAX_GRAPH.name: 32,
}

# debug mode
IS_EXPORT_MODE = 'isExportMode'
IS_IMPORT_MODE = 'isImportMode'

# NA
NA_STR = 'NA'
INF_STR = 'Inf'
MINUS_INF_STR = '-Inf'

# Recent
VAR_TRACE_TIME = 'varTraceTime'
TERM_TRACE_TIME = 'termTraceTime'
CYCLIC_TRACE_TIME = 'cyclicTraceTime'
TRACE_TIME = 'traceTime'

# Limited graph flag
IS_GRAPH_LIMITED = 'isGraphLimited'

IMAGES = 'images'

# language
LANGUAGES = [
    'ja',
    'en',
    'it',
    'es',
    'vi',
    'pt',
    'hi',
    'th',
    'zh_CN',
    'zh_TW',
    'ar',
    'bg',
    'ca',
    'cs',
    'cy',
    'de',
    'el',
    'fa',
    'fi',
    'fr',
    'gd',
    'he',
    'hr',
    'hu',
    'id',
    'is',
    'km',
    'ko',
    'lb',
    'mi',
    'mk',
    'mn',
    'ms',
    'my',
    'ne',
    'nl',
    'no',
    'pa',
    'pl',
    'pt',
    'ro',
    'ru',
    'sd',
    'si',
    'sk',
    'sq',
    'sv',
    'te',
    'tl',
    'tr',
]

MAXIMUM_V2_PREVIEW_ZIP_FILES = 5
MAXIMUM_PROCESSES_ORDER_FILES = 3
DF_CHUNK_SIZE = 1_000_000


class EMDType(Enum):
    drift = [False]
    diff = [True]
    both = [False, True]


USE_CONTOUR = 'use_contour'
USE_HEATMAP = 'use_heatmap'
COL_ID = 'column_id'
COL_NAME = 'column_name'
COL_MASTER_NAME = 'column_master_name'
PROC_ID = 'proc_id'
COL_DETAIL_NAME = 'name'
NAME = 'name'
INT_AS_CAT = 'int_as_cat'


class DataCountType(Enum):
    YEAR = 'year'
    MONTH = 'month'
    WEEK = 'week'


class DuplicateSerialShow(Enum):
    SHOW_BOTH = 'all'
    SHOW_FIRST = 'first'
    SHOW_LAST = 'last'


class DuplicateSerialCount(Enum):
    AUTO = 'auto'
    CHECK = 'check'
    SILENT = 'silent'


class AppSource(Enum):
    OSS = 'OSS'
    DN = 'DN'


class AppGroup(Enum):
    DN = 'DN'
    Dev = 'Dev'
    Ext = 'Ext'


class RemoveOutlierType(Enum):
    OP1 = 'Op1'  # p1-p99
    OP5 = 'Op5'  # p5-p95
    O6M = 'O6m'  # q3 + 2.5iqr Majority
    O6I = 'O6i'  # q3 + 2.5iqr Minority
    O6U = 'O6u'  # q3 + 2.5iqr Upper
    O6L = 'O6l'  # q3 + 2.5iqr Lower
    O4M = 'O4m'  # q3 + 1.5iqr Majority
    O4I = 'O4i'  # q3 + 1.5iqr Minority
    O4U = 'O4u'  # q3 + 1.5iqr Upper
    O4L = 'O4l'  # q3 + 1.5iqr Lower
    Majority = 'majority'
    Minority = 'minority'
    Upper = 'upper'
    Lower = 'lower'


ID = 'id'
ROWID = 'rowid'
IS_USE_DUMMY_DATETIME = 'is_use_dummy_datetime'
ENG_NAME = 'en_name'
IS_GET_DATE = 'is_get_date'
IS_DUMMY_DATETIME = 'is_dummy_datetime'
LIST_PROCS = 'list_procs'
GRAPH_FILTER_DETAILS = 'graph_filter_detail_ids'

EMPTY_STRING = ''


class BaseEnum(Enum):
    def __str__(self):
        return self.name

    @classmethod
    def get_items(cls):
        return tuple(cls.__members__.items())

    @classmethod
    def get_keys(cls):
        return tuple(cls.__members__.keys())

    @classmethod
    def get_values(cls):
        return tuple(cls.__members__.values())

    @classmethod
    def get_key(cls, value, default_key=None):
        for _key, _value in cls.__members__.items():
            if value == _value:
                return _key

        return default_key

    @classmethod
    def get_by_name(cls, name, default=None):
        for _key, _value in cls.__members__.items():
            if _key == name:
                return _key, _value

        return default

    @classmethod
    def get_by_enum_value(cls, enum_value, default=None):
        try:
            # return cls.convert_data_type(enum_value)
            return cls(enum_value)
        except ValueError:
            return default


class DataGroupType(BaseEnum):
    """
    Enum supports for handling in system.
    Because user can map this type with some other column name. Should use get_primary_groups instead.
    """

    LINE_ID = 1
    PROCESS_ID = 2
    PART_NO = 3
    MACHINE_ID = 4
    QUALITY_ID = 5
    DATA_TIME = 6
    DATA_VALUE = 7
    # AUTO_INCREMENTAL = 8
    DATA_SERIAL = 9
    LINE_NAME = 10
    PROCESS_NAME = 11
    MACHINE_NAME = 12
    QUALITY_NAME = 13
    SUB_PART_NO = 14
    SUB_LOT_NO = 15
    SUB_TRAY_NO = 16
    SUB_SERIAL = 17

    # add new columns
    WORK_TYPE = 18
    QUALITY = 19
    LOT_NO = 20
    TRAY_NO = 21

    # generate equation

    # Femto_Mach = 19
    # Femto_Order = 20
    # Line = 21
    # Datetime = 22
    # Milling = 23

    # FACTORY_ID = 24
    # FACTORY_NAME = 25
    # PLANT_ID = 26
    # PLANT_NO = 27
    # DEPT_ID = 28
    # DEPT_NAME = 29
    # LINE_GROUP_ID = 30
    # LINE_GROUP_NAME = 31
    # PART_FULL = 32
    # EQUIP_ID = 33
    # HORIZONTAL_DATA = 34  # Type for horizontal columns that are sensor columns

    # PART_LOG
    # FORGING_DATE = 35
    # DELIVERY_ASSY_FASTEN_TORQUE = 36

    # PRODUCT_ID = 35

    @classmethod
    def v2_pivottable_group(cls) -> list['DataGroupType']:
        return [
            group_type
            for group_type in cls
            if group_type
            not in [
                DataGroupType.WORK_TYPE,
                DataGroupType.QUALITY,
                DataGroupType.LOT_NO,
                DataGroupType.TRAY_NO,
                DataGroupType.QUALITY_ID,
                DataGroupType.QUALITY_NAME,
                DataGroupType.DATA_VALUE,
            ]
        ]

    @classmethod
    def v2_horizontal_group(cls) -> list['DataGroupType']:
        return [
            DataGroupType.WORK_TYPE,
            DataGroupType.QUALITY,
            DataGroupType.LOT_NO,
            DataGroupType.TRAY_NO,
        ]

    # @classmethod
    # def get_physical_column_types(cls):
    #     return [
    #         cls.GENERATED.value,
    #         cls.DATA_SERIAL.value,
    #         cls.DATA_TIME.value,
    #         cls.MAIN_DATE.value,
    #         cls.MAIN_TIME.value,
    #     ]


WELL_KNOWN_COLUMNS = {
    DBType.V2.name: {
        'ラインID': DataGroupType.LINE_ID.value,
        'ライン名': DataGroupType.LINE_NAME.value,
        '工程ID': DataGroupType.PROCESS_ID.value,
        '工程名': DataGroupType.PROCESS_NAME.value,
        '子設備ID': DataGroupType.MACHINE_ID.value,
        '子設備名': DataGroupType.MACHINE_NAME.value,
        '品番': DataGroupType.PART_NO.value,
        'ワーク種別': DataGroupType.WORK_TYPE.value,
        'ロットNo': DataGroupType.LOT_NO.value,
        'トレイNo': DataGroupType.TRAY_NO.value,
        'シリアルNo': DataGroupType.DATA_SERIAL.value,
        '計測日時': DataGroupType.DATA_TIME.value,
        '計測項目ID': DataGroupType.QUALITY_ID.value,
        '計測項目名': DataGroupType.QUALITY_NAME.value,
        '計測値': DataGroupType.DATA_VALUE.value,
    },
    DBType.V2_MULTI.name: {
        'ラインID': DataGroupType.LINE_ID.value,
        'ライン': DataGroupType.LINE_NAME.value,
        '工程ID': DataGroupType.PROCESS_ID.value,
        '工程': DataGroupType.PROCESS_NAME.value,
        '子設備ID': DataGroupType.MACHINE_ID.value,
        '子設備': DataGroupType.MACHINE_NAME.value,
        '品番': DataGroupType.PART_NO.value,
        'ワーク種別': DataGroupType.WORK_TYPE.value,
        '良否': DataGroupType.QUALITY.value,
        'ロットNo': DataGroupType.LOT_NO.value,
        'トレイNo': DataGroupType.TRAY_NO.value,
        'シリアルNo': DataGroupType.DATA_SERIAL.value,
        '加工日時': DataGroupType.DATA_TIME.value,
        '測定項目名': DataGroupType.QUALITY_NAME.value,
        '測定値': DataGroupType.DATA_VALUE.value,
    },
    DBType.V2_HISTORY.name: {
        'ラインID': DataGroupType.LINE_ID.value,
        'ライン': DataGroupType.LINE_NAME.value,
        '工程ID': DataGroupType.PROCESS_ID.value,
        '工程': DataGroupType.PROCESS_NAME.value,
        '子設備ID': DataGroupType.MACHINE_ID.value,
        '子設備': DataGroupType.MACHINE_NAME.value,
        '品番': DataGroupType.PART_NO.value,
        'ワーク種別': DataGroupType.WORK_TYPE.value,
        'ロットNo': DataGroupType.LOT_NO.value,
        'トレイNo': DataGroupType.TRAY_NO.value,
        'シリアルNo': DataGroupType.DATA_SERIAL.value,
        '加工日時': DataGroupType.DATA_TIME.value,
        '子部品品番': DataGroupType.SUB_PART_NO.value,
        '子部品ロットNo': DataGroupType.SUB_LOT_NO.value,
        '子部品トレイNo': DataGroupType.SUB_TRAY_NO.value,
        '子部品シリアルNo': DataGroupType.SUB_SERIAL.value,
    },
}
REVERSED_WELL_KNOWN_COLUMNS = {
    DBType.V2.name: {
        DataGroupType.LINE_ID.value: 'ラインID',
        DataGroupType.LINE_NAME.value: 'ライン名',
        DataGroupType.PROCESS_ID.value: '工程ID',
        DataGroupType.PROCESS_NAME.value: '工程名',
        DataGroupType.MACHINE_ID.value: '子設備ID',
        DataGroupType.MACHINE_NAME.value: '子設備名',
        DataGroupType.PART_NO.value: '品番',
        DataGroupType.WORK_TYPE.value: 'ワーク種別',
        DataGroupType.LOT_NO.value: 'ロットNo',
        DataGroupType.TRAY_NO.value: 'トレイNo',
        DataGroupType.DATA_SERIAL.value: 'シリアルNo',
        DataGroupType.DATA_TIME.value: '計測日時',
        DataGroupType.QUALITY_ID.value: '計測項目ID',
        DataGroupType.QUALITY_NAME.value: '計測項目名',
        DataGroupType.DATA_VALUE.value: '計測値',
    },
    DBType.V2_MULTI.name: {
        DataGroupType.LINE_ID.value: 'ラインID',
        DataGroupType.LINE_NAME.value: 'ライン',
        DataGroupType.PROCESS_ID.value: '工程ID',
        DataGroupType.PROCESS_NAME.value: '工程',
        DataGroupType.MACHINE_ID.value: '子設備ID',
        DataGroupType.MACHINE_NAME.value: '子設備',
        DataGroupType.PART_NO.value: '品番',
        DataGroupType.DATA_SERIAL.value: 'シリアルNo',
        DataGroupType.WORK_TYPE.value: 'ワーク種別',
        DataGroupType.QUALITY.value: '良否',
        DataGroupType.LOT_NO.value: 'ロットNo',
        DataGroupType.TRAY_NO.value: 'トレイNo',
        DataGroupType.DATA_TIME.value: '加工日時',
        DataGroupType.QUALITY_NAME.value: '測定項目名',
        DataGroupType.DATA_VALUE.value: '測定値',
    },
    DBType.V2_HISTORY.name: {
        DataGroupType.LINE_ID.value: 'ラインID',
        DataGroupType.LINE_NAME.value: 'ライン',
        DataGroupType.PROCESS_ID.value: '工程ID',
        DataGroupType.PROCESS_NAME.value: '工程',
        DataGroupType.MACHINE_ID.value: '子設備ID',
        DataGroupType.MACHINE_NAME.value: '子設備',
        DataGroupType.PART_NO.value: '品番',
        DataGroupType.WORK_TYPE.value: 'ワーク種別',
        DataGroupType.LOT_NO.value: 'ロットNo',
        DataGroupType.TRAY_NO.value: 'トレイNo',
        DataGroupType.DATA_SERIAL.value: 'シリアルNo',
        DataGroupType.DATA_TIME.value: '加工日時',
        DataGroupType.SUB_PART_NO.value: '子部品品番',
        DataGroupType.SUB_LOT_NO.value: '子部品ロットNo',
        DataGroupType.SUB_TRAY_NO.value: '子部品トレイNo',
        DataGroupType.SUB_SERIAL.value: '子部品シリアルNo',
    },
}
ABNORMAL_WELL_KNOWN_COLUMNS = {
    DBType.V2.name: {
        'ラインID': DataGroupType.LINE_ID.value,
        'ライン名': DataGroupType.LINE_NAME.value,
        '工程ID': DataGroupType.PROCESS_ID.value,
        '工程名': DataGroupType.PROCESS_NAME.value,
        '子設備ID': DataGroupType.MACHINE_ID.value,
        '子設備名': DataGroupType.MACHINE_NAME.value,
        '品番': DataGroupType.PART_NO.value,
        'ワーク種別': DataGroupType.WORK_TYPE.value,
        'ロット番号': DataGroupType.LOT_NO.value,
        'トレイ番号': DataGroupType.TRAY_NO.value,
        'シリアル番号': DataGroupType.DATA_SERIAL.value,
        '計測日時': DataGroupType.DATA_TIME.value,
        '計測項目ID': DataGroupType.QUALITY_ID.value,
        '計測項目名': DataGroupType.QUALITY_NAME.value,
        '計測値': DataGroupType.DATA_VALUE.value,
    },
    DBType.V2_MULTI.name: {
        'ラインID': DataGroupType.LINE_ID.value,
        'ライン': DataGroupType.LINE_NAME.value,
        '工程ID': DataGroupType.PROCESS_ID.value,
        '工程': DataGroupType.PROCESS_NAME.value,
        '子設備ID': DataGroupType.MACHINE_ID.value,
        '子設備': DataGroupType.MACHINE_NAME.value,
        '品番': DataGroupType.PART_NO.value,
        'ワーク種別': DataGroupType.WORK_TYPE.value,
        '良否結果': DataGroupType.QUALITY.value,
        'ロットNo': DataGroupType.LOT_NO.value,
        'トレイNo': DataGroupType.TRAY_NO.value,
        'シリアルNo': DataGroupType.DATA_SERIAL.value,
        '加工日時': DataGroupType.DATA_TIME.value,
        '測定項目名': DataGroupType.QUALITY_NAME.value,
        '測定値': DataGroupType.DATA_VALUE.value,
    },
    DBType.V2_HISTORY.name: {
        'ラインID': DataGroupType.LINE_ID.value,
        'ライン名': DataGroupType.LINE_NAME.value,
        '工程ID': DataGroupType.PROCESS_ID.value,
        '工程名': DataGroupType.PROCESS_NAME.value,
        '子設備ID': DataGroupType.MACHINE_ID.value,
        '子設備名': DataGroupType.MACHINE_NAME.value,
        '品番': DataGroupType.PART_NO.value,
        'ワーク種別': DataGroupType.WORK_TYPE.value,
        'ロットNo': DataGroupType.LOT_NO.value,
        'トレイNo': DataGroupType.TRAY_NO.value,
        'シリアルNo': DataGroupType.DATA_SERIAL.value,
        '計測日時': DataGroupType.DATA_TIME.value,
        '子部品品番': DataGroupType.SUB_PART_NO.value,
        '子部品ロットNo': DataGroupType.SUB_LOT_NO.value,
        '子部品トレイNo': DataGroupType.SUB_TRAY_NO.value,
        '子部品シリアルNo': DataGroupType.SUB_SERIAL.value,
    },
}
ABNORMAL_REVERSED_WELL_KNOWN_COLUMNS = {
    DBType.V2.name: {
        DataGroupType.LINE_ID.value: 'ラインID',
        DataGroupType.LINE_NAME.value: 'ライン名',
        DataGroupType.PROCESS_ID.value: '工程ID',
        DataGroupType.PROCESS_NAME.value: '工程名',
        DataGroupType.MACHINE_ID.value: '子設備ID',
        DataGroupType.MACHINE_NAME.value: '子設備名',
        DataGroupType.PART_NO.value: '品番',
        DataGroupType.WORK_TYPE.value: 'ワーク種別',
        DataGroupType.LOT_NO.value: 'ロット番号',
        DataGroupType.TRAY_NO.value: 'トレイ番号',
        DataGroupType.DATA_SERIAL.value: 'シリアル番号',
        DataGroupType.DATA_TIME.value: '計測日時',
        DataGroupType.QUALITY_ID.value: '計測項目ID',
        DataGroupType.QUALITY_NAME.value: '計測項目名',
        DataGroupType.DATA_VALUE.value: '計測値',
    },
    DBType.V2_MULTI.name: {
        DataGroupType.LINE_ID.value: 'ラインID',
        DataGroupType.LINE_NAME.value: 'ライン',
        DataGroupType.PROCESS_ID.value: '工程ID',
        DataGroupType.PROCESS_NAME.value: '工程',
        DataGroupType.MACHINE_ID.value: '子設備ID',
        DataGroupType.MACHINE_NAME.value: '子設備',
        DataGroupType.PART_NO.value: '品番',
        DataGroupType.WORK_TYPE.value: 'ワーク種別',
        DataGroupType.QUALITY.value: '良否結果',
        DataGroupType.LOT_NO.value: 'ロットNo',
        DataGroupType.TRAY_NO.value: 'トレイNo',
        DataGroupType.DATA_SERIAL.value: 'シリアルNo',
        DataGroupType.DATA_TIME.value: '加工日時',
        DataGroupType.QUALITY_NAME.value: '測定項目名',
        DataGroupType.DATA_VALUE.value: '測定値',
    },
    DBType.V2_HISTORY.name: {
        DataGroupType.LINE_ID.value: 'ラインID',
        DataGroupType.LINE_NAME.value: 'ライン名',
        DataGroupType.PROCESS_ID.value: '工程ID',
        DataGroupType.PROCESS_NAME.value: '工程名',
        DataGroupType.MACHINE_ID.value: '子設備ID',
        DataGroupType.MACHINE_NAME.value: '子設備名',
        DataGroupType.PART_NO.value: '品番',
        DataGroupType.WORK_TYPE.value: 'ワーク種別',
        DataGroupType.LOT_NO.value: 'ロットNo',
        DataGroupType.TRAY_NO.value: 'トレイNo',
        DataGroupType.DATA_SERIAL.value: 'シリアルNo',
        DataGroupType.DATA_TIME.value: '計測日時',
        DataGroupType.SUB_PART_NO.value: '子部品品番',
        DataGroupType.SUB_LOT_NO.value: '子部品ロットNo',
        DataGroupType.SUB_TRAY_NO.value: '子部品トレイNo',
        DataGroupType.SUB_SERIAL.value: '子部品シリアルNo',
    },
}
ABNORMAL_V2_COLS = {
    'ライン名': DataGroupType.LINE_NAME.value,
    '工程名': DataGroupType.PROCESS_NAME.value,
    '子設備名': DataGroupType.MACHINE_NAME.value,
    '計測日時': DataGroupType.DATA_TIME.value,
    'シリアル番号': DataGroupType.DATA_SERIAL.value,
    'ロット番号': DataGroupType.LOT_NO.value,
    'トレイ番号': DataGroupType.TRAY_NO.value,
    'トレー番号': DataGroupType.TRAY_NO.value,
    'トレーNo': DataGroupType.TRAY_NO.value,
    '子部品トレーNo': DataGroupType.SUB_TRAY_NO.value,
}

V2_SAME_COL_DIC = {
    'トレーNo': 'トレイNo',
    '子部品トレーNo': '子部品トレイNo',
}

# for en column name from v2 files
WELL_KNOWN_EN_COLUMNS = {
    DBType.V2_MULTI.name: {
        'line_id': DataGroupType.LINE_ID.value,
        'line': DataGroupType.LINE_NAME.value,
        'process_id': DataGroupType.PROCESS_ID.value,
        'process': DataGroupType.PROCESS_NAME.value,
        'equipment_id': DataGroupType.MACHINE_ID.value,
        'equipment': DataGroupType.MACHINE_NAME.value,
        'part_number': DataGroupType.PART_NO.value,
        'work_type': DataGroupType.WORK_TYPE.value,
        'quality': DataGroupType.QUALITY.value,
        'lot_no': DataGroupType.LOT_NO.value,
        'tray_no': DataGroupType.TRAY_NO.value,
        'serial_no': DataGroupType.DATA_SERIAL.value,
        'processed_date_time': DataGroupType.DATA_TIME.value,
        'measurement_item_name': DataGroupType.QUALITY_NAME.value,
        'measured_value': DataGroupType.DATA_VALUE.value,
    },
}
REVERSED_WELL_KNOWN_EN_COLUMNS = {
    DBType.V2_MULTI.name: {
        DataGroupType.LINE_ID.value: 'line_id',
        DataGroupType.LINE_NAME.value: 'line',
        DataGroupType.PROCESS_ID.value: 'process_id',
        DataGroupType.PROCESS_NAME.value: 'process',
        DataGroupType.MACHINE_ID.value: 'equipment_id',
        DataGroupType.MACHINE_NAME.value: 'equipment',
        DataGroupType.PART_NO.value: 'part_number',
        DataGroupType.WORK_TYPE.value: 'work_type',
        DataGroupType.QUALITY.value: 'quality',
        DataGroupType.LOT_NO.value: 'lot_no',
        DataGroupType.TRAY_NO.value: 'tray_no',
        DataGroupType.DATA_SERIAL.value: 'serial_no',
        DataGroupType.DATA_TIME.value: 'processed_date_time',
        DataGroupType.QUALITY_NAME.value: 'measurement_item_name',
        DataGroupType.DATA_VALUE.value: 'measured_value',
    },
}

SUB_PART_NO_DEFAULT_SUFFIX = '.'
SUB_PART_NO_NAMES = '部品'
SUB_PART_NO_DEFAULT_NO = 'No'
v2_PART_NO_REGEX = r'JP\d{10}$'
SUB_PART_NO_SUFFIX = 'Part'
SUB_PART_NO_PREFIX = 'Sub'

# PCP categorized real
CATEGORIZED_SUFFIX = '__CATEGORIZED__'
# timeout 10 seconds for preview data
PREVIEW_DATA_TIMEOUT = 10
NULL_PERCENT = 'null_percent'
ZERO_VARIANCE = 'zero_variance'
SELECTED_VARS = 'selected_vars'

ZERO_FILL_PATTERN = r'^{\:(0)([<>]?)([1-9]\d*)d?\}$'  # {:010}, {:010d}
ZERO_FILL_PATTERN_2 = r'^{\:([1-9])([<>])(\d+)d?\}$'  # {:1>10}, {:1>10}, {:1<10d}

OSERR = {22: 'Access denied', 2: 'Folder not found', 20: 'Not a folder'}

# Browser support
SAFARI_SUPPORT_VER = 15.4

UTF8_WITH_BOM = 'utf-8-sig'
UTF8_WITHOUT_BOM = 'utf-8'

SENSOR_NAMES = 'sensor_names'
SENSOR_IDS = 'sensor_ids'
COEF = 'coef'
BAR_COLORS = 'bar_colors'

# rlp NG rate
JUDGE_VAR = 'judgeVar'
NG_CONDITION = 'NGCondition'
NG_CONDITION_VALUE = 'NGConditionValue'
X = 'x'
Y = 'y'
X_NAME = 'x_name'
Y_NAME = 'y_name'
NG_RATES = 'ng_rates'
GROUP = 'group'
COUNT = 'count'
TRUE_MATCH = 'true'
RATE = 'rate'
IS_PROC_LINKED = 'is_proc_linked'
EXPORT_TERM_FROM = 'From'
EXPORT_TERM_TO = 'To'
EXPORT_NG_RATE = 'NG Rate'
JUDGE_LABEL = 'judge_label'


class NGCondition(Enum):
    LESS_THAN = '<'
    LESS_THAN_OR_EQUAL = '<='
    GREATER_THAN = '>'
    GREATER_THAN_OR_EQUAL = '>='
    EQUAL = '='
    NOT_EQUAL_TO = '!='


class CacheType(Enum):
    CONFIG_DATA = 1
    TRANSACTION_DATA = 2
    JUMP_FUNC = 3
    OTHER = 4


FACET_PER_ROW = 8
FACET_ROW = 'facet_row'
SENSORS = 'sensors'

CREATED_AT = 'created_at'
UPDATED_AT = 'updated_at'


class RawDataTypeDB(BaseEnum):  # data type user select
    NULL = DataType.NULL.name
    INTEGER = DataType.INTEGER.name
    REAL = DataType.REAL.name
    TEXT = DataType.TEXT.name
    DATETIME = DataType.DATETIME.name
    BOOLEAN = DataType.BOOLEAN.name

    DATE = DataType.DATE.name
    TIME = DataType.TIME.name

    # SMALL_INT = 's_i'
    BIG_INT = DataType.BIG_INT.name
    # CATEGORY_INTEGER = 'I'
    # CATEGORY_TEXT = 'T'
    CATEGORY = 'CATEGORY'  # Rainbow treat category as integer

    @staticmethod
    def is_integer_data_type(data_type_db_value: str):
        return data_type_db_value in (
            RawDataTypeDB.INTEGER.value,
            RawDataTypeDB.CATEGORY.value,
            RawDataTypeDB.BIG_INT.value,
        )

    @staticmethod
    def is_text_data_type(data_type_db_value: str):
        return data_type_db_value in (RawDataTypeDB.TEXT.name, RawDataTypeDB.DATETIME.name)

    @staticmethod
    def is_category_data_type(data_type_db_value: str):
        return data_type_db_value == RawDataTypeDB.CATEGORY.value

    @classmethod
    def get_pandas_dtype(cls, value: str, local_time: bool = True) -> pd.ExtensionDtype:
        if value is None:
            return object

        timezone = tz.tzlocal() if local_time else tz.tzutc()

        raw_data_type = RawDataTypeDB(value)
        if raw_data_type == RawDataTypeDB.NULL:
            raise ValueError

        if raw_data_type == RawDataTypeDB.INTEGER:
            # return pd.Int32Dtype()
            return pd.Int64Dtype()

        if raw_data_type == RawDataTypeDB.REAL:
            return pd.Float64Dtype()

        if raw_data_type == RawDataTypeDB.TEXT:
            return pd.StringDtype()

        if raw_data_type == RawDataTypeDB.DATETIME:
            return pd.DatetimeTZDtype(tz=timezone)

        if raw_data_type == RawDataTypeDB.BOOLEAN:
            return pd.BooleanDtype()

        # if raw_data_type == RawDataTypeDB.SMALL_INT:
        #     return pd.Int16Dtype()
        #
        if raw_data_type == RawDataTypeDB.BIG_INT:
            return pd.Int64Dtype()

        if raw_data_type == RawDataTypeDB.CATEGORY:
            return pd.Int64Dtype()

        if raw_data_type == RawDataTypeDB.DATE:
            return pd.DatetimeTZDtype(tz=timezone)

        if raw_data_type == RawDataTypeDB.TIME:
            return pd.DatetimeTZDtype(tz=timezone)

        raise NotImplementedError('Invalid data type')

    @classmethod
    def get_data_type_for_function(cls, data_type: str | None, possible_data_types: list[str]) -> RawDataTypeDB | None:
        if data_type is None:
            return None

        # database only save `i` for integer, need to handle big int and small int as well
        if cls.is_integer_data_type(data_type):
            return RawDataTypeDB.get_by_enum_value(data_type)

        if data_type in possible_data_types:
            return RawDataTypeDB.get_by_enum_value(data_type)

        return None


INT16_MAX = np.iinfo(np.int16).max
INT16_MIN = np.iinfo(np.int16).min
INT32_MAX = np.iinfo(np.int32).max
INT32_MIN = np.iinfo(np.int32).min
INT64_MAX = np.iinfo(np.int64).max
INT64_MIN = np.iinfo(np.int64).min

dict_invalid_data_type_regex = {
    RawDataTypeDB.INTEGER.value: r'[^-0-9]+',
    RawDataTypeDB.REAL.value: r'[^-0-9\.eg-]+',
    RawDataTypeDB.TEXT.value: '.*',
    RawDataTypeDB.BOOLEAN.value: '[^0-1]',
    RawDataTypeDB.DATETIME.value: '.*',
    # RawDataTypeDB.SMALL_INT.value: r'[^-0-9]+',
    RawDataTypeDB.BIG_INT.value: r'[^-0-9]+',
    RawDataTypeDB.CATEGORY.value: '.*',
}

dict_numeric_type_ranges = {
    RawDataTypeDB.INTEGER.value: {'max': INT32_MAX, 'min': INT32_MIN},
    RawDataTypeDB.BOOLEAN.value: {'max': 1, 'min': 0},
    # RawDataTypeDB.SMALL_INT.value: {'max': INT16_MAX, 'min': INT16_MIN},
    RawDataTypeDB.BIG_INT.value: {'max': INT64_MAX, 'min': INT64_MIN},
}


class FunctionCastDataType(BaseEnum):
    SAME_AS_X = 'x'
    CAST = 'cast'


dict_dtype = {
    '': DataType.NULL.name,
    'r': DataType.REAL.name,
    'i': DataType.INTEGER.name,
    't': DataType.TEXT.name,
    'T': RawDataTypeDB.CATEGORY.name,
    'd': DataType.DATETIME.name,
    'b': DataType.BOOLEAN.name,
    'rs': DataType.REAL_SEP.name,
    'is': DataType.INTEGER_SEP.name,
    'ers': DataType.EU_REAL_SEP.name,
    'eis': DataType.EU_INTEGER_SEP.name,
    'ksn': DataType.K_SEP_NULL.name,
    'date': DataType.DATE.name,
    'time': DataType.TIME.name,
    'cast': FunctionCastDataType.CAST.value,
    'x': FunctionCastDataType.SAME_AS_X.value,
    'b_i': DataType.BIG_INT.name,
}


SQL_PARAM_SYMBOL = '?'
# encoding
SHIFT_JIS_NAME = 'Shift-JIS'
SHIFT_JIS = 'shift_jis'
WINDOWS_31J = 'windows_31j'
CP932 = 'cp932'
UTF8_WITH_BOM_NAME = 'utf-8-bom'

LAST_REQUEST_TIME = 'last_request_time'

# nominal selection modal
CATEGORY_COLS = 'category_cols'

HTML_CODE_304 = 304
PCA_SAMPLE_DATA = 3000
CUM_RATIO_VALUE = 0.8
RL_MIN_DATA_COUNT = 8
MAX_GRAPH_COUNT = 20
HM_WEEK_MODE = 7
HM_WEEK_MODE_DAYS = 140
COMPLETED_PERCENT = 100
ALMOST_COMPLETE_PERCENT = 99
PAST_IMPORT_LIMIT_DATA_COUNT = 2_000_000

CLEAN_REQUEST_INTERVAL = 24  # 1 day interval

# External API request params
REQ_ID = 'req_id'
BOOKMARK_ID = 'bookmark_id'
PROCESS_ID = 'process_id'
COLUMNS = 'columns'
START_DATETIME = 'start_datetime'
END_DATETIME = 'end_datetime'
LATEST = 'latest'
OPTION_ID = 'option_id'
OD_FILTER = 'od_filter'
OBJECTIVE = 'objective'
FUNCTION = 'function'
BOOKMARKS = 'bookmarks'
PROCESSES = 'processes'
EXTERNAL_API = 'external_api'
FACET = 'facet'
FILTER = 'filter'
DIV = 'div'
REQUEST_PARAMS = 'params'  # for external API
BOOKMARK_TITLE = 'title'
CREATED_BY = 'created_by'
PRIORITY = 'priority'
BOOKMARK_DESCRIPTION = 'description'
SAVE_DATETIME = 'save_datetime'
SAVE_GRAPH_SETTINGS = 'save_graph_settings'
SAVE_LATEST = 'save_latest'
OD_FILTERS = 'od_filters'

# External API elements
TRACE_DATA_FORM = 'traceDataForm'
RADIO_DEFAULT_INTERVAL = 'radioDefaultInterval'
RADIO_RECENT_INTERVAL = 'radioRecentInterval'
CHECKED = 'checked'
FIRST_END_PROC = 'end-proc-process-1'
VALUE = 'value'
START_DATE_ID = 'startDate'
START_TIME_ID = 'startTime'
END_DATE_ID = 'endDate'
END_TIME_ID = 'endTime'

EXAMPLE_VALUE = 3


class PagePath(Enum):
    FPP = 'ap/fpp'
    STP = 'ap/stp'
    RLP = 'ap/rlp'
    CHM = 'ap/chm'
    MSP = 'ap/msp'
    SCP = 'ap/scp'
    AGP = 'ap/agp'
    SKD = 'ap/skd'
    PCP = 'ap/pcp'
    PCA = 'ap/analyze/anomaly_detection/pca'
    GL = 'ap/analyze/structure_learning/gl'
    REGISTER_DATA_FILE = 'ap/register_by_file'


PROCESS_QUEUE = '_queue'
MAIN_THREAD = 'MAIN_THREAD'
SHUTDOWN = 'SHUTDOWN'
PORT = 'PORT'


# class DicConfig(BaseEnum):
#     PROCESS_QUEUE = auto()
#     DB_SECRET_KEY = auto()
#     SQLITE_CONFIG_DIR = auto()
#     APP_DB_FILE = auto()
#     UNIVERSAL_DB_FILE = auto()
#     TESTING = auto()


class ListenNotifyType(BaseEnum):
    JOB_PROGRESS = auto()
    ADD_JOB = auto()
    RESCHEDULE_JOB = auto()
    RUNNING_JOB = auto()
    CLEAR_CACHE = auto()


class JobType(Enum):
    def __str__(self):
        return str(self.name)

    # 1,2 is priority
    DEL_PROCESS = 1
    CSV_IMPORT = 2
    FACTORY_IMPORT = 3
    GEN_GLOBAL = 4
    # CLEAN_DATA = 5
    FACTORY_PAST_IMPORT = 6
    IDLE_MORNITORING = 7
    SHUTDOWN_APP = 8
    BACKUP_DATABASE = 9
    PROC_LINK_COUNT = 10
    ZIP_LOG = 11
    CLEAN_ZIP = 12
    RESTRUCTURE_INDEXES = 13
    CLEAN_EXPIRED_REQUEST = 14
    PROCESS_COMMUNICATE = 15


SEQUENCE_CACHE = 1000


class DuplicateMode(BaseEnum):
    FIRST = auto()
    LAST = auto()
    BOTH = auto()


class CSVExtTypes(Enum):
    CSV = 'csv'
    TSV = 'tsv'
    SSV = 'ssv'
    ZIP = 'zip'


class DataColumnType(BaseEnum):
    DATETIME = 1
    MAIN_SERIAL = 2
    SERIAL = 3
    DATETIME_KEY = 4
    DATE = 5
    TIME = 6
    MAIN_DATE = 7  # main::date
    MAIN_TIME = 8  # main::time

    INT_CATE = 10

    LINE_NAME = 20
    LINE_NO = 21
    EQ_NAME = 22
    EQ_NO = 23
    PART_NAME = 24
    PART_NO = 25
    ST_NO = 26

    GENERATED = 99
    GENERATED_EQUATION = 100

    @classmethod
    def category_int_types(cls):
        return [
            cls.INT_CATE.value,
            cls.MAIN_SERIAL.value,
            cls.SERIAL.value,
            cls.LINE_NO.value,
            cls.EQ_NO.value,
            cls.PART_NO.value,
            cls.ST_NO.value,
        ]


NOTIFY_DELAY_TIME = 3  # seconds


class ColumnDTypeToSQLiteDType(BaseEnum):
    NULL = 'null'
    INTEGER = 'integer'
    REAL = 'real'
    TEXT = 'text'
    DATETIME = 'text'
    DATE = 'text'
    TIME = 'text'
    REAL_SEP = 'real'
    INTEGER_SEP = 'integer'
    EU_REAL_SEP = 'real'
    EU_INTEGER_SEP = 'integer'
    K_SEP_NULL = 'null'
    BIG_INT = 'string'


# if nchar(header) > 90%: generate column name
NUM_CHARS_THRESHOLD = 90


# register data from file
class RegisterDatasourceType(BaseEnum):
    DIRECTORY = 'directory'
    FILE = 'file'
    REFERENCE_FILE = 'reference_file'


SERVER_ADDR = [
    'localhost',
    '127.0.0.1',
]


class DataRegisterStage(BaseEnum):
    FIRST_IMPORTED = 'first_imported'
    DURING = 'during'
    FINISHED = 'finished'


# Time for announcing and blinking icon
ANNOUNCE_UPDATE_TIME: int = 60  # unit: seconds

# Limit range time to check new version
LIMIT_CHECKING_NEWER_VERSION_TIME: int = 60  # unit: seconds
