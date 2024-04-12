from copy import deepcopy

import pandas as pd

from ap.common.common_utils import gen_sql_label
from ap.common.constants import (
    ARRAY_FORMVAL,
    ARRAY_PLOTDATA,
    COMMON,
    COMPARE_TYPE,
    EMD_TYPE,
    END_COL_ID,
    END_PROC_ID,
    EXCLUDED_COLUMNS,
    EXPORT_NG_RATE,
    GET02_VALS_SELECT,
    ID,
    JUDGE_VAR,
    JUMP_WITH_OBJ_ID,
    NG_RATES,
    OBJ_VAR,
    RL_CATE_NAME,
    RL_CATEGORY,
    RL_DATA_COUNTS,
    RL_EMD,
    RL_HIST_LABELS,
    RL_KDE,
    RL_MIN_DATA_COUNT,
    RL_RIDGELINES,
    RL_SENSOR_NAME,
    SENSOR_ID,
    SERIAL_COLUMN,
    TIME_COL,
    X_OPTION,
    EMDType,
    Y,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import cache_jump_key


@log_execution_time()
def convert_emd_data_to_df(dic_param, graph_param):
    df, dic_param, dic_proc_cfgs = gen_emd_df(dic_param, graph_param)

    if dic_param:
        if ARRAY_PLOTDATA in dic_param:
            del dic_param[ARRAY_PLOTDATA]
        dic_param['from_jump_emd'] = True

    return df, dic_param, dic_proc_cfgs


def gen_emd_df(dic_param, graph_param, with_judge=True):
    if graph_param.common.cat_exp:
        # ignore in case has cat exp
        return None, None, None
    div = graph_param.common.div_by_cat
    div_col = None
    if div:
        div_col = graph_param.get_col_cfg(div)
    rlp_emd = {}
    emd_type = dic_param[EMD_TYPE] or EMDType.drift.name
    emd_values = ['EMD|Diff' if diff is True else 'EMD|Drift' for diff in EMDType[emd_type].value]
    ng_rate_data = dic_param.get(NG_RATES, None)
    all_col_ids = []
    all_proc_ids = []
    dic_proc_cfgs = deepcopy(graph_param.dic_proc_cfgs)
    emd_index = 0
    step = 2 if emd_type == EMDType.both.name else 1
    for i, rlp in enumerate(dic_param[ARRAY_PLOTDATA]):
        proc_id = rlp[END_PROC_ID]
        proc_cfg = dic_proc_cfgs[proc_id]
        col = proc_cfg.get_col(rlp[SENSOR_ID])
        origin_name = col.shown_name
        emd_idx = emd_index
        for emd_value in emd_values:
            index = 0
            col_name = f'{origin_name}|{emd_value}'
            if dic_param[EMD_TYPE] == EMDType.both.name and 'Diff' in emd_value:
                col = proc_cfg.copy_new_col_cfg(col.id)
            proc_cfg.modify_col_name(col.id, col_name)

            all_col_ids.append(col.id)
            all_proc_ids.append(proc_id)

            sql_label = gen_sql_label(col.id, col.shown_name)
            rlp_emd[sql_label] = []
            for rl in rlp[RL_RIDGELINES]:
                if rl[RL_DATA_COUNTS] < RL_MIN_DATA_COUNT or not len(rl[RL_KDE][RL_HIST_LABELS]):
                    rlp_emd[sql_label].append(None)
                else:
                    rlp_emd[sql_label].append(dic_param[RL_EMD][emd_idx][index])
                    index += 1
            emd_idx += 1

        emd_index += step

        if dic_param[COMMON][COMPARE_TYPE] == RL_CATEGORY:
            div_name = gen_sql_label(div, div_col.shown_name)
            rlp_emd[div_name] = [ridge[RL_CATE_NAME] for ridge in rlp[RL_RIDGELINES]]  # TODO div_name maybe __1__name__
            dic_param[COMMON][X_OPTION] = 'INDEX'
            dic_param[COMMON][SERIAL_COLUMN] = [1]  # TODO : serial
            rlp_emd[TIME_COL] = [None] * len(rlp_emd[div_name])
            rlp_emd[f'{TIME_COL}_{proc_id}'] = rlp_emd[TIME_COL]
        else:
            rlp_emd[TIME_COL] = [
                ridge[RL_CATE_NAME].split(' | ')[0] for ridge in rlp[RL_RIDGELINES] if ridge[RL_CATE_NAME]
            ]
            rlp_emd[f'{TIME_COL}_{proc_id}'] = rlp_emd[TIME_COL]
            dic_param[COMMON][X_OPTION] = 'TIME'

    if with_judge and ng_rate_data:
        for judge in ng_rate_data:
            judge_col_name = f'{judge[RL_SENSOR_NAME]}|{EXPORT_NG_RATE}'
            # modify ng_rate column name
            judge_proc_id = judge[END_PROC_ID]
            proc_cfg = dic_proc_cfgs[judge_proc_id]
            judge_col = proc_cfg.copy_new_col_cfg(judge[END_COL_ID], dummy_idx=1_000_001)
            # reassign id of judge in ng_rates
            judge[END_COL_ID] = judge_col.id
            proc_cfg.modify_col_name(judge_col.id, judge_col_name)
            judge_label = gen_sql_label(judge_col.id, judge_col.shown_name)

            rlp_emd[judge_label] = judge[Y]
            # update judge col id in graph_params
            graph_param.common.judge_var = judge_col.id
            dic_param[COMMON][JUDGE_VAR] = judge_col.id
            all_col_ids.append(judge_col.id)
            all_proc_ids.append(judge_proc_id)

    if TIME_COL in rlp_emd and len(rlp_emd[TIME_COL]):
        rlp_emd[ID] = list(range(1, len(rlp_emd[TIME_COL]) + 1))

    # make dic_param ArrayFromVal
    dic_param[ARRAY_FORMVAL] = []
    for i, proc_id in enumerate(all_proc_ids):
        col_id = all_col_ids[i]
        dic_param[ARRAY_FORMVAL].append({'GET02_VALS_SELECT': [col_id], 'end_proc': proc_id})

    df = pd.DataFrame(rlp_emd)

    return df, dic_param, dic_proc_cfgs


@log_execution_time()
def get_jump_emd_data(dic_form):
    jump_key = dic_form.get('jump_key', [None])[0]
    cache_dic_param, graph_param, df = cache_jump_key(jump_key)

    if cache_dic_param is None:
        return cache_dic_param, graph_param, df

    objective_var = dic_form.get(JUMP_WITH_OBJ_ID, [None])[0]
    if not objective_var:
        # 'null': not objective_var in query param
        objective_var = dic_form.get(OBJ_VAR, [None])[0]
    if objective_var:
        cache_dic_param[COMMON][OBJ_VAR] = objective_var
        graph_param.common.objective_var = int(objective_var)

    excluded_columns = [int(col) for col in dic_form.get(EXCLUDED_COLUMNS, [''])[0].split(',') if col]
    if excluded_columns:
        cache_dic_param[ARRAY_FORMVAL] = [
            val for val in cache_dic_param[ARRAY_FORMVAL] if val[GET02_VALS_SELECT][0] not in excluded_columns
        ]
        graph_param.common.sensor_cols = [col for col in graph_param.common.sensor_cols if col not in excluded_columns]

    return cache_dic_param, graph_param, df
