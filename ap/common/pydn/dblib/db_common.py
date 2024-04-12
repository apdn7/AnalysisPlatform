from typing import Dict, List, Union

# from bridge.models.model_utils import TableColumn
# from histview2.common.constants import DataTypeDB, ServerType
PARAM_SYMBOL = '?'


# class SqlComparisonOperator(Enum):
#     EQUAL = '='
#     NOT_EQUAL = '!='
#     LESS_THAN = '<'
#     GREATER_THAN = '>'
#     LESS_THAN_OR_EQ = '<='
#     GREATER_THAN_OR_EQ = '>='
#     IS_NULL = 'IS NULL'  # TODO: is null, like, between have separate sql syntax, have not test yet. be careful
#     LIKE = 'LIKE'
#     BETWEEN = 'BETWEEN'
#     IN = 'IN'  # Ex: cls.Columns.status.name: [(SqlComparisonOperator.IN, tuple(job_statuses))]


# class AggregateFunction(Enum):
#     # Example
#     # dict_aggregate_function = {'cycle_id': (AggregateFunction.MAX.value, 'cycle_id')}
#     # ==> select max(cycle_id) as "cycle_id"
#     # dict_aggregate_function = {'time_1': (AggregateFunction.TO_CHAR.value, 'time', 'yyyymmdd')}
#     # ==> select TO_CHAR(time, 'yyyymmdd') as "time_1"
#     MAX = 'MAX'
#     TO_CHAR = 'TO_CHAR'
#     DISTINCT = 'DISTINCT'


# def _gen_condition_str(dic_conditions: Dict[str, Tuple], is_or_operation=False):
#     """
#
#     :param dic_conditions: should follow the following format
#              {'column name' : ((SqlComparisonOperator.EQUAL, value), (SqlComparisonOperator.LESS_THAN, value))}
#     :param is_or_operation:
#     :return:
#     """
#     # draft, replace for gen_condition_str
#     dic_model_cols = {col: val for col, val in dic_conditions.items()}
#
#     sql_condition = []
#     params = []
#     for col, conditions in dic_model_cols.items():
#         if not isinstance(conditions, (tuple, list)):
#             if conditions is None:
#                 sql_condition.append(f'"{col}" IS NULL')
#             else:
#                 sql_condition.append(f'"{col}" {SqlComparisonOperator.EQUAL.value} {PARAM_SYMBOL}')
#                 params.append(check_none_value(conditions))
#         else:
#             for condition in conditions:
#                 operator, value = condition
#                 sql_condition.append(f'"{col}" {operator.value} {PARAM_SYMBOL}')
#                 params.append(check_none_value(value))
#
#     or_and_ope = 'AND'
#     if is_or_operation:
#         or_and_ope = 'OR'
#
#     sql = f' {or_and_ope} '.join(sql_condition)
#
#     return sql, params


def gen_insert_col_str(column_names: Union[Dict, List] = None):
    """
    Add double quotes to each name of column existing in model columns and combine to string
    :param column_names:
    """
    return ','.join([add_double_quote(col) for col in column_names])


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


# def gen_delete_sql(table_name, dic_conditions):
#     """
#     generate delete sql
#     :param table_name:
#     :param dic_conditions:
#     :return:
#     """
#     condition_str, params_condition = _gen_condition_str(dic_conditions)
#     table_name = add_double_quote(table_name)  # extract partition value from dic_values
#     sql = f'DELETE FROM {table_name} WHERE {condition_str}'
#
#     return sql, params_condition


# def gen_check_exist_sql(table_name, dic_conditions=None):
#     sql = f'SELECT 1 FROM {add_double_quote(table_name)}'
#     params_condition = None
#     if dic_conditions:
#         condition_str, params_condition = _gen_condition_str(dic_conditions)
#         sql += f' WHERE {condition_str}'
#         params_condition = tuple(params_condition)
#
#     sql += ' LIMIT 1'
#     return sql, params_condition


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
        return ','.join(list(column_names))
