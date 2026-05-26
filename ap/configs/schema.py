from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from flask import Flask
from pydantic import BaseModel, Field, field_validator
from ruamel.yaml import YAML

from ap.common.constants import ApLogLevel
from config import ConfigKey

yaml = YAML()


class BaseConfigYaml(BaseModel, ABC):
    """Base config for yaml files, support loading files from yaml"""

    @classmethod
    def load(cls, path: Path | str):
        path = Path(path)
        if path.is_file():
            data = yaml.load(path.open())
            return cls(**data)
        return cls()

    def dump(self, path: Path | str):
        path = Path(path)
        yaml.dump(self.model_dump(), path.open('wb'))

    @classmethod
    @abstractmethod
    def from_app(cls, app: Flask): ...


class BasicConfigYaml(BaseConfigYaml):
    """basic_config.yml"""

    class Info(BaseModel):
        version: str = '0'
        port_no: int = Field(alias='port-no', default=7770)
        hide_setting_page: bool = Field(alias='hide-setting-page')
        r_path: str | None = Field(default=None, alias='r-path')
        auto_backup_universal: bool = Field(alias='auto-backup-universal')
        language: str = 'en'
        proxy: str | None = None
        log_level: ApLogLevel

    info: Info

    @classmethod
    def from_app(cls, app: Flask):
        return cls.load(app.config[ConfigKey.BASIC_CONFIG_FILE])


class StartUpYaml(BaseConfigYaml):
    """startup.yml"""

    class SettingStartUp(BaseModel):
        port: int | None = None
        language: str | None = None
        subtitle: str | None = None
        proxy_http: str | None = None
        proxy_https: str | None = None
        network_nck: bool = False
        env_ap: str | None = 'prod'
        flask_debug: bool = False
        update_R: int | None = 0
        enable_file_log: bool = True
        enable_ga_tracking: bool = True
        enable_dump_trace_log: bool = False
        disable_config_from_external: bool = False

    version_yaml: str = '1.0'
    setting_startup: SettingStartUp = SettingStartUp()

    @field_validator('version_yaml', mode='before')
    @classmethod
    def to_str(cls, value: Any) -> str:
        return str(value)

    @classmethod
    def from_app(cls, app: Flask):
        return cls.load(app.config[ConfigKey.START_UP_FILE])
