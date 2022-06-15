import timeit

import simplejson
from flask import Blueprint, request

from histview2.api.multi_scatter_plot.services import gen_scatter_plot, remove_unused_params, gen_scatter_n_contour_data
from histview2.common.constants import SCATTER_CONTOUR
from histview2.common.pysize import get_size
from histview2.common.services import http_content
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import is_send_google_analytics, save_input_data_to_file, EventType

api_multi_scatter_blueprint = Blueprint(
    'api_multi_scatter_module',
    __name__,
    url_prefix='/histview2/api/msp'
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

    use_contour = int(request.form.get('use_contour')) if request.form.get('use_contour') else 0
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    # if universal call gen_dframe else gen_results
    orig_send_ga_flg = is_send_google_analytics
    dic_param, dic_data = gen_scatter_plot(dic_param)

    # generate SCATTER_CONTOUR
    dic_param[SCATTER_CONTOUR] = gen_scatter_n_contour_data(dic_param, dic_data, use_contour)

    # send Google Analytics changed flag
    if orig_send_ga_flg and not is_send_google_analytics:
        dic_param.update({'is_send_ga_off': True})

    # remove unused params
    remove_unused_params(dic_param)

    # calculate data size to send gtag
    data_size = get_size(dic_param)
    dic_param['data_size'] = data_size

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    out_dict = simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)

    return out_dict, 200
