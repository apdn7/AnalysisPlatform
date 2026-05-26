from collections import defaultdict

from ap.api.trace_data.services.proc_link import gen_proc_link_of_edge
from ap.common.log import log_execution_time
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.setting_module.models import CfgProcess, CfgTrace, ProcLinkCount
from ap.trace_data.transaction_model import TransactionData

PREDICT_SAMPLE = 10_000


@log_execution_time('[SIMULATE GLOBAL ID]')
def sim_gen_global_id(edges: list[CfgTrace]):
    """Generate global id for universal db (root function)"""
    traces = CfgTrace.get_all()
    dic_proc_data_count = {}
    trans = [TransactionData(proc_id) for proc_id in CfgProcess.get_all_ids()]
    for i, tran_data in enumerate(trans):
        with TxnDataConnection(process_id=tran_data.process_id, readonly_transaction=True) as data_con:
            # TODO: no process has been created! This only exists in test?
            # See: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/139
            if data_con is None:
                dic_proc_data_count[tran_data.process_id] = 0

            # has process
            elif tran_data.is_table_exist(data_con=data_con):
                data_count = tran_data.count_data(data_con=data_con)
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
            cycle_cnt = dic_proc_data_count.get(int(proc_id), 0)
            # dic_proc_cnt[proc_id] = tuple([sum_value, cycle_cnt])
            dic_proc_cnt[proc_id] = cycle_cnt

    return dic_proc_cnt, dic_edge_cnt
