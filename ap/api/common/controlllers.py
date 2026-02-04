import json
from typing import Union

from flask import Blueprint, render_template, request
from flask_babel import get_locale

from ap import log_execution_time
from ap.api.common.services.plot_view import gen_graph_plot_view
from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_services import update_draw_data_trace_log
from ap.api.trace_data.services.csv_export import gen_csv_data
from ap.api.trace_data.services.data_count import (
    get_data_count_by_time_range,
    get_process_data_count_by_timerange,
    get_process_full_data_range,
)
from ap.common.constants import (
    ALL_TILES,
    RCMDS,
    TILE_JUMP_CFG,
    TILE_MASTER,
    TILES,
    UN_AVAILABLE,
    CSVExtTypes,
    DataCountType,
)
from ap.common.jobs.utils import get_update_transaction_table_job
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import (
    bind_dic_param_to_class,
    parse_multi_filter_into_one,
    parse_request_params,
)
from ap.common.services.http_content import json_dumps, orjson_dumps
from ap.common.services.request_time_out_handler import api_request_threads
from ap.common.timezone_utils import get_date_from_type
from ap.common.yaml_utils import TileInterfaceYaml
from ap.tile_interface.services.utils import get_tile_master_with_lang

api_common_blueprint = Blueprint('api_common', __name__, url_prefix='/ap/api/common')


@api_common_blueprint.route('/abort_process', methods=['GET'])
def abort_process():
    """
        Kill process by thread id
    :return: {}
    """
    thread_id = request.args.get('thread_id')
    api_request_threads.append(thread_id)
    return {}, 200


@api_common_blueprint.route('/draw_plot_excuted_time', methods=['GET'])
def save_draw_plot_executed_time():
    """
        Update draw chart exe time
    :return: {}
    """
    dataset_id = request.args.get('dataset_id')
    executed_time = request.args.get('executed_time')
    if not dataset_id:
        return {}, 200

    update_draw_data_trace_log(dataset_id, executed_time)

    return {}, 200


@api_common_blueprint.route('/plot_view')
def plot_view():
    dic_form = parse_request_params(request)

    dic_param = parse_multi_filter_into_one(dic_form)
    cycle_id = int(dic_form.get('cycle_id'))
    point_time = dic_form.get('time')
    target_id = int(dic_form.get('sensor_id'))

    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)
    cfg_col = None
    for proc_id, cfg_proc in dic_proc_cfgs.items():
        cfg_col = cfg_proc.get_col(target_id)
        if cfg_col:
            break

    dic_param, stats_table = gen_graph_plot_view(
        graph_param,
        dic_param,
        dic_form,
        cycle_id,
        point_time,
        proc_id,
        cfg_col.id,
    )

    output_dict = stats_table
    return render_template('plot_view/plot_view.html', **output_dict)


@api_common_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """Csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)
    delimiter = ',' if export_type == CSVExtTypes.CSV.value else '\t'
    csv_str = gen_csv_data(graph_param, dic_param, delimiter=delimiter)

    response = zip_file_to_response([csv_str], None, export_type=export_type)
    return response


@api_common_blueprint.route('/jump_cfg/<source_page>', methods=['GET'])
def get_jump_cfg(source_page):
    current_lang = get_locale()
    if not current_lang:
        return False
    tile_jump_cfg = TileInterfaceYaml(TILE_JUMP_CFG).dic_config
    tile_master = TileInterfaceYaml(TILE_MASTER).dic_config
    jump_cfg = tile_jump_cfg.get(TILES).get(source_page) or None
    recommended, unavailable, all = [], [], []

    if jump_cfg:
        recommended = jump_cfg[RCMDS] or []
        unavailable = jump_cfg[UN_AVAILABLE] or []
        all = tile_jump_cfg.get(ALL_TILES) or []

    master_info = get_tile_master_with_lang(tile_master, current_lang)
    out_dict = orjson_dumps({'all': all, 'recommended': recommended, 'unavailable': unavailable, 'master': master_info})
    return out_dict, 200


@api_common_blueprint.route('/is_show_warning_message_update_main_serial/<process_id>', methods=['GET'])
def is_show_warning_message_update_main_serial(process_id: Union[int, str]):
    """
    Check UPDATE_TRANSACTION_TABLE job of process_id is executed completely or not

    :param process_id:
    :return: True: need to show a warning message, otherwise no need
    """
    job = get_update_transaction_table_job(process_id)
    is_show_warning_message = False if job is None else job.kwargs.get('is_show_warning_message')

    return orjson_dumps(is_show_warning_message), 200


@api_common_blueprint.route('/data_count', methods=['POST'])
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
    count_in_file = request_data.get('count_in_file', False)

    data_count = {}
    min_val = 0
    max_val = 0
    if process_id:
        start_date, end_date = None, None

        if from_date and to_date:
            start_date = get_date_from_type(from_date, query_type, local_tz)
            end_date = get_date_from_type(to_date, query_type, local_tz, True)

        data_count, min_val, max_val = get_data_count_by_time_range(
            process_id,
            start_date,
            end_date,
            query_type,
            local_tz,
            count_in_file=count_in_file,
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


@api_common_blueprint.route('/full_data_range/<int:process_id>', methods=['GET'])
def full_data_range(process_id):
    """
    Get time range of process (full data) by process id
    Args:
        process_id: int, process id

    Returns: object
        {
            min_date_time: datetime,
            max_date_time: datetime
        }
    """
    min_date_time, max_date_time = get_process_full_data_range(process_id)
    return orjson_dumps({'min_date_time': min_date_time, 'max_date_time': max_date_time}), 200


@api_common_blueprint.route('/data_count_in_range', methods=['POST'])
def data_count_in_range():
    """
    Get data count from datetime range by process id
    Args:
        process_id: int, process id
        from: datetime
        to: datetime

    Returns:
        count: int, data count
    """
    request_data = json.loads(request.data)
    process_id = request_data.get('process_id') or None
    start_date = request_data.get('from') or None
    end_date = request_data.get('to') or None
    data_count = get_process_data_count_by_timerange(
        process_id,
        start_date,
        end_date,
    )
    return orjson_dumps(data_count), 200
