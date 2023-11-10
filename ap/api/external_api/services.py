import dataclasses
import json
import re
from datetime import datetime
from urllib.parse import parse_qs, urlencode

from dateutil import tz

from ap.common.common_utils import API_DATETIME_FORMAT
from ap.common.constants import *
from ap.common.logger import log_execution_time
from ap.common.services.api_exceptions import APIError, ErrorMessage
from ap.common.services.http_content import json_dumps
from ap.setting_module.models import CfgOption, CfgRequest, insert_or_update_config, make_session


@log_execution_time()
def save_odf_data_of_request(dic_param):
    req_id = dic_param[COMMON].get(REQ_ID, '')
    od_filters = []
    col_ids = []
    if req_id:
        for _, list_filter in dic_param[FILTER_ON_DEMAND].items():
            for od_filter in list_filter:
                col_id = od_filter[COL_ID]
                if col_id not in col_ids:
                    col_ids.append(col_id)
                    filter_obj = {
                        'id': col_id,
                        'name': od_filter[COL_MASTER_NAME],
                        'type': od_filter[COL_DATA_TYPE],
                        'values': od_filter[UNIQUE_CATEGORIES],
                    }
                    od_filters.append(filter_obj)
        with make_session() as meta_session:
            CfgRequest.save_odf_by_req_id(meta_session, req_id, json_dumps(od_filters))


@log_execution_time()
def save_request_option(cfg_option):
    option = None
    with make_session() as meta_session:
        # data source
        option = insert_or_update_config(
            meta_session,
            cfg_option,
        )
        meta_session.commit()

    return option


@log_execution_time()
def cast_datetime_from_query_string(request_string):
    # cast datetime from query_string to tzinfo=UTC in case of tzinfo=None
    req = parse_qs(request_string)
    [start_datetime] = req.get(START_DATETIME) or [None]
    [end_datetime] = req.get(END_DATETIME) or [None]

    if not start_datetime or not end_datetime:
        return request_string

    start_datetime = datetime.fromisoformat(start_datetime.replace('Z', '+00:00'))
    end_datetime = datetime.fromisoformat(end_datetime.replace('Z', '+00:00'))
    if not start_datetime.tzinfo:
        req[START_DATETIME] = start_datetime.replace(tzinfo=tz.tzutc()).strftime(
            API_DATETIME_FORMAT
        )
    if not end_datetime.tzinfo:
        req[END_DATETIME] = end_datetime.replace(tzinfo=tz.tzutc()).strftime(API_DATETIME_FORMAT)
    return urlencode(req, doseq=True)


@dataclasses.dataclass
class ErrorTypeDetail:
    reason: str
    status: int


class ExternalErrorMessage:
    invalid_datetime_msg = "Invalid format: '{}' must be in ISO8601 format (without seconds or time). For example, '2022-03-01T07:00', '2022-03-01'."

    invalid_id_format_msg = "Invalid format: '{}' must be a positive integer. For example, {}."

    invalid_option_id_msg = 'Invalid value: option_id={} not found. Make sure you are using the req_id and option_id returned from /options.'

    invalid_req_id_msg = 'Invalid value: req_id={} not found. Make sure you are using the req_id passed to /bookmark or /dn7.'

    invalid_latest_msg = "Invalid format: 'latest' must be a positive number, between 0.01 and 20000. For example, 24 (=1day), 0.5 (=30min)."

    invalid_od_filter_msg = "Invalid format: 'od_filter' must be a dictionary with column id as keys and an array of filter values as values. For example, {2: ['OK'], 3: ['Machine01', 'Machine02']}."

    invalid_function_msg = "Invalid format: 'function' must be a text string of one of: 'fpp', 'pcp', 'rlp', 'skd', 'msp', 'chm'."

    unexpected_error_msg = 'Unexpected error occured. Error message: {}'

    req_duplicate_id_msg = (
        'Found duplicate req_id: Use an unique req_id (for example, timestamp or UUID) that has not been used in '
        'the past 24 hours. '
    )

    missing_field_msg = 'Missing required field: {}'

    out_of_range_msg = 'Parameter value is out of range: {} must be {}'

    @classmethod
    def missing_field(cls, field_name):
        """
        :param field_name:
        :return:
        """
        return (
            ErrorMessage(
                reason=ErrorType.missing_field.reason,
                message=cls.missing_field_msg.format(field_name),
            ),
            ErrorType.missing_field.status,
        )

    @classmethod
    def invalid_datetime_format(cls, field_name):
        """

        :param field_name:
        :return:
        """

        return (
            ErrorMessage(
                reason=ErrorType.invalid_format.reason,
                message=cls.invalid_datetime_msg.format(field_name),
            ),
            ErrorType.invalid_format.status,
        )

    @classmethod
    def invalid_id_format(cls, field_name, example_value=EXAMPLE_VALUE):
        """

        :param example_value:
        :param field_name:
        :return:
        """

        return (
            ErrorMessage(
                reason=ErrorType.invalid_format.reason,
                message=cls.invalid_id_format_msg.format(field_name, example_value),
            ),
            ErrorType.invalid_format.status,
        )

    @classmethod
    def invalid_option_id(cls, option_value):
        """

        :param option_value:
        :return:
        """
        return (
            ErrorMessage(
                reason=ErrorType.id_notfound.reason,
                message=cls.invalid_option_id_msg.format(option_value),
            ),
            ErrorType.id_notfound.status,
        )

    @classmethod
    def invalid_req_id(cls, req_id):
        """

        :param req_id:
        :return:
        """
        return (
            ErrorMessage(
                reason=ErrorType.id_notfound.reason, message=cls.invalid_req_id_msg.format(req_id)
            ),
            ErrorType.id_notfound.status,
        )

    @classmethod
    def invalid_format(cls, message):
        """

        :param message:
        :return:
        """
        return (
            ErrorMessage(reason=ErrorType.invalid_format.reason, message=message),
            ErrorType.invalid_format.status,
        )

    @classmethod
    def out_of_range(cls, field_name, range):
        """

        :field_nam: column name
        :range: available range
        :return: ErrorMessage
        """
        return (
            ErrorMessage(
                reason=ErrorType.out_of_range.reason,
                message=cls.out_of_range_msg.format(field_name, range),
            ),
            ErrorType.out_of_range.status,
        )

    @classmethod
    def internal_error(cls, msg):
        return (
            ErrorMessage(
                reason=ErrorType.unexpected_error.reason,
                message=cls.unexpected_error_msg.format(msg),
            ),
            ErrorType.unexpected_error.status,
        )

    @classmethod
    def invalid_odf_filter(cls):
        return (
            ErrorMessage(reason=ErrorType.invalid_format.reason, message=cls.invalid_od_filter_msg),
            ErrorType.invalid_format.status,
        )

    @classmethod
    def invalid_function_format(cls):
        """

        :field_nam: column name
        :range: available range
        :return: ErrorMessage
        """
        return (
            ErrorMessage(
                reason=ErrorType.invalid_format.reason,
                message=cls.invalid_function_msg,
            ),
            ErrorType.invalid_format.status,
        )


class ErrorType:
    missing_field = ErrorTypeDetail(reason='missing_field', status=400)
    invalid_format = ErrorTypeDetail(reason='invalid_format', status=400)
    invalid_url = ErrorTypeDetail(reason='invalid_url', status=404)
    unexpected_error = ErrorTypeDetail(reason='unexpected_error', status=500)
    id_notfound = ErrorTypeDetail(reason='id_notfound', status=404)
    out_of_range = ErrorTypeDetail(reason='out_of_range', status=422)
    duplicate_id = ErrorTypeDetail(reason='duplicate_id', status=409)


class ValidationRules:
    _REQUIRED = 'require'
    _DUPLICATED = 'duplicate'
    _FORMAT = 'format'
    _RANGE_VALUE = 'range_value'
    _URL = 'url'
    _LIST_ALLOW = 'list_allow'
    _NOT_FOUND = 'not_found'

    # param data-type
    param_format = None
    required = False
    duplicate = False
    format = False
    range_value = False
    url = False
    list_allow = False  # list of integer (columns)
    not_found = False

    def __init__(self, rules, format=None):
        self.required = rules.get(self._REQUIRED) or False
        self.duplicate = rules.get(self._DUPLICATED) or False
        self.format = rules.get(self._FORMAT) or False
        self.range_value = rules.get(self._RANGE_VALUE) or False
        self.url = rules.get(self._URL) or False
        self.param_format = format
        self.not_found = rules.get(self._NOT_FOUND) or False


class Validation:
    # rule_keys
    _REQUIRED = 'require'
    _DUPLICATED = 'duplicate'
    _FORMAT = 'format'
    _RANGE_VALUE = 'range_value'
    _URL = 'url'
    _EXAMPLE_VALUE = 'example_value'
    _ACCEPT_LIST = 'accept_list'

    # param data-type
    _POSITIVE_INT = 'positive_int'
    _STR = 'str'
    _ISO_DATETIME = 'iso8601'
    _REAL = 'real'
    _ARRAY = 'array'
    _SMALL_INT = 'small_int'
    _LIST_ALLOW = 'list_allow'

    request = None
    params = None
    formats = None

    validate_func = []
    api_error = None

    def __init__(self, request):
        self.request = request.args or json.loads(request.data)

    def validate_required(self):
        for param in self.params.keys():
            if not self.params[param].required:
                continue

            if not self.request.get(param):
                msg_er, status = ExternalErrorMessage.missing_field(param)
                self._add_api_error(status, msg_er)
        return

    def validate_duplicated_req_id(self):
        req_id = self.request.get(REQ_ID)
        option_id = self.request.get(OPTION_ID)

        if option_id:
            return

        req = CfgRequest.get_by_req_id(req_id)
        if req:
            error_msg = ErrorMessage(
                reason=ErrorType.duplicate_id.reason,
                message=ExternalErrorMessage.req_duplicate_id_msg,
            )
            api_error = APIError(status_code=ErrorType.duplicate_id.status)
            api_error.add_error(error_msg=error_msg)
            api_error.check_error()
        return

    def validate_req_id_not_found(self):
        req_id = self.request.get(REQ_ID)
        if req_id and not CfgRequest.get_by_req_id(req_id):
            msg_er, status = ExternalErrorMessage.invalid_req_id(req_id)
            self._add_api_error(status, msg_er)

    def validate_option_id_not_found(self):
        option_id = self.request.get(OPTION_ID)
        if option_id and not CfgOption.get_option(option_id):
            msg_er, status = ExternalErrorMessage.invalid_option_id(option_id)
            self._add_api_error(status, msg_er)

    def validate_odf_data(self):
        od_filter = self.request.get(OD_FILTER)
        if od_filter:
            try:
                for key, values in od_filter.items():
                    key = int(key)
                    for value in values:
                        continue

            except:
                msg_er, status = ExternalErrorMessage.invalid_odf_filter()
                self._add_api_error(status, msg_er)

    def _validate_int(self, value, positive_only=False, list_allow=False, range_value=None):
        is_valid = True
        range_err = False
        try:
            if not list_allow:
                value = [value]
            else:
                # extract number from list
                value = value.split(',')
            for val in value:
                val = int(val)
                if positive_only and val <= 0:
                    is_valid = False
                    return is_valid, range_err

                if range_value and (value < range_value[0] or value > range_value[1]):
                    is_valid = False
                    range_err = True
                    return is_valid, range_err
            return is_valid, range_err
        except Exception:
            is_valid = False
            return is_valid, range_err

    def _validate_real(self, value, list_allow=False, range_value=None):
        is_valid = True
        range_err = False
        try:
            if not list_allow:
                value = [value]
            else:
                # extract number from list
                value = value.split(',')
            for val in value:
                val = float(val)
                if range_value and (val < range_value[0] or val > range_value[1]):
                    is_valid = False
                    range_err = True
                    return is_valid, range_err
            return is_valid, range_err
        except:
            is_valid = False
            return is_valid, range_err

    def _validate_str(self, value, accept_list=None):
        is_valid = True
        out_of_accept_list = False
        try:
            value = str(value)
            if accept_list:
                accept_list = [page.lower() for page in accept_list]
                if value.lower() not in accept_list:
                    is_valid = False
                    out_of_accept_list = True
            return is_valid, out_of_accept_list
        except:
            is_valid = False
            return is_valid, out_of_accept_list
            pass

    def validate_format(self):
        for param in self.params.keys():
            if param not in self.params or not self.params[param].format:
                continue

            msg_er = None
            status = None
            list_allow = False
            example_value = EXAMPLE_VALUE
            format = self.params[param].param_format
            accept_items_from_list = None
            if isinstance(format, dict):
                list_allow = format.get(self._LIST_ALLOW) or False
                example_value = format.get(self._EXAMPLE_VALUE) or example_value
                accept_items_from_list = format.get(self._ACCEPT_LIST) or None
                format = format.get(self._FORMAT)

            param_value = self.request.get(param)

            if not param_value:
                continue

            range_value = None
            use_range_value = self.params[param].range_value
            if use_range_value:
                range_value = self.params[param].param_format[self._RANGE_VALUE] or None

            is_valid = True
            if format in [self._POSITIVE_INT, self._SMALL_INT]:
                positive_only = True
                is_valid, range_err = self._validate_int(
                    param_value,
                    positive_only=positive_only,
                    list_allow=list_allow,
                    range_value=range_value,
                )
                if range_err:
                    msg_er, status = ExternalErrorMessage.out_of_range(param, range_value)

            if format == self._STR:
                is_valid, value_not_in_accepted_list = self._validate_str(
                    param_value, accept_list=accept_items_from_list
                )
                if value_not_in_accepted_list:
                    msg_er, status = ExternalErrorMessage.invalid_function_format()
            if format == self._ARRAY:
                param_value = param_value.split(',')
                if not param_value:
                    is_valid = False

            if format == self._REAL:
                is_valid, range_err = self._validate_real(
                    param_value, list_allow=list_allow, range_value=range_value
                )
                if range_err:
                    msg_er, status = ExternalErrorMessage.out_of_range(param, range_value)

            # start_datetime, end_datetime
            if format == self._ISO_DATETIME:
                try:
                    # do not accept seconds 00:00:00
                    # do not accept timezone +09:00, -05:00
                    pattern = r'(\d{2}:\d{2}:\d{2}Z*)|([+-]\d{2}:\d{2})$'
                    invalid_matching = re.search(pattern, param_value)
                    if invalid_matching:
                        is_valid = False
                        msg_er, status = ExternalErrorMessage.invalid_datetime_format(param)
                    else:
                        # validate iso8601 format
                        # iso8601 accepts Z but should only be '.000Z', but app can accept 00:00Z
                        datetime.fromisoformat(param_value.replace('Z', '+00:00'))
                except:
                    is_valid = False
                    msg_er, status = ExternalErrorMessage.invalid_datetime_format(param)
                    pass

            if not is_valid:
                if not msg_er:
                    msg_er, status = ExternalErrorMessage.invalid_id_format(param, example_value)

                self._add_api_error(status, msg_er)
        return

    def bookmark(self):
        # init rules for each param of /bookmark API
        req_id_rules = ValidationRules(
            {
                self._REQUIRED: True,
                self._DUPLICATED: True,  # not allow duplicate when not option_id
            }
        )
        bookmark_id_rules = ValidationRules(
            {
                self._REQUIRED: True,
                self._FORMAT: True,
            },
            self._POSITIVE_INT,
        )
        datetime_rules = ValidationRules(
            {
                self._REQUIRED: False,
                self._FORMAT: True,
            },
            self._ISO_DATETIME,
        )
        latest_rules = ValidationRules(
            {self._REQUIRED: False, self._FORMAT: True, self._RANGE_VALUE: True},
            {
                self._FORMAT: self._REAL,
                self._RANGE_VALUE: [0.01, 20000],
                self._EXAMPLE_VALUE: '24 (=1day), 0.5 (=30min)',
            },
        )

        # add rules to params
        self.params = {
            REQ_ID: req_id_rules,
            BOOKMARK_ID: bookmark_id_rules,
            START_DATETIME: datetime_rules,
            END_DATETIME: datetime_rules,
            LATEST: latest_rules,
        }

        # validate params
        self.validate_func = [
            self.validate_required(),
            self.validate_duplicated_req_id(),
            self.validate_format(),
            self.validate_option_id_not_found(),
        ]
        return self

    def dn7(self):
        # init rules for each param of /bookmark API
        req_id_rules = ValidationRules(
            {
                self._REQUIRED: True,
                self._DUPLICATED: True,  # not allow duplicate when not option_id
            }
        )
        function_rules = ValidationRules(
            {
                self._REQUIRED: True,
                self._FORMAT: True,
            },
            {
                self._FORMAT: self._STR,
                self._ACCEPT_LIST: [
                    PagePath.FPP.name,
                    PagePath.SKD.name,
                    PagePath.PCP.name,
                    PagePath.CHM.name,
                    PagePath.MSP.name,
                    PagePath.RLP.name,
                ],
            },
        )
        column_rules = ValidationRules(
            {
                self._REQUIRED: True,
                self._FORMAT: True,
            },
            {self._FORMAT: self._POSITIVE_INT, self._LIST_ALLOW: True},
        )
        datetime_rules = ValidationRules(
            {
                self._REQUIRED: False,
                self._FORMAT: True,
            },
            self._ISO_DATETIME,
        )
        objective_rules = ValidationRules(
            {self._REQUIRED: False, self._FORMAT: True}, self._SMALL_INT
        )
        latest_rules = ValidationRules(
            {self._REQUIRED: False, self._FORMAT: True, self._RANGE_VALUE: True},
            {
                self._FORMAT: self._REAL,
                self._RANGE_VALUE: [0.01, 20000],
                self._EXAMPLE_VALUE: '24 (=1day), 0.5 (=30min)',
            },
        )

        # add rules to params
        self.params = {
            REQ_ID: req_id_rules,
            FUNCTION: function_rules,
            COLUMNS: column_rules,
            START_DATETIME: datetime_rules,
            END_DATETIME: datetime_rules,
            OBJECTIVE: objective_rules,
            LATEST: latest_rules,
        }

        # validate params
        self.validate_func = [
            self.validate_required(),
            self.validate_duplicated_req_id(),
            self.validate_format(),
            self.validate_option_id_not_found(),
        ]
        return self

    def columns_of_processes(self):
        process_id_rules = ValidationRules(
            {self._REQUIRED: True, self._FORMAT: True},
            {self._FORMAT: self._POSITIVE_INT, self._LIST_ALLOW: True, self._EXAMPLE_VALUE: '112'},
        )

        self.params = {
            PROCESS_ID: process_id_rules,
        }

        # validate params
        self.validate_func = [
            self.validate_required(),
            self.validate_format(),
        ]
        return self

    def send_a_list_options(self):
        req_id_rules = ValidationRules(
            {
                self._REQUIRED: True,
            }
        )

        odf_rules = ValidationRules(
            {
                self._REQUIRED: True,
            }
        )

        self.params = {
            REQ_ID: req_id_rules,
            OD_FILTER: odf_rules,
        }

        self.validate_func = [
            self.validate_req_id_not_found(),
            self.validate_required(),
            self.validate_odf_data(),
        ]

        return self

    def get_list_options(self):
        req_id_rules = ValidationRules(
            {
                self._REQUIRED: True,
            }
        )

        self.params = {REQ_ID: req_id_rules}

        self.validate_func = [
            self.validate_required(),
            self.validate_req_id_not_found(),
        ]

        return self

    def _add_api_error(self, status, error_msg: ErrorMessage):
        if not self.api_error:
            self.api_error = APIError(status_code=status)
        self.api_error.add_error(error_msg)

    def validate(self):
        if self.api_error:
            self.api_error.check_error()
        return
