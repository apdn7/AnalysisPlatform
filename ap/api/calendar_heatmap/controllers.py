import timeit
from copy import deepcopy

from flask import Blueprint, request

from ap.api.calendar_heatmap.services import gen_heatmap_data
from ap.api.categorical_plot.services import customize_dict_param
from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_jump_emd_data
from ap.api.trace_data.services.csv_export import gen_csv_data
from ap.common.constants import (
    ARRAY_FORMVAL,
    COMMON,
    END_PROC,
    START_PROC,
    CSVExtTypes,
)
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import (
    bind_dic_param_to_class,
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

api_calendar_heatmap_blueprint = Blueprint('api_heatmap', __name__, url_prefix='/ap/api/chm')


@api_calendar_heatmap_blueprint.route('/plot', methods=['POST'])
def generate_heatmap():
    """[summary]
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

    cache_dic_param, graph_param, df = get_jump_emd_data(dic_form)

    if not cache_dic_param:
        dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    else:
        dic_param = cache_dic_param
        dic_proc_cfgs = graph_param.dic_proc_cfgs
        trace_graph = graph_param.trace_graph
        dic_card_orders = graph_param.dic_card_orders

    customize_dict_param(dic_param)
    org_dic_param = deepcopy(dic_param)
    dic_params = get_end_procs_param(dic_param, dic_proc_cfgs)

    for single_dic_param in dic_params:
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, single_dic_param)
        heatmap_dat = gen_heatmap_data(graph_param, single_dic_param, df)
        org_dic_param = update_data_from_multiple_dic_params(org_dic_param, heatmap_dat)

    stop = timeit.default_timer()
    org_dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(org_dic_param)

    org_dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.CHM))

    return orjson_dumps(org_dic_param)


@api_calendar_heatmap_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)

    # chm
    mode = dic_form.get('mode') or []
    if mode and '1' in set(mode):
        dic_form['step'] = dic_form['step_minute']
    else:
        dic_form['step'] = dic_form['step_hour']

    dic_param = parse_multi_filter_into_one(dic_form)
    customize_dict_param(dic_param)

    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)

    delimiter = ',' if export_type == CSVExtTypes.CSV.value else '\t'
    csv_data, csv_list_name = gen_csv_data(graph_param, dic_param, delimiter=delimiter, by_cells=True)

    response = zip_file_to_response([csv_data], csv_list_name, export_type=export_type)
    return response
