import os

from flask import Blueprint, render_template

from histview2.common.services.form_env import get_common_config_data

multiple_scatter_plot_blueprint = Blueprint(
    'multiple_scatter_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'multiple_scatter_plot'),
    static_folder=os.path.join('..', 'static', 'multiple_scatter_plot'),
    # static_url_path='../static/trace_data',
    url_prefix='/histview2'
)


@multiple_scatter_plot_blueprint.route('/msp')
def index():
    output_dict = get_common_config_data()
    return render_template("multiple_scatter_plot.html", **output_dict)
