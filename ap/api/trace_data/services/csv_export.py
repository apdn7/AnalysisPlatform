import copy
import json

import numpy as np
import pandas as pd
import pytz
from dateutil import tz
from pandas import DataFrame

from ap.api.calendar_heatmap.services import gen_heatmap_data_as_dict, gen_sub_df_from_heatmap
from ap.api.categorical_plot.services import (
    gen_dic_param_terms,
    gen_direct_terms,
    gen_graph_param,
    produce_cyclic_terms,
)
from ap.api.common.services.show_graph_services import get_data_from_db, judge_data_conversion
from ap.common.common_utils import DATE_FORMAT_STR, DATE_FORMAT_STR_CSV, gen_sql_label
from ap.common.constants import (
    CLIENT_TIMEZONE,
    COMMON,
    COMPARE_TYPE,
    DIC_CAT_FILTERS,
    END_DATE,
    END_DT,
    END_TM,
    EXPORT_FROM,
    EXPORT_TERM_FROM,
    RL_DIRECT_TERM,
    SELECTED,
    START_DATE,
    START_DT,
    START_TM,
)
from ap.common.logger import log_execution_time
from ap.trace_data.schemas import DicParam


@log_execution_time()
def gen_csv_data(graph_param, dic_param, delimiter=None, with_terms=False, by_cells=False):
    """tracing data to show csv
    1 start point x n end point
    filter by condition points that between start point and end_point
    """
    terms = None
    # generate terms for STP and RLP
    if with_terms:
        is_direct_term = dic_param[COMMON][COMPARE_TYPE] == RL_DIRECT_TERM
        if is_direct_term:
            terms = gen_direct_terms(dic_param)
        else:
            produce_cyclic_terms(dic_param)
            terms = gen_dic_param_terms(dic_param)

    dic_param = split_graph_params(dic_param)

    graph_param, client_timezone = make_graph_param(graph_param, dic_param)

    if by_cells:
        # chm only
        dic_cat_filters = {}
        graph_param = gen_graph_param(graph_param, dic_param, with_ct_col=True)
        if dic_param[COMMON][EXPORT_FROM] == 'plot':
            dic_cat_filters = (
                json.loads(dic_param[COMMON].get(DIC_CAT_FILTERS, {}))
                if isinstance(dic_param[COMMON].get(DIC_CAT_FILTERS, {}), str)
                else dic_param[COMMON].get(DIC_CAT_FILTERS, {})
            )
        heatmap_data, _, _, dic_col_func, _, _, _, export_df = gen_heatmap_data_as_dict(
            graph_param,
            dic_param,
            graph_param.dic_proc_cfgs,
            dic_cat_filters,
        )

        if dic_param[COMMON][EXPORT_FROM] == 'plot':
            if not delimiter:
                delimiter = ','
            heatmap_zip_data, csv_list_name = gen_sub_df_from_heatmap(
                heatmap_data,
                dic_param,
                graph_param.dic_proc_cfgs,
                dic_col_func,
                delimiter,
                client_timezone,
            )

            return heatmap_zip_data, csv_list_name

        if delimiter:
            csv_data = to_csv(
                export_df,
                graph_param,
                delimiter=delimiter,
                client_timezone=client_timezone,
                terms=terms,
            )
        else:
            csv_data = to_csv(export_df, graph_param, client_timezone=client_timezone, terms=terms)
        return csv_data, None
    else:
        df = gen_df_export(graph_param, dic_param)
        # client_timezone = tz.gettz(client_timezone or None) or tz.tzlocal()

        if delimiter:
            csv_data = to_csv(
                df,
                graph_param,
                delimiter=delimiter,
                client_timezone=client_timezone,
                terms=terms,
            )
        else:
            csv_data = to_csv(df, graph_param, client_timezone=client_timezone, terms=terms)

        return csv_data


@log_execution_time()
def gen_df_export(graph_param, dic_param):
    """
        get data from db to export csv/tsv
    :param graph_param:
    :param dic_param:
    :return: df
    """

    # if export_type = plot -> use filter
    dic_cat_filters = {}
    if dic_param[COMMON][EXPORT_FROM] == 'plot':
        dic_cat_filters = (
            json.loads(dic_param[COMMON].get(DIC_CAT_FILTERS, {}))
            if isinstance(dic_param[COMMON].get(DIC_CAT_FILTERS, {}), str)
            else dic_param[COMMON].get(DIC_CAT_FILTERS, {})
        )

    # get data from database
    df, *_ = get_data_from_db(graph_param, dic_cat_filters)

    # export original value of judge variable
    df = judge_data_conversion(df, graph_param, revert=True)
    return df


def make_graph_param(graph_param: DicParam, dic_param):
    graph_param.common.start_date = dic_param[COMMON][START_DATE]
    graph_param.common.start_time = dic_param[COMMON][START_TM]
    graph_param.common.end_date = dic_param[COMMON][END_DATE]
    graph_param.common.end_time = dic_param[COMMON][END_TM]

    cat_exp_col = graph_param.common.cat_exp
    # add category
    if cat_exp_col:
        graph_param.add_cat_exp_to_array_formval()

    graph_param.add_cate_procs_to_array_formval()

    # add color, cat_div for scp
    graph_param.add_column_to_array_formval(
        [col for col in [graph_param.common.color_var, graph_param.common.div_by_cat] if col],
    )
    graph_param.add_ng_condition_to_array_formval()

    # get serials + date
    for proc in graph_param.array_formval:
        cfg_proc = graph_param.dic_proc_cfgs[proc.proc_id]

        get_date = cfg_proc.get_date_col(column_name_only=False).id
        proc.add_cols(get_date, append_first=True)

        serial_ids = [serial.id for serial in cfg_proc.get_serials(column_name_only=False)]
        proc.add_cols(serial_ids, append_first=True)

    client_timezone = dic_param[COMMON].get(CLIENT_TIMEZONE)
    client_timezone = pytz.timezone(client_timezone) if client_timezone else tz.tzlocal()

    return graph_param, client_timezone


def gen_export_col_name(proc_name, col_name):
    return f'{proc_name}|{col_name}'


@log_execution_time()
def to_csv(
    df: DataFrame,
    graph_param: DicParam,
    delimiter=None,
    client_timezone=None,
    output_path=None,
    output_col_ids=None,
    len_of_col_name=None,
    terms=None,
    emd_type=None,
    div_col=None,
):
    df_csv = export_preprocessing(
        df,
        graph_param,
        client_timezone=client_timezone,
        output_col_ids=output_col_ids,
        len_of_col_name=len_of_col_name,
        terms=terms,
        emd_type=emd_type,
        div_col=div_col,
    )

    delimiter = delimiter or ','
    return df_csv.to_csv(output_path, sep=delimiter, index=False)


def export_preprocessing(
    df: DataFrame,
    graph_param: DicParam,
    client_timezone=None,
    output_col_ids=None,
    len_of_col_name=None,
    terms=None,
    emd_type=None,
    div_col=None,
):
    # rename
    new_headers = []
    suffix = '...'
    dic_rename = {}
    for proc in graph_param.array_formval:
        proc_cfg = graph_param.dic_proc_cfgs[proc.proc_id] if proc.proc_id in graph_param.dic_proc_cfgs else None
        if not proc_cfg:
            continue

        for col_id, col_name, name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            old_name = gen_sql_label(col_id, col_name)
            if old_name not in df.columns:
                continue

            if output_col_ids and col_id not in output_col_ids:
                continue

            new_name = gen_export_col_name(proc_cfg.shown_name, name)
            if len_of_col_name and len(new_name) > len_of_col_name:
                new_name = new_name[: len_of_col_name - len(suffix)] + suffix
                idx = 1
                while new_name in new_headers:
                    new_name = f'{new_name[:-3]}({idx})'
                    idx += 1
                new_headers.append(new_name)

            dic_rename[old_name] = new_name

    if SELECTED in df:
        dic_rename[SELECTED] = SELECTED

    # get only output columns
    if emd_type:
        if EXPORT_TERM_FROM in df.columns:
            # keep From, TO in term of RLP export
            output_cols = df.columns.to_list()
        if div_col:
            output_cols = [div_col] + df.columns.to_list()
        df_output = df[output_cols]
    else:
        df_output = df[dic_rename]
    df_output.rename(columns=dic_rename, inplace=True)
    df_output.replace({np.nan: None}, inplace=True)

    # timezone
    if client_timezone:
        # get date list
        get_dates = []
        start_ct_col = None
        start_proc_term_from = None
        start_proc_term_to = None
        for proc_cfg in graph_param.dic_proc_cfgs.values():
            get_date_col = proc_cfg.get_date_col(column_name_only=False)
            get_date_name_in_df = gen_export_col_name(proc_cfg.shown_name, get_date_col.shown_name)
            get_dates.append(get_date_name_in_df)
            if proc_cfg.id == graph_param.common.start_proc:
                start_ct_col = get_date_name_in_df
                if terms:
                    start_proc_term_from = gen_export_col_name(proc_cfg.shown_name, 'from')
                    start_proc_term_to = gen_export_col_name(proc_cfg.shown_name, 'to')

        if start_proc_term_from:
            # add term datetime to df
            gen_term_cols(df_output, start_ct_col, start_proc_term_from, start_proc_term_to, terms)
            # extend datetime columns
            get_dates.extend([start_proc_term_from, start_proc_term_to])

        for col in df_output.columns:
            if col not in get_dates:
                continue
            df_output[col] = (
                pd.to_datetime(df_output[col], format=DATE_FORMAT_STR, utc=True)
                .dt.tz_convert(client_timezone)
                .dt.strftime(DATE_FORMAT_STR_CSV)
            )
    return df_output


def find_term(value, terms, is_from):
    for term in terms:
        if term[START_DT] <= value <= term[END_DT]:
            return term[START_DT] if is_from else term[END_DT]
    return value


def gen_term_cols(df, col_name, start_proc_term_from, start_proc_term_to, terms):
    df[start_proc_term_from] = df[col_name]
    df[start_proc_term_to] = df[col_name]

    df[start_proc_term_from] = df[start_proc_term_from].apply(find_term, args=(terms, True))
    df[start_proc_term_to] = df[start_proc_term_to].apply(find_term, args=(terms, False))
    return df


def split_graph_params(dic_param):
    if isinstance(dic_param[COMMON][START_DATE], list) and len(dic_param[COMMON][START_DATE]) > 1:
        # clone_dp = copy.deepcopy(dic_param)
        dic_params = [copy.deepcopy(dic_param) for _ in dic_param[COMMON][START_DATE]]
        for i, time_range in enumerate(dic_param[COMMON][START_DATE]):
            dic_params[i][COMMON][START_DATE] = dic_param[COMMON][START_DATE][i]
            dic_params[i][COMMON][START_TM] = dic_param[COMMON][START_TM][i]
            dic_params[i][COMMON][END_DATE] = dic_param[COMMON][END_DATE][i]
            dic_params[i][COMMON][END_TM] = dic_param[COMMON][END_TM][i]
        return dic_params
    else:
        return dic_param
