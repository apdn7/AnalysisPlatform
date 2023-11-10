def create_module(app, **kwargs):
    from .controllers import trace_data_blueprint

    app.register_blueprint(trace_data_blueprint)
