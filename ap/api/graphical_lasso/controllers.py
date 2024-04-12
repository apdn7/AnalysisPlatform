import timeit

from flask import Blueprint, request

from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_jump_emd_data
from ap.api.graphical_lasso.services import gen_graphical_lasso
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

api_gl_blueprint = Blueprint('api_gl', __name__, url_prefix='/ap/api/gl')


@api_gl_blueprint.route('/plot', methods=['POST'])
def graphical_lasso():
    """[summary]
    Returns:
        [type] -- [description]
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.GL)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    cache_dic_param, graph_param, df = get_jump_emd_data(dic_form)

    if not graph_param:
        dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)

    dic_param = gen_graphical_lasso(graph_param, dic_param, df)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.GL))

    return orjson_dumps(dic_param)
