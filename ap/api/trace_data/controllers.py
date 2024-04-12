import json
import timeit

from flask import Blueprint, jsonify, request

from ap import max_graph_config
from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_jump_function import get_jump_emd_data
from ap.api.trace_data.services.data_count import get_data_count_by_time_range
from ap.api.trace_data.services.time_series_chart import gen_graph_fpp
from ap.common.constants import CfgConstantType, DataCountType, MaxGraphNumber
from ap.common.logger import log_execution_time
from ap.common.services.form_env import (
    bind_dic_param_to_class,
    parse_multi_filter_into_one,
    parse_request_params,
)
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
from ap.setting_module.models import CfgConstant

api_trace_data_blueprint = Blueprint('api_trace_data', __name__, url_prefix='/ap/api/fpp')


@request_timeout_handling()
@api_trace_data_blueprint.route('/index', methods=['POST'])
def trace_data():
    """
    Trace Data API
    return dictionary
    """

    dic_form = request.form.to_dict(flat=False)
    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.FPP)
    dic_param = parse_multi_filter_into_one(dic_form)

    cache_dic_param, graph_param, df = get_jump_emd_data(dic_form)

    out_dict = show_graph_fpp(cache_dic_param or dic_param, graph_param, df)

    return out_dict, 200


def show_graph_fpp(dic_param, orig_graph_param=None, df=None):
    start = timeit.default_timer()
    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)
    if orig_graph_param is None:
        dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
        orig_graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)

    dic_param = gen_graph_fpp(
        orig_graph_param,
        dic_param,
        max_graph_config[MaxGraphNumber.FPP_MAX_GRAPH.name],
        df,
    )
    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)
    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.FPP))
    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start
    # trace_data.htmlをもとにHTML生成
    out_dict = orjson_dumps(dic_param)
    return out_dict


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
    for proc_code, new_orders in orders.items():
        CfgConstant.create_or_merge_by_type(
            const_type=CfgConstantType.TS_CARD_ORDER.name,
            const_name=proc_code,
            const_value=new_orders,
        )

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
            process_id,
            start_date,
            end_date,
            query_type,
            local_tz,
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
