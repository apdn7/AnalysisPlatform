from typing import List

import pandas as pd
from pandas import DataFrame, Series

from ap.common.common_utils import gen_sql_label
from ap.common.constants import DataType, FilterFunc
from ap.setting_module.models import CfgProcessColumn
from ap.trace_data.schemas import ConditionProc


def filter_procs(
    df: DataFrame, condition_procs: List[ConditionProc], condition_target_proc_id=None
):
    for condition_proc in condition_procs:
        if condition_target_proc_id is None or condition_proc.proc_id == int(
            condition_target_proc_id
        ):
            df = filter_proc(df, condition_proc)

    return df


def filter_proc(df: DataFrame, condition_proc: ConditionProc):
    if df is None or not len(df):
        return df

    # AND
    for column_id, filter_details in condition_proc.dic_col_id_filters.items():
        if not filter_details:
            continue

        column_name = filter_details[0].column_name
        df_column_name = gen_sql_label(column_id, column_name)
        if df_column_name not in df.columns:
            return df

        data_type = CfgProcessColumn.query.get(column_id).data_type
        series = df[df_column_name]
        if data_type == DataType.INTEGER.name:
            series = series.astype('Int64')

        series_str = series.astype(str)

        # OR (same column)
        dfs = []
        for filter_detail in filter_details:
            for cfg_filter_detail in filter_detail.cfg_filter_details:
                val = cfg_filter_detail.filter_condition
                if val is None:
                    continue

                if cfg_filter_detail.filter_function in [None, FilterFunc.MATCHES.name]:
                    if data_type == DataType.INTEGER.name:
                        val = int(val)
                    elif data_type == DataType.REAL.name:
                        val = float(val)
                    else:
                        val = str(val)

                    idxs = series == val
                elif cfg_filter_detail.filter_function == FilterFunc.STARTSWITH.name:
                    idxs = filter_startswith(series_str, val)
                elif cfg_filter_detail.filter_function == FilterFunc.ENDSWITH.name:
                    idxs = filter_endswith(series_str, val)
                elif cfg_filter_detail.filter_function == FilterFunc.CONTAINS.name:
                    idxs = filter_contains(series_str, val)
                elif cfg_filter_detail.filter_function == FilterFunc.REGEX.name:
                    idxs = filter_regex(series_str, val)
                elif cfg_filter_detail.filter_function == FilterFunc.SUBSTRING.name:
                    idxs = filter_substring(series_str, cfg_filter_detail.filter_from_pos, val)
                elif cfg_filter_detail.filter_function == FilterFunc.AND_SEARCH.name:
                    idxs = filter_and(series_str, val)
                elif cfg_filter_detail.filter_function == FilterFunc.OR_SEARCH.name:
                    idxs = filter_or(series_str, val)
                else:
                    continue

                # only search for remain data
                df_res = series[idxs]
                if len(df_res):
                    dfs.append(series[idxs])

                series = series[~idxs]
                series_str = series_str[~idxs]
        # union or condition
        if dfs:
            df_cols = pd.concat(dfs)
            df = df[df.index.isin(df_cols.index)]
        else:
            df = pd.DataFrame(columns=df.columns)

    return df


def filter_startswith(df_col: Series, condition_str):
    idxs = df_col.str.startswith(condition_str)
    # return df_col[idxs]
    return idxs


def filter_endswith(df_col: Series, condition_str):
    idxs = df_col.str.endswith(condition_str)
    # return df_col[idxs]
    return idxs


def filter_contains(df_col: Series, condition_str):
    idxs = df_col.str.contains(condition_str)
    # return df_col[idxs]
    return idxs


def filter_substring(df_col: Series, from_position, condition_str):
    """
    filter from position
    :param df_col:
    :param from_position: start from 1
    :param condition_str:
    :return:
    """
    idxs = df_col.str.slice(from_position - 1).str.startswith(condition_str)
    # return df_col[idxs]
    return idxs


def filter_regex(df_col: Series, condition_str):
    idxs = df_col.str.match(condition_str)
    # return df_col[idxs]
    return idxs


def filter_and(df_col: Series, condition_str):
    conditions = list(set(condition_str.split()))
    conditions = sorted(conditions, key=len, reverse=True)
    df_temp = df_col
    for cond in conditions:
        idxs = filter_contains(df_temp, cond)
        df_temp = df_temp[idxs]

    vals = idxs[idxs == True].index.values
    idxs = df_col.index.isin(vals)

    return idxs


def filter_or(df_col: Series, condition_str):
    conditions = list(set(condition_str.split()))
    idxs = df_col.str.contains('|'.join(conditions))
    return idxs


def convert_str_type(df: DataFrame, column_name):
    id_col = f'{column_name}__SHOW_NAME__'
    if id_col in df.columns:
        column_name = id_col
    df_col = df[column_name].astype(str)
    return df_col
