import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

categorical_plot_blueprint = Blueprint(
    'categorical_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'categorical_plot'),
    static_folder=os.path.join('..', 'static', 'categorical_plot'),
    url_prefix='/ap'
)


@categorical_plot_blueprint.route('/stp')
def categorical_plot():
    output_dict = get_common_config_data()
    return render_template("categorical_plot.html", **output_dict)
