def create_module(app, **kwargs):
    from .controllers import time_vis_blueprint

    app.register_blueprint(time_vis_blueprint)
