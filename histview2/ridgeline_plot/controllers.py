import os

from flask import Blueprint, render_template

from histview2.common.services.form_env import get_common_config_data

ridgeline_plot_blueprint = Blueprint(
    'ridgeline_plot',
    __name__,
    template_folder=os.path.join('..', 'templates', 'ridgeline_plot'),
    static_folder=os.path.join('..', 'static', 'ridgeline_plot'),
    url_prefix='/histview2'
)


@ridgeline_plot_blueprint.route('/rlp')
def ridgeline_plot():
    output_dict = get_common_config_data()
    return render_template("ridgeline_plot.html", **output_dict)
