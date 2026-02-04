from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from .controllers import sankey_plot_blueprint

    app.register_blueprint(sankey_plot_blueprint)
