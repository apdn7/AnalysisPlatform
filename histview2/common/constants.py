from enum import Enum, auto

MATCHED_FILTER_IDS = 'matched_filter_ids'
UNMATCHED_FILTER_IDS = 'unmatched_filter_ids'
NOT_EXACT_MATCH_FILTER_IDS = 'not_exact_match_filter_ids'
STRING_COL_IDS = 'string_col_ids'

SQL_COL_PREFIX = '__'
SQL_LIMIT = 5_000_000
ACTUAL_RECORD_NUMBER = 'actual_record_number'
ACTUAL_RECORD_NUMBER_TRAIN = 'actual_record_number_train'
ACTUAL_RECORD_NUMBER_TEST = 'actual_record_number_test'
REMOVED_OUTLIER_NAN_TRAIN = 'removed_outlier_nan_train'
REMOVED_OUTLIER_NAN_TEST = 'removed_outlier_nan_test'

YAML_CONFIG_BASIC = 'basic'
YAML_CONFIG_DB = 'db'
YAML_CONFIG_PROC = 'proc'
YAML_CONFIG_HISTVIEW2 = 'histview2'
YAML_CONFIG_VERSION = 'version'
YAML_TILE_INTERFACE_DN7 = 'ti_dn7'
YAML_TILE_INTERFACE_AP = 'ti_analysis_platform'
TILE_RESOURCE_URL = '/histview2/tile_interface/resources/'
DB_BACKUP_SUFFIX = '_old'
DB_BACKUP_FOLDER = 'backup'
IN_MODIFIED_DAYS = 30
NORMAL_MODE_MAX_RECORD = 10000

DEFAULT_WARNING_DISK_USAGE = 80
DEFAULT_ERROR_DISK_USAGE = 90


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


class ErrorMsg(Enum):
    W_PCA_INTEGER = auto()
    E_PCA_NON_NUMERIC = auto()

    E_ALL_NA = auto()
    E_ZERO_VARIANCE = auto()


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
YAML_TYPE = 'type'
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
YAML_ETL_FUNC = 'etl_func'
YAML_PROC_ID = 'proc_id'
YAML_PASSWORD = 'password'
YAML_HASHED = 'hashed'
YAML_DELIMITER = 'delimiter'

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
IQR = 'iqr'
ARRAY_X = 'array_x'
Y_MAX = 'y-max'
Y_MIN = 'y-min'
Y_MAX_ORG = 'y_max_org'
Y_MIN_ORG = 'y_min_org'
TIME_RANGE = 'time_range'
TOTAL = 'total'

UNLINKED_IDXS = 'unlinked_idxs'
NONE_IDXS = 'none_idxs'
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
IS_REMOVE_OUTLIER = 'isRemoveOutlier'
TBLS = 'TBLS'
FILTER_PARTNO = 'filter-partno'
FILTER_MACHINE = 'machine_id'
CATE_PROC = 'end_proc_cate'
GET02_CATE_SELECT = 'GET02_CATE_SELECT'
CATEGORY_DATA = 'category_data'
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

IS_RES_LIMITED = 'is_res_limited'
IS_RES_LIMITED_TRAIN = 'is_res_limited_train'
IS_RES_LIMITED_TEST = 'is_res_limited_test'
WITH_IMPORT_OPTIONS = 'with_import'
GET_PARAM = 'get_param'
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
DF_ALL_PROCS = 'dfProcs'
DF_ALL_COLUMNS = 'dfColumns'
CHART_TYPE = 'chartType'

# CATEGORICAL PLOT
CATE_VARIABLE = 'categoryVariable'
CATE_VALUE_MULTI = 'categoryValueMulti'
PART_NO = 'PART_NO'
MACHINE_ID = 'MACHINE_ID'
COMPARE_TYPE = 'compareType'
CATEGORICAL = 'var'
TERM = 'term'
RL_CATEGORY = 'category'
RL_CYCLIC_TERM = 'cyclicTerm'
RL_DIRECT_TERM = 'directTerm'
TIME_CONDS = 'time_conds'
CATE_CONDS = 'cate_conds'
LINE_NO = 'LINE_NO'
YAML_LINE_LIST = 'line-list'
FILTER_OTHER = 'filter-other'
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
RANK_COL = 'before_rank_values'
SUMMARIES = 'summaries'
CAT_DISTRIBUTE = 'category_distributed'
CAT_SUMMARY = 'cat_summary'
N = 'n'
N_PCTG = 'n_pctg'
N_NA = 'n_na'
N_NA_PCTG = 'n_na_pctg'
N_TOTAL = 'n_total'
UNIQUE_CATEGORIES = 'unique_categories'
UNIQUE_DIV = 'unique_div'
UNIQUE_COLOR = 'unique_color'
IS_OVER_UNIQUE_LIMIT = 'isOverUniqueLimit'
DIC_CAT_FILTERS = 'dic_cat_filters'
TEMP_CAT_EXP = 'temp_cat_exp'
TEMP_CAT_PROCS = 'temp_cat_procs'
DIV_BY_DATA_NUM = 'dataNumber'
DIV_BY_CAT = 'div'
COLOR_VAR = 'colorVar'
IS_DATA_LIMITED = 'isDataLimited'

# Cat Expansion
CAT_EXP_BOX = 'catExpBox'

# Order columns
INDEX_ORDER_COLS = 'indexOrderColumns'
THIN_DATA_GROUP_COUNT = 'thinDataGroupCounts'

# validate data flag
IS_VALIDATE_DATA = 'isValidateData'
# Substring column name in universal db
SUB_STRING_COL_NAME = '{}_From_{}_To_{}'
SUB_STRING_REGEX = r'^.+_From_(\d+)_To_(\d+)$'

# heatmap
HM_STEP = 'step'
HM_MODE = 'mode'
HM_FUNCTION_REAL = 'function_real'
HM_FUNCTION_CATE = 'function_cate'
HM_TRIM = 'remove_outlier'
CELL_SUFFIX = '_cell'
AGG_COL = 'agg_col'
TIME_COL = 'time'


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
    time_per_count = auto()
    iqr = auto()


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


class DataTypeEncode(Enum):
    NULL = ''
    INTEGER = 'Int'
    REAL = 'Real'
    TEXT = 'Str'
    DATETIME = 'CT'


class JobStatus(Enum):
    def __str__(self):
        return str(self.name)

    PENDING = 0
    PROCESSING = 1
    DONE = 2
    KILLED = 3
    FAILED = 4
    FATAL = 5  # error when insert to db commit, file lock v...v ( we need re-run these files on the next job)


class Outliers(Enum):
    NOT_OUTLIER = 0
    IS_OUTLIER = 1


class FlaskGKey(Enum):
    TRACE_ERR = auto()
    YAML_CONFIG = auto()
    APP_DB_SESSION = auto()
    DEBUG_SHOW_GRAPH = auto()
    MEMOIZE = auto()


class DebugKey(Enum):
    IS_DEBUG_MODE = auto()
    GET_DATA_FROM_DB = auto()


class MemoizeKey(Enum):
    STOP_USING_CACHE = auto()


# error message for dangling jobs
FORCED_TO_BE_FAILED = 'DANGLING JOB. FORCED_TO_BE_FAILED'
DEFAULT_POLLING_FREQ = 180 # default is import every 3 minutes

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


# UI order types
UI_ORDER_DB = 'tblDbConfig'
UI_ORDER_PROC = 'tblProcConfig'

# SQL
SQL_PERCENT = '%'
SQL_REGEX_PREFIX = 'RAINBOW7_REGEX:'
SQL_REGEXP_FUNC = 'REGEXP'

# DATA TRACE LOG CONST
EXECTIME = 'ExecTime'
INPUTDATA = 'InputData'
# Measurement Protocol Server
MPS = 'www.google-analytics.com'
R_PORTABLE = 'R-Portable'
R_LIB_VERSION = 'R_LIB_VERSION'

# Message
MSG_DB_CON_FAILED = 'Database connection failed! Please check your database connection information'

# encoding
ENCODING_SHIFT_JIS = 'cp932'
ENCODING_UTF_8 = 'utf-8'
ENCODING_UTF_8_BOM = 'utf-8-sig'
ENCODING_ASCII = 'ascii'

# Web socket
SOCKETIO = 'socketio'
PROC_LINK_DONE_PUBSUB = '/proc_link_done_pubsub'
PROC_LINK_DONE_SUBSCRIBE = 'proc_link_subscribe'
PROC_LINK_DONE_PUBLISH = 'proc_link_publish'
SHUTDOWN_APP_DONE_PUBSUB = '/shutdown_app_done_pubsub'
SHUTDOWN_APP_DONE_PUBLISH = 'shutdown_app_publish'
BACKGROUND_JOB_PUBSUB = '/job'
# JOB_STATUS_PUBLISH = 'job_status_publish'
# JOB_INFO_PUBLISH = 'res_background_job'

# Dictionary Key
HAS_RECORD = 'has_record'

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
RL_ARRAY_X = 'array_x'
RL_CATE_NAME = 'cate_name'
RL_PERIOD = 'TargetPeriod.from|TargetPeriod.to'
RL_SENSOR_NAME = 'sensor_name'
RL_PROC_NAME = 'proc_name'
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
SKD_TARGET_PROC_CLR = '#65c5f1'

# tile interface
TILE_INTERFACE = 'tile_interface'
SECTIONS = 'sections'
DN7_TILE = 'dn7'
AP_TILE = 'analysis_platform'


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


class CfgFilterType(Enum):
    def __str__(self):
        return str(self.name)

    LINE = auto()
    MACHINE_ID = auto()
    PART_NO = auto()
    OTHER = auto()


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
SQLITE_CONFIG_DIR = 'SQLITE_CONFIG_DIR'
PARTITION_NUMBER = 'PARTITION_NUMBER'
UNIVERSAL_DB_FILE = 'UNIVERSAL_DB_FILE'
APP_DB_FILE = 'APP_DB_FILE'
TESTING = 'TESTING'

DATA_TYPE_ERROR_MSG = 'Data Type Error'
DATA_TYPE_DUPLICATE_MSG = 'Duplicate Record'

AUTO_BACKUP = 'auto-backup-universal'


class appENV(Enum):
    PRODUCTION = 'prod'
    DEVELOPMENT = 'dev'


THIN_DATA_CHUNK = 4000
THIN_DATA_COUNT = THIN_DATA_CHUNK * 3

# variables correlation
CORRS = 'corrs'
CORR = 'corr'
PCORR = 'pcorr'
NTOTALS = 'ntotals'
DUPLICATE_COUNT_COLUMN = '__DUPLICATE_COUNT__'  # A column that store duplicate count of current data row

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

CAT_TOTAL = 'cat_total'
IS_CAT_LIMITED = 'is_cat_limited'
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
USER_SETTING_VERSION = 0
EN_DASH = '–'


# Disk usage warning level
class DiskUsageStatus(Enum):
    Normal = 0
    Warning = 1
    Full = 2


# debug mode
IS_EXPORT_MODE = 'isExportMode'
IS_IMPORT_MODE = 'isImportMode'

# NA
NA_STR = 'NA'

# Recent
VAR_TRACE_TIME = 'varTraceTime'
TERM_TRACE_TIME = 'termTraceTime'
CYCLIC_TRACE_TIME = 'cyclicTraceTime'
TRACE_TIME = 'traceTime'

# Limited graph flag
IS_GRAPH_LIMITED = 'isGraphLimited'

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
    'tr'
]
