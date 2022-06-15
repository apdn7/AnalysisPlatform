import json
import timeit

from flask import Blueprint, request

from histview2.api.ridgeline_plot.services \
    import customize_dict_param, convert_end_cols_to_array
from histview2.api.sankey_plot.sankey_glasso.sankey_services import gen_graph_sankey_group_lasso
from histview2.common.services import http_content
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import save_input_data_to_file, EventType
from histview2.common.yaml_utils import *

api_sankey_plot_blueprint = Blueprint(
    'api_sankey_plot',
    __name__,
    url_prefix='/histview2/api/skd'
)


@api_sankey_plot_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.SKD)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    proc_name = dic_param.get(COMMON).get(END_PROC)
    time_conds = dic_param.get(TIME_CONDS)

    if not proc_name or not time_conds:
        return {}, 200

    # convert to array to query data for many sensors
    convert_end_cols_to_array(dic_param)

    dic_param = gen_graph_sankey_group_lasso(dic_param)
    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    out_dict = json.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial)
    return out_dict, 200
