from collections.abc import Mapping
from typing import Any


def create_module(app, **_kwargs: Mapping[str, Any]):
    from .controllers import agp_blueprint

    app.register_blueprint(agp_blueprint)
