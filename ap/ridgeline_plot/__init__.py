def create_module(app, **kwargs):
    from ap.ridgeline_plot.controllers import ridgeline_plot_blueprint

    app.register_blueprint(ridgeline_plot_blueprint)
