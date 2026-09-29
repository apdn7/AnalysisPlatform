from typing import Any

from pydantic import BaseModel, Field


class MAPMarker(BaseModel):
    """Marker Schema"""

    n: int
    marker_size: int  # adjust marker's size by n points


class MAPLine(BaseModel):
    """Line Schema"""

    n: int
    line_width: int  # adjust line's width by n points


class MAPSharedConfig(BaseModel):
    """Common Schema"""

    x_axis: int | None = None  # x-axis variable ID, default is main::datetime
    lab: int | None = None  # label show in all subplots (shared label)
    lab_x: int | None = None  # labX
    color: int | None = None  # for primary variable (y-axis)
    color_x: int | None = None
    color_imb: int | None = None
    color_imb_x: int | None = None
    y_axis_mode: str | None = None


class MAPOverlay(BaseModel):
    """Overlay Schema"""

    main: list[int | None] = []  # to add to primary (left) axis
    # sub-axis variable ID, use to add to secondary (right) axis, up to 3
    sub: list[int | None] = []
    # variable to be overlaid without an axis
    # up to 8 variable can be specified per primary variable
    add: list[int | None] = []


class MAPGroupByCategoryValues(BaseModel):
    """Category Values Based Categorize Schema"""

    color: int | None = None  # color categorize by variable
    # show as secondary axes
    # up to 8 category values are shown
    color_imb: int | None = None


class MAPPrimary(MAPOverlay, MAPGroupByCategoryValues):
    """Schema For Every Primary Variable"""

    primary: int  # primary variable
    order: int  # position of this subplot
    lab: int | None = None  # subplot label to be displayed for primary variable
    lab_x: int | None = None  # labX
    step: list[int] | None = None  # step variable ID


class MAPLayoutRequest(MAPSharedConfig):
    """MAP Layout Request Schema"""

    # Use Field(default_factory=list) to avoid mutable default argument issues in Pydantic v2
    sub_plots: list[MAPPrimary] = Field(default_factory=list)


class MAPDataResponse(BaseModel):
    """MAP data to response frontend"""

    model_config = {'populate_by_name': True}

    key: str
    array_x: list[Any]
    array_y: list[Any]
    name: str
    end_col_id: int
    is_xaxis: bool = False
    plot_no: int | str | None
    x_axis_title: str | None
    text: list[int | str | float] | None = None
    class_: str | None = Field(alias='class')
    is_log_scale_available: bool = False
    marker_size: float | None = None
    line_width: float | None = None
    is_numeric_dtype: bool = False
    is_xaxis_category: bool = False
    x_axis_datatype: str
    x_axis_numeric: bool
    x_process_name: str
    y_process_name: str
    color_group: str | int | None = None
    category_boundaries: list[dict[str, Any]] | None = None
    x_axis_tickvals: list[Any] | None = None
    x_axis_ticktext: list[str] | None = None
    y_axis_title: str | None = None
    facet_label: str | None = None  # Facet(Lv1/Lv2) value for this card, rendered separately at top-left
    legend_group: str | None = None
    is_datetime_label: bool = False
    is_color_imb_group: bool = False
    is_x_axis_binned: bool = False
    is_y_axis_binned: bool = False
    x_bin_labels: list[str] | None = None
    x_bin_mins: list[Any] | None = None
    x_bin_maxs: list[Any] | None = None
    category_hover_values: list[str] | None = None
    encoded_x_values: bool = False
    is_sort_by_data_order: bool = False
    y_fmt: str = ''
    y_axis_category: bool = False
    original_array_x: list[Any] | None = None
    show_x_axis_with_index: bool = False
