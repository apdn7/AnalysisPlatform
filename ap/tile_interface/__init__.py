def create_module(app, **kwargs):
    from .controllers import tile_interface_blueprint
    app.register_blueprint(tile_interface_blueprint)
