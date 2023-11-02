import json
import timeit

from flask import Blueprint, jsonify, request

from ap.api.trace_data.services.data_count import get_data_count_by_time_range
from ap.api.trace_data.services.time_series_chart import gen_graph_fpp, save_proc_sensor_order_to_db
from ap.common.constants import DataCountType
from ap.common.logger import log_execution_time
from ap.common.services.form_env import parse_multi_filter_into_one, parse_request_params
from ap.common.services.http_content import json_dumps, orjson_dumps
from ap.common.services.import_export_config_n_data import (
    export_debug_info,
    get_dic_form_from_debug_info,
    get_zip_full_path,
    import_config_db,
    import_user_setting_db,
    set_export_dataset_id_to_dic_param,
)
from ap.common.services.request_time_out_handler import request_timeout_handling
from ap.common.timezone_utils import get_date_from_type
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
    save_input_data_to_file,
    trace_log_params,
)

api_trace_data_blueprint = Blueprint('api_trace_data', __name__, url_prefix='/ap/api/fpp')

FPP_MAX_GRAPH = 20


@request_timeout_handling()
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

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.FPP))

    # trace_data.htmlをもとにHTML生成
    try:
        out_dict = orjson_dumps(dic_param)
        return out_dict, 200
    except Exception as e:
        print(e)


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


@api_trace_data_blueprint.route('/save_order', methods=['POST'])
def save_proc_sensor_order():
    """
    Save order of processes and sensors from GUI drag & drop
    :return:
    """
    request_data = json.loads(request.data)
    orders = request_data.get('orders') or {}
    save_proc_sensor_order_to_db(orders)

    return jsonify({}), 200


@api_trace_data_blueprint.route('/data_count', methods=['POST'])
@log_execution_time()
def get_data_count():
    """
    Get data count from datetime range
    :param process_id
    :param from
    :param to
    :param type
    :return: object
    """
    request_data = json.loads(request.data)
    process_id = request_data.get('process_id') or None
    query_type = request_data.get('type') or DataCountType.MONTH.value
    from_date = request_data.get('from') or None
    to_date = request_data.get('to') or None
    local_tz = request_data.get('timezone') or None
    data_count = {}
    min_val = 0
    max_val = 0
    if process_id:
        if from_date and to_date:
            start_date = get_date_from_type(from_date, query_type, local_tz)
            end_date = get_date_from_type(to_date, query_type, local_tz, True)
        data_count, min_val, max_val = get_data_count_by_time_range(
            process_id, start_date, end_date, query_type, local_tz
        )
    out_dict = {
        'from': from_date,
        'to': to_date,
        'type': query_type,
        'data': data_count,
        'min_val': min_val,
        'max_val': max_val,
    }
    out_dict = json_dumps(out_dict)
    return out_dict, 200
