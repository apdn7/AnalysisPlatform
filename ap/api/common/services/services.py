import numpy as np
import pandas as pd

from ap.api.external_api.services import save_odf_data_of_request
from ap.common.common_utils import gen_sql_label
from ap.common.constants import *
from ap.common.logger import log_execution_time
from ap.common.trace_data_log import EventAction
from ap.setting_module.models import (
    CfgProcessColumn,
    DataTraceLog,
    insert_or_update_config,
    make_session,
)


@log_execution_time()
def update_draw_data_trace_log(dataset_id, exe_time):
    trace_logs = DataTraceLog.get_dataset_id(dataset_id, EventAction.DRAW.value)
    for trace_log in trace_logs:
        if trace_log.exe_time == 0:
            trace_log.exe_time = exe_time
    with make_session() as meta_session:
        insert_or_update_config(meta_session, trace_log)
        meta_session.commit()

    return True


@log_execution_time()
def convert_datetime_to_ct(df, graph_param, target_vars=[]):
    """
    Convert sensor that is datetime type to cycle time
    :param df:
    :param graph_param:
    :param target_vars:
    :return:
    """
    UPPER_LIM_MARGIN = 5
    if not target_vars:
        target_vars = graph_param.common.sensor_cols
        color_id = graph_param.common.color_var
        if color_id:
            target_vars += [color_id]

    for target_var in target_vars:
        # find proc_id from col info
        general_col_info = graph_param.get_col_info_by_id(target_var)
        # list out all CT column from this process
        dic_datetime_cols = {
            cfg_col.id: cfg_col
            for cfg_col in CfgProcessColumn.get_by_data_type(
                general_col_info[END_PROC_ID], DataType.DATETIME
            )
        }
        sql_label = gen_sql_label(target_var, general_col_info[END_COL_NAME])
        if target_var in dic_datetime_cols and df.size:
            series = pd.to_datetime(df[sql_label])
            # compute elapsed time, periods is "-1" mean (i1 - i2,)
            # then add minus to get (i2 - i1)
            series = -series.diff(periods=-1).dt.total_seconds()
            # filter CT not zero/ replace zero to NA
            series = pd.Series(np.where(series == 0, None, series))
            # compute upper lim
            upper_lim = UPPER_LIM_MARGIN * series.median()
            # convert outliers (>= 5*median) to NA
            series = pd.Series(np.where(series >= upper_lim, None, series))

            df[sql_label] = series.convert_dtypes()


@log_execution_time()
def get_filter_on_demand_data(dic_param, remove_filter_data=False):
    dic_param[FILTER_ON_DEMAND] = {
        'facet': dic_param.get(CAT_EXP_BOX, []),
        'system': dic_param.get(CAT_ON_DEMAND, []),
        'color': dic_param.get(UNIQUE_COLOR, []),
        'div': dic_param.get(UNIQUE_DIV, []),
        'category': dic_param.get(CATEGORY_DATA, []),
        'filter': [] if remove_filter_data else dic_param.get(FILTER_DATA, []),
    }
    filter_key = [CAT_EXP_BOX, CATEGORY_DATA, FILTER_DATA, UNIQUE_COLOR, UNIQUE_DIV, CAT_ON_DEMAND]
    for key in filter_key:
        if key in dic_param:
            dic_param.pop(key)

    save_odf_data_of_request(dic_param)

    return dic_param
