import os

from flask import Blueprint, render_template
from flask_babel import gettext as _

from ap.common.services.form_env import get_common_config_data

analyze_blueprint = Blueprint(
    'analyze',
    __name__,
    template_folder=os.path.join('..', 'templates', 'analyze'),
    static_folder=os.path.join('..', 'static', 'analyze'),
    url_prefix='/ap/analyze'
)


@analyze_blueprint.route('/anomaly_detection/pca')
def pca():
    output_dict = get_common_config_data()
    output_dict['sensor_list'] = []
    output_dict['page_title'] = _('Principle Component Analysis')
    return render_template("hotelling_tsquare.html", **output_dict)
