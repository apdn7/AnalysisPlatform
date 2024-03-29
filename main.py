import os
import sys

from ap import create_app, get_basic_yaml_obj, get_start_up_yaml_obj, init_db
from ap.common.clean_expired_request import add_job_delete_expired_request
from ap.common.clean_old_data import (
    add_job_delete_old_zipped_log_files,
    add_job_zip_all_previous_log_files,
)
from ap.common.constants import ANALYSIS_INTERFACE_ENV
from ap.script.disable_terminal_close_button import disable_terminal_close_btn

# main params
param_cnt = len(sys.argv)
port = None

env = os.environ.get(ANALYSIS_INTERFACE_ENV, 'prod')
app = create_app('config.%sConfig' % env.capitalize())

if __name__ == '__main__':
    from ap.common.backup_db import add_backup_dbs_job
    from ap.common.check_available_port import check_available_port
    from ap.common.logger import set_log_config
    from ap.common.memoize import clear_cache

    set_log_config()

    # main params
    param_cnt = len(sys.argv)
    dic_start_up = get_start_up_yaml_obj().dic_config
    if dic_start_up:
        port = get_start_up_yaml_obj().dic_config['setting_startup'].get('port', None)

    if not port:
        basic_config_yaml = get_basic_yaml_obj()
        port = basic_config_yaml.dic_config['info'].get('port-no') or app.config.get('PORT')

    check_available_port(port)

    # Universal DB init
    init_db(app)

    # unlock db
    true_values = [True, 'true', '1', 1]
    should_unlock_db = os.environ.get('UNLOCK_DB', 'false')
    if str(should_unlock_db).lower() in true_values:
        from ap.script.hot_fix.fix_db_issues import unlock_db

        unlock_db(app.config['APP_DB_FILE'])
        unlock_db(app.config['UNIVERSAL_DB_FILE'])

    # import yaml
    with app.app_context():
        # trans_yaml = TransformYamlToDb()
        # trans_yaml.transform()

        # init cfg_constants for usage_disk
        from ap.setting_module.models import CfgConstant

        CfgConstant.initialize_disk_usage_limit()

    from ap.api.setting_module.services.polling_frequency import add_idle_mornitoring_job
    from ap.common.common_utils import bundle_assets

    add_job_zip_all_previous_log_files()
    add_job_delete_old_zipped_log_files()
    add_idle_mornitoring_job()

    # delete req_id created > 24h ago
    add_job_delete_expired_request()

    # TODO : OSS
    # check and update R-Portable folder
    # should_update_r_lib = os.environ.get('UPDATE_R', 'false')
    # if should_update_r_lib and should_update_r_lib.lower() in true_values:
    #     from ap.script.check_r_portable import check_and_copy_r_portable
    #
    #     check_and_copy_r_portable()

    # disable quick edit of terminal to avoid pause
    is_debug = app.config.get('DEBUG')
    if not is_debug:
        try:
            from ap.script.disable_terminal_quickedit import disable_quickedit

            disable_quickedit()
            # from ap.script.hide_exe_root_folder import hide_bundle_folder, heartbeat_bundle_folder
            # heartbeat_bundle_folder()
            # hide_bundle_folder()
        except Exception:
            pass

    # add job when app started
    add_backup_dbs_job()

    # TODO : OSS
    # kick R process
    # from ap.script.call_r_process import call_r_process
    #
    # call_r_process()

    # clear cache
    clear_cache()

    # bundle assets
    with app.app_context():
        bundle_assets(app)

    if not app.config.get('TESTING'):
        # hide close button of cmd
        disable_terminal_close_btn()

    if env == 'dev':
        print('Development Flask server !!!')
        # use_reloader=False to avoid scheduler load twice
        app.run(host='0.0.0.0', port=port, threaded=True, debug=is_debug, use_reloader=False)
        # app.run(host="0.0.0.0", port=port, threaded=True, debug=is_debug)
    else:
        from waitress import serve

        print('Production Waitress server !!!')
        serve(app, host='0.0.0.0', port=port, threads=20)
