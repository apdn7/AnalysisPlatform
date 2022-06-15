import json
import timeit

import simplejson
from flask import Blueprint, request, jsonify, Response

from histview2.api.trace_data.services.csv_export import gen_csv_data
from histview2.api.trace_data.services.time_series_chart import (update_outlier_flg, save_proc_sensor_order_to_db,
                                                                 gen_graph_fpp)
from histview2.common.services import http_content, csv_content
from histview2.common.services.form_env import parse_request_params, parse_multi_filter_into_one
from histview2.common.services.import_export_config_n_data import export_debug_info, set_export_dataset_id_to_dic_param, \
    get_dic_form_from_debug_info, import_user_setting_db, \
    import_config_db, get_zip_full_path
from histview2.common.trace_data_log import save_input_data_to_file, EventType

api_trace_data_blueprint = Blueprint(
    'api_trace_data',
    __name__,
    url_prefix='/histview2/api/fpp'
)

FPP_MAX_GRAPH = 20


@api_trace_data_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """

    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.FPP)
    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    dic_param = gen_graph_fpp(dic_param, FPP_MAX_GRAPH)
    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    # trace_data.htmlをもとにHTML生成
    out_dict = simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)

    return out_dict, 200


@api_trace_data_blueprint.route('/csv_export', methods=['GET'])
def csv_export():
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    csv_str = gen_csv_data(dic_param)
    csv_filename = csv_content.gen_csv_fname()

    response = Response(csv_str.encode("utf-8-sig"), mimetype="text/csv",
                        headers={
                            "Content-Disposition": "attachment;filename={}".format(csv_filename),
                        })
    response.charset = "utf-8-sig"

    return response


@api_trace_data_blueprint.route('/tsv_export', methods=['GET'])
def tsv_export():
    """tsv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    csv_str = gen_csv_data(dic_param, delimiter='\t')
    csv_filename = csv_content.gen_csv_fname("tsv")

    response = Response(csv_str.encode("utf-8-sig"), mimetype="text/tsv",
                        headers={
                            "Content-Disposition": "attachment;filename={}".format(csv_filename),
                        })
    response.charset = "utf-8-sig"

    return response


@api_trace_data_blueprint.route('/zip_export', methods=['GET'])
def zip_export():
    """zip export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dataset_id = int(dic_form['dataset_id'])
    user_setting_id = int(dic_form['user_setting_id'])
    response = export_debug_info(dataset_id, user_setting_id)

    return response


@api_trace_data_blueprint.route('/zip_import', methods=['GET'])
def zip_import():
    """zip import

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    filename = dic_form['filename']
    zip_file = get_zip_full_path(filename)
    import_config_db(zip_file)
    user_setting = import_user_setting_db(zip_file)
    dic_user_setting = {'id': user_setting['id'], 'page': user_setting['page']}

    return jsonify(dic_user_setting), 200


@api_trace_data_blueprint.route('/update_outlier', methods=['POST'])
def update_outlier():
    """
    Update outlier flags to DB.
    :return:
    """
    request_data = json.loads(request.data)
    proc_id = request_data.get("process_id")
    cycle_ids = request_data.get("cycle_ids")
    is_outlier = request_data.get("is_outlier")
    update_outlier_flg(proc_id, cycle_ids, is_outlier)
    return jsonify({}), 200


@api_trace_data_blueprint.route('/save_order', methods=['POST'])
def save_proc_sensor_order():
    """
    Save order of processes and sensors from GUI drag & drop
    :return:
    """
    request_data = json.loads(request.data)
    orders = request_data.get("orders") or {}
    save_proc_sensor_order_to_db(orders)

    return jsonify({}), 200
