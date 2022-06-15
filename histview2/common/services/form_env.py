# dic_formの形式をparseして以下を実施
# TBLS(テーブルの数)を取得し、配列を初期化
# 1〜配列数分のarray_formvalの配列を初期化
# 要素はNUM_ELEMENTS他
import json
import logging
import re

from histview2.common.common_utils import as_list
from histview2.common.constants import *
from histview2.common.services.request_time_out_handler import request_timeout_handling
from histview2.common.yaml_utils import BasicConfigYaml
from histview2.setting_module.services.process_config import get_all_process_no_nested, get_all_visualizations
from histview2.trace_data.schemas import DicParam, CommonParam, ConditionProc, CategoryProc, EndProc, \
    ConditionProcDetail

logger = logging.getLogger(__name__)

# common key receive from client
common_startwith_keys = ('start_proc', 'START_DATE', 'START_TIME', 'END_DATE', 'END_TIME',
                         CATE_VARIABLE, CATE_VALUE_MULTI, COMPARE_TYPE, 'isRemoveOutlier', 'client_timezone',
                         CYCLIC_DIV_NUM, CYCLIC_INTERVAL, CYCLIC_WINDOW_LEN,
                         HM_STEP, HM_MODE, HM_TRIM, HM_FUNCTION_REAL, HM_FUNCTION_CATE,
                         X_OPTION, SERIAL_COLUMN, SERIAL_ORDER, SERIAL_PROCESS, THRESHOLD_BOX, CAT_EXP_BOX,
                         IS_VALIDATE_DATA, DIC_CAT_FILTERS, TEMP_X_OPTION, TEMP_SERIAL_ORDER, TEMP_SERIAL_COLUMN,
                         TEMP_SERIAL_PROCESS, TEMP_CAT_EXP, TEMP_CAT_PROCS, DIV_BY_CAT, DIV_BY_DATA_NUM, COLOR_VAR,
                         CYCLIC_DIV_NUM, CYCLIC_WINDOW_LEN, CYCLIC_INTERVAL, MATRIX_COL, COLOR_ORDER,
                         IS_EXPORT_MODE, IS_IMPORT_MODE, VAR_TRACE_TIME, TERM_TRACE_TIME, CYCLIC_TRACE_TIME, TRACE_TIME)

conds_startwith_keys = ('filter-', 'cond_', 'machine_id_multi')

category_startwith_keys = (CATE_PROC, GET02_CATE_SELECT)

multiple_selections = (GET02_VALS_SELECT, GET02_CATE_SELECT)


# フォームの環境変数の解析


def parse(dic_form):
    # TBLSがキー存在しない場合(index.pyを直打ちの場合)
    if "TBLS" not in dic_form:
        return {"TBLS": 1, "ARRAY_FORMVAL": []}

    # num_tbls = dic_form["TBLS"].value
    num_tbls = dic_form["TBLS"]
    dic_parsed = {"TBLS": num_tbls}
    array_formval = []
    # まずは空のキーで辞書の配列を初期化
    for idx in range(int(num_tbls)):
        array_formval.append({})

    # NUM_ELEMENT + 数字の形式のキーを取得
    for key in dic_form.keys():

        # array_value = dic_form.getlist(key)

        array_value = []
        raw_value = dic_form[key]
        if raw_value.__class__.__name__ == 'list':
            array_value.extend(raw_value)
        else:
            array_value.append(raw_value)

        value = array_value[0]
        # Keyの文字列を解析
        m = re.match("(^.+)(\d+)$", key)
        m2 = re.match(".+_multi\d+$", key)
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


@request_timeout_handling()
def parse_multi_filter_into_one(dic_form):
    # count select cols of endpoint
    num_tbls = len([key for key in dic_form if key.startswith('end_proc')])

    dic_parsed = {TBLS: num_tbls, COMMON: {}}
    cond_procs = [{}]
    cate_procs = [{}]
    array_formval = []

    # まずは空のキーで辞書の配列を初期化
    for idx in range(int(num_tbls)):
        array_formval.append({})

    # NUM_ELEMENT + 数字の形式のキーを取得
    for key in dic_form.keys():
        raw_value = dic_form[key]

        value = remove_const_keyword(raw_value, [SELECT_ALL, None, ''])
        # filter-line-machine-id
        if key.startswith('filter-line-machine-id') and value == []:
            value = [NO_FILTER]

        # Keyの文字列を解析
        m = re.match("(.*?)(\d+)$", key)

        # common keys
        if key.startswith(common_startwith_keys):
            if key == DIC_CAT_FILTERS:
                dic_cat_filters = json.loads(value)
                if dic_cat_filters:
                    dic_parsed[COMMON][key] = {int(col): sorted(vals) for col, vals in dic_cat_filters.items()}
            elif key in (TEMP_CAT_EXP, TEMP_CAT_PROCS):
                dic_parsed[COMMON][key] = json.loads(value)
            else:
                dic_parsed[COMMON][key] = value

        elif key.startswith(conds_startwith_keys):
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            for i in range(matched_idx - len(cond_procs) + 1):
                cond_procs.append({})
            cond_procs[matched_idx][matched_key] = value
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
            edit_value = remove_const_keyword(value, [NO_FILTER],
                                              key.startswith(multiple_selections))
            array_formval[matched_idx][matched_key] = edit_value

    # end procs
    dic_parsed[ARRAY_FORMVAL] = [ele for ele in array_formval if ele and ele.get(GET02_VALS_SELECT)]
    dic_parsed[TBLS] = len(dic_parsed[ARRAY_FORMVAL])

    # cond_procs
    dic_parsed[COMMON][COND_PROCS] = [ele for ele in cond_procs if ele]

    # category procs
    dic_parsed[COMMON][CATE_PROCS] = [ele for ele in cate_procs if ele and ele.get(GET02_CATE_SELECT)]

    dic_parsed[TBLS] = len(dic_parsed[ARRAY_FORMVAL])

    # cond_procs
    dic_parsed[COMMON][OBJ_VAR] = dic_form.get(OBJ_VAR) or []

    # set default start process
    if START_PROC not in dic_parsed[COMMON]:
        dic_parsed[COMMON][START_PROC] = dic_parsed[ARRAY_FORMVAL][0].get(END_PROC)

    return dic_parsed


def parse_form_param_stratified_plot(dic_form):
    # count select cols of endpoint
    num_tbls = len([key for key in dic_form if key.startswith('end_proc')])

    # num_conds = max([key for key in dic_form if key.startswith('cond_proc')])
    common_key = "COMMON"
    dic_parsed = {"TBLS": num_tbls, common_key: {}}
    # dic_parsed[common_key][cond_procs_key] = [{}] * num_conds
    cond_procs = [{}]
    array_formval = []

    # まずは空のキーで辞書の配列を初期化
    for idx in range(int(num_tbls)):
        array_formval.append({})

    # NUM_ELEMENT + 数字の形式のキーを取得
    for key in dic_form.keys():

        # raw_value = dic_form.getlist(key)
        raw_value = dic_form[key]

        if isinstance(raw_value, (list, tuple)):
            if len(raw_value) > 1:
                value = raw_value
            else:
                value = raw_value[0]
        else:
            value = raw_value

        # Keyの文字列を解析
        m = re.match("(^.+)(\d+)$", key)

        # common keys
        if key.startswith(common_startwith_keys):

            # condition
            if m:
                matched_key = m.group(1)
                matched_idx = int(m.group(2)) - 1
                for i in range(matched_idx - len(cond_procs) + 1):
                    cond_procs.append({})
                cond_procs[matched_idx][matched_key] = value
            else:
                dic_parsed[common_key][key] = value

            continue

        # end proc
        if m:
            matched_key = m.group(1)
            matched_idx = int(m.group(2)) - 1
            # debugstr = "matched_key= {}\n".format(matched_key)
            # debugstr += "matched_idx= {}\n".format(matched_idx)
            # 昔の不要な環境変数が残っている場合は無視
            for i in range(matched_idx - len(array_formval) + 1):
                array_formval.append({})
            # キーの最後に"_multi"がついている場合は配列として扱う
            # マルチセレクタなどで使う
            array_formval[matched_idx][matched_key] = value

    # end procs
    dic_parsed["ARRAY_FORMVAL"] = [ele for ele in array_formval if ele and ele.get('GET02_VALS_SELECT')]
    dic_parsed['TBLS'] = len(dic_parsed["ARRAY_FORMVAL"])

    # cond_procs
    dic_parsed[common_key]["cond_procs"] = [ele for ele in cond_procs if ele]
    # dic_parsed["debugstr"] = debugstr
    return dic_parsed


def parse_request_params(request):
    """
    Parse request parameters of Flask HTTP request to a dictionary.
    Note: This function support parsing multiple values of keys.

    :param request: HTTP request in Flask
    :return: Dictionary of key-value of request parameter.
    """
    dic_form = {}
    for key in request.args.keys():
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


def bind_condition_procs(dic_param):
    # condition
    cond_procs = []
    for dic_cond in dic_param[COMMON][COND_PROCS]:
        proc_id = dic_cond[COND_PROC]
        if not proc_id:
            continue

        if isinstance(proc_id, list):
            proc_id = ''.join(proc_id)

        # remove invalid
        if not str(proc_id).isnumeric():
            continue

        cond_details = []
        for key, vals in dic_cond.items():
            if key == COND_PROC:
                continue

            cond_details.append(ConditionProcDetail(vals))

        cond_proc = ConditionProc(proc_id, cond_details)
        cond_procs.append(cond_proc)

    return cond_procs


def bind_dic_param_to_class(dic_param):
    dic_common = dic_param[COMMON]

    # chart count
    chart_count = dic_param[TBLS]

    # conditions
    cond_procs = bind_condition_procs(dic_param)

    # categories
    cate_procs = []
    if dic_common.get(CATE_PROCS):
        cate_procs = [CategoryProc(proc.get(CATE_PROC), proc[GET02_CATE_SELECT]) for proc in dic_common[CATE_PROCS]]

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
    # common
    common = CommonParam(dic_common[START_PROC], dic_common[START_DATE], dic_common[START_TM], dic_common[END_DATE],
                         dic_common[END_TM], cond_procs, cate_procs,
                         hm_step=dic_common.get(HM_STEP),
                         hm_mode=dic_common.get(HM_MODE),
                         hm_function_real=dic_common.get(HM_FUNCTION_REAL),
                         hm_function_cate=dic_common.get(HM_FUNCTION_CATE),
                         hm_trim=dic_common.get(HM_TRIM),
                         client_timezone=dic_common.get(CLIENT_TIMEZONE),
                         x_option=dic_common.get(X_OPTION),
                         serial_processes=as_list(dic_common.get(SERIAL_PROCESS)),
                         serial_columns=as_list(dic_common.get(SERIAL_COLUMN)),
                         serial_orders=as_list(dic_common.get(SERIAL_ORDER)),
                         threshold_boxes=as_list(dic_common.get(THRESHOLD_BOX)),
                         cat_exp=cat_exps,
                         is_validate_data=dic_common.get(IS_VALIDATE_DATA),
                         objective_var=objective_var,
                         color_var=dic_common.get(COLOR_VAR),
                         div_by_data_number=dic_common.get(DIV_BY_DATA_NUM),
                         div_by_cat=dic_common.get(DIV_BY_CAT),
                         cyclic_div_num=dic_common.get(CYCLIC_DIV_NUM),
                         cyclic_window_len=dic_common.get(CYCLIC_WINDOW_LEN),
                         cyclic_interval=dic_common.get(CYCLIC_INTERVAL),
                         cyclic_terms=dic_common.get(CYCLIC_TERMS),
                         compare_type=dic_common.get(COMPARE_TYPE)
                         )

    # array_formval
    array_formval = [EndProc(proc.get(END_PROC), proc[GET02_VALS_SELECT]) for proc in dic_param[ARRAY_FORMVAL]]

    if not common.start_proc:
        common.start_proc = array_formval[0].proc_id

    cyclic_terms = []
    out_param = DicParam(chart_count, common, array_formval, cyclic_terms)

    return out_param


def get_common_config_data(get_visualization_config=True):
    processes = get_all_process_no_nested()
    procs = [(proc.get('id'), proc.get('name')) for proc in processes]
    graph_filter_detail_ids = []
    if get_visualization_config:
        graph_filter_detail_ids = get_all_visualizations()

    output_dict = {
        'list_procs': json.dumps(processes),  # use in each page
        'procs': procs,  # use in jinja of macro
        'graph_filter_detail_ids': graph_filter_detail_ids,
    }

    # get title
    basic_config_yml = BasicConfigYaml()
    title = BasicConfigYaml.get_node(basic_config_yml.dic_config, ['info', 'title'], '')
    output_dict.update({
        "title": title,
    })

    return output_dict


def bind_multiple_end_proc_rlp(dic_form):
    multiple_dic_form = []
    common_dic_form = dic_form.copy()
    remove_keys = []
    for key in common_dic_form:
        # find end_proc from dic_form
        if (key.startswith('end_proc')):
            [proc_idx] = re.findall('[0-9]+', key)
            start_proc_key = START_PROC + str(proc_idx)
            get_val_selects = GET02_VALS_SELECT + str(proc_idx)
            dic_form_item = {
                key: common_dic_form[key],
                START_PROC: common_dic_form.get(start_proc_key) or common_dic_form.get(START_PROC),
                get_val_selects: common_dic_form[get_val_selects]
            }
            multiple_dic_form.append(dic_form_item)
            remove_keys.append(key)
            remove_keys.append(start_proc_key)
            remove_keys.append(get_val_selects)

    common_dic_form = {k: v for k, v in common_dic_form.items() if k not in remove_keys}
    for dform in multiple_dic_form:
        dform.update(common_dic_form)

    return multiple_dic_form
