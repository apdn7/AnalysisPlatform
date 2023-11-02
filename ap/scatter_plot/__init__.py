def create_module(app, **kwargs):
    from .controllers import scatter_plot_blueprint

    app.register_blueprint(scatter_plot_blueprint)
