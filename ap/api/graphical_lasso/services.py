import colorsys

import numpy as np
import pandas as pd
from sklearn.covariance import empirical_covariance, graphical_lasso, shrunk_covariance
from sklearn.preprocessing import StandardScaler

from ap.api.common.services.show_graph_services import (
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_data_from_db,
    get_filter_on_demand_data,
    is_nominal_check,
    main_check_filter_detail_match_graph_data,
)
from ap.api.sankey_plot.sankey_glasso.grplasso import labelencode_by_stat
from ap.common.common_utils import gen_sql_label
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_PLOTDATA,
    CATEGORY_COLS,
    COL_DATA_TYPE,
    DATA_SIZE,
    END_COL_NAME,
    END_PROC_ID,
    END_PROC_NAME,
    IS_CATEGORY,
    IS_INT_CATEGORY,
    IS_JUDGE,
    IS_SERIAL_NO,
    MATCHED_FILTER_IDS,
    NOT_EXACT_MATCH_FILTER_IDS,
    SHOWN_NAME,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    CacheType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log


@log_execution_time('[TRACE DATA]')
@request_timeout_handling()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.GL, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True, cache_type=CacheType.TRANSACTION_DATA)
def gen_graphical_lasso(graph_param, dic_param, df=None):
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    if df is None:
        # get data from database
        df, actual_record_number, unique_serial = get_data_from_db(
            graph_param,
            dic_cat_filters,
            use_expired_cache=use_expired_cache,
        )
        dic_param[UNIQUE_SERIAL] = unique_serial
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param)
    convert_datetime_to_ct(df, graph_param)

    # get category sensors from df
    cat_sensors = []
    cat_ids = {}

    df_sensor = pd.DataFrame()
    sensor_names = []
    process_names = []
    sensor_cols = graph_param.common.sensor_cols or []
    objective_var = graph_param.common.objective_var or None
    idx_target = None
    cat_col_details = []
    for i, col_id in enumerate(sensor_cols):
        general_col_info = graph_param.get_col_info_by_id(col_id)
        label = gen_sql_label(col_id, general_col_info[END_COL_NAME])
        if label not in df.columns:
            continue

        proc_cfg = graph_param.dic_proc_cfgs[general_col_info[END_PROC_ID]]
        is_string_col = general_col_info[IS_CATEGORY]
        if is_string_col:
            cat_sensors.append(label)
            col_detail = {
                'col_id': col_id,
                'col_shown_name': general_col_info[SHOWN_NAME],
                'col_en_name': general_col_info[END_COL_NAME],
                'data_type': general_col_info[COL_DATA_TYPE],
                'proc_id': proc_cfg.id,
                'proc_shown_name': proc_cfg.shown_name,
                'proc_en_name': proc_cfg.name_en,
                'is_category': True,
                'is_checked': is_nominal_check(col_id, graph_param),
                'is_serial_no': general_col_info[IS_SERIAL_NO],
                'is_int_category': general_col_info[IS_INT_CATEGORY],
                'is_judge': general_col_info[IS_JUDGE],
            }
            cat_col_details.append(col_detail)
            cat_ids[col_id] = label
        if label in df.columns:
            df_sensor[label] = df[label]
            sensor_names.append(general_col_info[SHOWN_NAME])
            process_names.append(general_col_info[END_PROC_NAME])
            if df_sensor[label].dtypes == 'object' and not is_string_col:
                df_sensor[label] = df_sensor[label].astype('Float64')
        if objective_var and col_id == objective_var:
            idx_target = i

    nominal_vars = []
    if graph_param.common.is_nominal_scale:
        # nominal variables are category: string or int which unique value < 128
        nominal_vars = cat_sensors
    # if re-select from modal
    if graph_param.common.nominal_vars is not None:
        nominal_vars = graph_param.common.nominal_vars
        # in case of GL, cat_sensors is label '__id__sensor_name'
        # so need to convert nominal_vars (id)
        nominal_labels = []
        for sensor_id in nominal_vars:
            if sensor_id in cat_ids.keys():
                nominal_labels.append(cat_ids[sensor_id])
        if len(nominal_labels):
            nominal_vars = nominal_labels

    alphas, best_alpha, threshold, dic_nodes, dic_edges = (None, None, None, None, None)
    # drop NA and resample if necessary
    df_sensor = df_sensor.dropna(how='any').reset_index(drop=True)

    if not df_sensor.empty:
        alphas, best_alpha, threshold, dic_nodes, dic_edges = preprocess_glasso_page(
            df_sensor,
            idx_target,
            process_names,
            sensor_names,
            cat_cols=cat_sensors,
            nominal_variables=nominal_vars,
        )

    # check filter match or not ( for GUI show )
    (
        matched_filter_ids,
        unmatched_filter_ids,
        not_exact_match_filter_ids,
    ) = main_check_filter_detail_match_graph_data(graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[ARRAY_PLOTDATA] = [alphas, best_alpha, threshold, dic_nodes, dic_edges, process_names]
    dic_param[CATEGORY_COLS] = cat_col_details

    dic_param = get_filter_on_demand_data(dic_param)

    return dic_param


@log_execution_time()
@abort_process_handler()
def preprocess_glasso_page(X, idx_target, groups: list, colnames: list, cat_cols=[], nominal_variables=[]):
    """
    Main function to generate data for GL page

    Parameters
    ----------
    X : Pandas DataFrame
        Sensor data
    idx_target : None or int
         Column index of the objective variable
    groups : list
         A list of process names of each column (shown name)
    colnames : list
         A list of sensor names of each column (shown name)
    cat_cols : list
         A list of sensor names of categorical data

    Returns
    ----------
    alphas : list
         Applied alpha (penalty factors) of glasso. Use this for the slider.
    best_alpha :
         Selected/specified alpha. Use this for the slider.
    threshold :
         Calculated/specified cutoff value of the partial coefficients.
    dic_nodes :
         A dict of DataFrames of node attributes for sigmajs
    dic_edges :
         A dict of DataFrames of edge attributes for sigmajs
    """

    # the graphical lasso
    alphas, best_alpha, parcors, best_parcor = _fit_glasso(X, idx_target, cat_cols, nominal_variables)

    # store DataFrame of data to pass to sigma.js, for each alpha
    dic_nodes = {}
    dic_edges = {}
    for i, alpha in enumerate(alphas):
        x, y = _gen_node_positions(parcors[i], idx_target)
        adj_mat = np.triu(parcors[i])
        df_nodes = _gen_df_nodes_sigmajs(x, y, colnames, groups)
        df_edges = _gen_df_edges_sigmajs(adj_mat)
        dic_nodes[alpha] = df_nodes
        dic_edges[alpha] = df_edges

    # thresholding (abs(parcor) takes [0.0, 1.0])
    threshold = np.round(np.max(np.abs(best_parcor)) * 0.3, 2)
    threshold = np.clip(threshold, 0.0, 1.0)

    return alphas, best_alpha, threshold, dic_nodes, dic_edges


@log_execution_time()
@abort_process_handler()
def _fit_glasso(X, idx_target, cat_cols, nominal_variables):
    """Fit graphical lasso with reasonable alpha sequence"""
    X = _preprocess_glasso_data(X, idx_target, cat_cols, nominal_variables=nominal_variables)

    alphas = np.round(10 ** (np.linspace(-2, 0, num=10)), 2).tolist()
    ggm = GaussianGraphicalModel(alphas=alphas, idx_target=idx_target)
    ggm.fit(X)
    best_alpha, best_parcor = ggm._get_best_results()
    parcors = ggm.results['parcor']
    return alphas, best_alpha, parcors, best_parcor


@log_execution_time()
@abort_process_handler()
def _preprocess_glasso_data(X, idx_tgt, cat_cols, max_datapoints=10_000, verbose=True, nominal_variables=[]):
    """drop Infs, NAs, resampling, convert string variables and zero-variance variables"""

    if X.shape[0] > max_datapoints:
        np.random.seed(1)
        X = X.sample(n=max_datapoints, replace=False)
        if verbose:
            print('Number of data points exceeded {}. Data is automatically resampled. '.format(max_datapoints))

    # convert string variables
    if (idx_tgt is not None) and (len(cat_cols) > 0):
        y = X.iloc[:, idx_tgt].values.copy()
        # convert y to np array with type is float
        y = np.array(y, dtype='float64')
        for col in cat_cols:
            is_nominal_scale = col in nominal_variables
            X.loc[:, col] = labelencode_by_stat(
                X[col].astype(str).values.flatten(),
                y.flatten(),
                is_nominal_scale=is_nominal_scale,
            )

    # drop infinite
    X = X[np.isfinite(X).all(1)]

    # replace zero variance variable with an independent random variable
    is_zerovar = X.var(axis=0).values == 0
    if np.sum(is_zerovar > 0):
        for col in X.columns[is_zerovar]:
            X[col] = np.random.uniform(size=X.shape[0])
    return X


class GaussianGraphicalModel:
    """
    Calculate sparse partial correlation matrix with GraphicalLASSO

    Parameters:
    ----------
    alphas: float or a list, default=[0.3]
        Shrinkage paramteter. High value returns more sparse result.

    idx_target: int
        Column index of target variable (optional).

    Attributes:
    ----------
    results: dict
        A dict object with following keys:
            alpha: Penalty factor, list of float values
            parcor: Partial correlation matrix, list of NumpyArrays of shape (X.shape[1], X.shape[1])
            ebic: EBIC, list of float values
    """

    def __init__(self, alphas=None, idx_target=None):
        self.alphas = [alphas] if not isinstance(alphas, list) else alphas
        self.results = None
        self.idx_target = idx_target

    def fit(self, X):
        """Fit GraphcialLASSO
        Inputs:
        X: 2d NumpyArray or pandas dataframe
           nrow, ncol = sample_size, num_vars
        """
        scaler = StandardScaler().fit(X)
        X = scaler.transform(X)

        # covariance matrix
        # shrink eigenvalue for ill-conditioned data.
        # https://stats.stackexchange.com/questions/172911/graphical-lasso-numerical-problem-not-spd-matrix-result
        emp_cov = empirical_covariance(X)
        eigenvals, _ = np.linalg.eig(emp_cov)
        if np.max(eigenvals) - np.min(eigenvals) > 1:
            print('Shrink covariance, as detected broad eigenvalue range of covariance matrix.')
            emp_cov = shrunk_covariance(emp_cov, shrinkage=0.8)

        # fit glasso along specified alphas
        dic_res = {'alpha': [], 'parcor': [], 'ebic': []}
        for alpha in self.alphas:
            try:
                _, pmat = graphical_lasso(emp_cov, alpha)
                dic_res['alpha'].append(alpha)
                dic_res['parcor'].append(self._precision2parcor(pmat))
                dic_res['ebic'].append(self._calc_extended_bic(pmat, emp_cov, X.shape[0]))
            except Exception:
                print('Poorly conditioned on alpha={}. Skip'.format(alpha))

        self.results = dic_res

    def _precision2parcor(self, pmat):
        """Convert precision matrix to partial correlation matrix"""
        parcor = -pmat / (np.sqrt(np.diag(pmat)).reshape(-1, 1) @ np.sqrt(np.diag(pmat)).reshape(1, -1))
        np.fill_diagonal(parcor, 0.0)  # no self loops
        return parcor

    def _calc_extended_bic(self, pmat, covmat, sample_size: int, gamma=0.3) -> float:
        """Compute extended BIC
        Reference:
        ----------
        Rina Foygel and Mathias Drton (2010)
        "Extended Bayesian Information Criteria for Gaussian Graphical Models"
        https://arxiv.org/abs/1011.6640
        """
        # log-likelihood (eq.2)
        loglik = 0.5 * sample_size * (np.log(np.linalg.det(pmat)) - np.trace(np.dot(covmat, pmat)))
        # number of edges
        num_nodes = pmat.shape[0]
        E = 0.5 * (np.sum(pmat != 0, axis=(0, 1)) - num_nodes)
        # (eq.1)
        term1 = -2 * loglik
        term2 = E * np.log(sample_size)
        term3 = 4 * E * gamma * np.log(num_nodes)
        return term1 + term2 + term3

    def _get_best_results(self):
        """Select the best results"""
        if self.idx_target is None:
            # if no target, select the results with lowest EBIC
            idx = np.argmin(self.results['ebic'])
            best_alpha = self.results['alpha'][idx]
            best_parcor = self.results['parcor'][idx]
        else:
            # if specified, select the results with the reasonable num of direclty connected nodes
            d = self.results['parcor'][0].shape[0]  # controlls the number of directly connected variables
            obj_num = np.min([10, np.ceil((d - 1.0) / 3.0)])

            best_alpha = self.alphas[0]
            best_parcor = self.results['parcor'][0]
            for i in reversed(range(len(self.alphas))):
                num_direct_vars = np.sum(self.results['parcor'][i][self.idx_target, :] != 0)
                print('alpha: {}, num_direct_vars: {}'.format(self.alphas[i], num_direct_vars))
                if num_direct_vars >= obj_num:
                    best_alpha = self.alphas[i]
                    best_parcor = self.results['parcor'][i]
                    break
        return best_alpha, best_parcor.copy()


def _gen_node_positions(parcor, idx_target=None):
    """Generate node positions for graphical lasso"""

    def _gen_node_positions_glasso(d: int, radius=10):
        """circle layout"""
        step = 2 * np.pi / d
        theta = np.arange(d) * step
        x = radius * np.sin(theta)
        y = radius * np.cos(theta)
        x = x.tolist()
        y = y.tolist()
        return x, y

    def _gen_node_positions_tlasso(d: int, colidx_per_layer: list):
        """right to left layout"""

        def gen_layer_positions(num_vars: int, layer=1):
            if layer == 0:
                x = np.full(num_vars, 5)
                y = np.array([0.0])
                if num_vars > 1:
                    y = np.linspace(1, -1, num_vars)
            else:
                theta = np.pi
                min_num = 1
                max_num = 5
                if (num_vars > min_num) and (num_vars < max_num):
                    theta = np.linspace(7 / 8 * np.pi, 9 / 8 * np.pi, num_vars)
                elif num_vars >= max_num:
                    theta = np.linspace(6 / 8 * np.pi, 10 / 8 * np.pi, num_vars)
                x = 10 * np.cos(theta) + 10 - (layer - 1) * 5
                y = 5 * np.sin(theta)
            return x, y

        x = np.zeros(d)
        y = np.zeros(d)
        for i in range(len(colidx_per_layer)):
            idx = colidx_per_layer[i]
            if len(idx) > 0:
                x[idx], y[idx] = gen_layer_positions(len(idx), layer=i)
        return x, y

    def _get_colidx_per_layer(parcor, idx_target, num_layers=3, verbose=False):
        """Get column index per layer, based on the partial correlation matrix"""

        def extract_connected_idx(parcor, from_idx, to_idx):
            """Extract index of directly connected nodes"""
            idx_candidates = np.where(parcor[np.ix_(from_idx, to_idx)].reshape(len(from_idx), len(to_idx)) != 0)[0]
            idx_connected = np.unique(idx_candidates)
            return from_idx[idx_connected]

        # recursively extract directly correlated variables starting from target variable
        idx_tgt = [idx_target]
        idx_all = np.arange(0, parcor.shape[0], 1)
        idx_remain = np.setdiff1d(idx_all, idx_tgt)
        idx_per_layer = [np.array(idx_tgt)]
        if verbose:
            print('==========\nall: {}'.format(idx_all))
        for i in range(1, num_layers):
            if verbose:
                print('from: {}'.format(idx_remain))
                print('to: {}'.format(idx_per_layer[i - 1]))
            connected_idx = extract_connected_idx(parcor, from_idx=idx_remain, to_idx=idx_per_layer[i - 1])
            idx_remain = np.setdiff1d(idx_remain, connected_idx)
            if len(connected_idx) == 0:
                break
            if len(idx_remain) == 0:
                break
            idx_per_layer.append(connected_idx)
            if verbose:
                print('added: {}'.format(connected_idx))
                print('remain: {}'.format(idx_remain))
        idx_per_layer.append(idx_remain)
        return idx_per_layer

    if idx_target is None:
        x, y = _gen_node_positions_glasso(parcor.shape[0])
    else:
        colidx_per_layer = _get_colidx_per_layer(parcor, idx_target)
        x, y = _gen_node_positions_tlasso(parcor.shape[0], colidx_per_layer)
    return x, y


# -- functions for sigmajs --


def _gen_proc_colorcodes(procnames):
    """
    generate color codes of each process
    :param procnames:
    :return: node_colors
    """

    def get_n_hex_col(N=5):
        """Random color generator (used to generate colors per process)"""
        HSVs = [(x * 1.0 / N, 0.5, 0.5) for x in range(N)]
        hex_colorcodes = []
        for _rgb in HSVs:
            rgb = (int(x * 255) for x in colorsys.hsv_to_rgb(*_rgb))
            hex_colorcodes.append('#%02x%02x%02x' % tuple(rgb))
        return hex_colorcodes

    # colors
    uniq_grps, idx_grps = np.unique(procnames, return_inverse=True)
    num_grps = len(uniq_grps)
    colorcodes = get_n_hex_col(num_grps)
    node_colors = np.array(colorcodes)[np.array(idx_grps)]
    return node_colors


def _gen_df_nodes_sigmajs(x, y, colnames, groups):
    # generate node data.frame (id, label, size, x, y)
    d = len(y)
    node_colors = _gen_proc_colorcodes(groups)
    df_node = pd.DataFrame(
        {
            'id': ['n' + str(x) for x in np.arange(d)],
            # "label": [str(x)+"\\\\n"+str(y) for x, y in zip(groups, colnames)],
            # "label": [str(x)+" | "+str(y) for x, y in zip(groups, colnames)],
            'label': [str(y) for x, y in zip(groups, colnames)],
            'size': [10] * d,
            'x': x,
            'y': [-x for x in y],  # on sigmajs, (0, 0) is the upper left corner
            'color': node_colors,
        },
    )
    return df_node


def _gen_df_edges_sigmajs(adj_mat):
    # generate edge data.frame (id, source, target)
    color_edge_positive = ('rgba(44, 160, 44, 0.4)',)  # green-like color
    color_edge_negative = ('rgba(214, 39, 40, 0.4)',)  # red-like color

    from_idxs, to_idxs = np.where(np.abs(adj_mat) > 0)
    edge_values = adj_mat[from_idxs, to_idxs]
    num_edges = len(edge_values)
    df_edge = pd.DataFrame(
        {
            'id': ['e' + str(x) for x in np.arange(num_edges)],
            'label': [str(np.round(x, 2)) for x in edge_values],  # please apply significant_digit
            'size': np.abs(edge_values),
            'source': ['n' + str(x) for x in from_idxs],
            'target': ['n' + str(x) for x in to_idxs],
            'hover_color': ['#00aeff'] * num_edges,
            'color': [color_edge_positive if x >= 0 else color_edge_negative for x in edge_values],
            'type': ['line'] * num_edges,
        },
    )
    return df_edge
