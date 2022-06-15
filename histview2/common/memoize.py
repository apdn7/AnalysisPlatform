import hashlib
import os
import pickle
import shutil
import time
from collections import OrderedDict
from copy import deepcopy
from functools import wraps
from threading import Lock

from flask import g

from histview2 import check_exist
from histview2.common.common_utils import resource_path, get_cache_path, write_to_pickle, read_pickle_file, delete_file
from histview2.common.constants import AbsPath, FlaskGKey, MemoizeKey

cache = OrderedDict()
lock = Lock()
cache_max_size = 50
USE_EXPIRED_CACHE_PARAM_NAME = '_use_expired_cache'


def is_obsolete(entry, duration=None):
    if entry.get('expired'):
        return True

    if duration is None:
        return False

    return time.time() - entry['time'] > duration


# def filter_r_obj(params):
#     print(params)
#     if isinstance(params, (list, tuple)):
#         new_params = [para for para in params if not isinstance(para, RUtils)]
#     elif isinstance(params, dict):
#         new_params = {key: val for key, val in params.items() if not isinstance(val, RUtils)}
#     else:
#         new_params = params
#
#     return new_params


def compute_key(fn, args, kwargs):
    key = pickle.dumps((fn.__name__, args, kwargs))
    # try:
    #     key = pickle.dumps((fn.__name__, args, kwargs))
    # except Exception:
    #     key = pickle.dumps((fn.__name__, filter_r_obj(args), filter_r_obj(kwargs)))

    return hashlib.sha1(key).hexdigest()


def create_cache_file_path(key):
    file_path = resource_path(get_cache_path(), key, level=AbsPath.SHOW)
    if not os.path.exists(os.path.dirname(file_path)):
        os.makedirs(os.path.dirname(file_path))

    return file_path


def delete_cache_file(key):
    try:
        delete_file(key)
    except Exception:
        pass


def clear_cache_files():
    folder_path = resource_path(get_cache_path(), level=AbsPath.SHOW)
    try:
        shutil.rmtree(folder_path)
    except Exception:
        pass


def memoize(is_save_file=False, duration=30 * 24 * 60 * 60):
    def memoize1(fn):
        @wraps(fn)
        def memoize2(*args, **kwargs):

            is_use_expired = kwargs.get(USE_EXPIRED_CACHE_PARAM_NAME)
            if USE_EXPIRED_CACHE_PARAM_NAME in kwargs:
                kwargs.pop(USE_EXPIRED_CACHE_PARAM_NAME)

            key = compute_key(fn, args, kwargs)

            is_stop_using_cache = get_cache_attr(MemoizeKey.STOP_USING_CACHE)
            if not is_stop_using_cache and key in cache and (is_use_expired or not is_obsolete(cache[key], duration)):
                print('used cache')
                if is_save_file:
                    file_name = cache[key]['file']
                    if check_exist(file_name):
                        return read_pickle_file(file_name)
                else:
                    return cache[key]['value']

            result = fn(*args, **kwargs)

            with lock:
                if is_save_file:
                    file_name = create_cache_file_path(key)
                    write_to_pickle(result, file_name)
                    cache[key] = dict(file=file_name, time=time.time())
                else:
                    cache[key] = dict(value=deepcopy(result), time=time.time())

                # resize
                while len(cache) > cache_max_size:
                    key, dic_val = cache.popitem(last=False)
                    if dic_val.get('file'):
                        delete_cache_file(key)

            return result

        return memoize2

    return memoize1


def clear_cache():
    cache.clear()
    clear_cache_files()
    print('CLEAR ALL CACHE')


def set_all_cache_expired():
    for dic_val in cache.values():
        dic_val['expired'] = True

    print('CACHE EXPIRED')


def get_cache_g_dict():
    return g.setdefault(FlaskGKey.MEMOIZE, {})


def set_cache_attr(key, data):
    if not key:
        return False

    g_debug = get_cache_g_dict()
    g_debug[key] = data

    return True


def get_cache_attr(key):
    g_debug = get_cache_g_dict()
    data = g_debug.get(key, None)
    return data
