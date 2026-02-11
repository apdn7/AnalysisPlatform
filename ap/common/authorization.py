from collections.abc import Mapping
from functools import wraps
from typing import Any

from flask import abort, current_app, request

from ap.common.constants import DISABLE_CONFIG_FROM_EXTERNAL_KEY, SERVER_ADDR


# naming login_required for implement login in the future
def login_required(fn):
    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Mapping[str, Any]):
        if not is_authorized():
            return abort(403)
        return fn(*args, **kwargs)

    return wrapper


def is_admin_request():
    from ap.common.disk_usage import (
        get_ip_address,
    )

    server_ip = get_ip_address()
    server_ip = [server_ip, *SERVER_ADDR]
    client_ip = request.remote_addr
    is_admin = client_ip in server_ip
    return is_admin


def is_authorized():
    return current_app.config.get(DISABLE_CONFIG_FROM_EXTERNAL_KEY) is False or is_admin_request()
