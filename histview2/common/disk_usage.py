import shutil
import json

from histview2.common.memoize import memoize
from histview2.common.common_utils import get_ip_address
from histview2.setting_module.models import CfgConstant
from histview2.common.constants import DiskUsageStatus
from histview2.common.logger import log_execution_time


class DiskUsageInterface:

    @classmethod
    def get_disk_usage(cls, path=None):
        raise NotImplementedError()


class MainDiskUsage(DiskUsageInterface):
    """
    Checks disk usage of disk/partition that main application was installed on.

    """

    @classmethod
    def get_disk_usage(cls, path=None):
        return shutil.disk_usage(path=path)


@memoize(duration=5*60)
def get_disk_usage_percent(path=None):
    """
    Gets disk usage information.

    :param path: disk location<br>In case not pass this argument, it will be set './' as default location
    :return: a tuple of (disk status, used percent)
    """
    if not path:
        path = './'  # as default dir

    dict_status_measures = {CfgConstant.get_warning_disk_usage(): DiskUsageStatus.Warning,
                                CfgConstant.get_error_disk_usage(): DiskUsageStatus.Full}
    dict_limit_capacity = {y: x for x, y in dict_status_measures.items() if x}  # switch key value

    status = DiskUsageStatus.Normal
    used_percent = 0
    rules = [MainDiskUsage]

    for checker in rules:
        usage = checker.get_disk_usage(path)
        used_percent = round(usage.used / usage.total * 100)
        for measure in sorted(dict_status_measures.keys()):
            if measure:
                if used_percent >= measure:
                    status = dict_status_measures.pop(measure)
        if not dict_status_measures:
            break

    return status, used_percent, dict_limit_capacity


def get_disk_capacity():
    """
    Get information of disk capacity on Bridge Station & Postgres DB

    :return: <b>DiskCapacityException</b> object that include disk status, used percent and message if have.
    """
    disk_status, used_percent, dict_limit_capacity = get_disk_usage_percent()
    print(f'Disk usage: {used_percent}% - {disk_status.name}')

    message = ''
    if disk_status == DiskUsageStatus.Full:
        message = 'Data import has stopped because the hard disk capacity of `__SERVER_INFO__` has reached ' \
                  f'{dict_limit_capacity.get(DiskUsageStatus.Full)}%. ' \
                  'Data import will restart when unnecessary data is deleted and the free space increases.'
    elif disk_status == DiskUsageStatus.Warning:
        message = 'Please delete unnecessary data because the capacity of the hard disk of `__SERVER_INFO__` has ' \
                  f'reached {dict_limit_capacity.get(DiskUsageStatus.Warning)}%.'

    server_info = get_ip_address()
    message = message.replace('__SERVER_INFO__', server_info)
    return DiskCapacityException(disk_status, used_percent, server_info,
                                 'EdgeServer',
                                 dict_limit_capacity.get(DiskUsageStatus.Warning),
                                 dict_limit_capacity.get(DiskUsageStatus.Full), message)


def get_disk_capacity_once(_job_id=None):
    """
    Get information of disk capacity on Bridge Station & Postgres DB and always return DiskCapacityException object

    Attention: DO NOT USE ANYWHERE ELSE, this is only used in send_processing_info method to serve checking
     disk capacity for each job.

    :param _job_id: serve to check & run only once for each <b>_job_id</b>
    :return: <b>DiskCapacityException</b> object
    """
    return get_disk_capacity()


class DiskCapacityException(Exception):
    """Exception raised for disk usage exceed the allowed limit.

    Attributes:
        disk_status -- status of disk usage
        used_percent -- amount of used storage
        server_info -- String of server information
        server_type -- Type of server
        warning_limit_percent -- limit level
        error_limit_percent -- limit level
        message -- explanation of the error
    """

    def __init__(self, disk_status, used_percent, server_info, server_type, warning_limit_percent, error_limit_percent,
                 message):
        self.disk_status: DiskUsageStatus = disk_status
        self.used_percent = used_percent
        self.server_info = server_info
        self.server_type = server_type
        self.warning_limit_percent = warning_limit_percent
        self.error_limit_percent = error_limit_percent
        self.message = message
        super().__init__(self.message)

    def to_dict(self):
        return {
            'disk_status': self.disk_status.name,
            'used_percent': self.used_percent,
            'server_info': self.server_info,
            'server_type': self.server_type,
            'warning_limit_percent': self.warning_limit_percent,
            'error_limit_percent': self.error_limit_percent,
            'message': self.message
        }



@log_execution_time()
def get_disk_capacity_to_load_UI():
    disk_capacity = {
        'EdgeServer': None,
    }

    # check Edge Server
    edge_disk_capacity = get_disk_capacity()
    disk_capacity['EdgeServer'] = edge_disk_capacity.to_dict()

    return disk_capacity


def add_disk_capacity_into_response(response, disk_capacity):
    render_data = response.get_data()
    script = f'<script>var disk_capacity = {json.dumps(disk_capacity)};</script>'
    render_data = render_data.replace(bytes('</html>', 'UTF-8'), bytes(f'{script}</html>', 'UTF-8'))
    response.set_data(render_data)
