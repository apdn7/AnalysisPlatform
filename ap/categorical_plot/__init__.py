from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from ap.categorical_plot.controllers import categorical_plot_blueprint

    app.register_blueprint(categorical_plot_blueprint)
