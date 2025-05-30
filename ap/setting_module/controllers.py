import os
from json import dumps, loads

from flask import Blueprint, render_template
from flask_babel import get_locale
from flask_babel import gettext as _

from ap.common.common_utils import (
    get_about_md_file,
    get_cookie_policy_md_file,
    get_data_path,
    get_error_trace_path,
    get_files,
    get_log_path,
    get_terms_of_use_md_file,
    get_user_scripts_path,
    get_wrapr_path,
    sort_processes_by_parent_children_relationship,
)
from ap.common.constants import DEFAULT_POLLING_FREQ, CfgConstantType
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.setting_module.models import CfgConstant, CfgDataSource
from ap.setting_module.schemas import DataSourceSchema
from ap.setting_module.services.about import markdown_to_html
from ap.setting_module.services.process_config import (
    convert2serialize,
    get_all_functions,
    get_all_process,
    get_all_process_no_nested,
)

# socketio = web_socketio[SOCKETIO]

setting_module_blueprint = Blueprint(
    'setting_module',
    __name__,
    template_folder=os.path.join('..', 'templates', 'setting_module'),
    static_folder=os.path.join('..', 'static', 'setting_module'),
    static_url_path=os.path.join(os.sep, 'static', 'setting_module'),
    url_prefix='/ap',
)


@setting_module_blueprint.route('/config')
def config_screen():
    data_sources = CfgDataSource.get_all()
    ds_schema = DataSourceSchema(many=True)

    all_datasource = [convert2serialize(ds) for ds in data_sources]
    dump_data = ds_schema.dumps(data_sources)
    data_source_list = loads(dump_data)
    import_err_dir = get_error_trace_path().replace('\\', '/')

    # get polling frequency
    polling_frequency = CfgConstant.get_value_by_type_first(CfgConstantType.POLLING_FREQUENCY.name)
    if polling_frequency is None:
        # set default polling freq.
        polling_frequency = DEFAULT_POLLING_FREQ
        CfgConstant.create_or_update_by_type(
            const_type=CfgConstantType.POLLING_FREQUENCY.name,
            const_value=polling_frequency,
        )

    all_procs = get_all_process()
    all_functions = get_all_functions()

    output_dict = {
        'page_title': _('Application Configuration'),
        'procs': sort_processes_by_parent_children_relationship(all_procs),
        'import_err_dir': import_err_dir,
        'polling_frequency': int(polling_frequency),
        'data_sources': data_source_list,
        'all_datasource': dumps(all_datasource),
        'log_path': get_log_path(),
        'data_path': get_data_path(),
        'all_function': dumps(all_functions),
        # 'ds_tables': ds_tables
    }

    # get R ETL wrap functions
    py_etl_path = os.path.join(get_user_scripts_path(), 'py')  # py etl folder path
    r_etl_path = os.path.join(get_wrapr_path(), 'func', 'etl')  # r etl folder path

    # todo: refactor. this is a borderline treasonous use of exceptions
    try:
        r_etl_scripts = get_files(directory=r_etl_path, depth_from=1, depth_to=1, file_name_only=True) or []
    except Exception:
        r_etl_scripts = []
    try:
        py_etl_scripts = get_files(directory=py_etl_path, depth_from=1, depth_to=1, file_name_only=True) or []
    except Exception:
        py_etl_scripts = []

    etl_scripts = r_etl_scripts + py_etl_scripts
    output_dict.update({'etl_scripts': etl_scripts})
    output_dict.update({'py_etl_scripts': py_etl_scripts})

    return render_template('config.html', **output_dict)


@setting_module_blueprint.route('/config/filter')
def filter_config():
    processes = get_all_process_no_nested(with_parent=False)
    # generate english name for process
    for proc_data in processes:
        if not proc_data['name_en']:
            proc_data['name_en'] = to_romaji(proc_data['name'])
    output_dict = {
        'procs': processes,
    }
    return render_template('filter_config.html', **output_dict)


# @setting_module_blueprint.route('/config/job/<int:page>', methods=['GET'])
# def background_process(page=1):
@setting_module_blueprint.route('/config/job', methods=['GET'])
def background_process():
    output_dict = {'page_title': _('Job List'), 'jobs': []}
    return render_template('background_job.html', **output_dict)


@setting_module_blueprint.route('/config/job/failed', methods=['GET'])
def failed_jobs():
    output_dict = {'page_title': _('Failed Job List'), 'jobs': []}
    return render_template('failed_jobs.html', **output_dict)


@setting_module_blueprint.route('/about', methods=['GET'])
def about():
    """
    about page
    """
    markdown_file_path = get_about_md_file()
    css, html = markdown_to_html(markdown_file_path)
    return render_template('about.html', css=css, content=html)


@setting_module_blueprint.route('/cookie-policy', methods=['GET'])
def cookie_policy():
    """
    about page
    """
    current_locale = get_locale()
    markdown_file_path = get_cookie_policy_md_file(current_locale)
    css, html = markdown_to_html(markdown_file_path)
    return render_template('cookie_policy.html', css=css, content=html)


@setting_module_blueprint.route('/terms_of_use', methods=['GET'])
def term_of_use():
    """
    term of use page
    """
    current_locale = get_locale()
    markdown_file_path = get_terms_of_use_md_file(current_locale)
    css, html = markdown_to_html(markdown_file_path)
    return render_template('terms_of_use.html', css=css, content=html, do_not_send_ga=True)


@setting_module_blueprint.route('/config/master')
def master_config():
    processes = get_all_process_no_nested(with_parent=False)
    # generate english name for process
    for proc_data in processes:
        if not proc_data['name_en']:
            proc_data['name_en'] = to_romaji(proc_data['name'])
    output_dict = {
        'procs': processes,
    }
    return render_template('master_cfg.html', **output_dict)


@setting_module_blueprint.route('/register_by_file')
def register_by_file_page():
    return render_template('register_by_file.html')
