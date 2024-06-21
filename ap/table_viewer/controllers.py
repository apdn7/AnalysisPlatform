import os

from flask import Blueprint, render_template
from flask_babel import gettext as _

from ap.setting_module.services.process_config import get_all_process

table_viewer_blueprint = Blueprint(
    'table_viewer',
    __name__,
    template_folder=os.path.join('..', 'templates', 'table_viewer'),
    static_folder=os.path.join('..', 'static', 'table_viewer'),
    static_url_path=os.path.join(os.sep, 'static', 'table_viewer'),
    url_prefix='/ap',
)


@table_viewer_blueprint.route('/table_viewer')
def index():
    all_procs = get_all_process()
    output_dict = {
        'page_title': _('Table Viewer'),
        'procs': all_procs,
    }
    return render_template('index.html', **output_dict)
