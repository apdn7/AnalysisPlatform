import dataclasses
import uuid
from typing import Optional

import networkx as nx

from ap.setting_module.models import CfgTrace, CfgTraceKey


@dataclasses.dataclass
class EdgeUniqueKey:
    column_id: int
    column_substr_from: int
    column_substr_to: int
    delta_time: Optional[str]  # if user set delta_time, then this should never be reduced

    @classmethod
    def forward_key(cls, key: CfgTraceKey) -> 'EdgeUniqueKey':
        delta_time = key.delta_time
        if delta_time is not None:
            delta_time = uuid.uuid4().hex

        return cls(
            column_id=key.self_column_id,
            column_substr_from=key.self_column_substr_from,
            column_substr_to=key.self_column_substr_to,
            delta_time=delta_time,
        )

    @classmethod
    def back_key(cls, key: CfgTraceKey) -> 'EdgeUniqueKey':
        delta_time = key.delta_time
        if delta_time is not None:
            delta_time = uuid.uuid4().hex
        return cls(
            column_id=key.target_column_id,
            column_substr_from=key.target_column_substr_from,
            column_substr_to=key.target_column_substr_to,
            delta_time=delta_time,
        )


@dataclasses.dataclass
class ConnectedTraceKeys:
    left: list[CfgTraceKey]
    right: list[CfgTraceKey]
    forward: bool


class TraceGraph:
    undirected_graph: nx.Graph
    direct_graph: nx.DiGraph

    def __init__(self, traces: list[CfgTrace]):
        # construct graph
        self.directed_graph = nx.DiGraph()
        self.undirected_graph = nx.Graph()
        for trace in traces:
            self.directed_graph.add_edge(
                trace.self_process_id,
                trace.target_process_id,
                trace_keys=trace.trace_keys,
            )
            self.undirected_graph.add_edge(
                trace.target_process_id,
                trace.self_process_id,
                trace_keys=trace.trace_keys,
            )

        # store leaf all start and end nodes
        start_nodes = {trace.self_process_id for trace in traces}
        end_nodes = {trace.target_process_id for trace in traces}
        self.leaf_start_nodes = sorted(start_nodes - end_nodes)
        self.leaf_end_nodes = sorted(end_nodes - start_nodes)

    def get_connected_trace_keys(self, start_proc: int, end_proc: int) -> ConnectedTraceKeys:
        if start_proc == end_proc:
            raise RuntimeError(f'start_proc and end_proc cannot be the same: {start_proc}')

        forward = True
        paths = self.get_all_paths(start_proc=start_proc, end_proc=end_proc)
        if not paths:
            forward = False
            paths = self.get_all_paths(start_proc=end_proc, end_proc=start_proc)
        if not paths:
            raise RuntimeError(f'there is no path between {start_proc} and {end_proc}')

        # len(path) must >= 2
        path = paths[0]
        left = self.directed_graph.edges[path[0], path[1]]['trace_keys']
        right = self.directed_graph.edges[path[-2], path[-1]]['trace_keys']

        if len(left) != len(right):
            raise RuntimeError(f'{start_proc} and {end_proc} must be adjacent on reduced graph, please check')

        return ConnectedTraceKeys(left=left, right=right, forward=forward)

    # Prints all paths from 's' to 'd'
    def get_all_paths(
        self,
        start_proc: int,
        end_proc: Optional[int] = None,
        undirected_graph: bool = False,
    ) -> list[list[int]]:
        # consider the node itself as path
        if start_proc == end_proc:
            return [[start_proc]]

        graph = self.undirected_graph if undirected_graph else self.directed_graph

        # we need to check if start_proc exists in the network
        # nx.descendents raises an exception if start_proc is not linked to any other nodes
        if not graph.has_node(start_proc):
            return []

        # add end_proc if user does not specify
        end_procs = sorted(nx.descendants(graph, start_proc)) if end_proc is None else [end_proc]

        paths = []
        for end_proc in end_procs:
            try:
                paths.extend(nx.all_simple_paths(graph, source=start_proc, target=end_proc))
            except nx.NodeNotFound:  # there is no path to end_proc
                continue

        # do not return empty paths
        return [p for p in paths if len(p)]

    def get_all_paths_in_graph(self):
        paths = []
        for start_proc in self.leaf_start_nodes:
            paths.extend(self.get_all_paths(start_proc))
        return paths

    def has_path(self, start_proc: int, end_proc: int) -> bool:
        try:
            return nx.has_path(self.undirected_graph, start_proc, end_proc)
        except nx.NodeNotFound:
            return False

    def remove_middle_nodes(self, path: list[int], undirected_graph: bool = False) -> list[int]:
        # do not reduce those less than 2 nodes
        if len(path) <= 2:
            return path

        graph = self.undirected_graph if undirected_graph else self.directed_graph

        # reduce path must contains start proc
        reduced_path: list[int] = [path[0]]

        # loop through the middle node (skip the first and the last)
        for index, node in enumerate(path[1:-1], start=1):
            left = graph.edges[path[index - 1], path[index]]
            right = graph.edges[path[index], path[index + 1]]

            # check if the edge can be reduced
            # a ------left-------> b ----right--------> c
            back_keys = list(map(EdgeUniqueKey.back_key, left['trace_keys']))
            forward_keys = list(map(EdgeUniqueKey.forward_key, right['trace_keys']))

            # cannot be reduced, add to path
            if back_keys != forward_keys:
                reduced_path.append(node)

        # reduce path must contains end proc
        reduced_path.append(path[-1])

        return reduced_path
