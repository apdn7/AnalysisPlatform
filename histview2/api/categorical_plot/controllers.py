import timeit

import simplejson
from flask import Blueprint, request, send_from_directory

from histview2.api.categorical_plot.services \
    import gen_trace_data_by_categorical_var, customize_dict_param, \
    gen_trace_data_by_term, convert_end_cols_to_array, \
    gen_trace_data_by_cyclic
from histview2.common.common_utils import resource_path
from histview2.common.logger import logger
from histview2.common.services import http_content
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import save_input_data_to_file, EventType
from histview2.common.yaml_utils import *

api_categorical_plot_blueprint = Blueprint(
    'api_categorical_plot',
    __name__,
    url_prefix='/histview2/api/stp'
)

# ローカルパラメータの設定
local_params = {
    "config_yaml_fname_proc": dic_yaml_config_file[YAML_PROC],
    "config_yaml_fname_histview2": dic_yaml_config_file[YAML_CONFIG_HISTVIEW2],
    "config_yaml_fname_db": dic_yaml_config_file[YAML_CONFIG_DB],
}

MAX_GRAPH_PER_TAB = 32


@api_categorical_plot_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """

    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    save_input_data_to_file(dic_form, EventType.STP)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    proc_name = dic_param.get(COMMON).get(END_PROC)
    time_conds = dic_param.get(TIME_CONDS)
    compare_type = dic_param.get(COMMON).get(COMPARE_TYPE)

    if not proc_name or not time_conds:
        return {}, 200

    if compare_type == CATEGORICAL:
        convert_end_cols_to_array(dic_param)
        dic_param = gen_trace_data_by_categorical_var(dic_param, MAX_GRAPH_PER_TAB)
    elif compare_type == RL_CYCLIC_TERM:
        dic_param = gen_trace_data_by_cyclic(dic_param, MAX_GRAPH_PER_TAB)
    else:
        dic_param = gen_trace_data_by_term(dic_param, MAX_GRAPH_PER_TAB)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    # trace_data.htmlをもとにHTML生成
    out_dict = simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)
    return out_dict, 200


@api_categorical_plot_blueprint.route('/image/<filename>')
def download_file(filename):
    dir_data_view = resource_path('data', 'view', level=AbsPath.SHOW)
    logger.info('dir_data_view: ', dir_data_view, '; filename', filename)

    return send_from_directory(dir_data_view, filename)
