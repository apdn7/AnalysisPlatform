from __future__ import annotations

from collections import Counter, defaultdict
from typing import TYPE_CHECKING, Dict, Iterator, TypeVar

from flask_sqlalchemy import BaseQuery
from sqlalchemy.dialects import sqlite

from ap.common.constants import TIME_COL
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.setting_module.models import CfgProcess

if TYPE_CHECKING:
    from sqlalchemy.sql import Select

T = TypeVar('T')


def gen_sql_and_params(stmt: Select) -> tuple[str, dict[str, str]]:
    compiled_stmt = stmt.compile(dialect=sqlite.dialect())
    # return compiled_stmt.string, compiled_stmt.params
    return compiled_stmt.string, list(compiled_stmt.params.values())


def run_sql_from_query_with_casted(*, query: BaseQuery, db_instance: SQLite3, cls: type[T]) -> Iterator[T]:
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

    def remove_middle_nodes(self, path):
        min_nodes_count = 2
        if len(path) <= min_nodes_count:
            return path

        reduced_path = [path[0]]
        for idx in range(len(path))[1:-1]:
            start_proc = path[idx - 1]
            middle_proc = path[idx]
            end_proc = path[idx + 1]

            first_edge = self.dic_edges.get((start_proc, middle_proc))
            if not first_edge:
                first_edge = self.dic_edges.get((middle_proc, start_proc))
                left_cols = tuple(
                    (key.self_column_id, key.self_column_substr_from, key.self_column_substr_to)
                    for key in first_edge.trace_keys
                )
            else:
                left_cols = tuple(
                    (
                        key.target_column_id,
                        key.target_column_substr_from,
                        key.target_column_substr_to,
                    )
                    for key in first_edge.trace_keys
                )

            next_edge = self.dic_edges.get((middle_proc, end_proc))
            if not next_edge:
                next_edge = self.dic_edges.get((end_proc, middle_proc))
                right_cols = tuple(
                    (
                        key.target_column_id,
                        key.target_column_substr_from,
                        key.target_column_substr_to,
                    )
                    for key in next_edge.trace_keys
                )
            else:
                right_cols = tuple(
                    (key.self_column_id, key.self_column_substr_from, key.self_column_substr_to)
                    for key in next_edge.trace_keys
                )

            if left_cols != right_cols:
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
