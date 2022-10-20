from functools import lru_cache

from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.services.sse import background_announcer, AnnounceEvent
from histview2.common.sigificant_digit import signify_digit_pca_vector
from histview2.setting_module.models import CfgProcess
from histview2.trace_data.models import Sensor, find_sensor_class

NUM_SENSOR = 11


def get_checked_cols():
    """get all checked columns

    Yields:
        [type] -- [description]
    """
    procs: [CfgProcess] = CfgProcess.get_all_order_by_id()
    for proc in procs:
        checked_cols = proc.columns or []
        for col in checked_cols:
            yield dict(proc_id=proc.id, proc_name=proc.name, col_id=col.id,
                       col_name=col.column_name, col_type=col.data_type)


def filter_data(data, filter_func):
    """filter data func

    Arguments:
        data {[type]} -- [description]
        filter_func {[type]} -- [description]

    Yields:
        [type] -- [description]
    """
    for row in data:
        if filter_func(row):
            yield row


def filter_data_type(dic_row):
    """filter only real and integer columns

    Arguments:
        dic_row {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    if not dic_row:
        return False

    data_type = dic_row.get('col_type', None)

    if not data_type:
        return False

    return data_type in (DataType.INTEGER.name, DataType.REAL.name)


def produce_sample_value_str(sensor_vals=[], effective_length=29, max_length=32):
    """
    Produce list of sample values of sensor for PCA page
    :param sensor_vals:
    :param effective_length:
    :param max_length:
    :return:
    """
    sensor_vals = list(map(lambda x: str(x), sensor_vals))
    sensor_vals_str = ", ".join(sensor_vals)
    len_vals = len(sensor_vals_str)
    if len_vals > effective_length:
        sensor_vals_str = sensor_vals_str[0:effective_length]
        sensor_vals_str = sensor_vals_str.ljust(max_length, ".")
    else:
        return sensor_vals_str
    return sensor_vals_str


def produce_tool_tip_data(col_name='', lst_sensor_vals=[], num_head_tail=10):
    tooltip = [{'pos': '{col}:'.format(col=col_name), 'val': ''}]
    head = [{'pos': idx + 1, 'val': sample} for idx, sample in enumerate(lst_sensor_vals[0:num_head_tail])]
    tooltip.extend(head)

    mid = [{'pos': '.', 'val': '.'}, {'pos': '.', 'val': '.'}, {'pos': '.', 'val': '.'}]
    tooltip.extend(mid)

    num_sample = len(lst_sensor_vals)
    if num_sample > num_head_tail + 3:
        tail_sensors = lst_sensor_vals[num_head_tail + 3:][-num_head_tail:]
        len_tail = len(tail_sensors)

        tail = [{'pos': num_sample + idx - len_tail + 1, 'val': sample}
                for idx, sample in enumerate(tail_sensors)]
        tooltip.extend(tail)

    return tooltip


@log_execution_time()
def get_sample_data(columns, limit=None):
    """get sample data from database

    Arguments:
        data {[type]} -- [description]

    Keyword Arguments:
        limit {[type]} -- [description] (default: {None})
    """
    samples = []
    count = 1
    for col in columns:
        proc_id = col.get('proc_id')
        cfg_col_id = col.get('col_id')
        cfg_col_name = col.get('col_name')
        sensor = Sensor.get_sensor_by_col_name(proc_id, cfg_col_name)
        if not sensor:
            continue

        sensor_id = sensor.id
        sensor_type = sensor.type
        sensor_vals = get_sensor_first_records(cfg_col_id, cfg_col_name, sensor_id, sensor_type, limit)

        signified_sensor_vals = signify_digit_pca_vector(sensor_vals, sig_dig=4)
        sensor_vals_str = produce_sample_value_str(signified_sensor_vals[0:11])
        col['sample'] = sensor_vals_str

        # produce tooltip
        col['tooltip'] = produce_tool_tip_data(col_name=cfg_col_name, lst_sensor_vals=signified_sensor_vals)
        samples.append(col)
        if count % 60 == 0:
            background_announcer.announce(samples, AnnounceEvent.PCA_SENSOR.name)
            samples = []

        if count > 3000:
            break
        count += 1

    if samples:
        background_announcer.announce(samples, AnnounceEvent.PCA_SENSOR.name)


@lru_cache(2000)
def get_sensor_first_records(cfg_col_id, cfg_col_name, sensor_id, sensor_type, limit=100):
    data_type = DataType(sensor_type)
    sensor_val_cls = find_sensor_class(sensor_id, data_type)
    sensor_val = sensor_val_cls.coef(cfg_col_id)
    sensor_vals = sensor_val_cls.get_first_records(cfg_col_name, limit=limit, coef_col=sensor_val)
    sensor_vals = [sensor_val[0] for sensor_val in sensor_vals]

    return sensor_vals


# def get_sensors(num_sensor=NUM_SENSOR):
#     """get sensors with filtered
#
#     Returns:
#         [type] -- [description]
#     """
#     data = get_checked_cols()
#     data = filter_data(data, filter_data_type)
#     data = get_sample_data(data, limit=100)
#     samples = []
#     try:
#         [samples.append(next(data)) for i in range(num_sensor)]
#     except StopIteration:
#         pass
#     return samples


def get_sensors_incrementally():
    """get sensors with filtered

    Returns:
        [type] -- [description]
    """
    data = get_checked_cols()
    columns = filter_data(data, filter_data_type)
    get_sample_data(columns, limit=100)
