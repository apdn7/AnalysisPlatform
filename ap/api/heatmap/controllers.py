import timeit

from flask import Blueprint, current_app, request

from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_jump_emd_data
from ap.api.heatmap.services import gen_heatmap_data
from ap.common.pysize import get_size
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

api_heatmap_blueprint = Blueprint('api_heatmap_module', __name__, url_prefix='/ap/api/hmp')


@api_heatmap_blueprint.route('/plot', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    save_input_data_to_file(dic_form, EventType.SCP)
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    # if universal call gen_dframe else gen_results
    orig_send_ga_flg = current_app.config.get('IS_SEND_GOOGLE_ANALYTICS')

    cache_dic_param, graph_param, df = get_jump_emd_data(dic_form)

    if not graph_param:
        dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)
    else:
        dic_param = cache_dic_param

    # dic_param = gen_scatter_plot(graph_param, dic_param, df)
    dic_param = gen_heatmap_data(graph_param, dic_param, df)

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
