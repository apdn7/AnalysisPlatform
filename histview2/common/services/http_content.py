import json
from datetime import date, datetime, time
from decimal import Decimal
from fractions import Fraction
from functools import singledispatch

import numpy as np
import pandas as pd
from numpy import ndarray, int32, float64, int16, int8, float32, int64
from pandas import DataFrame, Series

from histview2.common.constants import DataType
from histview2.common.logger import logger


@singledispatch
def json_serial(obj):
    try:
        # call toJSON method in customize class.
        # create toJSON method in your class
        return obj.toJSON()
    except AttributeError:
        if pd.isnull(obj):
            return None

        if np.isnan(obj):
            return None

        logger.warning('failed - trying to use vars...', obj)
        print('\tfailed - trying to use vars...', obj)

        try:
            return vars(obj)
        except TypeError:
            logger.warning('failed - using string representation...', obj)
            print('\tfailed - using string representation...', obj)
            return str(obj)


@json_serial.register(date)
@json_serial.register(datetime)
@json_serial.register(time)
def _(obj):
    # print(type(obj), obj)
    return obj.isoformat()


@json_serial.register(Decimal)
@json_serial.register(Fraction)
@json_serial.register(float32)
@json_serial.register(float64)
def _(obj):
    return float(obj)


@json_serial.register(int8)
@json_serial.register(int16)
@json_serial.register(int32)
@json_serial.register(int64)
def _(obj):
    return int(obj)


@json_serial.register(DataType)
def _(obj):
    # print(type(obj), obj)
    return obj.value


@json_serial.register(Series)
def _(obj):
    if hasattr(obj, 'to_list'):
        return obj.to_list()
    return json.JSONEncoder.default(obj)


@json_serial.register(set)
def _(obj):
    return list(obj)


@json_serial.register(ndarray)
def _(obj):
    if hasattr(obj, 'tolist'):
        return obj.tolist()
    return json.JSONEncoder.default(obj)


@json_serial.register(DataFrame)
def _(obj):
    if hasattr(obj, 'to_dict'):
        return obj.to_dict('list')
    return json.JSONEncoder.default(obj)
