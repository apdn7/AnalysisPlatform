import pandas as pd

from ap.common.common_utils import DATE_FORMAT_SIMPLE, FREQ_FOR_RANGE, TERM_FORMAT
from ap.common.constants import CacheType, DataCountType
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.timezone_utils import from_utc_to_localtime
from ap.trace_data.transaction_model import DataCountTable, TransactionData


def gen_full_data_by_time(df, start_date, end_date, query_type):
    data = {}
    max_val = None
    min_val = None
    group_conditions = [
        df[DataCountTable.datetime.name].dt.year,
        df[DataCountTable.datetime.name].dt.month,
    ]
    if query_type != DataCountType.YEAR.value:
        # month and week
        group_conditions.append(df[DataCountTable.datetime.name].dt.day)
    if query_type == DataCountType.WEEK.value:
        # week only
        group_conditions.append(df[DataCountTable.datetime.name].dt.hour)
    df_grouped = df.groupby(group_conditions).sum()
    df_indexes = df_grouped.index.values.tolist()
    date_range = pd.date_range(start_date, end_date, freq=FREQ_FOR_RANGE[query_type])

    term_format = TERM_FORMAT[query_type]
    used_index = []
    for term in date_range:
        current_term = term.strftime(term_format)
        current_index = (term.year, term.month)
        if query_type != DataCountType.YEAR.value:
            current_index += (term.day,)
        if query_type == DataCountType.WEEK.value:
            current_index += (term.hour,)
        count_data = 0
        # date_range range duplicated value
        if current_index in used_index:
            continue
        used_index.append(current_index)
        if current_index in df_indexes:
            # set value if existing in list
            count_data = df_grouped.loc[current_index][DataCountTable.count.name]

        # set max min
        if max_val is None or count_data > max_val:
            max_val = count_data
        if min_val is None or count_data < min_val:
            min_val = count_data

        if current_term in data:
            data[current_term][DataCountTable.count.name].append(count_data)
        else:
            data[current_term] = {DataCountTable.count.name: [count_data]}

    if query_type == DataCountType.MONTH.value:
        data_count = []
        for k in data:
            data_count += data[k][DataCountTable.count.name]
        data[DataCountTable.count.name] = data_count
    return data, min_val, max_val


@log_execution_time()
@memoize(cache_type=CacheType.TRANSACTION_DATA)
def get_data_count_by_time_range(proc_id, start_date, end_date, query_type, local_tz, count_in_file: bool):
    data = None
    min_val = None
    max_val = None

    with DbProxy(gen_data_source_of_universal_db(proc_id), True) as db_instance:
        trans_data = TransactionData(proc_id)
        _, data_count = trans_data.select_data_count(db_instance, start_date, end_date, count_in_file)

    # data_count = ProcDataCount.get_by_proc_id(proc_id, start_date, end_date)
    # data_count = [[r.datetime, r.count] for r in data_count]

    if data_count:
        df = pd.DataFrame(
            data_count,
            columns=[
                DataCountTable.datetime.name,
                DataCountTable.count.name,
            ],
        )

        def local_datetime(t):
            return from_utc_to_localtime(t, local_tz)

        df[DataCountTable.datetime.name] = df[DataCountTable.datetime.name].apply(local_datetime)
        # group data count by datetime and process id, to hours
        df = df.groupby([DataCountTable.datetime.name], as_index=False).sum()
        df[DataCountTable.datetime.name] = pd.to_datetime(
            arg=df[DataCountTable.datetime.name],
            format=DATE_FORMAT_SIMPLE,
        )
        # convert to localtime to genen date_range and group data
        start_date = local_datetime(start_date)
        end_date = local_datetime(end_date)
        data, min_val, max_val = gen_full_data_by_time(df, start_date, end_date, query_type)
    return data, min_val, max_val
