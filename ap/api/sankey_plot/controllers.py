import timeit

from flask import Blueprint, request

from ap.api.common.services.show_graph_jump_function import get_graph_context_param
from ap.api.sankey_plot.sankey_glasso.sankey_services import gen_graph_sankey_group_lasso
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
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
    # convert to array to query data for many sensors
    # convert_end_cols_to_array(dic_param) // check this function is necessary?

    graph_context = get_graph_context_param(dic_form, EventType.SKD)

    dic_param = gen_graph_sankey_group_lasso(graph_context.graph_param, graph_context.dic_param, graph_context.df)
    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.SKD))

    out_dict = orjson_dumps(dic_param)
    return out_dict, 200
