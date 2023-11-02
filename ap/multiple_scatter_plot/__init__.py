def create_module(app, **kwargs):
    from .controllers import multiple_scatter_plot_blueprint

    app.register_blueprint(multiple_scatter_plot_blueprint)
