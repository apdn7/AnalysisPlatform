from pandas import DataFrame

from ap.common.constants import KEY_FILTER_FUNCTION, KEY_IMPORT_FILTERS
from ap.import_filter.core import FILTER_METHODS_DEFINITION, ImportFilter
from ap.setting_module.models import CfgProcess


def get_import_filters_from_process(process: CfgProcess) -> list[dict]:
    import_filters = [
        {
            **column.as_dict(),
            'label': column.label,
            'import_filters': [{**rec.as_dict(), 'values': rec.filters} for rec in column.import_filters],
        }
        for column in process.columns
        if column.import_filters
    ]
    return import_filters


def get_function_class_by_name(filter_func_name: str) -> type[ImportFilter]:
    filter_func_class = FILTER_METHODS_DEFINITION.get(filter_func_name, None)
    if filter_func_class is None:
        raise KeyError(f'{filter_func_name} is not a valid filter function')
    return filter_func_class


def import_filter_from_df(df: DataFrame, process: CfgProcess) -> DataFrame:
    import_filters = get_import_filters_from_process(process)
    for filter_col in import_filters:
        for value in filter_col.get(KEY_IMPORT_FILTERS):
            filter_func_class = get_function_class_by_name(value.get(KEY_FILTER_FUNCTION))
            filter_func = filter_func_class.from_kwargs(**value)
            df = filter_func.filter(df, column_cfg=filter_col)
    return df
