
def create_module(app, **kwargs):
    from .controllers import co_occurrence_blueprint
    app.register_blueprint(co_occurrence_blueprint)
