import io
import timeit
from copy import deepcopy
from zipfile import ZipFile

import simplejson
from flask import Blueprint, request, Response, send_file

from ap.api.categorical_plot.services import customize_dict_param
from ap.api.heatmap.services import gen_heatmap_data
from ap.api.trace_data.services.csv_export import gen_csv_data
from ap.common.constants import COMMON, START_PROC, ARRAY_FORMVAL, END_PROC
from ap.common.services import http_content, csv_content
from ap.common.services.form_env import parse_multi_filter_into_one, get_end_procs_param, \
    update_data_from_multiple_dic_params, parse_request_params
from ap.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from ap.common.trace_data_log import save_input_data_to_file, EventType, save_draw_graph_trace, trace_log_params

api_heatmap_blueprint = Blueprint(
    'api_heatmap',
    __name__,
    url_prefix='/ap/api/chm'
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
    org_dic_param = deepcopy(dic_param)
    dic_params = get_end_procs_param(dic_param)

    for single_dic_param in dic_params:
        heatmap_dat = gen_heatmap_data(single_dic_param)
        org_dic_param = update_data_from_multiple_dic_params(org_dic_param, heatmap_dat)

    stop = timeit.default_timer()
    org_dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(org_dic_param)

    org_dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.CHM))

    return simplejson.dumps(org_dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)


@api_heatmap_blueprint.route('/csv_export', methods=['GET'])
def csv_export():
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
    csv_data, csv_list_name = gen_csv_data(dic_param, by_cells=True)

    if not csv_list_name:
        csv_filename = csv_content.gen_csv_fname()
        response = Response(csv_data.encode("utf-8-sig"), mimetype="text/csv",
                 headers={
                     "Content-Disposition": "attachment;filename={}".format(csv_filename),
                 })
        response.charset = "utf-8-sig"
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


@api_heatmap_blueprint.route('/tsv_export', methods=['GET'])
def tsv_export():
    """tsv export

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
    csv_data, csv_list_name = gen_csv_data(dic_param, delimiter='\t', by_cells=True)

    if not csv_list_name:
        csv_filename = csv_content.gen_csv_fname('tsv')
        response = Response(csv_data.encode("utf-8-sig"), mimetype="text/tsv",
                            headers={
                                "Content-Disposition": "attachment;filename={}".format(csv_filename),
                            })
        response.charset = "utf-8-sig"
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
