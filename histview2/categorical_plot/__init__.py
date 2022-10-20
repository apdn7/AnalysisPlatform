
def create_module(app, **kwargs):
    from histview2.categorical_plot.controllers import categorical_plot_blueprint
    app.register_blueprint(categorical_plot_blueprint)
