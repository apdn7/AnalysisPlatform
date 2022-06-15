import numpy as np
import pandas as pd
from pandas import Series

from histview2.common.common_utils import DATE_FORMAT_STR, reformat_dt_str, calc_overflow_boundary
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.services.request_time_out_handler import request_timeout_handling
from histview2.common.sigificant_digit import signify_digit


@log_execution_time()
def calc_summary_elements(plot):
    none_ids = plot.get(NONE_IDXS)
    array_y = plot.get(ARRAY_Y) or []
    array_x = plot.get(ARRAY_X) or []
    df = pd.DataFrame({ARRAY_X: array_x, ARRAY_Y: array_y})
    # must check None , because [] is no None value
    if none_ids is None:
        pass
    else:
        if none_ids:
            df = df[(df[ARRAY_Y].notnull()) | (df.index.isin(none_ids))]
        else:
            df.dropna(subset=[ARRAY_Y], inplace=True)

    chart_infos = plot.get(CHART_INFOS_ORG) or [{}]
    empty_summary = {
        'count': {},
        'basic_statistics': {},
        'non_parametric': {}
    }
    if not len(df) or df[ARRAY_Y].dtype.name.lower() in ['string', 'object']:
        return [empty_summary for _ in chart_infos]

    summaries = []
    array_y_num = df.loc[np.isfinite(df[ARRAY_Y]), ARRAY_Y]

    # calc overflow lower/upper
    num_over_upper = None
    num_over_lower = None
    overflow_lower, overflow_upper = calc_overflow_boundary(array_y_num)
    if overflow_upper is not None and overflow_lower is not None:
        overflow_upper = float(overflow_upper)
        overflow_lower = float(overflow_lower)
        num_over_upper = array_y_num[array_y_num > overflow_upper].size
        num_over_lower = array_y_num[array_y_num < overflow_lower].size

    x_not_none = df.loc[df[ARRAY_X].notnull(), ARRAY_X]
    min_x = x_not_none.min()
    max_x = x_not_none.max()
    for chart_info in chart_infos:
        if not len(x_not_none):
            summaries.append(empty_summary)
            continue

        # param
        th_high = chart_info.get(THRESH_HIGH)
        th_low = chart_info.get(THRESH_LOW)
        th_high_process = chart_info.get(PRC_MAX)
        th_low_process = chart_info.get(PRC_MIN)

        act_from = chart_info.get(ACT_FROM)
        act_from_formatted = reformat_dt_str(act_from, DATE_FORMAT_STR)
        if not act_from_formatted:
            act_from_formatted = reformat_dt_str('1970-01-01', DATE_FORMAT_STR)

        act_to = chart_info.get(ACT_TO)
        act_to_formatted = reformat_dt_str(act_to, DATE_FORMAT_STR)
        if not act_to_formatted:
            act_to_formatted = reformat_dt_str('9999-01-01', DATE_FORMAT_STR)

        if (not act_from and not act_to) or (act_from_formatted <= min_x and max_x <= act_to_formatted):
            df_threshold = df
        else:
            df_threshold = df[(df[ARRAY_X] >= act_from_formatted) & (df[ARRAY_X] < act_to_formatted)]

        count_unlinked = len(df_threshold[df_threshold[ARRAY_X].isnull()])

        array_y_th = df_threshold.loc[np.isfinite(df_threshold[ARRAY_Y]), ARRAY_Y]
        mode = get_mode(array_y_th)

        # count process
        ntotal = len(df_threshold)
        p = None
        p_minus = None
        p_plus = None
        pn_minus = 0
        pn_plus = 0
        if th_high is not None:
            pn_plus = array_y_th[array_y_th >= th_high].size
        if th_low is not None:
            pn_minus = array_y_th[array_y_th <= th_low].size
        pn = pn_minus + pn_plus
        if ntotal:
            p = (pn / ntotal) * 100
            p_minus = (pn_minus / ntotal) * 100
            p_plus = (pn_plus / ntotal) * 100

        p_proc = 0
        p_proc_minus = 0
        p_proc_plus = 0
        pn_proc_minus = 0
        pn_proc_plus = 0
        if th_high_process is not None:
            pn_proc_plus = array_y_th[array_y_th >= th_high_process].size
        if th_low_process is not None:
            pn_proc_minus = array_y_th[array_y_th <= th_low_process].size
        pn_proc = pn_proc_minus + pn_proc_plus
        if ntotal:
            p_proc = (pn_proc / ntotal) * 100
            p_proc_minus = (pn_proc_minus / ntotal) * 100
            p_proc_plus = (pn_proc_plus / ntotal) * 100

        # noneを事前に分ける必要あり
        null_idxs = df_threshold[ARRAY_Y].isnull()
        array_y_null = df_threshold.loc[null_idxs, ARRAY_Y]
        array_y_not_null = df_threshold.loc[~null_idxs, ARRAY_Y]
        pn_na = len(array_y_null) - count_unlinked
        pn_nan = 0

        pn_inf = (array_y_not_null == float('inf')).sum()
        pn_neg_inf = (array_y_not_null == -float('inf')).sum()
        p_na = 0
        p_inf = 0
        p_nan = 0
        p_neg_inf = 0
        len_array_y_all = len(df_threshold)
        if len_array_y_all:
            p_na = (pn_na / len_array_y_all) * 100
            p_inf = (pn_inf / len_array_y_all) * 100
            p_nan = (pn_nan / len_array_y_all) * 100
            p_neg_inf = (pn_neg_inf / len_array_y_all) * 100

        p_max = max((pn or 0), (pn_proc or 0))
        n_abnormal = pn_na + pn_nan + pn_inf + pn_neg_inf
        pn_total = p_max + n_abnormal
        # Calc the N in basic statistics
        # `N` is number of data points except a number of NA, NaN, Inf+/-
        # but including number of outCL and outAL
        n_stats = max(ntotal - n_abnormal, 0)

        p_total = None
        if ntotal:
            p_total = (pn_total / ntotal) * 100

        # normal distribution process
        average = None
        sigma = None
        sigma_3 = None
        if array_y_th.size:
            average = array_y_th.mean()
            sigma = np.std(array_y_th, ddof=1)  # 不変標準偏差を使っています
            sigma_3 = sigma * 3

        cp = None
        cpk = None
        if th_high is not None and th_low is not None and sigma:
            cp = (th_high - th_low) / (6 * sigma)
            cpk = min((th_high - average) / sigma_3, (average - th_low) / sigma_3)

        max_input_arr = None
        min_input_arr = None
        p95 = None
        p75 = None  # Q3
        median = None
        p25 = None  # Q1
        p5 = None

        if array_y_th.size:
            max_input_arr = array_y_th.max()
            min_input_arr = array_y_th.min()

        iqr = None
        whisker_lower = None
        whisker_upper = None
        lower_range = None
        upper_range = None
        trimmed_average = None
        trimmed_sigma = None
        trimmed_sigma_3 = None
        t_cp = None
        t_cpk = None
        t_max_input_arr = None
        t_min_input_arr = None
        t_n_stats = 0
        if array_y_th.size:
            # non parametric process
            p5, p25, median, p75, p95 = np.percentile(array_y_th, [5, 25, 50, 75, 95])
            iqr = p75 - p25
            whisker_lower = p25 - 1.5 * iqr
            whisker_upper = p75 + 1.5 * iqr

            # get trimming data from Q1 - 2.5*IQR
            # to Q3 + 2.5*IQR
            lower_range = p25 - 2.5 * iqr
            upper_range = p75 + 2.5 * iqr
            trimmed_array_y = array_y_th[(array_y_th >= lower_range) & (array_y_th <= upper_range)]
            trimmed_average = trimmed_array_y.mean()
            trimmed_sigma = np.std(trimmed_array_y, ddof=1)  # 不変標準偏差を使っています
            trimmed_sigma_3 = trimmed_sigma * 3
            t_n_stats = trimmed_array_y.size
            t_max_input_arr = trimmed_array_y.max()
            t_min_input_arr = trimmed_array_y.min()

            if th_high is not None and th_low is not None and trimmed_sigma:
                t_cp = (th_high - th_low) / (6 * trimmed_sigma)
                t_cpk = min((th_high - trimmed_average) / trimmed_sigma_3,
                            (trimmed_average - th_low) / trimmed_sigma_3)

        avg_p_3sigma = None
        avg_p_sigma = None
        avg_m_sigma = None
        avg_m_3sigma = None
        t_avg_p_3sigma = None
        t_avg_p_sigma = None
        t_avg_m_sigma = None
        t_avg_m_3sigma = None
        if average is not None and sigma is not None:
            avg_p_3sigma = average + sigma_3
            avg_p_sigma = average + sigma
            avg_m_sigma = average - sigma
            avg_m_3sigma = average - sigma_3
            t_avg_p_3sigma = trimmed_average + trimmed_sigma_3
            t_avg_p_sigma = trimmed_average + trimmed_sigma
            t_avg_m_sigma = trimmed_average - trimmed_sigma
            t_avg_m_3sigma = trimmed_average - trimmed_sigma_3

        linked_pct = (ntotal - count_unlinked) * 100 / (ntotal or 1)
        linked_pct = signify_digit(linked_pct)
        unlinked_pct = signify_digit(100 - linked_pct)

        niqr = (iqr * 0.7413) if iqr else None
        summaries.append({
            'count': {
                'ntotal': ntotal,
                'count_unlinked': count_unlinked,
                'pn': signify_digit(pn),
                'pn_minus': signify_digit(pn_minus),
                'pn_plus': signify_digit(pn_plus),
                'p': signify_digit(p),
                'p_minus': signify_digit(p_minus),
                'p_plus': signify_digit(p_plus),
                'pn_proc': signify_digit(pn_proc),
                'pn_proc_minus': signify_digit(pn_proc_minus),
                'pn_proc_plus': signify_digit(pn_proc_plus),
                'p_proc': signify_digit(p_proc),
                'p_proc_minus': signify_digit(p_proc_minus),
                'p_proc_plus': signify_digit(p_proc_plus),
                'pn_na': signify_digit(pn_na),
                'p_na': signify_digit(p_na),
                'pn_nan': signify_digit(pn_nan),
                'p_nan': signify_digit(p_nan),
                'pn_inf': signify_digit(pn_inf),
                'p_inf': signify_digit(p_inf),
                'pn_neg_inf': signify_digit(pn_neg_inf),
                'p_neg_inf': signify_digit(p_neg_inf),
                'pn_total': signify_digit(pn_total),
                'p_total': signify_digit(p_total),
                'linked_pct': linked_pct,
                'no_linked_pct': unlinked_pct,
            },
            'basic_statistics': {
                'n_stats': signify_digit(n_stats),
                't_n_stats': signify_digit(t_n_stats),
                'average': signify_digit(average),
                't_average': signify_digit(trimmed_average),
                'sigma': signify_digit(trimmed_sigma),
                't_sigma': signify_digit(sigma),
                'sigma_3': signify_digit(sigma_3),
                't_sigma_3': signify_digit(trimmed_sigma_3),
                'Cp': signify_digit(cp),
                'Cpk': signify_digit(cpk),
                't_cp': signify_digit(t_cp),
                't_cpk': signify_digit(t_cpk),
                'Max': signify_digit(max_input_arr),
                't_max': signify_digit(t_max_input_arr),
                'max_org': max_input_arr,
                'Min': signify_digit(min_input_arr),
                't_min': signify_digit(t_min_input_arr),
                'min_org': min_input_arr,
                'avg_p_3sigma': signify_digit(avg_p_3sigma),
                'avg_p_sigma': signify_digit(avg_p_sigma),
                'avg_m_sigma': signify_digit(avg_m_sigma),
                'avg_m_3sigma': signify_digit(avg_m_3sigma),
                't_avg_p_3sigma': signify_digit(t_avg_p_3sigma),
                't_avg_p_sigma': signify_digit(t_avg_p_sigma),
                't_avg_m_sigma': signify_digit(t_avg_m_sigma),
                't_avg_m_3sigma': signify_digit(t_avg_m_3sigma),

            },
            'non_parametric': {
                'p95': signify_digit(p95),
                'p75': signify_digit(p75),
                'p75_org': p75,
                'median': signify_digit(median),
                'median_org': median,
                'p25': signify_digit(p25),
                'p25_org': p25,
                'whisker_lower': signify_digit(whisker_lower),
                'whisker_lower_org': whisker_lower,
                'whisker_upper': signify_digit(whisker_upper),
                'whisker_upper_org': whisker_upper,
                'p5': signify_digit(p5),
                'num_over_upper': signify_digit(num_over_upper),
                'num_over_lower': signify_digit(num_over_lower),
                'iqr': signify_digit(iqr),
                'niqr': signify_digit(niqr),
                'lower_range': signify_digit(lower_range),
                'lower_range_org': lower_range,
                'upper_range': signify_digit(upper_range),
                'upper_range_org': upper_range,
                'mode': signify_digit(mode),
            }
        })

    return summaries


@log_execution_time()
@request_timeout_handling()
def calc_summaries(dic_param):
    for plot in dic_param['array_plotdata'] or []:
        plot[SUMMARIES] = calc_summary_elements(plot)


@log_execution_time()
def calc_summaries_cate_var(dic_param):
    array_plotdatas = dic_param['array_plotdata'] or {}
    for end_col, plotdatas in array_plotdatas.items():
        for plotdata in plotdatas or []:
            plotdata[SUMMARIES] = calc_summary_elements(plotdata)


def get_mode(series: Series):
    try:
        return series.mode()[0]
    except Exception:
        return None
