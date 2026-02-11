from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from .controllers import table_viewer_blueprint

    app.register_blueprint(table_viewer_blueprint)
