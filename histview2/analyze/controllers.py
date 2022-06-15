from flask import Blueprint, render_template
from flask_babel import gettext as _

from histview2.common.services.form_env import get_common_config_data
from histview2.common.yaml_utils import *

analyze_blueprint = Blueprint(
    'analyze',
    __name__,
    template_folder=os.path.join('..', 'templates', 'analyze'),
    static_folder=os.path.join('..', 'static', 'analyze'),
    url_prefix='/histview2/analyze'
)

local_params = {
    "config_yaml_fname_proc": dic_yaml_config_file[YAML_CONFIG_PROC],
    "config_yaml_fname_histview2": dic_yaml_config_file[YAML_CONFIG_HISTVIEW2],
    "config_yaml_fname_db": dic_yaml_config_file[YAML_CONFIG_DB]
}


@analyze_blueprint.route('/anomaly_detection/pca')
def pca():
    output_dict = get_common_config_data()
    output_dict['sensor_list'] = []
    output_dict['page_title'] = _('Principle Component Analysis')
    return render_template("hotelling_tsquare.html", **output_dict)
