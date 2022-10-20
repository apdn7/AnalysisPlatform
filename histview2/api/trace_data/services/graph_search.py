
class GraphUtil:

    def __init__(self, V):
        self.V = V
        self.adj = [[] for i in range(len(V))]

    def dfs_util(self, temp, v, visited):
        visited[v] = True
        temp.append(v)
        idx = self.V.index(v)
        for i in self.adj[idx]:
            pr = self.V[i]
            if not visited[pr]:
                temp = self.dfs_util(temp, pr, visited)
        return temp

    def add_edge(self, v, w):
        v_index = self.V.index(v)
        w_index = self.V.index(w)
        self.adj[v_index].append(w_index)
        self.adj[w_index].append(v_index)

    def connected_components(self):
        visited = {}
        cc = []
        for v in self.V:
            visited[v] = False
        for v in self.V:
            if not visited[v]:
                temp = []
                cc.append(self.dfs_util(temp, v, visited))
        return cc

    def find_linked_processes(self, target):
        if target not in self.V:
            return []

        visited = {}
        for v in self.V:
            visited[v] = False
        for v in self.V:
            if not visited[v]:
                temp = []
                component = self.dfs_util(temp, v, visited)
                if target in component:
                    return component
        return []


if __name__ == "__main__":
    g = GraphUtil([10, 11, 12, 13, 14, 20, 2222])  # pass list of proc_ids
    g.add_edge(11, 10)
    g.add_edge(12, 13)
    g.add_edge(13, 14)
    components = g.find_linked_processes(10)
    print(components)
