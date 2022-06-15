def create_module(app, **kwargs):
    from .setting_module.controllers import api_setting_module_blueprint
    from .trace_data.controllers import api_trace_data_blueprint
    from .table_viewer.controllers import api_table_viewer_blueprint
    from .scatter_plot.controllers import api_scatter_blueprint
    from .multi_scatter_plot.controllers import api_multi_scatter_blueprint
    from .sankey_plot.controllers import api_sankey_plot_blueprint
    from .co_occurrence.controllers import api_co_occurrence_blueprint
    from .categorical_plot.controllers import api_categorical_plot_blueprint
    from .analyze.controllers import api_analyze_module_blueprint
    from .ridgeline_plot.controllers import api_ridgeline_plot_blueprint
    from .heatmap.controllers import api_heatmap_blueprint
    from .parallel_plot.controllers import api_paracords_blueprint
    app.register_blueprint(api_setting_module_blueprint)
    app.register_blueprint(api_trace_data_blueprint)
    app.register_blueprint(api_table_viewer_blueprint)
    app.register_blueprint(api_scatter_blueprint)
    app.register_blueprint(api_multi_scatter_blueprint)
    app.register_blueprint(api_sankey_plot_blueprint)
    app.register_blueprint(api_co_occurrence_blueprint)
    app.register_blueprint(api_categorical_plot_blueprint)
    app.register_blueprint(api_analyze_module_blueprint)
    app.register_blueprint(api_ridgeline_plot_blueprint)
    app.register_blueprint(api_heatmap_blueprint)
    app.register_blueprint(api_paracords_blueprint)
