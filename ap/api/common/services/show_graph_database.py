import json
from typing import TYPE_CHECKING, Any

from ap.common.constants import (
    CacheType,
    CfgConstantType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.services.trace_graph import TraceGraph
from ap.setting_module.models import CfgConstant, CfgProcess, CfgProcessColumn, CfgTrace, make_session
from ap.setting_module.schemas import ContextSchemaDict, ShowGraphSchema, TraceSchema

if TYPE_CHECKING:
    from ap.trace_data.schemas import DicParam


@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_all_process_ids() -> list[int]:
    with make_session() as session:
        rows = CfgProcess.get_all_ids(with_parent=True, session=session)
        return [r.id for r in rows]


@log_execution_time()
@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_config_process_and_card_order_per_process(process_id: int) -> tuple[CfgProcess, dict[Any, Any]]:
    show_graph_schema = ShowGraphSchema(context=ContextSchemaDict(show_graph=True))
    cfg_process = CfgProcess.query.get(process_id)

    # dump process to remove unneeded keys, and detach session
    process = show_graph_schema.dump(cfg_process)

    # load again to have enough keys
    cfg_process = show_graph_schema.load(process)

    card_order = CfgConstant.get_value_by_type_name(
        type=CfgConstantType.TS_CARD_ORDER.name,
        name=process_id,
        parse_val=json.loads,
    )

    return cfg_process, card_order


@log_execution_time()
@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_traces_graph_config_data() -> TraceGraph:
    trace_schema = TraceSchema(many=True)
    cfg_traces = CfgTrace.get_all()

    # dumps to remove unneeded keys, and detach session
    traces = trace_schema.dump(cfg_traces)

    # load again to have enough keys
    traces = trace_schema.load(traces)

    return TraceGraph(traces)


@log_execution_time()
def get_config_data() -> tuple[dict[int, CfgProcess], TraceGraph, dict[int, dict[Any, Any]]]:
    process_ids = get_all_process_ids()

    dic_procs: dict[int, CfgProcess] = {}
    dic_card_orders: dict[int, dict[Any, Any]] = {}
    for process_id in process_ids:
        process, card_order = get_config_process_and_card_order_per_process(process_id)
        dic_procs[process_id] = process
        dic_card_orders[process_id] = card_order

    trace_graph = get_traces_graph_config_data()

    return dic_procs, trace_graph, dic_card_orders


def get_proc_ids_in_graph_param(graph_param: 'DicParam'):
    """
    get process
    :param graph_param:
    :return:
    """
    procs = [graph_param.common.start_proc]
    for proc in graph_param.common.cond_procs:
        procs.append(proc.proc_id)

    for proc in graph_param.common.cate_procs:
        procs.append(proc.proc_id)

    for proc in graph_param.array_formval:
        procs.append(proc.proc_id)

    for proc_id in graph_param.common.serial_processes:
        procs.append(proc_id)

    cols = []
    cols += _get_cols(graph_param.common.cat_exp)
    cols += _get_cols(graph_param.common.color_var)
    cols += _get_cols(graph_param.common.objective_var)
    cols += _get_cols(graph_param.common.div_by_cat)

    if cols:
        cols = list(set(cols))
        _proc_ids = [proc.process_id for proc in CfgProcessColumn.get_by_ids(cols)]
        procs += _proc_ids

    return list(set(procs))


# def get_procs_in_dic_param(graph_param: 'DicParam'):
#     """
#     get process
#     :param graph_param:
#     :return:
#     """
#     # TODO 1
#     proc_ids = get_proc_ids_in_graph_param(graph_param)
#     dic_procs = gen_dict_procs(proc_ids)
#     return dic_procs


def _get_cols(cols):
    if not cols:
        return []

    if not isinstance(cols, (tuple, list)):
        cols = [cols]

    return cols


def gen_dict_procs(proc_ids):
    return {proc.id: proc for proc in CfgProcess.get_procs(proc_ids)}
