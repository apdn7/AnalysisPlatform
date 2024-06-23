def create_module(app, **kwargs):
    from .controllers import calendar_heatmap_blueprint

    app.register_blueprint(calendar_heatmap_blueprint)
