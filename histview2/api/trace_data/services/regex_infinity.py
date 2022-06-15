import re
from collections import defaultdict

import numpy as np
import pandas as pd
from pandas import DataFrame

from histview2.common.logger import log_execution_time
from histview2.trace_data.models import Cycle

PATTERN_POS_1 = re.compile(r'^(9{4,}(\.0+)?|9{1,3}\.9{3,}0*)$')
# PATTERN_NEG_1 = re.compile(r'^-(9{4,}(\.0+)?|9{1,3}\.9{3,}0*)$')

# support to identify -9999.9 as -inf
PATTERN_NEG_1 = re.compile(r'^-(9{4,}(\.)?|9{3,}\.9+|9{1,3}\.?9{3,})0*$')

PATTERN_POS_2 = re.compile(r'^((\d)\2{3,}(\.0+)?|(\d)\4{0,2}\.\4{3,}0*)$')
PATTERN_NEG_2 = re.compile(r'^-((\d)\2{3,}(\.0+)?|(\d)\4{0,2}\.\4{3,}0*)$')

PATTERN_3 = re.compile(r'^(-+|0+(\d)\2{3,}(\.0+)?|(.)\3{4,}0*)$')

# regex filter exclude columns
EXCLUDE_COLS = [Cycle.id.key, Cycle.global_id.key, Cycle.time.key, Cycle.is_outlier.key]


@log_execution_time()
def filter_method(df: DataFrame, col_name, idxs, cond_gen_func, return_vals):
    if len(idxs) == 0:
        return df

    target_data = df.loc[idxs, col_name].astype(str)
    if len(target_data) == 0:
        return df

    conditions = cond_gen_func(target_data)
    df.loc[target_data.index, col_name] = np.select(conditions, return_vals, df.loc[target_data.index, col_name])
    return df


@log_execution_time()
def validate_numeric_minus(df: DataFrame, col_name, return_vals):
    num = 0
    if df[col_name].count() == 0:
        return df

    min_val = df[col_name].min()
    if min_val >= num:
        return df

    # return_vals = [pd.NA, pd.NA]
    # idxs = df.eval(f'{col_name} < {num}')
    idxs = pd.eval(f'df["{col_name}"] < {num}')
    df = filter_method(df, col_name, idxs, gen_neg_conditions, return_vals)

    return df


@log_execution_time()
def validate_numeric_plus(df: DataFrame, col_name, return_vals):
    num = 0
    if df[col_name].count() == 0:
        return df

    max_val = df[col_name].max()
    if max_val < num:
        return df

    # return_vals = [pd.NA, pd.NA, pd.NA]
    idxs = pd.eval(f'df["{col_name}"] >= {num}')
    df = filter_method(df, col_name, idxs, gen_pos_conditions, return_vals)

    return df


@log_execution_time()
def validate_string(df: DataFrame, col_name):
    if df[col_name].count() == 0:
        return df

    target_data = df[col_name].astype(str)
    if len(target_data) == 0:
        return df

    conditions = gen_all_conditions(target_data)
    return_vals = ['inf', '-inf', 'inf', '-inf', pd.NA]
    df.loc[target_data.index, col_name] = np.select(conditions, return_vals, df.loc[target_data.index, col_name])

    return df


def gen_pos_conditions(df_str: DataFrame):
    return [df_str.str.contains(PATTERN_POS_1), df_str.str.contains(PATTERN_POS_2), df_str.str.contains(PATTERN_3)]


def gen_neg_conditions(df_str: DataFrame):
    return [df_str.str.contains(PATTERN_NEG_1), df_str.str.contains(PATTERN_NEG_2)]


def gen_all_conditions(df_str: DataFrame):
    return [df_str.str.contains(PATTERN_POS_1),
            df_str.str.contains(PATTERN_NEG_1),
            df_str.str.contains(PATTERN_POS_2),
            df_str.str.contains(PATTERN_NEG_2),
            df_str.str.contains(PATTERN_3)]


@log_execution_time()
def get_changed_value_after_validate(df_before: DataFrame, df_after: DataFrame):
    checked_cols = []
    dic_abnormal = defaultdict(list)

    for col in df_before.columns:
        if not check_validate_target_column(col):
            continue

        checked_cols.append(col)
        original_val = f'__{col}__'
        s_before = df_before[col]
        s_after = df_after[col].drop_duplicates()
        idxs = s_before[~s_before.isin(s_after)].index

        if not len(idxs):
            continue

        df = pd.DataFrame()
        df[col] = df_after[col][idxs]
        df[original_val] = df_before[col][idxs]
        df.drop_duplicates(inplace=True)
        series = df.groupby(col)[original_val].apply(list)

        for idx, vals in series.items():
            dic_abnormal[idx].extend(vals)

    dic_abnormal = {key: list(set(vals)) for key, vals in dic_abnormal.items()}

    return checked_cols, dic_abnormal


@log_execution_time()
def validate_data_with_regex(df):
    # convert data types
    df = df.convert_dtypes()

    # integer cols
    int_cols = df.select_dtypes(include='integer').columns.tolist()
    return_vals = [pd.NA, pd.NA]
    for col in int_cols:
        if not check_validate_target_column(col):
            continue

        df = validate_numeric_minus(df, col, return_vals)
        df = validate_numeric_plus(df, col, return_vals + [pd.NA])

    # float
    float_cols = df.select_dtypes(include='float').columns.tolist()
    return_neg_vals = [float('-inf'), float('-inf')]
    return_pos_vals = [float('inf'), float('inf'), np.NAN]
    for col in float_cols:
        if not check_validate_target_column(col):
            continue

        df = validate_numeric_minus(df, col, return_neg_vals)
        df = validate_numeric_plus(df, col, return_pos_vals)

    # non-numeric cols
    for col in df.columns:
        if not check_validate_target_column(col):
            continue

        if col in int_cols or col in float_cols:
            continue
        df = validate_string(df, col)

    return df


@log_execution_time()
def validate_data_with_simple_searching(df, checked_cols, dic_abnormal):
    # convert data types
    df = df.convert_dtypes()

    for col in checked_cols:
        conditions = []
        results = []
        for result, vals in dic_abnormal.items():
            conditions.append(df[col].isin(vals))
            results.append(result)

        if conditions:
            df[col] = np.select(conditions, results, df[col])

    return df


def check_validate_target_column(col: str):
    if col in EXCLUDE_COLS:
        return False

    if col.startswith(Cycle.time.key):
        return False

    return True
