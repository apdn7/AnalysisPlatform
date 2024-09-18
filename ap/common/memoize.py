import contextlib
import hashlib
import os
import pickle
import shutil
import time
from collections import OrderedDict
from copy import deepcopy
from functools import wraps
from threading import Lock

from flask_babel import get_locale

from ap import MAIN_THREAD, PROCESS_QUEUE, ListenNotifyType, dic_config
from ap.common.common_utils import (
    check_exist,
    delete_file,
    get_cache_path,
    read_pickle_file,
    resource_path,
    write_to_pickle,
)
from ap.common.constants import AbsPath, CacheType, FlaskGKey, MemoizeKey

dic_config_cache = OrderedDict()
dic_transaction_cache = OrderedDict()
dic_jump_func_cache = OrderedDict()
dic_other_cache = OrderedDict()
lock = Lock()
USE_EXPIRED_CACHE_PARAM_NAME = '_use_expired_cache'
JUMP_KEY_PARAM_NAME = 'jump_key'


def is_obsolete(entry, duration=None):
    if duration:
        return time.time() - entry['time'] > duration

    if entry.get('expired'):
        return True

    return False


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


def compute_key(fn, args, kwargs=None, locale=None):
    key = pickle.dumps((fn.__name__, args, kwargs, locale))
    # try:
    #     key = pickle.dumps((fn.__name__, args, kwargs))
    # except Exception:
    #     key = pickle.dumps((fn.__name__, filter_r_obj(args), filter_r_obj(kwargs)))

    return hashlib.sha1(key).hexdigest()


def create_cache_file_path(key):
    file_path = resource_path(get_cache_path(), key, level=AbsPath.SHOW)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    return file_path


def delete_cache_file(key):
    with contextlib.suppress(Exception):
        delete_file(key)


def clear_cache_files():
    folder_path = resource_path(get_cache_path(), level=AbsPath.SHOW)
    with contextlib.suppress(Exception):
        shutil.rmtree(folder_path)


def memoize(is_save_file=False, duration=None, cache_type: CacheType = CacheType.OTHER):
    """
    memoize function
    :param is_save_file:
    :param duration: seconds. if None , cache will be clear when db changed.
    :param cache_type:
    :return:
    """

    def memoize1(fn):
        @wraps(fn)
        def memoize2(*args, **kwargs):
            is_use_expired = kwargs.get(USE_EXPIRED_CACHE_PARAM_NAME)
            if USE_EXPIRED_CACHE_PARAM_NAME in kwargs:
                kwargs.pop(USE_EXPIRED_CACHE_PARAM_NAME)

            if fn.__module__ == cache_jump_key.__module__ and fn.__name__ == cache_jump_key.__name__:
                is_use_expired = True
                is_stop_using_cache = False
                jump_key = args[0] or kwargs.get(JUMP_KEY_PARAM_NAME)

                if jump_key is None:
                    result = fn(*args, **kwargs)
                    return result
                else:
                    if len(args) > 1:
                        for val in args[1:]:
                            if val is not None:
                                is_stop_using_cache = True
                                break

                    if len(kwargs):
                        for val in kwargs.values():
                            if val is not None:
                                is_stop_using_cache = True
                                break

                    key = compute_key(fn, jump_key)
            else:
                try:
                    locale = get_locale()
                except Exception:
                    locale = None

                key = compute_key(fn, args, kwargs, locale)
                is_stop_using_cache = get_cache_attr(MemoizeKey.STOP_USING_CACHE)

            cache, cache_max_size = get_dic_cache_by_type(cache_type)
            if not is_stop_using_cache and key in cache and (is_use_expired or not is_obsolete(cache[key], duration)):
                print(f'used cache: {fn.__name__}')
                if is_save_file:
                    file_name = cache[key]['file']
                    if check_exist(file_name):
                        return read_pickle_file(file_name)
                else:
                    # Must use deepcopy to avoid reference value will be overwritten later
                    return deepcopy(cache[key]['value'])

            result = fn(*args, **kwargs)

            if is_save_file:
                file_name = create_cache_file_path(key)
                write_to_pickle(result, file_name)
                with lock:
                    cache[key] = {'file': file_name, 'time': time.time()}
            else:
                with lock:
                    cache[key] = {'value': deepcopy(result), 'time': time.time()}

            # resize
            with lock:
                while len(cache) > cache_max_size:
                    key, dic_val = cache.popitem(last=False)
                    if dic_val.get('file'):
                        delete_cache_file(key)

            return result

        return memoize2

    return memoize1


def clear_cache():
    """
    delete physical cache file/data
    :return:
    """
    for cache_type in CacheType:
        cache, _ = get_dic_cache_by_type(cache_type)
        cache.clear()

    clear_cache_files()
    print('CLEAR ALL CACHE')


def set_all_cache_expired(cache_type: CacheType):
    """
    delete logical cache file/data
    :return:
    """
    if not dic_config[MAIN_THREAD]:
        with contextlib.suppress(Exception):
            dic_config[PROCESS_QUEUE][ListenNotifyType.CLEAR_CACHE.name][cache_type] = True

        return

    cache, _ = get_dic_cache_by_type(cache_type)
    for dic_val in cache.values():
        dic_val['expired'] = True

    print(f'CACHE EXPIRED: {cache_type.name}')


def get_dic_cache_by_type(cache_type: CacheType):
    cache_max_size = 50
    jump_cache_max_size = 200
    if cache_type is CacheType.CONFIG_DATA:
        return dic_config_cache, cache_max_size

    if cache_type is CacheType.TRANSACTION_DATA:
        return dic_transaction_cache, cache_max_size

    if cache_type is CacheType.JUMP_FUNC:
        return dic_jump_func_cache, jump_cache_max_size

    return dic_other_cache, cache_max_size


def get_cache_g_dict():
    from flask import g

    try:
        return g.setdefault(FlaskGKey.MEMOIZE, {})
    except Exception:
        return {}


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


@memoize(is_save_file=True, cache_type=CacheType.JUMP_FUNC)
def cache_jump_key(jump_key, dic_param=None, graph_param=None, df=None):
    """
    :param df:
    :param graph_param:
    :param dic_param:
    :param jump_key:
    :return:
    """
    print('Jump Key:', jump_key)
    return dic_param, graph_param, df
