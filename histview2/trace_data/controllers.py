import os

from flask import Blueprint, render_template, request

from histview2.api.trace_data.services.plot_view import gen_graph_plot_view
from histview2.common.constants import Outliers
from histview2.common.services.form_env import parse_request_params, get_common_config_data
from histview2.common.yaml_utils import BasicConfigYaml
from histview2.trace_data.models import find_cycle_class

trace_data_blueprint = Blueprint(
    'trace_data',
    __name__,
    template_folder=os.path.join('..', 'templates', 'trace_data'),
    static_folder=os.path.join('..', 'static', 'trace_data'),
    # static_url_path='../static/trace_data',
    url_prefix='/histview2'
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

    basic_config_yml = BasicConfigYaml()
    title = BasicConfigYaml.get_node(basic_config_yml.dic_config, ['info', 'title'], '')

    output_dict = {
        "title": title,
        "process_id": proc_id,
        "cycle_ids": valid_cycle_ids,
        "is_all_registered": is_all_registered,
        "outlier_flags": outlier_flags,
    }
    return render_template("list_of_histograms.html", **output_dict)


@trace_data_blueprint.route('/fpp/plot_view')
def plot_view():
    dic_form = parse_request_params(request)

    dic_param, stats_table = gen_graph_plot_view(dic_form)

    basic_config_yml = BasicConfigYaml()
    title = BasicConfigYaml.get_node(basic_config_yml.dic_config, ['info', 'title'], '')

    output_dict = {
        "title": title,
    }
    output_dict.update(stats_table)
    return render_template("plot_view.html", **output_dict)
