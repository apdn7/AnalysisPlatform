from __future__ import annotations

import contextlib
import math
import re
import sqlite3
import threading
from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import networkx as nx
import pandas as pd
import sqlalchemy as sa
from filelock import Timeout as FileLockTimeout
from flask_babel import get_locale, gettext
from loguru import logger
from sqlalchemy.orm import load_only, scoped_session, selectinload

from ap.api.common.services.show_graph_database import get_traces_graph_config_data
from ap.api.setting_module.services.data_import import DbConnectionParam
from ap.api.setting_module.services.software_workshop_etl_services import (
    FACTORY_LINE_GROUP_LABEL,
)
from ap.api.setting_module.services.v2_etl_services import save_unused_columns
from ap.common.common_utils import gen_transaction_table_name, is_ja_locale
from ap.common.constants import (
    UNDER_SCORE,
    CacheType,
    DataColumnType,
    DataType,
    DBType,
    MasterDBType,
    ProcessStatus,
)
from ap.common.memoize import CustomCache
from ap.common.path_utils import (
    ReferenceFileOutsideSourceError,
    gen_duckdb_file_name,
    gen_sqlite3_file_name,
    is_reference_file_in_source,
)
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import normalize_list
from ap.equations.utils import get_all_functions_info
from ap.setting_module.models import (
    CfgDataSource,
    CfgFilter,
    CfgLabel,
    CfgProcess,
    CfgProcessColumn,
    CfgVisualization,
    MFunction,
    make_session,
    populate_missing_bridge_column_names,
    use_meta_session,
)
from ap.setting_module.schemas import (
    ContextSchemaDict,
    FilterSchema,
    ProcessColumnSchema,
    ProcessOnlySchema,
    ProcessPublicSchema,
    ProcessVisualizationSchema,
)
from ap.trace_data.transaction_model import DataCountTable, ImportHistoryTable, TransactionData


def get_all_process(with_parent=True):
    process = CfgProcess.get_all(with_parent=with_parent) or []
    return process


def get_all_functions():
    all_functions_info = get_all_functions_info()
    all_functions_info = [function_info.model_dump() for function_info in all_functions_info]
    return all_functions_info


def get_all_process_no_nested(with_parent=True):
    process_only_schema = ProcessOnlySchema(many=True)
    processes = CfgProcess.get_all(with_parent=with_parent) or []
    return process_only_schema.dump(processes, many=True)


def get_process_cfg(proc_id):
    process_schema = ProcessPublicSchema()
    process = CfgProcess.query.get(proc_id) or {}
    if process and not process.name_en:
        process.name_en = to_romaji(process.name_jp)
    return process_schema.dump(process)


def get_process_columns(proc_id: int, *, show_graph: bool) -> list[dict[str, Any]]:
    proc_col_schema = ProcessColumnSchema(many=True, context=ContextSchemaDict(show_graph=show_graph))
    columns = CfgProcessColumn.query.filter(CfgProcessColumn.process_id == proc_id).all()
    return proc_col_schema.dump(columns)


def _get_linked_process_ids(anchors: list[int]) -> set[int]:
    """Use the same configured, bidirectional reachability as graph selection, not match counts."""
    trace_graph = get_traces_graph_config_data()
    linked_ids = set(anchors)
    for component in nx.connected_components(trace_graph.undirected_graph):
        if linked_ids.intersection(component):
            linked_ids.update(component)
    return linked_ids


def _get_process_detail_stats(process: CfgProcess) -> dict[str, Any]:
    stats = {'from': None, 'latest': None, 'data_count': None, 'last_import_at': None}
    if (
        process.parent_id is not None
        or process.status == ProcessStatus.INITIALIZED.value
        or not Path(gen_sqlite3_file_name(process.id)).is_file()
    ):
        return stats
    try:
        with TxnMetaConnection(process_id=process.id) as meta_con:
            # Never wait behind an importer for this optional, read-only summary.
            meta_con.connection.execute('PRAGMA busy_timeout = 0')
            table_name = DataCountTable.get_table_name(process.id)
            if table_name in meta_con.list_tables():
                table = sa.table(table_name, sa.column(DataCountTable.count.name))
                _, rows = meta_con.run_sql(
                    sa.select(sa.func.coalesce(sa.func.sum(table.c.count), 0).label('data_count'))
                )
                stats['data_count'] = rows[0]['data_count']
            stats['last_import_at'] = ImportHistoryTable.get_latest_import_time(meta_con, process.id)
    except sqlite3.OperationalError as exc:
        if exc.sqlite_errorcode & 0xFF not in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
            raise
        return {'from': None, 'latest': None, 'data_count': None, 'last_import_at': None}
    return stats


@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def _get_process_detail_time_range(
    process_id: int, datetime_column: str, file_signature: tuple[Any, ...]
) -> tuple[str | None, str | None]:
    """Cache exact bounds by the same file/WAL signature used for preview samples."""
    with TxnDataConnection(process_id=process_id, readonly_transaction=True, lock_timeout=0) as data_con:
        column = sa.column(datetime_column)
        query = sa.select(sa.func.min(column), sa.func.max(column)).select_from(
            sa.table(gen_transaction_table_name(process_id))
        )
        return tuple(data_con.run_sql(query).fetchone())


def _local_source_path(value: str | None) -> str | None:
    # Source fields can contain URLs; do not return userinfo, query tokens or connection strings.
    if (
        not value
        or '://' in value
        or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]+:', value)
        or '\n' in value
        or '\r' in value
        or re.search(r'(?i)(?:^|[;?&\s])(?:password|pwd|username|uid|user id|token|access_token)\s*[=:]', value)
    ):
        return None
    return value


def get_process_detail(proc_id: int) -> dict[str, Any] | None:
    """Allow-listed configuration, transaction counts and cached exact datetime bounds."""
    with make_session() as meta_session:
        process = meta_session.get(CfgProcess, proc_id)
        if process is None:
            return None
        linked_ids = _get_linked_process_ids([proc_id]) - {proc_id}
        source = process.data_source
        path = None
        reference = None
        options = {}
        if source and source.type in (DBType.CSV.name, DBType.V2.name) and source.csv_detail:
            csv = source.csv_detail
            path = _local_source_path(csv.directory)
            reference = _local_source_path(process.file_name or csv.reference_file)
            options = {
                key: getattr(csv, key)
                for key in (
                    'delimiter',
                    'encoding',
                    'auto_encoding',
                    'is_transpose',
                    'skip_head',
                    'skip_tail',
                    'n_rows',
                )
            }
        elif source and source.db_detail:
            reference = _local_source_path(process.table_name)
            options = {'use_os_timezone': source.db_detail.use_os_timezone}
        stats = _get_process_detail_stats(process)
        if Path(gen_duckdb_file_name(proc_id)).is_file():
            datetime_column = (
                meta_session.query(CfgProcessColumn.bridge_column_name)
                .filter(CfgProcessColumn.process_id == proc_id, CfgProcessColumn.is_get_date.is_(True))
                .order_by(CfgProcessColumn.order.asc(), CfgProcessColumn.id.asc())
                .limit(1)
                .scalar()
            )
            if datetime_column:
                try:
                    stats['from'], stats['latest'] = _get_process_detail_time_range(
                        proc_id, datetime_column, _transaction_file_signature(proc_id)
                    )
                except FileLockTimeout:
                    logger.info(
                        f'Transaction file is busy, process detail time range is unavailable. process_id={proc_id}'
                    )
        return {
            'id': process.id,
            'name': process.name,
            'source': {'id': source.id, 'name': source.name, 'type': source.type} if source else None,
            'path': path,
            'ref': reference,
            'option': options,
            **stats,
            'linked_processes': [
                {'id': process_id, 'name': name}
                for process_id, name in meta_session.query(CfgProcess.id, CfgProcess.name)
                .filter(CfgProcess.id.in_(linked_ids), CfgProcess.parent_id.is_(None))
                .order_by(CfgProcess.order.asc(), CfgProcess.id.asc())
                .all()
            ],
        }


def get_process_detail_columns(proc_id: int) -> dict[str, Any] | None:
    """All compact column metadata; deliberately no samples or transaction access."""
    with make_session() as meta_session:
        if meta_session.get(CfgProcess, proc_id, options=[load_only(CfgProcess.id)]) is None:
            return None
        query = (
            meta_session.query(CfgProcessColumn)
            .options(
                load_only(
                    CfgProcessColumn.id,
                    CfgProcessColumn.data_type,
                    CfgProcessColumn.column_type,
                    CfgProcessColumn.is_serial_no,
                    CfgProcessColumn.name_en,
                    CfgProcessColumn.name_jp,
                    CfgProcessColumn.name_local,
                )
            )
            .filter(CfgProcessColumn.process_id == proc_id)
        )
        columns = query.order_by(
            sa.case((CfgProcessColumn.column_type == DataColumnType.GENERATED_EQUATION.value, 1), else_=0).asc(),
            CfgProcessColumn.order.asc(),
            CfgProcessColumn.id.asc(),
        ).all()
        return {
            'items': [
                {
                    'id': col.id,
                    'data_type': col.data_type,
                    'column_type': col.column_type,
                    'is_serial_no': col.is_serial_no,
                    'is_int_category': col.is_int_category,
                    'is_judge': col.is_judge,
                    'shown_name': col.shown_name,
                    'name_en': col.name_en,
                }
                for col in columns
            ],
        }


def _normalize_search_text(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip().lower()


DATA_TYPE_SHORT_LABELS: dict[str, str] = {
    'NONE': 'NONE',
    DataType.INTEGER.name: 'Int',
    'INTEGER_CAT': 'Int(Cat)',
    DataType.REAL.name: 'Real',
    'STRING': 'Str',
    DataType.TEXT.name: 'Str',
    DataType.DATETIME.name: 'CT',
    DataType.DATE.name: 'Date',
    DataType.TIME.name: 'Time',
    DataType.REAL_SEP.name: 'Real_Sep',
    DataType.INTEGER_SEP.name: 'Int_Sep',
    DataType.EU_REAL_SEP.name: 'EU_Real_Sep',
    DataType.EU_INTEGER_SEP.name: 'EU_Int_Sep',
    'BIG_INT': 'BIG_INT',
    DataType.BIGINT.name: 'BIGINT',
    'CATEGORY': 'Cat',
    DataType.BOOLEAN.name: 'Bool',
}


# Data types that show the Facet dropdown in Variable Select (mirror of FILTER_SUPPORTED_DATA_TYPES in dataType.ts).
FACET_SUPPORTED_DATA_TYPES: list[str] = ['INTEGER', 'INTEGER_SEP', 'EU_INTEGER_SEP', 'STRING', 'TEXT']
# Facet column filter keyword that lists every row which can select a facet.
FACET_FILTER_OTHER_KEYWORD = 'other'
# Filter column filter keyword that lists every row which shows the Filter checkbox.
FILTER_STATE_OTHER_KEYWORD = 'other'
# Filter column filter keyword that lists rows whose Filter checkbox is unchecked.
FILTER_STATE_UNCHECKED_KEYWORD = '0'
# Plot column filter keyword that lists every row which shows the Plot checkbox.
PLOT_STATE_OTHER_KEYWORD = 'other'
# Label (fpp) column filter keyword that lists every row which shows the Label checkbox.
LABEL_STATE_OTHER_KEYWORD = 'other'
# Label (fpp) column filter keyword that lists rows whose Label checkbox is unchecked.
LABEL_STATE_UNCHECKED_KEYWORD = '0'
# Label (fpp) column filter keyword that lists rows whose Label checkbox is checked.
LABEL_STATE_CHECKED_KEYWORD = '1'
# Page types whose page-specific column is the Label checkbox (shown only for facet-supported data types).
LABEL_CHECKBOX_PAGE_TYPES: tuple[str, ...] = ('fpp',)
# Plot column filter keywords for checked / unchecked Plot checkbox.
PLOT_STATE_CHECKED_KEYWORD = '1'
PLOT_STATE_UNCHECKED_KEYWORD = '0'
# Facet column filter keyword that lists rows with the Facet dropdown still at "---".
FACET_FILTER_UNSELECTED_KEYWORD = '0'
# Facet column filter keyword that lists rows whose facet is LV1 or LV2.
FACET_FILTER_LV_KEYWORD = 'lv'
FACET_LV_STATES: tuple[str, ...] = ('1', '2')
# Facet column filter keyword that lists rows whose facet starts with DIV (DIV, DIV2, DIV3, DIV6, ...).
FACET_FILTER_DIV_KEYWORD = 'div'
# Facet value used by Variable Select for plain DIV (see VariableSelect.tsx facetText).
FACET_DIV_STATE = '0'


def _is_div_facet_state(facet_state: Any) -> bool:
    """True when the facet is DIV ('0') or any DIV variant label such as DIV2 / DIV3 / DIV6."""
    normalized = _normalize_search_text(facet_state)
    return normalized == FACET_DIV_STATE or normalized.startswith(FACET_FILTER_DIV_KEYWORD)


def _facet_filter_supported_condition() -> Any:
    """SQL condition for rows showing the Facet dropdown / Filter checkbox (mirror of canShowFilterCheckbox)."""
    return sa.func.upper(sa.func.trim(sa.func.coalesce(CfgProcessColumn.data_type, ''))).in_(FACET_SUPPORTED_DATA_TYPES)


def _is_label_checked(value: Any) -> bool:
    """Draft Label checkbox value is a bool from the UI, but accept "1"/"true" strings too."""
    if isinstance(value, bool):
        return value
    return _normalize_search_text(value) in ('1', 'true')


def _plot_supported_condition() -> Any:
    """
    SQL condition for rows showing the Plot checkbox (mirror of canShowPlotCheckbox in dataType.ts).
    Every row can be plotted for now; restrict it here (and in canShowPlotCheckbox) when needed.
    """
    return sa.true()


def _show_process_column_datatype_short(column: CfgProcessColumn) -> str:
    if column.is_serial_no:
        return 'Seri'

    if column.column_type == DataColumnType.BOOLEAN.value:
        return 'Bool'

    if column.is_judge:
        return 'Judge'

    if column.is_int_category and not column.is_serial_no:
        return 'Cat'

    normalized_data_type = (column.data_type or '').strip().upper()
    return DATA_TYPE_SHORT_LABELS.get(normalized_data_type, column.data_type or '')


def _int_category_condition() -> Any:
    return sa.or_(
        sa.and_(
            CfgProcessColumn.data_type == DataType.INTEGER.name,
            sa.or_(
                CfgProcessColumn.column_type.in_(DataColumnType.category_int_types()),
                CfgProcessColumn.is_serial_no.is_(True),
            ),
        ),
        sa.and_(
            CfgProcessColumn.column_type == DataColumnType.GENERATED_EQUATION.value,
            CfgProcessColumn.data_type == DataType.CATEGORY.name,
        ),
    )


def _datatype_alias_conditions(datatype_query: str) -> list[Any]:
    conditions: list[Any] = []

    if datatype_query in 'ct':
        conditions.append(CfgProcessColumn.data_type == DataType.DATETIME.name)

    if datatype_query in 'str':
        conditions.append(CfgProcessColumn.data_type == DataType.TEXT.name)

    if datatype_query in 'seri':
        conditions.append(CfgProcessColumn.is_serial_no.is_(True))

    if datatype_query in 'judge':
        conditions.append(CfgProcessColumn.column_type == DataColumnType.JUDGE.value)

    if datatype_query in 'cat':
        conditions.append(sa.and_(_int_category_condition(), CfgProcessColumn.is_serial_no.is_(False)))

    return conditions


def _matches_datatype_query(column: CfgProcessColumn, datatype_query: str) -> bool:
    if not datatype_query:
        return True

    searchable_values = {
        _normalize_search_text(column.data_type),
        _normalize_search_text(_show_process_column_datatype_short(column)),
    }
    return any(datatype_query in value for value in searchable_values if value)


def _compile_filter_pattern(query: Any) -> re.Pattern[str] | None:
    """Column filters accept basic regex (case-insensitive); an invalid pattern falls back to a literal match."""
    query = str(query or '').strip()
    if not query:
        return None
    try:
        return re.compile(query, re.IGNORECASE)
    except re.error:
        return re.compile(re.escape(query), re.IGNORECASE)


def _matches_pattern(pattern: re.Pattern[str] | None, values: list[Any]) -> bool:
    if pattern is None:
        return True
    return any(pattern.search(str(value)) for value in values if value is not None and str(value) != '')


def _matches_sample_filters(sample_data: list[Any], sample_queries: list[str]) -> bool:
    # OR logic: ít nhất một trong các mẫu khớp (regex) thì return True
    for index, query in enumerate(sample_queries):
        pattern = _compile_filter_pattern(query)
        if pattern is None:
            continue

        value = sample_data[index] if index < len(sample_data) else ''
        if _matches_pattern(pattern, [value]):
            return True  # Tìm thấy ngay → trả về True

    return False  # Không mẫu nào khớp → trả về False


def _matches_process_column_filters(
    row: tuple[CfgProcessColumn, str, int],
    search_params: dict[str, Any],
    sample_by_column: dict[int, dict[str, list[Any]]],
) -> bool:
    column, _, _ = row
    datatype_query = _normalize_search_text(search_params.get('datatype'))
    # Keep the raw pattern: lowercasing would break regex escapes such as \D or \W.
    sample_queries = [str(search_params.get(f'sample_{index}') or '').strip() for index in range(1, 6)]

    if datatype_query and not _matches_datatype_query(column, datatype_query):
        return False

    if any(sample_queries):
        sample_data = sample_by_column.get(int(column.id), {}).get('sample_data', [])
        if not _matches_sample_filters(sample_data, sample_queries):
            return False

    return True


def _normalized_sample_queries(search_params: dict[str, Any]) -> list[str]:
    return [_normalize_search_text(search_params.get(f'sample_{index}')) for index in range(1, 6)]


def _contains_ci(expr: Any, query: str) -> Any:
    return sa.func.lower(sa.func.coalesce(sa.cast(expr, sa.String()), '')).contains(query)


def _key_column_condition() -> Any:
    """Identify the main datetime and serial columns from their metadata."""
    return sa.or_(
        CfgProcessColumn.is_get_date.is_(True),
        CfgProcessColumn.is_serial_no.is_(True),
    )


def _format_column_order(column_order_in_process: int, process_column_count: int) -> str:
    """Zero-pad idx by the complete index scope so it is easy to match with regex."""
    if process_column_count < 100:
        width = 2
    elif process_column_count < 1000:
        width = 3
    elif process_column_count < 10000:
        width = 4
    else:
        width = 5
    return str(column_order_in_process).zfill(width)


def _column_display_values(column: CfgProcessColumn) -> tuple[str, str]:
    """English name / variable name exactly as the modal shows them."""
    shown_name = column.shown_name
    return column.name_en or shown_name or '', shown_name or column.name_en or ''


def _build_column_text_patterns(search_params: dict[str, Any]) -> dict[str, re.Pattern[str]]:
    patterns = {
        'process_name': _compile_filter_pattern(search_params.get('process_name')),
        'idx': _compile_filter_pattern(search_params.get('idx')),
        'english_name': _compile_filter_pattern(search_params.get('english_name')),
        'shownname': _compile_filter_pattern(search_params.get('shownname')),
        'unit': _compile_filter_pattern(search_params.get('unit')),
    }
    return {key: pattern for key, pattern in patterns.items() if pattern is not None}


def _matches_column_text_filters(
    row: tuple[CfgProcessColumn, str, int],
    patterns: dict[str, re.Pattern[str]],
    process_column_counts: dict[int, int],
) -> bool:
    """Match column filters with regex against the values displayed in the table."""
    if not patterns:
        return True
    column, process_name, column_order_in_process = row
    english_name, shown_name = _column_display_values(column)
    values = {
        'process_name': process_name,
        'idx': _format_column_order(column_order_in_process, process_column_counts.get(column.process_id, 0)),
        'english_name': english_name,
        'shownname': shown_name,
        'unit': column.unit,
    }
    return all(_matches_pattern(pattern, [values[key]]) for key, pattern in patterns.items())


def _resolve_locale_language() -> str | None:
    """Locale language used by CfgProcessColumn.get_shown_name; '' when get_locale() fails."""
    try:
        locale = get_locale()
    except Exception:
        return ''
    return locale.language if locale else None


def _resolve_shown_name(language: str | None, name_en: Any, name_jp: Any, name_local: Any) -> Any:
    """Same rule as CfgProcessColumn.get_shown_name, with the locale resolved once per request."""
    if language == '':
        return name_jp
    if language is None:
        return None
    if language == 'ja':
        return name_jp or name_en
    return name_local or name_en


_IS_INT_CATEGORY = CfgProcessColumn.__dict__['is_int_category'].fget
_IS_JUDGE = CfgProcessColumn.__dict__['is_judge'].fget


@dataclass(slots=True)
class _ColumnView:
    """Scalar snapshot of a CfgProcessColumn used to filter every column without hydrating ORM objects."""

    id: int
    process_id: int
    bridge_column_name: str | None
    name_en: str | None
    shown_name: str | None
    data_type: str | None
    column_type: int | None
    is_serial_no: bool
    unit: str | None

    @property
    def is_int_category(self) -> bool:
        return _IS_INT_CATEGORY(self)

    @property
    def is_judge(self) -> bool:
        return _IS_JUDGE(self)


def _load_column_views(ordered_query: Any, column_order_expr: Any) -> list[tuple[_ColumnView, str, int]]:
    """Return (column view, process name, column order) in display order, reading scalar values only."""
    language = _resolve_locale_language()
    scalar_rows = ordered_query.with_entities(
        CfgProcessColumn.id,
        CfgProcessColumn.process_id,
        CfgProcessColumn.bridge_column_name,
        CfgProcessColumn.name_en,
        CfgProcessColumn.name_jp,
        CfgProcessColumn.name_local,
        CfgProcessColumn.data_type,
        CfgProcessColumn.column_type,
        CfgProcessColumn.is_serial_no,
        CfgProcessColumn.unit,
        CfgProcess.name,
        column_order_expr,
    ).all()
    return [
        (
            _ColumnView(
                id=column_id,
                process_id=process_id,
                bridge_column_name=bridge_column_name,
                name_en=name_en,
                shown_name=_resolve_shown_name(language, name_en, name_jp, name_local),
                data_type=data_type,
                column_type=column_type,
                is_serial_no=is_serial_no,
                unit=unit,
            ),
            process_name,
            column_order,
        )
        for (
            column_id,
            process_id,
            bridge_column_name,
            name_en,
            name_jp,
            name_local,
            data_type,
            column_type,
            is_serial_no,
            unit,
            process_name,
            column_order,
        ) in scalar_rows
    ]


def _apply_process_column_metadata_filters(query: Any, search_params: dict[str, Any]) -> Any:
    datatype_query = _normalize_search_text(search_params.get('datatype'))

    # Process / idx / English name / variable name / unit accept regex, see _matches_column_text_filters.

    if datatype_query:
        datatype_conditions = [
            _contains_ci(CfgProcessColumn.data_type, datatype_query),
            *_datatype_alias_conditions(datatype_query),
        ]
        query = query.filter(sa.or_(*datatype_conditions))

    column_states = search_params.get('column_states', {})
    facet_query = _normalize_search_text(search_params.get('facet_state'))
    facet_supported_condition = _facet_filter_supported_condition()
    if facet_query == FACET_FILTER_UNSELECTED_KEYWORD:
        # "0": rows that have the Facet dropdown but no facet chosen yet (---).
        selected_facet_ids = [
            column_id
            for column_id, state in column_states.items()
            if _normalize_search_text(state.get('facetState', ''))
        ]
        query = query.filter(facet_supported_condition, CfgProcessColumn.id.notin_(selected_facet_ids))
        search_params = {**search_params, 'facet_state': ''}
    elif facet_query == FACET_FILTER_OTHER_KEYWORD:
        # "other": only rows that show the Facet dropdown (same rule as canShowFilterCheckbox on the frontend).
        query = query.filter(facet_supported_condition)
        search_params = {**search_params, 'facet_state': ''}
    elif facet_query == FACET_FILTER_LV_KEYWORD:
        # "lv": only rows whose facet is currently LV1 or LV2.
        lv_column_ids = [
            column_id
            for column_id, state in column_states.items()
            if _normalize_search_text(state.get('facetState', '')) in FACET_LV_STATES
        ]
        query = query.filter(CfgProcessColumn.id.in_(lv_column_ids))
        search_params = {**search_params, 'facet_state': ''}
    elif facet_query == FACET_FILTER_DIV_KEYWORD:
        # "div": only rows whose facet starts with DIV (DIV, DIV2, DIV3, DIV6, ...).
        div_column_ids = [
            column_id for column_id, state in column_states.items() if _is_div_facet_state(state.get('facetState', ''))
        ]
        query = query.filter(CfgProcessColumn.id.in_(div_column_ids))
        search_params = {**search_params, 'facet_state': ''}

    filter_query = _normalize_search_text(search_params.get('filter_state'))
    if filter_query == FILTER_STATE_UNCHECKED_KEYWORD:
        # "0": rows that have the Filter checkbox but it is unchecked.
        checked_filter_ids = [
            column_id
            for column_id, state in column_states.items()
            if _normalize_search_text(state.get('filterState', '0')) not in ('', FILTER_STATE_UNCHECKED_KEYWORD)
        ]
        query = query.filter(facet_supported_condition, CfgProcessColumn.id.notin_(checked_filter_ids))
        search_params = {**search_params, 'filter_state': ''}
    elif filter_query == FILTER_STATE_OTHER_KEYWORD:
        # "other": only rows that show the Filter checkbox (same rule as canShowFilterCheckbox on the frontend).
        query = query.filter(facet_supported_condition)
        search_params = {**search_params, 'filter_state': ''}

    # Plot "0" / "1" / "other" only list rows that show the Plot checkbox. The checked state itself depends on
    # the draft selection and is applied later in _apply_selection_view_filters.
    plot_query = _normalize_search_text(search_params.get('plot_state'))
    if plot_query in (PLOT_STATE_UNCHECKED_KEYWORD, PLOT_STATE_CHECKED_KEYWORD, PLOT_STATE_OTHER_KEYWORD):
        query = query.filter(_plot_supported_condition())

    additional_query = _normalize_search_text(search_params.get('additional_column'))
    page_type = _normalize_search_text(search_params.get('page_type'))
    if additional_query == LABEL_STATE_OTHER_KEYWORD and page_type in LABEL_CHECKBOX_PAGE_TYPES:
        # "other": only rows that show the Label checkbox (checked or not), same rule as canShowPageTypeControl.
        query = query.filter(facet_supported_condition)
        search_params = {**search_params, 'additional_column': ''}
    elif additional_query == LABEL_STATE_UNCHECKED_KEYWORD and page_type in LABEL_CHECKBOX_PAGE_TYPES:
        # "0": only rows that show the Label checkbox and whose checkbox is unchecked.
        checked_label_ids = [
            column_id
            for column_id, state in column_states.items()
            if _is_label_checked(state.get('additionalColumn', ''))
        ]
        query = query.filter(facet_supported_condition, CfgProcessColumn.id.notin_(checked_label_ids))
        search_params = {**search_params, 'additional_column': ''}
    elif additional_query == LABEL_STATE_CHECKED_KEYWORD and page_type in LABEL_CHECKBOX_PAGE_TYPES:
        # "1": only rows that show the Label checkbox and whose checkbox is checked.
        checked_label_ids = [
            column_id
            for column_id, state in column_states.items()
            if _is_label_checked(state.get('additionalColumn', ''))
        ]
        query = query.filter(facet_supported_condition, CfgProcessColumn.id.in_(checked_label_ids))
        search_params = {**search_params, 'additional_column': ''}

    for filter_name, state_name, default in (
        ('facet_state', 'facetState', ''),
        ('filter_state', 'filterState', '0'),
        ('additional_column', 'additionalColumn', ''),
    ):
        value_query = _normalize_search_text(search_params.get(filter_name))
        if not value_query:
            continue
        matching_ids = [
            column_id
            for column_id, state in column_states.items()
            if value_query in _normalize_search_text(state.get(state_name, default))
        ]
        condition = CfgProcessColumn.id.in_(matching_ids)
        if value_query in default:
            condition = sa.or_(condition, CfgProcessColumn.id.notin_(list(column_states)))
        query = query.filter(condition)

    return query


def _matches_regex_search(
    row: tuple[CfgProcessColumn | _ColumnView, str, int],
    regex_pattern: str | re.Pattern[str],
    process_column_counts: dict[int, int] | None = None,
) -> bool:
    """
    Check if a column matches the regex search pattern.
    Searches the values displayed on the variable row (sample data is not searched).

    Args:
        row: Tuple of (column, process_name, column_order_in_process)
        regex_pattern: Compiled regex pattern or pattern string
        process_column_counts: Column count per process, used to match the zero-padded idx

    Returns:
        True if column matches the regex pattern, False otherwise
    """
    if not regex_pattern:
        return True

    column, _, column_order_in_process = row

    if isinstance(regex_pattern, re.Pattern):
        compiled_regex = regex_pattern
    else:
        try:
            compiled_regex = re.compile(regex_pattern, re.IGNORECASE)
        except re.error:
            # Invalid regex pattern, match nothing
            return False

    # Search the values displayed on each variable row (idx, English name, data type, variable name, unit),
    # so a pattern like `_1$` is not matched by hidden fields or by the process name.
    english_name, shown_name = _column_display_values(column)
    searchable_values = [
        english_name,
        _show_process_column_datatype_short(column),
        shown_name,
        column.unit,
    ]
    if process_column_counts is not None:
        searchable_values.append(
            _format_column_order(column_order_in_process, process_column_counts.get(column.process_id, 0))
        )

    # Check if regex matches any of the searchable values
    return any(value and compiled_regex.search(str(value)) for value in searchable_values)


def _apply_display_range(ordered_ids: list[int], search_params: dict[str, Any]) -> list[int]:
    """Apply 表示する項目 (From/Size/Step) to the ordinal of the visible list, across all processes."""
    idx_start = max(int(search_params.get('idx_start') or 1), 1)
    idx_size = max(int(search_params.get('idx_size') or 0), 0)
    idx_interval = max(int(search_params.get('idx_interval') or 1), 1)
    range_ids = ordered_ids[idx_start - 1 :: idx_interval]
    return range_ids[:idx_size] if idx_size else range_ids


def _is_display_range_active(search_params: dict[str, Any]) -> bool:
    return (
        int(search_params.get('idx_start') or 1) > 1
        or int(search_params.get('idx_size') or 0) > 0
        or int(search_params.get('idx_interval') or 1) > 1
    )


def _apply_selection_view_filters(
    ids: list[int],
    search_params: dict[str, Any],
    selected_ids: set[int],
    process_by_column_id: dict[int, int],
) -> list[int]:
    """Filter the current selection level after the display range; Plot always uses column selection."""
    show_selected_ids = selected_ids
    if search_params.get('pagination_mode') == 'processes':
        selected_process_ids = set(search_params.get('selected_process_ids', []))
        show_selected_ids = {column_id for column_id in ids if process_by_column_id[column_id] in selected_process_ids}
    show_mode = search_params.get('show_mode')
    if show_mode == 'selected':
        ids = [column_id for column_id in ids if column_id in show_selected_ids]
    elif show_mode == 'unselected':
        ids = [column_id for column_id in ids if column_id not in show_selected_ids]

    plot_query = _normalize_search_text(search_params.get('plot_state'))
    if plot_query == PLOT_STATE_CHECKED_KEYWORD:
        ids = [column_id for column_id in ids if column_id in selected_ids]
    elif plot_query == PLOT_STATE_UNCHECKED_KEYWORD:
        ids = [column_id for column_id in ids if column_id not in selected_ids]
    elif plot_query == PLOT_STATE_OTHER_KEYWORD:
        # "other": rows without the Plot checkbox were already removed by _plot_supported_condition.
        pass
    elif plot_query:
        ids = []
    return ids


def _prioritize_process_columns(
    ids: list[int],
    process_by_column_id: dict[int, int],
    prioritized_column_ids: list[int],
    selected_column_ids: set[int],
) -> list[int]:
    """Show selected processes first, with their currently checked/assigned columns first."""
    # The priority snapshot is captured when the modal opens; include later Plot checks too.
    prioritized_ids = set(prioritized_column_ids) | selected_column_ids
    if not prioritized_ids:
        return ids

    anchor_by_process: dict[int, int] = {}
    for column_id in ids:
        process_id = process_by_column_id.get(column_id)
        if column_id in prioritized_ids and process_id is not None:
            anchor_by_process.setdefault(process_id, column_id)

    if not anchor_by_process:
        return ids

    ids_by_process = {process_id: [] for process_id in anchor_by_process}
    remaining_process_ids = set(anchor_by_process)
    other_ids = []
    for column_id in ids:
        process_id = process_by_column_id.get(column_id)
        if process_id in remaining_process_ids:
            ids_by_process[process_id].append(column_id)
        else:
            other_ids.append(column_id)

    ordered_by_process = {
        process_id: [
            *(column_id for column_id in process_ids if column_id in selected_column_ids),
            *(
                column_id
                for column_id in process_ids
                if column_id in prioritized_ids and column_id not in selected_column_ids
            ),
            *(
                column_id
                for column_id in process_ids
                if column_id not in prioritized_ids and column_id not in selected_column_ids
            ),
        ]
        for process_id, process_ids in ids_by_process.items()
    }
    return [
        *(process_ids[0] for process_ids in ordered_by_process.values()),
        *(column_id for process_ids in ordered_by_process.values() for column_id in process_ids[1:]),
        *other_ids,
    ]


def get_all_process_columns_paginated(
    page: int,
    limit: int,
    search_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a filtered page of process columns and unfiltered selection summaries by process."""
    page = max(page, 1)
    limit = max(limit, 1)
    offset = (page - 1) * limit
    search_params = search_params or {}
    sample_queries = _normalized_sample_queries(search_params)
    has_sample_filters = any(sample_queries) or search_params.get('same_filter') or search_params.get('na_filter')
    search_regex = (search_params.get('search_regex') or '').strip()
    has_regex_search = bool(search_regex)
    # When the user picked a datetime range outside the modal, samples are limited to that range.
    datetime_ranges = _normalized_datetime_ranges(search_params.get('datetime_ranges'))

    selected_ids = set(search_params.get('selected_column_ids', []))
    select_all = search_params.get('select_all')
    linked_ids = None
    if search_params.get('pagination_mode') == 'processes' and search_params.get('linked_process_ids'):
        linked_ids = _get_linked_process_ids(search_params['linked_process_ids'])
    index_process_ids = (
        search_params.get('process_ids') if search_params.get('pagination_mode') != 'processes' else None
    )

    with make_session() as meta_session:
        display_order = (
            CfgProcess.order.asc(),
            CfgProcess.id.asc(),
            sa.case((CfgProcessColumn.column_type == DataColumnType.GENERATED_EQUATION.value, 1), else_=0).asc(),
            CfgProcessColumn.order.asc(),
            CfgProcessColumn.id.asc(),
        )
        # A variable view has one fixed index across its selected processes, before any filters
        # or draft-selection priority. Keep the legacy response key for existing consumers.
        column_order_query = meta_session.query(
            CfgProcessColumn.id.label('column_id'),
            sa.func.row_number()
            .over(
                partition_by=CfgProcessColumn.process_id if index_process_ids is None else None,
                order_by=(
                    (CfgProcessColumn.order.asc(), CfgProcessColumn.id.asc())
                    if index_process_ids is None
                    else display_order
                ),
            )
            .label('column_order_in_process'),
        )
        if index_process_ids is not None:
            column_order_query = column_order_query.join(
                CfgProcess, CfgProcess.id == CfgProcessColumn.process_id
            ).filter(CfgProcess.parent_id.is_(None), CfgProcessColumn.process_id.in_(index_process_ids))
        column_orders = column_order_query.subquery()
        base_query = (
            meta_session.query(
                CfgProcessColumn,
                CfgProcess.name.label('process_name'),
                column_orders.c.column_order_in_process,
            )
            .join(CfgProcess, CfgProcess.id == CfgProcessColumn.process_id)
            .join(column_orders, column_orders.c.column_id == CfgProcessColumn.id)
            .filter(CfgProcess.parent_id.is_(None))
        )

        base_query = _apply_process_column_metadata_filters(base_query, search_params)
        if linked_ids is not None:
            base_query = base_query.filter(CfgProcessColumn.process_id.in_(linked_ids))
        if search_params.get('pagination_mode') == 'processes' and search_params.get('process_ids') is not None:
            base_query = base_query.filter(CfgProcessColumn.process_id.in_(search_params['process_ids']))
        if index_process_ids is not None:
            scope_column_count = meta_session.query(sa.func.count()).select_from(column_orders).scalar()
            process_column_counts = dict.fromkeys(index_process_ids, scope_column_count)
        else:
            process_column_counts = dict(
                meta_session.query(CfgProcessColumn.process_id, sa.func.count(CfgProcessColumn.id))
                .group_by(CfgProcessColumn.process_id)
                .all()
            )
        # Same order as the modal displays: process order, then normal columns before function columns.
        ordered_query = base_query.order_by(*display_order)

        # Column text filters (regex), sample filters and the search box are evaluated in Python on scalar
        # snapshots before the display range and pagination; ORM objects are loaded for the page only.
        column_order_expr = column_orders.c.column_order_in_process
        text_patterns = _build_column_text_patterns(search_params)
        sample_by_column = None
        if text_patterns or has_sample_filters or has_regex_search:
            filtered_rows = [
                row
                for row in _load_column_views(ordered_query, column_order_expr)
                if _matches_column_text_filters(row, text_patterns, process_column_counts)
            ]

            if has_sample_filters:
                # Sample filters must see every candidate, so wait for transaction files busy with an import.
                sample_by_column = _get_column_sample_and_unique_values(
                    filtered_rows, wait_for_lock=True, datetime_ranges=datetime_ranges
                )
                filtered_rows = [
                    row
                    for row in filtered_rows
                    if _matches_process_column_filters(row, search_params, sample_by_column)
                ]
                for filter_name in ('same_filter', 'na_filter'):
                    if search_params.get(filter_name):
                        filtered_rows = [
                            row
                            for row in filtered_rows
                            if _matches_sample_value_filter(sample_by_column.get(row[0].id, {}), filter_name)
                        ]

            # The search box only matches displayed metadata, so it never needs transaction samples.
            if has_regex_search:
                try:
                    compiled_search_regex = re.compile(search_regex, re.IGNORECASE)
                except re.error:
                    filtered_rows = []
                else:
                    filtered_rows = [
                        row
                        for row in filtered_rows
                        if _matches_regex_search(row, compiled_search_regex, process_column_counts)
                    ]

            ordered_columns = [(column.id, column.process_id, order) for column, _, order in filtered_rows]
        else:
            ordered_columns = ordered_query.with_entities(
                CfgProcessColumn.id, CfgProcessColumn.process_id, column_order_expr
            ).all()
        ordered_ids = [column_id for column_id, _, _ in ordered_columns]
        process_by_column_id = {column_id: process_id for column_id, process_id, _ in ordered_columns}
        column_order_by_id = {column_id: order for column_id, _, order in ordered_columns}

        if index_process_ids is not None and _is_display_range_active(search_params):
            scope_ids = [
                column_id
                for (column_id,) in meta_session.query(column_orders.c.column_id)
                .order_by(column_orders.c.column_order_in_process)
                .all()
            ]
            range_ids = _apply_display_range(scope_ids, search_params)
            range_id_set = set(range_ids)
            visible_range_ids = [column_id for column_id in ordered_ids if column_id in range_id_set]
        else:
            range_ids = _apply_display_range(ordered_ids, search_params)
            visible_range_ids = range_ids
        view_ids = _apply_selection_view_filters(visible_range_ids, search_params, selected_ids, process_by_column_id)
        process_ids = search_params.get('process_ids')
        if process_ids is not None:
            process_ids = set(process_ids)
            view_ids = [column_id for column_id in view_ids if process_by_column_id[column_id] in process_ids]
        view_ids = _prioritize_process_columns(
            view_ids,
            process_by_column_id,
            search_params.get('prioritized_column_ids', []),
            selected_ids,
        )
        total = len(view_ids)
        matching_ids = set(view_ids)
        page_ids = view_ids[offset : offset + limit]
        processes = []
        if search_params.get('pagination_mode') == 'processes':
            ordered_process_ids = list(dict.fromkeys(process_by_column_id[column_id] for column_id in view_ids))
            total = len(ordered_process_ids)
            visible_process_ids = ordered_process_ids[offset : offset + limit]
            process_names = dict(
                meta_session.query(CfgProcess.id, CfgProcess.name).filter(CfgProcess.id.in_(visible_process_ids)).all()
            )
            processes = [{'id': process_id, 'name': process_names[process_id]} for process_id in visible_process_ids]
            # A collapsed page needs process summaries, not variable rows or their samples.
            page_ids = []

        page_rows = _load_page_rows(meta_session, page_ids, column_order_by_id)
        if sample_by_column is None:
            # Samples do not depend on the draft selection: skip rows the client already has samples for.
            cached_sample_ids = set(search_params.get('cached_sample_column_ids') or [])
            sample_by_column = _get_column_sample_and_unique_values(
                [row for row in page_rows if row[0].id not in cached_sample_ids],
                datetime_ranges=datetime_ranges,
            )

        function_names, var_column_names = _get_function_detail_lookups(meta_session, page_rows)

        # Key除く only affects selection: key columns stay visible but are never selected in bulk.
        exclude_key = bool(search_params.get('exclude_key'))
        key_ids: set[int] = set()
        if exclude_key or search_params.get('deselect_keys'):
            key_ids = {
                column_id
                for (column_id,) in meta_session.query(CfgProcessColumn.id)
                .join(CfgProcess, CfgProcess.id == CfgProcessColumn.process_id)
                .filter(CfgProcess.parent_id.is_(None), _key_column_condition())
                .all()
            }
        selectable_ids = matching_ids - key_ids if exclude_key else matching_ids

        # MAP bulk selection resolves the selection on the client, so it needs the same selectable set.
        include_layout_candidates = bool(search_params.get('include_layout_candidates'))
        if (select_all is True or include_layout_candidates) and selectable_ids:
            # Rows without the Plot checkbox can never be selected (intersect in Python to avoid huge IN lists).
            selectable_ids = selectable_ids & {
                column_id
                for (column_id,) in meta_session.query(CfgProcessColumn.id).filter(_plot_supported_condition()).all()
            }
        if select_all is True:
            selected_ids.update(selectable_ids)
        elif select_all is False:
            selected_ids.difference_update(matching_ids)
        if search_params.get('deselect_keys'):
            selected_ids.difference_update(key_ids)

        selected_process_ids = [
            process_id
            for (process_id,) in meta_session.query(CfgProcessColumn.process_id)
            .filter(CfgProcessColumn.id.in_(selected_ids))
            .distinct()
            .order_by(CfgProcessColumn.process_id)
            .all()
        ]

        # Summaries describe each displayed process across its complete normal-column set,
        # using the final draft selection after any bulk-selection operation.
        page_process_ids = {column.process_id for column, _, _ in page_rows}
        page_process_ids.update(process['id'] for process in processes)
        process_summaries = CfgProcessColumn.get_normal_column_selection_summaries(
            meta_session,
            page_process_ids,
            selected_ids,
        )

        # Ordered candidates of every matching column, not only the current page, so MAP bulk
        # selection can reproduce the end process "select all" across pages.
        layout_candidates = None
        if include_layout_candidates:
            candidate_rows = {
                row.id: row
                for row in meta_session.query(
                    CfgProcessColumn.id,
                    CfgProcessColumn.process_id,
                    CfgProcessColumn.data_type,
                    CfgProcessColumn.column_type,
                    CfgProcessColumn.is_serial_no,
                    CfgProcessColumn.is_int_category,
                    CfgProcessColumn.is_judge,
                ).all()
            }
            layout_candidates = [
                {
                    'column_id': column_id,
                    'process_id': candidate_rows[column_id].process_id,
                    # Mirrors data-is_get_date in components.js: MAP bulk selection never ticks a CT row.
                    'is_get_date': _show_process_column_datatype_short(candidate_rows[column_id]) == 'CT',
                    'selectable': column_id in selectable_ids,
                }
                for column_id in view_ids
                if column_id in candidate_rows
            ]

        items = _serialize_page_items(
            page_rows, selected_ids, process_column_counts, sample_by_column, function_names, var_column_names
        )

    # Only variables inside 表示する項目 are counted and plotted while a display range is set.
    range_column_ids = range_ids if _is_display_range_active(search_params) else None

    total_pages = math.ceil(total / limit) if total else 0
    return {
        'items': items,
        'processes': processes,
        'selected_column_ids': sorted(selected_ids),
        'selected_process_ids': selected_process_ids,
        'range_column_ids': range_column_ids,
        'all_selected': bool(selectable_ids) and selectable_ids.issubset(selected_ids),
        'layout_candidates': layout_candidates,
        'process_summaries': process_summaries,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'total_pages': total_pages,
        },
    }


def _load_page_rows(
    meta_session: scoped_session,
    page_ids: list[int],
    column_order_by_id: dict[int, int],
) -> list[tuple[CfgProcessColumn, str, int]]:
    """Load ORM objects of the page only; function details are fetched in one extra query instead of per row."""
    if not page_ids:
        return []
    columns_by_id = {
        column.id: column
        for column in meta_session.query(CfgProcessColumn)
        .options(selectinload(CfgProcessColumn.function_details))
        .filter(CfgProcessColumn.id.in_(page_ids))
        .all()
    }
    process_names = dict(
        meta_session.query(CfgProcess.id, CfgProcess.name)
        .filter(CfgProcess.id.in_({column.process_id for column in columns_by_id.values()}))
        .all()
    )
    return [
        (columns_by_id[column_id], process_names[columns_by_id[column_id].process_id], column_order_by_id[column_id])
        for column_id in page_ids
    ]


def _serialize_page_items(
    page_rows: list[tuple[CfgProcessColumn, str, int]],
    selected_ids: set[int],
    process_column_counts: dict[int, int],
    sample_by_column: dict[int, dict[str, Any]],
    function_names: dict[int, str],
    var_column_names: dict[int, str],
) -> list[dict[str, Any]]:
    """Serialize page rows while their session is still open, so no attribute is reloaded after commit."""
    return [
        {
            'column_id': column.id,
            'selected': column.id in selected_ids,
            'process_id': column.process_id,
            'process_name': process_name,
            'column_order_in_process': column_order_in_process,
            'column_order_label': _format_column_order(
                column_order_in_process, process_column_counts.get(column.process_id, 0)
            ),
            'english_name': column.name_en,
            'datatype': column.data_type,
            'column_type': column.column_type,
            'is_serial_no': column.is_serial_no,
            'is_int_category': column.is_int_category,
            'is_judge': column.is_judge,
            'shownname': column.shown_name,
            'name_local': column.name_local,
            'unit': column.unit,
            'filter': column.filter,
            'formula': column.formula,
            'sample_data': sample_by_column.get(column.id, {}).get('sample_data', []),
            'unique_values': sample_by_column.get(column.id, {}).get('unique_values', []),
            # Samples could not be read (transaction file busy): the client must not cache the empty samples.
            'sample_unavailable': bool(sample_by_column.get(column.id, {}).get('unavailable')),
            'raw_column_name': column.column_raw_name,
            'function_details': [
                {
                    'function_id': func_col.function_id,
                    'function_name': function_names.get(func_col.function_id),
                    'var_x': func_col.var_x,
                    'var_x_name': var_column_names.get(func_col.var_x),
                    'var_y': func_col.var_y,
                    'var_y_name': var_column_names.get(func_col.var_y),
                    'return_type': func_col.return_type,
                    'a': func_col.a,
                    'b': func_col.b,
                    'c': func_col.c,
                    'n': func_col.n,
                    'k': func_col.k,
                    's': func_col.s,
                    't': func_col.t,
                    'note': func_col.note,
                    'order': func_col.order,
                }
                for func_col in column.function_details
            ],
        }
        for column, process_name, column_order_in_process in page_rows
    ]


def _get_function_detail_lookups(
    meta_session: scoped_session,
    rows: list[tuple[CfgProcessColumn, str, int]],
) -> tuple[dict[int, str], dict[int, str]]:
    """Resolve function names and X/Y column names used by function details of the given rows."""
    function_details = [func_col for column, _, _ in rows for func_col in column.function_details]
    if not function_details:
        return {}, {}

    function_ids = {func_col.function_id for func_col in function_details}
    var_ids = {var_id for func_col in function_details for var_id in (func_col.var_x, func_col.var_y) if var_id}

    is_ja = is_ja_locale()
    function_names = {
        function.id: (function.function_name_jp if is_ja else function.function_name_en) or function.function_type
        for function in meta_session.query(MFunction).filter(MFunction.id.in_(function_ids)).all()
    }
    var_column_names = {
        column.id: column.shown_name or column.name_en or column.column_name
        for column in meta_session.query(CfgProcessColumn).filter(CfgProcessColumn.id.in_(var_ids)).all()
    }
    return function_names, var_column_names


def _matches_sample_value_filter(samples: dict[str, list[Any]], filter_name: str) -> bool:
    values = [str(value) for value in samples.get('sample_data', [])[:5]]
    values += ['-'] * (5 - len(values))
    if filter_name == 'na_filter':
        return all(value.strip().upper() == 'NA' for value in values)
    valid = [value for value in values if value.strip() and value.strip().upper() != 'NA']
    return len(valid) > 1 and all(value == valid[0] for value in valid)


def _normalize_cell_value(value: Any) -> Any:
    if value is None:
        return None

    if pd.isna(value):
        return None

    if hasattr(value, 'item'):
        with contextlib.suppress(Exception):
            value = value.item()

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, (str, int, float, bool)):
        return value

    return str(value)


def _to_top_n_samples(values: pd.Series, limit: int) -> list[Any]:
    result: list[Any] = []
    for raw_value in values.tolist():
        normalized = _normalize_cell_value(raw_value)
        if normalized is None:
            continue
        result.append(normalized)
        if len(result) >= limit:
            break
    return result


def _to_top_n_unique(values: pd.Series, limit: int) -> list[Any]:
    result: list[Any] = []
    seen: set[str] = set()
    seen_raw: set[Any] = set()
    for raw_value in values.tolist():
        # Skip raw duplicates before normalizing: low-cardinality columns would otherwise normalize every row.
        try:
            if raw_value in seen_raw:
                continue
            seen_raw.add(raw_value)
        except TypeError:
            pass

        normalized = _normalize_cell_value(raw_value)
        if normalized is None:
            continue

        key = repr(normalized)
        if key in seen:
            continue

        seen.add(key)
        result.append(normalized)
        if len(result) >= limit:
            break
    return result


# Seconds to wait for a transaction file locked by an import before serving the page without its samples.
SAMPLE_LOCK_TIMEOUT_SECONDS = 1.0
# Processes whose samples are kept in memory (least recently used first out).
SAMPLE_CACHE_MAX_PROCESSES = 256
# Values kept per column for the Sample Data cells and the unique-value list.
SAMPLE_VALUE_LIMIT = 10
# Max transaction rows read to build samples. A selected datetime range only decides *which* rows are
# candidates, never how many are read, so the read stays as cheap as the unfiltered case.
SAMPLE_SOURCE_ROW_LIMIT = 1000


@dataclass(slots=True)
class _ProcessSampleCacheEntry:
    """Samples of one transaction file, valid while the file signature is unchanged."""

    signature: tuple[Any, ...]
    samples: dict[str, dict[str, list[Any]]]


_sample_cache: OrderedDict[tuple[Any, ...], _ProcessSampleCacheEntry] = OrderedDict()
_sample_cache_lock = threading.Lock()


def clear_sample_cache() -> None:
    with _sample_cache_lock:
        _sample_cache.clear()


def _normalized_datetime_ranges(raw_ranges: Any) -> tuple[tuple[str, str], ...]:
    """Deterministic, hashable UTC ``(start, end)`` ranges from the request; incomplete entries are dropped.

    ``raw_ranges`` is the dumped ``ProcessColumnsRequest.datetime_ranges`` (list of ``{'start', 'end'}``).
    Sorting makes the result independent of the order the ranges were sent in, so it can be part of the
    sample cache key.
    """
    ranges = {
        (start, end)
        for item in raw_ranges or []
        if (start := (item.get('start') or '').strip()) and (end := (item.get('end') or '').strip())
    }
    return tuple(sorted(ranges))


@dataclass(frozen=True, slots=True)
class _SampleDateFilter:
    """Limits sample reads of one process to rows whose main datetime column is in a selected UTC range.

    Frozen (hashable) so it can be part of the sample cache key: samples read for different ranges must
    never be served to each other.
    """

    column: str
    ranges: tuple[tuple[str, str], ...]

    def apply(self, stmt: Any) -> Any:
        """Add the range filter and a deterministic order, so the limited sample is reproducible."""
        date_col = sa.column(self.column)
        # The datetime column is stored as ISO-8601 UTC VARCHAR, so string comparison is chronological.
        # Values are bound (not interpolated); the bounds come from the selected picker range(s).
        return stmt.where(
            sa.or_(*(sa.and_(date_col >= start, date_col <= end) for start, end in self.ranges)),
        ).order_by(date_col.asc())


def _build_sample_date_filters(
    process_ids: set[int],
    datetime_ranges: tuple[tuple[str, str], ...],
) -> dict[int, _SampleDateFilter]:
    """Per-process filter for the given ranges; a process without a main datetime column is left out."""
    if not process_ids or not datetime_ranges:
        return {}
    with make_session() as meta_session:
        rows = (
            meta_session.query(CfgProcessColumn.process_id, CfgProcessColumn.bridge_column_name)
            .filter(
                CfgProcessColumn.process_id.in_(process_ids),
                CfgProcessColumn.is_get_date.is_(True),
            )
            .all()
        )
    return {
        int(process_id): _SampleDateFilter(column=bridge_column, ranges=datetime_ranges)
        for process_id, bridge_column in rows
        if bridge_column
    }


def _transaction_file_signature(process_id: int) -> tuple[Any, ...]:
    """Modification time and size of the DuckDB file and its WAL; any import or schema change alters it."""
    db_file = gen_duckdb_file_name(process_id)
    signature: list[Any] = []
    for file_path in (db_file, f'{db_file}.wal'):
        try:
            stat = Path(file_path).stat()
        except OSError:
            signature.append(None)
        else:
            signature.append((stat.st_mtime_ns, stat.st_size))
    return tuple(signature)


def _read_process_samples(
    process_id: int,
    bridge_columns: list[str],
    sample_limit: int,
    source_limit: int,
    lock_timeout: float,
    date_filter: _SampleDateFilter | None = None,
) -> tuple[tuple[Any, ...], dict[str, dict[str, list[Any]]]] | None:
    """Read samples of the given bridge columns; raises filelock.Timeout when the file stays locked.

    With `date_filter`, only rows inside the selected datetime range(s) are candidates; the number of
    rows read stays capped by `source_limit` exactly like the unfiltered case.
    """
    with TxnDataConnection(process_id=process_id, readonly_transaction=True, lock_timeout=lock_timeout) as data_con:
        if data_con is None:
            return None

        # The lock is held, so no import can modify the file while it is read.
        signature = _transaction_file_signature(process_id)
        # Select the bridge columns directly: building TransactionData would lazy-load every
        # column config of the process, which is only overhead for reading samples.
        stmt = sa.select(*[sa.column(name) for name in bridge_columns]).select_from(
            sa.table(gen_transaction_table_name(process_id)),
        )
        if date_filter is not None:
            stmt = date_filter.apply(stmt)
        df = data_con.fetch_df(stmt.limit(source_limit))

    values: dict[str, dict[str, list[Any]]] = {}
    for name in bridge_columns:
        if name not in df.columns:
            values[name] = {'sample_data': [], 'unique_values': []}
            continue
        series = df[name]
        values[name] = {
            'sample_data': _to_top_n_samples(series, sample_limit),
            'unique_values': _to_top_n_unique(series, sample_limit),
        }
    return signature, values


def _get_process_samples(
    process_id: int,
    bridge_columns: list[str],
    sample_limit: int,
    source_limit: int,
    wait_for_lock: bool,
    date_filter: _SampleDateFilter | None = None,
) -> tuple[dict[str, dict[str, list[Any]]], bool] | None:
    """
    Return (samples by bridge column, unavailable) for one process, reading only columns missing from the cache.
    `unavailable` is True when the file was locked and some requested columns have no samples at all.
    """
    # The selected range is part of the cache key so samples of different ranges (or of the unfiltered
    # "first N rows" case, where `date_filter` is None) are never mixed.
    cache_key = (process_id, sample_limit, source_limit, date_filter)
    signature = _transaction_file_signature(process_id)
    with _sample_cache_lock:
        entry = _sample_cache.get(cache_key)
        if entry is not None:
            _sample_cache.move_to_end(cache_key)
            cached_values = dict(entry.samples)
            cached_signature = entry.signature
        else:
            cached_values = {}
            cached_signature = None

    values = cached_values if cached_signature == signature else {}
    missing = [name for name in bridge_columns if name not in values]
    if not missing:
        return values, False

    try:
        result = _read_process_samples(
            process_id,
            missing,
            sample_limit,
            source_limit,
            lock_timeout=-1 if wait_for_lock else SAMPLE_LOCK_TIMEOUT_SECONDS,
            date_filter=date_filter,
        )
    except FileLockTimeout:
        logger.info(f'Transaction file is busy, serve cached samples only. process_id={process_id}')
        # Stale samples are better than none while an import holds the file.
        return cached_values, True
    except Exception:
        logger.exception(f'Failed to read transaction sample values. process_id={process_id}')
        return None

    if result is None:
        return None
    read_signature, read_values = result
    with _sample_cache_lock:
        entry = _sample_cache.get(cache_key)
        merged = {**entry.samples, **read_values} if entry and entry.signature == read_signature else read_values
        _sample_cache[cache_key] = _ProcessSampleCacheEntry(signature=read_signature, samples=merged)
        _sample_cache.move_to_end(cache_key)
        while len(_sample_cache) > SAMPLE_CACHE_MAX_PROCESSES:
            _sample_cache.popitem(last=False)
    return {**values, **read_values}, False


def _get_column_sample_and_unique_values(
    rows: list[tuple[CfgProcessColumn | _ColumnView, str, int]],
    sample_limit: int = SAMPLE_VALUE_LIMIT,
    source_limit: int = SAMPLE_SOURCE_ROW_LIMIT,
    *,
    wait_for_lock: bool = False,
    datetime_ranges: tuple[tuple[str, str], ...] = (),
) -> dict[int, dict[str, Any]]:
    """
    Samples of the given columns, served from an in-memory cache invalidated by the transaction file signature.
    Unless `wait_for_lock`, a transaction file locked by an import is skipped after a short wait and its
    columns without cached samples are flagged `unavailable`.
    When `datetime_ranges` is given, samples come only from rows whose main datetime column falls in any
    of the (UTC) ranges; a process without a main datetime column then yields empty samples.
    """
    if not rows:
        return {}

    by_process: dict[int, list[CfgProcessColumn | _ColumnView]] = {}
    for column, _, _ in rows:
        by_process.setdefault(int(column.process_id), []).append(column)

    date_filters = _build_sample_date_filters(set(by_process), datetime_ranges)

    output: dict[int, dict[str, Any]] = {}

    for process_id, columns in by_process.items():
        bridge_columns = list(
            dict.fromkeys(column.bridge_column_name for column in columns if column.bridge_column_name)
        )
        if not bridge_columns:
            continue

        date_filter = date_filters.get(process_id)
        if datetime_ranges and date_filter is None:
            # A range was selected but this process has no main datetime column to filter on: empty samples.
            for column in columns:
                output[int(column.id)] = {'sample_data': [], 'unique_values': []}
            continue

        result = _get_process_samples(
            process_id,
            bridge_columns,
            sample_limit,
            source_limit,
            wait_for_lock,
            date_filter=date_filter,
        )
        if result is None:
            continue
        values, unavailable = result

        for column in columns:
            samples = values.get(column.bridge_column_name) if column.bridge_column_name else None
            if samples is not None:
                output[int(column.id)] = samples
            elif unavailable and column.bridge_column_name:
                output[int(column.id)] = {'sample_data': [], 'unique_values': [], 'unavailable': True}
            else:
                output[int(column.id)] = {'sample_data': [], 'unique_values': []}

    return output


def get_process_filters(proc_id):
    proc_filter_schema = FilterSchema(many=True)
    filters = CfgFilter.query.filter(CfgFilter.process_id == proc_id).all() or []
    return proc_filter_schema.dump(filters)


def get_process_visualizations(proc_id):
    proc_vis_schema = ProcessVisualizationSchema()
    process = CfgProcess.query.get(proc_id) or {}
    return proc_vis_schema.dump(process)


def get_all_visualizations():
    return list({cfg.filter_detail_id for cfg in CfgVisualization.get_filter_ids()})


# def get_all_process_cfg_with_nested():
#     process_schema = ProcessSchema(many=True)
#     processes = CfgProcess.get_all() or []
#     return process_schema.dump(processes, many=True)


def get_process_last_import_at(process: CfgProcess) -> str | None:
    if process.status == ProcessStatus.INITIALIZED.value:
        return None
    if not Path(gen_sqlite3_file_name(process.id)).is_file():
        return None
    with TxnMetaConnection(process_id=process.id) as meta_con:
        return ImportHistoryTable.get_latest_import_time(meta_con, process.id)


def get_datasource_reference_file(data_source: CfgDataSource) -> str | None:
    """Resolve a modal default without changing the persisted datasource setting."""
    if data_source.type not in (DBType.CSV.name, DBType.V2.name) or not data_source.csv_detail:
        return None
    latest_process = None
    latest_key = ('', 0)
    for process in CfgProcess.get_by_data_source_id(data_source.id):
        imported_at = get_process_last_import_at(process)
        if imported_at and (imported_at, process.id) > latest_key:
            latest_process = process
            latest_key = (imported_at, process.id)
    # An empty value on the latest process falls back to DS, never an older process.
    if latest_process and latest_process.file_name and latest_process.file_name.strip():
        return latest_process.file_name
    return data_source.csv_detail.reference_file


def is_reference_file_locked(process: CfgProcess) -> bool:
    if process.status == ProcessStatus.INITIALIZED.value:
        return False
    if process.data_source.type not in (DBType.CSV.name, DBType.V2.name):
        return False
    if get_process_last_import_at(process) is not None:
        return True
    # Shared parent rows do not prove that this child has imported any data.
    if process.parent_id:
        return False
    # Older installations can have transaction rows without retained import history.
    # Do not invent an import timestamp, but still protect their saved reference.
    data_process_id = process.id
    if not Path(gen_duckdb_file_name(data_process_id)).is_file():
        return False
    trans_data = TransactionData(data_process_id)
    with TxnDataConnection(process_id=data_process_id, readonly_transaction=True) as data_con:
        return trans_data.get_preview_table_availability(data_con).has_rows


def validate_process_reference_file(process: CfgProcess) -> None:
    if not process.file_name or not process.data_source_id:
        return
    source = CfgDataSource.get_ds(process.data_source_id)
    if (
        source
        and source.csv_detail
        and not is_reference_file_in_source(
            source.csv_detail.directory,
            process.file_name,
            require_exists=False,
            source_is_file=bool(source.csv_detail.is_file_path),
        )
    ):
        raise ReferenceFileOutsideSourceError(gettext('ReferenceFileOutsideSource'))


@use_meta_session()
def create_or_update_process_cfg(
    process: CfgProcess,
    unused_columns: list[str],
    labels: list[str],
    meta_session: scoped_session = None,
) -> CfgProcess:
    validate_process_reference_file(process)
    if process.id:
        existing = meta_session.get(CfgProcess, process.id)
        if existing and existing.file_name != process.file_name and is_reference_file_locked(existing):
            process.file_name = existing.file_name

    dict_id_column_name = {}
    # We have a hack that is sending column with negative id to backend.
    # To keep function columns relationship.
    # Hence, we save a dictionary here, so that we can revert the ID later.
    for column in process.columns:
        # get id with name before save db
        dict_id_column_name[column.id] = column.column_name
        column.filter = column.filter if column.filter else None
        if column.id and column.id < 0:  # set None for new column
            column.id = None
        for function_col in column.function_details:
            if function_col.id and function_col.id < 0:
                function_col.id = None

    # merge to get `process.id`
    process = meta_session.merge(process)

    # Flush the relationship graph first so every new process column has its database-generated ID.
    meta_session.flush()

    # Persist stable physical identifiers in one follow-up flush instead of issuing one update per inserted column.
    if populate_missing_bridge_column_names(process.columns):
        meta_session.flush()

    children_processes = CfgProcess.get_children(process.id, session=meta_session)
    for child_process in children_processes:
        child_process.name = process.name
        child_process.name_jp = process.name_jp
        child_process.name_en = process.name_en
        child_process.name_local = process.name_local
        child_process.status = process.status

    # update order if new
    if process.order is None:
        process.order = process.id - 1

    dict_column_name_with_id = {col.column_name: col.id for col in process.columns}
    # assign process function after save process columns
    for column in process.columns:
        for func_col in column.function_details:
            func_col.var_x = dict_column_name_with_id.get(dict_id_column_name.get(func_col.var_x))
            func_col.var_y = dict_column_name_with_id.get(dict_id_column_name.get(func_col.var_y))

    # use dict to avoid duplicated labels
    process_labels: dict[int, CfgLabel] = {}
    for label_name in labels:
        label = get_or_create_label(label_name, meta_session)
        process_labels[label.id] = label
    # sort label
    process.labels = sorted(process_labels.values(), key=lambda v: v.id)

    # update process function columns
    process = meta_session.merge(process)

    # save uncheck cols of v2 only
    process = save_unused_columns(process, unused_columns, meta_session=meta_session)

    return process


def get_or_create_label(label_name: str, meta_session) -> CfgLabel:
    label = CfgLabel.get_label_by_name(label_name, meta_session)

    if not label:
        label = CfgLabel(name=label_name)
        meta_session.add(label)
        # flush to get id
        meta_session.flush()
    return label


def query_database_tables(db_id, process=None):
    with make_session() as mss:
        data_source = mss.query(CfgDataSource).get(db_id)

    if not data_source:
        return None

    output = {'ds_type': data_source.type, 'tables': [], 'process_factids': [], 'master_types': []}
    if process:
        # if process register tables = selected table
        output['tables'] = [process.get('table_name', '')]
        output['process_factids'] = [process.get('process_factid', '')]
        output['master_types'] = [process.get('master_type', '')]
        return output
    # return None if CSV
    if data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower(), DBType.WEB_API.name.lower()]:
        if data_source.csv_detail:
            output['reference_file'] = data_source.csv_detail.reference_file
        return output
    updated_at = data_source.db_detail.updated_at
    if data_source.type in [DBType.POSTGRES_SOFTWARE_WORKSHOP.name, DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name]:
        tables, process_fact_ids, master_types = get_list_process_software_workshop(data_source)
        output['tables'] = tables
        output['process_factids'] = process_fact_ids
        output['master_types'] = master_types
    else:
        output['tables'] = get_list_tables_and_views(data_source, updated_at)

    return output


def query_database_tables_core(data_source: CfgDataSource, table_prefix):
    if not data_source:
        return None

    detail_master_types = []
    output = {'ds_type': data_source.type, 'master_type': data_source.master_type, 'tables': []}
    # return None if CSV
    if data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]:
        if data_source.csv_detail.directory:
            detail_master_types.append(MasterDBType.V2.name)
        if data_source.csv_detail.second_directory:
            detail_master_types.append(MasterDBType.V2_HISTORY.name)
        output['detail_master_types'] = detail_master_types
        return output

    updated_at = data_source.db_detail.updated_at
    tables = get_list_tables_and_views(data_source.id, updated_at)
    partitions = None
    # Edge server does not have logic of EFA
    # if data_source.master_type == MasterDBType.EFA.name:
    #     if table_prefix or data_source.is_direct_import:
    #         table_name, partitions, _ = get_efa_partitions(tables, table_prefix)
    #         tables = [table_name]
    #     else:
    #         partitions = []
    #         tables = EFA_TABLES

    output['tables'] = tables
    output['partitions'] = partitions

    return output


@CustomCache.memoize(duration=300)
def get_list_tables_and_views(data_source, updated_at=None):
    # updated_at only for cache
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with ReadOnlyDbProxy(data_source) as db_instance:
        tables = db_instance.list_tables_and_views()

    tables = sorted(tables, key=lambda v: v.lower())
    return tables


@CustomCache.memoize(duration=300)
def get_list_process_software_workshop(data_source: CfgDataSource, updated_at=None):
    # updated_at only for cache
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with ReadOnlyDbProxy(data_source) as db_instance:
        software_workshop_def = data_source.software_workshop_def()
        sql = software_workshop_def.get_processes_query()
        cols, rows = db_instance.run_sql(sql)

    df_measurement = pd.DataFrame(rows, columns=cols)
    df_measurement['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.get_data_type()
    df_measurement['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name
    df_history = pd.DataFrame(rows, columns=cols)
    df_history['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.get_data_type()
    df_history['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name
    df = pd.concat([df_measurement, df_history]).sort_values(
        by=[software_workshop_def.child_equip_id, 'data_type'],
        ascending=[True, False],
    )

    process_fact_ids = df[software_workshop_def.child_equip_id].to_list()
    master_types = df['master_type'].to_list()
    master_type_suffixes = df['master_type'].apply(MasterDBType.master_type_suffix)
    table_names = (df[software_workshop_def.table_name] + UNDER_SCORE + master_type_suffixes).to_list()
    table_names = normalize_list(table_names)

    return table_names, process_fact_ids, master_types


def convert2serialize(obj):
    if isinstance(obj, dict):
        return {k: convert2serialize(v) for k, v in obj.items()}
    elif hasattr(obj, '_ast'):
        return convert2serialize(obj._ast())
    elif not isinstance(obj, str) and hasattr(obj, '__iter__'):
        return [convert2serialize(v) for v in obj]
    elif hasattr(obj, '__dict__'):
        return {
            k: convert2serialize(v)
            for k, v in obj.__dict__.items()
            if not callable(v) and not k.startswith(UNDER_SCORE)
        }
    else:
        return obj


def get_ct_range(proc_id: int, columns: list[dict[str, Any]]):
    is_using_dummy_datetime = True in [col['is_get_date'] and col['is_dummy_datetime'] for col in columns]

    if not is_using_dummy_datetime:
        return []

    try:
        with TxnDataConnection(process_id=proc_id, readonly_transaction=True) as data_con:
            trans_data = TransactionData(proc_id)
            ct_range = trans_data.get_ct_range(data_con)
        return ct_range
    except Exception:
        return []


def update_process_status(process_id: int, status: ProcessStatus):
    with make_session() as meta_session:
        CfgProcess.update_status(meta_session, process_id, status)


@CustomCache.memoize(duration=300)
def get_processes_by_line_grp(data_source: CfgDataSource, updated_at=None):
    # updated_at only for cache
    software_workshop_def = data_source.software_workshop_def()
    logger.info(f'database config updated_at: {updated_at} so cache can not be used')
    with ReadOnlyDbProxy(data_source) as db_instance:
        sql = software_workshop_def.get_processes_by_line_groups_query()
        _, rows = db_instance.run_sql(sql)

    df_measurement = pd.DataFrame(rows)
    rename_cols = {col: col.lower() for col in df_measurement.columns}
    df_measurement['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.get_data_type()
    df_measurement['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name
    df_history = pd.DataFrame(rows)
    df_history['data_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.get_data_type()
    df_history['master_type'] = MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name
    df = pd.concat([df_measurement, df_history])
    df = df.rename(columns=rename_cols)
    line_groups = []
    line_group_infos = []
    for line_group, group_df in df.groupby(FACTORY_LINE_GROUP_LABEL):
        line_groups.append(line_group)
        line_group_infos.append(group_df.to_dict(orient='records'))

    return line_groups, line_group_infos


def get_line_grp_info(db_connection_params: DbConnectionParam):
    output = {'line_groups': [], 'line_group_infos': []}
    data_source = db_connection_params.data_source_no_id()
    line_groups, line_group_infos = get_processes_by_line_grp(data_source, updated_at=None)
    output['line_groups'] = line_groups
    output['line_group_infos'] = line_group_infos

    return output
