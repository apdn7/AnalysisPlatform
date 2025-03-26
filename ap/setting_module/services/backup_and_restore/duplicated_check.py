from __future__ import annotations

import pandas as pd

from ap.setting_module.models import CfgProcessColumn
from ap.trace_data.transaction_model import TransactionData


def get_df_insert_and_duplicated_ids(
    transaction_data: TransactionData,
    *,
    df_insert: pd.DataFrame,
    df_old: pd.DataFrame,
) -> pd.DataFrame:
    """Should return inserting dataframe"""
    if df_old.empty or df_insert.empty:
        return df_insert

    # convert datetime columns (because edge server handle datetime column as string)
    get_date_col = transaction_data.getdate_column.bridge_column_name
    df_insert[get_date_col] = pd.to_datetime(df_insert[get_date_col])
    df_old[get_date_col] = pd.to_datetime(df_old[get_date_col])

    drop_duplicated_columns = get_drop_duplicated_columns(transaction_data)
    df_insert_indexes = df_insert.set_index(drop_duplicated_columns).index
    df_old_indexes = df_old.set_index(drop_duplicated_columns).index

    df_insert = df_insert[~df_insert_indexes.isin(df_old_indexes)]
    return df_insert


def remove_unused_columns_and_add_missing_columns(
    df: pd.DataFrame,
    required_columns: list[str] | pd.Index,
) -> pd.DataFrame:
    columns = set(required_columns)

    # remove redundant
    intersected_columns = columns.intersection(df.columns)
    df = df[list(intersected_columns)]

    # add missing
    missing_columns = columns.difference(df.columns)
    df.loc[:, list(missing_columns)] = None

    return df


def get_drop_duplicated_columns(transaction_data: TransactionData) -> list[str]:
    def is_good_column(column: CfgProcessColumn) -> bool:
        # do not include function column
        if column.function_details:
            return False
        return True

    good_columns = [col.bridge_column_name for col in filter(is_good_column, transaction_data.cfg_process_columns)]

    return good_columns
