import timeit

from flask import Blueprint, request

from ap.api.causal_relation_plot.services.causal_relation_services import gen_graph_causal_relation
from ap.api.common.services.show_graph_jump_function import get_graph_context_param
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
    trace_log_params,
)

api_causal_relation_plot = Blueprint('api_causal_relation_plot', __name__, url_prefix='/ap/api/analyze/crp')


@api_causal_relation_plot.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    graph_context = get_graph_context_param(dic_form, EventType.CRP)

    dic_param = gen_graph_causal_relation(graph_context.graph_param, graph_context.dic_param, graph_context.df)
    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.SKD))

    out_dict = orjson_dumps(dic_param)
    return out_dict, 200
