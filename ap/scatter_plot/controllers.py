import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

scatter_plot_blueprint = Blueprint(
    'scatter_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'scatter_plot'),
    static_folder=os.path.join('..', 'static', 'scatter_plot'),
    url_prefix='/ap',
)


@scatter_plot_blueprint.route('/scp')
def index():
    output_dict = get_common_config_data()
    return render_template('scatter_plot.html', **output_dict)


@scatter_plot_blueprint.route('/hmp')
def heatmap():
    output_dict = get_common_config_data()
    return render_template('heatmap.html', **output_dict)
