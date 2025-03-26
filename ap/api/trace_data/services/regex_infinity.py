import re
from collections import defaultdict
from typing import Any, Callable

import numpy as np
import pandas as pd
from pandas import DataFrame

from ap.common.constants import ID, INDEX, ROWID, TIME_COL
from ap.common.logger import log_execution_time
from ap.common.pandas_helper import append_series, isin_with_na

# Refer <https://trello.com/c/YtbtrFUk/213-13e-import-data-with-column-name-is-empty>

PATTERN_POS_1 = re.compile(r'^(9{4,}(\.0+)?|9{1,3}\.9{3,}0*)$')
# PATTERN_NEG_1 = re.compile(r'^-(9{4,}(\.0+)?|9{1,3}\.9{3,}0*)$')

# support to identify -9999.9 as -inf
PATTERN_NEG_1 = re.compile(r'^-(9{4,}(\.)?|9{3,}\.9+|9{1,3}\.?9{3,})0*$')

PATTERN_POS_2 = re.compile(r'^((\d)\2{3,}(\.0+)?|([^36])\4{0,2}\.\4{3,}0*)$')
# PATTERN_POS_2 = re.compile(r'^\d\.[0-2457-9]+$')

PATTERN_NEG_2 = re.compile(r'^-((\d)\2{3,}(\.0+)?|([^36])\4{0,2}\.\4{3,}0*)$')

# This pattern uses for real numbers as well.
# Real numbers such as 222222, 333333, etc will be converted to None? But currently it doesn't
# You should ask tinhtn19 for more information.
PATTERN_3 = re.compile(r'^(-+|0+(\d)\2{3,}(\.0+)?|(.)\3{4,}0*)$')

# regex filter exclude columns
EXCLUDE_COLS = [ID, TIME_COL, INDEX, ROWID]


@log_execution_time()
def filter_method(
    df: DataFrame,
    col_name: str,
    selected: pd.Series,
    cond_gen_func: Callable[[pd.Series], list[pd.Series]],
    return_vals: list[Any],
):
    # there is no selected records
    if not selected.any():
        return df

    target_data = df[col_name].astype(pd.StringDtype())
    conditions = cond_gen_func(target_data)
    if len(conditions) != len(return_vals):
        raise ValueError(
            f'Length of conditions ({len(conditions)}) and return values ({len(return_vals)}) does not match',
        )

    for is_replace, replace_value in zip(conditions[::-1], return_vals[::-1]):
        df.loc[is_replace & selected, col_name] = replace_value

    return df


@log_execution_time()
def validate_numeric_minus(df: DataFrame, col_name, return_vals):
    num = 0
    # if dataframe is all None, skip
    if df[col_name].isna().all():
        return df

    # minimum values higher than 0, skip
    if df[col_name].min() >= num:
        return df

    # return_vals = [pd.NA, pd.NA]
    selected = df[col_name] < num
    df = filter_method(df, col_name, selected, gen_neg_conditions, return_vals)

    return df


@log_execution_time()
def validate_numeric_plus(df: DataFrame, col_name, return_vals):
    num = 0
    # if dataframe is all None, skip
    if df[col_name].isna().all():
        return df

    # maximum value less than 0, skip
    if df[col_name].max() < num:
        return df

    # return_vals = [pd.NA, pd.NA, pd.NA]
    selected = df[col_name] >= num
    df = filter_method(df, col_name, selected, gen_pos_conditions, return_vals)

    return df


@log_execution_time()
def validate_string(df: DataFrame, col_name):
    # if dataframe is all None, skip
    if df[col_name].isna().all():
        return df

    target_data = df[col_name].astype(pd.StringDtype())
    conditions = gen_all_conditions(target_data)

    or_conditions = pd.Series(False, index=target_data.index)
    for cond in conditions:
        or_conditions |= cond
    df.loc[or_conditions, col_name] = pd.NA

    return df


def gen_pos_conditions(df_str: pd.Series) -> list[pd.Series]:
    return [
        df_str.str.contains(PATTERN_POS_1),
        df_str.str.contains(PATTERN_POS_2),
        df_str.str.contains(PATTERN_3),
    ]


def gen_neg_conditions(df_str: pd.Series) -> list[pd.Series]:
    return [
        df_str.str.contains(PATTERN_NEG_1),
        df_str.str.contains(PATTERN_NEG_2),
    ]


def gen_all_conditions(df_str: pd.Series) -> list[pd.Series]:
    return [
        df_str.str.contains(PATTERN_POS_1),
        df_str.str.contains(PATTERN_NEG_1),
        df_str.str.contains(PATTERN_POS_2),
        df_str.str.contains(PATTERN_NEG_2),
        df_str.str.contains(PATTERN_3),
    ]


@log_execution_time()
def get_changed_value_after_validate(
    df_before: pd.DataFrame,
    df_after: pd.DataFrame,
) -> tuple[list[str], dict[Any, pd.Series]]:
    checked_cols = []
    dic_abnormal = defaultdict(pd.Series)

    for col in df_before.columns:
        if not check_validate_target_column(col):
            continue

        checked_cols.append(col)
        original_val = f'__{col}__'

        # FIXME: this function might not be correct
        # Normally we would convert `df_before == df_after`. Why we need to check `df_before is in df_after`?

        s_before = df_before[col]
        s_after = df_after[col].drop_duplicates()
        idxs = s_before[~s_before.isin(s_after)].index

        if not len(idxs):
            continue

        df = pd.DataFrame()
        df[col] = df_after[col][idxs]
        df[original_val] = df_before[col][idxs]
        df = df.drop_duplicates()

        for key, series in df.groupby(col, dropna=False)[original_val]:
            dic_abnormal[key] = append_series(dic_abnormal[key], series)

    return checked_cols, dic_abnormal


@log_execution_time()
def validate_data_with_regex(df):
    # integer cols
    int_cols = df.select_dtypes(include=['int32', 'int64']).columns
    float_cols = df.select_dtypes(include=['float32', 'float64']).columns
    return_vals = [np.nan, np.nan]
    for col in int_cols:
        if not check_validate_target_column(col):
            continue

        df = validate_numeric_minus(df, col, return_vals)
        df = validate_numeric_plus(df, col, return_vals + [np.nan])

    # float
    return_neg_vals = [float('-inf'), float('-inf')]
    return_pos_vals = [float('inf'), float('inf'), np.nan]
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
def validate_data_with_simple_searching(
    df: pd.DataFrame,
    checked_cols: list[str],
    dic_abnormal: dict[Any, pd.Series],
) -> pd.DataFrame:
    for col in checked_cols:
        conditions = []
        results = []
        for result, vals in dic_abnormal.items():
            should_append_condition = False

            # if float then only get result is not NA
            if pd.api.types.is_float_dtype(df[col]):
                if not pd.isna(result):
                    should_append_condition = True
            elif pd.isna(result):
                should_append_condition = True

            if should_append_condition:
                conditions.append(isin_with_na(df[col], vals))
                results.append(result)

        for cond, result in zip(conditions[::-1], results[::-1]):
            df.loc[cond, col] = result

    return df


def check_validate_target_column(col: str):
    if col in EXCLUDE_COLS:
        return False

    if col.startswith(TIME_COL):
        return False

    return True
