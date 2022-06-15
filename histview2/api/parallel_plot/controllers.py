import timeit

import simplejson
from flask import Blueprint, request

from histview2 import dic_yaml_config_file
from histview2.api.parallel_plot.services import gen_graph_paracords
from histview2.common.constants import *
from histview2.common.services import http_content
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import save_input_data_to_file, EventType

api_paracords_blueprint = Blueprint(
    'api_paracords',
    __name__,
    url_prefix='/histview2/api/pcp'
)

# ローカルパラメータの設定
local_params = {
    "config_yaml_fname_proc": dic_yaml_config_file[YAML_PROC],
    "config_yaml_fname_histview2": dic_yaml_config_file[YAML_CONFIG_HISTVIEW2],
    "config_yaml_fname_db": dic_yaml_config_file[YAML_CONFIG_DB],
}


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

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    # trace_data.htmlをもとにHTML生成
    out_dict = simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)
    return out_dict, 200


@api_paracords_blueprint.route('/testme', methods=['GET'])
def testme():
    # TODO: remove API test function
    return 'OK', 200
