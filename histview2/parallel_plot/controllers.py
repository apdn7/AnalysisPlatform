import os

from flask import Blueprint, render_template

from histview2.common.services.form_env import get_common_config_data

parallel_plot_blueprint = Blueprint(
    'parallel_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'parallel_plot'),
    static_folder=os.path.join('..', 'static', 'parallel_plot'),
    # static_url_path='../static/trace_data',
    url_prefix='/histview2'
)


@parallel_plot_blueprint.route('/pcp')
def index():
    output_dict = get_common_config_data()
    # print(kde_data)
    return render_template("parallel_plot.html", **output_dict)
