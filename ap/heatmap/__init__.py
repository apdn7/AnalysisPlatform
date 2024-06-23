def create_module(app, **kwargs):
    from .controllers import heatmap_plot_blueprint

    app.register_blueprint(heatmap_plot_blueprint)
