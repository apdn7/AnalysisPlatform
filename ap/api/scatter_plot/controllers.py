import timeit

from flask import Blueprint, current_app, request

from ap.api.common.services.show_graph_jump_function import get_graph_context_param
from ap.api.scatter_plot.services import gen_scatter_plot
from ap.common.pysize import get_size
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
    trace_log_params,
)

api_scatter_blueprint = Blueprint('api_scatter_module', __name__, url_prefix='/ap/api/scp')


@api_scatter_blueprint.route('/plot', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    # if universal call gen_dframe else gen_results
    orig_send_ga_flg = current_app.config.get('IS_SEND_GOOGLE_ANALYTICS')

    graph_context = get_graph_context_param(dic_form, EventType.SCP)

    dic_param = gen_scatter_plot(graph_context.graph_param, graph_context.dic_param, graph_context.df)

    # send Google Analytics changed flag
    if orig_send_ga_flg and not current_app.config.get('IS_SEND_GOOGLE_ANALYTICS'):
        dic_param.update({'is_send_ga_off': True})

    # calculate data size to send gtag
    data_size = get_size(dic_param)
    dic_param['data_size'] = data_size

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.SCP))

    out_dict = orjson_dumps(dic_param)

    return out_dict, 200
