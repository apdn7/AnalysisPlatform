import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

agp_blueprint = Blueprint(
    'agp',
    __name__,
    template_folder=os.path.join('..', 'templates', 'aggregate_plot'),
    static_folder=os.path.join('..', 'static', 'aggregate_plot'),
    url_prefix='/ap',
)


@agp_blueprint.route('/agp')
def index():
    output_dict = get_common_config_data()
    return render_template('aggregate_plot.html', **output_dict)
