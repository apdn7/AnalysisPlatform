import os

from flask import Blueprint, render_template, request

from ap.common.constants import Outliers
from ap.common.services.form_env import parse_request_params, get_common_config_data
from ap.trace_data.models import find_cycle_class

trace_data_blueprint = Blueprint(
    'trace_data',
    __name__,
    template_folder=os.path.join('..', 'templates', 'trace_data'),
    static_folder=os.path.join('..', 'static', 'trace_data'),
    # static_url_path='../static/trace_data',
    url_prefix='/ap'
)


@trace_data_blueprint.route('/fpp')
def trace_data():
    output_dict = get_common_config_data()

    # # TODO : delete
    # import_debug_info('a')

    return render_template("trace_data.html", **output_dict)


@trace_data_blueprint.route('/fpp/list_of_histograms')
def list_of_histograms():
    dic_form = parse_request_params(request)
    proc_id = int(dic_form.get('proc_id'))
    cycle_ids = dic_form.get('cycle_id', [])
    valid_cycle_ids = []
    outlier_flags = []
    is_all_registered = Outliers.IS_OUTLIER.value
    if cycle_ids:
        if type(cycle_ids) != list:
            cycle_ids = [cycle_ids]
        cycle_cls = find_cycle_class(proc_id)
        records = cycle_cls.get_outlier_by_cycle_ids(cycle_ids)
        for record in records:
            valid_cycle_ids.append(record.id)
            is_all_registered = is_all_registered and record.is_outlier
            outlier_flags.append(record.is_outlier or 0)

    output_dict = {
        "process_id": proc_id,
        "cycle_ids": valid_cycle_ids,
        "is_all_registered": is_all_registered,
        "outlier_flags": outlier_flags,
    }
    return render_template("list_of_histograms.html", **output_dict)
