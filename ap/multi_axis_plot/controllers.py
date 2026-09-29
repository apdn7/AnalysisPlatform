import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

map_blueprint = Blueprint(
    'map',
    __name__,
    template_folder=os.path.join('..', 'templates', 'multi_axis_plot'),
    static_folder=os.path.join('..', 'static', 'multi_axis_plot'),
    url_prefix='/ap',
)


@map_blueprint.route('/map')
def index():
    output_dict = get_common_config_data()
    return render_template('multi_axis_plot.html', **output_dict)
