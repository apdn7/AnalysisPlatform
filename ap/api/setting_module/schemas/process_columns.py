from typing import Annotated, Literal

from pydantic import BaseModel, Field, PositiveInt


class ProcessColumnUiState(BaseModel):
    """Draft assignments used when filtering variables across pages."""

    facetState: str = ''
    filterState: str = '0'
    additionalColumn: str | bool = ''


class SampleDatetimeRange(BaseModel):
    """One UTC datetime range used to limit transaction sample reads.

    `start`/`end` are UTC ISO strings (e.g. ``2026-10-01T00:00:00.000000Z``) matching the format
    stored in the transaction datetime column, so they can be compared directly in the sample query.
    """

    start: str
    end: str


class ProcessColumnsRequest(BaseModel):
    """Pagination, filters and draft selection for Variable Select."""

    page: PositiveInt = 1
    limit: PositiveInt = 50
    pagination_mode: Literal['columns', 'processes'] = 'columns'
    # Column mode assigns a fixed global idx over these processes before filtering or pagination.
    process_ids: list[Annotated[int, Field(gt=0)]] | None = None
    # Explicit process checkbox anchors; empty means unrestricted, and column mode ignores them.
    linked_process_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    process_name: str = ''
    idx: str = ''
    english_name: str = ''
    datatype: str = ''
    shownname: str = ''
    unit: str = ''
    sample_1: str = ''
    sample_2: str = ''
    sample_3: str = ''
    sample_4: str = ''
    sample_5: str = ''
    search_regex: str = ''
    show_mode: Literal['all', 'selected', 'unselected'] = 'all'
    exclude_key: bool = False
    # Remove metadata-defined main serial/datetime columns from the draft when Key除く is turned on.
    deselect_keys: bool = False
    selected_column_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    # Process-mode Show selected/unselected uses checkbox IDs, not the columns selected for plotting.
    selected_process_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    prioritized_column_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    select_all: bool | None = None
    idx_start: PositiveInt = 1
    idx_size: int = Field(default=0, ge=0)
    idx_interval: PositiveInt = 1
    same_filter: bool = False
    na_filter: bool = False
    plot_state: str = ''
    facet_state: str = ''
    filter_state: str = ''
    additional_column: str = ''
    # Variable Select page type (e.g. "fpp"); decides which rows show the page-specific control.
    page_type: str = ''
    column_states: dict[Annotated[int, Field(gt=0)], ProcessColumnUiState] = Field(default_factory=dict)
    # Columns whose samples the client already holds; their samples are not re-read (returned empty).
    cached_sample_column_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    # Return the ordered ids of every matching column (all pages), used by MAP bulk selection.
    include_layout_candidates: bool = False
    # UTC datetime range(s) selected in the outer datetime range picker. Empty means no range was
    # selected, so samples keep the default "first N rows" behaviour. Multiple ranges are unioned.
    datetime_ranges: list[SampleDatetimeRange] = Field(default_factory=list)
