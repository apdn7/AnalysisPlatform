import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

time_vis_blueprint = Blueprint(
    'time_vis',
    __name__,
    template_folder=os.path.join('..', 'templates', 'time_vis'),
    static_folder=os.path.join('..', 'static', 'time_vis'),
    url_prefix='/ap',
)


@time_vis_blueprint.route('/tv')
def index():
    output_dict = get_common_config_data()
    return render_template('time_vis.html', **output_dict)
