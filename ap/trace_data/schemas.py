from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

from ap.api.common.services.utils import TraceGraph, get_col_cfg
from ap.api.setting_module.services.equations import get_all_normal_columns_for_functions
from ap.common.common_utils import gen_sql_label
from ap.common.constants import (
    COL_DATA_TYPE,
    DATA_GROUP_TYPE,
    END_COL_ID,
    END_COL_NAME,
    END_PROC_ID,
    END_PROC_NAME,
    IS_CATEGORY,
    IS_INT_CATEGORY,
    IS_JUDGE,
    IS_SERIAL_NO,
    NO_FILTER,
    SELECT_ALL,
    SHOWN_NAME,
    DataColumnType,
    DuplicateSerialCount,
    DuplicateSerialShow,
    RemoveOutlierType,
)
from ap.setting_module.models import CfgFilterDetail, CfgProcess, CfgProcessColumn


class EndProc:
    proc_id: int
    col_ids: List[int]
    col_names: List[str]
    col_show_names: List[str]
    col_sensor_only_ids: List[int]

    def __init__(self, cfg_proc: CfgProcess, cols):
        self.proc_id = cfg_proc.id
        self.col_ids = []
        self.col_names = []
        self.col_show_names = []
        self.col_sensor_only_ids = []
        self.cfg_proc = cfg_proc

        if cols:
            self.add_cols(cols)
            self.col_sensor_only_ids = [*self.col_ids]

    def add_cols(self, col_ids, append_first=False):
        if not isinstance(col_ids, (list, tuple)):
            col_ids = [col_ids]

        ids = [int(col) for col in col_ids]
        for col_id in ids:
            cfg_col = self.cfg_proc.get_col(col_id)
            if not cfg_col:
                continue

            if cfg_col.id in self.col_ids:
                idx = self.col_ids.index(cfg_col.id)
                id = self.col_ids.pop(idx)
                column_name = self.col_names.pop(idx)
                name = self.col_show_names.pop(idx)
            else:
                id = cfg_col.id
                column_name = cfg_col.column_name
                name = cfg_col.shown_name
                self.proc_id = cfg_col.process_id

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
        for col_id in ids:
            if col_id not in self.col_sensor_only_ids:
                self.col_sensor_only_ids.append(col_id)

    def get_col_ids(self):
        return self.col_ids

    def get_sensor_col_ids(self):
        return self.col_sensor_only_ids


class CategoryProc:
    proc_id: int
    col_ids: List[int]
    col_names: List[str]
    col_show_names: List[str]

    def __init__(self, dic_proc_cfgs, proc, cols):
        if proc:
            self.proc_id = int(proc)

        if isinstance(cols, (list, tuple)):
            self.col_ids = [int(col) for col in cols]
        else:
            self.col_ids = [int(cols)]

        self.col_names = []
        self.col_show_names = []
        for col_id in self.col_ids:
            column = get_col_cfg(dic_proc_cfgs, col_id)
            self.col_names.append(column.column_name)
            self.col_show_names.append(column.shown_name)
            self.proc_id = column.process_id


class ConditionProcDetail:
    cfg_filter_details: List[CfgFilterDetail]
    is_no_filter: bool
    is_select_all: bool
    column_id: int
    column_name: str

    def __init__(self, dic_filter_details):
        self.is_select_all = False
        self.is_no_filter = False
        self.cfg_filter_details = []
        self.column_id = None
        self.column_name = None

        column = None
        for id, filter_detail in dic_filter_details.items():
            if filter_detail is None:
                if str(id).lower() == NO_FILTER.lower():
                    self.is_no_filter = True
                    continue

                if str(id).lower() == SELECT_ALL.lower():
                    self.is_select_all = True
                    continue

            self.cfg_filter_details.append(filter_detail)
            if column is None:
                column = filter_detail.column
                if column:
                    self.column_id = column.id
                    self.column_name = column.column_name


class ConditionProc:
    proc_id: int
    dic_col_name_filters: Dict[str, List[ConditionProcDetail]]
    dic_col_id_filters: Dict[int, List[ConditionProcDetail]]

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
    traincond_procs: List[ConditionProc]
    cate_procs: List[CategoryProc]
    threshold_boxes: List[int]
    cat_exp: List[int]
    is_validate_data: bool
    is_remove_outlier: bool
    remove_outlier_objective_var: bool
    remove_outlier_explanatory_var: bool
    abnormal_count: bool
    sensor_cols: List[int]
    is_export_mode: bool
    is_latest: bool

    judge_var: int
    ng_condition: str
    ng_condition_val: str

    is_nominal_scale: bool
    nominal_vars: list

    cate_col_ids: list[int]

    outliers = None

    def __init__(
        self,
        start_proc=None,
        start_date=None,
        start_time=None,
        end_date=None,
        end_time=None,
        cond_procs=None,
        cate_procs=None,
        hm_step=None,
        hm_mode=None,
        hm_function_real=None,
        hm_function_cate=None,
        hm_trim=None,
        client_timezone=None,
        x_option=None,
        serial_processes=(),
        serial_columns=(),
        serial_orders=(),
        threshold_boxes=(),
        cat_exp=(),
        is_validate_data=None,
        objective_var=None,
        color_var=None,
        div_by_data_number=None,
        div_by_cat=None,
        cyclic_div_num=None,
        cyclic_window_len=None,
        cyclic_interval=None,
        cyclic_terms=(),
        compare_type=None,
        is_remove_outlier=0,
        remove_outlier_objective_var=0,
        remove_outlier_explanatory_var=0,
        abnormal_count=0,
        sensor_cols=[],
        duplicate_serial_show=None,
        is_export_mode=False,
        duplicated_serials_count=None,
        agp_color_vars=None,
        divide_format=None,
        divide_offset=None,
        is_latest=False,
        divide_calendar_dates=[],
        divide_calendar_labels=[],
        remove_outlier_type=RemoveOutlierType.O6M.value,
        remove_outlier_real_only=False,
        judge_var=None,
        ng_condition=None,
        ng_condition_val=None,
        is_proc_linked=False,
        is_nominal_scale=True,
        nominal_vars=[],
        cate_col_ids=[],
        traincond_procs=None,
    ):
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
        self.cyclic_window_len = float(cyclic_window_len) if cyclic_window_len else None
        self.cyclic_interval = float(cyclic_interval) if cyclic_interval else None
        self.cyclic_terms = cyclic_terms
        self.compare_type = compare_type
        self.is_remove_outlier = bool(int(is_remove_outlier))
        self.remove_outlier_objective_var = bool(int(remove_outlier_objective_var))
        self.remove_outlier_explanatory_var = bool(int(remove_outlier_explanatory_var))
        self.abnormal_count = bool(abnormal_count)
        self.sensor_cols = sensor_cols
        if duplicate_serial_show is None:
            self.duplicate_serial_show = DuplicateSerialShow.SHOW_BOTH
        else:
            self.duplicate_serial_show = DuplicateSerialShow(duplicate_serial_show)
        self.is_export_mode = bool(int(is_export_mode))
        if duplicated_serials_count is None:
            self.duplicated_serials_count = DuplicateSerialCount.AUTO
        else:
            self.duplicated_serials_count = DuplicateSerialCount(duplicated_serials_count)

        self.remove_outlier_type = RemoveOutlierType(remove_outlier_type)

        self.divide_format = divide_format or None
        self.divide_offset = float(divide_offset) if divide_offset else None
        self.agp_color_vars = agp_color_vars or None
        self.is_latest = is_latest
        self.divide_calendar_dates = divide_calendar_dates
        self.divide_calendar_labels = divide_calendar_labels
        self.remove_outlier_real_only = bool(remove_outlier_real_only)

        # rlp NG rate
        self.judge_var = judge_var
        self.ng_condition = ng_condition
        self.ng_condition_val = ng_condition_val
        self.is_proc_linked = is_proc_linked

        # nominal scale
        self.is_nominal_scale = bool(int(is_nominal_scale))
        if isinstance(nominal_vars, list):
            self.nominal_vars = [int(col_id) for col_id in nominal_vars]
        else:
            self.nominal_vars = [int(nominal_vars)] if nominal_vars else None

        self.cate_col_ids = cate_col_ids

        # pca multiple filter condition
        self.traincond_procs = traincond_procs


class DicParam:
    chart_count: int
    common: CommonParam
    array_formval: List[EndProc]
    dic_proc_cfgs: Dict[int, CfgProcess]
    trace_graph: TraceGraph
    dic_card_orders: Dict

    def __init__(
        self,
        dic_proc_cfgs: Dict[int, CfgProcess],
        trace_graph: TraceGraph,
        dic_card_orders,
        chart_count,
        common,
        array_formval,
        cyclic_terms=[],
    ):
        self.array_formval = array_formval
        # for end_proc in array_formval or []:
        #     self.add_proc_to_array_formval(end_proc.proc_id, end_proc.col_ids)

        self.common = common
        self.chart_count = chart_count
        self.cyclic_terms = cyclic_terms
        self.dic_proc_cfgs = dic_proc_cfgs
        self.trace_graph = trace_graph
        self.dic_card_orders = dic_card_orders

        self.dic_col_cfgs: dict[int, CfgProcessColumn] = {}
        for proc_id, proc in self.dic_proc_cfgs.items():
            for col in proc.columns:
                self.dic_col_cfgs[col.id] = col

    def search_end_proc(self, proc_id):
        for idx, proc in enumerate(self.array_formval):
            if proc.proc_id == proc_id:
                return idx, proc

        return None, None

    def is_end_proc(self, proc_id):
        return any(proc.proc_id == proc_id for idx, proc in enumerate(self.array_formval))

    def add_proc_to_array_formval(self, proc_id, col_ids, append_first=False, as_target_sensor=False):
        idx, proc = self.search_end_proc(proc_id)
        proc = self.array_formval.pop(idx) if proc else EndProc(self.dic_proc_cfgs[proc_id], [])

        proc.add_cols(col_ids)

        if as_target_sensor:
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
            col_ids = []
            for con_procs_column in proc.dic_col_id_filters:
                col_ids.append(con_procs_column)

            self.add_proc_to_array_formval(proc.proc_id, col_ids)

    def add_cat_exp_to_array_formval(self):
        if self.common.cat_exp:
            cfg_cat_exps = self.get_col_cfgs(self.common.cat_exp)
            for cfg_cat_exp in cfg_cat_exps:
                self.add_proc_to_array_formval(cfg_cat_exp.process_id, cfg_cat_exp.id)

    def add_column_to_array_formval(self, col_ids: list[int]):
        if col_ids:
            cfg_cols = self.get_col_cfgs(col_ids)
            for cfg_col in cfg_cols:
                self.add_proc_to_array_formval(cfg_col.process_id, cfg_col.id)

    def get_end_cols(self, proc_id: int):
        col_ids = []
        for idx, proc in enumerate(self.array_formval):
            if proc.proc_id == proc_id:
                col_ids += [col_id for col_id in proc.get_col_ids() if col_id in self.common.sensor_cols]
        return col_ids

    def get_all_end_col_ids(self):
        cols = []
        for proc in self.array_formval:
            cols += proc.col_ids

        return [col for col in cols if col in self.common.sensor_cols]

    def get_start_proc(self):
        return self.common.start_proc

    def get_client_timezone(self):
        return self.common.client_timezone

    def get_facet_var_cols_name(self):
        if self.common.cat_exp:
            cfg_cols = []
            for col_id in self.common.cat_exp:
                cfg_cols.append(self.get_col_cfg(col_id))
            return cfg_cols

        return []

    def get_div_cols_label(self):
        if self.common.div_by_cat:
            div_col = self.get_col_cfg(self.common.div_by_cat)
            return gen_sql_label(div_col.id, div_col.column_name)
        return None

    def add_datetime_col_to_start_proc(self):
        for proc in self.array_formval:
            if proc.proc_id and proc.proc_id == self.common.start_proc:
                # proc_cfg = CfgProcess.query.get(proc.proc_id)
                proc_cfg = self.dic_proc_cfgs[proc.proc_id]
                datetime_col = proc_cfg.get_date_col(column_name_only=False) or None
                if datetime_col:
                    proc.add_cols(datetime_col.id)

    def get_all_target_cols(self):
        target_cols = []
        for proc in self.array_formval:
            # proc_cfg = CfgProcess.query.get(proc.proc_id)
            proc_cfg = self.dic_proc_cfgs[proc.proc_id]
            dic_cfg_cols = proc_cfg.get_dic_cols_by_ids(proc.col_ids)
            for col_id, col_info in dic_cfg_cols.items():
                # col_info = CfgProcessColumn.get_by_ids([col_id])
                target_cols.append(
                    {
                        END_COL_ID: col_id,
                        END_COL_NAME: col_info.column_name,
                        SHOWN_NAME: col_info.shown_name,  # shown name of column
                        END_PROC_ID: proc.proc_id,
                        END_PROC_NAME: proc_cfg.shown_name or '',
                        COL_DATA_TYPE: col_info.data_type,
                        DATA_GROUP_TYPE: col_info.column_type,
                        IS_CATEGORY: col_info.is_category,
                        IS_SERIAL_NO: col_info.is_serial_no,
                        IS_INT_CATEGORY: col_info.is_int_category,
                        IS_JUDGE: col_info.is_judge,
                    },
                )
        return target_cols

    def add_agp_color_vars(self):
        if self.common.agp_color_vars:
            color_vars = list(self.common.agp_color_vars.values())
            # add col if not in current col_ids list
            already_col_ids = [int(col_id) for col_id in self.get_all_end_col_ids()]
            color_vars = [int(col_var) for col_var in color_vars if int(col_var) not in already_col_ids]
            cfg_color_cols = self.get_col_cfgs(color_vars)
            for cfg_col in cfg_color_cols:
                # assign to list of target columns
                self.add_proc_to_array_formval(cfg_col.process_id, cfg_col.id)

    def get_col_info_by_id(self, col_id):
        target_cols = self.get_all_target_cols()
        cols = [col for col in target_cols if str(col[END_COL_ID]) == str(col_id)]
        return cols[0] if len(cols) else None

    def get_color_id(self, target_var: int) -> Optional[int]:
        if self.common.agp_color_vars is None:
            return None
        color_id = self.common.agp_color_vars.get(str(target_var))
        if color_id is None:
            return None
        return int(color_id)

    def get_color_info(self, target_var, shown_name=False):
        color_id = self.get_color_id(target_var)
        if not color_id:
            return None, None, None

        color_col = self.get_col_info_by_id(color_id)
        color_label = gen_sql_label(color_id, color_col[END_COL_NAME])

        if not shown_name:
            return color_col[END_COL_NAME] or None, color_col[DATA_GROUP_TYPE], color_label

        return color_col[SHOWN_NAME] or None, color_col[DATA_GROUP_TYPE], color_label

    def get_col_cfgs(self, col_ids: list[int]) -> list[CfgProcessColumn]:
        col_ids = filter(lambda x: x is not None, col_ids)
        col_ids = list(map(int, col_ids))
        return [self.dic_col_cfgs.get(col_id) for col_id in col_ids if col_id in self.dic_col_cfgs]

    def get_col_cfg(self, col_id: int) -> CfgProcessColumn | None:
        return self.dic_col_cfgs.get(int(col_id))

    def gen_label_from_col_id(self, col_id: int) -> str | None:
        col = self.get_col_cfg(col_id)
        if not col:
            return None
        return col.gen_sql_label()

    def add_ng_condition_to_array_formval(self, as_target_sensor=False):
        if self.common.judge_var:
            judge_var = self.get_col_cfg(int(self.common.judge_var))
            if judge_var:
                self.add_proc_to_array_formval(judge_var.process_id, judge_var.id, as_target_sensor=as_target_sensor)

    def add_function_cols_to_sensor_cols(self):
        for end_proc in self.array_formval:
            all_columns = self.dic_proc_cfgs[end_proc.proc_id].columns
            required_column_ids = get_all_normal_columns_for_functions(end_proc.col_ids, all_columns)
            if required_column_ids:
                end_proc.add_cols(required_column_ids)

    def get_process_by_id(self, proc_id):
        process = [proc for (_, proc) in self.dic_proc_cfgs.items() if proc.id == proc_id]
        return process[0] if process else None

    def get_all_end_procs(self, id_only=False):
        return [proc.proc_id if id_only else proc.cfg_proc for proc in self.array_formval]

    def get_query_variables(self):
        target_variables_id = self.get_all_end_col_ids() or []
        # get facet/label/color variables
        facet_variables_id = self.common.cat_exp or []
        label_variables_id = self.common.cate_col_ids or []
        color_variables_id = []
        if self.common.color_var:
            color_variables_id = [self.common.color_var]
        # AgP multiple colors
        if self.common.agp_color_vars and self.common.agp_color_vars.values():
            color_variables_id += list(self.common.agp_color_vars.values())

        # get col_cfgs from all variables
        query_variables = target_variables_id + facet_variables_id + label_variables_id + color_variables_id
        query_variables = [int(var_id) for var_id in query_variables]
        query_variables = list(set(query_variables))
        query_variables = self.get_col_cfgs(query_variables)
        return query_variables

    def get_judge_variables(self) -> list[str]:
        # get all target variables
        query_variables = self.get_query_variables()
        judge_labels = [
            self.gen_label_from_col_id(col.id)
            for col in query_variables
            if col.column_type == DataColumnType.JUDGE.value
        ]
        return judge_labels

    def get_boolean_variables(self) -> list[str]:
        # get all target variables
        query_variables = self.get_query_variables()
        boolean_labels = [
            self.gen_label_from_col_id(col.id)
            for col in query_variables
            if col.column_type == DataColumnType.BOOLEAN.value
        ]
        return boolean_labels
