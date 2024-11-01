from __future__ import annotations

import contextlib
import dataclasses
import hashlib
import logging
import pickle
import time
from functools import wraps
from typing import Any

import babel
import cachelib
import diskcache
from flask_babel import get_locale

from ap.common.common_utils import get_cache_path
from ap.common.constants import CacheType, FlaskGKey, MemoizeKey

logger = logging.getLogger(__name__)

USE_EXPIRED_CACHE_PARAM_NAME = '_use_expired_cache'
JUMP_KEY_PARAM_NAME = 'jump_key'


def clear_cache():
    """
    delete physical cache file/data
    :return:
    """
    CustomCache.clear()
    logger.info('CLEAR ALL CACHE')


def set_all_cache_expired(cache_type: CacheType):
    """
    delete logical cache file/data
    :return:
    """
    CustomCache.clear(cache_type)

    logger.info(f'CACHE EXPIRED: {cache_type.name}')


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


@dataclasses.dataclass
class CacheConfig:
    stop_use_cache: bool = False
    use_expired_cache: bool = False
    save_file: bool = False
    custom_key: Any | None = None
    locale: babel.Locale | str | None = None

    @classmethod
    def build(cls, force_save_file: bool, cache_type: CacheType, custom_key_arg=None, **kwargs) -> 'CacheConfig':
        config = cls()

        # always save file if user request
        if force_save_file:
            config.save_file = True

        # always save transaction data and jump func on disk
        if cache_type in [CacheType.TRANSACTION_DATA, CacheType.JUMP_FUNC]:
            config.save_file = True

        # check if we don't want to use cache anymore
        if get_cache_attr(MemoizeKey.STOP_USING_CACHE) is not None:
            config.stop_use_cache = True

        # continue to use cache even if it is expired
        is_use_expired = kwargs.get(USE_EXPIRED_CACHE_PARAM_NAME, False)
        if is_use_expired:
            config.use_expired_cache = True

        # finding custom key, this is use for `jump_key`
        # we set `jump_key` parameter and try to get it from function params
        # where we deliberately cache it without calculating ...
        if custom_key_arg is not None:
            config.custom_key = kwargs.get(custom_key_arg, None)

        # We cache per locale.
        # When running jobs, which is outside of request context. We cannot get correct locale.
        # In that cases, just fall back to None.
        with contextlib.suppress(Exception):
            config.locale = get_locale()

        return config


class CustomCache:
    """Custom cache with file-based and memory-based"""

    # use fanout cache for better sharding
    # this has size limit = 1Gb, each shard has 250 Mb
    # this is process-safe, we can use multiple process in the same cache folder
    disk_cache = diskcache.FanoutCache(directory=get_cache_path(), shards=4)

    # only store 50 objects in memory and default 300 seconds timeout
    # in the future we might want to drop this perhaps ?
    memory_cache = cachelib.SimpleCache(threshold=50, default_timeout=300)

    # saving cached files to invalidate them later if needed
    # cache keys are actually managed by `disk_cache` and `memory_cache`
    # but we want to save these cache keys in here, in case we need to invalidate those
    # since each key is computed using function name and its arguments
    # the total binary for a key is fixed 64 bytes (since we hash it using sha1)
    # even if we have like 1_000_000 key caches, it only takes 64 Mb
    cached_keys: dict[CacheType, list[str]] = {cache_type: [] for cache_type in CacheType}

    # even though the cached_keys is small, we need to prune them every hour
    # to avoid memory consumption in case application run too long
    # since we don't directly manage cache, there are cases where cache will be removed automatically
    # we need to check if some cache keys still existed and remove non-existed keys
    prune_interval = 3600  # seconds
    next_prune = time.time() + prune_interval

    # there is some cache we never delete them, in order to use `use_expired_cache`
    # we might use this in the future but this current implement will ignore them
    persistent_cached_keys: list[str] = []

    # limit
    # store 50 objects per process across 8 processes: 400 cached object.
    # We don't want 400 cached object exceed 500 Mb ram ?
    # Therefore, each object should have maximum 500 Mb / 400 = 1.25 Mb
    cached_object_size = 1.25 * 1024 * 1024

    @classmethod
    def memoize(
        cls,
        force_save_file=False,
        duration=None,
        cache_type: CacheType = CacheType.OTHER,
        custom_key_arg: str | None = None,
    ):
        def decorating_function(fn):
            return cls._memoize_wrapper(
                fn,
                force_save_file=force_save_file,
                timeout=duration,
                cache_type=cache_type,
                custom_key_arg=custom_key_arg,
            )

        return decorating_function

    @classmethod
    def _memoize_wrapper(
        cls,
        fn,
        force_save_file: bool,
        timeout,
        cache_type: CacheType,
        custom_key_arg: str | None = None,
    ):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # try to prune to save memory
            cls._prune()

            config = CacheConfig.build(
                force_save_file=force_save_file,
                cache_type=cache_type,
                custom_key_arg=custom_key_arg,
                **kwargs,
            )

            # need to pop out invalid parameters here
            for unused_param_name in [USE_EXPIRED_CACHE_PARAM_NAME, JUMP_KEY_PARAM_NAME, custom_key_arg]:
                if unused_param_name in kwargs:
                    kwargs.pop(unused_param_name)

            if config.stop_use_cache:
                return fn(*args, **kwargs)

            key = cls.compute_key(fn, args, kwargs, custom_key=config.custom_key, locale=config.locale)
            result = cls.get(key)

            # cache missed, recalculate and add to cache
            if result is None:
                logger.info(f'Cache miss: {fn.__name__}')

                result = fn(*args, **kwargs)
                saved = cls.set(key, result, timeout, save_file=config.save_file)
                if saved:
                    cls.cached_keys[cache_type].append(key)
                else:
                    logger.error(f'Cannot save cache for function {fn.__name__}')
            else:
                logger.info(f'Cache hit: {fn.__name__}')

            # reset cache key to infinity
            if config.use_expired_cache:
                cls.change_timeout_to_infinity(key, result)

            return result

        return wrapper

    @classmethod
    def clear(cls, cache_type: CacheType | None = None):
        if cache_type is None:
            # clear all
            for cache_type in cls.cached_keys:
                cls.cached_keys[cache_type] = []
            cls.memory_cache.clear()
            cls.disk_cache.clear(retry=True)
        else:
            # clear specific cache type

            # delete from memory
            for key in cls.cached_keys[cache_type]:
                if cls.memory_cache.has(key=key):
                    cls.memory_cache.delete(key=key)

            # delete from files, open transaction for better performance
            with cls.disk_cache.transact():
                for key in cls.cached_keys[cache_type]:
                    if key in cls.disk_cache:
                        cls.disk_cache.delete(key=key, retry=True)

            cls.cached_keys[cache_type] = []

    @classmethod
    def has(cls, key: str):
        return cls.in_memory(key) or cls.in_disk(key)

    @classmethod
    def in_disk(cls, key: str) -> bool:
        # checking key in disk_cache is more efficient than directly getting values
        # because diskcache queries key using index
        return key in cls.disk_cache

    @classmethod
    def in_memory(cls, key: str) -> bool:
        # checking key in memory cache, this is a fast operation
        # https://cachelib.readthedocs.io/en/stable/simple/#cachelib.simple.SimpleCache.has
        return cls.memory_cache.has(key=key)

    @classmethod
    def get(cls, key: str) -> Any | None:
        if cls.in_memory(key):
            return cls.memory_cache.get(key=key)

        if cls.in_disk(key):
            return cls.disk_cache.get(key=key)

        return None

    @classmethod
    def set(cls, key, value, timeout, save_file: bool) -> bool:
        # determine if a cache should always be saved as file
        if save_file:
            return cls.disk_cache.set(key=key, value=value, expire=timeout)

        # first, try to save using memory, if it does not success, try to save using file
        added_memory = cls.memory_cache.set(key=key, value=value, timeout=timeout)
        if not added_memory:
            return cls.disk_cache.set(key=key, value=value, expire=timeout)

        # added to memory, however this object might be too big, remove it out and save to disk instead
        # this code is unsafe since we tried access protected item here ...
        _, cached_binary = cls.memory_cache._cache[key]  # noqa
        if len(cached_binary) > cls.cached_object_size:  # 1.25Mb
            cls.memory_cache.delete(key)
            return cls.disk_cache.set(key=key, value=value, expire=timeout)

        return True

    @classmethod
    def _prune(cls):
        # cache is small (<64Mb), no need to prune
        if len(cls.cached_keys) < 1_000_000:
            return

        current_time = time.time()
        if current_time >= cls.next_prune:
            for cache_type, keys in cls.cached_keys.items():
                for key in keys:
                    if cls.has(key):
                        continue
                    cls.cached_keys[cache_type].remove(key)

            cls.next_prune = current_time + cls.prune_interval

    @classmethod
    def change_timeout_to_infinity(cls, key: str, value: Any):
        if cls.in_memory(key):
            cls.memory_cache.set(key=key, value=value, timeout=0)
        elif cls.in_disk(key):
            cls.disk_cache.set(key=key, value=value, expire=None)

    @classmethod
    def compute_key(
        cls,
        fn,
        args=None,
        kwargs={},  # noqa
        custom_key: Any | None = None,
        locale: babel.Locale | str | None = None,
    ):
        # getting custom key first
        if custom_key is not None:
            key = pickle.dumps((fn.__name__, custom_key))
        else:
            key = pickle.dumps((fn.__name__, args, kwargs, locale))

        return hashlib.sha1(key, usedforsecurity=False).hexdigest()


@CustomCache.memoize(cache_type=CacheType.JUMP_FUNC, custom_key_arg='jump_key')
def cache_jump_key(*, jump_key=None, dic_param=None, graph_param=None, df=None):
    """
    :param df:
    :param graph_param:
    :param dic_param:
    :param jump_key:
    :return:
    """
    logger.info(f'Jump Key: {jump_key}')
    return dic_param, graph_param, df
