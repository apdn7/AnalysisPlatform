import os

from flask import Blueprint, render_template

from histview2 import dic_yaml_config_file
from histview2.common.constants import *
from histview2.common.services.form_env import get_common_config_data

categorical_plot_blueprint = Blueprint(
    'categorical_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'categorical_plot'),
    static_folder=os.path.join('..', 'static', 'categorical_plot'),
    url_prefix='/histview2'
)

# ローカルパラメータの設定
local_params = {
    "config_yaml_fname_proc": dic_yaml_config_file[YAML_CONFIG_PROC],
    "config_yaml_fname_histview2": dic_yaml_config_file[YAML_CONFIG_HISTVIEW2],
    "config_yaml_fname_db": dic_yaml_config_file[YAML_CONFIG_DB]}


@categorical_plot_blueprint.route('/stp')
def categorical_plot():
    output_dict = get_common_config_data()
    return render_template("categorical_plot.html", **output_dict)
