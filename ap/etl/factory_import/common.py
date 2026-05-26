from abc import ABC, abstractmethod
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any, Self

from ap.common.common_utils import Bound, TimeRange, add_double_quotes, convert_time
from ap.common.constants import DATETIME_DUMMY, SQL_DAYS_AGO, DBType
from ap.common.datetime_format_utils import detect_datetime_format, format_datetime_to_str
from ap.common.log import log_execution_time
from ap.common.pydn.dblib import mssqlserver, mysql, oracle
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.timezone_utils import get_time_info
from ap.setting_module.models import CfgProcess
from ap.trace_data.transaction_model import ImportHistoryRecord


class ImportBase(ABC):
    """Base class for import factory data"""

    def __init__(self, process: CfgProcess) -> None:
        self.process = process
        self.is_tz_col = self.detect_is_tz_col()
        self.datetime_format, self.db_timezone = self.handle_time_zone()

    @abstractmethod
    def build_query(
        self,
        db_instance,
        time_range: TimeRange,
        sql_limit,
    ) -> tuple[str, Any]: ...

    @classmethod
    def get_instance(cls, process: CfgProcess) -> Self:
        if process.data_source.type == DBType.POSTGRES_SOFTWARE_WORKSHOP.name:
            from ap.etl.factory_import.software_workshop import ImportSoftwareWorkshop

            return ImportSoftwareWorkshop(process)
        else:
            from ap.etl.factory_import.others import ImportOthers

            return ImportOthers(process)

    def handle_time_zone(self):
        # convert utc time func
        from ap.api.setting_module.services.factory_import import get_tzoffset_of_random_record

        date_val, tzoffset_str, db_timezone = get_tzoffset_of_random_record(
            self.process.data_source,
            self.process.table_name_for_query_datetime(),
            self.process.get_auto_increment_col_else_get_date(),
        )

        datetime_format = None
        if isinstance(date_val, str):
            # in case of sqlite3 database, datetime column always is text
            datetime_format = detect_datetime_format(date_val)

        if tzoffset_str or self.process.data_source.db_detail.use_os_timezone:
            # use os time zone
            db_timezone = None

        is_timezone_inside, db_time_zone, utc_offset = get_time_info(date_val, db_timezone)

        return datetime_format, db_time_zone

    def detect_is_tz_col(self):
        from ap.api.setting_module.services.factory_import import handle_time_zone

        col = self.process.get_auto_increment_col_else_get_date()
        tz_info = handle_time_zone(self.process, col)
        is_tz_col = tz_info[0] if isinstance(tz_info, (list, tuple)) else False
        if not is_tz_col:
            get_date_col = add_double_quotes(self.process.get_auto_increment_col_else_get_date())
            orig_tblname = self.process.table_name_for_query_datetime().strip('"')
            with ReadOnlyDbProxy(self.process.data_source) as db_instance:
                is_tz_col = db_instance.is_timezone_hold_column(orig_tblname, get_date_col)

        return is_tz_col

    def get_factory_min_max_date(self):
        with ReadOnlyDbProxy(self.process.data_source) as db_instance:
            # gen sql
            agg_results = []
            get_date_col = add_double_quotes(self.process.get_auto_increment_col_else_get_date())
            orig_tblname = self.process.table_name_for_query_datetime().strip('"')
            table_name = add_double_quotes(orig_tblname) if not isinstance(db_instance, mysql.MySQL) else orig_tblname
            for agg_func in ['MIN', 'MAX']:
                sql = f'select {agg_func}({get_date_col}) from {table_name}'
                if isinstance(db_instance, mssqlserver.MSSQLServer):
                    sql = f'select convert(varchar(30), {agg_func}({get_date_col}), 120) from {table_name}'
                if isinstance(db_instance, oracle.Oracle):
                    column = db_instance.format_tz_column(orig_tblname, f'{agg_func}({get_date_col})', get_date_col)
                    sql = f'select {column} from {table_name}'

                sql = self.process.filter_for_query_datetime(sql)
                sql = f'{sql} {"AND" if "WHERE" in sql else "WHERE"} {get_date_col} IS NOT NULL'
                _, rows = db_instance.run_sql(sql, row_is_dict=False)

                # so rows = [(None,)], not = None
                if not rows or rows == [(None,)]:
                    # in case no data, time range is unidentified
                    return None

                agg_results.append(rows[0][0])

        min_time, max_time = agg_results
        if max_time == DATETIME_DUMMY:
            return None

        # because of sqlite has not tz information in DB, it necessary to get via value
        # in case of could not extract timezone from data value, try to get timezone by factory instance
        from ap.setting_module.services.background_process import format_factory_date_to_meta_data

        min_time = format_factory_date_to_meta_data(min_time, self.is_tz_col, self.process.data_source.type)
        max_time = format_factory_date_to_meta_data(max_time, self.is_tz_col, self.process.data_source.type)

        return TimeRange(
            min=Bound.included(min_time),
            max=Bound.included(max_time),
        )

    def get_query_column_names(self) -> list[str]:
        etl_func = self.process.get_etl_func()
        if etl_func:
            from ap.api.setting_module.services.show_latest_record import get_info_from_db

            # get all column from db
            # TODO: need to change the way of getting cols is db, can SELECT * FROM table in get_factory_data function
            query_column_names, *_ = get_info_from_db(
                data_source=self.process.data_source,
                table_name=self.process.table_name,
                process_factid=self.process.process_factid,
                master_type=self.process.master_type,
            )
        else:
            query_column_names = [
                col.column_raw_name for col in self.process.get_transaction_process_columns() if col.is_normal_column
            ]

        return query_column_names

    def get_time_range_from_start_end_time(self, start_time, end_time, past_import: bool = False) -> TimeRange | None:
        """Get time range from start and end time
        TODO: Refactor time range construction logic to eliminate this function.
         Currently, this function constructs bounds without sufficient context about the time range semantics.
         The caller should provide a pre-constructed TimeRange object instead, making this function unnecessary.
         See: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/work_items/547
        """
        if past_import:
            return TimeRange(min=Bound.included(start_time), max=Bound.excluded(end_time))
        return TimeRange(min=Bound.excluded(start_time), max=Bound.included(end_time))

    def convert_datetime(self, value: datetime):
        if self.datetime_format:
            return format_datetime_to_str(value, self.datetime_format)
        else:
            from ap.setting_module.services.background_process import format_factory_date_to_meta_data

            return format_factory_date_to_meta_data(
                value,
                self.is_tz_col,
                self.process.data_source.type,
            )

    def detect_query_datetime_range(
        self,
        factory_time_range: TimeRange,
        import_history_record: ImportHistoryRecord | None,
    ) -> TimeRange | None:
        """Given a maximum timerange in factory db, determine the next time ranges to query
        We have 2 time ranges to consider:
        - selected_time_range: timerange will be used to query data
            - In first time: [-30th_from_now, min(now, max_date_in_factory)]
            - From second time: (latest_import_date, min(now, max_date_in_factory)]
        - factory_time_range: this is the timerange in database and not allow (None or unidentified max min)

        The time ranges we want must be:
        - in the selected time range
        - in the factory time range
        Then we must:
        - intersect the selected time range and factory time range
        """
        now = datetime.now(self.db_timezone)
        if factory_time_range.min.value.tzinfo is None:
            now = now.replace(tzinfo=None)
        max_bound = Bound.included(min(now, factory_time_range.max.value))
        if import_history_record is None:
            import_from = now - timedelta(days=SQL_DAYS_AGO)
            import_from = import_from.replace(hour=0, minute=0, second=0, microsecond=0)
            if import_from > factory_time_range.max.value:
                # In case factory max date less than [now - 30]
                import_from = factory_time_range.max.value - timedelta(days=SQL_DAYS_AGO)
                import_from = import_from.replace(hour=0, minute=0, second=0, microsecond=0)
            min_bound = Bound.included(import_from)
        else:
            min_bound = Bound.excluded(convert_time(import_history_record.import_to, return_string=False))

        selected_time_range = TimeRange(min=min_bound, max=max_bound)

        return selected_time_range.intersect(factory_time_range)

    @log_execution_time()
    def _get_factory_data(self, time_range: TimeRange) -> Iterator[tuple]:
        """Get data from factory db for the given time range"""
        from ap.api.setting_module.services.factory_import import FETCH_MANY_SIZE, SQL_FACTORY_LIMIT

        # exe sql
        with ReadOnlyDbProxy(self.process.data_source) as db_instance:
            sql, params = self.build_query(db_instance, time_range, SQL_FACTORY_LIMIT)
            data = db_instance.fetch_many(sql, FETCH_MANY_SIZE, params=params)
            if not data:
                return None

            for rows in data:
                yield tuple(rows)

            return None

    @log_execution_time()
    def get_factory_data(self, time_range: TimeRange) -> Iterator[tuple]:
        """Get data from factory db for the given time range

        Postgres will over buffer and accept only one connection to get data.
        (another connection must be waited then maybe timeout if the first connection have not done yet)
        when one SQL statement have huge return data.
        [Solution]
        - we keep old logic that chunk SQL statement by day instead.
        - but we still keep logic that yield at least (FETCH_MANY_SIZE) records per chunk
        """
        from ap.api.setting_module.services.factory_import import FETCH_MANY_SIZE

        chunk_sql_day = 1  # 1 day
        chunked_time_ranges = time_range.chunk(chunk_sql_day)
        buffer = ()
        for idx, chunked_time_range in enumerate(chunked_time_ranges):
            generator = self._get_factory_data(chunked_time_range)
            if idx == 0:
                # in first SQL it will return cols
                yield next(generator)
            else:
                # from second SQL, we force it only return data
                _cols = next(generator)

            # second time is data
            for rows in generator:
                buffer += rows
                if len(buffer) >= FETCH_MANY_SIZE:
                    yield buffer[:FETCH_MANY_SIZE]
                    buffer = buffer[FETCH_MANY_SIZE:]

        if buffer:
            yield buffer

        return None
