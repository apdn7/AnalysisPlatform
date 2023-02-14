
import numpy as np
from sklearn.covariance import graphical_lasso, empirical_covariance
from sklearn.preprocessing import StandardScaler


class GaussianGraphicalModel():
    '''
    Calculate sparse partial correlation matrix with GraphicalLASSO
    This implementation is not a standard usage;
    penalty factor alpha will be automatically selected based on
    number of variables directly connected with target variables.

    alpha in which
    minimum number of variables directly connected with targets exceed `num_directs`
    is selected.

    For example, assume we have 2 targets and `num_directs` is set to 3.
    We search alpha that gives more than 2 directly connected variables for both targets.

    By restricting the number of connection,
    we seek to obtain more interpretable results.
    Tuning based on ExtendedBIC was difficult to obtain desired results.

    Parameters:
    ----------
    alpha (optional): float
        Shrinkage paramteter alpha. High value returns more sparse result.
        If this value is specified, do not search and force to use this value.

    num_directs (optional): int
        Objective number of directly connected variables of target(s).
        If not given, this will be automatically set.        

    Attributes:
    ----------
    scaler: StandardScaler object
        Used for anomaly detection (when we want to use results for new data)
    
    parcor: NumpyArray of shape (X.shape[1], X.shape[1])
        Partial correlation matrix
    '''

    def __init__(self, alpha=None, num_directs=None):
        self.alpha = alpha
        self.num_directs = num_directs
        self.scaler = None
        self.pmat = None
        self.parcor = None

    def fit(self, X, idx_tgt):
        '''
        Fit GraphcialLASSO

        Inputs:
        ----------
        X: 2d NumpyArray or pandas dataframe of size (sample_size, num_sensors)
            sensor data
        idx_tgt: list
            column index of target variable(s)
        '''

        # scaling
        scaler = StandardScaler().fit(X)
        X = scaler.transform(X)

        # covariance matrix
        emp_cov = empirical_covariance(X)

        # glasso (if alpha is given, force to use it)
        if self.alpha is None:
            parcor = self._calc_parcor_tuned(emp_cov, idx_tgt)
        else:
            parcor = self._calc_parcor(emp_cov, self.alpha)
            
        
        self.scaler = scaler
        self.parcor = parcor

    def _calc_parcor(self, emp_cov, alpha):
        '''
        Calculate sparse partial correlation matrix with glasso

        Inputs:
        ----------
        emp_cov: NumpyArray of shape (X.shape[1], X.shape[1])
        alpha: float

        Returns:
        ----------
        parcor: [NumpyArray] of shape (X.shape[1], X.shape[1])
        '''
        # precision matrix
        pmat = graphical_lasso(emp_cov, alpha)[1]
        # presicion matrix and partial correlation matrix
        parcor = - pmat / (np.sqrt(np.diag(pmat)).reshape(-1, 1) @ np.sqrt(np.diag(pmat)).reshape(1, -1))
        # no self-loops
        np.fill_diagonal(parcor, 0.0)
        return parcor

    def _calc_parcor_tuned(self, emp_cov, idx_tgt):
        ''' 
        Automatic tuning of alpha based on number of variables firectly connected to target variable(s).
        Search from high alpha, and stop if number of variables exceed `num_directs`.

        Inputs:
        ----------
        emp_cov: NumpyArray of shape (X.shape[1], X.shape[1])
        idx_tgt: list

        Returns:
        ----------
        parcor: [NumpyArray] of shape (X.shape[1], X.shape[1])
        '''
        # automatically set the objective of number of variables to extract
        if self.num_directs is None:
            num_sensors = emp_cov.shape[0]
            num_targets = len(idx_tgt)
            num_exploratory = num_sensors - num_targets
            num_directs_cand = np.max([3, 1 + np.ceil(np.sqrt(num_targets))])
            self.num_directs = int(np.min([num_exploratory, num_directs_cand]))

        # search from high alpha
        alphas = np.linspace(0.1, 1, 20)[::-1]

        for i in range(len(alphas)):
            # sparse partial correlation matrix
            parcor = self._calc_parcor(emp_cov, alphas[i])    
            # count number of directly connected variables
            num_dir_vars = self._count_direct_vars(parcor, idx_tgt)
            # do we have enough variables?
            if num_dir_vars >= self.num_directs:
                print('Converged. alpha: {}, num_dir_vars: {}'.format(alphas[i], num_dir_vars))
                break

        self.alpha = alphas[i]
        return parcor

    def _count_direct_vars(self, parcor, idx_tgt):
        '''
        Calculate number of directly connected variables to targets.
        If multiple targets are specified, return the minimum number of connections.

        Inputs:
        ----------  
        parcor: NumpyArray of shape (X.shape[1], X.shape[1])
        idx_tgt: list

        Returns:
        ----------
        int of number of directly connected variables
        '''
        num_directs = []
        for i in range(len(idx_tgt)):
            num_directs.append(len(np.where(np.abs(parcor[idx_tgt[i], :]) > 0)[0]))
        return min(num_directs)
        

def remove_unnecessary_edges(parcor, idx_tgt, num_layers=2):
    '''
    Remove unnecessary edges from partial correlation matrix

    Inputs:
    ----------
    parcor : 2d NumpyArray
        partial correlation matrix (num_cols x num_cols)

    idx_tgt : list
        index list of target column(s)

    num_layers : int, default=2
        number of layers (not including target variables) to extract

    Returns:
    ----------
    adj_mat : 2d NumpyArray which indicate adjacency matrix.
        This array is strictly upper triangular, and
            (j, i) th element indicate partial correlation between (j, i).
    '''

    def extract_connected_idx(parcor, source_idx, from_idx):
        ''' Extract index of directly connected nodes '''
        idx_connected = []
        for i in range(len(source_idx)):
            idx_cand = np.where(np.abs(parcor[:, source_idx[i]]) > 0)[0]
            idx_connected.extend(from_idx[idx_cand])
        idx_connected = np.unique(idx_connected)
        return idx_connected
    
    def parcor2adj(parcor, dic_idx, num_layers):
        ''' Convert partial correlation matrix to adjacency matrix '''
        # remove all paths inside each layer (including target)
        adj_mat = parcor.copy()
        for i in range(num_layers + 1):
            idx_curr_layer = dic_idx['idx_layer' + str(i)]
            if len(idx_curr_layer) > 0:
                adj_mat[np.ix_(idx_curr_layer, idx_curr_layer)] = 0.0

        # remove all path from/to remaining nodes
        if len(dic_idx['idx_remain']) > 0:
            adj_mat[dic_idx['idx_remain'], :] = 0.0
            adj_mat[:, dic_idx['idx_remain']] = 0.0

        # we only need upper triangularelements
        adj_mat = np.triu(adj_mat)
        return adj_mat

    # recursively extract directly correlated variables starting from target variables
    idx_all = np.arange(0, parcor.shape[0], 1)
    dic_idx = {'idx_all': idx_all,
               'idx_layer0': idx_tgt,
               'idx_remain': np.setdiff1d(idx_all, idx_tgt)}

    for i in range(num_layers):
        parcor_ = parcor[dic_idx['idx_remain'], :]
        prev_layer = 'idx_layer' + str(i)
        curr_layer = 'idx_layer' + str(i + 1)
        dic_idx[curr_layer] = extract_connected_idx(parcor_, dic_idx[prev_layer], dic_idx['idx_remain'])
        dic_idx['idx_remain'] = np.setdiff1d(dic_idx['idx_remain'], dic_idx[curr_layer])

    adj_mat = parcor2adj(parcor, dic_idx, num_layers)
    return adj_mat
