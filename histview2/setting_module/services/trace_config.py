from histview2 import Session
from histview2.common.logger import log_execution_time
from histview2.setting_module.models import CfgProcess, CfgTrace, CfgTraceKey, make_session
from histview2.setting_module.schemas import ProcessSchema


@log_execution_time()
def get_all_processes_traces_info():
    procs = CfgProcess.get_all() or []
    return dump_json(procs)


@log_execution_time()
def dump_json(procs):
    proc_schema = ProcessSchema(many=True)
    proc_jsons = proc_schema.dump(procs, many=True) or {}
    return proc_jsons


def save_trace_config_to_db(traces):
    # sch = TraceConfigSchema(many=True)
    # sch.loads(params) # TODO load to schema
    with make_session() as meta_session:
        # delete all old edges
        meta_session.query(CfgTrace).delete()
        meta_session.query(CfgTraceKey).delete()  # TODO check cascade

        for trace in traces:
            cfg_trace = gen_cfg_trace(trace)
            meta_session.add(cfg_trace)


def gen_cfg_trace(trace):
    self_col_ids = trace.get('self_col')
    target_col_ids = trace.get('target_col')
    self_substrs = trace.get('self_substr')
    target_substrs = trace.get('target_substr')
    trace_keys = []
    for idx, self_col_id in enumerate(self_col_ids):
        target_col_id = target_col_ids[idx]
        self_sub_from, self_sub_to = self_substrs[idx] or (None, None)
        target_sub_from, target_sub_to = target_substrs[idx] or (None, None)
        trace_key = CfgTraceKey(self_column_id=self_col_id,
                                self_column_substr_from=self_sub_from,
                                self_column_substr_to=self_sub_to,
                                target_column_id=target_col_id,
                                target_column_substr_from=target_sub_from,
                                target_column_substr_to=target_sub_to)
        trace_keys.append(trace_key)
    self_process_id = trace.get('from')
    target_process_id = trace.get('to')
    cfg_trace = CfgTrace(self_process_id=self_process_id, target_process_id=target_process_id,
                         trace_keys=trace_keys)

    return cfg_trace
