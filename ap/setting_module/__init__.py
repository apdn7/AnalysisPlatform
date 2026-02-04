from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from .controllers import setting_module_blueprint

    app.register_blueprint(setting_module_blueprint)
