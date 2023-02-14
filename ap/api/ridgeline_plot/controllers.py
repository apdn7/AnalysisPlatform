import io
import simplejson
import timeit
from copy import deepcopy
from zipfile import ZipFile

import pandas as pd

from flask import Blueprint, request, Response

from ap.api.ridgeline_plot.services import (gen_trace_data_by_categorical_var,
                                            customize_dict_param, gen_rlp_data_by_term, gen_csv_data,
                                            csv_export_dispatch, save_input_data_to_file,
                                            merge_multiple_dic_params, convert_list_to_dict_multiple_data_proc,
                                            gen_trace_data_by_cyclic, gen_emd_df)
from ap.common.common_utils import gen_sql_label
from ap.common.services import http_content, csv_content
from ap.common.services.form_env import (parse_multi_filter_into_one,
                                         parse_request_params,
                                         bind_multiple_end_proc_rlp,
                                         get_end_procs_param,
                                         update_data_from_multiple_dic_params,
                                         update_rlp_data_from_multiple_dic_params)
from ap.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from ap.common.trace_data_log import EventType, save_draw_graph_trace, trace_log_params
from ap.common.yaml_utils import *
from ap.api.categorical_plot.services import gen_graph_param
from ap.api.trace_data.services.csv_export import to_csv


api_ridgeline_plot_blueprint = Blueprint(
    'api_ridgeline_plot',
    __name__,
    url_prefix='/ap/api/rlp'
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

    org_dicparam = deepcopy(dic_param)
    dic_params = get_end_procs_param(dic_param)

    for single_dic_param in dic_params:
        if compare_type == RL_CATEGORY:
            rlp_dat, _ = gen_trace_data_by_categorical_var(single_dic_param)
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

    out_dict = simplejson.dumps(org_dicparam, ensure_ascii=False, default=http_content.json_serial)
    return out_dict, 200


@api_ridgeline_plot_blueprint.route('/csv_export', methods=['GET'])
def csv_export():
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    compare_type = dic_param.get(COMMON).get(COMPARE_TYPE)

    dic_params = get_end_procs_param(dic_param)

    csv_data = []
    csv_list_name = []
    for single_dic_param in dic_params:
        emd_data = None
        graph_param, dic_proc_cfgs = gen_graph_param(dic_param, with_ct_col=True)
        if compare_type == RL_CATEGORY:
            rlp_dat, csv_df = gen_trace_data_by_categorical_var(single_dic_param)
        if compare_type == RL_CYCLIC_TERM:
            rlp_dat, csv_df = gen_trace_data_by_cyclic(single_dic_param, RLP_MAX_GRAPH)
        elif compare_type == RL_DIRECT_TERM:
            rlp_dat, csv_df = gen_rlp_data_by_term(single_dic_param, RLP_MAX_GRAPH)

        end_proc_id = int(rlp_dat[ARRAY_FORMVAL][0][END_PROC])
        proc_name = dic_proc_cfgs[end_proc_id].name
        csv_list_name.append('{}.{}'.format(proc_name, 'csv'))

        if dic_param[COMMON]['export_from'] == 'plot':
            # find DIV, as string
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
            csv_df = gen_emd_df(rlp_dat, div_name, term_sep, client_tz)
            emd_type = single_dic_param[COMMON][EMD_TYPE]
            csv_df = to_csv(csv_df, dic_proc_cfgs, graph_param, emd_type=emd_type, div_col=div_name)
        else:
            csv_df = to_csv(csv_df, dic_proc_cfgs, graph_param)
        csv_data.append(csv_df)

    if len(csv_data) == 1:
        csv_data = csv_data[0]
        csv_filename = csv_content.gen_csv_fname()
        response = Response(csv_data.encode("utf-8-sig"), mimetype="text/csv",
                            headers={
                                "Content-Disposition": "attachment;filename={}".format(csv_filename),
                            })
    else:
        csv_filename = csv_content.gen_csv_fname('zip')
        outfile = io.BytesIO()
        with ZipFile(outfile, 'w') as zf:
            for name, data in zip(csv_list_name, csv_data):
                zf.writestr(name, data)

        zip_dat = outfile.getvalue()
        response = Response(zip_dat, mimetype="application/octet-stream",
                            headers={
                                "Content-Type": "application/octet-stream",
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
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    customize_dict_param(dic_param)

    compare_type = dic_param.get(COMMON).get(COMPARE_TYPE)

    dic_params = get_end_procs_param(dic_param)

    csv_data = []
    csv_list_name = []
    for single_dic_param in dic_params:
        graph_param, dic_proc_cfgs = gen_graph_param(dic_param, with_ct_col=True)
        if compare_type == RL_CATEGORY:
            rlp_dat, csv_df = gen_trace_data_by_categorical_var(single_dic_param)
        if compare_type == RL_CYCLIC_TERM:
            rlp_dat, csv_df = gen_trace_data_by_cyclic(single_dic_param, RLP_MAX_GRAPH)
        elif compare_type == RL_DIRECT_TERM:
            rlp_dat, csv_df = gen_rlp_data_by_term(single_dic_param, RLP_MAX_GRAPH)

        end_proc_id = int(rlp_dat[ARRAY_FORMVAL][0][END_PROC])
        proc_name = dic_proc_cfgs[end_proc_id].name
        csv_list_name.append('{}.{}'.format(proc_name, 'tsv'))

        if dic_param[COMMON]['export_from'] == 'plot':
            # find DIV, as string
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
            csv_df = gen_emd_df(rlp_dat, div_name, term_sep, client_tz)
            emd_type = single_dic_param[COMMON][EMD_TYPE]
            csv_df = to_csv(csv_df, dic_proc_cfgs, graph_param, emd_type=emd_type, div_col=div_name)
        else:
            csv_df = to_csv(csv_df, dic_proc_cfgs, graph_param, delimiter='\t')
        csv_data.append(csv_df)

    if len(csv_data) == 1:
        csv_data = csv_data[0]
        csv_filename = csv_content.gen_csv_fname()
        response = Response(csv_data.encode("utf-8-sig"), mimetype="text/tsv",
                            headers={
                                "Content-Disposition": "attachment;filename={}".format(csv_filename),
                            })
    else:
        csv_filename = csv_content.gen_csv_fname('zip')
        outfile = io.BytesIO()
        with ZipFile(outfile, 'w') as zf:
            for name, data in zip(csv_list_name, csv_data):
                zf.writestr(name, data)

        zip_dat = outfile.getvalue()
        response = Response(zip_dat, mimetype="application/octet-stream",
                            headers={
                                "Content-Type": "application/octet-stream",
                                "Content-Disposition": "attachment;filename={}".format(csv_filename),
                            })
    response.charset = "utf-8-sig"
    return response
