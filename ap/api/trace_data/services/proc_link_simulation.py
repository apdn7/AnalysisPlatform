from collections import defaultdict
from typing import List

from ap.api.trace_data.services.proc_link import gen_proc_link_of_edge
from ap.common.logger import log_execution_time
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.setting_module.models import CfgProcess, CfgTrace, ProcLinkCount
from ap.trace_data.transaction_model import TransactionData

PREDICT_SAMPLE = 10_000


@log_execution_time('[SIMULATE GLOBAL ID]')
def sim_gen_global_id(edges: List[CfgTrace]):
    """
    generate global id for universal db (root function)
    """
    traces = CfgTrace.get_all()
    dic_proc_data_count = {}
    trans = [TransactionData(proc.id) for proc in CfgProcess.get_all_ids()]
    for i, tran_data in enumerate(trans):
        with DbProxy(gen_data_source_of_universal_db(tran_data.process_id), True) as db_instance:
            if tran_data.is_table_exist(db_instance):
                data_count = tran_data.count_data(db_instance)
                dic_proc_data_count[tran_data.process_id] = data_count

    # dic_proc_data_count = {data.process_id: data.count for data in ProcDataCount.get_procs_count()}
    dic_proc_link_count = {
        (data.process_id, data.target_process_id): data.matched_count for data in ProcLinkCount.calc_proc_link()
    }

    # matched count on edge
    dic_edge_cnt = defaultdict(list)

    # proc : rows in database
    dic_proc_cnt = defaultdict(list)

    # existing tracing config
    existing_trace = {(trace.self_process_id, trace.target_process_id): trace for trace in traces}

    for requested_trace in edges:
        start_proc_id = requested_trace.self_process_id
        end_proc_id = requested_trace.target_process_id
        edge_id = f'{start_proc_id}-{end_proc_id}'
        edge_cnt = 0

        # if exactly same tracing => get from t_proc_link_count
        # otherwise => do full flow get t_proc_link to count joined cycle_id, without insert to t_proc_link
        if (start_proc_id, end_proc_id) in existing_trace:
            already_save_trace = existing_trace[(start_proc_id, end_proc_id)]
            if already_save_trace.is_same_tracing(requested_trace):
                # only do if requested tracing exactly same with existing tracing config data
                edge_cnt = dic_proc_link_count.get((start_proc_id, end_proc_id), 0)
                dic_edge_cnt[edge_id] = edge_cnt

        if not edge_cnt:
            # TODO: add constants for this limit
            edge_cnt = gen_proc_link_of_edge(requested_trace)

        dic_edge_cnt[edge_id] = edge_cnt

        for proc_id in (start_proc_id, end_proc_id):
            # sum_value = dic_proc_cnt.get(proc_id,  0) + edge_cnt
            cycle_cnt = dic_proc_data_count.get(proc_id, 0)
            # dic_proc_cnt[proc_id] = tuple([sum_value, cycle_cnt])
            dic_proc_cnt[proc_id] = cycle_cnt

    return dic_proc_cnt, dic_edge_cnt
