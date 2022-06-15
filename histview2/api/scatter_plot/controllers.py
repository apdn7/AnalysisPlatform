import timeit

import simplejson
from flask import Blueprint, request

from histview2.api.scatter_plot.services import gen_scatter_plot
from histview2.common.pysize import get_size
from histview2.common.services import http_content
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import is_send_google_analytics, save_input_data_to_file, EventType

api_scatter_blueprint = Blueprint(
    'api_scatter_module',
    __name__,
    url_prefix='/histview2/api/scp'
)


@api_scatter_blueprint.route('/plot', methods=['POST'])
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
    orig_send_ga_flg = is_send_google_analytics
    dic_param = gen_scatter_plot(dic_param)

    # send Google Analytics changed flag
    if orig_send_ga_flg and not is_send_google_analytics:
        dic_param.update({'is_send_ga_off': True})

    # calculate data size to send gtag
    data_size = get_size(dic_param)
    dic_param['data_size'] = data_size

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    out_dict = simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)

    return out_dict, 200
