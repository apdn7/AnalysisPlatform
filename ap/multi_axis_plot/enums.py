from enum import Enum, StrEnum


class CommonLayoutEnum(StrEnum):
    """Common layout enum"""

    PRIMARY = 'primary'
    X_AXIS = 'x_axis'
    LAB = 'lab'
    LAB_X = 'lab_x'
    ORDER = 'order'
    SUB_PLOTS = 'sub_plots'


class OverlayEnum(StrEnum):
    """Overlay type of variable"""

    MAIN = 'main'
    SUB = 'sub'
    ADD = 'add'
    STEP = 'step'


class ColorByCategoryEnum(StrEnum):
    """Color by category values of variables"""

    COLOR = 'color'
    COLOR_IMB = 'color_imb'
    COLOR_X = 'color_x'
    COLOR_IMB_X = 'color_imb_x'


class ColorImbThreshold(Enum):
    """Color imbalance threshold"""

    PERCENTILE = 0.9  # P90 of y in grouped by color
    THRESHOLD = 0.05  # 5% of global y-max
    MAX_AXES = 3  # ColImb creates at most 3 secondary axes per subplot


class ColorCategoryLimit(Enum):
    """Max number of categories shown when coloring by category (top N by data count)"""

    GLOBAL = 16  # shared color: Color / ColorX / ColImb / ColImbX
    PER_SUBPLOT = 8  # per-subplot color: 1Color / 1ColImb
    UNIQUE_DATA_PER_COLOR = 128  # if nunique of data < 128, show raw array_x as x_axis, else show index of series
