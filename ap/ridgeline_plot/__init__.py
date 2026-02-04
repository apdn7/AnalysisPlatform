from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from ap.ridgeline_plot.controllers import ridgeline_plot_blueprint

    app.register_blueprint(ridgeline_plot_blueprint)
