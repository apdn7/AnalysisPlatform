from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from .controllers import trace_data_blueprint

    app.register_blueprint(trace_data_blueprint)
