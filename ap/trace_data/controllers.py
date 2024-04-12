import os

from flask import Blueprint, render_template

from ap.common.services.form_env import get_common_config_data

trace_data_blueprint = Blueprint(
    'trace_data',
    __name__,
    template_folder=os.path.join('..', 'templates', 'trace_data'),
    static_folder=os.path.join('..', 'static', 'trace_data'),
    # static_url_path='../static/trace_data',
    url_prefix='/ap',
)


@trace_data_blueprint.route('/fpp')
def trace_data():
    output_dict = get_common_config_data()

    # # TODO : delete
    # import_debug_info('a')

    return render_template('trace_data.html', **output_dict)
