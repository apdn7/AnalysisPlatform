from histview2.common.common_utils import detect_encoding
from histview2.common.common_utils import get_temp_path, get_wrapr_path, get_etl_path, get_base_dir, make_dir
from histview2.common.constants import CfgConstantType, CsvDelimiter
from histview2.common.logger import logger, log_execution_time
from histview2.common.services.sse import notify_progress
from histview2.script.r_scripts.wrapr import wrapr_utils
from histview2.setting_module.models import CfgConstant

FILE = 'etl_spray_shape.R'

UNKNOWN_ERROR_MESSAGE = 'NO OUTPUT FROM R SCRIPT'
NO_DATA_ERROR = 'NoDataError'


@log_execution_time()
def preview_data(fname):
    """
    transform data , output will be put in temp folder
    """
    output_fname = call_com_read(fname, get_temp_path())
    return output_fname


@log_execution_time()
def csv_transform(proc_id, fname):
    """transform to standard csv

    """
    out_dir = get_base_dir(fname)
    etl_dir = get_etl_path(str(proc_id), out_dir)
    make_dir(etl_dir)

    output_fname = call_com_read(fname, etl_dir)
    return output_fname


@log_execution_time()
def call_com_read(fname, out_dir):
    """call com read func to transform data

    Args:
        fname ([type]): [description]
        out_dir ([type]): [description]

    Returns:
        [type]: [description]
    """
    target_func = 'com_read'

    # define parameters
    dic_data = {}  # filecheckr does not need input data
    dic_task = dict(func=target_func, file=FILE, fpath=fname)

    # define and run pipeline
    try:
        pipe = wrapr_utils.RPipeline(get_wrapr_path(), out_dir, use_pkl=False, verbose=True)
        out = pipe.run(dic_data, [dic_task])
    except Exception as e:
        logger.error(e)
        return e

    if out:
        error = out.get('err', None)
        error_type = out.get('err_type', None)
        if error:
            if error_type == NO_DATA_ERROR:
                return None

            logger.error(error)
            return Exception(error)

        # save latest json string
        json_str = out['results']['pass']
        save_etl_json(FILE, json_str)

        # return
        return out['results']['fname_out']

    return Exception(UNKNOWN_ERROR_MESSAGE)


@log_execution_time()
@notify_progress(60)
def call_com_view(fname, out_dir):
    """call com view func to export image

    Args:
        fname ([type]): [description]
        out_dir ([type]): [description]

    Returns:
        [type]: [description]
    """
    target_func = 'com_view'

    # get json string
    json_str = load_etl_json(FILE)

    # define parameters
    dic_data = {}
    dic_task = {'func': target_func, 'file': FILE, 'fpath': fname, 'pass': json_str}

    # define and run pipeline
    try:
        pipe = wrapr_utils.RPipeline(get_wrapr_path(), out_dir, use_pkl=False, verbose=True)
        out = pipe.run(dic_data, [dic_task])
    except Exception as e:
        logger.error(e)
        return e

    if out:
        error = out.get('err', None)
        if error:
            logger.error(error)
            return Exception(error)

        return out['results']['fname_out']

    return Exception(UNKNOWN_ERROR_MESSAGE)


@log_execution_time()
def save_etl_json(script_fname, json_str):
    CfgConstant.create_or_update_by_type(const_type=CfgConstantType.ETL_JSON.name,
                                         const_value=json_str, const_name=script_fname)


@log_execution_time()
def load_etl_json(script_fname):
    # get json string
    json_str = CfgConstant.get_value_by_type_name(CfgConstantType.ETL_JSON.name, script_fname, str)
    return json_str


@log_execution_time()
def detect_file_delimiter(file_path, default_delimiter):
    white_list = [CsvDelimiter.CSV.value, CsvDelimiter.TSV.value, CsvDelimiter.SMC.value]
    encoding = detect_encoding(file_path)
    candidates = []
    with open(file_path, "r", encoding=encoding) as f:
        for i in range(200):
            try:
                line = f.readline()
            except StopIteration:
                break

            if line:
                _, row_delimiter = max([(len(line.split(split_char)), split_char) for split_char in white_list])
                candidates.append(row_delimiter)

    if candidates:
        good_delimiter = max(candidates, key=candidates.count)
        if good_delimiter is not None:
            return good_delimiter

    return default_delimiter
