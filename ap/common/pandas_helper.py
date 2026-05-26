from __future__ import annotations

from collections.abc import Sequence
from typing import Any, TypeVar

import numpy as np
import pandas as pd
from loguru import logger

from ap.common.constants import NA_STR

T = TypeVar('T')


def drop_dataframe_duplicated_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicated columns in pandas DataFrame"""
    return df.loc[:, ~df.columns.duplicated()]


def to_string_with_na_adjust(value: Any, accept_none=False) -> str | None:
    """Convert value to string, return `NA_STR` if `pd.isna` is True"""
    if accept_none and pd.isna(value):
        return value
    return NA_STR if pd.isna(value) else str(value)


def append_series[T](lhs: pd.Series[T], rhs: Any) -> pd.Series[T]:
    """Append element into series, `rhs` can be single element, list, or pd.Series.
    This helper method that we don't need to always convert to Series or use deprecated `append` method
    """
    if not isinstance(rhs, pd.Series):
        rhs = pd.Series(rhs)

    if lhs.empty:
        return rhs
    if rhs.empty:
        return lhs

    return pd.concat([lhs, rhs])


def isin_with_na(series: pd.Series, searching_values: pd.Series | Sequence[Any]) -> pd.Series:
    """Due to a bug in series.isin doesn't work with NA, we need separate method for it"""
    if not isinstance(searching_values, pd.Series):
        logger.error('Only support pd.Series, please change input values')
        searching_values = pd.Series(searching_values)
    if searching_values.hasnans:
        return series.isna() | series.isin(searching_values.dropna())
    return series.isin(searching_values.dropna())


def assign_group_labels_for_dataframe(
    df: pd.DataFrame,
    *,
    by: str,
    label_column: str,
    bins: Sequence[Any],
    labels: list[str],
):
    """Assign each group in bins by specific label. To simplify, this function is the faster version of:

    >>> for start, end, label in zip(bins[:-1], bins[1:], labels): # doctest: +SKIP
    >>>     df.loc[(df[by] >= start) & (df[by] < end), label_column] = label # doctest: +SKIP
    But it is much safer, as it also check datatype of `df[by]` and `bins`
    as well as the length of `bins` and `labels`

    >>> df = pd.DataFrame({'x': [1, 2, 3, 4, 5, 6]})
    >>> assign_group_labels_for_dataframe(
    ...     df,
    ...     by='x',
    ...     label_column='label',
    ...     bins=[1, 3, 5, 7],
    ...     labels=['1 to 3', '3 to 5', '5 to 7'],
    ... )
       x   label
    0  1  1 to 3
    1  2  1 to 3
    2  3  3 to 5
    3  4  3 to 5
    4  5  5 to 7
    5  6  5 to 7

    """
    # Assign empty label column first.
    df[label_column] = pd.Series(dtype=pd.StringDtype())

    if df.empty:
        return df

    # make sure that type in `df[by]` and `bins` must be the same
    # otherwise, we cannot divide them into bins
    if len(bins):
        bin_value = bins.dtype if hasattr(bins, 'dtype') else type(bins[0])
        if bin_value != df[by].dtype:
            logger.error(f"`sort_values`'s type and `df[by]`'s type do not match: {bin_value}, {df[by].dtype}")

    # The number of sorted values must equal or higher than the number of labels
    if len(bins) != len(labels) + 1:
        logger.error('Expect `len(sorted_values) != len(labels) + 1`, this is a bug, please fix !!!')

    df[label_column] = pd.cut(
        x=df[by],
        bins=bins,
        labels=labels,
        right=False,  # we assign labels by [start, end). So, this must be `False`
        ordered=False,
    ).astype(pd.StringDtype())

    return df


def check_if_array_is_repeating(array: np.ndarray) -> bool:
    """

    :param array: numpy array to check
    :return:
    array_has_same_value (bool): True if `array` has the same value, False otherwise
    """
    array_has_same_value = False
    if array.shape[0] == 0 or (array[0] == array).all():
        array_has_same_value = True
    return array_has_same_value


def pandas_concat_with_filter_empty(dfs: list[pd.DataFrame]) -> pd.DataFrame:
    """Concat multiple dataframe into a single one. Avoiding empty ones.

    >>> pandas_concat_with_filter_empty([])
    Empty DataFrame
    Columns: []
    Index: []
    >>> pandas_concat_with_filter_empty([pd.DataFrame()])
    Empty DataFrame
    Columns: []
    Index: []
    >>> pandas_concat_with_filter_empty([pd.DataFrame({'a': [1]})])
       a
    0  1
    >>> pandas_concat_with_filter_empty([pd.DataFrame({'a': [1]}), pd.DataFrame({'a': [2]})])
       a
    0  1
    1  2
    """
    if not len(dfs):
        return pd.DataFrame()

    columns = dfs[0].columns

    dfs = [df for df in dfs if len(df)]
    if not dfs:
        return pd.DataFrame(columns=columns)

    if len(dfs) == 1:
        return dfs[0]

    return pd.concat(dfs, ignore_index=True)
