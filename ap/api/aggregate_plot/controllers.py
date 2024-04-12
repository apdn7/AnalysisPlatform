import timeit
from copy import deepcopy

import pytz
from dateutil import tz
from flask import Blueprint, request

from ap import max_graph_config
from ap.api.aggregate_plot.services import gen_agp_data
from ap.api.categorical_plot.services import customize_dict_param
from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_jump_emd_data
from ap.api.trace_data.services.csv_export import to_csv
from ap.common.constants import (
    ARRAY_FORMVAL,
    CLIENT_TIMEZONE,
    COMMON,
    END_PROC,
    CSVExtTypes,
    MaxGraphNumber,
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

api_agp_blueprint = Blueprint('api_agp', __name__, url_prefix='/ap/api/agp')


@api_agp_blueprint.route('/plot', methods=['POST'])
def generate_agp():
    """[summary]
    Returns:
        [type] -- [description]
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.AGP)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)
    customize_dict_param(dic_param)

    cache_dic_param, graph_param, df = get_jump_emd_data(dic_form)

    if not cache_dic_param:
        dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    else:
        dic_param = cache_dic_param
        dic_proc_cfgs = graph_param.dic_proc_cfgs
        trace_graph = graph_param.trace_graph
        dic_card_orders = graph_param.dic_card_orders

    org_dic_param = deepcopy(dic_param)
    dic_params = get_end_procs_param(dic_param)

    for single_dic_param in dic_params:
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, single_dic_param)
        agp_data, *_ = gen_agp_data(
            graph_param,
            single_dic_param,
            df,
            max_graph_config[MaxGraphNumber.AGP_MAX_GRAPH.name],
        )
        org_dic_param = update_data_from_multiple_dic_params(org_dic_param, agp_data)

    stop = timeit.default_timer()
    org_dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(org_dic_param)

    org_dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.CHM))

    return orjson_dumps(org_dic_param)


@api_agp_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)
    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    dic_params = get_end_procs_param(dic_param)

    delimiter = ',' if export_type == CSVExtTypes.CSV.value else '\t'

    agp_dataset = []
    csv_list_name = []
    for single_dic_param in dic_params:
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, single_dic_param)
        agp_dat, agp_df, graph_param = gen_agp_data(
            graph_param,
            single_dic_param,
            None,
            max_graph_config[MaxGraphNumber.AGP_MAX_GRAPH.name],
        )
        end_proc_id = int(agp_dat[ARRAY_FORMVAL][0][END_PROC])
        proc_name = graph_param.dic_proc_cfgs[end_proc_id].shown_name
        csv_list_name.append('{}.{}'.format(proc_name, export_type))

        client_timezone = agp_dat[COMMON].get(CLIENT_TIMEZONE)
        client_timezone = pytz.timezone(client_timezone) if client_timezone else tz.tzlocal()
        csv_df = to_csv(agp_df, graph_param, client_timezone=client_timezone, delimiter=delimiter)
        agp_dataset.append(csv_df)

    response = zip_file_to_response(agp_dataset, csv_list_name, export_type)
    return response
