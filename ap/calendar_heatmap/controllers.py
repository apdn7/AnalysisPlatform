import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

calendar_heatmap_blueprint = Blueprint(
    'calendar_heatmap',
    __name__,
    template_folder=os.path.join('..', 'templates', 'calendar_heatmap'),
    static_folder=os.path.join('..', 'static', 'calendar_heatmap'),
    url_prefix='/ap',
)


@calendar_heatmap_blueprint.route('/chm')
def index():
    output_dict = get_common_config_data()
    return render_template('calendar_heatmap.html', **output_dict)
