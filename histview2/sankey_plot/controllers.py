import os

from flask import Blueprint, render_template

from histview2.common.services.form_env import get_common_config_data

sankey_plot_blueprint = Blueprint(
    'sankey_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'sankey_plot'),
    static_folder=os.path.join('..', 'static', 'sankey_plot'),
    url_prefix='/histview2'
)


@sankey_plot_blueprint.route('/skd')
def index():
    output_dict = get_common_config_data()
    return render_template("sankey_plot.html", **output_dict)
