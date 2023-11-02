import timeit
from copy import deepcopy

from flask import Blueprint, request

from ap.api.common.services.services import get_filter_on_demand_data
from ap.api.ridgeline_plot.services import (
    customize_dict_param,
    gen_emd_df,
    gen_rlp_data_by_term,
    gen_trace_data_by_categorical_var,
    gen_trace_data_by_cyclic,
    save_input_data_to_file,
)
from ap.api.trace_data.services.csv_export import make_graph_param, to_csv
from ap.common.logger import log_execution_time
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import (
    get_end_procs_param,
    parse_multi_filter_into_one,
    parse_request_params,
    update_data_from_multiple_dic_params,
    update_rlp_data_from_multiple_dic_params,
)
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    get_dic_form_from_debug_info,
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import EventType, save_draw_graph_trace, trace_log_params
from ap.common.yaml_utils import *

api_ridgeline_plot_blueprint = Blueprint('api_ridgeline_plot', __name__, url_prefix='/ap/api/rlp')

RLP_MAX_GRAPH = 20


@api_ridgeline_plot_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    save_input_data_to_file(dic_form, EventType.RLP)
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    compare_type = dic_param.get(COMMON).get(COMPARE_TYPE)

    org_dicparam = deepcopy(dic_param)
    dic_params = get_end_procs_param(dic_param)

    for single_dic_param in dic_params:
        if compare_type == RL_CATEGORY:
            rlp_dat, _ = gen_trace_data_by_categorical_var(single_dic_param, RLP_MAX_GRAPH)
        if compare_type == RL_CYCLIC_TERM:
            rlp_dat, _ = gen_trace_data_by_cyclic(single_dic_param, RLP_MAX_GRAPH)
        elif compare_type == RL_DIRECT_TERM:
            rlp_dat, _ = gen_rlp_data_by_term(single_dic_param, RLP_MAX_GRAPH)
        org_dicparam = update_data_from_multiple_dic_params(org_dicparam, rlp_dat)
        org_dicparam = update_rlp_data_from_multiple_dic_params(org_dicparam, rlp_dat)

    stop = timeit.default_timer()
    org_dicparam['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(org_dicparam)

    # remove raw data
    for plot in org_dicparam[ARRAY_PLOTDATA]:
        del plot[RL_DATA]

    org_dicparam['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.RLP))

    org_dicparam = get_filter_on_demand_data(org_dicparam)

    out_dict = orjson_dumps(org_dicparam)
    return out_dict, 200


@api_ridgeline_plot_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)

    return export_file(dic_form, export_type=export_type)


@log_execution_time()
def export_file(dic_form, export_type='csv'):
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    compare_type = dic_param.get(COMMON).get(COMPARE_TYPE)

    dic_params = get_end_procs_param(dic_param)

    export_from = dic_param[COMMON].get(EXPORT_FROM, None) or dic_form.get(EXPORT_FROM, None)

    delimiter = ',' if export_type == 'csv' else '\t'

    csv_data = []
    csv_list_name = []
    for single_dic_param in dic_params:
        graph_param, dic_proc_cfgs, client_timezone = make_graph_param(single_dic_param)
        if compare_type == RL_CATEGORY:
            rlp_dat, csv_df = gen_trace_data_by_categorical_var(single_dic_param, RLP_MAX_GRAPH)
        if compare_type == RL_CYCLIC_TERM:
            rlp_dat, csv_df = gen_trace_data_by_cyclic(single_dic_param, RLP_MAX_GRAPH)
        elif compare_type == RL_DIRECT_TERM:
            rlp_dat, csv_df = gen_rlp_data_by_term(single_dic_param, RLP_MAX_GRAPH)

        end_proc_id = int(rlp_dat[ARRAY_FORMVAL][0][END_PROC])
        proc_name = dic_proc_cfgs[end_proc_id].name
        csv_list_name.append('{}.{}'.format(proc_name, export_type))

        if export_from == 'plot':
            # find DIV, as string
            has_facet = graph_param.common.cat_exp and len(graph_param.common.cat_exp) > 0
            div_id = dic_param[COMMON][DIV_BY_CAT] if DIV_BY_CAT in dic_param[COMMON] else None
            div_name = None
            if div_id and len(rlp_dat[CAT_EXP_BOX]):
                div_var = [var for var in rlp_dat[CAT_EXP_BOX] if str(var[COL_ID]) == div_id]
                div_var = div_var[0] if div_var else None
                if div_var:
                    div_name = '{}|{}'.format(div_var[PROC_MASTER_NAME], div_var[COL_MASTER_NAME])

            term_sep = False
            if not div_name and dic_param[COMMON][COMPARE_TYPE] != RL_CATEGORY:
                term_sep = True

            client_tz = dic_param[COMMON][CLIENT_TIMEZONE]
            csv_dfs, csv_file_name = gen_emd_df(
                rlp_dat, div_name, term_sep, client_tz, has_facet, export_type
            )
            emd_type = single_dic_param[COMMON][EMD_TYPE]
            for csv_df in csv_dfs:
                csv_df = to_csv(
                    csv_df,
                    dic_proc_cfgs,
                    graph_param,
                    emd_type=emd_type,
                    div_col=div_name,
                    client_timezone=client_timezone,
                    delimiter=delimiter,
                )
                csv_data.append(csv_df)
            if len(csv_file_name) > 0:
                csv_list_name = csv_file_name
        else:
            csv_df = to_csv(
                csv_df,
                dic_proc_cfgs,
                graph_param,
                client_timezone=client_timezone,
                delimiter=delimiter,
            )
            csv_data.append(csv_df)

    response = zip_file_to_response(csv_data, csv_list_name, export_type)
    return response
