
def create_module(app, **kwargs):
    from .controllers import heatmap_blueprint
    app.register_blueprint(heatmap_blueprint)
