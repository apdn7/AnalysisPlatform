from typing import Union

from flask import Blueprint, render_template, request
from flask_babel import get_locale

from ap.api.common.services.plot_view import gen_graph_plot_view
from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_services import update_draw_data_trace_log
from ap.api.trace_data.services.csv_export import gen_csv_data
from ap.common.constants import (
    ALL_TILES,
    RCMDS,
    TILE_JUMP_CFG,
    TILE_MASTER,
    TILES,
    UN_AVAILABLE,
    CSVExtTypes,
)
from ap.common.jobs.utils import is_update_transaction_data_job_completed
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import (
    bind_dic_param_to_class,
    parse_multi_filter_into_one,
    parse_request_params,
)
from ap.common.services.http_content import orjson_dumps
from ap.common.services.request_time_out_handler import api_request_threads
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
        update draw chart exe time
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
    """csv export

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


@api_common_blueprint.route('/is_update_transaction_data_job_completed/<process_id>', methods=['GET'])
def is_update_transaction_data_job_completed_api(process_id: Union[int, str]):
    """
    Check UPDATE_TRANSACTION_DATA job of process_id is executed completely or not
    :param process_id:
    :return: True: the job is executed completely, otherwise False
    """
    is_completed = is_update_transaction_data_job_completed(process_id)
    return orjson_dumps(is_completed), 200
