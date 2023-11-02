import json
import timeit

from flask import Blueprint, request

from ap.api.multi_scatter_plot.services import (
    clear_unused_data,
    gen_scatter_n_contour_data,
    gen_scatter_plot,
)
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_FORMVAL,
    ARRAY_PLOTDATA,
    AS_HEATMAP_MATRIX,
    END_COL_ID,
    GET02_VALS_SELECT,
    ORDER_ARRAY_FORMVAL,
    SCATTER_CONTOUR,
    SHOW_ONLY_CONTOUR,
    USE_CONTOUR,
    USE_HEATMAP,
)
from ap.common.pysize import get_size
from ap.common.services.form_env import parse_multi_filter_into_one
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    get_dic_form_from_debug_info,
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    is_send_google_analytics,
    save_draw_graph_trace,
    save_input_data_to_file,
    trace_log_params,
)

api_multi_scatter_blueprint = Blueprint(
    'api_multi_scatter_module', __name__, url_prefix='/ap/api/msp'
)


@api_multi_scatter_blueprint.route('/plot', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    save_input_data_to_file(dic_form, EventType.MSP)

    use_contour = int(request.form.get(USE_CONTOUR)) if request.form.get(USE_CONTOUR) else 0
    # show heatmap as default
    use_heatmap = int(request.form.get(USE_HEATMAP)) if request.form.get(USE_HEATMAP) else 1
    order_array_formval = json.loads(request.form.get(ORDER_ARRAY_FORMVAL, '[]'))
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    # if universal call gen_dframe else gen_results
    orig_send_ga_flg = is_send_google_analytics
    dic_param, dic_data = gen_scatter_plot(dic_param)

    # generate SCATTER_CONTOUR
    if order_array_formval:
        dic_param[ARRAY_FORMVAL] = order_array_formval
        # sort array plot
        new_list = []
        for formval in order_array_formval:
            col_id = formval[GET02_VALS_SELECT]
            data = [val for val in dic_param[ARRAY_PLOTDATA] if val[END_COL_ID] == col_id][0]
            new_list.append(data)
        dic_param[ARRAY_PLOTDATA] = new_list

    dic_param[SHOW_ONLY_CONTOUR] = False
    if not dic_param[AS_HEATMAP_MATRIX]:
        dic_param[SCATTER_CONTOUR], limit = gen_scatter_n_contour_data(
            dic_param, dic_data, use_contour
        )
        dic_param[SHOW_ONLY_CONTOUR] = dic_param[ACTUAL_RECORD_NUMBER] >= limit

    dic_param = clear_unused_data(dic_param)

    # send Google Analytics changed flag
    if orig_send_ga_flg and not is_send_google_analytics:
        dic_param.update({'is_send_ga_off': True})

    # remove unused params
    # remove_unused_params(dic_param)

    # calculate data size to send gtag
    data_size = get_size(dic_param)
    dic_param['data_size'] = data_size

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.MSP))

    dic_param['show_heatmap'] = use_heatmap
    out_dict = orjson_dumps(dic_param)

    return out_dict, 200
