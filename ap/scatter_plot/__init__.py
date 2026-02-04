from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from .controllers import scatter_plot_blueprint

    app.register_blueprint(scatter_plot_blueprint)
