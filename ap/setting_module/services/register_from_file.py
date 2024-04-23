# import tkinter as tk
# from tkinter import filedialog

from ap.common.common_utils import API_DATETIME_FORMAT, convert_time
from ap.common.constants import PagePath
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.setting_module.models import CfgProcess
from ap.trace_data.transaction_model import TransactionData

# def browse(resource_type):
#     window = tk.Tk()
#     window.wm_attributes('-topmost', 1)
#     window.withdraw()  # this supress the tk window
#
#     dialog = filedialog.askdirectory
#     if resource_type != RegisterDatasourceType.DIRECTORY.value:
#         dialog = filedialog.askopenfilename
#     f_path = dialog(parent=window)
#     return f_path, resource_type


def get_chm_url_to_redirect(request, proc_id):
    proc_cfg = CfgProcess.get_proc_by_id(proc_id)

    target_col_ids = [str(col.id) for col in proc_cfg.columns if col.is_serial_no or col.is_get_date]
    target_col_ids = ','.join(target_col_ids)

    # get start_datetime and end_datetime
    trans_data = TransactionData(proc_cfg.id)
    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        max_datetime = trans_data.get_max_date_time_by_process_id(db_instance)
        min_datetime = trans_data.get_min_date_time_by_process_id(db_instance)

    host_url = request.host_url
    page = PagePath.CHM.value
    min_datetime = convert_time(min_datetime, format_str=API_DATETIME_FORMAT)
    max_datetime = convert_time(max_datetime, format_str=API_DATETIME_FORMAT)

    # get target page from bookmark
    target_url = f'{host_url}{page}?columns={target_col_ids}&start_datetime={min_datetime}&end_datetime={max_datetime}&end_procs=[{proc_id}]&load_gui_from_url=1&page=chm'  # noqa
    return target_url
