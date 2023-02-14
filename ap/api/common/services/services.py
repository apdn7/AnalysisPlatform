from ap.setting_module.models import DataTraceLog, make_session, insert_or_update_config
from ap.common.trace_data_log import EventAction


def update_draw_data_trace_log(dataset_id, exe_time):
    trace_logs = DataTraceLog.get_dataset_id(dataset_id, EventAction.DRAW.value)
    for trace_log in trace_logs:
        if trace_log.exe_time == 0:
            trace_log.exe_time = exe_time
    with make_session() as meta_session:
        insert_or_update_config(meta_session, trace_log)
        meta_session.commit()

    return True

