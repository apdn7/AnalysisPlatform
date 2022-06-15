from collections import defaultdict
from typing import List, Dict

from loguru import logger

from histview2.common.constants import NO_FILTER, SELECT_ALL
from histview2.setting_module.models import CfgFilterDetail, CfgProcessColumn


class EndProc:
    proc_id: int
    col_ids: List[int]
    col_names: List[str]
    col_show_names: List[str]
    col_sensor_only_ids: List[int]

    def __init__(self, proc_id, cols):
        if proc_id:
            self.proc_id = int(proc_id)
        self.col_ids = []
        self.col_names = []
        self.col_show_names = []
        self.col_sensor_only_ids = []

        if cols:
            self.add_cols(cols)
            self.col_sensor_only_ids = self.col_ids  # TODO refator

    def add_cols(self, col_ids, append_first=False):
        if not isinstance(col_ids, (list, tuple)):
            col_ids = [col_ids]

        ids = [int(col) for col in col_ids]

        for col_id in ids:
            if col_id in self.col_ids:
                idx = self.col_ids.index(col_id)
                id = self.col_ids.pop(idx)
                column_name = self.col_names.pop(idx)
                name = self.col_show_names.pop(idx)
            else:
                column = CfgProcessColumn.query.get(col_id)
                id = column.id
                column_name = column.column_name
                name = column.name
                self.proc_id = column.process_id

            if append_first:
                self.col_ids.insert(0, id)
                self.col_names.insert(0, column_name)
                self.col_show_names.insert(0, name)
            else:
                self.col_ids.append(id)
                self.col_names.append(column_name)
                self.col_show_names.append(name)

    def add_sensor_col_ids(self, col_ids):
        if not isinstance(col_ids, (list, tuple)):
            col_ids = [col_ids]

        ids = [int(col) for col in col_ids]
        self.col_sensor_only_ids = ids

    def get_col_ids(self):
        return self.col_ids

    def get_sensor_col_ids(self):
        return self.col_sensor_only_ids


class CategoryProc:
    proc_id: int
    col_ids: List[int]
    col_names: List[str]
    col_show_names: List[str]

    def __init__(self, proc, cols):
        if proc:
            self.proc_id = int(proc)

        if isinstance(cols, (list, tuple)):
            self.col_ids = [int(col) for col in cols]
        else:
            self.col_ids = [int(cols)]

        self.col_names = []
        self.col_show_names = []
        for id in self.col_ids:
            column = CfgProcessColumn.query.get(id)
            self.col_names.append(column.column_name)
            self.col_show_names.append(column.name)
            self.proc_id = column.process_id


class ConditionProcDetail:
    cfg_filter_details: List[CfgFilterDetail]
    is_no_filter: bool
    is_select_all: bool
    column_id: int
    column_name: str

    def __init__(self, filter_detail_ids):
        self.is_select_all = False
        self.is_no_filter = False
        self.cfg_filter_details = []
        self.column_id = None
        self.column_name = None

        ids = filter_detail_ids
        if not isinstance(filter_detail_ids, (list, tuple)):
            ids = [filter_detail_ids]

        column = None
        for id in ids:
            if str(id).lower() == NO_FILTER.lower():
                self.is_no_filter = True
                continue

            if str(id).lower() == SELECT_ALL.lower():
                self.is_select_all = True
                continue

            filter_detail = CfgFilterDetail.query.get(id)
            self.cfg_filter_details.append(filter_detail)

            # TODO: unsafe: if filter_detail_ids is wrong, filter_detail is None,
            #  and filter_detail.cfg_filter.column occur error
            if column is None:
                column = filter_detail.cfg_filter.column
                if column:
                    self.column_id = column.id
                    self.column_name = column.column_name


class ConditionProc:
    proc_id: int
    dic_col_name_filters: Dict[str, ConditionProcDetail]
    dic_col_id_filters: Dict[int, ConditionProcDetail]

    def __init__(self, proc, condition_details: List[ConditionProcDetail]):
        self.proc_id = int(proc)
        self.dic_col_name_filters = defaultdict(list)
        self.dic_col_id_filters = defaultdict(list)
        for f_detail in condition_details:
            if not f_detail.column_id:
                continue

            self.dic_col_name_filters[f_detail.column_name].append(f_detail)
            self.dic_col_id_filters[f_detail.column_id].append(f_detail)


class CommonParam:
    start_proc: int
    start_date: str
    start_time: str
    end_date: str
    end_time: str
    client_timezone: str

    hm_step: int
    hm_mode: int
    hm_function_real: int
    hm_function_cate: int
    hm_trim: int

    x_option: str
    serial_processes: List[int]
    serial_columns: List[int]
    serial_orders: List[int]

    cond_procs: List[ConditionProc]
    cate_procs: List[CategoryProc]
    threshold_boxes: List[int]
    cat_exp: List[int]
    is_validate_data: bool

    def __init__(self, start_proc=None, start_date=None, start_time=None, end_date=None,
                 end_time=None, cond_procs=None, cate_procs=None,
                 hm_step=None, hm_mode=None,
                 hm_function_real=None, hm_function_cate=None,
                 hm_trim=None, client_timezone=None,
                 x_option=None, serial_processes=(), serial_columns=(), serial_orders=(), threshold_boxes=(),
                 cat_exp=(), is_validate_data=None, objective_var=None,
                 color_var=None, div_by_data_number=None, div_by_cat=None,
                 cyclic_div_num=None, cyclic_window_len=None, cyclic_interval=None, cyclic_terms=(), compare_type=None):
        self.start_proc = int(start_proc) if str(start_proc).isnumeric() else None
        self.start_date = start_date
        self.start_time = start_time
        self.end_date = end_date
        self.end_time = end_time
        self.client_timezone = client_timezone

        self.hm_step = hm_step
        self.hm_mode = hm_mode
        self.hm_function_real = hm_function_real
        self.hm_function_cate = hm_function_cate
        self.hm_trim = hm_trim

        self.x_option = x_option
        self.serial_processes = [int(val) for val in serial_processes if val]
        self.serial_columns = [int(val) for val in serial_columns if val]
        self.serial_orders = [int(val) for val in serial_orders if val]

        self.cond_procs = cond_procs
        self.cate_procs = cate_procs
        self.threshold_boxes = [int(filter_detail_id) for filter_detail_id in threshold_boxes if filter_detail_id]

        if not cat_exp:
            self.cat_exp = []
        elif isinstance(cat_exp, (list, tuple)):
            self.cat_exp = [int(cat) for cat in cat_exp if cat]
        else:
            self.cat_exp = [int(cat_exp)]

        self.is_validate_data = bool(is_validate_data)
        self.objective_var = int(objective_var) if objective_var else None
        self.color_var = int(color_var) if color_var else None
        self.div_by_data_number = int(div_by_data_number) if div_by_data_number else None
        self.div_by_cat = int(div_by_cat) if div_by_cat else None

        self.cyclic_div_num = int(cyclic_div_num) if cyclic_div_num else None
        self.cyclic_window_len = int(cyclic_window_len) if cyclic_window_len else None
        self.cyclic_interval = int(cyclic_interval) if cyclic_interval else None
        self.cyclic_terms = cyclic_terms
        self.compare_type = compare_type


class DicParam:
    chart_count: int
    common: CommonParam
    array_formval: List[EndProc]

    def __init__(self, chart_count, common, array_formval, cyclic_terms=[]):
        self.array_formval = array_formval
        # for end_proc in array_formval or []:
        #     self.add_proc_to_array_formval(end_proc.proc_id, end_proc.col_ids)

        self.common = common
        self.chart_count = chart_count
        self.cyclic_terms = cyclic_terms

    def search_end_proc(self, proc_id):
        for idx, proc in enumerate(self.array_formval):
            if proc.proc_id == proc_id:
                return idx, proc

        return None, None

    def is_end_proc(self, proc_id):
        for idx, proc in enumerate(self.array_formval):
            if proc.proc_id == proc_id:
                return True
        return False

    def add_proc_to_array_formval(self, proc_id, col_ids, append_first=False):
        idx, proc = self.search_end_proc(proc_id)
        if proc:
            proc = self.array_formval.pop(idx)
        else:
            proc = EndProc(proc_id, [])

        proc.add_cols(col_ids)
        proc.add_sensor_col_ids(col_ids)

        if append_first:
            self.array_formval.insert(0, proc)
        else:
            self.array_formval.append(proc)

        return proc

    def add_start_proc_to_array_formval(self):
        if not self.common.start_proc:
            return None

        proc = self.add_proc_to_array_formval(self.common.start_proc, [], True)
        return proc

    def add_cate_procs_to_array_formval(self):
        for proc in self.common.cate_procs:
            self.add_proc_to_array_formval(proc.proc_id, proc.col_ids)

    def add_cond_procs_to_array_formval(self):
        for proc in self.common.cond_procs:
            col_ids = list(proc.dic_col_id_filters)
            if col_ids:
                self.add_proc_to_array_formval(proc.proc_id, col_ids)

    def add_cat_exp_to_array_formval(self):
        if self.common.cat_exp:
            cfg_cat_exps = CfgProcessColumn.get_by_ids(self.common.cat_exp)
            for cfg_cat_exp in cfg_cat_exps:
                self.add_proc_to_array_formval(cfg_cat_exp.process_id, cfg_cat_exp.id)

    def add_column_to_array_formval(self, col_ids):
        if col_ids:
            cfg_cols = CfgProcessColumn.get_by_ids(col_ids)
            for cfg_col in cfg_cols:
                self.add_proc_to_array_formval(cfg_col.process_id, cfg_col.id)

    def get_all_proc_ids(self):
        proc_ids = set()
        proc_ids.add(self.common.start_proc)
        proc_ids.update([proc.proc_id for proc in self.common.cond_procs])
        proc_ids.update([proc.proc_id for proc in self.common.cate_procs])
        proc_ids.update([proc.proc_id for proc in self.array_formval])

        return list(proc_ids)

    def get_cate_var_col_id(self):
        try:
            if len(self.common.cate_procs):
                return self.common.cate_procs[0].col_ids[0]
        except Exception as ex:
            logger.error(ex)
        return None

    def get_cate_var_col_name(self):
        try:
            if len(self.common.cate_procs):
                return self.common.cate_procs[0].col_names[0]
        except Exception as ex:
            logger.error(ex)
        return None

    def get_cate_var_filter_details(self, var_col_id):
        candidate_sets = [set()]
        if len(self.common.cond_procs):
            # cate var column may be the same as filter column -> 2 cond procs created -> get all of them
            for idx, cond in enumerate(self.common.cond_procs):
                # cate var belong to start proc only
                if cond.proc_id != self.common.start_proc:
                    continue
                dic_col_id_filters = cond.dic_col_id_filters or {}
                for col_id, col_detail in dic_col_id_filters.items():
                    # get filter details of var column only
                    if col_id != var_col_id:
                        continue
                    set_filter_details = set(col_detail[0].cfg_filter_details or [])  # check idx
                    candidate_sets.append(set_filter_details)

        candidate_sets = [s for s in candidate_sets if len(s)]
        if candidate_sets:
            return list(set.intersection(*candidate_sets))
        return []

    def get_end_cols(self, proc_id):
        _, end_proc = self.search_end_proc(proc_id)
        if isinstance(end_proc, EndProc):
            return end_proc.get_col_ids() or []
        return []

    def get_all_end_col_ids(self):
        cols = []
        for proc in self.array_formval:
            cols += proc.col_ids

        return cols

    def get_sensor_cols(self, proc_id):
        _, end_proc = self.search_end_proc(proc_id)
        if isinstance(end_proc, EndProc):
            return end_proc.get_sensor_col_ids() or []
        return []

    def get_start_proc(self):
        return self.common.start_proc

    def get_client_timezone(self):
        return self.common.client_timezone

    def not_only_start_in_cond_procs(self):
        if not self.common.cond_procs:
            return False

        self.common.start_proc
        cond_proc_ids = [proc.proc_id for proc in self.common.cond_procs]

        if any([self.common.start_proc != cond_proc_id for cond_proc_id in cond_proc_ids]):
            return True

        return False
