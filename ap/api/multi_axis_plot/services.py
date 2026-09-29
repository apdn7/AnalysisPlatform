from dataclasses import dataclass, replace
from decimal import ROUND_FLOOR, Decimal, InvalidOperation
from typing import Any

import numpy as np
import pandas as pd
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
    is_string_dtype,
)

from ap.api.common.services.show_graph_services import (
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    gen_df,
    get_chart_infos,
    get_filter_on_demand_data,
    retrieve_order_setting,
    set_chart_infos_to_plotdata,
    sort_df_by_x_option,
)
from ap.common.common_utils import gen_derived_column_name
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_PLOTDATA,
    CATEGORY_AGGREGATED,
    COL_DATA_TYPE,
    COMMON,
    DF_ALL_COLUMNS,
    DF_ALL_PROCS,
    END_COL_ID,
    MAP_AGG_COUNT,
    MAP_AGG_DURATION,
    MAP_AGG_SUM,
    MAP_BIN_BASE_CHUNK,
    MAP_BIN_MAX_BINS,
    MAP_BIN_MODE_COUNT,
    MAP_BIN_MODE_WIDTH,
    MAP_EQUAL_FREQ_BIN_OPTION,
    MAP_EQUAL_WIDTH_BIN_OPTION,
    MAP_Y_AXIS_BIN_MODES,
    MAP_Y_BIN_MAX_BINS,
    MAX_INT_CAT_VALUE,
    OTHERS_GROUP_NAME,
    RANK_COL,
    RATIO_COLUMN_NAME,
    SHOW_PROCESS_NAME,
    TIME_COL,
    TIMES,
    UNIQUE_SERIAL,
    CacheType,
    DataType,
    XAxisOption,
    YScaleModes,
)
from ap.common.log import log_execution_time
from ap.common.memoize import CustomCache, OptionalCacheConfig
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import abort_process_handler, request_timeout_handling
from ap.common.services.statistics import determine_log_scale_mode
from ap.common.sigificant_digit import get_fmt_from_array, signify_digit
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log
from ap.multi_axis_plot.enums import ColorCategoryLimit, ColorImbThreshold, CommonLayoutEnum, OverlayEnum
from ap.multi_axis_plot.layout_index import MAPLayoutIndex, build_map_layout_index
from ap.multi_axis_plot.schemas import MAPDataResponse, MAPLayoutRequest
from ap.setting_module.models import CfgProcessColumn
from ap.trace_data.schemas import DicParam

MAP_DATA_POINT_DISPLAY_LIMIT = 8192
MAP_DATA_POINT_LIMIT_EXCEEDED = 'map_data_point_limit_exceeded'
MAP_DATA_POINT_NTH = 'map_data_point_nth'
MAP_DATA_POINT_WINDOW_SIZE = 'map_data_point_window_size'
MAP_DATA_POINT_SHOW_LABELS = 'map_data_point_show_labels'
MAP_DATA_POINT_INDEX_COL = '__map_data_point_index__'
MAP_CATEGORY_INDEX_DISPLAY_THRESHOLD = 128
MAP_MAX_SUB_PLOTS = 6
# Div2/Div3/Div6: number of sub-panels per Div group. Each must evenly divide MAP_MAX_SUB_PLOTS
# so that (div_size X number of primaries) never exceeds the 6-subplot cap.
MAP_VALID_DIV_SIZES = (2, 3, 6)
MAP_DEFAULT_DIV_SIZE = 6  # legacy behavior: div_by_cat set but no div_size => old single-primary Div
MAP_DIV_SIZE = 'div_size'
MAP_NUM_PRIMARIES = 'num_primaries'
MAP_DIV_ORIENTATION = 'div_orientation'

# Lab (data label) display limit: when Lab/LabX is configured and the data point count
# exceeds this threshold, prompt the user instead of silently rendering 100+ overlapping labels.
MAP_LAB_DATA_POINT_LIMIT = 128
MAP_LAB_LIMIT_EXCEEDED = 'map_lab_limit_exceeded'
CATEGORY_AGGREGATE_MODE_AGGREGATED = 'aggregated'


@dataclass(frozen=True)
class MAPDataPointWindow:
    """Resolved data point window request for MaP display limiting."""

    nth: Decimal
    window_size: int
    show_labels: bool


def _first_form_value(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _parse_decimal(value: Any, default: Decimal = Decimal(1)) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default
    return default if parsed == 0 else parsed


def _parse_bool(value: Any) -> bool:
    return str(value).lower() in {'1', 'true', 'yes', 'on'}


def _resolve_data_point_window(dic_param: dict[str, Any]) -> MAPDataPointWindow | None:
    raw_window_size = _first_form_value(dic_param.get(MAP_DATA_POINT_WINDOW_SIZE))
    if not raw_window_size:
        return None

    try:
        window_size = int(raw_window_size)
    except (TypeError, ValueError):
        return None

    if window_size <= 0:
        return None

    nth = _parse_decimal(_first_form_value(dic_param.get(MAP_DATA_POINT_NTH)))
    show_labels = _parse_bool(_first_form_value(dic_param.get(MAP_DATA_POINT_SHOW_LABELS)))
    return MAPDataPointWindow(nth=nth, window_size=window_size, show_labels=show_labels)


def _slice_data_point_window(df: pd.DataFrame, window: MAPDataPointWindow) -> pd.DataFrame:
    if df.empty:
        return df

    window_size = window.window_size
    nth = window.nth
    # Values between -1 and 1 represent the nearest window.
    if 0 <= nth < 1:
        nth = 1
    elif -1 < nth < 0:
        nth = -1

    distance = max(int((Decimal(window_size) * Decimal(str(abs(nth)))).to_integral_value(rounding=ROUND_FLOOR)), 1)
    data_point_count = len(df)

    if nth > 0:
        end = min(distance, data_point_count)
        start = max(end - window_size, 0)
    else:
        start = max(data_point_count - distance, 0)
        end = min(start + window_size, data_point_count)

    return df.iloc[start:end].copy()


def _should_force_category_index_xaxis(
    layout_index: MAPLayoutIndex | None,
    graph_param: DicParam,
    df: pd.DataFrame,
) -> bool:
    """Return true when CatValue is too large to display as category values."""
    if not layout_index or len(df) <= MAP_CATEGORY_INDEX_DISPLAY_THRESHOLD:
        return False

    x_axis_col_id = layout_index.get_x_axis()
    x_axis_col = graph_param.get_col_cfg(x_axis_col_id) if x_axis_col_id else None
    if not x_axis_col or not x_axis_col.is_category or graph_param.common.x_option != XAxisOption.CAT_VALUE.value:
        return False

    x_values = get_data_from_cfg_column(df, x_axis_col)
    return count_unique_values(x_values) >= MAP_CATEGORY_INDEX_DISPLAY_THRESHOLD


def _format_bin_value(value: Any, fmt: str | None = None) -> str:
    """Format a bin edge for labels."""
    if pd.isna(value):
        return 'NA'
    if isinstance(value, pd.Timestamp):
        return value.strftime('%y%m%d %H:%M:%S')
    if isinstance(value, (int, float, np.number)):
        if not np.isfinite(value):
            return str(value)
        fmt = fmt if fmt is not None else get_fmt_from_array([value], sig_dit=4)
        if not fmt:
            return str(value)
        if fmt.endswith('d') and isinstance(value, (float, np.floating)):
            if value.is_integer():
                value = int(value)
            else:
                fmt = get_fmt_from_array([value], sig_dit=4)
        return format(value, fmt)
    return str(value)


def _bin_edges_equal(min_value: Any, max_value: Any) -> bool:
    if pd.isna(min_value) or pd.isna(max_value):
        return False
    return bool(min_value == max_value)


def make_bin(
    df: pd.DataFrame,
    col: str,
    axis: str = 'x',
    rep: str = 'median',
    base_chunk: int = MAP_BIN_BASE_CHUNK,
    max_bins: int = MAP_BIN_MAX_BINS,
    attach: bool = True,
    bool_map: dict[bool, str] | None = None,
    bin_mode: str = MAP_BIN_MODE_COUNT,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create category or numeric/datetime bins for a MAP X-axis or Y-axis column.

    Bool/category/string/object columns use the values themselves as bins.
    Numeric/datetime columns use equal-frequency bins when ``bin_mode='count'``
    and equal-width bins when ``bin_mode='width'``.
    """
    if axis not in {'x', 'y'}:
        raise ValueError("axis must be 'x' or 'y'")
    if rep not in {'median', 'mean'}:
        raise ValueError("rep must be 'median' or 'mean'")
    if bin_mode not in {MAP_BIN_MODE_COUNT, MAP_BIN_MODE_WIDTH}:
        raise ValueError("bin_mode must be 'count' or 'width'")
    if col not in df.columns:
        raise KeyError(f'The following columns not exist in the DataFrame: {col}')

    d = df.copy()
    s = d[col]
    rep_col = axis
    bool_map = bool_map or {True: 'OK', False: 'NG'}

    if is_bool_dtype(s):
        d['_bin'] = s.map(bool_map)
        out = (
            d.groupby('_bin', dropna=False).agg(**{rep_col: ('_bin', 'first'), 'count': ('_bin', 'size')}).reset_index()
        )
        meta = {
            f'bin_{axis}_type': 'cat_bool',
            f'bin_{axis}_base': col,
            f'bin_{axis}_mode': bin_mode,
        }
        out.attrs.update(meta)
        if not attach:
            return d, out

        d = d.drop(columns=rep_col, errors='ignore').merge(out[['_bin', rep_col]], on='_bin', how='left')
        d = d[[rep_col, *[column for column in d.columns if column != rep_col]]]
        d.attrs.update(meta)
        return d, out

    if isinstance(s.dtype, pd.CategoricalDtype) or is_string_dtype(s) or is_object_dtype(s):
        d['_bin'] = s
        out = d.groupby('_bin', dropna=False).agg(**{rep_col: (col, 'first'), 'count': (col, 'size')}).reset_index()
        meta = {
            f'bin_{axis}_type': 'category',
            f'bin_{axis}_base': col,
            f'bin_{axis}_mode': bin_mode,
        }
        out.attrs.update(meta)
        if not attach:
            return d, out

        d = d.drop(columns=rep_col, errors='ignore').merge(out[['_bin', rep_col]], on='_bin', how='left')
        d = d[[rep_col, *[column for column in d.columns if column != rep_col]]]
        d.attrs.update(meta)
        return d, out

    if not (is_numeric_dtype(s) or is_datetime64_any_dtype(s)):
        raise TypeError(f'Unsupported dtype: {col} = {s.dtype}')

    min_col = f'{axis}_min'
    max_col = f'{axis}_max'
    d = d.sort_values(col).reset_index(drop=True)
    valid_mask = d[col].notna()
    valid_count = int(valid_mask.sum())
    if valid_count == 0:
        bin_count = 0
    elif valid_count <= base_chunk * 2:
        bin_count = min(valid_count, 2)
    else:
        bin_count = min(int(np.ceil(valid_count / base_chunk)), max_bins)
    if axis == 'y':
        bin_count = min(bin_count, MAP_Y_BIN_MAX_BINS)

    d['_bin'] = np.nan

    if bin_count > 0:
        valid_index = d.index[valid_mask]
        if bin_mode == MAP_BIN_MODE_COUNT:
            d.loc[valid_index, '_bin'] = np.minimum(
                np.arange(valid_count) * bin_count // valid_count,
                bin_count - 1,
            )
        else:
            x = d.loc[valid_index, col]
            xmin = x.min()
            xmax = x.max()
            if xmax == xmin:
                d.loc[valid_index, '_bin'] = 0
            else:
                d.loc[valid_index, '_bin'] = np.minimum(
                    ((x - xmin) / (xmax - xmin) * bin_count).astype(int),
                    bin_count - 1,
                )

    out = (
        d.groupby('_bin', dropna=False)
        .agg(
            **{
                rep_col: (col, rep),
                min_col: (col, 'min'),
                max_col: (col, 'max'),
                'count': (col, 'size'),
            }
        )
        .reset_index()
    )
    bin_values = pd.concat([out[min_col], out[max_col]], ignore_index=True)
    bin_fmt = get_fmt_from_array(bin_values, sig_dit=4) if is_numeric_dtype(s) else ''
    if bin_fmt.endswith('d'):
        finite_bin_values = bin_values.replace([np.inf, -np.inf], np.nan).dropna()
        fractional_bin_values = finite_bin_values[finite_bin_values % 1 != 0]
        if not fractional_bin_values.empty:
            bin_fmt = get_fmt_from_array(fractional_bin_values, sig_dit=4)
    meta = {
        f'bin_{axis}_type': 'num_bin',
        f'bin_{axis}_base': col,
        f'bin_{axis}_mode': bin_mode,
        f'bin_{axis}_fmt': bin_fmt,
        f'bin_{axis}_label': {
            getattr(row, rep_col): (
                _format_bin_value(getattr(row, min_col), bin_fmt)
                if _bin_edges_equal(getattr(row, min_col), getattr(row, max_col))
                else (
                    f'{_format_bin_value(getattr(row, min_col), bin_fmt)}'
                    f' ~ {_format_bin_value(getattr(row, max_col), bin_fmt)}'
                )
            )
            for row in out.itertuples(index=False)
        },
    }
    out.attrs.update(meta)
    if not attach:
        return d, out

    bin_columns = [rep_col, min_col, max_col]
    d = d.drop(columns=bin_columns, errors='ignore').merge(out[['_bin', *bin_columns]], on='_bin', how='left')
    d = d[[*bin_columns, *[column for column in d.columns if column not in bin_columns]]]
    d.attrs.update(meta)
    return d, out


def get_sub_plots_df(df: pd.DataFrame, graph_param: DicParam, sub_plots: list[list[int]]) -> list[pd.DataFrame | None]:
    """Splitting DataFrame to generate subplots"""
    sub_plot_data: list[pd.DataFrame | None] = []

    # Using a set for O(1) lookups instead of O(N) list lookups
    df_columns_set = set(df.columns)

    for sub_plot_variables in sub_plots:
        sub_plot_cols = []

        for col_id in sub_plot_variables:
            col_label = graph_param.gen_label_from_col_id(col_id)

            # Fast lookup in the columns set
            if col_label in df_columns_set:
                sub_plot_cols.append(col_label)

        # Extract the sub-dataframe if matching columns exist, otherwise append None
        if sub_plot_cols:
            # Slicing the dataframe with the matched columns
            sub_plot_data.append(df[sub_plot_cols])
        else:
            # Aligning with your type hint list[DataFrame | None]
            sub_plot_data.append(None)

    return sub_plot_data


def squared_sigmoid_decay(amp: float, sigma: float, n: float) -> float:
    """Calculates a custom squared sigmoid decay curve."""
    return amp * 4 / (1 + np.exp(sigma * (n - 50.0))) ** 2


def line_width_from_n(n, default=1.0, amp=2.5, sigma=0.002) -> float:
    """Calculate line width via number of data points"""
    size = default + squared_sigmoid_decay(amp, sigma, n)
    return signify_digit(size, 2)


def marker_size_from_n(n, default=2.0, amp=6.0, sigma=0.002) -> float:
    """Calculate marker size to show in graph via number of data points"""
    size = default + squared_sigmoid_decay(amp, sigma, n)
    return signify_digit(size, 2)


def get_data_from_cfg_column(df: pd.DataFrame, column: CfgProcessColumn) -> list:
    """Get data from df"""
    col_label = str(column.bridge_column_name)
    # return raw data for category variable instead of encoded label
    before_rank_col_name = gen_derived_column_name(RANK_COL, col_label)
    if before_rank_col_name in df.columns:
        return df[before_rank_col_name].tolist()
    return df[col_label].tolist()


def get_sub_df_by_col_ids(
    df: pd.DataFrame, target_cols: list[CfgProcessColumn], color_by: str | None = None
) -> list[tuple[str, pd.DataFrame]]:
    """Extracts a sub-DataFrame based on target columns, prioritizing their markup counterparts if available.

    If a column named '_markup_{column_name}' exists in the original DataFrame,
    its values will be used, but the column will be renamed back to the original name.

    Args:
        df (pd.DataFrame): The source DataFrame.
        target_cols (list): List of column to extract.
        color_by (string): Label of color columns which used to split dataframe

    Returns:
        pd.DataFrame: A new DataFrame containing the requested columns with applied markup values.
    """
    # Identify which columns to extract and map markup columns back to original names
    cols_to_extract = []
    markup_mapping = {}
    for cfg_col in target_cols:
        markup_col = gen_derived_column_name(RANK_COL, str(cfg_col.label))
        if markup_col in df.columns:
            # If markup exists, extract the markup column instead
            cols_to_extract.append(markup_col)
            # Store the mapping to rename it back later
            markup_mapping[markup_col] = cfg_col.label
        elif cfg_col.label in df.columns:
            # If no markup exists, extract the original column
            cols_to_extract.append(cfg_col.label)

    # Keep the first-seen order while removing duplicates so downstream column order stays predictable.
    sub_df = df[list(dict.fromkeys(cols_to_extract))].copy()

    # Rename the markup columns back to their original names
    sub_df = sub_df.rename(columns=markup_mapping)

    # Reorder the columns to match the input target_cols list (keeping only existing ones)
    final_cols = list(dict.fromkeys(col.label for col in target_cols if col.label in sub_df.columns))

    if not color_by:
        return [('', sub_df[final_cols])]
    return [(group, data) for group, data in sub_df[final_cols].groupby(color_by)]


def _iter_order_column_pairs(serial_processes: list[int], serial_columns: list[int]) -> list[tuple[int, int]]:
    """Resolve index-order process/column pairs from modal arrays."""
    # SortColumns treats each selected sort item as a process-column pair, but the graph-area
    # index-order modal may serialize repeated columns from the same process as:
    #   serial_processes=[1], serial_columns=[10, 11, 12]
    # Expanding the single process keeps all selected columns addressable; a direct zip would
    # keep only (1, 10), so downstream sort/boundary metadata would lose the remaining levels.
    if len(serial_processes) == 1 and len(serial_columns) > 1:
        return [(serial_processes[0], col_id) for col_id in serial_columns]
    return list(zip(serial_processes, serial_columns, strict=False))


def _add_index_order_columns_to_graph_param(
    graph_param: DicParam,
    temp_x_option: str | None,
    temp_serial_process: list[int],
    temp_serial_column: list[int],
) -> None:
    x_option = temp_x_option or graph_param.common.x_option
    if x_option != XAxisOption.INDEX.value:
        return

    serial_processes = temp_serial_process or graph_param.common.serial_processes or []
    serial_columns = temp_serial_column or graph_param.common.serial_columns or []
    for proc_id, col_id in _iter_order_column_pairs(serial_processes, serial_columns):
        if proc_id and col_id:
            # The order columns may not be selected as plotted variables. Add them to graph_param
            # before get_data_from_db() so the fetched DataFrame contains the raw/ranked columns
            # that get_order_column_labels() and build_category_boundaries() read later.
            graph_param.add_proc_to_array_formval(int(proc_id), int(col_id))


def get_order_column_labels(graph_param: DicParam, df: pd.DataFrame) -> list[tuple[str, str]]:
    """Get DataFrame column labels selected in x-axis serial order modal."""
    order_labels: list[tuple[str, str]] = []
    serial_processes = graph_param.common.serial_processes or []
    serial_columns = graph_param.common.serial_columns or []

    for proc_id, col_id in _iter_order_column_pairs(serial_processes, serial_columns):
        if not proc_id or not col_id:
            continue

        proc_cfg = graph_param.dic_proc_cfgs.get(int(proc_id))
        if not proc_cfg:
            continue

        order_cols = proc_cfg.get_order_cols(column_name_only=False)
        dic_order_cols = {col.id: TIME_COL if col.is_get_date else col.bridge_column_name for col in order_cols}
        col_label = dic_order_cols.get(int(col_id))
        if col_label and col_label in df.columns and not any(sort_label == col_label for sort_label, _ in order_labels):
            display_label = gen_derived_column_name(RANK_COL, col_label)
            order_labels.append((col_label, display_label if display_label in df.columns else col_label))

    return order_labels


def normalize_category_value(value: Any) -> Any:
    """Normalize missing category values before equality checks and labels."""
    return None if pd.isna(value) else value


def count_unique_values(values: list[Any]) -> int:
    return int(pd.Series(values).nunique(dropna=False))


def build_category_tick_data(values: list[Any]) -> tuple[list[int], list[str]]:
    """Show only the first tick for each consecutive x-axis category value."""
    tickvals: list[int] = []
    ticktext: list[str] = []
    last_value = object()

    for idx, value in enumerate(values):
        normalized_value = normalize_category_value(value)
        if idx == 0 or normalized_value != last_value:
            tickvals.append(idx)
            ticktext.append('' if normalized_value is None else str(normalized_value))
            last_value = normalized_value

    return tickvals, ticktext


def is_aggregated_category_index_axis(
    x_option: str | None,
    category_aggregated: str | None,
    is_category: bool,
) -> bool:
    """Return whether equal category values must share one INDEX-axis coordinate."""
    return (
        is_category
        and str(x_option or '').upper() == XAxisOption.INDEX.value
        and category_aggregated == CATEGORY_AGGREGATE_MODE_AGGREGATED
    )


def build_aggregated_category_axis(
    values: list[Any],
) -> tuple[list[int], list[int], list[str], dict[Any, int]]:
    """Map equal categories to one coordinate in stable first-occurrence order."""
    coordinates: list[int] = []
    ticktext: list[str] = []
    coordinate_by_value: dict[Any, int] = {}

    for value in values:
        normalized_value = normalize_category_value(value)
        if normalized_value not in coordinate_by_value:
            coordinate_by_value[normalized_value] = len(coordinate_by_value)
            ticktext.append('' if normalized_value is None else str(normalized_value))
        coordinates.append(coordinate_by_value[normalized_value])

    return coordinates, list(range(len(ticktext))), ticktext, coordinate_by_value


def build_aggregated_category_trace_order(
    values: list[Any],
    coordinate_by_value: dict[Any, int],
) -> tuple[list[int], list[int]]:
    """Group equal X coordinates stably so their line segments are vertical."""
    coordinates = [coordinate_by_value[normalize_category_value(value)] for value in values]
    row_order = sorted(range(len(values)), key=coordinates.__getitem__)
    return row_order, [coordinates[index] for index in row_order]


def get_aggregated_category_representative_indexes(coordinates: list[int]) -> list[int]:
    """Return the first source row for each collapsed X coordinate."""
    first_indexes: dict[int, int] = {}
    for row_index, coordinate in enumerate(coordinates):
        first_indexes.setdefault(coordinate, row_index)
    return list(first_indexes.values())


def build_category_boundaries(df: pd.DataFrame, order_labels: list[tuple[str, str]]) -> list[dict[str, Any]]:
    """Build hierarchical category boundary metadata from sorted order columns.

    GC lines are disabled if any single level exceeds 128 distinct labels.
    This preserves readability of the axis and prevents overflowing tick labels.
    """
    boundaries: list[dict[str, Any]] = []
    total_label_count = 0

    for level, _ in enumerate(order_labels):
        indexes: list[int] = []
        labels: list[str] = []
        last_key: tuple[Any, ...] | None = None
        sort_labels = [sort_label for sort_label, _ in order_labels[: level + 1]]
        display_label = order_labels[level][1]

        for idx, raw_row in enumerate(df[sort_labels].itertuples(index=False, name=None)):
            row = tuple(normalize_category_value(value) for value in raw_row)
            if idx == 0 or row != last_key:
                indexes.append(idx)
                label = normalize_category_value(df.iloc[idx][display_label])
                labels.append('' if label is None else str(label))
                last_key = row

        total_label_count += len(labels)
        if total_label_count > MAX_INT_CAT_VALUE:
            return []

        boundaries.append({'level': level, 'indexes': indexes, 'labels': labels})

    return boundaries


@dataclass()
class XAxisContext:
    """Resolved X-axis metadata reused across plot responses."""

    col_id: int | None
    col_cfg: CfgProcessColumn | None
    title: str
    is_category: bool
    datatype: str
    is_numeric: bool
    default_array_x: list[Any]
    show_x_axis_with_index: bool
    use_aggregated_category_axis: bool

    def set_x_axis_with_index(self, show_x_axis_with_index: bool) -> None:
        if show_x_axis_with_index:
            self.show_x_axis_with_index = show_x_axis_with_index
            self.title = 'Index'


def _resolve_x_axis_context(layout_index: MAPLayoutIndex, df: pd.DataFrame, graph_param: DicParam) -> XAxisContext:
    """Resolve X-axis config and display metadata once."""
    x_axis_col_id = layout_index.get_x_axis()
    x_axis_col = graph_param.get_col_cfg(x_axis_col_id) if x_axis_col_id else None
    # Compute reusable X-axis metadata once instead of resolving the same config for every plot.

    is_category = bool(x_axis_col and x_axis_col.is_category)
    use_aggregated_category_axis = is_aggregated_category_index_axis(
        graph_param.common.x_option,
        graph_param.common.category_aggregated,
        is_category,
    )
    default_array_x, x_axis_title, show_x_axis_with_index = _resolve_default_x_values(df, graph_param, x_axis_col)
    return XAxisContext(
        col_id=int(x_axis_col_id) if x_axis_col_id else None,
        col_cfg=x_axis_col,
        title=x_axis_title,
        is_category=bool(x_axis_col and x_axis_col.is_category),
        datatype=str(x_axis_col.data_type),
        is_numeric=bool(
            x_axis_col
            and x_axis_col.data_type in [DataType.INTEGER.value, DataType.REAL.value, DataType.BIGINT.value]
            and not x_axis_col.is_category
        ),
        use_aggregated_category_axis=use_aggregated_category_axis,
        default_array_x=default_array_x,
        show_x_axis_with_index=show_x_axis_with_index,
    )


def _resolve_default_x_values(
    df: pd.DataFrame, graph_param: DicParam, col_cfg: CfgProcessColumn
) -> tuple[list[Any], str, bool]:
    """Resolve fallback X-axis values and title according to X-axis option."""
    x_values = get_data_from_cfg_column(df, col_cfg) if col_cfg and col_cfg.id else []
    unit = f' [{col_cfg.unit}]' if col_cfg.unit else ''
    x_axis_title = (
        f'{col_cfg.shown_name}{unit}'
        if col_cfg and (col_cfg.is_int_category or col_cfg.data_type in DataType.numeric_dtypes())
        else ''
    )
    show_x_axis_with_index = False

    match graph_param.common.x_option:
        case XAxisOption.TIME.value:
            return df['time'].tolist(), '', show_x_axis_with_index
        case XAxisOption.INDEX.value:
            # Preserve the previous behavior: switch to dataframe index when category cardinality is too large
            # or when the selected X column is not category-based.
            unique_x_value = count_unique_values(x_values)
            if not col_cfg or not col_cfg.is_category or unique_x_value > MAX_INT_CAT_VALUE:
                return df.index.tolist(), 'Index', True

    return x_values, x_axis_title, show_x_axis_with_index


def _build_x_binned_plot_groups(
    df: pd.DataFrame,
    x_axis_col: CfgProcessColumn,
    target_col: CfgProcessColumn,
    color_col: CfgProcessColumn | None = None,
    div_col: CfgProcessColumn | None = None,
) -> tuple[list[tuple[str | None, pd.DataFrame]], str]:
    """Aggregate X bins"""
    target_cols = [x_axis_col, target_col]

    # add div_col into df
    if div_col:
        target_cols.append(div_col)

    if color_col:
        target_cols.append(color_col)

    d = get_sub_df_by_col_ids(df, target_cols)[0][1]
    x_col = x_axis_col.label
    y_col = target_col.label
    if d.empty or x_col not in d.columns or y_col not in d.columns:
        return [], MAP_AGG_COUNT

    # X binning overwrites the X-axis column with the bin representative value.
    # get_sub_df_by_col_ids may prefer a before-rank/raw column for display, so restore
    # the binned X value here before grouping.
    d[x_col] = df.loc[d.index, x_col]

    x_min_col = 'x_min'
    x_max_col = 'x_max'
    x_bin_label_col = 'x_bin_label'
    if x_min_col in df.columns and x_max_col in df.columns:
        d[x_min_col] = df.loc[d.index, x_min_col]
        d[x_max_col] = df.loc[d.index, x_max_col]

    color_label = color_col.label if color_col and color_col.label in d.columns else None
    group_cols = [x_col, *([color_label] if color_label else [])]
    values = d[y_col]

    if is_datetime64_any_dtype(values) or target_col.data_type == DataType.DATETIME.name:
        datetime_values = pd.to_datetime(values, errors='coerce')
        if datetime_values.notna().any():
            seconds = datetime_values.sort_values().diff().dt.total_seconds()
            q1 = seconds.quantile(0.25)
            q3 = seconds.quantile(0.75)
            d['_value'] = seconds.where(seconds <= q3 + 3 * (q3 - q1), 0).fillna(0).reindex(d.index, fill_value=0)
            agg_mode = MAP_AGG_DURATION
            y_axis_title = f'duration({target_col.shown_name}) [s]'
        else:
            agg_mode = MAP_AGG_COUNT
            y_axis_title = MAP_AGG_COUNT
    elif is_numeric_dtype(values) or target_col.data_type in DataType.numeric_dtypes():
        d['_value'] = pd.to_numeric(values, errors='coerce')
        agg_mode = MAP_AGG_SUM
        y_axis_title = f'sum({target_col.shown_name})'
    else:
        agg_mode = MAP_AGG_COUNT
        y_axis_title = MAP_AGG_COUNT

    grouped = d.groupby(group_cols, dropna=False, sort=False)
    if agg_mode == MAP_AGG_COUNT:
        aggregated_df = grouped.size().reset_index(name=y_col)
    else:
        aggregated_df = grouped['_value'].sum().reset_index(name=y_col)

    if x_min_col in d.columns and x_max_col in d.columns:
        bin_ranges = grouped.agg(**{x_min_col: (x_min_col, 'min'), x_max_col: (x_max_col, 'max')}).reset_index()
        aggregated_df = aggregated_df.merge(bin_ranges, on=group_cols, how='left')
        bin_fmt = df.attrs.get('bin_x_fmt', '')
        aggregated_df[x_bin_label_col] = aggregated_df.apply(
            lambda row: _format_bin_value(row[x_min_col], bin_fmt)
            if _bin_edges_equal(row[x_min_col], row[x_max_col])
            else f'{_format_bin_value(row[x_min_col], bin_fmt)} ~ {_format_bin_value(row[x_max_col], bin_fmt)}',
            axis=1,
        )

    if not color_label:
        output_cols = [
            x_col,
            y_col,
            *([x_bin_label_col, x_min_col, x_max_col] if x_bin_label_col in aggregated_df.columns else []),
        ]
        return [('', aggregated_df[output_cols])], y_axis_title

    return [
        (
            group,
            group_df[
                [
                    x_col,
                    y_col,
                    *([x_bin_label_col, x_min_col, x_max_col] if x_bin_label_col in group_df.columns else []),
                ]
            ],
        )
        for group, group_df in aggregated_df.groupby(color_label, dropna=False, sort=False)
    ], y_axis_title


def _build_y_binned_plot_groups(
    df: pd.DataFrame,
    x_axis_col: CfgProcessColumn,
    target_col: CfgProcessColumn,
    div_col: CfgProcessColumn | None = None,
) -> list[tuple[str | None, pd.DataFrame]]:
    """Return count series grouped by equal-width Y bins."""
    target_cols = [x_axis_col, target_col]

    # add div_col into df
    if div_col:
        target_cols.append(div_col)

    source_df = get_sub_df_by_col_ids(df, target_cols)[0][1]
    if source_df.empty or x_axis_col.label not in source_df.columns or target_col.label not in source_df.columns:
        return []

    binned_df, bin_summary = make_bin(
        source_df,
        target_col.label,
        axis='y',
        bin_mode=MAP_BIN_MODE_WIDTH,
    )
    x_col = x_axis_col.label
    y_col = target_col.label
    y_bin_col = 'y'
    x_values = source_df[x_col].drop_duplicates().tolist()
    y_bins = (
        bin_summary[y_bin_col].tolist()
        if y_bin_col in bin_summary.columns
        else binned_df[y_bin_col].drop_duplicates().tolist()
    )

    counts = binned_df.groupby([x_col, y_bin_col], dropna=False, sort=False).size().reset_index(name='count')
    count_matrix = (
        counts.pivot(index=x_col, columns=y_bin_col, values='count').reindex(index=x_values, columns=y_bins).fillna(0)
    )
    label_map = binned_df.attrs.get('bin_y_label', {})
    bin_fmt = binned_df.attrs.get('bin_y_fmt', '')

    groups = []
    for y_bin in y_bins:
        if pd.isna(y_bin):
            group_name = next((label for key, label in label_map.items() if pd.isna(key)), 'NA')
        else:
            group_name = label_map.get(y_bin, _format_bin_value(y_bin, bin_fmt))
        groups.append(
            (
                group_name,
                pd.DataFrame({x_col: x_values, y_col: count_matrix[y_bin].astype(int).tolist()}),
            )
        )
    return groups


def _get_lab_values(
    df: pd.DataFrame,
    layout_index: MAPLayoutIndex,
    graph_param: DicParam,
    column_id: int,
) -> tuple[Any, list[Any] | None]:
    """Return subplot label values for primary plots."""
    lab_cfg = layout_index.resolve_lab(column_id)
    if not lab_cfg.lab_id:
        return None, []

    lab_col = graph_param.get_col_cfg(lab_cfg.lab_id)
    if not lab_col:
        return None, []

    lab_values = get_data_from_cfg_column(df, lab_col)
    return lab_col, [str(value) if value is not None else '' for value in lab_values]


def _resolve_category_hover_columns(graph_param: DicParam) -> list[tuple[str, str]]:
    """Return selected category columns as (df_label, column_name) from GET02_CATE_SELECT."""
    hover_columns: list[tuple[str, str]] = []
    seen_col_ids: set[int] = set()
    for cate_proc in graph_param.common.cate_procs or []:
        for col_id in cate_proc.col_ids:
            if col_id in seen_col_ids:
                continue
            col_cfg = graph_param.get_col_cfg(col_id)
            if not col_cfg:
                continue
            hover_columns.append((col_cfg.label, col_cfg.shown_name))
            seen_col_ids.add(col_id)
    return hover_columns


def _format_hover_value(value: Any) -> str:
    if pd.isna(value):
        return ''
    if isinstance(value, pd.Timestamp):
        return value.strftime('%Y-%m-%d %H:%M:%S')
    return str(value)


def _build_category_hover_values(
    df: pd.DataFrame,
    hover_columns: list[tuple[str, str]],
) -> list[str] | None:
    """Build per-point hover lines in format 'column_name = value' for selected category columns."""
    if df.empty or not hover_columns:
        return None

    resolved_columns: list[tuple[str, list[str]]] = []
    for df_label, column_name in hover_columns:
        if df_label not in df.columns:
            continue
        values = [_format_hover_value(value) for value in df[df_label].tolist()]
        resolved_columns.append((column_name, values))

    if not resolved_columns:
        return None

    row_count = len(df)
    hover_values: list[str] = []
    for index in range(row_count):
        row_values = [f'{column_name} = {values[index]}' for column_name, values in resolved_columns]
        hover_values.append('<br>'.join(row_values))

    return hover_values


def _build_step_overlay_mask(array_y: list[Any], overlay_type: str | None) -> np.ndarray | None:
    if overlay_type != OverlayEnum.STEP.value:
        return None
    if len(array_y) <= 1:
        return np.asarray([True] * len(array_y))

    y_values = np.asarray(array_y)
    change = np.concatenate(([True], y_values[1:] != y_values[:-1]))
    return change | np.concatenate((change[1:], [True]))


def _apply_step_overlay_to_values(
    values: list[Any] | None,
    source_y: list[Any],
    overlay_type: str | None,
) -> list[Any] | None:
    if values is None:
        return None

    mask = _build_step_overlay_mask(source_y, overlay_type)
    if mask is None or len(values) != len(mask):
        return values
    return np.asarray(values, dtype=object)[mask].tolist()


def _apply_step_overlay(
    array_x: list[Any], array_y: list[Any], overlay_type: str | None
) -> tuple[list[Any], list[Any]]:
    """Reduce Y values for step overlay while preserving current behavior."""
    mask = _build_step_overlay_mask(array_y, overlay_type)
    if mask is None:
        return array_x, array_y

    final_array_y = np.asarray(array_y)[mask].tolist()
    final_array_x = np.asarray(array_x)[mask].tolist()
    return final_array_x, final_array_y


def _get_plot_style(array_y: list[Any]) -> tuple[float, float]:
    """Calculate marker size and line width from non-null point count."""
    # Use a generator instead of building an intermediate list just to count non-null points.
    not_na_count = sum(value is not None for value in array_y)
    return marker_size_from_n(not_na_count), line_width_from_n(not_na_count)


def _is_numeric_plot_column(col_cfg: CfgProcessColumn) -> bool:
    """Check if a plot column supports numeric behaviors such as log scale."""
    return not col_cfg.is_int_category and col_cfg.data_type in DataType.numeric_dtypes()


def _build_plot_groups(
    df: pd.DataFrame,
    x_axis_col: CfgProcessColumn,
    target_col: CfgProcessColumn,
    color_col: CfgProcessColumn | None = None,
    lab_col: CfgProcessColumn | None = None,
    is_color_imb: bool = False,
    div_col: CfgProcessColumn | None = None,
    hover_cols: list[CfgProcessColumn] | None = None,
) -> list[tuple[str | None, pd.DataFrame]]:
    """Return plot data frames grouped by color if configured."""
    # Normalize both colored and non-colored plots into the same iterable shape so response building
    # can follow a single code path.
    target_cols = [x_axis_col, target_col]
    if lab_col:
        target_cols.append(lab_col)
    if div_col:
        target_cols.append(div_col)
    if hover_cols:
        target_cols.extend(hover_cols)
    if color_col:
        target_cols.append(color_col)
        group_dfs = get_sub_df_by_col_ids(df, target_cols, color_by=str(color_col.label))

        # compute ratio if primary is numeric only
        # Use absolute values so negative numbers are not treated as small values.
        max_abs_value = df[target_col.label].abs().max() if target_col.data_type in DataType.numeric_dtypes() else None
        if is_color_imb and max_abs_value:
            for group_name, group_df in group_dfs:
                group_df[RATIO_COLUMN_NAME] = group_df[target_col.label].abs() / max_abs_value
        return group_dfs
    return get_sub_df_by_col_ids(df, target_cols)


def _limit_top_categories(
    group_dfs: list[tuple[str | None, pd.DataFrame]],
    top_n: int,
) -> list[tuple[str | None, pd.DataFrame]]:
    """Keep the top N categories by data count and merge the rest into a single "Others" group.

    Ties are broken by the earliest record (df is sorted by datetime, so a smaller index is earlier).
    "Others" keeps every data point of the remaining categories and is placed first so it shows
    at the top of the legend. The top N keep their original order to keep colors stable.
    """
    if len(group_dfs) <= top_n:
        return group_dfs

    ranked = sorted(group_dfs, key=lambda item: (-len(item[1]), item[1].index.min()))
    kept_groups = {group_name for group_name, _ in ranked[:top_n]}

    top_frames = [item for item in group_dfs if item[0] in kept_groups]
    other_frames = [group_df for group_name, group_df in group_dfs if group_name not in kept_groups]
    if not other_frames:
        return top_frames

    others_df = pd.concat(other_frames).sort_index()
    return [(OTHERS_GROUP_NAME, others_df), *top_frames]


def _attach_data_point_index(
    source_df: pd.DataFrame,
    group_dfs: list[tuple[str | None, pd.DataFrame]],
) -> list[tuple[str | None, pd.DataFrame]]:
    """Attach original sorted indexes to grouped data frames after category grouping changes."""
    if MAP_DATA_POINT_INDEX_COL not in source_df.columns:
        return group_dfs

    return [
        (
            color_group,
            group_df.assign(
                **{MAP_DATA_POINT_INDEX_COL: source_df.loc[group_df.index, MAP_DATA_POINT_INDEX_COL].to_numpy()}
            ),
        )
        for color_group, group_df in group_dfs
    ]


def _build_plot_response(
    *,
    target_col: CfgProcessColumn,
    overlay_type: str | None,
    plot_no: int | str | None,
    is_x_axis: bool,
    x_axis_title: str,
    x_axis_datatype: str,
    x_axis_numeric: bool,
    x_process_name: str,
    labels: list[str] | None,
    x_axis_category: bool,
    array_x: list[Any],
    array_y: list[Any],
    is_numeric_dtype: bool,
    color_group: str | None = None,
    color_shown_name: str | None = None,
    is_global_color: bool = False,
    facet_group: str | None = None,
    category_boundaries: list[dict[str, Any]] | None = None,
    x_axis_tickvals: list[Any] | None = None,
    x_axis_ticktext: list[str] | None = None,
    y_axis_title_override: str | None = None,
    is_datetime_label: bool = False,
    is_color_imb_group: bool = False,
    is_x_axis_binned: bool = False,
    is_y_axis_binned: bool = False,
    x_bin_labels: list[str] | None = None,
    x_bin_mins: list[Any] | None = None,
    x_bin_maxs: list[Any] | None = None,
    category_hover_values: list[str] | None = None,
    encoded_x_values: bool = False,
    is_sort_by_data_order: bool = False,
    y_fmt: str = '',
    div_group: str | None = None,
    original_array_x: list[Any] | None = None,
    show_x_axis_with_index: bool = False,
) -> dict[str, Any]:
    """Build a serialized MAP response for one plot/group."""
    # Centralize MAPDataResponse creation so all plot variants share the same serialization logic.
    marker_size, line_width = _get_plot_style(array_y)
    is_log_scale_available = determine_log_scale_mode(YScaleModes.AUTO, array_y) if is_numeric_dtype else False
    unit = f' [{target_col.unit}]' if target_col.unit else ''
    target_name = f'{target_col.shown_name}{unit}'

    # set y title for subplots
    y_axis_title = (
        y_axis_title_override
        if y_axis_title_override
        else f'{target_col.shown_name} (CT) [sec]'
        if target_col.is_get_date
        else target_name
    )
    # Facet (Lv1/Lv2) label is rendered separately (top-left of the subplot),
    # not mixed into the y-axis title/primary variable name.
    facet_label = facet_group or None

    name = target_name
    if color_group:
        # Per-subplot color (iColor/iColImb) needs the column name because each subplot can use a
        # different color column. A shared color uses the same column everywhere, so the value alone is enough.
        name = f'{name}|{color_group}' if color_shown_name and not is_global_color else color_group
    if div_group:
        # do not add div name in case of grouped by color
        if not color_group:
            name += f'|{div_group}'
        y_axis_title += f'|{div_group}'

    return MAPDataResponse(
        key=target_col.column_name,
        array_x=array_x,
        array_y=array_y,
        name=str(name),
        end_col_id=target_col.id,
        plot_no=plot_no,
        is_xaxis=is_x_axis,
        x_axis_title=x_axis_title,
        text=labels,
        class_=overlay_type,
        is_log_scale_available=is_log_scale_available,
        marker_size=marker_size,
        line_width=line_width,
        is_numeric_dtype=is_numeric_dtype,
        is_xaxis_category=x_axis_category,
        x_axis_numeric=x_axis_numeric,
        x_axis_datatype=x_axis_datatype,
        x_process_name=x_process_name,
        y_process_name=target_col.cfg_process.shown_name,
        color_group=color_group,
        legend_group='',
        category_boundaries=category_boundaries,
        x_axis_tickvals=x_axis_tickvals,
        x_axis_ticktext=x_axis_ticktext,
        y_axis_title=y_axis_title,
        facet_label=facet_label,
        is_datetime_label=is_datetime_label,
        is_color_imb_group=is_color_imb_group,
        is_x_axis_binned=is_x_axis_binned,
        is_y_axis_binned=is_y_axis_binned,
        x_bin_labels=x_bin_labels,
        x_bin_mins=x_bin_mins,
        x_bin_maxs=x_bin_maxs,
        category_hover_values=category_hover_values,
        encoded_x_values=encoded_x_values,
        is_sort_by_data_order=is_sort_by_data_order,
        y_fmt=y_fmt,
        y_axis_category=target_col.is_category or target_col.is_int_category,
        original_array_x=original_array_x,
        show_x_axis_with_index=show_x_axis_with_index,
    ).model_dump(by_alias=True)


def verify_xaxis_need_to_encoded(x_option: str, is_category: bool) -> bool:
    """Verify a x variable need to encoded to show in x-axis"""
    return is_category and x_option in [
        XAxisOption.INDEX.value,
        XAxisOption.CAT_VALUE.value,
    ]


def _count_map_primaries(layout: MAPLayoutRequest | dict[str, Any] | None) -> int:
    """Return how many primary subplots the MAP layout actually draws.

    Div sizing must be derived from the layout, not from the number of checked End Proc
    variables: the X-axis / Lab / Color variables are checked columns too, so counting
    checkboxes over-counts the primaries and silently disables Div2/Div3/Div6.
    Subplots are keyed by `order` because that value is what becomes `plot_no`.
    """
    if not layout:
        return 0
    layout_request = layout if isinstance(layout, MAPLayoutRequest) else MAPLayoutRequest.model_validate(layout)
    return len({sub_plot.order for sub_plot in layout_request.sub_plots})


def _resolve_map_div_size(graph_param: DicParam, num_primaries: int | None = None) -> int | None:
    """Return the effective Div sub-panel count (2, 3, or 6) for the current selection,
    or None if Div isn't active (no column selected, invalid size, or too many primary
    subplots for the requested size to fit within the 6-subplot cap)."""
    if not graph_param.common.div_by_cat:
        return None
    requested_div_size = graph_param.common.div_size or MAP_DEFAULT_DIV_SIZE
    if requested_div_size not in MAP_VALID_DIV_SIZES:
        return None
    if num_primaries is None:
        num_primaries = _count_map_primaries(graph_param.common.layout)
    max_primaries_for_div = MAP_MAX_SUB_PLOTS // requested_div_size
    if not num_primaries or num_primaries > max_primaries_for_div:
        return None
    return requested_div_size


def _has_div_column_data(df: pd.DataFrame, div_col: CfgProcessColumn) -> bool:
    """Check that the Div column was actually fetched together with the graph data.

    get_sub_df_by_col_ids() prefers the `before_rank_values_*` markup column when a categorical
    column was rank-encoded, so either name means the Div values are usable.
    """
    label = str(div_col.label)
    return label in df.columns or gen_derived_column_name(RANK_COL, label) in df.columns


def get_flatten_data(
    df: pd.DataFrame,
    graph_param: DicParam,
    layout_index: MAPLayoutIndex | None = None,
    force_index_xaxis: bool = False,
    show_labels: bool = True,
) -> list[dict[str, Any]]:
    """Gen flatten data for all subplots."""
    if not graph_param.common.layout:
        return []

    layout_request = MAPLayoutRequest.model_validate(graph_param.common.layout)
    y_bin_mode = layout_request.y_axis_mode in MAP_Y_AXIS_BIN_MODES
    if force_index_xaxis:
        y_bin_mode = False
    layout_index = layout_index or build_map_layout_index(layout_request)
    # Resolve X-axis data once because every subplot reuses the same X-axis metadata.
    x_axis = _resolve_x_axis_context(layout_index, df, graph_param)

    if force_index_xaxis and MAP_DATA_POINT_INDEX_COL in df.columns:
        x_axis = replace(
            x_axis,
            default_array_x=df[MAP_DATA_POINT_INDEX_COL].tolist(),
        )
        x_axis.set_x_axis_with_index(True)
    x_bin_mode = {
        MAP_EQUAL_FREQ_BIN_OPTION: MAP_BIN_MODE_COUNT,
        MAP_EQUAL_WIDTH_BIN_OPTION: MAP_BIN_MODE_WIDTH,
    }.get(graph_param.common.x_option)
    if x_axis.datatype == DataType.DATETIME.name and graph_param.common.x_option != XAxisOption.TIME.value:
        x_bin_mode = None
    if force_index_xaxis:
        x_bin_mode = None
    if x_bin_mode and x_axis.col_cfg:
        pass

    if not x_axis.col_cfg:
        return []
    selected_category_hover_columns = _resolve_category_hover_columns(graph_param)
    selected_category_hover_col_cfgs = []
    selected_category_hover_col_ids: set[int] = set()
    for cate_proc in graph_param.common.cate_procs or []:
        for col_id in cate_proc.col_ids:
            if col_id in selected_category_hover_col_ids:
                continue
            col_cfg = graph_param.get_col_cfg(col_id)
            if not col_cfg:
                continue
            selected_category_hover_col_cfgs.append(col_cfg)
            selected_category_hover_col_ids.add(col_id)

    facet_cols = graph_param.common.cat_exp or []
    facet_cols_cfg = graph_param.get_col_cfgs([int(_col_id) for _col_id in facet_cols if _col_id])
    facet_cols_label = [
        gen_derived_column_name(RANK_COL, str(col.label))
        if gen_derived_column_name(RANK_COL, str(col.label)) in df.columns
        else col.label
        for col in facet_cols_cfg
        if col
    ]

    faceted_data = []
    dfs = [('', df)]
    if facet_cols_label:
        dfs = [(_facet_group, _df) for _facet_group, _df in df.groupby(facet_cols_label)]

    div_by_cat = None
    div_col = None
    div_size = _resolve_map_div_size(graph_param, _count_map_primaries(layout_request))
    if div_size:
        div_col = graph_param.get_col_cfg(graph_param.common.div_by_cat)
    # Keep this fallback aligned with gen_map_data(), which reports the same decision to the
    # frontend through `div_size`; both sides must agree on whether Div is applied.
    if div_col is not None and _has_div_column_data(df, div_col):
        div_by_cat = div_col.label
    else:
        div_col = None
        div_size = MAP_DEFAULT_DIV_SIZE
    for _facet_group, _df in dfs:
        _df = _df.reset_index(drop=True)
        if x_bin_mode:
            if x_axis.datatype == DataType.DATETIME.name:
                _df[x_axis.col_cfg.label] = pd.to_datetime(_df[x_axis.col_cfg.label], errors='coerce')
            _df, _ = make_bin(_df, x_axis.col_cfg.label, axis='x', bin_mode=x_bin_mode)
            _df[x_axis.col_cfg.label] = _df['x']

        facet_group_name = '|'.join(map(str, _facet_group))
        x_values = get_data_from_cfg_column(_df, x_axis.col_cfg) if x_axis.col_cfg and x_axis.col_id else []
        # x_values = (
        #     get_data_from_column_id(_df, str(x_axis.col_cfg.column_name), x_axis.col_id)
        #     if x_axis.col_cfg and x_axis.col_id
        #     else []
        # )
        aggregated_x_values: list[int] = []
        aggregated_coordinate_by_value: dict[Any, int] = {}
        aggregated_tickvals: list[int] = []
        aggregated_ticktext: list[str] = []
        if x_axis.use_aggregated_category_axis:
            (
                aggregated_x_values,
                aggregated_tickvals,
                aggregated_ticktext,
                aggregated_coordinate_by_value,
            ) = build_aggregated_category_axis(x_values)
        is_large_data_point_xaxis = len(_df) > MAP_CATEGORY_INDEX_DISPLAY_THRESHOLD
        is_sort_by_data_order = graph_param.common.x_option.upper() == XAxisOption.DATA_VALUE.value
        order_column_labels = get_order_column_labels(graph_param, _df)
        is_xaxis_available_to_encode = verify_xaxis_need_to_encoded(graph_param.common.x_option, x_axis.is_category)
        # Div's "common x-axis": when Div is active and the x-axis is Cat Value, every Div
        # sub-panel must position its point on the SAME axis — built from every distinct x-axis
        # category value across the whole facet (not just the values belonging to that one Div
        # sub-panel) — so sub-panels can be visually compared by x position, not merely by index
        # count. Original order is intentionally excluded: it already shows each row's true
        # absolute position, so a "global" axis there would mean 0..(dataset size), not this.
        use_global_div_category_axis = (
            bool(div_by_cat)
            and graph_param.common.x_option == XAxisOption.CAT_VALUE.value
            and not force_index_xaxis
            and x_axis.col_cfg is not None
        )
        global_category_position: dict[Any, int] = {}
        global_category_tickvals: list[int] = []
        global_category_ticktext: list[str] = []
        if use_global_div_category_axis:
            # Read via get_data_from_cfg_column(), not _df[x_axis.col_cfg.label] directly — for a
            # rank-encoded categorical column, the raw column holds rank codes, not display text;
            # the real values only live under the column's before_rank markup counterpart,
            # which this helper already knows to prefer.
            global_category_source = get_data_from_cfg_column(_df, x_axis.col_cfg) if x_axis.col_cfg.id else []
            global_categories = sorted({value for value in global_category_source if value is not None})
            # Fall back to each sub-panel's own compact axis if the whole facet has too many
            # distinct categories — same cutoff already used for the per-panel encoding below,
            # so a huge combined axis doesn't silently replace it with something unreadable.
            if len(global_categories) >= ColorCategoryLimit.UNIQUE_DATA_PER_COLOR.value:
                use_global_div_category_axis = False
            else:
                global_category_position = {value: idx for idx, value in enumerate(global_categories)}
                global_category_tickvals = list(range(len(global_categories)))
                global_category_ticktext = [str(value) for value in global_categories]
        is_xaxis_as_cat_ordering = graph_param.common.x_option == XAxisOption.INDEX.value and x_axis.is_category
        is_datetime_as_index_ordering = (
            x_axis.datatype == DataType.DATETIME.name and graph_param.common.x_option != XAxisOption.TIME.value
        )
        is_xaxis_as_grid_ordering = is_xaxis_as_cat_ordering or is_datetime_as_index_ordering
        x_axis.set_x_axis_with_index(
            not x_axis.show_x_axis_with_index
            and is_large_data_point_xaxis
            and is_xaxis_as_grid_ordering
            and graph_param.common.x_option in [XAxisOption.INDEX.value, XAxisOption.CAT_VALUE.value]
        )
        use_category_boundary_axis = (
            not force_index_xaxis
            and is_xaxis_as_grid_ordering
            and not x_bin_mode
            and not y_bin_mode
            and bool(order_column_labels)
            and count_unique_values(x_values) <= MAX_INT_CAT_VALUE
        )
        boundary_df = _df
        if x_axis.use_aggregated_category_axis:
            representative_indexes = get_aggregated_category_representative_indexes(aggregated_x_values)
            boundary_df = _df.iloc[representative_indexes].reset_index(drop=True)
        category_boundaries = (
            build_category_boundaries(boundary_df, order_column_labels) if use_category_boundary_axis else []
        )

        # should_use_index_for_xaxis: force use as index
        should_use_index_for_xaxis = (
            not force_index_xaxis
            and is_xaxis_as_grid_ordering
            and len(set(x_values)) >= ColorCategoryLimit.UNIQUE_DATA_PER_COLOR.value
        )

        if x_axis.use_aggregated_category_axis:
            x_axis_tickvals, x_axis_ticktext = aggregated_tickvals, aggregated_ticktext
        else:
            x_axis_tickvals, x_axis_ticktext = (
                build_category_tick_data(x_values)
                if (use_category_boundary_axis and category_boundaries)
                or should_use_index_for_xaxis
                or (is_sort_by_data_order and not is_large_data_point_xaxis)
                else (None, None)
            )
        use_category_boundary_axis = bool(category_boundaries)
        response_x_axis_category = False if force_index_xaxis else x_axis.is_category or use_category_boundary_axis
        plot_data: list[dict[str, Any]] = []
        encoded_x_values = x_axis.use_aggregated_category_axis
        for col_id in layout_index.get_map_cols():
            target_col = graph_param.get_col_cfg(col_id)
            if not target_col:
                continue

            overlay_type = layout_index.get_overlay_type(col_id)
            # to add label column into output plot data
            lab_col, labels = None, None
            is_datetime_label = False
            if show_labels and overlay_type == CommonLayoutEnum.PRIMARY.value and not x_bin_mode and not y_bin_mode:
                lab_col, labels = _get_lab_values(_df, layout_index, graph_param, col_id)
                # use to convert datetime label to localtime in frontend
                is_datetime_label = lab_col.data_type == DataType.DATETIME.name if lab_col else False

            color_cfg = layout_index.resolve_color(col_id)
            color_col = graph_param.get_col_cfg(color_cfg.color_id) if color_cfg.color_id else None

            # group data with target column (main/sub/add), label/step, color
            agg_y_axis_title = None
            is_numeric_dtype = True if x_bin_mode or y_bin_mode else _is_numeric_plot_column(target_col)
            if y_bin_mode:
                grouped_frames = _build_y_binned_plot_groups(
                    _df, x_axis.col_cfg, target_col=target_col, div_col=div_col
                )
                agg_y_axis_title = MAP_AGG_COUNT
                labels = None
                is_datetime_label = False
            elif x_bin_mode:
                grouped_frames, agg_y_axis_title = _build_x_binned_plot_groups(
                    _df, x_axis.col_cfg, target_col=target_col, color_col=color_col, div_col=div_col
                )
            else:
                grouped_frames = _build_plot_groups(
                    _df,
                    x_axis.col_cfg,
                    target_col=target_col,
                    lab_col=lab_col,
                    color_col=color_col,
                    is_color_imb=color_cfg.is_color_imb,
                    div_col=div_col,
                    hover_cols=selected_category_hover_col_cfgs,
                )
            plot_no = layout_index.get_plot_no(col_id)
            is_x_axis = layout_index.is_x_axis(col_id)

            original_array_x = []
            if not grouped_frames:
                # Keep a safe fallback for unexpected empty slices without duplicating response-building logic.
                if x_axis.use_aggregated_category_axis:
                    fallback_array_x = aggregated_x_values
                elif use_category_boundary_axis:
                    fallback_array_x = _df.index.tolist()
                    original_array_x = x_axis.default_array_x
                elif force_index_xaxis and MAP_DATA_POINT_INDEX_COL in _df.columns:
                    fallback_array_x = _df[MAP_DATA_POINT_INDEX_COL].tolist()
                elif x_bin_mode:
                    fallback_array_x = _df[x_axis.col_cfg.label].drop_duplicates().tolist()
                else:
                    fallback_array_x = x_axis.default_array_x

                plot_data.append(
                    _build_plot_response(
                        target_col=target_col,
                        overlay_type=overlay_type,
                        plot_no=plot_no,
                        is_x_axis=is_x_axis,
                        x_axis_title=x_axis.title,
                        labels=labels,
                        x_axis_category=response_x_axis_category,
                        x_axis_datatype=DataType.INTEGER.name if force_index_xaxis else x_axis.datatype,
                        x_axis_numeric=True if force_index_xaxis else x_axis.is_numeric,
                        array_x=fallback_array_x,
                        array_y=[],
                        is_numeric_dtype=is_numeric_dtype,
                        facet_group=facet_group_name,
                        category_boundaries=category_boundaries or None,
                        x_axis_tickvals=x_axis_tickvals,
                        x_axis_ticktext=x_axis_ticktext,
                        x_process_name=str(x_axis.col_cfg.cfg_process.shown_name),
                        is_datetime_label=is_datetime_label,
                        is_x_axis_binned=bool(x_bin_mode),
                        is_y_axis_binned=y_bin_mode,
                        encoded_x_values=x_axis.use_aggregated_category_axis,
                        is_sort_by_data_order=is_sort_by_data_order,
                        original_array_x=original_array_x,
                        show_x_axis_with_index=x_axis.show_x_axis_with_index,
                    )
                )
                continue

            # Show only the top N categories: 16 for a shared color, 8 for a per-subplot color.
            # Categories outside the top N are dropped.
            if color_col:
                top_n = (
                    ColorCategoryLimit.GLOBAL.value
                    if color_cfg.is_global_color
                    else ColorCategoryLimit.PER_SUBPLOT.value
                )
                grouped_frames = _limit_top_categories(grouped_frames, top_n)
            if force_index_xaxis:
                grouped_frames = _attach_data_point_index(_df, grouped_frames)

            # Limit ColImb ≤ MAX_AXES secondary axes per subplot.
            # Retain the groups with the greatest skew (lowest P90 ratio); the remainder fall to the primary axis.
            imbalanced_groups: set = set()
            if color_cfg.is_color_imb and not x_bin_mode and not y_bin_mode:
                candidates = []
                for _color_group, _sub_df in grouped_frames:
                    # "Others" is a merged bucket, not a real category, so it stays on the primary axis.
                    if _color_group == OTHERS_GROUP_NAME:
                        continue
                    if RATIO_COLUMN_NAME in _sub_df.columns:
                        q = _sub_df[RATIO_COLUMN_NAME].quantile(ColorImbThreshold.PERCENTILE.value)
                        if q < ColorImbThreshold.THRESHOLD.value:
                            candidates.append((_color_group, q))
                candidates.sort(key=lambda item: item[1])  # Smallest ratio = most skewed
                imbalanced_groups = {g for g, _ in candidates[: ColorImbThreshold.MAX_AXES.value]}

            for color_group, _sub_df in grouped_frames:
                if div_by_cat:
                    # All div_size slots are distinct category values for this primary — no slot
                    # is reserved for the full/overall (unfiltered) data anymore.
                    grouped_by_div = [(div_name, div_df) for (div_name, div_df) in _sub_df.copy().groupby(div_by_cat)]
                    # Keep the div_size groups with the most data points (ties broken by whichever
                    # appears earliest), and display them in that same most-to-least order — so the
                    # first panel is always the family with the most data, not simply the first
                    # alphabetically.
                    sub_dfs = sorted(
                        grouped_by_div,
                        key=lambda item: (-len(item[1]), item[1].index.min()),
                    )[:div_size]
                else:
                    sub_dfs = [('', _sub_df.copy())]

                for idx, (div_name, div_df) in enumerate(sub_dfs):
                    # cap at div_size sub-panels per primary (2 for Div2, 3 for Div3, 6 for Div6)
                    if div_by_cat and idx >= div_size:
                        continue
                    sub_df = div_df.copy()
                    # order df by category column in CAT_VALUE mode
                    if graph_param.common.x_option == XAxisOption.CAT_VALUE.value and not force_index_xaxis:
                        sub_df = sub_df.sort_values(by=[x_axis.col_cfg.label])
                    if force_index_xaxis and MAP_DATA_POINT_INDEX_COL in sub_df.columns:
                        array_x = sub_df[MAP_DATA_POINT_INDEX_COL].tolist()
                    elif x_axis.use_aggregated_category_axis:
                        aggregated_row_order, array_x = build_aggregated_category_trace_order(
                            sub_df[x_axis.col_cfg.label].tolist(),
                            aggregated_coordinate_by_value,
                        )
                        sub_df = sub_df.iloc[aggregated_row_order]
                    elif use_category_boundary_axis or is_sort_by_data_order or is_xaxis_as_grid_ordering:
                        array_x = sub_df.index.tolist()
                        original_array_x = sub_df[x_axis.col_cfg.label].tolist()
                    else:
                        array_x = sub_df[x_axis.col_cfg.label].tolist()
                    source_array_y = sub_df[target_col.label].tolist()
                    category_hover_values = None
                    if not x_bin_mode and not y_bin_mode:
                        category_hover_values = _build_category_hover_values(sub_df, selected_category_hover_columns)

                    array_x, array_y = _apply_step_overlay(array_x, source_array_y, overlay_type)
                    category_hover_values = _apply_step_overlay_to_values(
                        category_hover_values,
                        source_array_y,
                        overlay_type,
                    )
                    x_bin_labels = (
                        sub_df['x_bin_label'].tolist()
                        if x_bin_mode and 'x_bin_label' in sub_df.columns and len(sub_df) == len(array_y)
                        else None
                    )
                    x_bin_mins = (
                        sub_df['x_min'].tolist()
                        if x_bin_mode and 'x_min' in sub_df.columns and len(sub_df) == len(array_y)
                        else None
                    )
                    x_bin_maxs = (
                        sub_df['x_max'].tolist()
                        if x_bin_mode and 'x_max' in sub_df.columns and len(sub_df) == len(array_y)
                        else None
                    )

                    # do not apply color limitation for Grid mode
                    if (
                        not force_index_xaxis
                        and not use_category_boundary_axis
                        and not x_axis.show_x_axis_with_index
                        and is_xaxis_available_to_encode
                        and not (is_large_data_point_xaxis and (is_sort_by_data_order or is_xaxis_as_grid_ordering))
                    ):
                        is_x_group_over_limitation = (
                            sub_df[x_axis.col_cfg.label].nunique() >= ColorCategoryLimit.UNIQUE_DATA_PER_COLOR.value
                        )
                        if use_global_div_category_axis:
                            # Position on the shared, whole-facet category axis instead of encoding
                            # (factorizing) each Div sub-panel's own categories independently — that
                            # would give every sub-panel its own compact 0..n positions and lose the
                            # ability to compare x position across sub-panels.
                            array_x = sub_df[x_axis.col_cfg.label].map(global_category_position).tolist()
                            x_axis_tickvals, x_axis_ticktext = global_category_tickvals, global_category_ticktext
                            encoded_x_values = True
                        # if x_option=INDEX, use index instead of datetime for array_x
                        elif is_x_group_over_limitation:
                            array_x, _ = build_category_tick_data(array_x)
                            x_axis.set_x_axis_with_index(True)
                        else:
                            # encode category value to show original value of x_axis
                            array_x, _ = pd.factorize(sub_df[x_axis.col_cfg.label])
                            array_x = array_x.tolist()
                            x_axis_tickvals, x_axis_ticktext = (
                                array_x,
                                sub_df[x_axis.col_cfg.label].astype(str).tolist(),
                            )
                            encoded_x_values = True

                    # overwrite labels for sub trace
                    if (
                        show_labels
                        and overlay_type == CommonLayoutEnum.PRIMARY.value
                        and not x_bin_mode
                        and not y_bin_mode
                    ):
                        lab_col, labels = _get_lab_values(sub_df, layout_index, graph_param, col_id)
                        # use to convert datetime label to localtime in frontend
                        is_datetime_label = lab_col.data_type == DataType.DATETIME.name if lab_col else False
                    elif not show_labels:
                        labels = None
                        is_datetime_label = False

                    # detect color group is imbalanced
                    is_imbalanced_color = color_group in imbalanced_groups

                    # At this point both color and non-color paths share the exact same response assembly.
                    plot_data.append(
                        _build_plot_response(
                            target_col=target_col,
                            overlay_type=overlay_type,
                            plot_no=plot_no if not div_by_cat else ((plot_no - 1) * div_size + idx + 1),
                            is_x_axis=is_x_axis,
                            x_axis_title=x_axis.title,
                            labels=labels,
                            x_axis_category=response_x_axis_category,
                            x_axis_datatype=DataType.INTEGER.name if force_index_xaxis else x_axis.datatype,
                            x_axis_numeric=True if force_index_xaxis else x_axis.is_numeric,
                            array_x=array_x,
                            array_y=array_y,
                            is_numeric_dtype=is_numeric_dtype,
                            color_group=str(color_group) if color_group is not None else None,
                            color_shown_name=color_col.shown_name if color_col else None,
                            is_global_color=color_cfg.is_global_color,
                            facet_group=facet_group_name,
                            category_boundaries=category_boundaries or None,
                            x_axis_tickvals=x_axis_tickvals,
                            x_axis_ticktext=x_axis_ticktext,
                            y_axis_title_override=agg_y_axis_title,
                            x_process_name=str(x_axis.col_cfg.cfg_process.shown_name),
                            is_datetime_label=is_datetime_label,
                            is_color_imb_group=is_imbalanced_color,
                            is_x_axis_binned=bool(x_bin_mode),
                            is_y_axis_binned=y_bin_mode,
                            x_bin_labels=x_bin_labels,
                            x_bin_mins=x_bin_mins,
                            x_bin_maxs=x_bin_maxs,
                            category_hover_values=category_hover_values,
                            encoded_x_values=encoded_x_values,
                            is_sort_by_data_order=is_sort_by_data_order,
                            y_fmt=get_fmt_from_array(array_y),
                            div_group=div_name if div_by_cat else None,
                            original_array_x=original_array_x,
                            show_x_axis_with_index=x_axis.show_x_axis_with_index,
                        )
                    )
        faceted_data.append(plot_data)
    return faceted_data


@log_execution_time('[TRACE MAP DATA]')
@request_timeout_handling()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.MAP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def gen_map_data(graph_param, dic_param, df=None):
    """Generate MAP tracing data"""
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        temp_serial_column,
        temp_serial_order,
        temp_serial_process,
        temp_x_option,
        temp_category_aggregated,
        y_scale_mode,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    dic_proc_cfgs = graph_param.dic_proc_cfgs

    if graph_param.common.div_by_cat:
        graph_param.add_column_to_array_formval([graph_param.common.div_by_cat])
    # The frontend grid is (num_primaries x div_size), so both values must describe the layout's
    # primary subplots. Counting selected end columns here would include the X-axis/Lab/Color
    # variables and break both the Div availability check and the subplot grid.
    num_primaries = _count_map_primaries(graph_param.common.layout)
    dic_param[MAP_DIV_SIZE] = _resolve_map_div_size(graph_param, num_primaries)
    dic_param[MAP_NUM_PRIMARIES] = num_primaries
    dic_param[MAP_DIV_ORIENTATION] = graph_param.common.div_orientation or 0
    _add_index_order_columns_to_graph_param(
        graph_param,
        temp_x_option,
        temp_serial_process,
        temp_serial_column,
    )
    # in case of jump from other page
    if df is None:
        # Use gen_df function to add order column to graph_param
        dic_param, df, graph_param_with_cate = gen_df(
            graph_param,
            dic_param,
            dic_cat_filters,
            rank_value=True,
            optional_cache_config=OptionalCacheConfig(use_expired_cache=use_expired_cache),
        )

    df = convert_datetime_to_ct(df, graph_param)
    x_axis_label = None
    layout_index = None
    first_primary_id = None
    first_primary_column = None
    if graph_param.common.layout:
        layout_index = build_map_layout_index(MAPLayoutRequest.model_validate(graph_param.common.layout))
        x_axis_col_id = layout_index.get_x_axis()
        first_primary_id = layout_index.get_first_primary_y_id()
        if x_axis_col_id:
            x_axis_label = graph_param.gen_label_from_col_id(x_axis_col_id)

    if first_primary_id:
        first_primary_col = graph_param.get_col_info_by_id(first_primary_id)
        if first_primary_col and first_primary_col[COL_DATA_TYPE] in [
            DataType.REAL.name,
            DataType.INTEGER.name,
            DataType.BIGINT.name,
        ]:
            first_primary_column = graph_param.gen_label_from_col_id(first_primary_id)

    # order index with other param
    df, dic_param = sort_df_by_x_option(
        df,
        dic_param,
        graph_param,
        dic_proc_cfgs,
        temp_x_option,
        temp_serial_process,
        temp_serial_column,
        temp_serial_order,
        x_axis_label,
        first_primary_column,
    )

    if temp_category_aggregated:
        dic_param[COMMON][CATEGORY_AGGREGATED] = temp_category_aggregated
    # reset index (keep sorted position)
    df = df.reset_index(drop=True)
    data_point_count = len(df)
    data_point_window = _resolve_data_point_window(dic_param)
    if data_point_window:
        df[MAP_DATA_POINT_INDEX_COL] = df.index
        df = _slice_data_point_window(df, data_point_window)
        data_point_count = len(df)
        dic_param[ACTUAL_RECORD_NUMBER] = data_point_count
        if dic_param.get(UNIQUE_SERIAL) is not None:
            dic_param[UNIQUE_SERIAL] = min(dic_param[UNIQUE_SERIAL], data_point_count)

    dic_param[MAP_DATA_POINT_LIMIT_EXCEEDED] = (
        data_point_count > MAP_DATA_POINT_DISPLAY_LIMIT and data_point_window is None
    )

    # Lab Max=128: only relevant when the bigger FPP-jump dialog isn't already showing,
    # and only when at least one primary variable actually has Lab/LabX configured.
    lab_is_set = bool(layout_index and layout_index.is_any_lab_set())
    dic_param[MAP_LAB_LIMIT_EXCEEDED] = (
        not dic_param[MAP_DATA_POINT_LIMIT_EXCEEDED]
        and lab_is_set
        and data_point_count > MAP_LAB_DATA_POINT_LIMIT
        and data_point_window is None
    )
    # Same behavior as the 8192 case: while the dialog is up, don't render the graph at all.
    should_skip_plot_data = bool(dic_param[MAP_DATA_POINT_LIMIT_EXCEEDED] or dic_param[MAP_LAB_LIMIT_EXCEEDED])

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param, True)

    graph_param = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )

    if TIME_COL in df.columns:
        times = df[TIME_COL]
        dic_param[TIMES] = times

    force_index_xaxis = _should_force_category_index_xaxis(
        layout_index,
        graph_param,
        df,
    )
    if force_index_xaxis and MAP_DATA_POINT_INDEX_COL not in df.columns:
        df[MAP_DATA_POINT_INDEX_COL] = df.index

    # The Div column travels with the graph data. When it is unavailable - for example a dataframe
    # handed over by a jump from another page - fall back to the undivided layout on both sides
    # instead of failing the whole request.
    if dic_param[MAP_DIV_SIZE]:
        div_col_cfg = graph_param.get_col_cfg(graph_param.common.div_by_cat)
        if div_col_cfg is None or not _has_div_column_data(df, div_col_cfg):
            dic_param[MAP_DIV_SIZE] = None

    # if existing layout from payload
    if should_skip_plot_data:
        dic_param[ARRAY_PLOTDATA] = []
        dic_param[SHOW_PROCESS_NAME] = False
    elif layout_index:
        dic_param[ARRAY_PLOTDATA] = get_flatten_data(
            df,
            graph_param,
            layout_index=layout_index,
            force_index_xaxis=force_index_xaxis,
            show_labels=data_point_window.show_labels if data_point_window else True,
        )
        dic_param[SHOW_PROCESS_NAME] = (
            len({col_cfg.cfg_process.id for col_cfg in graph_param.get_col_cfgs(layout_index.get_all_x_y_ids())}) > 1
        )

    chart_infos, original_graph_configs = get_chart_infos(graph_param)
    for group_data in dic_param.get(ARRAY_PLOTDATA, []):
        for plot in group_data:
            set_chart_infos_to_plotdata(plot[END_COL_ID], chart_infos, original_graph_configs, plot)

    # use for enable and disable index columns (mirrors FPP's time_series_chart.gen_graph)
    all_procs = []
    all_cols = []

    for proc in graph_param.array_formval:
        all_procs.append(proc.proc_id)
        all_cols.extend(proc.col_ids)

    dic_param[COMMON][DF_ALL_PROCS] = all_procs
    dic_param[COMMON][DF_ALL_COLUMNS] = all_cols

    # get order column data (so xAxisModal2's Column dropdown can enable already-selected columns)
    retrieve_order_setting(dic_proc_cfgs, dic_param)

    dic_param = get_filter_on_demand_data(dic_param)
    return dic_param
