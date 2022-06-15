import os

from histview2 import create_app, init_db
from histview2.common.memoize import clear_cache

env = os.environ.get('ANALYSIS_INTERFACE_ENV', 'dev')
app = create_app('config.%sConfig' % env.capitalize())

if __name__ == '__main__':
    from histview2.common.logger import set_log_config
    from histview2.common.check_available_port import check_available_port
    from histview2.common.yaml_utils import BasicConfigYaml
    from histview2.common.yaml_utils import TransformYamlToDb
    from histview2.common.backup_db import add_backup_dbs_job

    set_log_config()
    basic_config_yaml = BasicConfigYaml()
    port = basic_config_yaml.dic_config['info'].get('port-no') or app.config.get('PORT')
    check_available_port(port)

    # Universal DB init
    init_db(app)

    # unlock db
    true_values = [True, 'true', '1', 1]
    should_unlock_db = os.environ.get('UNLOCK_DB', 'false')
    if str(should_unlock_db).lower() in true_values:
        from histview2.script.hot_fix.fix_db_issues import unlock_db

        unlock_db(app.config['APP_DB_FILE'])
        unlock_db(app.config['UNIVERSAL_DB_FILE'])

    # import yaml
    with app.app_context():
        trans_yaml = TransformYamlToDb()
        trans_yaml.transform()

        # init cfg_constants for usage_disk
        from histview2.setting_module.models import CfgConstant

        CfgConstant.initialize_disk_usage_limit()

    from histview2.common.clean_old_data import run_clean_data_job
    from histview2.common.common_utils import get_data_path
    from histview2.api.setting_module.services.polling_frequency import add_idle_mornitoring_job

    run_clean_data_job(folder=get_data_path(), num_day_ago=30, job_repeat_sec=24 * 60 * 60)
    add_idle_mornitoring_job()

    # TODO : OSS
    # check and update R-Portable folder
    # should_update_r_lib = os.environ.get('UPDATE_R', 'false')
    # if should_update_r_lib and should_update_r_lib.lower() in true_values:
    #     from histview2.script.check_r_portable import check_and_copy_r_portable
    #
    #     check_and_copy_r_portable()

    # disable quick edit of terminal to avoid pause
    is_debug = app.config.get('DEBUG')
    if not is_debug:
        from histview2.script.disable_terminal_quickedit import disable_quickedit

        disable_quickedit()

        # TODO : OSS
        # heartbeat_bundle_folder()
        # hide_bundle_folder()

    # add job when app started
    add_backup_dbs_job()

    # TODO : OSS
    # kick R process
    # from histview2.script.call_r_process import call_r_process
    #
    # call_r_process()

    # clear cache
    clear_cache()

    # convert user setting
    from histview2.script.convert_user_setting import convert_user_setting_url

    # convert_user_setting()
    convert_user_setting_url()

    app.run(host="0.0.0.0", port=port, threaded=True, debug=is_debug)
