from __future__ import annotations

import uuid
from dataclasses import dataclass
from functools import cached_property
from typing import Any, List, Optional, Union

import sqlalchemy as sa
from sqlalchemy import cast, func, join, or_, select
from sqlalchemy.sql import operators, sqltypes
from sqlalchemy.sql.elements import ColumnClause, Label, and_
from sqlalchemy.sql.operators import ColumnOperators, Operators
from sqlalchemy.sql.selectable import CTE, Join, Select
from typing_extensions import Self

from ap.api.common.services.utils import gen_proc_time_label
from ap.common.common_utils import gen_sql_label, gen_sql_like_value
from ap.common.constants import (
    SQL_REGEXP_FUNC,
    TIME_COL,
    DuplicateSerialShow,
    FilterFunc,
    RawDataTypeDB,
)
from ap.common.logger import log_execution_time
from ap.setting_module.models import CfgFilterDetail, CfgProcessColumn, CfgTrace
from ap.trace_data.schemas import ConditionProc, ConditionProcDetail
from ap.trace_data.transaction_model import TransactionData

ROW_NUMBER_COL_PREFIX = 'cum_count'

CTE_PROCESS_PREFIX = 'cte_p'

PROCESS_ALIAS_PREFIX = 'p'
NORMAL_FILTER_ALIAS_PREFIX = 'pn'
MASTER_FILTER_ALIAS_PREFIX = 'pm'
SHOW_CATEGORY_ALIAS_PREFIX = 'ps'

SEMI_TABLE_ALIAS_PREFIX = 's'
MASTER_MAPPING_PREFIX = 'm'

MAPPING_PART_NO = 'mapping_part'
MAPPING_LINE = 'mapping_line'
MAPPING_MACHINE = 'mapping_equip'
MAPPING_PROCESS = 'mapping_process'

SQL_GENERATOR_PREFIX = 'SQL_GENERATOR'

NOT_MATERIALIZED = 'NOT MATERIALIZED'

FILTER_PREFIX = 'filtered'


def gen_alias_col_name(trans_data: TransactionData, column_name: str) -> Optional[str]:
    cfg_column = trans_data.get_cfg_column_by_name(column_name)
    if cfg_column is None:
        return None

    alias_name = gen_sql_label(cfg_column.id, cfg_column.column_name)
    return alias_name


def gen_row_number_col_name(proc_id: int) -> str:
    return f'{ROW_NUMBER_COL_PREFIX}_{proc_id}'


def join_table(
    join_conditions: Optional[Join],
    left: Any,
    right: Any,
    onclause: Union[Operators, bool],
    isouter: bool = True,
) -> Join:
    if join_conditions is None:
        return join(left=left, right=right, onclause=onclause, isouter=isouter)
    return join_conditions.join(right=right, onclause=onclause, isouter=isouter)


@dataclass(frozen=True)
class SqlProcLinkKey:
    id: int
    name: str
    substr_from: Optional[int]
    substr_to: Optional[int]
    delta_time: Optional[int]
    cut_off: Optional[int]

    @property
    def good(self) -> bool:
        return (self.substr_from and self.substr_to) or bool(self.delta_time)

    @property
    def bad(self) -> bool:
        return not self.good

    @property
    def sql_label(self) -> str:
        cfg_cols = CfgProcessColumn.get_by_ids([self.id])[0]
        return cfg_cols.gen_sql_label()


class SqlProcLink:
    process_id: int
    table_name: str
    time_col: str
    select_col_ids: list[int]
    select_col_names: list[str]
    start_tm: str
    end_tm: str
    link_keys: list[SqlProcLinkKey]
    next_link_keys: list[SqlProcLinkKey]
    sql: str
    params: str
    temp_table_name: str
    time_ranges: list[tuple[str]]
    trans_data: TransactionData
    condition_procs: list[ConditionProc]
    is_start_proc: bool = False

    @property
    def has_link_keys(self) -> bool:
        """Determine if we have link keys"""
        return bool(self.link_keys or self.next_link_keys)

    @property
    def link_cfg_columns(self) -> list[CfgProcessColumn]:
        return CfgProcessColumn.get_by_ids(self.all_link_key_ids)

    @cached_property
    def all_link_key_ids(self) -> set[int]:
        """Get all possible link keys for dropping duplicates
        - multiple processes: get link keys as is
        - one process: get serial columns as link keys
        """
        if not self.has_link_keys and not self.trans_data.serial_columns:
            return set()

        # multiple processes
        if self.has_link_keys:
            return {link.id for link in self.link_keys + self.next_link_keys}

        # one process
        return {col.id for col in self.trans_data.serial_columns}

    @cached_property
    def all_link_keys_labels(self) -> set[str]:
        """Get all link keys sql label"""
        return {cfg_col.gen_sql_label() for cfg_col in self.link_cfg_columns}

    @property
    def condition_procs_column_id(self) -> set[int]:
        """Get all filter condition columns"""
        cond_procs_column_id = set()
        for cond in self.condition_procs:
            cond_ids = cond.dic_col_id_filters.keys()
            cond_procs_column_id.update(cond_ids)
        return cond_procs_column_id

    @property
    def all_cfg_columns(self) -> list[CfgProcessColumn]:
        all_column_ids = self.all_link_key_ids | set(self.select_col_ids) | self.condition_procs_column_id
        return CfgProcessColumn.get_by_ids(all_column_ids)

    def gen_proc_time_label(self, is_start_proc: bool = False) -> str:
        return TIME_COL if is_start_proc else gen_proc_time_label(self.process_id)

    def filter_conditions(self, cte: CTE) -> Optional[Operators]:
        """Filter master after we get cte from single process"""
        conditions = set()

        for cond_proc in self.condition_procs:
            assert cond_proc.proc_id == self.process_id
            for col_id, filters in cond_proc.dic_col_id_filters.items():
                cfg_column = self.trans_data.get_cfg_column_by_id(col_id)
                col_name_alias = gen_alias_col_name(self.trans_data, cfg_column.bridge_column_name)
                col = cte.c.get(col_name_alias)
                assert col is not None, f'{col_name_alias} must exist'
                filter_col = col
                filter_col_type = cfg_column.data_type
                conditions.add(gen_sql_condition_per_col(filter_col, filter_col_type, filters))

        if not conditions:
            return None
        return and_(*conditions)

    def apply_filter(self, cte: CTE) -> CTE:
        filter_conditions = self.filter_conditions(cte)
        if filter_conditions is None:
            return cte
        name_aliased = f'{FILTER_PREFIX}_{cte.description}'
        stmt = select([cte])
        stmt.append_whereclause(filter_conditions)
        return stmt.cte(name_aliased)

    @log_execution_time(SQL_GENERATOR_PREFIX)
    def gen_cte(
        self,
        idx: int,
        duplicated_serial_show: DuplicateSerialShow,
        is_start_proc: bool = False,
        for_count: bool = False,
    ):
        if self.is_delta_time_using:
            return self.gen_cte_by_delta_time(idx, duplicated_serial_show, is_start_proc, for_count)

        query_builder = TransactionDataQueryBuilder(self.trans_data)
        if is_start_proc:
            query_builder.add_column(column=self.trans_data.id_col_name)

        time_col = self.trans_data.getdate_column
        query_builder.add_column(column=time_col.bridge_column_name, label=self.gen_proc_time_label(is_start_proc))
        query_builder.between(start_tm=self.start_tm, end_tm=self.end_tm)
        query_builder_time_col = query_builder.column(self.gen_proc_time_label(is_start_proc))

        for cfg_col in self.all_cfg_columns:
            query_builder.add_column(column=cfg_col.bridge_column_name, label=cfg_col.gen_sql_label())

        link_cols = []
        for col_label in self.all_link_keys_labels:
            link_cols.append(query_builder.column(col_label))

        if not for_count and duplicated_serial_show != DuplicateSerialShow.SHOW_BOTH:
            distinct_cols = [col for col in link_cols if col.name != self.time_col]
            if distinct_cols:
                query_builder.distinct(columns=distinct_cols)
                if duplicated_serial_show == DuplicateSerialShow.SHOW_FIRST:
                    query_builder.having(columns=[func.min(query_builder_time_col)])
                else:
                    query_builder.having(columns=[func.max(query_builder_time_col)])

        cte = query_builder.build().cte(f'{CTE_PROCESS_PREFIX}{idx}')
        cte: CTE = self.apply_filter(cte)

        return cte

    @log_execution_time(SQL_GENERATOR_PREFIX)
    def gen_cte_by_delta_time(
        self,
        idx: int,
        duplicated_serial_show: DuplicateSerialShow,
        is_start_proc: bool = False,
        for_count: bool = False,
    ):
        query_builder = TransactionDataQueryBuilder(self.trans_data)
        if is_start_proc:
            query_builder.add_column(column=self.trans_data.id_col_name)

        time_col = self.trans_data.getdate_column
        query_builder.add_column(column=time_col.bridge_column_name, label=self.gen_proc_time_label(is_start_proc))
        query_builder.between(start_tm=self.start_tm, end_tm=self.end_tm)
        query_builder_time_col = query_builder.column(self.gen_proc_time_label(is_start_proc))

        for cfg_col in self.all_cfg_columns:
            query_builder.add_column(column=cfg_col.bridge_column_name, label=cfg_col.gen_sql_label())

        link_cols = []
        for col_label in self.all_link_keys_labels:
            link_cols.append(query_builder.column(col_label))

        if not for_count and duplicated_serial_show != DuplicateSerialShow.SHOW_BOTH:
            distinct_cols = [col for col in link_cols if col.name != self.time_col]
            if distinct_cols:
                query_builder.distinct(columns=distinct_cols)
                if duplicated_serial_show == DuplicateSerialShow.SHOW_FIRST:
                    query_builder.having(columns=[func.min(query_builder_time_col)])
                else:
                    query_builder.having(columns=[func.max(query_builder_time_col)])

        cte = query_builder.build().cte(f'{CTE_PROCESS_PREFIX}{idx}')
        cte: CTE = self.apply_filter(cte)

        return cte

    @property
    def is_delta_time_using(self):
        return all(link_key.delta_time for link_key in self.link_keys)


def cast_col_to_text(col: ColumnClause, raw_data_type: str) -> Union[ColumnClause, ColumnOperators]:
    if RawDataTypeDB.is_text_data_type(raw_data_type):
        return col
    return cast(col, sqltypes.Text)


def force_take_substr(
    col: ColumnClause,
    key: SqlProcLinkKey,
    raw_data_type: str,
) -> Union[ColumnClause, ColumnOperators]:
    try:
        substr_col = cast_col_to_text(col, raw_data_type)
        distance = key.substr_to - key.substr_from + 1
    except Exception:
        return col

    return func.substr(substr_col, key.substr_from, distance)


def make_comparison_column_with_cast_and_substr(
    col1: ColumnClause,
    key1: SqlProcLinkKey,
    type1: str,
    col2: ColumnClause,
    key2: SqlProcLinkKey,
    type2: str,
) -> Optional[ColumnOperators, bool]:
    modified_col1 = col1 if key1.bad else force_take_substr(col1, key1, type1)
    modified_col2 = col2 if key2.bad else force_take_substr(col2, key2, type2)

    modified_type1 = type1 if key1.bad else RawDataTypeDB.TEXT.value
    modified_type2 = type2 if key2.bad else RawDataTypeDB.TEXT.value

    is_col1_text = RawDataTypeDB.is_text_data_type(modified_type1)
    is_col2_text = RawDataTypeDB.is_text_data_type(modified_type2)

    if (is_col1_text and is_col2_text) or (not is_col1_text and not is_col2_text):
        return modified_col1 == modified_col2

    modified_col1 = cast_col_to_text(modified_col1, modified_type1)
    modified_col2 = cast_col_to_text(modified_col2, modified_type2)
    return modified_col1 == modified_col2


def unixepoch_delta_time_col(col, delta_time=0, cut_off=0):
    if delta_time:
        seconds = delta_time + cut_off / 1000
        return func.unixepoch(col, 'subsec') + seconds
    else:
        return func.unixepoch(col, 'subsec')


def make_comparison_column_delta_time_and_cut_off(comparisons, from_col, from_key, to_col, to_key):
    if from_key.delta_time:
        to_col_val = unixepoch_delta_time_col(to_col)
        if from_key.cut_off:
            min_cfg_col = unixepoch_delta_time_col(from_col, from_key.delta_time)
            max_cfg_col = unixepoch_delta_time_col(from_col, from_key.delta_time, from_key.cut_off)
            comparisons.append(min_cfg_col <= to_col_val)
            comparisons.append(max_cfg_col >= to_col_val)
        else:
            from_col_val = unixepoch_delta_time_col(from_col, from_key.delta_time)
            comparisons.append(from_col_val == to_col_val)

    elif to_key.delta_time:
        from_col_val = unixepoch_delta_time_col(from_col)
        if to_key.cut_off:
            min_other_col = unixepoch_delta_time_col(to_col, to_key.delta_time)
            max_other_col = unixepoch_delta_time_col(to_col, to_key.delta_time, to_key.cut_off)
            comparisons.append(min_other_col <= from_col_val)
            comparisons.append(max_other_col >= from_col_val)
        else:
            to_col_val = unixepoch_delta_time_col(to_col, to_key.delta_time)
            comparisons.append(from_col_val == to_col_val)


@log_execution_time(SQL_GENERATOR_PREFIX)
def gen_tracing_cte(
    tracing_table_alias: str,
    cte_proc_list: list[CTE],
    sql_objs: list[SqlProcLink],
    duplicated_serial_show: DuplicateSerialShow,
    dict_cond_procs: dict,
):
    start_proc_table = cte_proc_list[0] if cte_proc_list else None
    assert start_proc_table is not None
    stmt = select(cte_proc_list)

    join_conditions: Optional[Join] = None

    for i in range(1, len(sql_objs)):
        sql_obj = sql_objs[i]
        cte_proc = cte_proc_list[i]
        link_keys = sql_obj.link_keys

        prev_sql_obj = sql_objs[i - 1]
        prev_cte_proc = cte_proc_list[i - 1]
        prev_link_keys = prev_sql_obj.next_link_keys or prev_sql_obj.link_keys

        comparisons = []
        for from_key, to_key in zip(link_keys, prev_link_keys):
            from_cfg_col = sql_obj.trans_data.get_cfg_column_by_name(from_key.name)
            to_cfg_col = prev_sql_obj.trans_data.get_cfg_column_by_name(to_key.name)
            from_col = cte_proc.c.get(from_cfg_col.gen_sql_label())
            to_col = prev_cte_proc.c.get(to_cfg_col.gen_sql_label())
            if from_key.delta_time or to_key.delta_time:
                # in case of data link by delta_time, use datetime function
                if from_key.delta_time:
                    to_col_val = func.datetime(to_col)
                    from_col_val = func.datetime(from_col, f'+{int(from_key.delta_time)} seconds')
                else:
                    to_col_val = func.datetime(to_col, f'+{int(to_key.delta_time)} seconds')
                    from_col_val = func.datetime(from_col)
                comparisons.append(to_col_val == from_col_val)
            else:
                comp = make_comparison_column_with_cast_and_substr(
                    from_col,
                    from_key,
                    from_cfg_col.data_type,
                    to_col,
                    to_key,
                    to_cfg_col.data_type,
                )
                comparisons.append(comp)

        if duplicated_serial_show == duplicated_serial_show.SHOW_BOTH:
            from_col = cte_proc.c.get(gen_row_number_col_name(sql_obj.process_id))
            to_col = prev_cte_proc.c.get(gen_row_number_col_name(prev_sql_obj.process_id))
            if from_col is not None and to_col is not None:
                comparisons.append(from_col == to_col)

        join_conditions = join_table(
            join_conditions,
            left=prev_cte_proc,
            right=cte_proc,
            onclause=and_(*comparisons),
            isouter=not is_has_condition(
                sql_obj.process_id,
                dict_cond_procs,
            ),  # TODO: this is complicated
        )

    if join_conditions is not None:
        stmt = stmt.select_from(join_conditions)
    return stmt.cte(tracing_table_alias)


def gen_trace_by_delta_time_query(
    sql_objs: list[SqlProcLink],
):
    _ctes = []
    _target_selected = []
    _markers = []
    _tables = []
    _condition = []
    for idx, sql_obj in enumerate(sql_objs):
        _cte = f'''cte_marker_{idx} AS (SELECT '''
        # add target columns
        _select = [f'{selected_cols}' for selected_cols in sql_obj.select_col_names]
        for column in sql_obj.all_cfg_columns:
            if column.id in sql_obj.select_col_ids:
                _target_selected.append(f'{column.bridge_column_name} AS "{column.gen_sql_label()}"')

        # add link keys
        for linked_key in sql_obj.link_cfg_columns:
            if linked_key.bridge_column_name not in sql_obj.select_col_names:
                _select.append(linked_key.bridge_column_name)

        _cte += ', '.join(_select)
        link_col = sql_obj.link_cfg_columns[0].bridge_column_name
        # add marker
        _cte += f''', CASE
                     WHEN strftime('%s', {link_col}) -
                          strftime('%s', LAG({link_col}, 1) OVER (
                            ORDER BY {link_col})) = {sql_obj.link_keys[0].delta_time} THEN 1
                     ELSE 0
                END AS marker_{idx}
                FROM {sql_obj.trans_data.table_name}
                WHERE {sql_obj.time_col} BETWEEN '{sql_obj.start_tm}' AND '{sql_obj.end_tm}'),
        cte_delta_t_{idx} AS (SELECT '''
        _cte += ', '.join(_select)
        _cte += f''', CASE
                     WHEN marker_{idx} > 0 THEN
                         SUM(marker_{idx})
                             OVER (ORDER BY {link_col} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                     END AS marker_{idx}
                FROM cte_marker_{idx})'''
        _markers.append(f't{idx}.marker_{idx}')
        _tables.append(f'cte_delta_t_{idx} t{idx}')
        _condition.append(f't{idx}.{sql_obj.time_col}')
        _ctes.append(_cte)

    _cte_trace = 'SELECT '
    _cte_trace += ', '.join(_target_selected) + ', '
    _cte_trace += ', '.join(_markers) + ', '
    _cte_trace += ', '.join(_condition) + ', '

    for idx, time in enumerate(_condition):
        if not idx:
            _cte_trace += time + ' AS time'
        _cte_trace += ', ' + time + f' AS time_{sql_objs[idx].process_id}'
    _cte_trace += f''' FROM {_tables[0]}'''
    for idx, _cte_table in enumerate(_tables):
        if not idx:
            continue
        _cte_trace += f''' LEFT OUTER JOIN {_cte_table}
                        ON {_markers[idx - 1]} = {_markers[idx]}'''
        # WHERE {_condition[idx - 1]} BETWEEN '{sql_objs[0].start_tm}' AND '{sql_objs[0].end_tm}'
    query = ', '.join(_ctes)
    query = f'WITH {query}'
    query += _cte_trace
    return query, None


def gen_conditions_per_column(filters):
    ands = []
    for cfg_filter in filters:
        comp_ins = []
        comp_likes = []
        comp_regexps = []
        cfg_filter_detail: CfgFilterDetail
        for cfg_filter_detail in cfg_filter.cfg_filter_details:
            val = cfg_filter_detail.filter_condition
            if cfg_filter_detail.filter_function == FilterFunc.REGEX.name:
                comp_regexps.append(val)
            elif not cfg_filter_detail.filter_function or cfg_filter_detail.filter_function == FilterFunc.MATCHES.name:
                comp_ins.append(val)
            else:
                comp_likes.extend(
                    gen_sql_like_value(
                        val,
                        FilterFunc[cfg_filter_detail.filter_function],
                        position=cfg_filter_detail.filter_from_pos,
                    ),
                )
        ands.append((comp_ins, comp_likes, comp_regexps))
    return ands


def gen_sql_condition_per_col(
    col: ColumnClause,
    datatype: str,
    filters: list[ConditionProcDetail],
) -> Operators:
    text_col = cast_col_to_text(col, datatype)

    and_conditions = gen_conditions_per_column(filters)
    ands = []
    for in_vals, like_vals, regex_vals in and_conditions:
        ors = []
        if in_vals:
            ors.append(col.in_(in_vals))
        if like_vals:
            ors.extend(text_col.like(like_val) for like_val in like_vals)
        if regex_vals:
            # sqlalchemy 1.3 does not support regex yet
            # in 1.4 we could use col.regex_match(regex_val)
            ors.extend(text_col.operate(operators.custom_op(SQL_REGEXP_FUNC), regex_val) for regex_val in regex_vals)
        if ors:
            ands.append(or_(*ors))
    return and_(*ands)


@log_execution_time(SQL_GENERATOR_PREFIX)
def gen_show_stmt(
    cte_tracing: CTE,
    sql_objs: list[SqlProcLink],
    types_should_be_casted: List[RawDataTypeDB] = [],  # noqa
) -> Select:
    # we must add id and time to shown_cols
    shown_cols = [cte_tracing.c.get(TransactionData.id_col_name).label(TransactionData.id_col_name)]

    for idx, sql_obj in enumerate(sql_objs):
        is_start_proc = idx == 0
        # we get the time column
        time_col_alias_name = sql_obj.gen_proc_time_label(is_start_proc)
        time_col = cte_tracing.c.get(time_col_alias_name)
        # assert time_col is not None, "If time_col is None, sql_obj.get() function isn't written correctly"
        time_col_alias = time_col.label(time_col_alias_name)
        shown_cols.append(time_col_alias)

        # TODO: do we need this?
        # we add our start proc as time_{id}
        if is_start_proc:
            time_col_alias_with_id = sql_obj.gen_proc_time_label(is_start_proc=False)
            time_col_alias = time_col.label(time_col_alias_with_id)
            shown_cols.append(time_col_alias)

    for sql_obj in sql_objs:
        for cfg_col in sql_obj.all_cfg_columns:
            col = cte_tracing.c.get(cfg_col.gen_sql_label())

            shown_cols.append(col)

    return select(shown_cols)


def gen_id_stmt(cte_tracing: CTE) -> Select:
    col = cte_tracing.c.get(TransactionData.id_col_name)
    return select([col])
    # return select([1])


# def count_proc_link_by_delta_time(trace: CfgTrace, limit: Optional[int] = None) -> Select:
#     self_proc_link_keys: list[SqlProcLinkKey] = []
#     target_proc_link_keys: list[SqlProcLinkKey] = []
#
#     self_trans_data = TransactionData(trace.self_process_id)
#     target_trans_data = TransactionData(trace.target_process_id)
#     return None


def gen_sql_proc_link_count(trace: CfgTrace, limit: Optional[int] = None) -> Select:
    self_proc_link_keys: list[SqlProcLinkKey] = []
    target_proc_link_keys: list[SqlProcLinkKey] = []

    self_trans_data = TransactionData(trace.self_process_id)
    target_trans_data = TransactionData(trace.target_process_id)

    for trace_key in trace.trace_keys:
        self_proc_link_keys.append(
            SqlProcLinkKey(
                id=trace_key.self_column_id,
                name=self_trans_data.get_column_name(trace_key.self_column_id),
                substr_from=trace_key.self_column_substr_from,
                substr_to=trace_key.self_column_substr_to,
                delta_time=trace_key.delta_time,
                cut_off=trace_key.cut_off,
            ),
        )
        target_proc_link_keys.append(
            SqlProcLinkKey(
                id=trace_key.target_column_id,
                name=target_trans_data.get_column_name(trace_key.target_column_id),
                substr_from=trace_key.target_column_substr_from,
                substr_to=trace_key.target_column_substr_to,
                # delta time and cut_off apply only self process link key, self_link_key + delta_time = target_link_key
                delta_time=None,
                cut_off=None,
            ),
        )
    self_query_builder = TransactionDataProcLinkQueryBuilder(
        self_trans_data,
        self_proc_link_keys,
        table_alias='self',
        limit=limit,
    )
    target_query_builder = TransactionDataProcLinkQueryBuilder(
        target_trans_data,
        target_proc_link_keys,
        table_alias='target',
        limit=limit,
    )
    return self_query_builder.build_count_query(target_query_builder)


def is_has_condition(proc_id, dict_cond_procs):
    if proc_id not in dict_cond_procs:
        return False

    return any(cond_proc.dic_col_id_filters for cond_proc in dict_cond_procs[proc_id])


class TransactionDataQueryBuilder:
    def __init__(self, trans_model: TransactionData) -> None:
        self.trans_model = trans_model
        self.table = self.trans_model.table_model

        self.selected_columns: list[Label] = []
        self.join_conditions: Optional[Join] = None
        self.where_clauses = []

        self.distinct_columns = []
        self.orderby_columns = []
        self.having_columns = []

        self.joined_r_factory_machine = False
        self.joined_r_prod_part = False

    def table_column(self, name: str) -> sa.Column:
        column = self.table.c.get(name)
        if column is None:
            raise AssertionError(f'{column} does not existed in {self.table.name}')
        return column

    def column(self, name: str) -> Label:
        for column in self.selected_columns:
            if column.name == name:
                return column
        raise RuntimeError(f"Column {name} doesn't exist.")

    def add_column(
        self,
        *,
        column: Union[ColumnClause, str, Label],
        label: Optional[str] = None,
    ) -> None:
        if isinstance(column, str):
            column = self.table_column(column)
        if label is not None:
            column = column.label(label)
        self.selected_columns.append(column)

    def add_column_by_case(self, datetime_column, delta_time=None, label: Optional[str] = None):
        # func.lag does not work
        link_columns = self.table_column(datetime_column)
        filter_column = sa.case(
            (
                (
                    func.strftime('%s', link_columns)
                    - func.strftime('%s', func.lag(link_columns, 1).over(order_by=link_columns))
                )
                == delta_time,
                1,
            ),
            else_=0,
        ).label(label)
        self.selected_columns.extend(filter_column)

    def add_columns(self, columns: list[Label]) -> None:
        self.selected_columns.extend(columns)

    def distinct(self, *, columns: list[sa.Column | Label]) -> None:
        self.distinct_columns = columns

    def order_by(self, *, columns: list[sa.Column | Label]) -> None:
        self.orderby_columns = columns

    def having(self, *, columns: list[sa.Column | Label]) -> None:
        self.having_columns = columns

    def between(self, *, start_tm: str, end_tm: str) -> None:
        time_col = self.table_column(self.trans_model.getdate_column.bridge_column_name)
        self.where_clauses.append(sa.and_(time_col >= start_tm, time_col < end_tm))

    def build(self, limit: Optional[int] = None) -> Select:
        stmt = sa.select(self.selected_columns)
        if self.join_conditions is not None:
            stmt = stmt.select_from(self.join_conditions)

        for clause in self.where_clauses:
            stmt.append_whereclause(clause)

        # SQLITE3 use HAVING for distinct some columns in SELECT
        if self.distinct_columns:
            # stmt = stmt.distinct(*self.distinct_columns)
            stmt.append_group_by(*self.distinct_columns)

        if self.having_columns:
            for clause in self.having_columns:
                stmt.append_having(clause)

        if self.orderby_columns:
            stmt = stmt.order_by(*self.orderby_columns)

        if limit is not None:
            stmt = stmt.limit(limit)

        del self
        return stmt


class TransactionDataProcLinkQueryBuilder:
    def __init__(
        self,
        trans_model: TransactionData,
        proc_link_keys: list[SqlProcLinkKey],
        table_alias: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> None:
        self.trans_model = trans_model
        self.proc_link_keys = proc_link_keys
        if table_alias is not None:
            self.table_alias = table_alias
        else:
            self.table_alias = uuid.uuid4().hex

        self.limit = limit
        self.cte: Optional[CTE] = None

    def build_proc_link_cte(self) -> Self:
        query_builder = TransactionDataQueryBuilder(self.trans_model)
        for key in self.proc_link_keys:
            cfg_col = self.trans_model.get_cfg_column_by_id(int(key.id))
            query_builder.add_column(column=cfg_col.bridge_column_name, label=cfg_col.gen_sql_label())
        stmt = query_builder.build(self.limit)
        self.cte = stmt.cte(self.table_alias)
        return self

    def get_column_by_label(self, label: str) -> Optional[ColumnClause]:
        return self.cte.c.get(label)

    def get_column_by_cfg_column(self, cfg_column: CfgProcessColumn) -> ColumnClause:
        column = self.get_column_by_label(cfg_column.gen_sql_label())

        if column is None:
            raise AssertionError(f"column : {cfg_column.column_name} doesn't exist")

        return column

    def make_link_comparison(self, other: Self) -> list[ColumnOperators]:
        comparisons = []
        for key, other_key in zip(self.proc_link_keys, other.proc_link_keys):
            cfg_column: CfgProcessColumn = self.trans_model.get_cfg_column_by_id(int(key.id))
            other_cfg_column: CfgProcessColumn = other.trans_model.get_cfg_column_by_id(int(other_key.id))

            column = self.get_column_by_cfg_column(cfg_column)
            other_column = other.get_column_by_cfg_column(other_cfg_column)

            if key.delta_time or other_key.delta_time:
                # in case of data link by delta_time, use datetime function
                if key.delta_time:
                    from_col_val = func.datetime(column, f'+{int(key.delta_time)} seconds')
                    to_col_val = func.datetime(other_column)
                else:
                    from_col_val = func.datetime(column)
                    to_col_val = func.datetime(other_column, f'+{int(other_key.delta_time)} seconds')
                comparisons.append(from_col_val == to_col_val)
            else:
                # non-master column must be cast before linking
                comparison = make_comparison_column_with_cast_and_substr(
                    column,
                    key,
                    cfg_column.data_type,
                    other_column,
                    other_key,
                    other_cfg_column.data_type,
                )
                comparisons.append(comparison)

        return comparisons

    def build_count_query(self, other: Self) -> Select:
        if self.cte is None:
            self.build_proc_link_cte()
        if other.cte is None:
            other.build_proc_link_cte()
        comparisons = self.make_link_comparison(other)
        exists_stmt = sa.exists([1]).where(sa.and_(*comparisons))
        count_stmt = sa.select([sa.func.count()]).select_from(self.cte)
        return count_stmt.where(exists_stmt)
