from dataclasses import dataclass
from typing import Any

from ap.multi_axis_plot.enums import CommonLayoutEnum, OverlayEnum
from ap.multi_axis_plot.schemas import MAPLayoutRequest, MAPPrimary


@dataclass(frozen=True)
class ResolvedLab:
    """Resolved label metadata for a target MAP plot."""

    lab_id: int | None
    is_global_lab: bool


@dataclass(frozen=True)
class ResolvedColor:
    """Resolved color metadata for a target MAP plot."""

    color_id: int | None
    is_global_color: bool
    is_color_imb: bool


def _flatten_any(node: Any, except_keys: set[str]) -> list[Any]:
    """Flatten nested model data while skipping keys that are not variable references."""
    flattened: list[Any] = []

    def _extract(value: Any) -> None:
        if isinstance(value, dict):
            for key, inner_value in value.items():
                if key in except_keys:
                    continue
                _extract(inner_value)
            return

        if isinstance(value, list):
            for item in value:
                _extract(item)
            return

        flattened.append(value)

    _extract(node)
    return flattened


def _as_column_id(value: Any) -> int | None:
    """Return an integer column ID, ignoring shared config values."""
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _iter_subplot_plot_fields(subplot: MAPPrimary) -> list[tuple[str, int]]:
    """Yield the plot-related variable IDs in legacy serialized field order."""
    # Preserve the historical field order from `model_dump()` so plot ordering does not shift
    # after moving lookup logic out of the schema class.
    field_names = {
        CommonLayoutEnum.PRIMARY.value,
        OverlayEnum.MAIN.value,
        OverlayEnum.SUB.value,
        OverlayEnum.ADD.value,
        OverlayEnum.STEP.value,
    }
    field_entries: list[tuple[str, int]] = []

    for field_name, field_value in subplot.model_dump().items():
        if field_name not in field_names:
            continue
        if isinstance(field_value, list):
            field_entries.extend((field_name, item) for item in field_value if item is not None)
        elif field_value is not None:
            field_entries.append((field_name, field_value))

    return field_entries


def _has_overlay_values(subplot: MAPPrimary | None) -> bool:
    """Check whether a subplot has any overlay entries in main/sub/add."""
    if not subplot:
        return False

    return any(item is not None for item in subplot.main + subplot.sub + subplot.add)


@dataclass(frozen=True)
class MAPLayoutIndex:
    """Precomputed lookup/index layer for MAP layout queries."""

    layout: MAPLayoutRequest
    target_col_ids: list[int]
    map_col_ids: list[int]
    subplot_by_primary_id: dict[int, MAPPrimary]
    subplot_by_col_id: dict[int, MAPPrimary]
    overlay_type_by_col_id: dict[int, str]
    plot_no_by_col_id: dict[int, int]
    x_axis_ids: tuple[int, ...]
    main_x_axis_id: int | None
    lab_ids: tuple[int, ...]
    color_ids: tuple[int, ...]

    @classmethod
    def from_layout(cls, layout: MAPLayoutRequest) -> 'MAPLayoutIndex':
        """Build a reusable query/index view from a validated MAP layout."""
        flattened_target_col_ids = _flatten_any(
            layout.model_dump(),
            except_keys={CommonLayoutEnum.ORDER.value},
        )
        target_col_ids = [
            column_id
            for column_id in (_as_column_id(value) for value in flattened_target_col_ids)
            if column_id is not None
        ]

        sub_plots = layout.sub_plots or []
        subplot_by_primary_id: dict[int, MAPPrimary] = {}
        subplot_by_col_id: dict[int, MAPPrimary] = {}
        overlay_type_by_col_id: dict[int, str] = {}
        plot_no_by_col_id: dict[int, int] = {}
        map_col_ids: list[int] = []
        seen_map_col_ids: set[int] = set()

        for subplot in sub_plots:
            subplot_by_primary_id[subplot.primary] = subplot
            for overlay_type, column_id in _iter_subplot_plot_fields(subplot):
                subplot_by_col_id.setdefault(column_id, subplot)
                overlay_type_by_col_id.setdefault(column_id, overlay_type)
                plot_no_by_col_id.setdefault(column_id, subplot.order)
                if column_id not in seen_map_col_ids:
                    seen_map_col_ids.add(column_id)
                    map_col_ids.append(column_id)

        x_axis_ids = tuple(
            int(axis_id)
            for axis_id in (
                layout.x_axis,
                layout.lab_x,
                layout.color_x,
                layout.color_imb_x,
            )
            if axis_id is not None
        )
        lab_ids = tuple(int(lab_id) for lab_id in (layout.lab, layout.lab_x) if lab_id is not None)
        color_ids = tuple(
            int(color_id)
            for color_id in (
                layout.color,
                layout.color_imb,
                layout.color_x,
                layout.color_imb_x,
            )
            if color_id is not None
        )

        return cls(
            layout=layout,
            target_col_ids=target_col_ids,
            map_col_ids=map_col_ids,
            subplot_by_primary_id=subplot_by_primary_id,
            subplot_by_col_id=subplot_by_col_id,
            overlay_type_by_col_id=overlay_type_by_col_id,
            plot_no_by_col_id=plot_no_by_col_id,
            x_axis_ids=x_axis_ids,
            main_x_axis_id=int(layout.x_axis) if layout.x_axis is not None else None,
            lab_ids=lab_ids,
            color_ids=color_ids,
        )

    def get_target_cols(self) -> list[int]:
        """Return all layout-referenced column IDs in the original serialized order."""
        return self.target_col_ids

    def get_map_cols(self) -> list[int]:
        """Return all plotted MAP column IDs in stable layout order."""
        return self.map_col_ids

    def get_subplot(self, column_id: Any) -> MAPPrimary | None:
        """Return the subplot that owns a plotted column ID."""
        try:
            return self.subplot_by_col_id.get(int(column_id))
        except (TypeError, ValueError):
            return None

    def get_subplot_by_primary_id(self, column_id: Any) -> MAPPrimary | None:
        """Return a subplot by its primary variable ID."""
        try:
            return self.subplot_by_primary_id.get(int(column_id))
        except (TypeError, ValueError):
            return None

    def get_overlay_type(self, column_id: Any) -> str | None:
        """Return the overlay type for a plotted column."""
        try:
            return self.overlay_type_by_col_id.get(int(column_id))
        except (TypeError, ValueError):
            return None

    def get_plot_no(self, column_id: Any) -> int | None:
        """Return the subplot order for a plotted column."""
        try:
            return self.plot_no_by_col_id.get(int(column_id))
        except (TypeError, ValueError):
            return None

    def get_x_axis(self) -> int | None:
        """Return the first active X-axis-related column ID."""
        return self.x_axis_ids[0] if self.x_axis_ids else None

    def get_first_primary_y_id(self) -> int | None:
        """Return the first order 1 primary Y-axis-related column ID."""
        for subplot in self.subplot_by_primary_id.values():
            if subplot.order == 1:
                return subplot.primary
        return None

    def is_x_axis(self, column_id: Any) -> bool:
        """Check whether a column participates in any X-axis role."""
        try:
            return int(column_id) in self.x_axis_ids
        except (TypeError, ValueError):
            return False

    def is_main_x_axis(self, column_id: Any) -> bool:
        """Check whether a column is the main X-axis variable."""
        try:
            return int(column_id) == self.main_x_axis_id
        except (TypeError, ValueError):
            return False

    def get_lab_id(self) -> int | None:
        """Return the first global lab column ID."""
        return self.lab_ids[0] if self.lab_ids else None

    def is_any_lab_set(self) -> bool:
        """Check whether any Lab/LabX is configured, either globally or per primary variable."""
        if self.lab_ids:
            return True
        return any(subplot.lab is not None for subplot in self.subplot_by_primary_id.values())

    def get_all_x_y_ids(self) -> list[int]:
        """Return all subplot ids and main x axis"""
        return [*self.subplot_by_col_id.keys(), self.main_x_axis_id]

    def resolve_lab(self, column_id: int | None = None) -> ResolvedLab:
        """Resolve plot label configuration with local subplot settings taking precedence."""
        subplot = self.get_subplot_by_primary_id(column_id)
        if subplot and subplot.lab is not None:
            return ResolvedLab(lab_id=int(subplot.lab), is_global_lab=False)

        global_lab_id = self.get_lab_id()
        if global_lab_id is not None:
            return ResolvedLab(lab_id=global_lab_id, is_global_lab=True)

        return ResolvedLab(lab_id=None, is_global_lab=False)

    def get_color_id(self) -> int | None:
        """Return the first global color-related column ID."""
        return self.color_ids[0] if self.color_ids else None

    def resolve_color(self, column_id: int | None = None) -> ResolvedColor:
        """Resolve color configuration with local subplot settings taking precedence."""
        subplot = self.get_subplot_by_primary_id(column_id)
        if subplot and subplot.color is not None:
            return ResolvedColor(color_id=int(subplot.color), is_global_color=False, is_color_imb=False)

        if subplot and subplot.color_imb is not None:
            return ResolvedColor(color_id=int(subplot.color_imb), is_global_color=False, is_color_imb=True)

        global_color_id = self.get_color_id()
        if global_color_id is not None:
            owner_subplot = self.get_subplot(column_id)
            if _has_overlay_values(owner_subplot):
                return ResolvedColor(color_id=None, is_global_color=False, is_color_imb=False)

            # A global color is a ColImb when it comes from color_imb / color_imb_x.
            is_global_imb = global_color_id in (self.layout.color_imb, self.layout.color_imb_x)

            # Apply shared color only when the owning subplot has no main/sub/add overlay entries.
            return ResolvedColor(color_id=global_color_id, is_global_color=True, is_color_imb=is_global_imb)

        return ResolvedColor(color_id=None, is_global_color=False, is_color_imb=False)


def build_map_layout_index(layout: MAPLayoutRequest) -> MAPLayoutIndex:
    """Build a precomputed layout index for MAP services."""
    return MAPLayoutIndex.from_layout(layout)
