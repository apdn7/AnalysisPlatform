import http.client
import time
from enum import Enum, auto
from functools import wraps
from inspect import getgeneratorstate
from urllib.parse import urlencode

from flask import current_app, g
from pandas import DataFrame

from histview2.common.common_utils import create_file_path, write_to_pickle
from histview2.common.constants import MPS, FlaskGKey, CsvDelimiter
from histview2.common.logger import log_execution_time

# some environment can not access to google analytics ,
# in this case send ga will be stoped in the next time
is_send_google_analytics = True


def _gen_dataset_id():
    from histview2.setting_module.models import DataTraceLog
    dataset_id = DataTraceLog.get_max_id()
    while True:
        dataset_id += 1
        yield dataset_id


# to gen unique dataset id , use this func
gen_dataset_id_inst = _gen_dataset_id()


def send_gtag(**kwargs):
    try:
        GA_TRACKING_ID = current_app.config.get('GA_TRACKING_ID')
        data = {
            'v': '1',  # API Version.
            'tid': GA_TRACKING_ID,  # Tracking ID / Property ID.
            # Anonymous Client Identifier. Ideally, this should be a UUID that
            # is associated with particular user, device, or browser instance.
            'cid': '555',
            't': 'event',  # Event hit type.
        }
        data.update(kwargs)
        conn = http.client.HTTPSConnection(MPS)
        payload = ''
        headers = {}
        querystring = urlencode(data)
        print(querystring)
        conn.request("POST", "/collect?" + querystring, payload, headers)
        res = conn.getresponse()
        return res.status
    except Exception:
        return False


class EventCategory(Enum):
    EXEC_TIME = 'ExecTime'
    INPUT_DATA = 'InputData'


class EventType(Enum):
    PCA = 'PCA'
    MSP = 'MSP'
    FPP = 'FPP'
    STP = 'StP'
    RLP = 'RLP'
    SKD = 'SkD'
    PCP = 'PCP'
    CHM = 'CHM'
    SCP = 'ScP'


class EventAction(Enum):
    READ = 'Read'
    SAVE = 'Save'
    CALLPKG = 'CallPkg'
    PLOT = 'Plot'


class Target(Enum):
    TSV = 'Tsv'
    PICKLE = 'Pickle'
    DATABASE = 'Database'
    GRAPH = 'Graph'


class Location(Enum):
    PYTHON = 'Mt'
    JAVASCRIPT = 'Js'
    R = 'R_'


class TraceErrKey(Enum):
    DATASET = 'dataset_id'
    DUMPFILE = 'dumpfile'
    TYPE = 'event_type'
    ACTION = 'event_action'
    LOCATION = 'location'
    TARGET = 'target'
    CODE = 'return_code'
    MSG = 'message'
    DATETIME = 'date_time'
    EXE_TIME = 'exe_time'
    DATA_SIZE = 'data_size'
    ROWS = 'rows'
    COLS = 'cols'

    IS_OUTPUT = auto()
    IS_EXPORT_MODE = auto()


class ReturnCode(Enum):
    NORMAL = 'OK'
    UNKNOWN_ERR = 'Unknown Error'


class LogLevel(Enum):
    ERROR = 'ERROR'
    WARNING = 'WARNING'


def save_trace_log_db(is_err=False, data_frame=None):
    """
    save trace log to database
    """
    from histview2.setting_module.models import AbnormalTraceLog, DataTraceLog
    g_trace_error = _get_g_dict()
    if not g_trace_error:
        return

    # gen dataset id
    if not get_log_attr(TraceErrKey.DATASET):
        if getgeneratorstate(gen_dataset_id_inst) == 'GEN_CREATED':
            next(gen_dataset_id_inst)

        set_log_attr(TraceErrKey.DATASET, next(gen_dataset_id_inst))

    # gen dumpfile info
    _set_dumpfile_details(data_frame)

    rec = AbnormalTraceLog() if is_err else DataTraceLog()
    for key, val in g_trace_error.items():
        new_key = key
        new_val = val
        if isinstance(key, Enum):
            new_key = key.value

        if isinstance(val, Enum):
            new_val = val.value

        if hasattr(rec, new_key):
            setattr(rec, new_key, new_val)

    from histview2.setting_module.models import make_session
    with make_session() as meta_session:
        meta_session.add(rec)


def set_log_attr(keys, vals):
    """
    set error attributte
    """
    if not keys:
        return

    g_trace_error = _get_g_dict()
    if isinstance(keys, (list, tuple)):
        for key, val in zip(keys, vals):
            g_trace_error[key] = val
    else:
        g_trace_error[keys] = vals


def get_log_attr(key, get_enum=False):
    g_trace_error = _get_g_dict()
    val = g_trace_error.get(key, None)
    if not val:
        return None

    if not get_enum:
        if isinstance(val, Enum):
            return val.value

    return val


def trace_log(keys=None, vals=None, save_log=True, output_key=None, send_ga=False, method_key=False):
    """
    decorator to manage trace data and trace log
    """

    def _trace_log(fn):
        @wraps(fn)
        def __trace_log(*args, **kwargs):
            global is_send_google_analytics
            # set attribute first time
            set_log_attr(keys, vals)
            try:
                st = time.time()
                result = fn(*args, **kwargs)
                # set attribute second time
                set_log_attr(keys, vals)
                et = time.time() + 0.005  # To avoid zero executive time, add 5 miliseconds
                exec_time = round((et - st) * 1000)  # miliseconds

                # save exec_time
                set_log_attr(TraceErrKey.EXE_TIME, exec_time)

                # dumpfile
                if output_key:
                    set_log_attr(output_key, result)

                # save trace data
                if save_log:
                    df = None
                    for param in args:
                        if isinstance(param, DataFrame):
                            df = param
                            break

                    save_trace_log_db(data_frame=df)

                # send data to GA
                if is_send_google_analytics and send_ga:
                    is_send_google_analytics = send_google_analytic()

            except Exception as e:
                # save trace error
                set_log_attr(TraceErrKey.MSG, str(e))
                save_trace_log_db(is_err=True)
                raise e

            return result

        return __trace_log

    return _trace_log


def _get_g_dict():
    """
    private function to get g object
    """
    return g.setdefault(FlaskGKey.TRACE_ERR, {})


def _set_dumpfile_details(data_frame: DataFrame = None):
    """save dumpfile details information ( data size, rows , cols)

    Returns:
        [type] -- [description]
    """
    if data_frame is None:
        return False

    # already get data size
    if get_log_attr(TraceErrKey.COLS):
        return False

    keys = (TraceErrKey.DATA_SIZE, TraceErrKey.COLS, TraceErrKey.ROWS)
    data_size = int(data_frame.memory_usage(index=False, deep=True).sum())
    cols = data_frame.columns.size
    rows = len(data_frame)

    vals = (data_size, cols, rows)
    set_log_attr(keys, vals)

    return True


def send_google_analytic():
    """
    send info to google analytic
    """
    event_type = get_log_attr(TraceErrKey.TYPE)
    event_action = get_log_attr(TraceErrKey.ACTION)
    event_location = get_log_attr(TraceErrKey.LOCATION) or Location.PYTHON.value
    event_label = event_location
    if event_action is EventAction.CALLPKG:
        event_label += f'({get_log_attr(TraceErrKey.Target)})'
    else:
        event_label += event_action

    exe_time = get_log_attr(TraceErrKey.EXE_TIME)
    data_size = get_log_attr(TraceErrKey.DATA_SIZE)

    send_result = send_gtag(ec=EventCategory.EXEC_TIME.value, ea=event_type + '_et',
                            el=event_label, ev=exe_time)

    if not send_result:
        return False

    send_result = send_gtag(ec=EventCategory.INPUT_DATA.value, ea=event_type + '_ds',
                            el=event_label, ev=data_size)

    if not send_result:
        return False

    return True


@log_execution_time()
@trace_log((TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventAction.SAVE, Target.PICKLE), output_key=TraceErrKey.DUMPFILE)
def save_input_data_to_file(input_form, prefix=None):
    if prefix:
        set_log_attr(TraceErrKey.TYPE, prefix)

    event_type = get_log_attr(TraceErrKey.TYPE) or ''
    file_path = create_file_path('input_' + event_type, suffix='.pickle')
    write_to_pickle(input_form, file_path)
    return file_path


@log_execution_time()
@trace_log((TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventAction.SAVE, Target.TSV), output_key=TraceErrKey.DUMPFILE)
def save_df_to_file(df: DataFrame):
    event_type = get_log_attr(TraceErrKey.TYPE) or ''
    file_path = create_file_path('dat_' + event_type)
    df.to_csv(file_path, sep=CsvDelimiter.TSV.value, index=False)
    return file_path
