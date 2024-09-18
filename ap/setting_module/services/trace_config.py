from typing import List

from ap.common.logger import log_execution_time
from ap.setting_module.models import CfgProcess, CfgTrace, CfgTraceKey, make_session
from ap.setting_module.schemas import ProcessSchema


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
    self_sub_strs = trace.get('self_substr')
    target_sub_strs = trace.get('target_substr')
    delta_times = trace.get('delta_time')
    cut_offs = trace.get('cut_off')
    trace_keys = []
    for idx, self_col_id in enumerate(self_col_ids):
        target_col_id = target_col_ids[idx]
        delta_time = delta_times[idx] if delta_times else None
        cut_off = cut_offs[idx] if cut_offs else None
        self_sub_from, self_sub_to = (None, None)
        target_sub_from, target_sub_to = (None, None)
        if self_sub_strs:
            self_sub_from, self_sub_to = self_sub_strs[idx] or (None, None)
        if target_sub_strs:
            target_sub_from, target_sub_to = target_sub_strs[idx] or (None, None)
        trace_key = CfgTraceKey(
            self_column_id=int(self_col_id),
            self_column_substr_from=int(self_sub_from) if self_sub_from else 0,
            self_column_substr_to=int(self_sub_to) if self_sub_to else 0,
            target_column_id=int(target_col_id),
            target_column_substr_from=int(target_sub_from) if target_sub_from else 0,
            target_column_substr_to=int(target_sub_to) if target_sub_to else 0,
            delta_time=float(delta_time) if delta_time else None,
            cut_off=float(cut_off) if cut_off else None,
        )
        trace_keys.append(trace_key)
    self_process_id = trace.get('from')
    target_process_id = trace.get('to')
    cfg_trace = CfgTrace(self_process_id=self_process_id, target_process_id=target_process_id, trace_keys=trace_keys)

    return cfg_trace


def trace_config_crud(traces):
    changed_traces = []
    deleted_traces = []
    excludes = ['id', 'created_at', 'updated_at']
    columns = None
    valid_exist_ids = []

    with make_session() as session:
        dic_exist_traces = {
            (_cfg.self_process_id, _cfg.target_process_id): _cfg for _cfg in session.query(CfgTrace).all()
        }
        cfg_traces = [gen_cfg_trace(trace) for trace in traces]
        for cfg_trace in cfg_traces:
            if not columns:
                columns = [col for col in cfg_trace.__table__.columns.keys() if col not in excludes]

            matched_trace = dic_exist_traces.get((cfg_trace.self_process_id, cfg_trace.target_process_id))
            if matched_trace is None:
                # add new
                session.add(cfg_trace)
                changed_traces.append(cfg_trace)
                continue

            valid_exist_ids.append(matched_trace.id)
            # changed
            if is_trace_detail_changed(cfg_trace, matched_trace.trace_keys):
                session.delete(matched_trace)
                deleted_traces.append(
                    (
                        matched_trace.id,
                        matched_trace.self_process_id,
                        matched_trace.target_process_id,
                    ),
                )

                session.add(cfg_trace)
                changed_traces.append(cfg_trace)
                continue

            for col in columns:
                old_val = getattr(matched_trace, col)
                old_val = None if old_val is False else old_val
                new_val = getattr(cfg_trace, col)
                new_val = None if new_val is False else new_val
                if old_val != new_val:
                    session.delete(matched_trace)
                    deleted_traces.append(
                        (
                            matched_trace.id,
                            matched_trace.self_process_id,
                            matched_trace.target_process_id,
                        ),
                    )

                    session.add(cfg_trace)
                    changed_traces.append(cfg_trace)
                    break

        for _cfg in dic_exist_traces.values():
            if _cfg.id not in valid_exist_ids:
                _cfg = session.merge(_cfg)
                session.delete(_cfg)
                session.commit()
                deleted_traces.append((_cfg.id, _cfg.self_process_id, _cfg.target_process_id))
        # delete_ids = [_cfg.id for _cfg in exist_cfg_traces if _cfg.id not in valid_ids]
        # CfgTrace.delete_by_ids(delete_ids, session)

    return [(_cfg.id, _cfg.self_process_id, _cfg.target_process_id) for _cfg in changed_traces], deleted_traces


def is_trace_detail_changed(cfg_trace: CfgTrace, exist_cfg_keys: List[CfgTraceKey]):
    """
    check if trace detail changed
    :param cfg_trace:
    :param exist_cfg_keys:
    :return:
    """

    if len(cfg_trace.trace_keys) != len(exist_cfg_keys):
        return True

    trace_keys = sorted(cfg_trace.trace_keys, key=lambda x: x.self_column_id)
    columns = None
    excludes = ['id', 'trace_id', 'created_at', 'updated_at']
    for detail, exist_cfg_key in zip(trace_keys, exist_cfg_keys):
        if not columns:
            columns = [col for col in detail.__table__.columns.keys() if col not in excludes]

        for col in columns:
            if getattr(detail, col) != getattr(exist_cfg_key, col):
                return True

    return False
