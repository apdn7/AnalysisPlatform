from typing import Dict

import numpy as np
import pandas as pd
import pytz
from dateutil import tz
from pandas import DataFrame

from histview2.api.trace_data.services.time_series_chart import get_data_from_db, get_procs_in_dic_param
from histview2.common.common_utils import gen_sql_label, DATE_FORMAT_STR, DATE_FORMAT_STR_CSV
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.services.form_env import bind_dic_param_to_class
from histview2.setting_module.models import CfgProcess
from histview2.trace_data.schemas import DicParam


@log_execution_time()
def gen_csv_data(dic_param, delimiter=None):  # get the most cover flows
    """tracing data to show csv
        1 start point x n end point
        filter by condition points that between start point and end_point
    """
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add category
    graph_param.add_cate_procs_to_array_formval()

    # get serials + date
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]

        get_date = proc_cfg.get_date_col(column_name_only=False).id
        proc.add_cols(get_date, append_first=True)

        serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
        proc.add_cols(serial_ids, append_first=True)

    # get data from database
    df, *_ = get_data_from_db( graph_param)
    client_timezone = dic_param[COMMON].get(CLIENT_TIMEZONE)
    client_timezone = pytz.timezone(client_timezone) if client_timezone else tz.tzlocal()
    # client_timezone = tz.gettz(client_timezone or None) or tz.tzlocal()

    if delimiter:
        csv_data = to_csv(df, dic_proc_cfgs, graph_param, delimiter=delimiter, client_timezone=client_timezone)
    else:
        csv_data = to_csv(df, dic_proc_cfgs, graph_param, client_timezone=client_timezone)

    return csv_data


def gen_export_col_name(proc_name, col_name):
    return f'{proc_name}|{col_name}'


@log_execution_time()
def to_csv(df: DataFrame, dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam, delimiter=',',
           client_timezone=None, output_path=None, output_col_ids=None, len_of_col_name=None):
    # rename
    new_headers = []
    suffix = '...'
    dic_rename = {}
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        for col_id, col_name, name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            old_name = gen_sql_label(col_id, col_name)
            if old_name not in df.columns:
                continue

            if output_col_ids and col_id not in output_col_ids:
                continue

            new_name = gen_export_col_name(proc_cfg.name, name)
            if len_of_col_name and len(new_name) > len_of_col_name:
                new_name = new_name[:len_of_col_name - len(suffix)] + suffix
                idx = 1
                while new_name in new_headers:
                    new_name = f'{new_name[:-3]}({idx})'
                    idx += 1
                new_headers.append(new_name)

            dic_rename[old_name] = new_name

    # get only output columns
    df_csv = df[dic_rename]
    df_csv.rename(columns=dic_rename, inplace=True)
    df_csv.replace({np.nan: None}, inplace=True)

    # timezone
    if client_timezone:
        # get date list
        get_dates = []
        for proc_cfg in dic_proc_cfgs.values():
            get_date_col = proc_cfg.get_date_col(column_name_only=False)
            get_date_name_in_df = gen_export_col_name(proc_cfg.name, get_date_col.name)
            get_dates.append(get_date_name_in_df)

        for col in df_csv.columns:
            if col not in get_dates:
                continue
            # df_csv[col] = df_csv[col].apply(lambda v: convert_dt_str_to_timezone(client_timezone, v))
            df_csv[col] = pd.to_datetime(df_csv[col], format=DATE_FORMAT_STR, utc=True) \
                .dt.tz_convert(client_timezone).dt.strftime(DATE_FORMAT_STR_CSV)

    return df_csv.to_csv(output_path, sep=delimiter, index=False)


def sql_label_short(headers, length=10):
    new_headers = []
    suffix = '...'
    for header in headers:
        new_header = header[:length - len(suffix)] + suffix if len(header) > length else header

        idx = 1
        while new_header in new_headers:
            new_header = f'{new_header[:-3]}({idx})'
            idx += 1

        new_headers.append(new_header)
    return new_headers
