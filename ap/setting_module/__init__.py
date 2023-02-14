def create_module(app, **kwargs):
    from .controllers import setting_module_blueprint
    app.register_blueprint(setting_module_blueprint)
