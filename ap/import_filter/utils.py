import pandas as pd

from ap.common.constants import COL_NAME, KEY_IMPORT_FILTER
from ap.setting_module.models import CfgProcess


def get_import_filters_from_process(process: CfgProcess) -> list[dict]:
    import_filters = [
        {
            COL_NAME: column.column_name,
            KEY_IMPORT_FILTER: column.filter,
        }
        for column in process.columns
        if column.filter
    ]
    return import_filters


def import_filter_from_df(df: pd.DataFrame, process: CfgProcess) -> pd.DataFrame:
    import_filters = get_import_filters_from_process(process)
    return get_preview_df_with_filter(df, import_filters)


def get_import_filter_for_preview(filter_dict: dict[str, str]) -> list[dict]:
    import_filters = [
        {
            COL_NAME: column,
            KEY_IMPORT_FILTER: value,
        }
        for column, value in filter_dict.items()
        if filter_dict
    ]
    return import_filters


def get_preview_df_with_filter(df: pd.DataFrame, import_filters: list[dict[str, str]]) -> pd.DataFrame:
    for filter_col in import_filters:
        value = filter_col.get(KEY_IMPORT_FILTER)
        column_name = filter_col.get(COL_NAME)
        original_dtype = df[column_name].dtype
        # cast to str to check regex
        df = df[df[column_name].astype(str).str.contains(value, regex=True)]
        df[column_name] = df[column_name].astype(original_dtype)
    return df
