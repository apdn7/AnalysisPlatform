def create_module(app, **kwargs):
    from .controllers import agp_blueprint

    app.register_blueprint(agp_blueprint)
