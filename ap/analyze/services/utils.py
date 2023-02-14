import json
import math

import numpy as np
import pandas as pd
from scipy.stats import multivariate_normal as mn


def get_valid_procs(procs):
    """
    Get valid process to show on selectbox 起点
    Arguments:
        procs {dict}

    Returns:
        dict -- valid process on 起点
    """
    proc_list = {}
    filter_info = procs['filter_info']
    proc_master = procs['proc_master']

    for key, value in filter_info.items():
        if len(filter_info[key]) > 0:
            filter_time = False
            for item in filter_info[key]:
                if item.get('item_info', {}) \
                        and item['item_info'].get('type') \
                        and item['item_info']['type'] == 'datehour-range':
                    filter_time = True
            if filter_time:
                proc_list.update({key: proc_master[key]})

    return proc_list


def get_multivariate_normal(num_samples=500):
    cov = [[1, 0], [0, 1]]  # Covariance
    mean = [0, 0]
    dt = np.zeros([num_samples])
    dt = mn.rvs(mean=mean, cov=cov, size=num_samples, random_state=35)
    radius_1 = 1
    radius_2 = 2
    radius_3 = 3
    radius_4 = 3.73

    # df = pd.DataFrame(dt, columns=["x", "y"])
    # get line from normal distribution of x/y
    # sns.distplot(df['x'], fit=norm, kde=False).get_lines()[0].get_data()
    # get histogram distribution bar from x/y
    # [h.get_height() for h in sns.distplot(df['x'], fit=norm, kde=False).patches]
    return dt


def generateCircum(r, n=720):
    pi = math.pi
    dt = []
    for x in range(0, n + 1):
        dt.append({'x': math.cos(2 * pi / n * x) * r, 'y': math.sin(2 * pi / n * x) * r})

    return dt


class JEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.DataFrame):
            return obj.to_dict('list')
        if isinstance(obj, pd.Series):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)
