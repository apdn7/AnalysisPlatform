import timeit

import simplejson
from flask import Blueprint, request

from histview2.api.categorical_plot.services import customize_dict_param
from histview2.api.heatmap.services import gen_heatmap_data
from histview2.common.constants import COMMON, START_PROC, ARRAY_FORMVAL, END_PROC
from histview2.common.services import http_content
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import save_input_data_to_file, EventType

api_heatmap_blueprint = Blueprint(
    'api_heatmap',
    __name__,
    url_prefix='/histview2/api/chm'
)


@api_heatmap_blueprint.route('/plot', methods=['POST'])
def generate_heatmap():
    """ [summary]
    Returns:
        [type] -- [description]
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    mode = dic_form.get('mode') or []
    if mode and '1' in set(mode):  # 1 for daily and 7 for weekly
        dic_form['step'] = dic_form['step_minute']
    else:
        dic_form['step'] = dic_form['step_hour']

    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.CHM)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    start_proc = dic_param[COMMON].get(START_PROC)
    dic_param[COMMON][START_PROC] = start_proc if start_proc else dic_param[ARRAY_FORMVAL][0][END_PROC]

    customize_dict_param(dic_param)
    dic_param = gen_heatmap_data(dic_param)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    return simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)
