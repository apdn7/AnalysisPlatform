import timeit
from copy import deepcopy

from flask import Blueprint, Response, request, send_from_directory

from ap.api.categorical_plot.services import (
    convert_end_cols_to_array,
    customize_dict_param,
    gen_trace_data_by_categorical_var,
    gen_trace_data_by_cyclic,
    gen_trace_data_by_term,
)
from ap.api.common.services.services import get_filter_on_demand_data
from ap.api.trace_data.services.csv_export import gen_csv_data
from ap.common.common_utils import resource_path
from ap.common.constants import *
from ap.common.logger import logger
from ap.common.services import csv_content
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import (
    get_end_procs_param,
    parse_multi_filter_into_one,
    parse_request_params,
    update_data_from_multiple_dic_params,
)
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

api_categorical_plot_blueprint = Blueprint(
    'api_categorical_plot', __name__, url_prefix='/ap/api/stp'
)

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

    org_dicparam = deepcopy(dic_param)
    dic_params = get_end_procs_param(dic_param)

    for single_dic_param in dic_params:
        if compare_type == CATEGORICAL:
            convert_end_cols_to_array(single_dic_param)
            stp_dat = gen_trace_data_by_categorical_var(single_dic_param, MAX_GRAPH_PER_TAB)
        elif compare_type == RL_CYCLIC_TERM:
            stp_dat = gen_trace_data_by_cyclic(single_dic_param, MAX_GRAPH_PER_TAB)
        else:
            stp_dat = gen_trace_data_by_term(single_dic_param, MAX_GRAPH_PER_TAB)
        org_dicparam = update_data_from_multiple_dic_params(org_dicparam, stp_dat)

    stop = timeit.default_timer()
    org_dicparam['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(org_dicparam)

    org_dicparam['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.STP))

    org_dicparam = get_filter_on_demand_data(org_dicparam)

    # trace_data.htmlをもとにHTML生成
    out_dict = orjson_dumps(org_dicparam)
    return out_dict, 200


@api_categorical_plot_blueprint.route('/image/<filename>')
def download_file(filename):
    dir_data_view = resource_path('data', 'view', level=AbsPath.SHOW)
    logger.info('dir_data_view: {}; filename: {}'.format(dir_data_view, filename))

    return send_from_directory(dir_data_view, filename)


@api_categorical_plot_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    stratified_by_terms = dic_param[COMMON].get(COMPARE_TYPE) in [RL_CYCLIC_TERM, RL_DIRECT_TERM]
    delimiter = ',' if export_type == 'csv' else '\t'
    csv_str = gen_csv_data(dic_param, delimiter=delimiter, with_terms=stratified_by_terms)
    response = zip_file_to_response([csv_str], None, export_type=export_type)
    return response
