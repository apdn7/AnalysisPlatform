def create_module(app, **kwargs):
    from .controllers import analyze_blueprint

    app.register_blueprint(analyze_blueprint)
