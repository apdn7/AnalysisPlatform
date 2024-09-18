class DateTimeFormatUtils(object):
    datetime_format: str
    date_format: str
    time_format: str

    def __init__(self, dic: dict):
        self.datetime_format = dic['datetime']
        self.date_format = dic['date']
        self.time_format = dic['time']

    HOUR_FORMAT_CODES = ['%H', '%I']
    DATE_FORMAT_CODES = [
        '%a',
        '%A',
        '%w',
        '%d',
        '%b',
        '%B',
        '%m',
        '%y',
        '%Y',
        '%z',
        '%Z',
        '%j',
        '%U',
        '%W',
        '%c',
        '%x',
        '%G',
        '%u',
        '%V',
    ]

    @staticmethod
    def get_datetime_format(datetime_format_str: str):
        format_dict = {
            'datetime': datetime_format_str if datetime_format_str is not None and datetime_format_str != '' else None,
            'date': None,
            'time': None,
        }

        if format_dict['datetime'] is None:
            return DateTimeFormatUtils(format_dict)

        def get_start_index_by_codes(format_codes):
            indexes = [datetime_format_str.index(code) for code in format_codes if code in datetime_format_str]
            return min(indexes) if indexes else None

        time_start_index = get_start_index_by_codes(DateTimeFormatUtils.HOUR_FORMAT_CODES)
        date_start_index = get_start_index_by_codes(DateTimeFormatUtils.DATE_FORMAT_CODES)

        if time_start_index is not None and date_start_index is not None:
            # These are valid indexes if and only if one of them is zero
            if time_start_index == 0:
                format_dict['time'] = datetime_format_str[:date_start_index].strip()
                format_dict['date'] = datetime_format_str[date_start_index:].strip()
            elif date_start_index == 0:
                format_dict['time'] = datetime_format_str[time_start_index:].strip()
                format_dict['date'] = datetime_format_str[:time_start_index].strip()
        elif time_start_index is not None and date_start_index is None:
            format_dict['time'] = datetime_format_str[time_start_index:]
        elif time_start_index is None and date_start_index is not None:
            format_dict['date'] = datetime_format_str[date_start_index:]
        else:
            DateTimeFormatUtils.notify_invalid_format()

        return DateTimeFormatUtils(format_dict)

    @staticmethod
    def notify_invalid_format():
        raise Exception('Invalid datetime format!!!')
