import timeit

from flask import Blueprint, request

from ap.api.multi_scatter_plot.services import calc_partial_corr
from ap.api.parallel_plot.services import gen_graph_paracords
from ap.common.services.form_env import parse_multi_filter_into_one
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

api_paracords_blueprint = Blueprint('api_paracords', __name__, url_prefix='/ap/api/pcp')


@api_paracords_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    save_input_data_to_file(dic_form, EventType.PCP)
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    dic_param = gen_graph_paracords(dic_param)
    calc_partial_corr(dic_param)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.PCP))

    # trace_data.htmlをもとにHTML生成
    out_dict = orjson_dumps(dic_param)
    return out_dict, 200
