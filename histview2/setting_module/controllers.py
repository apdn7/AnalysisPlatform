import os
from json import dumps

from flask import Blueprint, render_template
from flask_babel import gettext as _, get_locale

from histview2.common.common_utils import get_wrapr_path, get_files, get_error_trace_path, get_about_md_file, \
    get_terms_of_use_md_file
from histview2.common.constants import *
from histview2.common.services import http_content
from histview2.common.yaml_utils import YamlConfig, BasicConfigYaml
from histview2.setting_module.forms import DataSourceForm
from histview2.setting_module.models import CfgConstant, CfgDataSource
from histview2.setting_module.services.about import markdown_to_html
from histview2.setting_module.services.background_process import get_background_jobs_service
from histview2.setting_module.services.process_config import convert2serialize
from histview2.setting_module.services.process_config import get_all_process, get_all_process_no_nested

# socketio = web_socketio[SOCKETIO]

setting_module_blueprint = Blueprint(
    'setting_module',
    __name__,
    template_folder=os.path.join('..', 'templates', 'setting_module'),
    static_folder=os.path.join('..', 'static', 'setting_module'),
    static_url_path=os.path.join(os.sep, 'static', 'setting_module'),
    url_prefix='/histview2'
)


@setting_module_blueprint.route('/config')
def config_screen():
    data_sources = CfgDataSource.get_all()
    data_source_forms = [DataSourceForm(obj=ds) for ds in data_sources]

    all_datasource = [convert2serialize(ds) for ds in data_sources]
    import_err_dir = get_error_trace_path().replace('\\', '/')

    # ローカルパラメータの設定
    basic_config_yaml = BasicConfigYaml()
    basic_config = basic_config_yaml.dic_config
    output_dict = {
        'title': YamlConfig.get_node(basic_config, ['info', 'title']),
        'plant': YamlConfig.get_node(basic_config, ['info', 'plant']),
        'factory': YamlConfig.get_node(basic_config, ['info', 'factory']),
        'line_group': YamlConfig.get_node(basic_config, ['info', 'line-group']),
        'port_no': YamlConfig.get_node(basic_config, ['info', 'port-no']),
        'version': YamlConfig.get_node(basic_config, ['info', 'version']),
    }

    # get polling frequency
    polling_frequency = CfgConstant.get_value_by_type_first(CfgConstantType.POLLING_FREQUENCY.name)
    if polling_frequency is None:
        # set default polling freq.
        polling_frequency = DEFAULT_POLLING_FREQ
        CfgConstant.create_or_update_by_type(const_type=CfgConstantType.POLLING_FREQUENCY.name,
                                             const_value=polling_frequency)

    all_procs = get_all_process()
    processes = get_all_process_no_nested()
    procs = [(proc.get('id'), proc.get('name')) for proc in processes]

    output_dict.update({
        'page_title': _('Application Configuration'),
        'proc_list': all_procs,
        'procs': procs,
        'import_err_dir': import_err_dir,
        'polling_frequency': int(polling_frequency),
        'data_sources': data_source_forms,
        'all_datasource': dumps(all_datasource)
        # 'ds_tables': ds_tables
    })

    # get R ETL wrap functions
    wrap_path = get_wrapr_path()
    func_etl_path = os.path.join(wrap_path, 'func', 'etl')
    try:
        etl_scripts = get_files(directory=func_etl_path, depth_from=1, depth_to=1, file_name_only=True) or []
    except Exception:
        etl_scripts = []
    output_dict.update({'etl_scripts': etl_scripts})

    return render_template("config.html", **output_dict)


@setting_module_blueprint.route('/config/filter')
def filter_config():
    basic_config_yaml = BasicConfigYaml()
    basic_config = basic_config_yaml.dic_config
    processes = get_all_process()
    output_dict = {
        "title": YamlConfig.get_node(basic_config, ['info', 'title']),
        "version": YamlConfig.get_node(basic_config, ['info', 'version']),
        'procs': processes,
    }
    return render_template("filter_config.html", **output_dict)


@setting_module_blueprint.route('/config/master_cfg')
def master_cfg():
    basic_config_yaml = BasicConfigYaml()
    basic_config = basic_config_yaml.dic_config
    processes = get_all_process()
    output_dict = {
        "title": YamlConfig.get_node(basic_config, ['info', 'title']),
        'procs': processes,
    }
    return render_template("master_config.html", **output_dict)


@setting_module_blueprint.route('/config/job', methods=['GET'])
def backgound_process():
    basic_config_yaml = BasicConfigYaml()
    output_dict = {
        'title': YamlConfig.get_node(basic_config_yaml.dic_config, ['info', 'title']),
        "page_title": _("Job List"),
    }
    jobs = get_background_jobs_service()
    jobs = dumps(jobs, ensure_ascii=False, default=http_content.json_serial)
    output_dict['jobs'] = jobs

    # return render_template("background_job.html", **output_dict, async_mode=socketio.async_mode)
    return render_template("background_job.html", **output_dict)


@setting_module_blueprint.route('/about', methods=['GET'])
def about():
    """
    about page
    """
    markdown_file_path = get_about_md_file()
    css, html = markdown_to_html(markdown_file_path)
    return render_template("about.html", css=css, content=html)


@setting_module_blueprint.route('/terms_of_use', methods=['GET'])
def term_of_use():
    """
    term of use page
    """
    current_locale = get_locale()
    markdown_file_path = get_terms_of_use_md_file(current_locale)
    css, html = markdown_to_html(markdown_file_path)
    return render_template("terms_of_use.html", css=css, content=html)


@setting_module_blueprint.route('/config/master')
def master_config():
    basic_config_yaml = BasicConfigYaml()
    basic_config = basic_config_yaml.dic_config
    processes = get_all_process()
    output_dict = {
        "title": YamlConfig.get_node(basic_config, ['info', 'title']),
        'procs': processes,
    }
    return render_template("master_cfg.html", **output_dict)
