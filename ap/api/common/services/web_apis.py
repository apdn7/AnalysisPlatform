from types import SimpleNamespace
from typing import Any

from ap.api.setting_module.services.web_api import WebAPI
from ap.common.common_utils import WebAuthenticationType


class APIConnection(SimpleNamespace):
    """Mask API connection instance"""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    def as_dict(self):
        return self.__dict__


def check_web_con(
    url: str,
    username: str | None = None,
    password: str | None = None,
    authentication_type: WebAuthenticationType = WebAuthenticationType.NONE,
):
    """
    Check connection to a given URL that should return JSON data.

    Args:
        url (str): The URL to check.
        username (str): The username to authenticate with.
        password (str): The password to authenticate with.
        authentication_type (WebAuthenticationType): The authentication type to use.

    Returns:
        SimpleNamespace: {
            "url": str,
            "connected": bool,
            "message": str,
            "data": dict | None
        }
    """
    web_api = WebAPI(url, username=username, encrypted_password=password, authentication_type=authentication_type)
    data = web_api.check_connection()
    return APIConnection(url=url, connected=True, message='Connected', data=data)
