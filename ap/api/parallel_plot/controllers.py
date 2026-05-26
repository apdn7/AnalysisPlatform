import json
import timeit

import pandas as pd
from flask import Blueprint, request

from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_graph_context_param
from ap.api.multi_scatter_plot.services import calc_partial_corr
from ap.api.parallel_plot.services import gen_graph_paracords, generate_mask_from_constraint
from ap.api.trace_data.services.csv_export import export_preprocessing, gen_df_export, make_graph_param, to_csv
from ap.common.constants import (
    COMMON,
    CONSTRAINT_RANGE,
    EMPTY_STRING,
    EXPORT_FROM,
    ONLY_EXPORT_DATA_SELECTED,
    SELECTED,
    SELECTED_NA_INF_VALUES,
    TIME_COL,
    TRUE_MATCH,
    CSVExtTypes,
    DataExportMode,
)
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import bind_dic_param_to_class, parse_multi_filter_into_one, parse_request_params
from ap.common.services.http_content import json_dumps, orjson_dumps
from ap.common.services.import_export_config_n_data import (
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
    trace_log_params,
)

api_paracords_blueprint = Blueprint('api_paracords', __name__, url_prefix='/ap/api/pcp')


@api_paracords_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    graph_context = get_graph_context_param(dic_form, EventType.PCP)

    dic_param = gen_graph_paracords(graph_context.graph_param, graph_context.dic_param, graph_context.df)
    calc_partial_corr(dic_param)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.PCP))

    # trace_data.htmlをもとにHTML生成
    out_dict = orjson_dumps(dic_param)
    return out_dict, 200


@api_paracords_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """Csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)
    graph_param, client_timezone = make_graph_param(graph_param, dic_param)
    delimiter = ',' if export_type == CSVExtTypes.CSV.value else '\t'
    export_only_selected = dic_form.get(ONLY_EXPORT_DATA_SELECTED, 'false') == TRUE_MATCH

    df = gen_df_export(graph_param, dic_param)

    if dic_param[COMMON][EXPORT_FROM] == DataExportMode.PLOT.value:
        mask = generate_mask_from_constraint(
            json.loads(dic_form[CONSTRAINT_RANGE]), json.loads(dic_form[SELECTED_NA_INF_VALUES]), graph_param, df
        )

        selected_index = list(df[mask].index)
        # add selected column 0 -> gray, 1 -> color of user selected value in plot PCP
        df[SELECTED] = 0
        df.loc[selected_index, SELECTED] = 1
        if export_only_selected:
            df = df[df[SELECTED] == 1]
            del df[SELECTED]

    if delimiter:
        csv_data = to_csv(
            df,
            graph_param,
            delimiter=delimiter,
            client_timezone=client_timezone,
            terms=None,
        )
    else:
        csv_data = to_csv(df, graph_param, client_timezone=client_timezone, terms=None)

    response = zip_file_to_response([csv_data], None, export_type=export_type)
    return response


@api_paracords_blueprint.route('/select_data', methods=['GET'])
def select_data():
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)
    graph_param, client_timezone = make_graph_param(graph_param, dic_param)

    df = gen_df_export(graph_param, dic_param)

    if dic_param[COMMON][EXPORT_FROM] == DataExportMode.PLOT.value:
        mask = generate_mask_from_constraint(
            json.loads(dic_form[CONSTRAINT_RANGE]), json.loads(dic_form[SELECTED_NA_INF_VALUES]), graph_param, df
        )

        selected_index = list(df[mask].index)
        df = df.loc[selected_index]
        # return top 20 values of df, sorted by time descending
        df = df.sort_values(by=TIME_COL, ascending=False).head(20)

    processed_df = export_preprocessing(
        df,
        graph_param,
        client_timezone=client_timezone,
        terms=None,
    )
    # fill empty values for displaying on frontend
    processed_df = processed_df.astype(pd.StringDtype()).fillna(EMPTY_STRING)
    result = processed_df.to_dict(orient='records')
    response = {'cols': processed_df.columns.tolist(), 'rows': result, 'cols_name': processed_df.columns.to_list()}
    return json_dumps(response), 200
