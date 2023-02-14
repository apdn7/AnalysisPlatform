import os

from flask import Blueprint, render_template
from flask_babel import gettext as _

table_viewer_blueprint = Blueprint(
    'table_viewer',
    __name__,
    template_folder=os.path.join('..', 'templates', 'table_viewer'),
    static_folder=os.path.join('..', 'static', 'table_viewer'),
    static_url_path=os.path.join(os.sep, 'static', 'table_viewer'),
    url_prefix='/ap'
)


@table_viewer_blueprint.route('/table_viewer')
def index():
    output_dict = {
        "page_title": _("Table Viewer"),
    }
    return render_template("index.html", **output_dict)
