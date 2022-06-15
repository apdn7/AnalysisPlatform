import json
import timeit

from flask import Blueprint, request, Response

from histview2.api.ridgeline_plot.services import (gen_trace_data_by_categorical_var,
                                                   customize_dict_param, gen_rlp_data_by_term, gen_csv_data,
                                                   csv_export_dispatch, save_input_data_to_file,
                                                   merge_multiple_dic_params,
                                                   gen_trace_data_by_cyclic)
from histview2.common.services import http_content, csv_content
from histview2.common.services.form_env import (parse_multi_filter_into_one,
                                                parse_request_params,
                                                bind_multiple_end_proc_rlp)
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import EventType
from histview2.common.yaml_utils import *

api_ridgeline_plot_blueprint = Blueprint(
    'api_ridgeline_plot',
    __name__,
    url_prefix='/histview2/api/rlp'
)

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

    if compare_type == RL_CATEGORY:
        dic_param = gen_trace_data_by_categorical_var(dic_param)
    if compare_type == RL_CYCLIC_TERM:
        dic_param = gen_trace_data_by_cyclic(dic_param, RLP_MAX_GRAPH)
    elif compare_type == RL_DIRECT_TERM:
        dic_param = gen_rlp_data_by_term(dic_param, RLP_MAX_GRAPH)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    # remove raw data
    for plot in dic_param[ARRAY_PLOTDATA]:
        del plot[RL_DATA]

    out_dict = json.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial)
    return out_dict, 200


@api_ridgeline_plot_blueprint.route('/csv_export', methods=['GET'])
def csv_export():
    """csv export

    Returns:
        [type] -- [description]
    """

    dic_form = parse_request_params(request)
    multiple_dform = bind_multiple_end_proc_rlp(dic_form)

    dic_datas = []
    dic_params = []
    for dform in multiple_dform:
        dic_param = parse_multi_filter_into_one(dform)
        customize_dict_param(dic_param)

        dic_data = csv_export_dispatch(dic_param)
        dic_datas.append(dic_data)
        dic_params.append(dic_param)
    mdic_data = merge_multiple_dic_params(dic_datas)
    mdic_param = merge_multiple_dic_params(dic_params)
    if not mdic_data:
        return {}, 200

    csv_str = gen_csv_data(mdic_param, mdic_data, mdic_param[COMMON][GET02_VALS_SELECT],
                           mdic_param[COMMON][CLIENT_TIMEZONE])

    csv_filename = csv_content.gen_csv_fname()

    response = Response(csv_str.encode("utf-8-sig"), mimetype="text/csv",
                        headers={
                            "Content-Disposition": "attachment;filename={}".format(csv_filename),
                        })
    response.charset = "utf-8-sig"

    return response


@api_ridgeline_plot_blueprint.route('/tsv_export', methods=['GET'])
def tsv_export():
    """tsv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    multiple_dform = bind_multiple_end_proc_rlp(dic_form)

    dic_datas = []
    dic_params = []
    for dform in multiple_dform:
        dic_param = parse_multi_filter_into_one(dform)
        customize_dict_param(dic_param)
        dic_data = csv_export_dispatch(dic_param)
        dic_datas.append(dic_data)
        dic_params.append(dic_param)

    mdic_data = merge_multiple_dic_params(dic_datas)
    mdic_param = merge_multiple_dic_params(dic_params)
    if not mdic_data:
        return {}, 200

    csv_str = gen_csv_data(mdic_param, mdic_data, mdic_param[COMMON][GET02_VALS_SELECT],
                           mdic_param[COMMON][CLIENT_TIMEZONE], delimiter='\t')

    csv_filename = csv_content.gen_csv_fname("tsv")

    response = Response(csv_str.encode("utf-8-sig"), mimetype="text/tsv",
                        headers={
                            "Content-Disposition": "attachment;filename={}".format(csv_filename),
                        })
    response.charset = "utf-8-sig"

    return response
