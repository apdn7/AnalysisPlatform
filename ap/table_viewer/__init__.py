def create_module(app, **kwargs):
    from .controllers import table_viewer_blueprint

    app.register_blueprint(table_viewer_blueprint)
