import json
from typing import TYPE_CHECKING, Any

from ap.api.common.services.utils import TraceGraph
from ap.common.constants import (
    ID,
    CacheType,
    CfgConstantType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.setting_module.models import CfgConstant, CfgProcess, CfgProcessColumn, CfgTrace
from ap.setting_module.schemas import ContextSchemaDict, ShowGraphSchema, TraceSchema

if TYPE_CHECKING:
    from ap.trace_data.schemas import DicParam


@log_execution_time()
@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_cached_traces_config_data() -> list[dict[str, Any]]:
    trace_schema = TraceSchema()
    cfg_traces = CfgTrace.get_all()
    return trace_schema.dump(cfg_traces, many=True)


@log_execution_time()
def get_traces_graph_config_data() -> TraceGraph:
    traces = get_cached_traces_config_data()
    traces = TraceSchema().load(traces, many=True)
    return TraceGraph(traces)


@log_execution_time()
@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_cached_processes_config_data() -> list[dict[str, Any]]:
    # TODO: because we use this function for show graph function, so many processes between start and end will be used.
    # TODO: so currently , get all processes may better and easy , but there is an issue of caching and performance.
    # TODO: remove below code if we found better solution
    show_graph_schema = ShowGraphSchema(context=ContextSchemaDict(show_graph=True))
    cfg_processes = CfgProcess.get_all()
    return show_graph_schema.dump(cfg_processes, many=True)


@log_execution_time()
@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_processes_config_data() -> list[CfgProcess]:
    processes = get_cached_processes_config_data()
    return ShowGraphSchema().load(processes, many=True)


@log_execution_time()
@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
def get_dic_card_orders() -> dict[int, str]:
    processes = get_cached_processes_config_data()
    proc_ids = [p[ID] for p in processes]
    dic_card_orders = {}
    for cfg_const in CfgConstant.get_value_by_type_names(const_type=CfgConstantType.TS_CARD_ORDER.name, names=proc_ids):
        dic_card_orders[int(cfg_const.name)] = json.loads(cfg_const.value)
    return dic_card_orders


@log_execution_time()
def get_config_data() -> tuple[dict[int, CfgProcess], TraceGraph, dict[int, str]]:
    processes = get_processes_config_data()
    dic_procs: dict[int, CfgProcess] = {}
    for proc in processes:
        dic_procs[proc.id] = proc

    trace_graph = get_traces_graph_config_data()
    dic_card_orders = get_dic_card_orders()

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
