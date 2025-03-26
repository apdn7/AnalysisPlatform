from __future__ import annotations

import copy
import re
import uuid
from collections import Counter, defaultdict
from typing import TYPE_CHECKING, Any, Dict, Iterator, TypeVar

from flask_sqlalchemy.query import Query
from sqlalchemy.dialects import sqlite

from ap.common.constants import TIME_COL, WELL_KNOWN_COLUMNS, DataGroupType, MasterDBType
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.setting_module.models import CfgProcess

if TYPE_CHECKING:
    from sqlalchemy.sql import Select

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


def gen_sql_and_params(stmt: Select) -> tuple[str, list[Any]]:
    # FIXME: need to set these because sqlalchemy 2.0 use postcompiled, which is incompatible with current dialect
    compile_kwargs = {'literal_binds': True}
    compiled_stmt = stmt.compile(dialect=sqlite.dialect(), compile_kwargs=compile_kwargs)
    # return compiled_stmt.string, compiled_stmt.params
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


def get_col_cfgs(dic_proc_cfgs: Dict[int, CfgProcess], col_ids):
    all_cols = []
    for proc_id, proc in dic_proc_cfgs.items():
        all_cols += proc.columns
    return [col for col in all_cols if col.id in col_ids]


def get_col_cfg(dic_proc_cfgs: Dict[int, CfgProcess], col_id):
    all_cols = []
    for proc_id, proc in dic_proc_cfgs.items():
        all_cols += proc.columns
    return [col for col in all_cols if col.id == col_id][0]


class TraceGraph:
    def __init__(self, edges):
        self.dic_graph = defaultdict(list)
        self.dic_graph_undirected = defaultdict(list)
        self.dic_edges = {}
        self.nodes = set()
        self_procs = []
        target_procs = []
        for edge in edges:
            start_proc = edge.self_process_id
            end_proc = edge.target_process_id
            self_procs.append(start_proc)
            target_procs.append(end_proc)
            self.nodes.add(start_proc)
            self.nodes.add(end_proc)
            self.dic_edges[(start_proc, end_proc)] = edge
            self.dic_graph[start_proc].append(end_proc)
            self.dic_graph_undirected[start_proc].append(end_proc)
            self.dic_graph_undirected[end_proc].append(start_proc)

        counter_self_procs = Counter(self_procs)
        counter_target_procs = Counter(target_procs)
        set_self_procs = set(counter_self_procs)
        set_target_procs = set(counter_target_procs)
        self.split_multi_nodes = [_node for _node, _count in counter_self_procs.items() if _count > 1]
        self.merge_multi_nodes = [_node for _node, _count in counter_target_procs.items() if _count > 1]
        self.leaf_start_nodes = list(set_self_procs - set_target_procs)
        self.leaf_end_nodes = list(set_target_procs - set_self_procs)

    # function to add an edge to graph
    def _get_all_paths(self, start_proc, path, paths, end_proc=None, undirected_graph=None):
        # avoid cycle
        if start_proc in path:
            return paths
        # don't use append here.
        path = path + [start_proc]

        dic_graph = self.dic_graph_undirected if undirected_graph else self.dic_graph

        if start_proc == end_proc:
            paths.append(path)
        elif start_proc not in dic_graph:
            if end_proc is None:
                paths.append(path)
        else:
            for next_proc in dic_graph[start_proc]:
                self._get_all_paths(next_proc, path, paths, end_proc, undirected_graph)

        return paths

    # Prints all paths from 's' to 'd'
    def get_all_paths(self, start_proc, end_proc=None, undirected_graph=None):
        path = []
        paths = []
        return self._get_all_paths(start_proc, path, paths, end_proc, undirected_graph)

    def get_all_paths_in_graph(self):
        paths = []
        for start_proc in self.leaf_start_nodes:
            _paths = self.get_all_paths(start_proc)
            paths.extend(_paths)

        return paths

    def _unique_key_between_edges(self, left_proc, right_proc):
        """Generate key to match between trace processes.
        If we have delta_time, cut_off linked between those processes, we should always make sure they are unique,
        and are not be removed. Since delta_time and cut_off linked are asymmetric
        :param left_proc:
        :param right_proc:
        :return:
        """

        def _delta_time_key(trace_key):
            if trace_key.delta_time is not None:
                return uuid.uuid4().hex
            return None

        edge = self.dic_edges.get((left_proc, right_proc))
        if not edge:
            edge = self.dic_edges.get((right_proc, left_proc))
            key = tuple(
                (
                    key.self_column_id,
                    key.self_column_substr_from,
                    key.self_column_substr_to,
                    _delta_time_key(key),
                )
                for key in edge.trace_keys
            )
        else:
            key = tuple(
                (
                    key.target_column_id,
                    key.target_column_substr_from,
                    key.target_column_substr_to,
                    _delta_time_key(key),
                )
                for key in edge.trace_keys
            )

        return key

    def remove_middle_nodes(self, path):
        min_nodes_count = 2
        if len(path) <= min_nodes_count:
            return path

        reduced_path = [path[0]]

        for idx in range(len(path))[1:-1]:
            start_proc = path[idx - 1]
            middle_proc = path[idx]
            end_proc = path[idx + 1]

            left_key = self._unique_key_between_edges(start_proc, middle_proc)
            right_key = self._unique_key_between_edges(middle_proc, end_proc)
            if left_key != right_key:
                reduced_path.append(middle_proc)

        reduced_path.append(path[-1])
        return reduced_path

    def find_sub_paths(self, paths=None):
        dic_sub_path = defaultdict(int)
        dic_sub_paths = defaultdict(list)
        if not paths:
            paths = self.get_all_paths_in_graph()

        for path in paths:
            path_keys = tuple(path)
            sub_path = []
            for node in path:
                sub_path.append(node)
                if len(sub_path) > 1 and (node in self.split_multi_nodes or node in self.merge_multi_nodes):
                    sub_path_keys = tuple(sub_path)
                    dic_sub_path[sub_path_keys] += 1
                    dic_sub_paths[path_keys].append(sub_path_keys)
                    sub_path = [node]
                elif len(sub_path) > 1:
                    sub_path_keys = tuple(sub_path)
                    dic_sub_path[sub_path_keys] += 1
                    dic_sub_paths[path_keys].append(sub_path_keys)
        return dic_sub_path, dic_sub_paths

    def get_distinct_trace_columns(self):
        trace_cols = set()
        for edge in self.dic_edges.values():
            start_proc_id = edge.self_process_id
            start_cols = tuple(
                (key.self_column_id, key.self_column_substr_from, key.self_column_substr_to) for key in edge.trace_keys
            )

            trace_cols.add((start_proc_id, start_cols))

            end_proc_id = edge.target_process_id
            end_cols = tuple(
                (key.target_column_id, key.target_column_substr_from, key.target_column_substr_to)
                for key in edge.trace_keys
            )

            trace_cols.add((end_proc_id, end_cols))

        return trace_cols


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
