from enum import Enum, auto
from typing import Dict, List, Tuple, Union

# from bridge.models.model_utils import TableColumn
# from histview2.common.constants import DataTypeDB, ServerType
PARAM_SYMBOL = '?'


class OrderBy(Enum):
    DESC = auto()
    ASC = auto()


class SqlComparisonOperator(Enum):
    EQUAL = '='
    NOT_EQUAL = '!='
    LESS_THAN = '<'
    GREATER_THAN = '>'
    LESS_THAN_OR_EQ = '<='
    GREATER_THAN_OR_EQ = '>='
    IS_NULL = 'IS NULL'  # TODO: is null, like, between have separate sql syntax, have not test yet. be careful
    LIKE = 'LIKE'
    BETWEEN = 'BETWEEN'
    IN = 'IN'  # Ex: cls.Columns.status.name: [(SqlComparisonOperator.IN, tuple(job_statuses))]


class AggregateFunction(Enum):
    # Example
    # dict_aggregate_function = {'cycle_id': (AggregateFunction.MAX.value, 'cycle_id')}
    # ==> select max(cycle_id) as "cycle_id"
    # dict_aggregate_function = {'time_1': (AggregateFunction.TO_CHAR.value, 'time', 'yyyymmdd')}
    # ==> select TO_CHAR(time, 'yyyymmdd') as "time_1"
    MAX = 'MAX'
    TO_CHAR = 'TO_CHAR'
    DISTINCT = 'DISTINCT'


def strip_all_quote(instr):
    return str(instr).strip("'").strip('"')


def _gen_condition_str(dic_conditions: Dict[str, Tuple], is_or_operation=False):
    """

    :param dic_conditions: should follow the following format
             {'column name' : ((SqlComparisonOperator.EQUAL, value), (SqlComparisonOperator.LESS_THAN, value))}
    :param is_or_operation:
    :return:
    """
    # draft, replace for gen_condition_str
    dic_model_cols = {col: val for col, val in dic_conditions.items()}

    sql_condition = []
    params = []
    for col, conditions in dic_model_cols.items():
        if not isinstance(conditions, (tuple, list)):
            if conditions is None:
                sql_condition.append(f'"{col}" IS NULL')
            else:
                sql_condition.append(f'"{col}" {SqlComparisonOperator.EQUAL.value} {PARAM_SYMBOL}')
                params.append(check_none_value(conditions))
        else:
            for condition in conditions:
                operator, value = condition
                sql_condition.append(f'"{col}" {operator.value} {PARAM_SYMBOL}')
                params.append(check_none_value(value))

    or_and_ope = 'AND'
    if is_or_operation:
        or_and_ope = 'OR'

    sql = f' {or_and_ope} '.join(sql_condition)

    return sql, params


def gen_update_value_str(model_cls, dic_values: Dict):
    model_columns = model_cls.Columns.get_column_names()
    parameter_marker = model_cls.get_parameter_marker()  # %s
    sql = ','.join(
        [f'"{col}" = {parameter_marker}' for col in dic_values.keys() if col in model_columns]
    )
    param = [value for col, value in dic_values.items() if col in model_columns]
    return sql, param


def check_none_value(value):
    """
    return 'NULL' if value is None
    """
    if value is None or value == '':
        return 'NULL'
    return value


def gen_insert_col_str(column_names: Union[Dict, List] = None):
    """
    Add double quotes to each name of column existing in model columns and combine to string
    :param column_names:
    """
    return ','.join([add_double_quote(col) for col in column_names])


def gen_insert_val_str(dic_values: Dict):
    """
    :param dic_values:
    """
    return tuple([val for col, val in dic_values.items()])


def gen_insert_param_str(dic_values: Dict):
    return ','.join([PARAM_SYMBOL for _ in dic_values])


def add_single_quote(val):
    """
    add single quote
    :param val:
    :return:
    """
    if not val:
        return val

    return f"'{val}'"


def add_double_quote(val):
    """
    add single quote
    :param val:
    :return:
    """
    if not val:
        return val

    return f'"{val}"'


# def add_quote_to_values(model_cls, dic_values):
#     """
#     add quote to non-numeric values
#     :param model_cls:
#     :param dic_values:
#     :return:
#     """
#     dic_output = {}
#     cols: TableColumn = model_cls.Columns
#     for col, val in dic_values.items():
#         if cols[col] not in cols:
#             continue
#
#         if cols[col].data_type not in [DataTypeDB.INTEGER, DataTypeDB.REAL, DataTypeDB.BOOLEAN, DataTypeDB.BLOB]:
#             val = add_single_quote(val)
#
#         dic_output[col] = val
#
#     return dic_output


def gen_insert_sql(table_name, dic_values):
    """
    generate insert sql
    :param table_name
    :param dic_values:
    :return:
    """

    col_str = gen_insert_col_str(dic_values)
    val_str = gen_insert_param_str(dic_values)
    tuple_params = gen_insert_val_str(dic_values)

    table_name = add_double_quote(table_name)  # extract partition value from dic_values
    sql = f'INSERT INTO {table_name}({col_str}) VALUES({val_str})'

    return sql, tuple_params


def gen_delete_sql(table_name, dic_conditions):
    """
    generate delete sql
    :param table_name:
    :param dic_conditions:
    :return:
    """
    condition_str, params_condition = _gen_condition_str(dic_conditions)
    table_name = add_double_quote(table_name)  # extract partition value from dic_values
    sql = f'DELETE FROM {table_name} WHERE {condition_str}'

    return sql, params_condition


def gen_check_exist_sql(table_name, dic_conditions=None):
    sql = f'SELECT 1 FROM {add_double_quote(table_name)}'
    params_condition = None
    if dic_conditions:
        condition_str, params_condition = _gen_condition_str(dic_conditions)
        sql += f' WHERE {condition_str}'
        params_condition = tuple(params_condition)

    sql += ' LIMIT 1'
    return sql, params_condition


def gen_select_col_str(column_names: Union[Dict, List] = None, is_add_double_quote=True):
    """
    Add double quotes to each name of column existing in model columns and combine to string
    :param column_names:
    :param is_add_double_quote:
    """
    if column_names is None:
        return '*'

    if is_add_double_quote:
        return ','.join([add_double_quote(col) for col in column_names])
    else:
        return ','.join([col for col in column_names])


def gen_select_aggregate_function(dict_aggregate_function: Dict):
    if not dict_aggregate_function:
        return None
    # output
    # MAX(col1),MIN(col2),FUNC_A(col3,col4,const)
    return {
        f'"{key}"': f'{value[0]}({",".join(value[1:])}) as "{key}"'
        for key, value in dict_aggregate_function.items()
    }


def gen_select_by_condition_sql(
    table_name,
    dic_conditions=None,
    select_cols=None,
    dict_aggregate_function=None,
    dic_order_by=Union[List, Dict, None],
    limit=None,
    is_or_operation=False,
):
    select_col_names = [add_double_quote(col) for col in select_cols] if select_cols else []

    table_str = add_double_quote(table_name)  # extract partition value from dic_values

    if dict_aggregate_function:
        select_aggregate_function = gen_select_aggregate_function(dict_aggregate_function)
        for key_alias, value_function in select_aggregate_function.items():
            if key_alias in select_col_names:
                select_col_names[select_col_names.index(key_alias)] = value_function
            else:
                select_col_names.append(value_function)

    select_statement = ','.join(select_col_names) if select_col_names else '*'
    sql = f'SELECT {select_statement} FROM {table_str}'

    params_condition = None
    condition_str = None

    if dic_conditions:
        condition_str, params_condition = _gen_condition_str(dic_conditions, is_or_operation)
        condition_str = f'({condition_str})'

    # WHERE
    if condition_str:
        sql += f' WHERE {condition_str}'

    # ORDER BY
    if dic_order_by:
        order_by_str = None
        if isinstance(dic_order_by, dict):
            order_by_str = ', '.join(
                [
                    f'{col} {order_by_type or OrderBy.ASC.name}'
                    for col, order_by_type in dic_order_by.items()
                ]
            )
        elif isinstance(dic_order_by, list):
            order_by_str = ', '.join([col for col in dic_order_by])

        if order_by_str:
            sql += f' ORDER BY {order_by_str}'

    # LIMIT
    if limit:
        sql += f' LIMIT {limit}'

    if params_condition:
        params_condition = tuple(params_condition)

    return sql, params_condition
