from __future__ import annotations

import logging
from typing import Any, Sequence, TypeVar

import pandas as pd

from ap.common.constants import NA_STR

logger = logging.getLogger(__name__)

T = TypeVar('T')


def drop_dataframe_duplicated_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicated columns in pandas DataFrame"""
    return df.loc[:, ~df.columns.duplicated()]


def to_string_with_na_adjust(value: Any, accept_none=False) -> str | None:
    """Convert value to string, return `NA_STR` if `pd.isna` is True"""
    if accept_none and pd.isna(value):
        return value
    return NA_STR if pd.isna(value) else str(value)


def append_series(lhs: pd.Series[T], rhs: Any) -> pd.Series[T]:
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
    """Assign each group in bins by specific label
    To simplify, this function is the faster version of:
    >>> for start, end, label in zip(bins[:-1], bins[1:], labels):
    >>>     df.loc[(df[by] >= start) & (df[by] < end), label_column] = label
    But it is much safer, as it also check datatype of `df[by]` and `bins`
    as well as the length of `bins` and `labels`
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
