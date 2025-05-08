import colorsys
import logging
import warnings

import numpy as np
import pandas as pd
from group_lasso import GroupLasso, LogisticGroupLasso
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LassoCV, LogisticRegressionCV, Ridge, RidgeClassifier
from sklearn.metrics import (
    accuracy_score,
    auc,
    log_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

logger = logging.getLogger(__name__)

# - preprocess_skdpage()
#   # group lasso
#   - calc_coef_and_group_order()
#       - fit_grplasso()
#           - calc_bic()
#       - determine_group_order()
#       - fit_ridge()
#   # generate dict for skd and barchart
#   - GroupSankeyDataProcessor


def preprocess_skdpage(
    X,
    y,
    groups: list,
    colnames_x: list,
    colname_y: str,
    cat_cols=[],
    penalty_factors=[0.0, 10.0, 20.0, 50.0],
    strengthen_selection=False,
    max_datapoints=5000,
    verbose=False,
    colids_x=[],
    nominal_variables=[],
    objective_var_shown_name='',
):
    """
    Main function to generate data for SkD page (with group lasso)

    Parameters
    ----------
    X : pandas DataFrame
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
    cat_cols : list
        A list of sensor names of categorical values.
    penalty_factors : list
        Reguralization factor for group lasso.
    strengthen_selection: True/False
        If True, search appropriate parameter for L1 penalty for more variable selection
    max_datapoints : int
        If X.shape[0] exceeds this value, take random samples from X to save time.
    verbose : True/False
        If True, print info
    objective_var_shown_name : str
        Example: MagazineNo
    Returns
    ----------
    dic_skd : dict
        A set of data used for sankey diagram
    dic_bar : dict
        A set of data used for barchart
    dic_scp : dict
        A set of data used for scatter plots
    dic_tbl : dict
        A set of data used for table
    idx: 1d NumpyArray
        Index of rows used for training the model
    """
    np.random.default_rng(1)

    # detect categorical data
    y = y.flatten()
    is_categorical = is_categorical_objective(y)
    if is_categorical:
        logger.info('Fitting logistic regression model')

    # sub-sampling
    # - regression: random sampling
    # - classification: adjust imbalance
    idx = subsample_for_skd(y, is_categorical, max_datapoints)
    X = X.iloc[idx, :].reset_index(drop=True)
    y = y[idx]

    # group lasso and ridge regression
    ## prepare group information
    uniq_grps, idx_grps = np.unique(groups, return_inverse=True)
    dic_groups = {
        'colnames_x': np.array(colnames_x),
        'colids_x': np.array(colids_x),
        'colname_y': colname_y,
        'cat_cols': cat_cols,
        'nominal_variables': nominal_variables,
        'groups': groups,  # group names (raw)
        'idx_grps': idx_grps,  # group names (int)
        'uniq_grps': uniq_grps,  # unique group names
        'num_grps': len(uniq_grps),
        'classes': None,
        'objective': objective_var_shown_name,
    }
    if is_categorical:
        dic_groups['classes'] = np.unique(y).tolist()

    ## fit models
    coef, group_order, fitted_values, fitted_probs = calc_coef_and_group_order(
        X,
        y,
        dic_groups,
        penalty_factors,
        is_categorical,
        strengthen_selection,
        verbose=verbose,
        nominal_variables=nominal_variables,
    )

    ## calculate statistics
    if is_categorical:
        dic_tbl = calc_classification_stats(y, fitted_values, fitted_probs)
    else:
        dic_tbl = calc_regression_stats(y, fitted_values, coef)

    # prepare data for plotly
    processor = GroupSankeyDataProcessor(coef, dic_groups, group_order, max_vars=20, verbose=verbose)
    dic_skd, dic_bar = processor.gen_dicts()
    dic_scp = {'actual': y, 'fitted': fitted_values}
    cat_cols_in_col_x = [col for col in dic_groups['cat_cols'] if col in X]
    cat_cols_high_cardinality = get_high_cardinality_var(X.loc[:, cat_cols_in_col_x])
    msg = gen_summary_text_skd(dic_groups, dic_bar, cat_cols_high_cardinality)
    return is_categorical, dic_skd, dic_bar, dic_scp, dic_tbl, idx, msg


def is_categorical_objective(y: np.array) -> bool:
    """Determine if the datatype of the objective is categorical or not"""
    is_int = np.issubdtype(y.dtype, np.integer)
    is_real = np.issubdtype(y.dtype, np.floating)
    is_obj = (not is_int) and (not is_real)
    is_binary = False
    if is_int:
        uniq_vals = np.unique(y)
        is_binary = len(uniq_vals) == 2
    is_categorical = is_binary or is_obj
    return is_categorical


def subsample_for_skd(y: np.array, is_categorical: bool, max_datapoints=10000) -> np.array:
    """Subsampling for SkD objective variable"""
    idx = np.arange(len(y))
    if is_categorical:
        _, idx = subsample_for_classification(y, n_max=max_datapoints)
    elif len(y) > max_datapoints:
        idx = create_subsampling_index(idx, max_datapoints)
    idx = np.sort(idx.flatten())
    return idx


def subsample_for_classification(
    x,
    n_max=10_000,
    keep_topk_class=5,
    ratio_ignore_under=0.001,
    imbalance_ratio=10,
) -> np.array:
    """Apply subsampling for classification: categorical objective value"""
    rowidx = np.arange(len(x))
    classes, n_per_class = np.unique(x, return_counts=True)

    if len(classes) > 2:
        # if multiclass, drop classes with small datapoints
        drop_classes = get_classes_with_small_datapoints(classes, n_per_class, keep_topk_class)
        rowidx = np.array([idx for idx, x in enumerate(x) if x not in drop_classes])
        classes, n_per_class = np.unique(x[rowidx], return_counts=True)
        logger.info(f'dropoed classes: {drop_classes}')

    # get classes to undersample
    n_subsample = calc_subsample_datapoints(classes, n_per_class, ratio_ignore_under, imbalance_ratio)
    if len(rowidx) > n_max:
        n_subsample = np.min([n_subsample, int(n_max / len(classes))])
    classes_to_undersample = classes[n_per_class > n_subsample]
    logger.info(f'classes_to_undersample: {classes_to_undersample}, to n={n_subsample}')

    # subsampling
    if len(classes_to_undersample) > 0:
        rowidx_sub = []
        for i, cls in enumerate(classes):
            rowidx_cls = rowidx[x[rowidx] == cls]
            if n_per_class[i] > n_subsample:
                rowidx_cls = rowidx_cls[create_subsampling_index(rowidx_cls, n_subsample)]
            rowidx_sub.append(rowidx_cls)
        rowidx_sub = np.hstack(rowidx_sub)
        rowidx_sub = np.sort(rowidx_sub)
        x = x[rowidx_sub]
        print_class_ratios(x)
    else:
        rowidx_sub = rowidx
    return x, rowidx_sub


def get_classes_with_small_datapoints(classes: np.array, n_per_class: np.array, keep_topk=10) -> np.array:
    """Return classes with small number of samples (under keep_topk classes)"""
    classes = classes[np.argsort(n_per_class)[::-1][(keep_topk):]]
    return classes


def calc_subsample_datapoints(
    classes: np.array,
    n_per_class: np.array,
    ratio_ignore_under=0.001,
    imbalance_ratio=10,
) -> int:
    """Calculate the number of datapoints after subsampling"""
    ratio_per_class = n_per_class / np.sum(n_per_class)
    n_minimum = (
        np.min(n_per_class)
        if len(classes) == 2
        else np.min(
            n_per_class[ratio_per_class > ratio_ignore_under],
        )
    )  # minimum datapoints of a class that exceeds ratio
    n_classes = len(classes)
    return int(np.floor(imbalance_ratio * n_minimum / (n_classes - 1)))


def create_subsampling_index(x: np.array, n: int) -> np.array:
    """
    Create sequence of integers with length n that starts with 0 and ends with len(x)-1 with almost equal intervals
    """
    idx = np.linspace(0, len(x) - 1, num=n)
    idx = idx.astype(int)
    return idx


def print_class_ratios(x: np.array):
    """Print number of data points and ratios for each datapoints"""
    classes, n_per_class = np.unique(x, return_counts=True)
    rate_per_class = n_per_class / len(x)
    logger.info('class = n (rate)')
    for cls, cnt, rate in zip(classes, n_per_class, rate_per_class):
        logger.info(f'{cls} = {cnt} ({rate:.4f})')


def get_high_cardinality_var(df, threshold=0.5) -> np.array:
    """Determine variables with high cardinality"""
    nrows = df.shape[0]
    uniq_cnts = df.nunique()
    cols_high_cardinality = df.columns.to_numpy()[uniq_cnts > threshold * nrows]
    return cols_high_cardinality


def gen_summary_text_skd(dic_groups: dict, dic_bar: dict, cat_cols_high_cardinality: np.array) -> list:
    '''
    Generate summary text for SkD

    Parameters
    ----------
    dic_groups: dict
        A dictionary with group information. This function will use items colids_x and cat_cols
    dic_bar: dict
        A dictionary with
    cat_cols_high_cardinality: np.array
        An array with columns with high cardinality

    Returns
    ----------
    msg: list
        A list with a dictionary in each element.
        For example: [{"message": {"en": "message1", "ja": "message2"}},
        {"message": {"en": "message3", "ja": "message4"}}]
    '''

    # Number of variables selected
    # Variable with highest coefficient
    # List of categorical variables
    # Too strong correlation
    # Too many variables selected -> Jump to ScP
    # Variables with high cardinality

    msg = []
    cat_cols = dic_groups['cat_cols']
    colids_x = dic_groups['colids_x']

    # Number of variables
    if len(dic_bar['sensor_names']) < len(colids_x):
        msg_varnum = {
            'message': {
                'en': f"From {len(colids_x)} variables, top {len(dic_bar['sensor_names'])} are shown",
                'ja': f"計{len(colids_x)}個の変数のうち、上位{len(dic_bar['sensor_names'])}個が表示されています",
            },
        }
        msg.append(msg_varnum)

    # Variable with highest coefficient
    top1_sensor = dic_bar['sensor_names'][np.argsort(np.abs(dic_bar['coef']))[-1]]
    msg_top1 = {
        'message': {
            'en': f"Variable with strongest relationship with {dic_groups['objective']}: {top1_sensor}",
            'ja': f"{dic_groups['objective']}に対して最も強い関係性をもつ変数: {top1_sensor}",
        },
    }
    msg.append(msg_top1)

    # Categorical Variables
    selected_cat_cols = [str(x) for x, y in zip(dic_bar['sensor_names'], dic_bar['sensor_ids']) if y in cat_cols]
    if len(selected_cat_cols) > 0:
        msg_catcols = {
            'message': {
                'en': f"Categorical variables: {', '.join(selected_cat_cols)} is selected. "
                f"Consider analyzing them using PCP/StP/etc.",
                # fmt: off
                'ja': f"カテゴリ型の変数: {', '.join(selected_cat_cols)} が選択されました。"
                f"PCPやStPなどを用いてカテゴリ別の傾向を分析することを検討しましょう",
                # fmt: on
            },
        }
        msg.append(msg_catcols)

    # Too many variables selected -> Jump to ScP
    if len(dic_bar['sensor_names']) > 20:
        # fmt: off
        msg_manyvars = {
            'message':
            {
                'en': f"Many variables are selected. {dic_bar['objective']} might be a complex phenomenon."
                f"Consider visualizing PCP/ScP and check if cluster exists",
                'ja': f"多くの変数が選択されました。{dic_bar['objective']} は複雑な現象である可能性があります。"
                f"PCPやScPなどで可視化を行い、クラスタ構造がないかを確認しましょう",
            },
        }
        # fmt: on
        msg.append(msg_manyvars)

    # Variables with high cardinality
    selected_cols_high_cardinality = [
        str(x) for x, y in zip(dic_bar['sensor_names'], dic_bar['sensor_ids']) if y in cat_cols_high_cardinality
    ]
    if len(cat_cols_high_cardinality) > 0:
        # fmt: off
        msg_nuniques = {
            'message':
            {
                'en': f"Columns with large number of unique values have detected: {', '.join(selected_cols_high_cardinality)}." # noqa: E501
                f"If you are not interested in the differences such as serial numbers or lot numbers, exclude them from the analysis", # noqa: E501
                'ja': f"値の種類が非常に多いカラムを検知しました: {', '.join(selected_cols_high_cardinality)}。"
                f"シリアル番号やロット番号など、その差に興味がない場合は分析から外しましょう",
            },
        }
        # fmt: on
        msg.append(msg_nuniques)

    # Too strong correlation
    if len(dic_bar['sensor_names']) > 1:
        threshold = 0.8
        coef = np.abs(np.array(dic_bar['coef']))
        is_coef_over_sum = coef > threshold * np.sum(coef)
        if np.any(is_coef_over_sum):
            col_coef_over_sum = dic_bar['sensor_names'][is_coef_over_sum][0]  # 1 sensor is detected at maximum
            # fmt: off
            msg_ratio = {
                'message':
                {
                    'en': f"{col_coef_over_sum} has high relationship to {dic_bar['objective']} compared with others. If this relationship is obvious, consider removing {col_coef_over_sum}.", # noqa: E501
                    'ja': f"{col_coef_over_sum} は他と比較して、{dic_bar['objective']}に対して非常に高い関係性をもっています。この関係性が自明である場合、{col_coef_over_sum} を分析から外しましょう。", # noqa: E501
                },
            }
            # fmt: on
            msg.append(msg_ratio)

    # Next Step
    msg_next = {
        # fmt: off
        'message':
        {
            'en': 'Next step: Keeping in mind the estimated relationships, use PCP/StP/etc. to analyze selected variables', # noqa: E501
            'ja': '次のステップ: 推定された関係性を念頭におき、PCP/Stp などを使用して選択された変数をより詳しく分析しましょう', # noqa: E501
        },
        # fmt: on
    }
    msg.append(msg_next)
    return msg


def calc_coef_and_group_order(
    X,
    y,
    dic_groups,
    penalty_factors=[0, 0.5, 1.0, 5.0],
    is_categorical=False,
    strengthen_selection=False,
    verbose=False,
    nominal_variables=[],
):
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
    is_categorical : bool
        if True, fit Logistic regression.
    strengthen_selection: True/False
        If True, search appropriate parameter for L1 penalty for more variable selection
    verbose : True/False

    Returns
    ----------
    coef : 1d numpy array
        regression coefficients.
    group_order : list
        A list of order of groups, where less important is on the left.
    fitted: 1d numpy array
        fitted values
    r2: float
        R square value
    """

    coef = np.zeros((X.shape[1], 1))
    if is_categorical and len(dic_groups['classes']) > 2:
        coef = np.zeros((X.shape[1], len(np.unique(y))))

    group_order = np.arange(dic_groups['num_grps'])

    # preprocessing
    # Categoricals: labelencode with stats (similar to target encoding)
    # Others: Standardization
    # X_preprocessor = SkdXPreprocessor(dic_groups["cat_cols"], nominal_variables)
    # X = X_preprocessor.fit_transform(X, y)
    # y_preprocessor = SkdYPreprocessor(is_categorical)
    # y = y_preprocessor.fit_transform(y)

    # groups lasso (if 2 or more groups are given)
    # this is to determine group order
    idx_for_lasso = np.arange(X.shape[1])
    if dic_groups['num_grps'] > 1:
        # fit group lasso with various penalty factors (no L1 penalty)
        coef_history, bic = fit_grplasso(X.copy(), y.copy(), dic_groups, penalty_factors, is_categorical, verbose)
        # determine order of groups
        group_order = determine_group_order(coef_history, dic_groups)
        # use selected columns ffor ridge regression
        idx_for_lasso = np.where(np.abs(coef_history[np.argmin(bic), :]) > 0.0)[0]

    if len(idx_for_lasso) == 0:
        idx_for_lasso = np.arange(X.shape[1])

    # L1 penalty for further variable selection
    if strengthen_selection:
        idx_for_ridge = idx_for_lasso[fit_lasso(X.iloc[:, idx_for_lasso], y, dic_groups, is_categorical=is_categorical)]
    else:
        idx_for_ridge = idx_for_lasso

    # re-calculate coefficients with ridge regression
    if len(idx_for_ridge) == 0:
        # just in case when all columns are deleted
        idx_for_ridge = np.arange(X.shape[1])

    # re-calculate coefficients with ridge regression
    coef[idx_for_ridge, :], fitted_values, fitted_probs = fit_ridge(
        X.iloc[:, idx_for_ridge],
        y,
        dic_groups,
        is_categorical=is_categorical,
    )

    if verbose:
        logger.info(
            f'''\
==========
Group order: {dic_groups["uniq_grps"][group_order]}
Index used for ridge: {idx_for_ridge}
Coef: {coef}
''',
        )

    return coef, group_order, fitted_values, fitted_probs


class SkdXPreprocessor:
    def __init__(self, cat_cols, nominal_variables):
        self.cat_cols = cat_cols
        self.nominal_variables = nominal_variables

    def fit_transform(self, X, y):
        for col in X.columns.to_numpy():
            if col in self.cat_cols:
                is_nominal_scale = col in self.nominal_variables
                X.loc[:, col] = labelencode_by_stat(
                    X[col].astype(str).to_numpy().flatten(),
                    y.flatten(),
                    is_nominal_scale=is_nominal_scale,
                )
            X.loc[:, col] = StandardScaler().fit_transform(X[col].to_numpy().astype(float).reshape(-1, 1))
        X = X.to_numpy()
        return X


class SkdYPreprocessor:
    def __init__(self, is_categorical):
        self.is_categorical = is_categorical
        self.scaler = None

    def fit_transform(self, y):
        if self.is_categorical is False:
            self.scaler = StandardScaler()
            y = self.scaler.fit_transform(y.reshape((-1, 1)))
        return y.flatten()

    def inverse_transform(self, y):
        if self.is_categorical is False:
            y = self.scaler.inverse_transform(y.reshape((-1, 1)))
        return y


def labelencode_by_stat(x, y, how='mean', is_nominal_scale=True):
    """Label encode x by the mean/median of corresponding y"""
    df = pd.DataFrame({'y': y, 'x': x})
    df['y'] = df['y'].astype('float64')

    if how == 'mean':
        vals = df.groupby(by='x').mean().reset_index()
    elif how == 'median':
        vals = df.groupby(by='x').median().reset_index()
    else:
        logger.warning('Invalid value for argument "how". mean is used.')
        vals = df.groupby(by='x').mean().reset_index()

    factor_orders = vals['x'].to_numpy()
    if is_nominal_scale:
        factor_orders = vals.sort_values(by='y', ascending=True)['x'].to_numpy()
    x_encoded = df['x'].replace(factor_orders, np.arange(0, len(factor_orders)) + 1)
    return x_encoded.to_numpy()


def fit_grplasso(X, y, dic_groups, penalty_factors=[0.01, 0.1, 1.0, 10.0, 100.0], is_categorical=False, verbose=False):
    """
    Fit group lasso in each penalty factor.

    Parameters
    ----------
    X : 2d NumpyArray
        Explanatory variables.
    y : 1d NumpyArray
        Objective variable.
    dic_groups : dict
        A dictionary with group information
    penalty_factors : list
        Lasso reguralization factor for group lasso.
    is_categorical : bool
        if True, fit Logistic regression.

    Returns
    ----------
    coef_history: 2d NumpyArray
        Regression coefficients. (len(penalty_facotrs) x X.shape[1]).
    bic : 1d NumpyArray
        BIC in each penalty_faactor. Smaller the better.
    """

    bic = np.empty(len(penalty_factors))
    coef_history = np.empty((len(penalty_factors), X.shape[1]))

    params = {
        'groups': dic_groups['idx_grps'],
        'l1_reg': 0.003,
        'scale_reg': 'inverse_group_size',
        'supress_warning': True,
        'n_iter': 200,
        'tol': 1e-2,
    }

    for i, rho in enumerate(penalty_factors):
        if is_categorical:
            y_ohe = OneHotEncoder(sparse_output=False, categories=[dic_groups['classes']]).fit_transform(
                y.reshape(-1, 1),
            )
            y_fit = np.zeros_like(y_ohe)
            coef = np.zeros((X.shape[1], len(dic_groups['classes'])))
            for cls in range(len(dic_groups['classes'])):
                X_train = SkdXPreprocessor(dic_groups['cat_cols'], dic_groups['nominal_variables']).fit_transform(
                    X,
                    y_ohe[:, cls],
                )
                y_train = SkdYPreprocessor(is_categorical).fit_transform(y_ohe[:, cls])
                gl = LogisticGroupLasso(group_reg=rho, **params)
                gl.fit(X_train, y_train)
                y_fit[:, cls] = gl.predict_proba(X_train)[:, 1]
                coef[:, cls] = gl.coef_[:, 1] - gl.coef_[:, 0]
            coef_history[i, :] = np.sum(np.abs(coef), axis=1)
            bic[i] = calc_bic(y_fit, y_ohe, coef_history[i, :], is_categorical)

        else:
            X_train = SkdXPreprocessor(dic_groups['cat_cols'], dic_groups['nominal_variables']).fit_transform(X, y)
            scaler = StandardScaler().fit(y.reshape((-1, 1)))
            y_train = scaler.transform(y.reshape((-1, 1)))
            gl = GroupLasso(group_reg=rho, frobenius_lipschitz=False, **params)
            gl.fit(X_train, y_train)
            coef_history[i, :] = gl.coef_.flatten()
            y_fit = gl.predict(X_train).flatten()
            bic[i] = calc_bic(y_fit, y_train.flatten(), gl.coef_, is_categorical)

        if verbose:
            logger.info(
                f'''\
==========
penalty: {rho}
BIC={np.round(bic[i], 2)}
Number of dropped columns: {np.sum(coef_history[i, :] == 0.0)}
''',
            )

    return coef_history, bic


def calc_bic(y_est, y_true, coef, is_categorical):
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
    is_categorical: True/False
        If true, y_est and y_true are one hot encoded.

    Returns
    ----------
    bic : float
        Calculated BIC. Smaller the better.
    """

    n_samples = len(y_est)
    df = np.sum(np.abs(coef) > 0.0)
    if is_categorical:
        # negative log-likelihood
        nloglik = log_loss(y_true, y_est)
        bic = 2 * n_samples * nloglik + df * np.log(n_samples)
    else:
        # from sklearn
        # https://github.com/scikit-learn/scikit-learn/blob/0d378913b/sklearn/linear_model/_least_angle.py#L1957
        resid = y_est - y_true
        mean_squared_error = np.mean(resid**2)
        sigma2 = np.var(y_true)
        eps64 = np.finfo('float64').eps
        K = np.log(n_samples)
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

    num_groups = dic_groups['num_grps']
    num_penalties = coef_history.shape[0]

    sum_coef_per_groups_old = np.zeros(num_groups)
    # add to group_order if coefficients shrink to zero
    for i in range(num_penalties):
        abs_coef = np.abs(coef_history[i, :])
        sum_coef_per_groups = np.bincount(dic_groups['idx_grps'], weights=abs_coef)
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


def fit_lasso(X, y, dic_groups, is_categorical=False):
    """
    Fit lasso regression. Only returns index of selected variables

    Parameters
    ----------
    X : 2d NumpyArray
        Explanatory variables.
    y : 1d NumpyArray
        Objective variable.
    dic_groups : dict
        A dictionary with group information
    is_categorical : bool
        if True, fit Logistic regression.

    Returns
    ----------
    coef : 1d numpy array
        regression coefficients.
    """
    warnings.filterwarnings('ignore', category=ConvergenceWarning, module='sklearn')

    if is_categorical:
        y_ohe = OneHotEncoder(sparse_output=False, categories=[dic_groups['classes']]).fit_transform(y.reshape(-1, 1))
        coef = np.zeros((X.shape[1], len(dic_groups['classes'])))
        for cls in range(len(dic_groups['classes'])):
            X_train = SkdXPreprocessor(dic_groups['cat_cols'], dic_groups['nominal_variables']).fit_transform(
                X,
                y_ohe[:, cls],
            )
            y_train = SkdYPreprocessor(is_categorical).fit_transform(y_ohe[:, cls])

            # LogisticRegression with L1 penalty takes time to converge
            model = LogisticRegressionCV(penalty='l1', solver='saga', max_iter=100)
            model.fit(X_train, y_train)
            coef[:, cls] = model.coef_.flatten()

        if len(dic_groups['classes']) == 2:
            coef = np.abs(coef[:, 1].reshape((-1, 1)))
        else:
            coef = np.min(np.abs(coef), axis=1).reshape((-1, 1))
        idx_selected_vars = np.where(coef > 0.0)[0]
    else:
        X_train = SkdXPreprocessor(dic_groups['cat_cols'], dic_groups['nominal_variables']).fit_transform(X, y)
        scaler = StandardScaler().fit(y.reshape((-1, 1)))
        y_train = scaler.transform(y.reshape((-1, 1)))

        model = LassoCV()
        model.fit(X_train, y_train.ravel())
        coef = model.coef_.reshape((-1, 1))
        idx_selected_vars = np.where(np.abs(coef) > 0.0)[0]
    return idx_selected_vars


def fit_ridge(X, y, dic_groups, alpha=0.05, is_categorical=False):
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
    is_categorical : bool
        if True, fit Logistic regression.

    Returns
    ----------
    coef : 1d numpy array
        regression coefficients.
    fitted_values: 1d numpy array
        fitted values
    fitted_probs: 1d numpy array
        fitted probability of the positive class.
    r2: float
        R square value
    """

    if is_categorical:
        y_ohe = OneHotEncoder(sparse_output=False, categories=[dic_groups['classes']]).fit_transform(y.reshape(-1, 1))
        fitted_probs = np.zeros_like(y_ohe)
        coef = np.zeros((X.shape[1], len(dic_groups['classes'])))
        for cls in range(len(dic_groups['classes'])):
            X_train = SkdXPreprocessor(dic_groups['cat_cols'], dic_groups['nominal_variables']).fit_transform(
                X,
                y_ohe[:, cls],
            )
            y_train = SkdYPreprocessor(is_categorical).fit_transform(y_ohe[:, cls])

            model = RidgeClassifier(alpha=alpha)
            model.fit(X_train, y_train)

            fitted_probs[:, cls] = model._predict_proba_lr(X_train)[:, 1]
            coef[:, cls] = model.coef_.flatten()
        fitted_values = np.array([dic_groups['classes'][x] for x in np.argmax(fitted_probs, axis=1)])
        if len(dic_groups['classes']) == 2:
            coef = coef[:, 1].reshape((-1, 1))
    else:
        X_train = SkdXPreprocessor(dic_groups['cat_cols'], dic_groups['nominal_variables']).fit_transform(X, y)
        scaler = StandardScaler().fit(y.reshape((-1, 1)))
        y_train = scaler.transform(y.reshape((-1, 1)))

        model = Ridge(alpha=alpha)
        model.fit(X_train, y_train)

        fitted_values = model.predict(X_train).flatten()
        fitted_values = scaler.inverse_transform(fitted_values.reshape((-1, 1))).flatten()
        coef = model.coef_.reshape((-1, 1))
        fitted_probs = fitted_values
    return coef, fitted_values, fitted_probs


def calc_adjusted_r2(r2, n, df):
    """
    Calculate adjusted R2

    Parameters
    ----------
    r2 : float
        R2 obtained by model.score() of sklearn model
    n  : int
        Sample size
    df : int
        Degrees of freedom

    Returns
    ----------
    adjusted_r2 : float
        Adjusted R square.
    """
    adjusted_r2 = 1 - (1 - r2) * (n - 1) / (n - df - 1)
    return adjusted_r2


def calc_regression_stats(y_true, y_pred, coef) -> dict:
    """Calculate statistics for the regression"""
    num_vars = np.count_nonzero(coef)
    mae = np.round(np.mean(np.abs(y_true.flatten() - y_pred)), 2)
    r2 = np.corrcoef(y_true.flatten(), y_pred.flatten())[0, 1] ** 2
    adjusted_r2 = r2
    # skip to compute adjust_r2 in case of small dataset
    if len(y_true) - num_vars != 1:
        adjusted_r2 = np.round(calc_adjusted_r2(r2, len(y_true), num_vars), 2)
    dic_stats = {'mae': mae, 'adjusted_r2': adjusted_r2}
    return dic_stats


def calc_classification_stats(y_true, y_pred, y_prob) -> dict:
    """Calculate statistics for the classification"""

    encoder = LabelEncoder().fit(y_true)
    y_true_ = encoder.transform(y_true)
    y_pred_ = encoder.transform(y_pred)

    # TODO: Implement stats for multiclass
    y_true_[y_true_ != 1] = 0  # force stats for label 0/1
    y_pred_[y_pred_ != 1] = 0  # force stats for label 0/1
    y_prob = y_prob[:, 1]

    precision, recall, _ = precision_recall_curve(y_true_, y_prob)

    dic_stats = {
        'accuracy': accuracy_score(y_true_, y_pred_),
        'precision': precision_score(y_true_, y_pred_),
        'recall': recall_score(y_true_, y_pred_),
        'roc_auc': roc_auc_score(y_true_, y_pred_),
        'pr_auc': auc(recall, precision),
    }
    return dic_stats


class GroupSankeyDataProcessor:
    def __init__(
        self,
        coef,
        dic_groups,
        group_order,
        max_vars=20,
        color_y='lightgray',
        color_link_positive='rgba(44, 160, 44, 0.4)',  # green-like color
        color_link_negative='rgba(214, 39, 40, 0.4)',  # red-like color
        limits_sensor={'xmin': 0.20, 'xmax': 0.00, 'ymin': 0.00, 'ymax': 1.00},
        limits_groups={'xmin': 0.75, 'xmax': 0.40, 'ymin': 0.00, 'ymax': 1.00},
        verbose=False,
    ):
        if coef.shape[1] == 1:
            self.task = 'regression'
            coef = coef.flatten()
        elif coef.shape[1] == 2:
            self.task = 'binary'
            coef = coef.flatten()
            # coef = (coef[:, 1] - coef[:, 0]).flatten()
        else:
            self.task = 'multiclass'
            self.coef_labels = coef
            coef = np.sum(np.abs(coef), axis=1)

        # limit the number of variables to show
        idx_remove = np.argsort(np.abs(coef))[:-max_vars]
        coef[idx_remove] = 0.0

        # group info and coefficients
        self.dic_groups = dic_groups
        self.dic_groups['group_order'] = group_order
        self.coef_raw = coef
        self.coef_grps = np.bincount(self.dic_groups['idx_grps'], weights=np.abs(coef))
        self.idx_grp_remained = np.where(np.abs(self.coef_grps) > 0.0)[0]
        self.idx_col_remained = np.where(np.abs(coef) > 0.0)[0]
        self.num_grp_remained = len(self.idx_grp_remained)
        self.num_col_remained = len(self.idx_col_remained)
        self.coef_remained = coef[self.idx_col_remained]
        if self.task == 'multiclass':
            self.coef_labels_remained = self.coef_labels[self.idx_col_remained, :]

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
        self.dic_skd = {
            'node_labels': np.hstack(
                [
                    self.dic_groups['colnames_x'][self.idx_col_remained],
                    self.dic_groups['uniq_grps'][self.idx_grp_remained],
                    self.dic_groups['colname_y'],
                ],
            ),
            'source': [],
            'target': [],
            'node_color': [],
            'edge_value': [],
            'edge_color': [],
            'relationship': [],
        }

        self._add_node_colors()
        self._add_links_from_x_to_group()
        self._add_links_from_group_to_y()
        self._add_node_position()
        return self.dic_skd

    def _gen_barchart_data(self):
        # Barchart data. y-axis corresponds to sankey diagram.
        ord_sort = np.argsort(self.dic_skd['node_y'][: self.num_col_remained])
        if self.task == 'multiclass':
            coefs = self.coef_labels_remained[ord_sort, :]
            # y_columns = self.dic_groups['colnames_x'][self.idx_col_remained][ord_sort]
            # name_labels = self.dic_groups["classes"]
            coef = []
            colors = []
            for i in np.arange(coefs.shape[1]):
                coef.append(coefs[:, i])
                colors.append(np.tile(self.dic_groups['classes'][i], len(coef[i])))
        else:
            colors = [
                self.color_link_negative if x < 0 else self.color_link_positive for x in self.coef_remained[ord_sort]
            ]
            coef = self.coef_remained[ord_sort]

        dic_bar = {
            'task': self.task,
            'objective': self.dic_groups['colname_y'],
            'coef': coef,
            'sensor_names': self.dic_groups['colnames_x'][self.idx_col_remained][ord_sort],
            'bar_colors': colors,
            'sensor_ids': self.dic_groups['colids_x'][self.idx_col_remained][ord_sort],
        }
        return dic_bar

    def _add_node_colors(self):
        # Define node colors (x, groups, y)
        palette = self._get_n_hex_col(len(self.dic_groups['uniq_grps']))
        for i in self.idx_col_remained:
            self.dic_skd['node_color'].append(palette[self._sensor_id_to_group_id(i)])
        for i in self.idx_grp_remained:
            self.dic_skd['node_color'].append(palette[i])
        self.dic_skd['node_color'].append(self.color_y)

    def _get_n_hex_col(self, N=5):
        # Random color generator
        # https://stackoverflow.com/questions/876853/generating-color-ranges-in-python
        HSV_tuples = [(x * 1.0 / N, 0.5, 0.5) for x in range(N)]
        hex_out = []
        for _rgb in HSV_tuples:
            rgb = _rgb
            rgb = (int(x * 255) for x in colorsys.hsv_to_rgb(*rgb))
            hex_out.append('#%02x%02x%02x' % tuple(rgb))
        return hex_out

    def _add_links_from_x_to_group(self):
        # Add links: x -> groups
        edge_colors = [self.color_link_positive if x > 0 else self.color_link_negative for x in self.coef_remained]
        relationship = ['positive' if x > 0 else 'negative' for x in self.coef_remained]
        for i in range(self.num_col_remained):
            self.dic_skd['source'].append(i)
            self.dic_skd['target'].append(self._sensor_node_id_to_group_node_id(i))
            self.dic_skd['edge_value'].append(np.abs(self.coef_remained[i]))
            self.dic_skd['edge_color'].append(edge_colors[i])
            self.dic_skd['relationship'].append(relationship[i])

    def _add_links_from_group_to_y(self):
        # Add links: groups -> y
        for i in range(self.num_grp_remained):
            self.dic_skd['source'].append(self.num_col_remained + i)
            self.dic_skd['target'].append(self.num_col_remained + self.num_grp_remained)
            self.dic_skd['edge_value'].append(self.coef_grps[self.idx_grp_remained[i]])
            self.dic_skd['edge_color'].append('#696969')
            self.dic_skd['relationship'].append('')

    def _sensor_id_to_group_id(self, sensor_id):
        group_id = self.dic_groups['idx_grps'][sensor_id]
        return int(group_id)

    def _sensor_id_to_sensor_node_id(self, sensor_id):
        node_id = np.where(self.idx_col_remained == sensor_id)[0]
        return int(node_id[0])

    def _sensor_node_id_to_group_node_id(self, node_id):
        group_id = self.dic_groups['idx_grps'][self.idx_col_remained[node_id]]
        node_id = self._group_id_to_group_node_id(group_id)
        return int(node_id)

    def _group_id_to_group_node_id(self, group_id):
        node_id = self.num_col_remained + np.where(self.idx_grp_remained == group_id)[0]
        return int(node_id[0])

    def _add_node_position(self):
        # Add node positon
        # Node position of groups are generated according to selection process of GroupLASSO.
        # What makes complicated is that, we have to create a list of length(number of nodes shown in graph).
        # nodes shown/not shown is determined by edge values.
        num_nodes = len(self.dic_skd['node_labels'])
        node_x = np.array([np.nan] * num_nodes)
        node_y = np.array([np.nan] * num_nodes)

        # generate node positions: groups
        xvals_grp = np.linspace(self.limits_groups['xmin'], self.limits_groups['xmax'], self.num_grp_remained)
        wt_groups = self.coef_grps
        wt_sensor = np.abs(self.coef_raw)

        groups_y = self.limits_groups['ymin']
        sensor_y = self.limits_sensor['ymin']
        cnt_grp = 0
        # from IPython.core.debugger import Pdb; Pdb().set_trace()
        # position of group nodes
        for grp_idx in self.dic_groups['group_order']:
            if grp_idx not in self.idx_grp_remained:
                continue

            node_id = self._group_id_to_group_node_id(grp_idx)
            wt = np.max([0.05, wt_groups[grp_idx]])

            node_x[node_id] = xvals_grp[cnt_grp]
            node_y[node_id] = groups_y + (wt / 2)
            groups_y += wt

            # position of sensor nodes
            idx_sensors_in_group = self.idx_col_remained[self.dic_groups['idx_grps'][self.idx_col_remained] == grp_idx]
            for i, j in enumerate(idx_sensors_in_group):
                wt = wt_sensor[j]
                if self.verbose:
                    logger.info(f'j={j}, name={self.dic_skd["node_labels"][i]}, wt={wt}')
                node_x[self._sensor_id_to_sensor_node_id(j)] = 0.05
                node_y[self._sensor_id_to_sensor_node_id(j)] = sensor_y + (wt / 2)
                sensor_y += wt
            cnt_grp += 1

        # normalize y positions
        node_groups_on_graph = [self._group_id_to_group_node_id(x) for x in self.idx_grp_remained]
        node_sensor_on_graph = [self._sensor_id_to_sensor_node_id(x) for x in self.idx_col_remained]
        node_y[node_groups_on_graph] /= np.max(node_y[node_groups_on_graph])
        node_y[node_sensor_on_graph] /= np.max(node_y[node_sensor_on_graph])
        if self.num_grp_remained == 1:
            node_y[node_groups_on_graph] = 0.5
            node_x[node_groups_on_graph] = 0.5

        # position of objective variable
        node_x[-1] = 0.90
        node_y[-1] = 0.50
        self.dic_skd['node_x'] = node_x
        self.dic_skd['node_y'] = node_y

        if self.verbose:
            logger.info(
                f'''\
num_nodes: {num_nodes}'
Node x, y positions in Skd:
{np.vstack([self.dic_skd['node_labels'], np.round(node_x, 2), np.round(node_y, 2)]).T}
''',
            )
