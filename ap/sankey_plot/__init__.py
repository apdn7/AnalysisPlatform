def create_module(app, **kwargs):
    from .controllers import sankey_plot_blueprint

    app.register_blueprint(sankey_plot_blueprint)
