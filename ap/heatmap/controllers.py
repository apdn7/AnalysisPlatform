import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

heatmap_blueprint = Blueprint(
    'heatmap',
    __name__,
    template_folder=os.path.join('..', 'templates', 'heatmap'),
    static_folder=os.path.join('..', 'static', 'heatmap'),
    url_prefix='/ap'
)


@heatmap_blueprint.route('/chm')
def index():
    output_dict = get_common_config_data()
    return render_template("heatmap.html", **output_dict)
