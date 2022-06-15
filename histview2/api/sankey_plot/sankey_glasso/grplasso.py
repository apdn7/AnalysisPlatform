import numpy as np
import colorsys
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from group_lasso import GroupLasso

# - preprocess_skdpage()
#   # group lasso
#   - calc_coef_and_group_order()
#       - fit_grplasso()
#           - calc_bic()
#       - determine_group_order()
#       - fit_ridge()
#   # generate dict for skd and barchart
#   - GroupSankeyDataProcessor


def preprocess_skdpage(X,
                       y,
                       groups: list,
                       colnames_x: list,
                       colname_y: str,
                       penalty_factors=[0.0, 10.0, 20.0, 50.0],
                       max_datapoints=5000,
                       verbose=False):
    """
    Main function to generate data for SkD page (with group lasso)

    Parameters
    ----------
    X : 2d NumpyArray
        Explanatory variables.
    y : 1d NumpyArray
        Objective variable.
    groups : list
        A list of groups assigned to each explanatory variables.
        Example: ["process0", "process0", "process1", "process2", ...]
    colnames_x : list
        A list of sensor names of explanatory variables.
    colname_y : str
        A string of the name of objective variable.
    penalty_factors : list
        Reguralization factor for group lasso.
    max_datapoints : int
        If X.shape[0] exceeds this value, take random samples from X to save time.
    verbose : True/False
        If True, print info

    Returns
    ----------
    dic_skd : dict
        A set of data used for sankey diagram
    dic_bar : dict
        A set of data used for barchart
    """
    
    # prepare group information
    uniq_grps, idx_grps = np.unique(groups, return_inverse=True)
    dic_groups = {'colnames_x': colnames_x,
                  'colname_y': colname_y,
                  'groups': groups,           # group names (raw)
                  'idx_grps': idx_grps,       # group names (int)
                  'uniq_grps': uniq_grps,     # unique group names
                  'num_grps': len(uniq_grps)} # number of unique groups

    # resample data if exceed max_datapoints
    if X.shape[0] > max_datapoints:
        idx = np.random.choice(X.shape[0], size=max_datapoints, replace=False)
        X = X[idx, :].copy()
        y = y[idx].copy()
        if verbose:
            print("Number of data points exceeded {}. Data is automatically resampled. ".format(max_datapoints))

    # group lasso and ridge regression
    coef, group_order = calc_coef_and_group_order(X, y, dic_groups, penalty_factors, verbose=verbose)

    # skd data
    processor = GroupSankeyDataProcessor(coef, dic_groups, group_order, verbose=verbose)
    dic_skd, dic_bar = processor.gen_dicts()
    return dic_skd, dic_bar


def calc_coef_and_group_order(X, y, dic_groups, penalty_factors=[0, 0.5, 1.0, 5.0], verbose=False):
    """
    Calculate connection strength from x to y, and importance order of groups.
    If only single group is given, just fit with ridge regression.
    
    Parameters
    ----------
    X : 2d NumpyArray
        Explanatory variables.
    y : 1d NumpyArray
        Objective variable.
    dic_groups : dict
        A dictionary with group information
    penalty_factors : list
        Reguralization factor for group lasso.
    verbose : True/False 

    Returns
    ----------
    coef : 1d numpy array
        regression coefficients.
    group_order : list
        A list of order of groups, where less important is on the left.
    """

    coef = np.zeros(X.shape[1])
    group_order = np.arange(dic_groups["num_grps"])

    X = StandardScaler().fit_transform(X)
    y = StandardScaler().fit_transform(y)

    # groups lasso (if 2 or more groups are given)
    idx_for_ridge = np.arange(X.shape[1])
    if dic_groups["num_grps"] > 1:
        # fit group lasso with various penalty factors (no L1 penalty)
        coef_history, bic = fit_grplasso(X, y.flatten(), dic_groups["idx_grps"], penalty_factors, verbose)
        # determine order of groups
        group_order = determine_group_order(coef_history, dic_groups)
        # use selected columns ffor ridge regression
        idx_for_ridge = np.where(np.abs(coef_history[np.argmin(bic), :]) > 0.0)[0]

    # re-calculate coefficients with ridge regression
    if len(idx_for_ridge) == 0:
        # just in case when all columns are deleted
        idx_for_ridge = np.arange(X.shape[1])
    coef[idx_for_ridge] = fit_ridge(X[:, idx_for_ridge], y)

    if verbose:
        print("==========")
        print('Group order: {}'.format(dic_groups["uniq_grps"][group_order]))
        print('Index used for ridge: {}'.format(idx_for_ridge))
        print('Coef: {}'.format(coef))
    
    return coef, group_order


def fit_grplasso(X, y, grps, penalty_factors=[0.01, 0.1, 1.0, 10.0, 100.0], verbose=False):
    """
    Fit group lasso in each penalty factor.
    
    Parameters
    ----------
    X : 2d NumpyArray
        Explanatory variables.
    y : 1d NumpyArray
        Objective variable.
    grps : 1d NumpyArray
        Group ID assigned to each explanatory variable.
    penalty_factors : list
        Lasso reguralization factor for group lasso.

    Returns
    ----------
    coef_history: 2d NumpyArray
        Regression coefficients. (len(penalty_facotrs) x X.shape[1]).
    bic : 1d NumpyArray
        BIC in each penalty_faactor. Smaller the better.
    """
        
    bic = np.empty(len(penalty_factors))
    coef_history = np.empty((len(penalty_factors), X.shape[1]))

    for i, rho in enumerate(penalty_factors):
        if verbose:
            print("==========")
            print("Fitting with penalty: {}".format(rho))
        gl = GroupLasso(
            groups=grps,
            group_reg=rho,
            l1_reg=0.0,
            frobenius_lipschitz=False,
            scale_reg="inverse_group_size",
            supress_warning=True,
            n_iter=200,
            tol=1e-2)
        gl.fit(X, y)
        coef_history[i, :] = gl.coef_.flatten()
        bic[i] = calc_bic(gl.predict(X).flatten(), y, gl.coef_)
        if verbose:
            print("BIC={}".format(np.round(bic[i], 2)))
            print("Number of dropped columns: {}".format(np.sum(coef_history[i, :] == 0.0)))

    return coef_history, bic


def calc_bic(y_est, y_true, coef):
    # calc_bic(mse, sample_size, coef):
    """
    Calculate Bayesian Information Criteria (BIC).

    Parameters
    ----------
    mse : float
        Mean square error.
    sample_size: int
        Number of data points.
    coef : 1d NumpyArray
        Coefficients of linear regression.

    Returns
    ----------
    bic : float
        Calculated BIC. Smaller the better.
    """

    # from sklearn
    # https://github.com/scikit-learn/scikit-learn/blob/0d378913b/sklearn/linear_model/_least_angle.py#L1957
    n_samples = len(y_est)
    resid = y_est - y_true
    mean_squared_error = np.mean(resid**2)
    sigma2 = np.var(y_true)
    eps64 = np.finfo("float64").eps
    K = np.log(n_samples)
    df = np.sum(np.abs(coef) > 0.0)
    bic = n_samples * mean_squared_error / (sigma2 + eps64) + K * df
    return bic
    

def determine_group_order(coef_history, dic_groups):
    """
    Determine order of groups (from less important to important)

    Parameters
    ----------
    coef_history: 2d NumpyArray
        Regression coefficients. (len(penalty_facotrs) x X.shape[1]).
    dic_groups : dict
        A dictionary with group information

    Returns
    ----------
    group_order : 1d NumpyArray
        Order of groups, where less important is on the left.
    """
    
    group_order = []
    
    num_groups = dic_groups["num_grps"]
    num_penalties = coef_history.shape[0]

    sum_coef_per_groups_old = np.zeros(num_groups)
    # add to group_order if coefficients shrink to zero
    for i in range(num_penalties):
        abs_coef = np.abs(coef_history[i, :])
        sum_coef_per_groups = np.bincount(dic_groups["idx_grps"], weights=abs_coef)
        zero_coef_groups = np.where(sum_coef_per_groups == 0)[0]
        new_zero_coef_groups = np.setdiff1d(zero_coef_groups, group_order)
        ordered_new_zero_coef_groups = new_zero_coef_groups[np.argsort(sum_coef_per_groups_old[new_zero_coef_groups])]
        group_order.extend(ordered_new_zero_coef_groups)
        sum_coef_per_groups_old = sum_coef_per_groups

    # add remaining groups (order by sum of coefficients)
    if len(group_order) < coef_history.shape[1]:
        remain_groups = np.setdiff1d(np.arange(num_groups), group_order)
        idx_sort_desc = np.argsort(sum_coef_per_groups[remain_groups])[::-1]
        remain_groups = remain_groups[idx_sort_desc]
        group_order.extend(remain_groups)
    
    return np.array(group_order)[::-1]


def fit_ridge(X, y, alpha=0.1):
    """
    Fit ridge regression
    
    Parameters
    ----------
    X : 2d NumpyArray
        Explanatory variables.
    y : 1d NumpyArray
        Objective variable.
    alpha: float
        Regularization parameter for L2

    Returns
    ----------
    coef : 1d numpy array
        regression coefficients.
    """

    model = Ridge(alpha=alpha)
    model.fit(X, y)
    coef = model.coef_
    return coef.flatten()


class GroupSankeyDataProcessor():
    def __init__(self,
                 coef,
                 dic_groups,
                 group_order,
                 color_y="lightgray",
                 color_link_positive='rgba(44, 160, 44, 0.4)', # green-like color
                 color_link_negative='rgba(214, 39, 40, 0.4)', # red-like color
                 limits_sensor={'xmin': 0.20, 'xmax': 0.00, 'ymin': 0.00, 'ymax': 1.00},
                 limits_groups={'xmin': 0.75, 'xmax': 0.40, 'ymin': 0.00, 'ymax': 1.00},
                 verbose=False
                 ):
        
        # group info and coefficients
        self.dic_groups = dic_groups
        self.dic_groups["group_order"] = group_order
        self.coef_raw = coef
        self.coef_grps = np.bincount(self.dic_groups["idx_grps"], weights=np.abs(coef))
        self.idx_grp_remained = np.where(np.abs(self.coef_grps) > 0.0)[0]
        self.idx_col_remained = np.where(np.abs(coef) > 0.0)[0]
        self.num_grp_remained = len(self.idx_grp_remained)                        
        self.num_col_remained = len(self.idx_col_remained)
        self.coef_remained = coef[self.idx_col_remained]
        
        # parameters for visualization
        self.color_y = color_y
        self.color_link_positive = color_link_positive
        self.color_link_negative = color_link_negative
        self.limits_sensor = limits_sensor
        self.limits_groups = limits_groups
        self.verbose = verbose

    def gen_dicts(self):
        # generate dictionaries for skd and barchart
        dic_skd = self._gen_sankey_data()
        dic_bar = self._gen_barchart_data()
        return dic_skd, dic_bar

    def _gen_sankey_data(self):
        # Sankey data. node positions are determined by group order.
        # dictionary for sankey
        self.dic_skd = {'node_labels': np.hstack([self.dic_groups["colnames_x"][self.idx_col_remained],
                                                  self.dic_groups["uniq_grps"][self.idx_grp_remained],
                                                  self.dic_groups["colname_y"]]),
                        'source': [],
                        'target': [],
                        'node_color': [],
                        'edge_value': [],
                        'edge_color': []}

        self._add_node_colors()
        self._add_links_from_x_to_group()
        self._add_links_from_group_to_y()
        self._add_node_position()
        return self.dic_skd

    def _gen_barchart_data(self):
        # Barchart data. y-axis corresponds to sankey diagram.
        ord_sort = np.argsort(self.dic_skd['node_y'][:self.num_col_remained])
        # ord_sort = np.concatenate([ord_sort[:np.sum(self.coef_raw == 0.0)], ord_sort[np.sum(self.coef_raw == 0.0):]])
        colors = [self.color_link_negative if x < 0 else self.color_link_positive for x in self.coef_remained[ord_sort]]
        # from IPython.core.debugger import Pdb; Pdb().set_trace()
        dic_bar = {"coef": self.coef_remained[ord_sort],
                   "sensor_names": self.dic_groups["colnames_x"][self.idx_col_remained][ord_sort],
                   "bar_colors": colors}
        return dic_bar

    def _add_node_colors(self):
        # Define node colors (x, groups, y)
        palette = self._get_N_HexCol(len(self.dic_groups['uniq_grps']))
        for i in self.idx_col_remained:
            self.dic_skd["node_color"].append(palette[self._sensor_id_to_group_id(i)])
        for i in self.idx_grp_remained:
            self.dic_skd["node_color"].append(palette[i])
        self.dic_skd["node_color"].append(self.color_y)

    def _get_N_HexCol(self, N=5):
        # Random color generator
        # https://stackoverflow.com/questions/876853/generating-color-ranges-in-python
        HSV_tuples = [(x * 1.0 / N, 0.5, 0.5) for x in range(N)]
        hex_out = []
        for rgb in HSV_tuples:
            rgb = map(lambda x: int(x * 255), colorsys.hsv_to_rgb(*rgb))
            hex_out.append('#%02x%02x%02x' % tuple(rgb))
        return hex_out

    def _add_links_from_x_to_group(self):
        # Add links: x -> groups
        edge_colors = [self.color_link_positive if x > 0 else self.color_link_negative for x in self.coef_remained]
        for i in range(self.num_col_remained):
            self.dic_skd['source'].append(i)
            self.dic_skd['target'].append(self._sensor_node_id_to_group_node_id(i))
            self.dic_skd['edge_value'].append(np.abs(self.coef_remained[i]))
            self.dic_skd['edge_color'].append(edge_colors[i])

    def _add_links_from_group_to_y(self):
        # Add links: groups -> y
        for i in range(self.num_grp_remained):
            self.dic_skd['source'].append(self.num_col_remained + i)
            self.dic_skd['target'].append(self.num_col_remained + self.num_grp_remained)
            self.dic_skd['edge_value'].append(self.coef_grps[self.idx_grp_remained[i]])
            self.dic_skd['edge_color'].append("#696969")

    def _sensor_id_to_group_id(self, sensor_id):
        group_id = self.dic_groups["idx_grps"][sensor_id]
        return int(group_id)

    def _sensor_id_to_sensor_node_id(self, sensor_id):
        node_id = np.where(self.idx_col_remained == sensor_id)[0]
        return int(node_id)

    def _sensor_node_id_to_group_node_id(self, node_id):
        group_id = self.dic_groups["idx_grps"][self.idx_col_remained[node_id]]
        node_id = self._group_id_to_group_node_id(group_id)
        return int(node_id)

    def _group_id_to_group_node_id(self, group_id):
        node_id = self.num_col_remained + np.where(self.idx_grp_remained == group_id)[0]
        return int(node_id)

    def _add_node_position(self):
        # Add node positon
        # Node position of groups are generated according to selection process of GroupLASSO.
        # What makes complicated is that, we have to create a list of length(number of nodes shown in graph).
        # nodes shown/not shown is determined by edge values.
        num_nodes = len(self.dic_skd['node_labels'])
        node_x = np.array([np.nan] * num_nodes)
        node_y = np.array([np.nan] * num_nodes)

        # generate node positions: groups
        xvals_grp = np.linspace(self.limits_groups["xmin"], self.limits_groups["xmax"], self.num_grp_remained)
        wt_groups = self.coef_grps
        wt_sensor = np.abs(self.coef_raw)

        groups_y = self.limits_groups["ymin"]
        sensor_y = self.limits_sensor["ymin"]
        cnt_grp = 0
        # from IPython.core.debugger import Pdb; Pdb().set_trace()
        # position of group nodes
        for grp_idx in self.dic_groups["group_order"]:
            
            if grp_idx not in self.idx_grp_remained:
                continue 

            grp_name = self.dic_groups["uniq_grps"][grp_idx]
            node_id = self._group_id_to_group_node_id(grp_idx)
            node_label = self.dic_skd["node_labels"][node_id]
            wt = np.max([0.05, wt_groups[grp_idx]])

            node_x[node_id] = xvals_grp[cnt_grp]
            node_y[node_id] = groups_y + (wt / 2)
            groups_y += wt

            # position of sensor nodes
            idx_sensors_in_group = self.idx_col_remained[self.dic_groups['idx_grps'][self.idx_col_remained] == grp_idx]
            for j in idx_sensors_in_group:
                wt = wt_sensor[j]
                if self.verbose:
                    print("j={}, name={}, wt={}".format(j, self.dic_skd["node_labels"][j], wt))
                node_x[self._sensor_id_to_sensor_node_id(j)] = 0.05
                node_y[self._sensor_id_to_sensor_node_id(j)] = sensor_y + (wt / 2)
                sensor_y += wt
            cnt_grp += 1
            
        # normalize y positions
        node_groups_on_graph = [self._group_id_to_group_node_id(x) for x in self.idx_grp_remained]
        node_sensor_on_graph = [self._sensor_id_to_sensor_node_id(x) for x in self.idx_col_remained]
        node_y[node_groups_on_graph] = node_y[node_groups_on_graph] / np.max(node_y[node_groups_on_graph])
        node_y[node_sensor_on_graph] = node_y[node_sensor_on_graph] / np.max(node_y[node_sensor_on_graph])
        if self.num_grp_remained == 1:
            node_y[node_groups_on_graph] = 0.5
            node_x[node_groups_on_graph] = 0.5

        # position of objective variable
        node_x[-1] = 0.90
        node_y[-1] = 0.50
        self.dic_skd['node_x'] = node_x
        self.dic_skd['node_y'] = node_y

        if self.verbose:
            print('num_nodes: {}'.format(num_nodes))
            print("Node x, y positions in Skd:\n{}".format(
                np.vstack([self.dic_skd["node_labels"],
                           np.round(node_x, 2),
                           np.round(node_y, 2)]).T))

