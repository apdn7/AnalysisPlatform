import itertools
from datetime import datetime, timedelta
from typing import List

import numpy as np
import pandas as pd
import pytz
from dateutil import parser, tz

from histview2.api.trace_data.services.graph_search import GraphUtil
from histview2.api.trace_data.services.proc_link import order_before_mapping_data
from histview2.api.trace_data.services.time_series_chart import get_data_from_db, gen_dic_data_from_df, \
    get_chart_infos, gen_plotdata, create_rsuffix, get_procs_in_dic_param, create_graph_config, \
    gen_blank_df_end_cols
from histview2.common.common_utils import gen_sql_label, DATE_FORMAT_STR_CSV, DATE_FORMAT, TIME_FORMAT
from histview2.common.constants import ARRAY_PLOTDATA, PRC_MAX, PRC_MIN, THRESH_HIGH, THRESH_LOW, ARRAY_FORMVAL, \
    END_PROC, GET02_VALS_SELECT, ACT_FROM, ACT_TO, SUMMARIES
from histview2.common.logger import log_execution_time
from histview2.common.services.form_env import bind_dic_param_to_class, parse_multi_filter_into_one
from histview2.common.services.statistics import calc_summaries
from histview2.common.yaml_utils import YamlConfig
from histview2.setting_module.models import CfgProcessColumn, CfgTrace, CfgProcess
from histview2.trace_data.models import Cycle
from histview2.trace_data.schemas import EndProc


@log_execution_time()
def gen_graph_plot_view(dic_form):
    """tracing data to show graph
        1 start point x n end point
        filter by condition point
        https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """
    dic_param = parse_multi_filter_into_one(dic_form)
    cycle_id = int(dic_form.get('cycle_id'))
    point_time = dic_form.get('time')
    target_id = int(dic_form.get('sensor_id'))
    sensor = CfgProcessColumn.query.get(target_id)
    target_proc_id = sensor.process_id

    # bind graph_param
    graph_param, dic_proc_cfgs = build_graph_param(dic_param)

    # get data from database
    df, _, _ = get_data_from_db( graph_param)

    # create output data
    orig_graph_param = bind_dic_param_to_class(dic_param)
    orig_graph_param.add_cate_procs_to_array_formval()
    dic_data = gen_dic_data_from_df(df, orig_graph_param)
    orig_graph_param = bind_dic_param_to_class(dic_param)
    times = df[Cycle.time.key].tolist() or []

    # get chart infos
    chart_infos, original_graph_configs = get_chart_infos(orig_graph_param, dic_data, times)

    dic_param[ARRAY_FORMVAL], dic_param[ARRAY_PLOTDATA] \
        = gen_plotdata(orig_graph_param, dic_data, chart_infos, original_graph_configs)

    # calculate_summaries
    calc_summaries(dic_param)

    # extract_cycle
    df = extract_cycle(df, cycle_id)
    if df.empty:
        df = gen_blank_df_end_cols(graph_param.array_formval)
        df[df.columns] = df[df.columns].to_numpy()

    # timezone
    client_timezone = graph_param.common.client_timezone or tz.tzlocal()
    client_timezone = pytz.timezone(client_timezone)

    # List table
    list_tbl_header, list_tbl_rows = gen_list_table(dic_proc_cfgs, graph_param, df, client_timezone)

    # Stats table
    stats_tbl_header, stats_tbl_data = gen_stats_table(
        dic_proc_cfgs,
        graph_param,
        df,
        dic_param,
        original_graph_configs,
        client_timezone,
        point_time,
        target_id,
        target_proc_id,
    )

    # Full link table
    dic_param = build_dic_param_plot_view(dic_form)
    graph_param, dic_proc_cfgs = build_graph_param(dic_param, full_link=True)
    df_full, _, _ = get_data_from_db( graph_param)
    df_full: pd.DataFrame = extract_cycle(df_full, cycle_id)
    if df_full.empty:
        df_full = gen_blank_df_end_cols(graph_param.array_formval)
        df_full[df.columns] = df[df.columns].to_numpy()

    full_link_tbl_header, full_link_tbl_rows = gen_list_table(dic_proc_cfgs, graph_param, df_full, client_timezone)

    return dic_param, {
        'stats_tbl_header': stats_tbl_header,
        'stats_tbl_data': stats_tbl_data,
        'list_tbl_header': list_tbl_header,
        'list_tbl_rows': list_tbl_rows,
        'full_link_tbl_header': full_link_tbl_header,
        'full_link_tbl_rows': full_link_tbl_rows,
    }


def extract_cycle(df: pd.DataFrame, cycle_id):
    if 'id' in df.columns:
        df = df[df.id == cycle_id].reset_index()
    else:
        df = df[df.index == cycle_id].reset_index()

    return df.replace({np.nan: ''})


def gen_stats_table(dic_proc_cfgs, graph_param, df, dic_param, chart_infos, client_timezone, start_time_val, target_id,
                    target_proc_id):
    proc_ids = dic_proc_cfgs.keys()
    proc_ids = order_proc_as_trace_config(proc_ids)

    stats_tbl_data = []
    max_num_serial = 1
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        serial_col_cfgs = proc_cfg.get_serials(column_name_only=False)
        if len(serial_col_cfgs) >= max_num_serial:
            max_num_serial = len(serial_col_cfgs)

    for proc_order, proc_id in enumerate(proc_ids):
        proc_cfg = dic_proc_cfgs.get(proc_id)
        end_proc: EndProc = graph_param.search_end_proc(proc_id)[1]
        col_ids = end_proc.col_ids
        col_names = end_proc.col_names
        col_show_names = end_proc.col_show_names
        serial_col_cfgs = proc_cfg.get_serials(column_name_only=False)
        serial_ids = []
        serial_vals = []
        for serial in serial_col_cfgs:
            serial_label = gen_sql_label(serial.id, serial.column_name)
            serial_ids.append(serial.id)
            serial_vals.append(df.loc[0][serial_label])

        if len(serial_col_cfgs) < max_num_serial:
            diff = max_num_serial - len(serial_col_cfgs)
            for i in range(diff):
                serial_ids.append('')
                serial_vals.append('')

        # Datetime
        time_col_name = str(Cycle.time.key) + create_rsuffix(proc_id)
        time_val = df.loc[0][time_col_name]
        if not pd.isna(time_val) and time_val:
            dt_obj = parser.parse(time_val)
            dt_obj = dt_obj.astimezone(client_timezone)
            time_val = datetime.strftime(dt_obj, DATE_FORMAT_STR_CSV)
        else:
            time_val = ''

        for col_idx, col_id in enumerate(col_ids):
            if col_id in serial_ids:
                continue

            row = []
            if col_id == target_id:
                priority = 1
            elif proc_id == target_proc_id:
                priority = 2
            else:
                priority = proc_order + 10
            row.append(priority)

            # Serial No
            row.extend(serial_vals)

            # Item
            col_name = col_names[col_idx]
            row.append(col_name)

            # Name
            col_show_name = col_show_names[col_idx]
            row.append(col_show_name)

            # Value
            col_label = gen_sql_label(col_id, col_name)
            col_val = df.loc[0][col_label]
            row.append(col_val)

            # Datetime
            row.append(time_val)

            # Process
            row.append(proc_cfg.name)

            # Threshold
            latest_idx = None
            col_idx = get_sensor_idx(dic_param, proc_id, col_id)
            col_thresholds = YamlConfig.get_node(chart_infos, [proc_id, col_id]) or []
            threshold = {}
            if col_thresholds:
                point_time = time_val or start_time_val
                threshold, latest_idx = get_latest_threshold(col_thresholds, point_time, client_timezone)
            th_type = threshold.get('type') or ''
            th_name = threshold.get('name') or ''
            if col_idx is not None:
                th_type = th_type or 'Default'
                th_name = th_name or 'Default'
            lcl = threshold.get(THRESH_LOW) or ''
            ucl = threshold.get(THRESH_HIGH) or ''
            lpcl = threshold.get(PRC_MIN) or ''
            upcl = threshold.get(PRC_MAX) or ''
            row.extend([th_type, th_name, lcl, ucl, lpcl, upcl])

            # Summaries
            if col_idx is not None and latest_idx is not None:
                plotdata = dic_param[ARRAY_PLOTDATA][col_idx]
                summaries = plotdata[SUMMARIES] or []
                summary = summaries[latest_idx]
                row.extend(build_summary_cells(summary))
            else:
                row.extend(build_empty_summary_cells())

            stats_tbl_data.append(row)

    stats_tbl_data = sorted(stats_tbl_data, key=lambda x: int(x[0]))
    stats_tbl_data = list(map(lambda x: x[1:], stats_tbl_data))

    stats_tbl_header = build_stats_header(max_num_serial)

    return stats_tbl_header, stats_tbl_data


def get_latest_threshold(col_thresholds, point_time, client_timezone):
    if not col_thresholds:
        return create_graph_config()[0], None

    if point_time:
        point_time = parser.parse(point_time)
        if point_time.tzinfo is None:
            point_time = client_timezone.localize(point_time)
        latest_act_to = parser.parse('1970-01-01T00:00:00.000Z')
        latest_threshold = col_thresholds[0]
        latest_idx = 0
        for idx, th in enumerate(col_thresholds):
            act_from = parser.parse(th.get(ACT_FROM) or '1970-01-01T00:00:00.000Z')
            act_to = parser.parse(th.get(ACT_TO) or '9999-01-01T00:00:00.000Z')
            if act_from <= point_time <= act_to:
                if latest_act_to < act_to:
                    latest_threshold = th
                    latest_idx = idx
                    latest_act_to = act_to
        return latest_threshold, latest_idx
    else:
        latest_idx = 0
        return col_thresholds[latest_idx], latest_idx


def build_stats_header(max_num_serial):
    stats_tbl_header = ['Serial No {}'.format(idx + 1) for idx in range(max_num_serial)]
    stats_tbl_header.extend(['Item', 'Name', 'Value', 'Datetime', 'Process name',
                             'Type', 'Name', 'Lower threshold', 'Upper threshold',
                             'Lower process threshold', 'Upper process threshold',
                             'N', 'Average', '3σ', 'Cp', 'Cpk', 'σ', 'Max', 'Min',
                             'Median', 'P95', 'P75 Q3', 'P25 Q1', 'P5', 'IQR'])
    return stats_tbl_header


def build_empty_summary_cells():
    return [''] * 14


def build_summary_cells(summary):
    bstats = summary['basic_statistics'] or {}
    non_pt = summary['non_parametric'] or {}
    return list(map(
        lambda x: '' if x is None else x,
        [bstats.get('n_stats'), bstats.get('average'), bstats.get('sigma_3'), bstats.get('Cp'),
         bstats.get('Cpk'), bstats.get('sigma'), bstats.get('Max'), bstats.get('Min'),
         non_pt.get('median'), non_pt.get('p95'), non_pt.get('p75'), non_pt.get('p25'), non_pt.get('p5'),
         non_pt.get('iqr')]
    ))


def convert_and_format(time_val, client_timezone, out_format=DATE_FORMAT_STR_CSV):
    dt_obj = parser.parse(time_val)
    dt_obj = dt_obj.astimezone(client_timezone)
    return datetime.strftime(dt_obj, out_format)


def gen_list_table(dic_proc_cfgs, graph_param, df, client_timezone):
    proc_ids = dic_proc_cfgs.keys()
    proc_ids = order_proc_as_trace_config(proc_ids)
    list_tbl_data = []
    list_tbl_header = []
    for proc_id in proc_ids:
        proc_cfg = dic_proc_cfgs.get(proc_id)
        list_tbl_header.extend(['Item', "Name", "Value"])
        end_proc: EndProc = graph_param.search_end_proc(proc_id)[1]
        col_ids = end_proc.col_ids
        get_date_col: CfgProcessColumn = proc_cfg.get_date_col(column_name_only=False)
        dic_id_col = {col.id: col for col in proc_cfg.columns}
        serial_col_cfgs = proc_cfg.get_serials(column_name_only=False)
        serial_ids = []
        serial_vals = []
        proc_rows = []
        for serial in serial_col_cfgs:
            serial_label = gen_sql_label(serial.id, serial.column_name)
            serial_ids.append(serial.id)
            serial_val = df.loc[0][serial_label]
            serial_vals.append(serial_val)
            # Serial No
            proc_rows.append([serial.column_name, serial.name, serial_val])

        # Datetime
        time_col_name = str(Cycle.time.key) + create_rsuffix(proc_id)
        time_val = df.loc[0][time_col_name]
        if not pd.isna(time_val) and time_val:
            time_val = convert_and_format(time_val, client_timezone, DATE_FORMAT_STR_CSV)
        else:
            time_val = ''
        proc_rows.append(['Datetime', '', time_val])

        # Line No
        proc_rows.append(['Line No', '', ''])

        # Process
        proc_rows.append(['Process', '', proc_cfg.name])

        # Machine No
        proc_rows.append(['Machine No', '', ''])

        # Part No
        proc_rows.append(['Part No', '', ''])

        # Other columns
        for col_id in col_ids:
            cfg_col: CfgProcessColumn = dic_id_col.get(col_id)
            if not cfg_col:
                continue

            if col_id in serial_ids:
                continue

            if col_id == get_date_col.id:
                continue

            row = []
            # Item
            row.append(cfg_col.column_name)

            # Name
            row.append(cfg_col.name)

            # Value
            col_label = gen_sql_label(cfg_col.id, cfg_col.column_name)
            col_val = df.loc[0][col_label]
            if cfg_col.is_get_date and not pd.isna(time_val) and time_val:
                time_val = convert_and_format(time_val, client_timezone, DATE_FORMAT_STR_CSV)
            else:
                row.append(col_val)

            proc_rows.append(row)

        # append to first table
        list_tbl_data.append(proc_rows)

    list_tbl_rows = []
    for row in itertools.zip_longest(*list_tbl_data):
        list_tbl_rows.append(list(itertools.chain.from_iterable([r if r else ['', '', ''] for r in row])))

    return list_tbl_header, list_tbl_rows


def get_sensor_idx(dic_param, proc_id, col_id):
    for idx, form_val in enumerate(dic_param[ARRAY_FORMVAL]):
        if form_val[END_PROC] == proc_id and form_val[GET02_VALS_SELECT] == col_id:
            return idx
    return None


def build_dic_param_plot_view(dic_form):
    clicked_time = dic_form.get('time')

    clicked_time = parser.parse(clicked_time)
    clicked_time = clicked_time - timedelta(minutes=5)
    start_date = clicked_time.strftime(DATE_FORMAT)
    start_time = clicked_time.strftime(TIME_FORMAT)
    clicked_time = clicked_time + timedelta(minutes=10)
    end_date = clicked_time.strftime(DATE_FORMAT)
    end_time = clicked_time.strftime(TIME_FORMAT)
    dic_form['START_DATE'] = start_date
    dic_form['END_DATE'] = end_date
    dic_form['START_TIME'] = start_time
    dic_form['END_TIME'] = end_time

    dic_param = parse_multi_filter_into_one(dic_form)

    return dic_param


def order_proc_as_trace_config(proc_ids):
    edges = CfgTrace.get_all()
    ordered_edges: List[CfgTrace] = order_before_mapping_data(edges)
    ordered_proc_ids = [(edge.self_process_id, edge.target_process_id) for edge in ordered_edges]
    ordered_proc_ids = list(itertools.chain.from_iterable(ordered_proc_ids))
    reversed_proc_ids = list(reversed(ordered_proc_ids))
    ordered_proc_ids = []
    for proc_id in reversed_proc_ids:
        if proc_id in proc_ids and proc_id not in ordered_proc_ids:
            ordered_proc_ids.append(proc_id)
    return list(reversed(ordered_proc_ids)) or proc_ids


def get_linked_procs(proc_id):
    processes = CfgProcess.get_all()
    nodes = [proc.id for proc in processes]

    edges: List[CfgTrace] = CfgTrace.get_all()

    graph_util = GraphUtil(nodes)
    for edge in edges:
        graph_util.add_edge(edge.self_process_id, edge.target_process_id)
        graph_util.add_edge(edge.target_process_id, edge.self_process_id)

    linked_procs = graph_util.find_linked_processes(proc_id)

    return linked_procs


def build_graph_param(dic_param, full_link=False):
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    # add relevant procs
    if full_link:
        relevant_procs = get_linked_procs(graph_param.get_start_proc())
        for proc_id in relevant_procs:
            graph_param.add_proc_to_array_formval(proc_id, [])

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add category
    graph_param.add_cate_procs_to_array_formval()

    # get serials
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        columns = proc_cfg.get_serials(column_name_only=False)
        if full_link:
            columns = proc_cfg.columns
        col_ids = [col.id for col in columns]
        proc.add_cols(col_ids)

    return graph_param, dic_proc_cfgs
