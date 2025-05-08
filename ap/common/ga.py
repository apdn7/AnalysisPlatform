# This file contains specific google analytic.
# This file should never import other files rather than `contansts.py`, or `commons_utils.py`
import dataclasses
import logging
import os
import platform
from enum import Enum
from typing import Optional, Union

from ap.common.constants import APP_TYPE_ENV, EMPTY_STRING, BaseEnum
from ap.common.memoize import CustomCache

logger = logging.getLogger(__name__)

GTAG_DEFAULT_TIMEOUT = 3

# GA tracking ID
GA_TRACKING_ID = 'G-9DJ9TV72B5'

VERSION_FILE_NAME = 'VERSION'


class StrEnumWithLowerCase(str, Enum):
    """String enum for insensitive cases"""

    def __eq__(self, other: Union[str, BaseEnum]) -> bool:
        return self.lower() == other.lower().strip()

    @classmethod
    def get(cls, value, default=None):
        for v in cls:
            if v == value:
                return v
        return default


class AppGroup(StrEnumWithLowerCase):
    DN = 'DN'
    Dev = 'Dev'
    Ext = 'Ext'


class AppSource(StrEnumWithLowerCase):
    OSS = 'OSS'
    DN = 'DN'


class AppType(StrEnumWithLowerCase):
    Edge = 'Edge'
    Cloud = 'Cloud'


class OsSystem(StrEnumWithLowerCase):
    WINDOWS = 'Windows'
    LINUX = 'Linux'
    MACOS = 'Darwin'


@dataclasses.dataclass
class AppOs:
    system: OsSystem = OsSystem(platform.system())
    release: str = platform.release()
    machine: str = platform.machine()

    @property
    def value(self) -> str:
        return self.system.value


@dataclasses.dataclass
class GA:
    """Info that we send to google analytics"""

    # app_file: str
    app_group: AppGroup
    app_source: AppSource
    app_type: AppType

    app_version: str
    config_version: str

    app_os: AppOs

    @classmethod
    @CustomCache.memoize()
    def get_ga_info(cls, version_file: str) -> 'GA':
        """Get all application configuration and cache it so that we can get all of them later without querying"""

        version_info = []
        if not os.path.exists(version_file):
            logger.error('VERSION file does not exist')
        else:
            with open(version_file) as f:
                # version file structure
                # `VERSION`
                # `config version`
                # `App source`
                version_info = f.readlines()

        app_version = version_info[0].strip() if version_info else EMPTY_STRING
        if '%%VERSION%%' in app_version:
            app_version = 'v00.00.000.00000000'

        config_version = version_info[1].strip() if len(version_info) > 1 else EMPTY_STRING
        if config_version == EMPTY_STRING:
            config_version = '0'

        app_source = version_info[2].strip() if len(version_info) > 2 else EMPTY_STRING
        # default to DN
        app_source = AppSource.get(app_source, default=AppSource.DN)

        app_type = os.environ.get(APP_TYPE_ENV, EMPTY_STRING)
        # default Edge
        app_type = AppType.get(app_type, default=AppType.Edge)

        app_group_str = os.environ.get('group', EMPTY_STRING)
        app_group = get_app_group(app_source, app_group_str)

        app_os = AppOs()

        return GA(
            app_group=app_group,
            app_source=app_source,
            app_type=app_type,
            app_version=app_version,
            config_version=config_version,
            app_os=app_os,
        )


def get_app_group(app_source: Optional[AppSource], app_group_str: str) -> AppGroup:
    """
    Get app group from app source and app group str (sepcified by environment variable `group`)
    if app group is specified correctly, use it.
    if app group is not specified correctly, check based on app source
    """

    # force return to dev if app_group is set
    if AppGroup.Dev == app_group_str:
        return AppGroup.Dev

    # force return to dn if app_source is set
    if app_source is not None and app_source == AppSource.DN:
        return AppGroup.DN

    # infer based on string
    return AppGroup.get(app_group_str, AppGroup.Ext)
