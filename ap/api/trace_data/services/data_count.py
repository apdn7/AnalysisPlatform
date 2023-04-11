import pandas as pd

from ap.common.common_utils import DATE_FORMAT_SIMPLE, TERM_FORMAT, FREQ_FOR_RANGE
from ap.common.constants import DataCountType
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.timezone_utils import from_utc_to_localtime
from ap.trace_data.models import ProcDataCount


def gen_full_data_by_time(df, start_date, end_date, query_type):
    data = {}
    max_val = None
    min_val = None
    group_conditions = [
        df[ProcDataCount.datetime.key].dt.year,
        df[ProcDataCount.datetime.key].dt.month
    ]
    if query_type != DataCountType.YEAR.value:
        # month and week
        group_conditions.append(df[ProcDataCount.datetime.key].dt.day)
    if query_type == DataCountType.WEEK.value:
        # week only
        group_conditions.append(df[ProcDataCount.datetime.key].dt.hour)
    df_grouped = df.groupby(group_conditions).sum()
    df_indexs = df_grouped.index.values.tolist()
    date_range = pd.date_range(start_date, end_date, freq=FREQ_FOR_RANGE[query_type])

    term_format = TERM_FORMAT[query_type]
    for term in date_range:
        current_term = term.strftime(term_format)
        current_index = (term.year, term.month)
        if query_type != DataCountType.YEAR.value:
            current_index += (term.day,)
        if query_type == DataCountType.WEEK.value:
            current_index += (term.hour,)
        count_data = 0
        if current_index in df_indexs:
            # set value if existing in list
            count_data = df_grouped.loc[current_index][ProcDataCount.count.key]

        # set max min
        if max_val is None or count_data > max_val:
            max_val = count_data
        if min_val is None or count_data < min_val:
            min_val = count_data

        if current_term in data:
            data[current_term][ProcDataCount.count.key].append(count_data)
        else:
            data[current_term] = {ProcDataCount.count.key: [count_data]}

    if query_type == DataCountType.MONTH.value:
        data_count = []
        for k in data.keys():
            data_count += data[k][ProcDataCount.count.key]
        data[ProcDataCount.count.key] = data_count
    return data, min_val, max_val


@log_execution_time()
@memoize(is_save_file=False)
def get_data_count_by_time_range(proc_id, start_date, end_date, query_type, local_tz):
    data = None
    min_val = None
    max_val = None

    data_count = ProcDataCount.get_by_proc_id(proc_id, start_date, end_date)
    data_count = [[r.datetime, r.process_id, r.count] for r in data_count]

    if data_count:
        df = pd.DataFrame(data_count, columns=[
            ProcDataCount.datetime.key,
            ProcDataCount.process_id.key,
            ProcDataCount.count.key])
        local_datetime = lambda t: from_utc_to_localtime(t, local_tz)
        df[ProcDataCount.datetime.key] = df[ProcDataCount.datetime.key].apply(local_datetime)
        # group data count by datetime and process id, to hours
        df = df.groupby([ProcDataCount.datetime.key, ProcDataCount.process_id.key], as_index=False).sum()
        df.drop(columns=[ProcDataCount.process_id.key], inplace=True)
        df[ProcDataCount.datetime.key] = pd.to_datetime(arg=df[ProcDataCount.datetime.key], format=DATE_FORMAT_SIMPLE)
        # convert to localtime to genen date_range and group data
        start_date = local_datetime(start_date)
        end_date = local_datetime(end_date)
        data, min_val, max_val = gen_full_data_by_time(df, start_date, end_date, query_type)
    return data, min_val, max_val
