import timeit

from flask import Blueprint, request

from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_jump_emd_data
from ap.api.ridgeline_plot.services import convert_end_cols_to_array, customize_dict_param
from ap.api.sankey_plot.sankey_glasso.sankey_services import gen_graph_sankey_group_lasso
from ap.common.constants import COMMON, END_PROC, TIME_CONDS
from ap.common.services.form_env import bind_dic_param_to_class, parse_multi_filter_into_one
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    get_dic_form_from_debug_info,
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
    save_input_data_to_file,
    trace_log_params,
)

api_sankey_plot_blueprint = Blueprint('api_sankey_plot', __name__, url_prefix='/ap/api/skd')


@api_sankey_plot_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.SKD)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    proc_name = dic_param.get(COMMON).get(END_PROC)
    time_conds = dic_param.get(TIME_CONDS)

    if not proc_name or not time_conds:
        return {}, 200

    # convert to array to query data for many sensors
    convert_end_cols_to_array(dic_param)

    cache_dic_param, graph_param, df = get_jump_emd_data(dic_form)

    if not graph_param:
        dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)

    dic_param = gen_graph_sankey_group_lasso(graph_param, cache_dic_param or dic_param, df)
    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.SKD))

    out_dict = orjson_dumps(dic_param)
    return out_dict, 200
