import warnings
from collections import defaultdict
from dataclasses import dataclass
from typing import TypedDict

import networkx as nx
import numpy as np
import pandas as pd
from lingam import DirectLiNGAM
from lingam.utils import make_prior_knowledge
from loguru import logger
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LassoLarsIC, LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler

from ap.api.graphical_lasso.services import GaussianGraphicalModel
from ap.api.sankey_plot.sankey_glasso.grplasso import subsample_for_skd
from ap.common.log import log_execution_time


@dataclass(frozen=True)
class CRPConfig:
    """Class to store configurations for CRP"""

    pos_color: str = 'rgba(44, 160, 44, 0.4)'  # green-like color
    neg_color: str = 'rgba(214, 39, 40, 0.4)'  # red-like color


@dataclass()
class CRPPriorKnowledge:
    """Class to store prior knowledges for CRP"""

    ycol: list[str]
    xcols: list[str]
    groups: list[str]
    group_order: list[str]
    cat_cols: list[str]
    grp_order_map: dict
    col_grp_order_map: dict
    prior_knowledge_matrix: np.array = None


@dataclass()
class CRPFitResults:
    """Class to store causal discovery results"""

    adjacency_matrix: np.array
    labels: list[str]
    causal_order_map: dict
    importance: dict


class CRPBarDict(TypedDict):
    """Data for barchart"""

    names: list[str]
    values: list[float]
    color: list[str]


class CRPNetDict(TypedDict):
    """Data for network graph. Assume vis network"""

    node_labels: list[str]
    node_positions_x: list[float]
    node_positions_y: list[float]
    edges: tuple[str, str, float, str]  # (From, To, Width, Color)


@log_execution_time()
def preprocess_crppage(
    x: pd.DataFrame,
    y: pd.Series,
    groups: list[str],
    group_order: list[str],
    cat_cols: list[str] = [],
) -> tuple[CRPBarDict, CRPNetDict]:
    """Perform causal discovery

    Parameters
    ----------
    X : pd.DataFrame
        Explanatory variables.
    y : pd.Series
        Objective variable. Uses .name property for visualization.
    groups : list[str]
        A list of groups assigned to each explanatory variables.
        Example: ["process0", "process0", "process1", "process2", ...]
    group_order : list[str]
        A list of processes in topological order, based on data link config.
        Example: ["process0", "process1"]
    cat_cols : list[str]
        A list of sensor names (shown names) of categorical values.
    """
    if len(groups) != x.shape[1]:
        raise ValueError('Length of argument: groups must be equal to X.shape[1].')

    # Initialization
    np.random.default_rng(1)
    grp_order_map = {g: i for i, g in enumerate(group_order)}
    col_grp_order_map = {c: grp_order_map[g] for c, g in zip(x.columns, groups, strict=True)}
    prior = CRPPriorKnowledge(
        [y.name],
        x.columns.to_list(),
        groups,
        group_order,
        cat_cols,
        grp_order_map,
        col_grp_order_map,
    )

    # Preprocessing
    idx = subsample_for_skd(y, is_categorical=False, max_datapoints=10_000)
    x = x.iloc[idx, :].reset_index(drop=True)
    y = y[idx].reset_index(drop=True)
    x_r, y_r = preprocess_causal_discovery(x, y, prior)

    # Run causal discovery
    prior.prior_knowledge_matrix = make_prior_knowledge_matrix(x_r, y_r, prior)
    fitted = fit_causal_discovery(x_r, y_r, prior)

    # Postprocessing
    fitted = postprocess_causal_discovery(fitted, prior, x, y)

    # Make edges, node positions for network graph
    edges = make_crp_edges(fitted.adjacency_matrix, fitted.labels)
    labels, pos_x, pos_y = make_crp_node_positions(prior, fitted)

    # Store results
    cfg = CRPConfig()
    dic_bar = {
        'names': labels[1:],
        'values': [fitted.importance[c] for c in labels[1:]],
        'colors': [cfg.pos_color if fitted.importance[c] >= 0 else cfg.neg_color for c in labels[1:]],
    }
    dic_net = {
        'node_labels': labels,
        'node_positions_x': pos_x,
        'node_positions_y': pos_y,
        'edges': edges,
    }
    return dic_bar, dic_net


# ----- Preprocessing


@log_execution_time()
def preprocess_causal_discovery(
    x: pd.DataFrame, y: pd.Series, prior: CRPPriorKnowledge
) -> tuple[pd.DataFrame, pd.Series]:
    """Preprocessing for causal discovery"""
    x, y = scale_numeric_cols(x, y, prior)
    if prior.cat_cols:
        x, y = regress_out_categoricals(x, y, prior)
    if x.shape[1] > 50:
        x, y = filter_variables_with_glasso(x, y)
    return x, y  # X: X without cat_cols


@log_execution_time()
def scale_numeric_cols(x: pd.DataFrame, y: pd.Series, prior: CRPPriorKnowledge) -> tuple[pd.DataFrame, pd.Series]:
    """Apply Standard scaler to numeric variables"""
    encoder = StandardScaler().set_output(transform='pandas')
    for col in x.columns:
        if col not in prior.cat_cols:
            x[[col]] = encoder.fit_transform(x[[col]])
    y = encoder.fit_transform(pd.DataFrame(y)).squeeze()
    return x, y


@log_execution_time()
def regress_out_categoricals(x: pd.DataFrame, y: pd.Series, prior: CRPPriorKnowledge) -> tuple[pd.DataFrame, pd.Series]:
    """Fit categorical data to numeric data, and calculate residuals.
    Only regress out categoricals of preceding groups."""

    def _calc_resid(x: pd.DataFrame, y: pd.DataFrame) -> pd.DataFrame:
        """Fit linear regressin with sum encoder, and calculate residuals.
        Sum encoder is to avoid multicollinearity."""
        encoder = SimpleSumEncoder()
        encoder.fit(x)
        x = encoder.transform(x)
        mdl = LinearRegression()
        mdl.fit(x, y)
        resid = y - mdl.predict(x)
        return resid

    logger.info('Regressing out categorical features')
    m = prior.col_grp_order_map
    ccols = prior.cat_cols
    num_cols = [c for c in x.columns if c not in ccols]

    # Regress out from explanatory variables
    x_r = x.drop(prior.cat_cols, axis=1).copy()
    y_r = y.copy()
    for ycol in num_cols:
        xcols = [c for c in prior.cat_cols if m[c] <= m[ycol]]
        if xcols:
            x_r[[ycol]] = _calc_resid(x[xcols], x[[ycol]])
    # Regress out from objective variable
    xcols = [c for c in ccols if m[c] <= max(m.values()) + 1]
    if xcols:
        y_r = pd.Series(_calc_resid(x[xcols], y), name=y.name)
    return x_r, y_r


class SimpleSumEncoder(BaseEstimator, TransformerMixin):
    """Sum coding"""

    def __init__(self, handle_unknown='ignore', return_df=True, dtype=float) -> None:
        self.handle_unknown = handle_unknown
        self.return_df = return_df
        self.dtype = dtype
        self.category_maps_ = None
        self.output_columns_ = None
        self.origin_columns_ = None

    def fit(self, x):
        x = pd.DataFrame(x).copy()
        self.cols_ = x.columns.tolist()

        self.category_maps_ = {}
        out_cols = []
        ori_cols = []
        for c in self.cols_:
            s = x[c].astype('category')
            cats = list(s.cat.categories)
            self.category_maps_[c] = cats
            # new column name: "c[cat]""
            out_cols.extend([f'{c}[{k}]' for k in cats])
            ori_cols.extend([c for _ in cats])
        self.output_columns_ = out_cols
        self.origin_columns_ = ori_cols
        return self

    def transform(self, x):
        if self.category_maps_ is None:
            raise RuntimeError('Call fit before transform.')
        x = pd.DataFrame(x).copy()

        parts = []
        for c in self.cols_:
            cats = self.category_maps_[c]
            k = len(cats)
            s = x[c]
            # fix categorical order
            s = pd.Categorical(s, categories=cats, ordered=False)

            # One-Hot -> then subtract 1/K
            o = pd.get_dummies(s, prefix=c, prefix_sep='[', dtype=self.dtype)
            o.columns = [col + ']' if not col.endswith(']') else col for col in o.columns]

            needed = [f'{c}[{k}]' for k in cats]
            for col in needed:
                if col not in o.columns:
                    o[col] = 0
            o = o[needed]

            e = o - (1.0 / k)

            # handle unknown categories
            if self.handle_unknown == 'ignore':
                unknown_mask = pd.isna(s)
                e.loc[unknown_mask, :] = np.nan
            elif self.handle_unknown == 'error':
                if pd.isna(s).any():
                    raise ValueError(f"Unknown category found in column '{c}'.")
            else:
                raise ValueError("handle_unknown must be 'ignore' or 'error'.")

            parts.append(e.astype(self.dtype))

        out = pd.concat(parts, axis=1)
        if self.return_df:
            # 列順を安定化
            for col in self.output_columns_:
                if col not in out.columns:
                    out[col] = np.nan
            out = out[self.output_columns_]
            return out
        else:
            return out.to_numpy(dtype=self.dtype)


@log_execution_time()
def filter_variables_with_glasso(x: pd.DataFrame, y: pd.Series) -> tuple[pd.DataFrame, pd.Series]:
    """Filter variable with graphical lasso.
    Variables those are reachable to the objective (first column of df) are selected.
    Especially works when there are many variables.
    """

    def _extract_variables_with_reachability(adj_matrix, cols: list[str], tgt_idx=0, threshold=1e-3) -> list[str]:
        """Check reachability of each variables to the objective variable"""
        adj_matrix = np.abs(adj_matrix) > threshold
        g = nx.from_numpy_array(adj_matrix)
        connected_nodes = nx.node_connected_component(g.to_undirected(), tgt_idx)
        relevant_features = [cols[i] for i in connected_nodes if cols[i] != cols[tgt_idx]]
        return relevant_features

    logger.info('Filtering variables with Graphical LASSO.')
    df = pd.concat([y, x], axis=1)

    # Fit GGM
    alphas = np.logspace(np.log10(0.01), np.log10(1.0), 10).tolist()
    ggm = GaussianGraphicalModel(alphas=alphas)
    ggm.fit(df)
    best_alpha, _ = ggm._get_best_results()

    # Re-fit with shrinked alpha (to avoid false negatives)
    ggm = GaussianGraphicalModel(alphas=[0.5 * best_alpha])
    ggm.fit(df)
    _, parcor = ggm._get_best_results()

    cols = df.columns.tolist()
    relevant_features = _extract_variables_with_reachability(parcor, cols)
    logger.info(f'Selected {len(relevant_features)} numeric variables: {",".join(relevant_features)}')
    return x[relevant_features], y


# ----- Causal discovery


def make_prior_knowledge_matrix(X: pd.DataFrame, y: pd.Series, prior: CRPPriorKnowledge) -> np.array:
    """Make a numpy array for prior knowledge.
    Assume that y is the first column.
    1. Group order: post-processes does not affect pre-processes
    2. Sink: assume that objective variable is the sink
    """
    # Generate tuples of NO causal relationships
    cols = [y.name, *X.columns.to_list()]
    m = prior.col_grp_order_map
    m = {y.name: max(m.values())} | m
    no_paths = []
    for idx_fr, col_fr in enumerate(cols):
        for idx_to, col_to in enumerate(cols):
            if m[col_fr] > m[col_to]:
                no_paths.append((idx_fr, idx_to))
    # Generate matrix for prior knowledge
    idx_exo = [i for i, x in enumerate(cols) if x in prior.cat_cols]
    prior_knowledge = make_prior_knowledge(
        n_variables=len(cols),
        sink_variables=[0],
        no_paths=no_paths,
        exogenous_variables=idx_exo,
    )
    return prior_knowledge  # (row, col) = (to, from)


@log_execution_time()
def fit_causal_discovery(X: pd.DataFrame, y: pd.Series, prior: CRPPriorKnowledge) -> CRPFitResults:
    """Calculate adjacency matrix and causal order by causal discovery method"""
    warnings.filterwarnings('ignore', category=ConvergenceWarning, module='sklearn')
    df = pd.concat([y, X], axis=1)
    fitted = fit_directlingam(df, prior.prior_knowledge_matrix)
    return fitted


def fit_directlingam(df, prior_knowledge_matrix):
    """Fit DirectLiNGAM"""
    # Estimate DAG
    mdl = DirectLiNGAM(prior_knowledge=prior_knowledge_matrix)
    mdl.fit(df)
    causal_order_map = {c: mdl.causal_order_.index(i) for i, c in enumerate(df.columns)}

    # Estimate total Effects
    tot_effects = {}
    for i in range(1, df.shape[1]):
        tot_effect = mdl.estimate_total_effect(df, i, 0).item()
        tot_effects[df.columns[i]] = tot_effect
    return CRPFitResults(mdl.adjacency_matrix_, df.columns.tolist(), causal_order_map, tot_effects)


# ----- Postprocessing


@log_execution_time()
def postprocess_causal_discovery(
    fitted: CRPFitResults, prior: CRPPriorKnowledge, X: pd.DataFrame, y: pd.Series
) -> CRPFitResults:
    """Postprocessing"""
    # combine categorical feature information to causal discovery results
    if prior.cat_cols:
        # Add cat_cols to the causal_orders
        m_grp = prior.col_grp_order_map
        m_ord = fitted.causal_order_map
        for cat_col in prior.cat_cols:
            new_ord = 0
            new_grp = m_grp[cat_col]
            ref_cols = list(m_ord.keys())
            for ref_col in ref_cols:
                # count up order if objective
                if ref_col == prior.ycol[0]:
                    m_ord[ref_col] += 1
                    continue
                ref_grp = m_grp[ref_col]
                # count up order if same or subsequent group
                if new_grp <= ref_grp:
                    m_ord[ref_col] += 1
                else:
                    new_ord = max(new_ord, m_ord[ref_col] + 1)
                m_ord[cat_col] = new_ord
        fitted.causal_order_map = m_ord

        # Estimate causal effects
        adj_mat_col2num = estimate_direct_effects_from_cat_cols(fitted, prior, X, y)
        # Join them to the adjacency matrix
        fitted.adjacency_matrix, fitted.labels = extend_adj_mat(
            fitted.adjacency_matrix,
            fitted.labels,
            adj_mat_col2num,
            prior.cat_cols,
        )
        # Add importance (total effects)
        coefs = estimate_total_effects_from_cat_cols(fitted, prior, X, y)
        fitted.importance = fitted.importance | coefs
        # Pruning
        fitted = prune_isolated_cols(fitted, prior)
    return fitted


@log_execution_time()
def estimate_direct_effects_from_cat_cols(
    fitted: CRPFitResults, prior: CRPPriorKnowledge, X: pd.DataFrame, y: pd.Series
):
    """Estimate edges and effects from categorical features"""

    def _calc_cat_effects(df, ycol, xcols, cat_cols):
        """Fit linear regressin with sum encoder, and calculate residuals.
        Sum encoder is to avoid multicollinearity."""
        cat_cols = list(set(xcols) & set(cat_cols))
        num_cols = list(set(xcols) - set(cat_cols))

        # Fit ordinal regression
        encoder = SimpleSumEncoder()
        encoder.fit(df[cat_cols])
        df_cat = encoder.transform(df[cat_cols])
        if num_cols:
            df[num_cols] = StandardScaler().fit_transform(df[num_cols])
            x = pd.concat([df_cat, df[num_cols]], axis=1)
        else:
            x = df_cat
        y = df[ycol]
        mdl = Ridge(alpha=1)
        mdl.fit(x, y)

        # Fit Adaptive LASSO
        weights = np.power(np.abs(mdl.coef_), 1.0)
        mdl = LassoLarsIC(criterion='bic')
        mdl.fit(x * weights, y.to_numpy().ravel())

        enc_cols = encoder.origin_columns_
        coefs = defaultdict(list)
        for col, val in zip(enc_cols, mdl.coef_[: len(enc_cols)], strict=True):
            coefs[col].append(abs(val))
        coefs = {k: sum(v) / len(v) for k, v in coefs.items()}
        return coefs

    df = pd.concat([y, X], axis=1)
    m = fitted.causal_order_map
    m = {prior.ycol[0]: max(m.values())} | m
    ycols = fitted.labels
    ccols = prior.cat_cols
    adj_mat = np.zeros((len(ycols), len(ccols)))
    for ycol in ycols:
        xcols = [c for c in ycols + ccols if (m[c] <= m[ycol]) and (c != ycol)]
        if list(set(xcols) & set(ccols)):
            coefs = _calc_cat_effects(df, ycol, xcols, ccols)
            i = ycols.index(ycol)
            for ccol in coefs.keys():
                j = ccols.index(ccol)
                adj_mat[i, j] = coefs[ccol]
    return adj_mat


@log_execution_time()
def estimate_total_effects_from_cat_cols(
    fitted: CRPFitResults, prior: CRPPriorKnowledge, X: pd.DataFrame, y: pd.Series
):
    def _calc_cat_effects(x: pd.DataFrame, y: pd.DataFrame) -> pd.DataFrame:
        """Fit linear regressin with sum encoder, and calculate residuals.
        Sum encoder is for interpretability and to avoid rank deficiency.
        However, it does not improve multicollinearity."""
        encoder = SimpleSumEncoder()
        encoder.fit(x)
        x = encoder.transform(x)
        mdl = Ridge(alpha=1.0)
        mdl.fit(x, y)

        enc_cols = encoder.origin_columns_
        coefs = defaultdict(list)
        for col, val in zip(enc_cols, mdl.coef_[: len(enc_cols)], strict=True):
            coefs[col].append(abs(val))
        coefs = {k: (sum(v) / len(v)).item() for k, v in coefs.items()}
        return coefs

    coefs = {}
    for col in prior.cat_cols:
        coefs = coefs | _calc_cat_effects(X[[col]], y)
    return coefs


def extend_adj_mat(a, cols_a, b, cols_b):
    len_a = len(cols_a)
    len_b = len(cols_b)
    len_c = len_a + len_b
    cols_c = cols_a + cols_b
    c = np.zeros((len_c, len_c), dtype=a.dtype)
    c[:len_a, :len_a] = a
    c[:len_a, len_a:] = b
    return c, cols_c


def prune_isolated_cols(fitted: CRPFitResults, prior: CRPPriorKnowledge) -> CRPFitResults:
    """Prune isolated columns from adjacency matrix, labels and importance."""
    cols = fitted.labels
    adj = fitted.adjacency_matrix

    # Calculate total effects
    drop_idxs = []
    drop_cols = []
    for i, col in enumerate(cols):
        tot = np.sum(adj[i, :]) + np.sum(adj[:, i])
        if tot == 0.0:
            drop_idxs.append(i)
            drop_cols.append(col)

    # Drop isolated columns
    for col in drop_cols:
        if col != prior.ycol[0]:
            del fitted.importance[col]
    fitted.adjacency_matrix = np.delete(np.delete(adj, drop_idxs, axis=0), drop_idxs, axis=1)
    fitted.labels = [c for c in fitted.labels if c not in drop_cols]
    return fitted


# ----- Visualization


def make_crp_edges(adjacency_matrix, labels):
    """Make edges for vis network: (label_from, label_to, value, color)"""
    edges = []
    a = adjacency_matrix.T
    n = a.shape[0]
    for i in range(n):
        for j in range(n):
            if a[i, j]:
                edges.append(
                    [
                        labels[i],
                        labels[j],
                        np.abs(a[i, j]).item(),
                        CRPConfig().neg_color if a[i, j] < 0 else CRPConfig().pos_color,
                    ]
                )
    return edges


def make_crp_node_positions(
    prior: CRPPriorKnowledge,
    fitted: CRPFitResults,
    window_size_x=1000,
    window_size_y=600,
    center_origin=True,
) -> tuple[float, float]:
    """Make node positions for network charts.
    Include Objective variable + Categorical variables + Selected variables
    """
    ycol = prior.ycol
    xcols = list(set(fitted.labels) - set(ycol))

    # Make dataframes to store attributes
    df_y = pd.DataFrame(
        {
            'idx': -1,
            'col': ycol,
            'cat': False,
            'grp': None,
            'ord': -1,
            'cum': 1,
        },
        index=[0],
    )
    df_x = pd.DataFrame(
        {
            'idx': range(len(xcols)),
            'col': xcols,
            'cat': [c in prior.cat_cols for c in xcols],
            'grp': [prior.col_grp_order_map[c] for c in xcols],
            'ord': [fitted.causal_order_map[c] for c in xcols],
        }
    )
    n_groups = len(prior.group_order)
    max_group_size = df_x.groupby('grp')['grp'].value_counts().max()
    max_exogenouses = df_x.groupby('grp')['cat'].sum().max()

    # Make base x-value and y-value
    xmin, xmax = 0.05, 0.95
    ymin, ymax = 0.05, 0.95
    dx = (xmax - xmin) / (n_groups + 1 + 1)  # +1 for objective
    dy = (ymax - ymin) / (max_group_size + 1)
    base_x = {i: xmin + dx * (i + 1) for i, _ in enumerate(prior.group_order)}
    base_y = ymin + dy * max_exogenouses

    # Make x-axis values
    # 0:left-end, 1:right-end
    # Based on the base x-value, make x-values for each node
    xvals = []
    for i, grp in enumerate(df_x.grp):
        if df_x.col[i] in prior.cat_cols:
            xvals.append(base_x[grp] - 0.15 * dx)
        else:
            xvals.append(base_x[grp] + 0.25 * dx)
    df_y['x'] = xmax - dx
    df_x['x'] = xvals

    # Make y-axis values
    # 0:top, 1:bottom
    # Based on the base y-value, make y-values for each node
    df_x = df_x.sort_values('ord', ascending=True).reset_index(drop=True)
    df_x['cum'] = df_x.groupby(['grp', 'cat']).cumcount() + 1
    yvals = []
    for i in range(df_x.shape[0]):
        if df_x.cat[i]:
            yvals.append(base_y - dy * df_x.cum[i])
        else:
            yvals.append(base_y + dy * (df_x.cum[i] - 1))
    df_y['y'] = base_y + dy
    df_x['y'] = yvals

    # Concat
    df = pd.concat([df_y, df_x], axis=0)
    df = df.sort_values('idx')
    df = df.reset_index(drop=True)
    df = df.drop('cum', axis=1)

    if center_origin:
        df['x'] = df['x'] - (xmax - xmin) / 2.0
        df['y'] = df['y'] - (ymax - ymin) / 2.0
    df['x'] = df['x'] * window_size_x
    df['y'] = df['y'] * window_size_y
    return df['col'], df['x'].tolist(), df['y'].tolist()
