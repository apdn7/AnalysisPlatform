
def create_module(app, **kwargs):
    from .controllers import parallel_plot_blueprint
    app.register_blueprint(parallel_plot_blueprint)
