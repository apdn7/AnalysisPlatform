from __future__ import annotations

import copy
import re
from typing import TYPE_CHECKING, Any, Iterator, TypeVar, Union

from flask_sqlalchemy.query import Query
from sqlalchemy.dialects import sqlite

from ap.common.constants import TIME_COL, WELL_KNOWN_COLUMNS, DataGroupType, MasterDBType
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.setting_module.models import CfgProcess

if TYPE_CHECKING:
    from sqlalchemy.sql import Select
    from sqlalchemy.sql.compiler import SQLCompiler
    from sqlalchemy.sql.ddl import CreateIndex, CreateTable

T = TypeVar('T')

MUST_EXISTED_COLUMNS_FOR_MASTER_TYPE = {
    MasterDBType.V2.name: [
        {'計測日時', '計測項目名', '計測値'},
    ],
    MasterDBType.V2_MULTI.name: [
        {'加工日時', '測定項目名', '測定値'},
        {'processed_date_time', 'measurement_item_name', 'measured_value'},
    ],
    MasterDBType.V2_HISTORY.name: [
        {'計測日時', '子部品シリアルNo'},
    ],
    MasterDBType.V2_MULTI_HISTORY.name: [
        {'加工日時', '子部品シリアルNo'},
    ],
}


def gen_sql_compiled_stmt(stmt: Union[Select, CreateTable, CreateIndex]) -> SQLCompiler:
    compile_kwargs = {'render_postcompile': True}
    compiled_stmt = stmt.compile(dialect=sqlite.dialect(), compile_kwargs=compile_kwargs)
    return compiled_stmt


def gen_sql_and_params(stmt: Select) -> tuple[str, list[Any]]:
    compiled_stmt = gen_sql_compiled_stmt(stmt)
    position_params = compiled_stmt.positiontup
    dict_params = compiled_stmt.params
    params = [dict_params[pos] for pos in position_params]  # sort params based position
    return compiled_stmt.string, params


def run_sql_from_query_with_casted(*, query: Query, db_instance: SQLite3, cls: type[T]) -> Iterator[T]:
    sql, params = gen_sql_and_params(query.statement)
    _, rows = db_instance.run_sql(sql, row_is_dict=True, params=params)
    for row in rows:
        yield cls(**row)


def gen_proc_time_label(proc_id):
    return f'{TIME_COL}_{str(proc_id)}'


def get_col_cfgs(dic_proc_cfgs: dict[int, CfgProcess], col_ids):
    all_cols = []
    for proc_id, proc in dic_proc_cfgs.items():
        all_cols += proc.columns
    return [col for col in all_cols if col.id in col_ids]


def get_col_cfg(dic_proc_cfgs: dict[int, CfgProcess], col_id):
    all_cols = []
    for proc_id, proc in dic_proc_cfgs.items():
        all_cols += proc.columns
    return [col for col in all_cols if col.id == col_id][0]


@log_execution_time()
def get_well_known_columns_for_others_type(
    well_known_columns: dict[str, str],
    cols: list[str] | set[str],
) -> dict[str, int]:
    results = {}
    master_date_group_types = []
    for col in cols:
        for data_group_type, pattern_regex in well_known_columns.items():
            if pattern_regex and re.search(pattern_regex, col, re.IGNORECASE):
                if data_group_type not in master_date_group_types:
                    results[col] = data_group_type
                    master_date_group_types.append(data_group_type)
                else:
                    results[col] = DataGroupType.HORIZONTAL_DATA.value

                break

            results[col] = DataGroupType.HORIZONTAL_DATA.value

    return results


@log_execution_time()
def get_well_known_columns_for_v2_type(
    well_known_columns: dict[str, str],
    cols: list[str] | set[str],
) -> dict[str, int]:
    from ap.api.setting_module.services.v2_etl_services import normalize_column_name

    normalized_cols = normalize_column_name(cols)

    def get_group_type(col: str, normalized_col: str) -> str | None:
        return well_known_columns.get(col, None) or well_known_columns.get(normalized_col, None)

    group_types = map(get_group_type, cols, normalized_cols)
    return {col: group_type for col, group_type in zip(cols, group_types) if group_type is not None}


@CustomCache.memoize()
def get_well_known_columns(master_type: str, cols: list[str] | set[str] | None = None) -> dict[str, int]:
    old_well_known_columns = WELL_KNOWN_COLUMNS.get(master_type, {})
    if not cols:
        return copy.deepcopy(old_well_known_columns)

    if master_type == MasterDBType.OTHERS.name:
        well_known_columns = get_well_known_columns_for_others_type(old_well_known_columns, cols)
    elif MasterDBType.is_v2_group(master_type):
        well_known_columns = get_well_known_columns_for_v2_type(old_well_known_columns, cols)
    else:
        well_known_columns = copy.deepcopy(old_well_known_columns)
    return well_known_columns


def check_missing_column_by_data_group_type(master_type: str, file_columns: list[str]) -> bool:
    existed_group_types = set(get_well_known_columns(master_type, file_columns).values())
    required_group_types = set(get_well_known_columns(master_type, cols=None).values())
    contains_all_required_group_types = required_group_types <= existed_group_types
    has_missing = not contains_all_required_group_types
    return has_missing


def get_specific_v2_type_based_on_column_names(
    column_names: list[str] | set[str] | None = None,
) -> str | None:
    """Currently only works for V2 master data
    Checking if column names is referring to V2, V2 multi, V2 history or V2 multi history
    Currently, we use hardcoded values through `MUST_EXISTED_COLUMNS_FOR_MASTER_TYPE`
    Consider refactor this later
    """
    from ap.api.setting_module.services.v2_etl_services import normalize_column_name

    normalized_columns = set(normalize_column_name(column_names))

    for m_type in [
        MasterDBType.V2.name,
        MasterDBType.V2_MULTI.name,
        MasterDBType.V2_HISTORY.name,
        MasterDBType.V2_MULTI_HISTORY.name,
    ]:
        if DataGroupType.FileName.name in column_names:
            column_names = list(set(column_names) - set(DataGroupType.FileName.name))

        has_missing_columns = check_missing_column_by_data_group_type(m_type, column_names)
        if has_missing_columns:
            continue

        for must_existed_columns in MUST_EXISTED_COLUMNS_FOR_MASTER_TYPE.get(m_type):
            if normalized_columns >= set(normalize_column_name(must_existed_columns)):
                return m_type

    return None
