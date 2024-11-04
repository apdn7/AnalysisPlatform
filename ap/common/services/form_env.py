import json
import logging
import re
from collections import defaultdict
from copy import deepcopy
from typing import Dict

from ap.api.common.services.utils import TraceGraph
from ap.common.common_utils import as_list
from ap.common.constants import (
    ABNORMAL_COUNT,
    ACT_CELLS,
    ACTUAL_RECORD_NUMBER,
    AGP_COLOR_VARS,
    ARRAY_FORMVAL,
    ARRAY_PLOTDATA,
    BOOKMARK_ID,
    CAT_EXP_BOX,
    CAT_ON_DEMAND,
    CATE_PROC,
    CATE_PROCS,
    CATE_VALUE_MULTI,
    CATE_VARIABLE,
    CLIENT_TIMEZONE,
    COLOR_ORDER,
    COLOR_VAR,
    COMMON,
    COMPARE_TYPE,
    COND_PROC,
    COND_PROCS,
    CYCLIC_DIV_NUM,
    CYCLIC_INTERVAL,
    CYCLIC_TERMS,
    CYCLIC_TRACE_TIME,
    CYCLIC_WINDOW_LEN,
    DIC_CAT_FILTERS,
    DIV_BY_CAT,
    DIV_BY_DATA_NUM,
    DIV_FROM_TO,
    DIVIDE_CALENDAR_DATES,
    DIVIDE_CALENDAR_LABELS,
    DIVIDE_FMT,
    DIVIDE_OFFSET,
    DUPLICATE_SERIAL_SHOW,
    DUPLICATED_SERIALS_COUNT,
    EMD_TYPE,
    END_DATE,
    END_PROC,
    END_TM,
    EXPORT_FROM,
    FILTER_DATA,
    FILTER_ON_DEMAND,
    FINE_SELECT,
    FMT,
    GET02_CATE_SELECT,
    GET02_VALS_SELECT,
    GRAPH_FILTER_DETAILS,
    HM_FUNCTION_CATE,
    HM_FUNCTION_REAL,
    HM_MODE,
    HM_STEP,
    HM_TRIM,
    ID,
    IMAGES,
    IS_DUMMY_DATETIME,
    IS_EXPORT_MODE,
    IS_GET_DATE,
    IS_GRAPH_LIMITED,
    IS_IMPORT_MODE,
    IS_NOMINAL_SCALE,
    IS_PROC_LINKED,
    IS_REMOVE_OUTLIER,
    IS_USE_DUMMY_DATETIME,
    IS_VALIDATE_DATA,
    JUDGE_VAR,
    LIST_PROCS,
    MATCHED_FILTER_IDS,
    MATRIX_COL,
    NAME,
    NG_CONDITION,
    NG_CONDITION_VALUE,
    NG_RATES,
    NO_FILTER,
    NOMINAL_VARS,
    NOT_EXACT_MATCH_FILTER_IDS,
    OBJ_VAR,
    PROCS,
    RECENT_TIME_INTERVAL,
    REMOVE_OUTLIER_EXPLANATORY_VAR,
    REMOVE_OUTLIER_OBJECTIVE_VAR,
    REMOVE_OUTLIER_REAL_ONLY,
    REMOVE_OUTLIER_TYPE,
    REMOVED_OUTLIERS,
    REQ_ID,
    REQUEST_PARAMS,
    RL_CATES,
    RL_EMD,
    RL_XAXIS,
    SCP_HMP_X_AXIS,
    SCP_HMP_Y_AXIS,
    SELECT_ALL,
    SERIAL_COLUMN,
    SERIAL_ORDER,
    SERIAL_PROCESS,
    START_DATE,
    START_PROC,
    START_TM,
    TBLS,
    TEMP_CAT_EXP,
    TEMP_CAT_PROCS,
    TEMP_SERIAL_COLUMN,
    TEMP_SERIAL_ORDER,
    TEMP_SERIAL_PROCESS,
    TEMP_X_OPTION,
    TERM_TRACE_TIME,
    THRESHOLD_BOX,
    TIME_CONDS,
    TRACE_TIME,
    UNIQUE_COLOR,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    VAR_TRACE_TIME,
    X_OPTION,
    YAML_FILTER_LINE_MACHINE_ID,
    DuplicateSerialCount,
    DuplicateSerialShow,
    PCAFilterCondition,
    RemoveOutlierType,
)
from ap.common.services.http_content import json_dumps
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.setting_module.models import CfgProcess, CfgProcessColumn
from ap.setting_module.services.process_config import (
    get_all_process_no_nested,
    get_all_visualizations,
    get_process_columns,
)
from ap.trace_data.schemas import (
    CategoryProc,
    CommonParam,
    ConditionProc,
    ConditionProcDetail,
    DicParam,
    EndProc,
)

logger = logging.getLogger(__name__)

# common key receive from client
common_startwith_keys = (
    'start_proc',
    'START_DATE',
    'START_TIME',
    'END_DATE',
    'END_TIME',
    CATE_VARIABLE,
    CATE_VALUE_MULTI,
    COMPARE_TYPE,
    IS_REMOVE_OUTLIER,
    'client_timezone',
    CYCLIC_DIV_NUM,
    CYCLIC_INTERVAL,
    CYCLIC_WINDOW_LEN,
    HM_STEP,
    HM_MODE,
    HM_TRIM,
    HM_FUNCTION_REAL,
    HM_FUNCTION_CATE,
    X_OPTION,
    SERIAL_COLUMN,
    SERIAL_ORDER,
    SERIAL_PROCESS,
    THRESHOLD_BOX,
    CAT_EXP_BOX,
    IS_VALIDATE_DATA,
    DIC_CAT_FILTERS,
    TEMP_X_OPTION,
    TEMP_SERIAL_ORDER,
    TEMP_SERIAL_COLUMN,
    TEMP_SERIAL_PROCESS,
    TEMP_CAT_EXP,
    TEMP_CAT_PROCS,
    DIV_BY_CAT,
    DIV_BY_DATA_NUM,
    COLOR_VAR,
    CYCLIC_DIV_NUM,
    CYCLIC_WINDOW_LEN,
    CYCLIC_INTERVAL,
    MATRIX_COL,
    COLOR_ORDER,
    IS_EXPORT_MODE,
    IS_IMPORT_MODE,
    VAR_TRACE_TIME,
    TERM_TRACE_TIME,
    CYCLIC_TRACE_TIME,
    TRACE_TIME,
    EMD_TYPE,
    ABNORMAL_COUNT,
    REMOVE_OUTLIER_OBJECTIVE_VAR,
    REMOVE_OUTLIER_EXPLANATORY_VAR,
    DUPLICATE_SERIAL_SHOW,
    EXPORT_FROM,
    DUPLICATED_SERIALS_COUNT,
    AGP_COLOR_VARS,
    DIVIDE_FMT,
    DIVIDE_OFFSET,
    DIVIDE_CALENDAR_DATES,
    DIVIDE_CALENDAR_LABELS,
    REMOVE_OUTLIER_TYPE,
    REMOVE_OUTLIER_REAL_ONLY,
    JUDGE_VAR,
    NG_CONDITION,
    NG_CONDITION_VALUE,
    IS_NOMINAL_SCALE,
    NOMINAL_VARS,
    REQ_ID,
    BOOKMARK_ID,
    RECENT_TIME_INTERVAL,
    FINE_SELECT,
    REQUEST_PARAMS,
    SCP_HMP_X_AXIS,
    SCP_HMP_Y_AXIS,
)


conds_startwith_keys = ('filter-', 'cond_', 'machine_id_multi')
train_conds_startwith_keys = ('trainfilter-', 'traincond_', 'trainmachine_id_multi')

category_startwith_keys = (CATE_PROC, GET02_CATE_SELECT)

multiple_selections = (GET02_VALS_SELECT, GET02_CATE_SELECT)


# フォームの環境変数の解析


def parse(dic_form):
    # TBLSがキー存在しない場合(index.pyを直打ちの場合)
    if 'TBLS' not in dic_form:
        return {'TBLS': 1, 'ARRAY_FORMVAL': []}

    # num_tbls = dic_form["TBLS"].value
    num_tbls = dic_form['TBLS']
    dic_parsed = {'TBLS': num_tbls}
    array_formval = []
    # まずは空のキーで辞書の配列を初期化
    for idx in range(int(num_tbls)):
        array_formval.append({})

    # NUM_ELEMENT + 数字の形式のキーを取得
    for key in dic_form:
        # array_value = dic_form.getlist(key)

        array_value = []
        raw_value = dic_form[key]
        if raw_value.__class__.__name__ == 'list':
            array_value.extend(raw_value)
        else:
            array_value.append(raw_value)

        value = array_value[0]
        # Keyの文字列を解析
        m = re.match(r'(^.+)(\d+)$', key)
        m2 = re.match(r'.+_multi\d+$', key)
        if m:
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            # debugstr = "matched_key= {}\n".format(matched_key)
            # debugstr += "matched_idx= {}\n".format(matched_idx)
            # 昔の不要な環境変数が残っている場合は無視
            if matched_idx >= int(num_tbls):
                continue

            # キーの最後に"_multi"がついている場合は配列として扱う
            # マルチセレクタなどで使う
            if m2:
                value = array_value
            array_formval[matched_idx][matched_key] = value
        else:
            dic_parsed[key] = value

    # デバッグ用の値
    dic_parsed[ARRAY_FORMVAL] = array_formval
    return dic_parsed


def parse_multi_filter_into_one(dic_form):
    # count select cols of endpoint
    num_tbls = len([key for key in dic_form if key.startswith('end_proc')])

    dic_parsed = {TBLS: num_tbls, COMMON: {}}
    cond_procs = [{}]
    cate_procs = [{}]
    array_formval = []
    train_cond_procs = [{}]

    # まずは空のキーで辞書の配列を初期化
    for idx in range(int(num_tbls)):
        array_formval.append({})

    # NUM_ELEMENT + 数字の形式のキーを取得
    for key in dic_form:
        raw_value = dic_form[key]

        value = remove_const_keyword(raw_value, [SELECT_ALL, None, ''])
        # filter-line-machine-id
        if (key.startswith((YAML_FILTER_LINE_MACHINE_ID, PCAFilterCondition.TRAIN_LINE_COND.value))) and value == []:
            value = [NO_FILTER]

        # Keyの文字列を解析
        m = re.match(r'(.*?)(\d+)$', key)

        # common keys
        if key.startswith(common_startwith_keys):
            if key == DIC_CAT_FILTERS:
                dic_cat_filters = json.loads(value)
                if dic_cat_filters:
                    dic_parsed[COMMON][key] = {int(col): vals for col, vals in dic_cat_filters.items()}
            elif key in (
                TEMP_CAT_EXP,
                TEMP_CAT_PROCS,
                AGP_COLOR_VARS,
                DIVIDE_CALENDAR_DATES,
                DIVIDE_CALENDAR_LABELS,
                NOMINAL_VARS,
            ):
                dic_parsed[COMMON][key] = json.loads(value)
            elif key.startswith((VAR_TRACE_TIME, TRACE_TIME)):
                dic_parsed[COMMON][TRACE_TIME] = value
            else:
                dic_parsed[COMMON][key] = value

        elif key.startswith(conds_startwith_keys):
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            for i in range(matched_idx - len(cond_procs) + 1):
                cond_procs.append({})
            cond_procs[matched_idx][matched_key] = value
        elif key.startswith(train_conds_startwith_keys):  # PCA
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            for i in range(matched_idx - len(train_cond_procs) + 1):
                train_cond_procs.append({})
            train_cond_procs[matched_idx][matched_key] = value
        # category
        elif key.startswith(category_startwith_keys):
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            for i in range(matched_idx - len(cate_procs) + 1):
                cate_procs.append({})

            # remove NO FILTER for category procs
            edit_value = remove_const_keyword(value, [NO_FILTER])
            cate_procs[matched_idx][matched_key] = edit_value

        # end proc
        elif m:
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            # 昔の不要な環境変数が残っている場合は無視
            for i in range(matched_idx - len(array_formval) + 1):
                array_formval.append({})

            # キーの最後に"_multi"がついている場合は配列として扱う
            # マルチセレクタなどで使う
            edit_value = remove_const_keyword(value, [NO_FILTER], key.startswith(multiple_selections))
            array_formval[matched_idx][matched_key] = edit_value

    # end procs
    dic_parsed[ARRAY_FORMVAL] = [ele for ele in array_formval if ele and ele.get(GET02_VALS_SELECT)]
    dic_parsed[TBLS] = len(dic_parsed[ARRAY_FORMVAL])

    # cond_procs
    dic_parsed[COMMON][COND_PROCS] = [ele for ele in cond_procs if ele]
    # for PCA filter condition
    dic_parsed[COMMON][PCAFilterCondition.TRAIN_COND_PROCS.value] = [ele for ele in train_cond_procs if ele]

    # category procs
    dic_parsed[COMMON][CATE_PROCS] = [ele for ele in cate_procs if ele and ele.get(GET02_CATE_SELECT)]

    dic_parsed[TBLS] = len(dic_parsed[ARRAY_FORMVAL])

    # cond_procs
    dic_parsed[COMMON][OBJ_VAR] = dic_form.get(OBJ_VAR) or []

    dic_parsed[COMMON][IS_REMOVE_OUTLIER] = dic_form.get(IS_REMOVE_OUTLIER, [0])[0]
    dic_parsed[COMMON][REMOVE_OUTLIER_OBJECTIVE_VAR] = dic_form.get(REMOVE_OUTLIER_OBJECTIVE_VAR, [0])[0]
    dic_parsed[COMMON][REMOVE_OUTLIER_EXPLANATORY_VAR] = dic_form.get(REMOVE_OUTLIER_EXPLANATORY_VAR, [0])[0]
    is_start_proc_not_set = START_PROC in dic_parsed[COMMON] and isinstance(dic_parsed[COMMON][START_PROC], list)
    # set default start process
    if START_PROC not in dic_parsed[COMMON] or is_start_proc_not_set:
        list_of_end_procs = [proc[END_PROC] if END_PROC in proc else None for proc in array_formval]
        list_of_end_procs = list(filter(lambda end_proc: end_proc, list_of_end_procs))
        dic_parsed[COMMON][START_PROC] = list_of_end_procs[0]

    return dic_parsed


def parse_request_params(request):
    """
    Parse request parameters of Flask HTTP request to a dictionary.
    Note: This function support parsing multiple values of keys.

    :param request: HTTP request in Flask
    :return: Dictionary of key-value of request parameter.
    """
    dic_form = {}
    for key in request.args:
        values = request.args.getlist(key)
        if len(values) > 1:
            dic_form[key] = values
        else:
            dic_form[key] = values[0]
    return dic_form


def remove_const_keyword(value, keywords, is_multiple_selection=False):
    if isinstance(value, (list, tuple)):
        edit_value = [val for val in value if val not in keywords]
        if len(edit_value) == 1:
            edit_value = edit_value[0]
    elif value in keywords:
        edit_value = []
    elif is_multiple_selection:
        edit_value = [value]
    else:
        edit_value = value

    return edit_value


def bind_condition_procs(dic_proc_cfgs: Dict[int, CfgProcess], dic_param, prefix=''):
    dic_proc_filter_details = {}
    # condition
    cond_procs = []

    cond_procs_key = f'{prefix}{COND_PROCS}'
    if cond_procs_key not in dic_param[COMMON]:
        return cond_procs

    for dic_cond in dic_param[COMMON][cond_procs_key]:
        proc_id = dic_cond[f'{prefix}{COND_PROC}']
        if not proc_id:
            continue

        if isinstance(proc_id, list):
            proc_id = ''.join(proc_id)

        # remove invalid
        if not str(proc_id).isnumeric():
            continue

        proc_id = int(proc_id)
        cond_details = []
        if proc_id not in dic_proc_filter_details:
            dic_proc_filter_details[proc_id] = dic_proc_cfgs[proc_id].get_dic_filter_details()

        for key, _vals in dic_cond.items():
            vals = _vals
            if key == f'{prefix}{COND_PROC}':
                continue

            dic_filter_details = {}
            if not isinstance(vals, (tuple, list)):
                vals = [vals]

            for val in vals:
                if val in (SELECT_ALL, NO_FILTER):
                    continue

                cfg_filter_detail = dic_proc_filter_details[proc_id].get(int(val))
                dic_filter_details[val] = cfg_filter_detail

            if dic_filter_details:
                cond_details.append(ConditionProcDetail(dic_filter_details))

        cond_proc = ConditionProc(proc_id, cond_details)
        cond_procs.append(cond_proc)

    return cond_procs


# @CustomCache.memoize()
def bind_dic_param_to_class(
    dic_proc_cfgs: Dict[int, CfgProcess],
    trace_graph: TraceGraph,
    dic_card_orders,
    dic_param,
    is_train_data=False,
):
    dic_common = dic_param[COMMON]

    # chart count
    chart_count = dic_param[TBLS]

    # conditions
    cond_procs = bind_condition_procs(dic_proc_cfgs, dic_param)

    train_cond_procs = []
    if is_train_data:
        # pca train filter conditions
        train_cond_procs = bind_condition_procs(dic_proc_cfgs, dic_param, prefix='train')

    # categories
    cate_procs = []
    if dic_common.get(CATE_PROCS):
        for proc in dic_common[CATE_PROCS]:
            if proc.get(CATE_PROC) and proc.get(GET02_CATE_SELECT):
                cat_info = CategoryProc(dic_proc_cfgs, proc.get(CATE_PROC), proc[GET02_CATE_SELECT])
                if cat_info:
                    cate_procs.append(cat_info)

    # category expand
    cat_exps = []

    cat_exp = dic_common.get(CAT_EXP_BOX)
    if cat_exp:
        if isinstance(cat_exp, list):
            cat_exps = cat_exp
        else:
            cat_exps.append(cat_exp)

    for i in range(1, 10):
        cat_exp = dic_common.get(f'{CAT_EXP_BOX}{i}')
        if cat_exp:
            cat_exps.append(cat_exp)

    objective_var = dic_common.get(OBJ_VAR)[0] if dic_common.get(OBJ_VAR) else None

    # array_formval
    array_formval = [
        EndProc(dic_proc_cfgs[int(proc.get(END_PROC))], proc[GET02_VALS_SELECT]) for proc in dic_param[ARRAY_FORMVAL]
    ]

    sensor_cols = []
    for proc in array_formval:
        sensor_cols += proc.col_ids

    # common
    common = CommonParam(
        dic_common[START_PROC],
        dic_common[START_DATE],
        dic_common[START_TM],
        dic_common[END_DATE],
        dic_common[END_TM],
        cond_procs,
        cate_procs,
        hm_step=dic_common.get(HM_STEP),
        hm_mode=dic_common.get(HM_MODE),
        hm_function_real=dic_common.get(HM_FUNCTION_REAL),
        hm_function_cate=dic_common.get(HM_FUNCTION_CATE),
        hm_trim=dic_common.get(HM_TRIM, 0),
        client_timezone=dic_common.get(CLIENT_TIMEZONE),
        x_option=dic_common.get(X_OPTION),
        serial_processes=as_list(dic_common.get(SERIAL_PROCESS)),
        serial_columns=as_list(dic_common.get(SERIAL_COLUMN)),
        serial_orders=as_list(dic_common.get(SERIAL_ORDER)),
        threshold_boxes=as_list(dic_common.get(THRESHOLD_BOX)),
        cat_exp=cat_exps,
        is_validate_data=dic_common.get(IS_VALIDATE_DATA, 0),
        objective_var=objective_var,
        color_var=dic_common.get(COLOR_VAR),
        div_by_data_number=dic_common.get(DIV_BY_DATA_NUM),
        div_by_cat=dic_common.get(DIV_BY_CAT),
        cyclic_div_num=dic_common.get(CYCLIC_DIV_NUM),
        cyclic_window_len=dic_common.get(CYCLIC_WINDOW_LEN),
        cyclic_interval=dic_common.get(CYCLIC_INTERVAL),
        cyclic_terms=dic_common.get(CYCLIC_TERMS),
        compare_type=dic_common.get(COMPARE_TYPE),
        is_remove_outlier=dic_common.get(IS_REMOVE_OUTLIER, 0),
        remove_outlier_objective_var=dic_common.get(REMOVE_OUTLIER_OBJECTIVE_VAR, 0),
        remove_outlier_explanatory_var=dic_common.get(REMOVE_OUTLIER_EXPLANATORY_VAR, 0),
        abnormal_count=dic_common.get(ABNORMAL_COUNT, 0),
        sensor_cols=sensor_cols,
        duplicate_serial_show=dic_common.get(DUPLICATE_SERIAL_SHOW, DuplicateSerialShow.SHOW_BOTH),
        is_export_mode=dic_common.get(IS_EXPORT_MODE, False),
        duplicated_serials_count=dic_common.get(DUPLICATED_SERIALS_COUNT, DuplicateSerialCount.AUTO.value),
        divide_format=dic_common.get(DIVIDE_FMT, None),
        divide_offset=dic_common.get(DIVIDE_OFFSET, None),
        agp_color_vars=dic_common.get(AGP_COLOR_VARS, None),
        is_latest=dic_common.get(TRACE_TIME, 'default') == 'recent',
        divide_calendar_dates=dic_common.get(DIVIDE_CALENDAR_DATES, []),
        divide_calendar_labels=dic_common.get(DIVIDE_CALENDAR_LABELS, []),
        remove_outlier_type=dic_common.get(REMOVE_OUTLIER_TYPE, RemoveOutlierType.O6M.value),
        remove_outlier_real_only=dic_common.get(REMOVE_OUTLIER_REAL_ONLY, 0),
        judge_var=dic_common.get(JUDGE_VAR, None),
        ng_condition=dic_common.get(NG_CONDITION, None),
        ng_condition_val=dic_common.get(NG_CONDITION_VALUE, None),
        is_proc_linked=dic_common.get(IS_PROC_LINKED, False),
        is_nominal_scale=dic_common.get(IS_NOMINAL_SCALE, True),
        nominal_vars=dic_common.get(NOMINAL_VARS, None),
        traincond_procs=train_cond_procs,
    )

    # use the first end proc as start proc
    if not common.start_proc:
        common.start_proc = array_formval[0].proc_id if array_formval else 0

    cyclic_terms = []
    out_param = DicParam(
        dic_proc_cfgs,
        trace_graph,
        dic_card_orders,
        chart_count,
        common,
        array_formval,
        cyclic_terms,
    )

    # distinct category for filter setting form
    cate_col_ids = []
    for proc in out_param.common.cate_procs or []:
        cate_col_ids += proc.col_ids

    out_param.common.cate_col_ids = cate_col_ids

    if dic_param[COMMON].get(CYCLIC_TERMS):
        out_param.cyclic_terms += dic_param[COMMON][CYCLIC_TERMS]

    # add div and color
    # out_param.add_column_to_array_formval(
    #     [col for col in [out_param.common.color_var, out_param.common.div_by_cat] if col]
    # )

    return out_param


def get_common_config_data(get_visualization_config=True):
    processes = get_all_process_no_nested(with_parent=False)
    # generate english name for process
    for proc_data in processes:
        if not proc_data['name_en']:
            proc_data['name_en'] = to_romaji(proc_data[NAME])
        proc_cols = get_process_columns(proc_data[ID])
        proc_data[IS_USE_DUMMY_DATETIME] = True in [col[IS_GET_DATE] and col[IS_DUMMY_DATETIME] for col in proc_cols]

    procs = [(proc.get(ID), proc.get('shown_name'), proc.get('name_en')) for proc in processes]
    graph_filter_detail_ids = []
    if get_visualization_config:
        graph_filter_detail_ids = get_all_visualizations()

    output_dict = {
        LIST_PROCS: json_dumps(processes),  # use in each page
        PROCS: procs,  # use in jinja of macro
        GRAPH_FILTER_DETAILS: graph_filter_detail_ids,
    }

    return output_dict


def get_end_procs_param(dic_param):
    org_formval = dic_param[ARRAY_FORMVAL]
    dic_common = dic_param[COMMON]
    start_proc = int(dic_common[START_PROC]) if dic_common[START_PROC] else None
    cond_procs = dic_param[COMMON][COND_PROCS]
    dic_params = []

    if start_proc == 0 and len(org_formval) > 1:
        # filter cat_exp_box for no link data
        cat_exp_boxs = {}
        for i in range(1, 3):
            key = f'{CAT_EXP_BOX}{i}'
            if key in dic_common:
                cat_exp_boxs[key] = CfgProcessColumn.get_by_ids([dic_common[key]])[0]
                dic_common.pop(key)

        # zero is no data link
        for proc in org_formval:
            end_proc = proc[END_PROC]
            single_param = {
                TBLS: 1,
                COMMON: deepcopy(dic_param[COMMON]),
                ARRAY_FORMVAL: [{END_PROC: end_proc, GET02_VALS_SELECT: proc[GET02_VALS_SELECT]}],
                TIME_CONDS: deepcopy(dic_param[TIME_CONDS]),
            }
            single_param[COMMON][END_PROC] = {}
            for sensor_id in proc[GET02_VALS_SELECT]:
                single_param[COMMON][END_PROC][int(sensor_id)] = int(proc[END_PROC])
            single_param[COMMON][GET02_VALS_SELECT] = [int(i) for i in proc[GET02_VALS_SELECT]]
            single_param[COMMON][START_PROC] = proc[END_PROC]

            # filter condition proc for no link data
            single_param[COMMON][COND_PROC] = [
                cond_proc for cond_proc in cond_procs if cond_proc[COND_PROC] == end_proc
            ]
            for key, cat_exp_box in cat_exp_boxs.items():
                if cat_exp_box.process_id == int(end_proc):
                    single_param[COMMON][key] = cat_exp_box.id

            single_param[COMMON][IS_PROC_LINKED] = bool(start_proc)
            dic_params.append(single_param)
    else:
        dic_param[COMMON][IS_PROC_LINKED] = bool(start_proc)
        dic_params = [dic_param]
    return dic_params


def update_data_from_multiple_dic_params(orig_dic_param, dic_param):
    updated_keys = [
        ARRAY_PLOTDATA,
        ACT_CELLS,
        UNIQUE_SERIAL,
        MATCHED_FILTER_IDS,
        UNMATCHED_FILTER_IDS,
        NOT_EXACT_MATCH_FILTER_IDS,
        CAT_EXP_BOX,
        ACTUAL_RECORD_NUMBER,
        IMAGES,
        IS_GRAPH_LIMITED,
        EMD_TYPE,
        TIME_CONDS,
        FMT,
        CAT_ON_DEMAND,
        UNIQUE_COLOR,
        COMMON,
        DIV_FROM_TO,
        FILTER_ON_DEMAND,
        FILTER_DATA,
        NG_RATES,
        RL_CATES,
        REMOVED_OUTLIERS,
    ]
    for key in updated_keys:
        if key not in dic_param:
            continue
        if key is FILTER_DATA:
            orig_dic_param[key] = dic_param[key]
        elif type(dic_param[key]) in [int, float, list]:
            if key not in orig_dic_param:
                if isinstance(dic_param[key], list):
                    orig_dic_param[key] = []
                else:
                    orig_dic_param[key] = 0
            # reset term conditions
            if key is TIME_CONDS:
                orig_dic_param[key] = []
            # in case of one is None, error
            if orig_dic_param[key] is not None and dic_param[key] is not None:
                orig_dic_param[key] += dic_param[key]
            else:
                orig_dic_param[key] = None
        elif type(dic_param[key]) in [dict, defaultdict]:
            if key not in orig_dic_param:
                orig_dic_param[key] = {}
            orig_dic_param[key].update(dic_param[key])
        elif isinstance(dic_param[key], bool):
            if key not in orig_dic_param:
                orig_dic_param[key] = False

            if dic_param[key]:
                orig_dic_param[key] = True
        else:
            orig_dic_param[key] = dic_param[key]

    return orig_dic_param


def update_rlp_data_from_multiple_dic_params(orig_dic_param, rlp_dat):
    # update time_conds
    if CYCLIC_TERMS in rlp_dat[COMMON] and CYCLIC_TERMS not in orig_dic_param[COMMON]:
        orig_dic_param[COMMON][CYCLIC_TERMS] = rlp_dat[COMMON][CYCLIC_TERMS]
        # update COMMON.cyclic_terms
        orig_dic_param[TIME_CONDS] = rlp_dat[TIME_CONDS]
    # update emd
    if RL_EMD not in orig_dic_param:
        orig_dic_param[RL_EMD] = rlp_dat[RL_EMD]
    else:
        orig_dic_param[RL_EMD] += rlp_dat[RL_EMD]

    if RL_XAXIS not in orig_dic_param:
        orig_dic_param[RL_XAXIS] = rlp_dat.get(RL_XAXIS, [])
    return orig_dic_param


def bind_ng_rate_to_dic_param(graph_param: DicParam, dic_param):
    if not dic_param:
        return None

    judge_id = graph_param.common.judge_var
    if NG_RATES not in dic_param.keys() or not judge_id:
        return dic_param

    judge_id = int(judge_id)
    judge_data = graph_param.get_col_cfg(judge_id)
    judge_proc_id = judge_data.process_id
    existing_end_cols = graph_param.get_all_end_col_ids()
    existing_end_procs = graph_param.get_all_end_procs(id_only=True)
    # update graph_param with judge column as target sensor
    if judge_id not in existing_end_cols:
        graph_param.add_ng_condition_to_array_formval(as_target_sensor=True)
        if graph_param.common.sensor_cols:
            graph_param.common.sensor_cols.append(judge_id)

    # update dic_param with judge column as target sensor
    if judge_id not in dic_param[COMMON][GET02_VALS_SELECT]:
        dic_param[COMMON][GET02_VALS_SELECT].append(judge_id)
        # update end_proc in dic_param
        dic_param[COMMON][END_PROC][judge_id] = judge_proc_id
        # update array_form_val in dic_param
        if not len(existing_end_procs):
            dic_param[ARRAY_FORMVAL].append({GET02_VALS_SELECT: [judge_id], END_PROC: judge_proc_id})
        else:
            for form_val in dic_param[ARRAY_FORMVAL]:
                if form_val[END_PROC] == judge_proc_id:
                    form_val[GET02_VALS_SELECT].append(judge_id)
                    break
    return dic_param


def get_valid_order_array_formval(array_formvals, order_array_formvals):
    if not order_array_formvals:
        return array_formvals

    dict_sort = {
        f'{dic_val.get(END_PROC)}_{dic_val.get(GET02_VALS_SELECT)}': idx
        for idx, dic_val in enumerate(order_array_formvals)
    }

    output_vals = sorted(
        array_formvals,
        key=lambda dic_val: dict_sort.get(f'{dic_val.get(END_PROC)}_{dic_val.get(GET02_VALS_SELECT)}', 999),
    )

    return output_vals
