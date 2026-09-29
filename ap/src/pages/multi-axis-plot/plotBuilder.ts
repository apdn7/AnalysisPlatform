import type { Data, Layout, PlotData } from 'plotly.js';

import { COLOR_SCALES } from '@/pages/multi-axis-plot/plotSettings.ts';
import { convertUtcToLocal } from '@/shared/utils/helpers.ts';

import { PlotPriority, type PlotSeries, type SubplotCount } from './types';

type AxisRef = {
    trace: Partial<PlotData>['yaxis'];
    layoutKey: string;
};

type AnnotatedTrace = Partial<PlotData> & {
    text?: string[];
    x?: unknown[];
    y?: unknown[];
};

type Annotation = NonNullable<Layout['annotations']>[number];
type Shape = NonNullable<Layout['shapes']>[number];

export interface GraphSetting {
    fontSize: string;
    theme: string;
    plotStyle: string;
    transpose: boolean;
    yAxis: YAxisShowModes;
    xAxis: string;
    xDatatype: string;
    showProcess: boolean;
    // Div2/Div3/Div6: when set, subplots use a Div-specific grid instead of the generic
    // subplotCount-based grid. Multi-primary Div uses (numPrimaries columns × divSize rows);
    // single-primary Div wraps its sub-panels (Div6 → 2 columns × 3 rows). All come from the API.
    divSize?: number;
    numPrimaries?: number;
    // 0 (default) = vertical, 1 = horizontal. Independent of `transpose` above (the general
    // Transpose toggle) — Div's own orientation choice from the Div2↕/Div2↔/Div3↕/Div3↔ dropdown.
    divOrientation?: number;
}

export type PlotFigureOptions = {
    showLegend?: boolean;
    xAxisLabelsByPlotNo?: Record<number, boolean>;
    categoryBoundaryLabelsByPlotNo?: Record<number, boolean>;
    margin?: Partial<Layout['margin']>;
    normalizeSubplots?: boolean;
    reserveLegendSpace?: boolean;
    rightAxisReserveRatio?: number;
    maximumSubAxis?: number;
    extraYAxisOffset?: number;
    stackedDataCache?: StackedDataCache;
    height?: number;
};

type CachedStackedData = {
    series: PlotSeries[];
    xRefs: PlotSeries['array_x'][];
    yRefs: PlotSeries['array_y'][];
    valuesBySeries: Map<PlotSeries, number[]>;
};

export type StackedDataCache = Map<string, CachedStackedData>;

type SubplotCell = {
    series: PlotSeries[];
    row: number;
    column: number;
    xAxisNumber: number;
    primaryYAxis: AxisRef;
    xDomain: [number, number];
    yDomain: [number, number];
    subPlotHeight: number;
};

type AxisPlan = {
    axisBySeriesIndex: Array<AxisRef>;
    extraAxes: Array<{ axis: AxisRef; series: PlotSeries; order: number; visible?: boolean }>;
};

type YAxisMode = {
    stacked: boolean;
    percent: boolean;
};

const defaultYAxisMode: YAxisMode = {
    stacked: false,
    percent: false,
};

const getYAxisMode = (yAxis: YAxisShowModes): YAxisMode => {
    switch (yAxis) {
        case YAxisShowModes.Stack:
        case YAxisShowModes.BinStack:
            return { stacked: true, percent: false };
        case YAxisShowModes.Percent:
        case YAxisShowModes.BinPercent:
            return { stacked: false, percent: true };
        case YAxisShowModes.PercentStack:
        case YAxisShowModes.BinPercentStack:
            return { stacked: true, percent: true };
        default:
            return defaultYAxisMode;
    }
};

export const themeColor = {
    background: {
        dark: '#050505',
        light: '#ffffff',
    },
    text: {
        dark: '#f8f8f8',
        light: '#444444',
    },
    grid: {
        dark: '#444444',
        light: '#ececec',
    },
    line: {
        dark: '#444444',
        light: '#444444',
    },
    border: {
        dark: '#444444',
        light: '#000000',
    },
};

const fontSize = {
    tick: {
        base: 11,
        s: 12,
        m: 16,
        l: 20,
        xl: 24,
    },
    label: {
        base: 12,
        s: 14,
        m: 18,
        l: 22,
        xl: 26,
    },
};

const EXTRA_Y_AXIS_OFFSET = {
    base: 0.04,
    s: 0.044,
    m: 0.056,
    l: 0.06,
    xl: 0.075,
};

export enum YAxisShowModes {
    Normal = 'normal',
    Stack = 'stack',
    Percent = 'percent',
    PercentStack = 'percent-stack',
    BinStack = 'bin-stack',
    BinPercent = 'bin-percent',
    BinPercentStack = 'bin-percent-stack',
    LogOn = 'Log-on',
    LogOff = 'Log-off',
}

export enum XAxisShowModes {
    Time = 'TIME',
    Index = 'INDEX',
}

const HORIZONTAL_GAP = {
    base: 0.042,
    s: 0.042,
    m: 0.055,
    l: 0.055,
    xl: 0.065,
};
const LEGEND_RIGHT_MARGIN = {
    transpose: {
        base: 0.035,
        s: 0.035,
        m: 0.042,
        l: 0.049,
        xl: 0.067,
    },
    normal: {
        base: 0.035,
        s: 0.035,
        m: 0.042,
        l: 0.049,
        xl: 0.066,
    },
};
const MAX_SECONDARY_AXES = 3;
const SUBPLOT_GAP = 20;
const CATEGORY_BOUNDARY_MAX_LABELS = 128;
const CATEGORY_BOUNDARY_LINE_FACTOR = 0.85;
const CATEGORY_BOUNDARY_FONT_SIZE = 10;
const CATEGORY_BOUNDARY_Y_SHIFT = -2;
const LEGEND_MAX_WIDTH = 200;
const TICK_GAP = 0.00042;
const LOCAL_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

const axisTraceRef = (prefix: 'x' | 'y', axisNumber: number): string =>
    axisNumber === 1 ? prefix : `${prefix}${axisNumber}`;

const axisLayoutKey = (prefix: 'xaxis' | 'yaxis', axisNumber: number): string =>
    axisNumber === 1 ? prefix : `${prefix}${axisNumber}`;

const yAxisRef = (axisNumber: number): AxisRef => ({
    trace: axisTraceRef('y', axisNumber) as Partial<PlotData>['yaxis'],
    layoutKey: axisLayoutKey('yaxis', axisNumber),
});

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const rgbToHls = (r: number, g: number, b: number): [number, number, number] => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) return [0, l, 0];

    const delta = max - min;
    const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let h = 0;

    if (max === r) {
        h = (g - b) / delta + (g < b ? 6 : 0);
    } else if (max === g) {
        h = (b - r) / delta + 2;
    } else {
        h = (r - g) / delta + 4;
    }

    return [h / 6, l, s];
};

const hueToRgb = (p: number, q: number, t: number): number => {
    let hue = t;
    if (hue < 0) hue += 1;
    if (hue > 1) hue -= 1;
    if (hue < 1 / 6) return p + (q - p) * 6 * hue;
    if (hue < 1 / 2) return q;
    if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
    return p;
};

const hlsToRgb = (h: number, l: number, s: number): [number, number, number] => {
    if (s === 0) return [l, l, l];

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
};

const darkenHex = (hexColor: string, factor: number): string => {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return hexColor;

    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    if ([r, g, b].some(Number.isNaN)) return hexColor;

    const [h, l, s] = rgbToHls(r, g, b);
    const channels = hlsToRgb(h, clamp(l * factor, 0.1, 1.0), s).map((value) => Math.round(clamp(value, 0, 1) * 255));

    return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

const getSeriesListRange = (seriesList: PlotSeries[]): [number, number] | undefined => {
    const values = seriesList.flatMap((series) => series.array_y).filter(Number.isFinite);
    if (values.length === 0) return undefined;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.01, 1);

    return [min - padding, max + padding];
};

const usesLogScale = (series: PlotSeries, yAxisMode: YAxisShowModes): boolean =>
    Boolean(
        series.is_numeric_dtype &&
        ((series.is_log_scale_available && yAxisMode === YAxisShowModes.Normal) || yAxisMode === YAxisShowModes.LogOn),
    );

const getSeriesDisplayName = (series: PlotSeries, yAxisMode: YAxisShowModes): string => {
    if (yAxisMode !== YAxisShowModes.Normal) return series.name;

    return `${series.name} (${usesLogScale(series, yAxisMode) ? 'Log on' : 'Log off'})`;
};

export const createStackedDataCache = (): StackedDataCache => new Map();

const getColorGroupKey = (series: PlotSeries): string | undefined =>
    series.color_group === null || series.color_group === undefined || series.color_group === ''
        ? undefined
        : String(series.color_group);

const getLegendGroup = (series: PlotSeries, isDivMode?: boolean): string => {
    const colorGroupKey = getColorGroupKey(series);
    if (colorGroupKey) {
        return `color-${colorGroupKey}`;
    }
    // In Div mode, the same primary variable is split across several plot_no values (one per
    // div sub-panel) — omit plot_no so those siblings share one legend entry instead of each
    // showing their own.
    return isDivMode
        ? `series-${series.end_col_id}-${series.key}`
        : `series-${series.plot_no}-${series.end_col_id}-${series.key}`;
};

export const applyDefaultSeriesColors = (seriesList: PlotSeries[], theme: string): PlotSeries[] => {
    const colorByGroup = new Map<string, string>();
    let colorGroupCount = 0;

    return seriesList.map((series, index) => {
        const colorGroupKey = getColorGroupKey(series);
        let color = series.color;

        if (!color && colorGroupKey) {
            if (!colorByGroup.has(colorGroupKey)) {
                colorByGroup.set(colorGroupKey, COLOR_SCALES[colorGroupCount % COLOR_SCALES.length]);
                colorGroupCount += 1;
            }
            color = colorByGroup.get(colorGroupKey);
        }

        const defaultColor = color || COLOR_SCALES[index % COLOR_SCALES.length];
        const useThemeYAxisColor =
            (Boolean(series.color) || Boolean(colorGroupKey) || seriesList.length === 1) &&
            series.is_color_imb_group !== true;
        const yColor = series.yColor || (useThemeYAxisColor ? themeColor.text[theme] : defaultColor);

        return {
            ...series,
            color: defaultColor,
            yColor,
        };
    });
};

const isCachedStackedDataValid = (cached: CachedStackedData, cell: SubplotCell): boolean =>
    cached.series.length === cell.series.length &&
    cached.series.every(
        (series, index) =>
            series === cell.series[index] &&
            cached.xRefs[index] === series.array_x &&
            cached.yRefs[index] === series.array_y,
    );

const getPercentStackValues = (cell: SubplotCell): Map<PlotSeries, number[]> => {
    const totalsByX = new Map<string, number>();

    cell.series.forEach((series) => {
        series.array_x.forEach((xValue, index) => {
            const key = JSON.stringify(xValue);
            totalsByX.set(key, (totalsByX.get(key) ?? 0) + series.array_y[index]);
        });
    });

    return new Map(
        cell.series.map((series) => [
            series,
            series.array_y.map((value, index) => {
                const total = totalsByX.get(JSON.stringify(series.array_x[index])) ?? 0;
                return total === 0 ? 0 : (value / total) * 100;
            }),
        ]),
    );
};

const getStackedValues = (
    cell: SubplotCell,
    yAxis: YAxisShowModes,
    stackedDataCache?: StackedDataCache,
): Map<PlotSeries, number[]> | undefined => {
    const { stacked, percent } = getYAxisMode(yAxis);
    if (!stacked && !percent) return undefined;

    const cacheKey = `${yAxis}:${cell.series[0]?.plot_no ?? cell.xAxisNumber}`;
    const cached = stackedDataCache?.get(cacheKey);
    if (cached && isCachedStackedDataValid(cached, cell)) {
        return cached.valuesBySeries;
    }

    const valuesBySeries = percent
        ? getPercentStackValues(cell)
        : new Map(cell.series.map((series) => [series, series.array_y]));

    stackedDataCache?.set(cacheKey, {
        series: [...cell.series],
        xRefs: cell.series.map((series) => series.array_x),
        yRefs: cell.series.map((series) => series.array_y),
        valuesBySeries,
    });

    return valuesBySeries;
};

export const getChartBodyHeight = (subPlotCount: SubplotCount) => {
    return window.innerHeight - 70;
};

const getMaximumSubAxisNumber = (seriesList: PlotSeries[]): number => {
    const groupPlot = groupByPlotNo(seriesList);
    return Math.max(
        0,
        ...groupPlot.map((group) =>
            Math.min(
                group.filter((item) => item.class === 'sub' || item.is_color_imb_group === true).length,
                MAX_SECONDARY_AXES,
            ),
        ),
    );
};

const groupByPlotNo = (seriesList: PlotSeries[]): PlotSeries[][] =>
    Array.from(
        seriesList.reduce((groups, series) => {
            const group = groups.get(series.plot_no) ?? [];
            group.push(series);
            groups.set(series.plot_no, group);
            return groups;
        }, new Map<number, PlotSeries[]>()),
    )
        .sort(([plotNoA], [plotNoB]) => plotNoA - plotNoB)
        .map(([, series]) => series);

/**
 * Shared grid logic for both the general Transpose toggle and Div's own orientation setting —
 * one implementation, not two parallel ones. Wraps `count` items into a grid (2 columns once
 * count >= 4, otherwise 1) in the NORMAL orientation, then, for a true transpose, swaps the grid's
 * row/column counts AND swaps each item's row/column — so a group of items that was stacked in one
 * column stays grouped together but reoriented into a row (matching what
 * getAxisSwapGridDimensions/getAxisSwapGridPosition already do for multi-primary Div), rather than
 * just re-flowing the same 0,1,2... sequence into a differently-shaped grid (which would scramble
 * which items were grouped together).
 */
const getWrappedGrid = (count: number, swapAxes: boolean): { columns: number; rows: number } => {
    const normalColumns = count >= 4 ? 2 : 1;
    const normalRows = Math.ceil(count / normalColumns);
    return swapAxes ? { columns: normalRows, rows: normalColumns } : { columns: normalColumns, rows: normalRows };
};

/** Companion to getWrappedGrid: the (row, column) position of one item, consistent with its grid. */
const getWrappedGridPosition = (index: number, count: number, swapAxes: boolean): { row: number; column: number } => {
    const normalColumns = count >= 4 ? 2 : 1;
    const normalRows = Math.ceil(count / normalColumns);
    const normalRow = normalColumns === 1 ? index : index % normalRows;
    const normalColumn = normalColumns === 1 ? 0 : Math.floor(index / normalRows);
    return swapAxes ? { row: normalColumn, column: normalRow } : { row: normalRow, column: normalColumn };
};

/**
 * Computes 2D grid dimensions for a set of items indexed by (primary order, secondary index)
 * pairs, with an option to swap which axis maps to rows vs columns.
 *
 * Only used for multi-primary Div (Div2/Div3 with more than one primary), which genuinely swaps
 * which dimension (primary vs. div sub-panel) maps to rows vs. columns — a different shape of
 * transpose than the single "swap row/column counts, same fill order" rule in getWrappedGrid.
 */
const getAxisSwapGridDimensions = (
    primaryCount: number,
    secondaryCount: number,
    swapAxes: boolean,
): { rows: number; columns: number } =>
    swapAxes ? { rows: primaryCount, columns: secondaryCount } : { rows: secondaryCount, columns: primaryCount };

/** Companion to getAxisSwapGridDimensions: the (row, column) position for one (primary, secondary) pair. */
const getAxisSwapGridPosition = (
    primaryIndex0: number,
    secondaryIndex0: number,
    swapAxes: boolean,
): { row: number; column: number } =>
    swapAxes ? { row: primaryIndex0, column: secondaryIndex0 } : { row: secondaryIndex0, column: primaryIndex0 };

/**
 * Grid dimensions for the single-primary Div case (one variable split across `divSize` sub-panels).
 * Div6 wraps into 2 columns (2 columns × 3 rows) for readability instead of one tall 1×6 column;
 * Div2/Div3 stay a single line, matching the previous axis-swap layout. `swapAxes` (divOrientation===1)
 * transposes rows and columns. This is the same wrapping rule as getWrappedGrid — kept as a distinct
 * name here only for readability at the call site (divSize vs. plain subplot count).
 */
const getDivGrid = getWrappedGrid;

const getSubplotDomains = (
    index: number,
    subplotCount: SubplotCount,
    graphSettings: GraphSetting,
    reserveLegendSpace = true,
    rightAxisReserveRatio = 0,
    maximumSubAxis: number,
    maxTickLength?: number,
): Pick<SubplotCell, 'row' | 'column' | 'xDomain' | 'yDomain' | 'subPlotHeight'> => {
    const isDivMode = Boolean(graphSettings.divSize && graphSettings.numPrimaries);
    // One shared "swap axes" flag for both modes. In Div mode, the general Transpose button still
    // applies — it flips whatever Div's own orientation setting currently is (XOR), rather than
    // being ignored. So Div<-> + pressing Transpose lands back on Div vertical, and vice versa.
    const swapAxes = isDivMode
        ? (graphSettings.divOrientation === 1) !== graphSettings.transpose
        : graphSettings.transpose;
    // Multi-primary Div (Div2 with up to 3 primaries, Div3 with up to 2) keeps one column per
    // primary with div sub-panels stacked as rows. Single-primary Div (always the Div6 case, and
    // Div2/Div3 with one variable) instead wraps its sub-panels via getDivGrid — so Div6 renders
    // as 2 columns × 3 rows rather than one tall 1×6 column.
    const isMultiPrimaryDiv = isDivMode && (graphSettings.numPrimaries as number) > 1;
    let columns: number;
    let rows: number;
    let row: number;
    let column: number;
    if (isDivMode && graphSettings.divSize) {
        const divSize = graphSettings.divSize;
        if (isMultiPrimaryDiv) {
            ({ columns, rows } = getAxisSwapGridDimensions(graphSettings.numPrimaries as number, divSize, swapAxes));
            const primaryOrder0 = Math.floor(index / divSize);
            const divIdx0 = index % divSize;
            ({ row, column } = getAxisSwapGridPosition(primaryOrder0, divIdx0, swapAxes));
        } else {
            ({ columns, rows } = getDivGrid(divSize, swapAxes));
            ({ row, column } = getWrappedGridPosition(index, divSize, swapAxes));
        }
    } else {
        ({ columns, rows } = getWrappedGrid(subplotCount, swapAxes));
        ({ row, column } = getWrappedGridPosition(index, subplotCount, swapAxes));
    }
    const chartBodyHeight = getChartBodyHeight(subplotCount);
    const legendRightMargin = swapAxes
        ? LEGEND_RIGHT_MARGIN.transpose[graphSettings.fontSize]
        : LEGEND_RIGHT_MARGIN.normal[graphSettings.fontSize];
    const xUsableWidth = reserveLegendSpace ? 1 - maximumSubAxis * legendRightMargin : 1 - rightAxisReserveRatio;
    const tickGap = maxTickLength * fontSize.tick[graphSettings.fontSize] * TICK_GAP;
    const horizontalGap = HORIZONTAL_GAP[graphSettings.fontSize] * (maximumSubAxis + 1) + tickGap;
    const cellWidth = (xUsableWidth - horizontalGap * (columns - 1)) / columns;
    const yGap = SUBPLOT_GAP / chartBodyHeight;
    const cellHeight = (1 - yGap * (rows - 1)) / rows;
    const xStart = column * (cellWidth + horizontalGap);
    const yStart = 1 - (row + 1) * cellHeight - row * yGap;

    return {
        row,
        column,
        xDomain: [xStart, xStart + cellWidth],
        yDomain: [yStart, yStart + cellHeight],
        subPlotHeight: cellHeight * chartBodyHeight,
    };
};

const isLowestCellInColumn = (cell: SubplotCell, cells: SubplotCell[]): boolean =>
    !cells.some((otherCell) => otherCell.column === cell.column && otherCell.row > cell.row);

const buildSubplotCells = (
    seriesList: PlotSeries[],
    subplotCount: SubplotCount,
    graphSettings: GraphSetting,
    reserveLegendSpace = true,
    rightAxisReserveRatio = 0,
    maximumSubAxis: number,
    maxTickLength: number,
): SubplotCell[] =>
    groupByPlotNo(seriesList).map((series, index) => {
        const domains = getSubplotDomains(
            index,
            subplotCount,
            graphSettings,
            reserveLegendSpace,
            rightAxisReserveRatio,
            maximumSubAxis,
            maxTickLength,
        );
        const primaryYAxisNumber = index + 1;

        return {
            series,
            xAxisNumber: index + 1,
            primaryYAxis: yAxisRef(primaryYAxisNumber),
            ...domains,
        };
    });

// Axis rule per subplot: main -> primary y-axis, sub -> y overlays, add -> primary y-axis without labels.
const buildAxisPlan = (
    cell: SubplotCell,
    nextYAxisNumber: number,
    stacked: boolean,
): { plan: AxisPlan; nextYAxisNumber: number } => {
    if (stacked) {
        return {
            plan: {
                axisBySeriesIndex: cell.series.map(() => cell.primaryYAxis),
                extraAxes: [],
            },
            nextYAxisNumber,
        };
    }

    const axisBySeriesIndex: Array<AxisRef> = [];
    const extraAxes: AxisPlan['extraAxes'] = [];
    let subAxisIndex = 0;
    let yAxisNumber = nextYAxisNumber;

    cell.series.forEach((series, index) => {
        const isImbalanceGroup = series.is_color_imb_group === true;
        const takesSecondaryAxis =
            ((series.class === PlotPriority.SUB || isImbalanceGroup) && subAxisIndex < MAX_SECONDARY_AXES) ||
            series.class === PlotPriority.ADD;

        if (takesSecondaryAxis) {
            const axis = yAxisRef(yAxisNumber);
            axisBySeriesIndex[index] = axis;
            // ADD has no visible axis; SUB and imbalanced color groups show a secondary axis.
            extraAxes.push({ axis, series, order: subAxisIndex, visible: series.class !== PlotPriority.ADD });
            subAxisIndex += 1;
            yAxisNumber += 1;
            return;
        }

        axisBySeriesIndex[index] = cell.primaryYAxis;
    });

    return {
        plan: { axisBySeriesIndex, extraAxes },
        nextYAxisNumber: yAxisNumber,
    };
};

const buildTrace = (
    series: PlotSeries,
    cell: SubplotCell,
    axis: AxisRef,
    settings: GraphSetting,
    yValues: number[],
): Data => {
    const yAxisMode = settings.yAxis;
    const { stacked, percent } = getYAxisMode(yAxisMode);
    const displayName = getSeriesDisplayName(series, yAxisMode);
    const textLabels = Array.isArray(series.text) ? series.text : [];
    // Plotly renders text as SVG nodes, so only enable text mode when the primary series has actual labels.
    const hasText =
        series.class === PlotPriority.PRIMARY &&
        textLabels.length > 0 &&
        textLabels.some((label) => label.trim().length > 0);

    const seriesPlotStyle =
        settings.plotStyle === 'auto'
            ? series.class === PlotPriority.PRIMARY
                ? 'lines+markers'
                : 'lines'
            : settings.plotStyle;
    const text = hasText ? textLabels : undefined;
    const isDivMode = Boolean(settings.divSize && settings.numPrimaries);
    const legendGroup = getLegendGroup(series, isDivMode);
    const stackGroup = `subplot-${series.plot_no}`;
    const isStepLine = series.class === PlotPriority.STEP;
    const xaxis_name = axisTraceRef('x', cell.xAxisNumber) as Partial<PlotData>['xaxis'];
    const hasXBinLabels =
        Boolean(series.is_x_axis_binned) &&
        Array.isArray(series.x_bin_labels) &&
        series.x_bin_labels.length === yValues.length;
    const hasCategoryHoverValues =
        Array.isArray(series.category_hover_values) &&
        series.category_hover_values.length === yValues.length &&
        series.category_hover_values.some((value) => (value ?? '').trim().length > 0);

    const useOriginalArrayX = !!series.category_boundaries;
    const customData =
        text || hasXBinLabels || hasCategoryHoverValues || useOriginalArrayX
            ? yValues.map((_, index) => [
                  text?.[index] ?? '',
                  hasXBinLabels ? (series.x_bin_labels?.[index] ?? '') : '',
                  hasCategoryHoverValues ? (series.category_hover_values?.[index] ?? '') : '',
                  useOriginalArrayX ? (series.original_array_x?.[index] ?? '') : '',
              ])
            : undefined;

    const textHoverLine = text ? `%{customdata[0]}<br>` : '';
    const xBinHoverLine = hasXBinLabels ? `[%{customdata[1]}]<br>` : '';
    const categoryHoverLine = hasCategoryHoverValues ? `%{customdata[2]}<br>` : '';
    let xHoverLine = !hasXBinLabels || yAxisMode === YAxisShowModes.Normal ? 'x=%{x}<br>' : '';

    xHoverLine = useOriginalArrayX ? 'x=%{customdata[3]}<br>' : xHoverLine;
    return {
        x: series.array_x,
        y: yValues,
        text, //: series.array_x, // confirm to change
        type: stacked ? 'scatter' : 'scattergl',
        mode: seriesPlotStyle,
        name: buildPlotLegendName(
            series.name,
            '',
            series.y_process_name,
            settings.showProcess,
            fontSize.label[settings.fontSize],
        ),
        showlegend: true,
        legendgroup: legendGroup,
        stackgroup: stacked ? stackGroup : undefined,
        xaxis: xaxis_name,
        yaxis: axis.trace,
        line: {
            color: series.color,
            width: isStepLine ? 2 : series.line_width || 3,
            shape: isStepLine ? 'hvh' : 'linear',
        },
        uid: `${series.end_col_id}-${series.plot_no}`,
        marker: { color: series.color, size: series.marker_size || 6 },
        textfont: { color: themeColor.text[settings.theme], size: fontSize.tick[settings.fontSize] },
        textposition: 'top center',
        cliponaxis: false,
        customdata: customData,
        hovertemplate: `${xBinHoverLine}<b>${displayName}</b><br>${categoryHoverLine}${textHoverLine}${xHoverLine}y=%{y${percent ? ':.2f' : ''}}${percent ? '%' : ''}<extra></extra>`,
    } as Data;
};

const buildPlotTitle = (
    title: string,
    unit: string,
    processName: string,
    showProcess: boolean,
    subPlotHeight: number,
    fontSize: number,
): string => {
    if (!title) return '';
    const text = `${title}${unit ? ` [${unit}]` : ''}${showProcess ? ` | ${processName}` : ''}`;
    if (subPlotHeight) {
        return trimTextLengthByPixel(text, subPlotHeight, fontSize);
    }
    return text;
};

const buildPlotLegendName = (
    title: string,
    unit: string,
    processName: string,
    showProcess: boolean,
    fontSize: number,
): string => {
    if (!title) return '';
    const batch1 = `${title}${unit ? ` [${unit}]` : ''}`;
    const batch2 = `${showProcess ? `<br>(${processName})` : ''}`;
    return (
        trimTextLengthByPixel(batch1, LEGEND_MAX_WIDTH, fontSize) +
        trimTextLengthByPixel(batch2, LEGEND_MAX_WIDTH, fontSize)
    );
};

const getTickFormat = (series: PlotSeries, isCategory: boolean) => {
    const fmt = series.y_fmt || '';
    let tickFormat: string | undefined;

    if (!isCategory && series.array_y.length > 0) {
        const maxAbsY = Math.max(...series.array_y.map(Math.abs));

        if (fmt.includes('e')) {
            tickFormat = '.1e';
        } else if (Number.isInteger(maxAbsY) && maxAbsY >= 1e12) {
            tickFormat = '.2e';
        }
    }

    return tickFormat;
};

const buildYAxis = (
    series: PlotSeries,
    graphSettings: GraphSetting,
    visible?: boolean,
    subPlotHeight?: number,
    domain?: [number, number],
): Partial<Layout['yaxis']> => {
    const yAxisMode = graphSettings.yAxis;
    const { stacked, percent } = getYAxisMode(yAxisMode);
    const chartInfo = series.chart_infos ? series.chart_infos[0] : null;
    const range = chartInfo ? [chartInfo['y-min'], chartInfo['y-max']] : undefined;
    const useLogScale = usesLogScale(series, yAxisMode);

    let logScaleModeLayout = {};
    if (useLogScale) {
        logScaleModeLayout = {
            type: 'log',
            autorange: true,
            minorloglabels: 'complete',
        };
    }
    const isCategory = series.y_axis_category && !useLogScale && !percent;
    if (!visible) logScaleModeLayout = { ...logScaleModeLayout, visible: false };

    return {
        title: {
            text: buildPlotTitle(
                series.y_axis_title,
                '',
                series.y_process_name,
                graphSettings.showProcess,
                subPlotHeight - 50,
                fontSize.label[graphSettings.fontSize],
            ),
            font: { color: series.yColor, size: fontSize.label[graphSettings.fontSize] },
        },
        domain,
        range: percent ? [0, 100] : range,
        autorange: percent ? undefined : stacked || useLogScale ? true : undefined,
        zeroline: false,
        tickfont: { color: series.yColor },
        ticksuffix: percent ? '%' : undefined,
        tickformat: getTickFormat(series, isCategory),
        type: isCategory ? 'category' : undefined,
        ...logScaleModeLayout,
    };
};

const findPrimarySeries = (cell: SubplotCell): PlotSeries =>
    cell.series.find((series) => series.class === PlotPriority.PRIMARY) ?? cell.series[0];

const getMainSeries = (cell: SubplotCell): PlotSeries[] =>
    cell.series.filter((series) => series.class === PlotPriority.MAIN);

const buildBaseLayout = (graphSettings: GraphSetting): Partial<Layout> => ({
    autosize: true,
    paper_bgcolor: themeColor.background[graphSettings.theme],
    plot_bgcolor: themeColor.background[graphSettings.theme],
    margin: { t: 30, r: 210, b: 52, l: 56 },
    font: {
        color: themeColor.text[graphSettings.theme],
        family: 'Calibri Light',
        size: fontSize.label[graphSettings.fontSize],
    },
    legend: {
        x: 1.02,
        y: 1,
        xanchor: 'left',
        traceorder: 'grouped',
        groupclick: 'togglegroup',
        bgcolor: themeColor.background[graphSettings.theme],
        font: { color: themeColor.text[graphSettings.theme], size: fontSize.tick[graphSettings.fontSize] },
    },
    showlegend: true,
    hovermode: 'x unified',
});

const getCategoryBoundaryLabelCount = (series?: PlotSeries): number =>
    series?.category_boundaries?.reduce((count, boundary) => count + boundary.labels.length, 0) ?? 0;

const hasCategoryBoundaryAxis = (series?: PlotSeries): boolean =>
    Boolean(
        series?.is_xaxis_category &&
        series.category_boundaries?.length &&
        getCategoryBoundaryLabelCount(series) <= CATEGORY_BOUNDARY_MAX_LABELS,
    );

const getCategoryBoundaryRange = (cell: SubplotCell): [number, number] => {
    const xValues = cell.series.flatMap((series) => series.array_x);
    const tickValues = cell.series[0]?.x_axis_tickvals ?? [];
    const boundaryIndexes = cell.series[0]?.category_boundaries?.flatMap((boundary) => boundary.indexes) ?? [];
    const numericValues = [...xValues, ...tickValues, ...boundaryIndexes].filter(
        (value): value is number => typeof value === 'number' && Number.isFinite(value),
    );
    const maxX = numericValues.length ? Math.max(...numericValues) : 0;

    return [-0.5, Math.max(maxX + 0.5, 0.5)];
};

/**
 * In Div mode, sub-panels would otherwise each auto-range to their own data, which makes their
 * heights/positions hard to compare at a glance (e.g. a family with a short lifespan looks just as
 * "tall" as one with a long lifespan). Group sub-panels by their original primary — blocks of
 * `divSize` cells, in plot_no order, since that's how the backend expands one primary into its Div
 * sub-panels — and give every panel in a group the same x/y range, computed from the union of that
 * group's own data so comparisons across panels are meaningful.
 */
const getDivGroupRanges = (
    cells: SubplotCell[],
    divSize: number,
): { xRange: [number, number]; yRange: [number, number]; maxTickIndex: number }[] => {
    const groupCount = Math.ceil(cells.length / divSize);
    return Array.from({ length: groupCount }, (_, groupIndex) => {
        const groupCells = cells.slice(groupIndex * divSize, groupIndex * divSize + divSize);
        const allSeries = groupCells.flatMap((cell) => cell.series);

        // Include x_axis_tickvals (not just array_x) so a Div group's shared tick axis — e.g. the
        // global category axis backend now sends for Cat Value Div — spans its FULL declared width
        // even when a panel's own data points don't reach the last few tick positions (categories
        // with no data in this specific Div selection, like a family Div6 didn't pick, still need
        // their slot reserved so every panel's axis lines up).
        const xValues = allSeries.flatMap((series) => [...(series.array_x ?? []), ...(series.x_axis_tickvals ?? [])]);
        const numericX = xValues.filter(
            (value): value is number => typeof value === 'number' && Number.isFinite(value),
        );
        const maxX = numericX.length ? Math.max(...numericX) : 0;

        const yValues = allSeries.flatMap((series) => series.array_y ?? []);
        const numericY = yValues.filter((value): value is number => Number.isFinite(value));
        const minY = numericY.length ? Math.min(...numericY) : 0;
        const maxY = numericY.length ? Math.max(...numericY) : 1;
        const ySpan = maxY - minY;
        // Pad like Plotly's own autorange would, so points don't sit flush against the panel edge.
        // Fall back to a flat 10% of the value when every point in the group is identical.
        const yPadding = ySpan > 0 ? ySpan * 0.1 : Math.max(Math.abs(maxY), 1) * 0.1;

        return {
            xRange: [-0.5, Math.max(maxX + 0.5, 0.5)] as [number, number],
            yRange: [minY - yPadding, maxY + yPadding] as [number, number],
            maxTickIndex: Math.round(maxX),
        };
    });
};

/**
 * Builds one common tick axis for every panel in a Div group (0..maxTickIndex), so panels line up
 * on the same grid instead of each showing only as many ticks as it has points. Only meaningful
 * for encoded/compact positions (Cat Value, Index) — Original order keeps each panel's own absolute
 * file-row positions and ticks, since "common" there would mean 0..(dataset size), not 0..(group max).
 */
const getCommonDivTicks = (series: PlotSeries, maxTickIndex: number): { tickvals: number[]; ticktext: string[] } => {
    const tickvals = Array.from({ length: maxTickIndex + 1 }, (_, i) => i);
    const ticktext = new Array(maxTickIndex + 1).fill('');
    (series.x_axis_tickvals ?? []).forEach((position, i) => {
        if (typeof position === 'number' && position >= 0 && position <= maxTickIndex) {
            ticktext[position] = series.x_axis_ticktext?.[i] ?? '';
        }
    });
    return { tickvals, ticktext };
};

const buildSubplotBorderShapes = (cells: SubplotCell[], color: string): Shape[] =>
    cells.flatMap((cell) => {
        const line: Shape['line'] = {
            color,
            width: 1,
            dash: 'solid',
        };

        return [
            {
                type: 'line',
                xref: 'paper',
                yref: 'paper',
                x0: cell.xDomain[0],
                x1: cell.xDomain[1],
                y0: cell.yDomain[1],
                y1: cell.yDomain[1],
                line,
                layer: 'above',
            },
            {
                type: 'line',
                xref: 'paper',
                yref: 'paper',
                x0: cell.xDomain[1],
                x1: cell.xDomain[1],
                y0: cell.yDomain[0],
                y1: cell.yDomain[1],
                line,
                layer: 'above',
            },
        ];
    });

const buildCategoryBoundaryLayout = (
    cells: SubplotCell[],
    graphSettings: GraphSetting,
    layout: Partial<Layout>,
    categoryBoundaryLabelsByPlotNo?: Record<number, boolean>,
    height?: number,
): { shapes: Shape[]; annotations: Annotation[] } => {
    const baseLineColor = themeColor.grid[graphSettings.theme];
    const shapes: Shape[] = buildSubplotBorderShapes(cells, themeColor.border[graphSettings.theme]);
    const annotations: Annotation[] = [];
    const topY = Math.max(...cells.map((cell) => cell.yDomain[1]));
    const margin = layout.margin;
    const layoutHeight = Number(layout.height ?? height ?? getChartBodyHeight(cells.length as SubplotCount) ?? 800);
    const plotHeightPx = Math.max(1, layoutHeight - Number(margin?.t ?? 0) - Number(margin?.b ?? 0));
    const rowGap = CATEGORY_BOUNDARY_FONT_SIZE + 2;
    const baseFontColor = graphSettings.theme === 'dark' ? '#ffffff' : '#1F1C1C';

    cells.forEach((cell) => {
        const series = cell.series[0];
        if (!hasCategoryBoundaryAxis(series)) return;

        const xref = axisTraceRef('x', cell.xAxisNumber);
        const plotNo = series.plot_no;
        const showLabels =
            (plotNo === undefined ? undefined : categoryBoundaryLabelsByPlotNo?.[plotNo]) ?? cell.yDomain[1] === topY;

        series.category_boundaries?.forEach((boundary) => {
            const level = Number(boundary.level);
            const factor = CATEGORY_BOUNDARY_LINE_FACTOR ** level;
            const yShift = CATEGORY_BOUNDARY_Y_SHIFT - level * rowGap;
            const yTop = Math.max(0, Math.min(1, topY + yShift / plotHeightPx));
            const yEnd = cell.yDomain[0];
            if (yTop <= yEnd) return;

            boundary.indexes.forEach((boundaryIndex) => {
                const x = boundaryIndex - 0.5;
                shapes.push({
                    type: 'line',
                    xref: xref as Shape['xref'],
                    yref: 'paper',
                    x0: x,
                    x1: x,
                    y0: yEnd,
                    y1: yTop,
                    line: {
                        color: darkenHex(baseLineColor, factor),
                        width: 1,
                        dash: 'solid',
                    },
                    layer: 'above',
                });
            });

            if (!showLabels) return;

            boundary.indexes.forEach((boundaryIndex, index) => {
                console.log(boundary.labels[index]);
                annotations.push({
                    x: boundaryIndex - 0.5,
                    xref: xref as Annotation['xref'],
                    y: yTop,
                    yref: 'paper',
                    text: String(boundary.labels[index] ?? ''),
                    showarrow: false,
                    xanchor: 'left',
                    yanchor: 'top',
                    xshift: 4,
                    yshift: 0,
                    font: {
                        color: darkenHex(baseFontColor, factor),
                        size: CATEGORY_BOUNDARY_FONT_SIZE,
                    },
                });
            });
        });
    });

    return { shapes, annotations };
};

const FACET_LABEL_FONT_SIZE = 11;
const FACET_LABEL_X_SHIFT = -50;
const FACET_LABEL_Y_SHIFT = 10;

// Facet(Lv1/Lv2) label applies to the whole card (all subplots share the same facet_label,
// since one buildPlotFigure call renders exactly one facet group). Show it once, at the
// top-left corner of the card's top-left-most subplot — not repeated on every subplot.
const buildFacetLabelAnnotations = (cells: SubplotCell[], graphSettings: GraphSetting): Annotation[] => {
    const topLeftCell = cells.find((cell) => cell.row === 0 && cell.column === 0);
    const facetLabel = topLeftCell?.series[0]?.facet_label;
    if (!topLeftCell || !facetLabel) return [];

    return [
        {
            x: topLeftCell.xDomain[0],
            xref: 'paper',
            y: topLeftCell.yDomain[1],
            yref: 'paper',
            text: facetLabel,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'bottom',
            xshift: FACET_LABEL_X_SHIFT,
            yshift: FACET_LABEL_Y_SHIFT,
            font: {
                color: themeColor.text[graphSettings.theme],
                size: FACET_LABEL_FONT_SIZE,
            },
        } as Annotation,
    ];
};

const buildPlotUIRevision = (seriesList: PlotSeries[], graphSettings: GraphSetting): string => {
    const dataRevision = seriesList
        .map((series) => {
            const yRange = getSeriesListRange([series])?.join(':') ?? 'empty';

            return [
                series.key,
                series.end_col_id,
                series.plot_no,
                series.class,
                series.array_x.length,
                series.array_y.length,
                yRange,
                series.chart_infos?.[0]?.['y-min'] ?? '',
                series.chart_infos?.[0]?.['y-max'] ?? '',
            ].join(':');
        })
        .join('|');

    return [
        graphSettings.fontSize,
        graphSettings.theme,
        graphSettings.plotStyle,
        graphSettings.transpose,
        graphSettings.divOrientation,
        graphSettings.yAxis,
        graphSettings.xAxis,
        graphSettings.xDatatype,
        dataRevision,
    ].join('|');
};

const getTickLength = (tick: number | string): number => {
    if (!tick) return 0;
    if (typeof tick === 'number') {
        return Number(tick.toFixed(2)).toString().length;
    }

    return tick.length;
};

const getMaxTickLength = (seriesList: PlotSeries[]): number => {
    let maxLength = 0;

    for (const series of seriesList) {
        if (series.y_axis_category && [PlotPriority.PRIMARY, PlotPriority.MAIN].includes(series.class)) {
            for (const value of series.array_y) {
                maxLength = Math.max(maxLength, getTickLength(value));
            }
        }
    }

    return maxLength;
};

const getThresholdXRange = (series: PlotSeries, chartInfo: NonNullable<PlotSeries['chart_infos_ci']>[number]) => {
    if (chartInfo?.['is-out-of-range']) return undefined;

    const lastIndex = series.array_x.length - 1;
    if (lastIndex < 0) return undefined;

    const rawFrom = Number(chartInfo?.['act-from']);
    const rawTo = Number(chartInfo?.['act-to']);
    if (!Number.isInteger(rawFrom) || !Number.isInteger(rawTo) || rawFrom < 0 || rawTo < 0) {
        return undefined;
    }
    if (rawFrom > rawTo) return undefined;

    // act-from/act-to are computed against the full dataset. Div sub-panels only hold a filtered
    // subset (fewer rows), so clamp to this panel's own range rather than dropping the line
    // entirely.
    const idxFrom = Math.min(rawFrom, lastIndex);
    const idxTo = Math.min(rawTo, lastIndex);

    return [series.array_x[idxFrom], series.array_x[idxTo]];
};

// Public builder: one Plotly figure with shared x-axis ranges and multiple overlaid y-axes per subplot.
export const buildPlotFigure = (
    seriesList: PlotSeries[],
    graphSettings: GraphSetting,
    options: PlotFigureOptions = {},
) => {
    seriesList = seriesList.map((series) =>
        shouldConvertDatetimeToLocal(series, graphSettings) ? applyConvertDatetimeToLocal(series) : series,
    );
    const normalizedSeriesList = applyDefaultSeriesColors(seriesList, graphSettings.theme);
    const subplotCount = (
        options.normalizeSubplots
            ? groupByPlotNo(normalizedSeriesList).length
            : Math.max(...normalizedSeriesList.map((series) => series.plot_no))
    ) as SubplotCount;

    const maximumSubAxis = options.maximumSubAxis ?? getMaximumSubAxisNumber(normalizedSeriesList);
    const maxTickLength = getMaxTickLength(normalizedSeriesList);
    const showLegend = options.showLegend ?? true;
    const reserveLegendSpace = options.reserveLegendSpace ?? showLegend;
    const cells = buildSubplotCells(
        normalizedSeriesList,
        subplotCount,
        graphSettings,
        reserveLegendSpace,
        options.rightAxisReserveRatio,
        maximumSubAxis,
        maxTickLength,
    );
    // In Div mode each sub-panel is a different category group (its own set of x categories,
    // often a different point count), so sub-panels must NOT share/matches an x-axis range —
    // unlike the general (non-Div) case, where every subplot legitimately shares the same x-axis
    // meaning (e.g. one time axis) and syncing zoom/pan across them is desired.
    const isDivModeFigure = Boolean(graphSettings.divSize && graphSettings.numPrimaries);
    // Common x/y scale across a primary's Div sub-panels, so panels are easy to compare visually.
    const divGroupRanges =
        isDivModeFigure && graphSettings.divSize ? getDivGroupRanges(cells, graphSettings.divSize) : null;
    const data: Data[] = [];
    const visibleColorLegendGroups = new Set<string>();
    const layout = buildBaseLayout(graphSettings);
    const yAxisUIRevision = buildPlotUIRevision(normalizedSeriesList, graphSettings);
    layout.showlegend = showLegend;
    layout.margin = {
        ...layout.margin,
        ...options.margin,
    };
    const layoutRecord = layout as Record<string, unknown>;
    let nextExtraYAxisNumber = cells.length + 1;
    const extraYAxisOffset = options.extraYAxisOffset ?? EXTRA_Y_AXIS_OFFSET[graphSettings.fontSize];

    cells.forEach((cell) => {
        const { stacked, percent } = getYAxisMode(graphSettings.yAxis);
        const stackedValues = getStackedValues(cell, graphSettings.yAxis, options.stackedDataCache);
        const { plan, nextYAxisNumber } = buildAxisPlan(cell, nextExtraYAxisNumber, stacked);
        const xAxisKey = axisLayoutKey('xaxis', cell.xAxisNumber);
        const xAxisRef = axisTraceRef('x', cell.xAxisNumber);
        const plotNo = cell.series[0]?.plot_no;
        const isXAxisNumerics = cell.series[0]?.x_axis_numeric;
        const rangeWithNumbers = isXAxisNumerics || cell.series[0].show_x_axis_with_index;
        const isSortByDataOrder = cell.series[0]?.is_sort_by_data_order;
        const isCategoryBoundaryAxis = hasCategoryBoundaryAxis(cell.series[0]);
        const showXAxisLabels =
            (plotNo === undefined ? undefined : options.xAxisLabelsByPlotNo?.[plotNo]) ??
            isLowestCellInColumn(cell, cells);
        nextExtraYAxisNumber = nextYAxisNumber;
        const arrayX: any[] = cell.series[0]?.array_x;
        const minX = Math.min(...arrayX) || 0;
        const maxX = Math.max(...arrayX) || 1;
        const span = isXAxisNumerics && maxX - minX;
        const isXValuedEncoded = cell.series[0].encoded_x_values;
        const showTickVals = isCategoryBoundaryAxis || isXValuedEncoded || isSortByDataOrder;
        const divRange = divGroupRanges?.[Math.floor((cell.xAxisNumber - 1) / (graphSettings.divSize as number))];
        // Common ticks (0..group max, blank label where this panel has no point) only make sense
        // for compact/encoded positions (Cat Value, Index) — Original order keeps each panel's own
        // absolute file-row tick, per the earlier decision to leave that mode as-is.
        const commonTicks =
            divRange && isXValuedEncoded && !isSortByDataOrder
                ? getCommonDivTicks(cell.series[0], divRange.maxTickIndex)
                : null;
        const divGroupSize = graphSettings.divSize as number;
        const divGroupFirstXAxisNumber = isDivModeFigure
            ? Math.floor((cell.xAxisNumber - 1) / divGroupSize) * divGroupSize + 1
            : 1;
        layoutRecord[xAxisKey] = {
            domain: cell.xDomain,
            anchor: cell.primaryYAxis.trace,
            // Zooming/panning one panel should sync the others sharing the same x meaning — in
            // normal mode that's every subplot (one shared x-axis, e.g. time); in Div mode it's
            // only the OTHER sub-panels of the SAME primary (matches its group's first axis, not
            // axis 1 globally), since different primaries/groups now intentionally have different
            // ranges (see getDivGroupRanges above) and matching them all to axis 1 is what caused
            // the earlier clipping bug. All panels within a group already share the identical
            // explicit range/ticks, so linking them here only adds live zoom/pan sync — it can't
            // reintroduce that bug.
            matches:
                cell.xAxisNumber !== divGroupFirstXAxisNumber ? axisTraceRef('x', divGroupFirstXAxisNumber) : undefined,
            title: showXAxisLabels
                ? {
                      text: buildPlotTitle(
                          cell.series[0]?.x_axis_title,
                          '',
                          cell.series[0]?.x_process_name,
                          graphSettings.showProcess,
                          null,
                          fontSize.label[graphSettings.fontSize],
                      ),
                      font: {
                          color: themeColor.text[graphSettings.theme],
                          size: fontSize.label[graphSettings.fontSize],
                      },
                  }
                : undefined,
            showticklabels: showXAxisLabels,
            showgrid: !isCategoryBoundaryAxis,
            gridcolor: themeColor.grid[graphSettings.theme],
            zeroline: false,
            showline: isCategoryBoundaryAxis ? true : undefined,
            linecolor: themeColor.line[graphSettings.theme],
            lineWidth: 1,
            ticks: isCategoryBoundaryAxis ? '' : undefined,
            tickfont: { color: themeColor.text[graphSettings.theme], size: fontSize.tick[graphSettings.fontSize] },
            automargin: true,
            unifiedhovertitle: {
                text: '<span style="font-size:0px"></span>',
            },
            ticktext: commonTicks ? commonTicks.ticktext : showTickVals ? cell.series[0].x_axis_ticktext : undefined,
            tickvals: commonTicks ? commonTicks.tickvals : showTickVals ? cell.series[0].x_axis_tickvals : undefined,
            range: divRange
                ? divRange.xRange
                : showTickVals
                  ? getCategoryBoundaryRange(cell)
                  : rangeWithNumbers
                    ? [minX - span * 0.01, maxX + span * 0.01]
                    : undefined,
            rangemode: isXAxisNumerics ? 'normal' : undefined,
        };

        // Common y-range only applies to the plain/linear case — percent, stacked, and log-scale
        // axes already normalize or auto-range in their own meaningful way, so leave those alone.
        const commonYRange =
            divRange && !percent && !stacked && !usesLogScale(findPrimarySeries(cell), graphSettings.yAxis)
                ? divRange.yRange
                : null;
        layoutRecord[cell.primaryYAxis.layoutKey] = {
            ...buildYAxis(findPrimarySeries(cell), graphSettings, true, cell.subPlotHeight, cell.yDomain),
            ...(commonYRange ? { range: commonYRange, autorange: undefined } : {}),
            anchor: xAxisRef,
            side: 'left',
            showgrid: !isCategoryBoundaryAxis,
            gridcolor: themeColor.grid[graphSettings.theme],
            automargin: true,
            uirevision: yAxisUIRevision,
            showline: true,
            ticks: 'outside',
        };

        plan.extraAxes.forEach(({ axis, series, order, visible }) => {
            layoutRecord[axis.layoutKey] = {
                ...buildYAxis(series, graphSettings, visible, cell.subPlotHeight),
                overlaying: cell.primaryYAxis.trace,
                anchor: 'free',
                side: 'right',
                position: Math.min(cell.xDomain[1] + extraYAxisOffset * order, 0.99),
                showgrid: false,
                uirevision: yAxisUIRevision,
                showline: true,
                ticks: 'outside',
            };
        });

        const isDivMode = Boolean(graphSettings.divSize && graphSettings.numPrimaries);
        const legendOrderedSeries = cell.series
            .map((series, index) => ({ series, index }))
            .sort(
                (a, b) =>
                    Number(b.series.class === PlotPriority.PRIMARY) - Number(a.series.class === PlotPriority.PRIMARY),
            );

        legendOrderedSeries.forEach(({ series, index }) => {
            const colorGroupKey = getColorGroupKey(series);
            // Div mode: dedupe on the same (end_col_id, key) grouping used for the trace's own
            // legendgroup, so a primary variable split across div sub-panels shows one legend entry.
            const dedupeKey = colorGroupKey ?? (isDivMode ? getLegendGroup(series, true) : null);
            const shouldShowLegend = showLegend && (!dedupeKey || !visibleColorLegendGroups.has(dedupeKey));
            if (showLegend && dedupeKey) {
                visibleColorLegendGroups.add(dedupeKey);
            }

            data.push({
                ...buildTrace(
                    series,
                    cell,
                    plan.axisBySeriesIndex[index],
                    graphSettings,
                    stackedValues?.get(series) ?? series.array_y,
                ),
                showlegend: shouldShowLegend,
            } as Data);
        });
    });
    const shapes = [];
    seriesList.forEach((series) => {
        if (series.is_x_axis_binned || series.is_y_axis_binned) {
            return;
        }

        const { yaxis = 'y', xaxis = 'x' } =
            (data.find((d: PlotData) => d.uid === `${series.end_col_id}-${series.plot_no}`) as PlotData) ?? {};
        const chartInfos = series.chart_infos_ci;
        chartInfos.forEach((chartInfo) => {
            const ref = { xaxis: xaxis, yaxis: yaxis };
            const xRange = getThresholdXRange(series, chartInfo);
            if (!xRange) return;

            const lines = genThresholds({}, chartInfo, ref, xRange);
            shapes.push(...lines);
        });
    });
    // add threshold
    layout.shapes = handleDuplicatedLegend(shapes);

    const categoryBoundaryLayout = buildCategoryBoundaryLayout(
        cells,
        graphSettings,
        layout,
        options.categoryBoundaryLabelsByPlotNo,
        options.height,
    );
    layout.shapes = [...layout.shapes, ...categoryBoundaryLayout.shapes];
    layout.annotations = [
        ...data.flatMap((trace) => traceToAnnotations(trace, layoutRecord)),
        ...categoryBoundaryLayout.annotations,
        ...buildFacetLabelAnnotations(cells, graphSettings),
    ];
    //remove text to not duplicated
    for (let i = 0; i < data.length; i++) {
        delete (data[i] as PlotData).text;
    }

    return { data, layout };
};

const traceAxisToLayoutKey = (axisRef: unknown, prefix: 'xaxis' | 'yaxis'): string => {
    if (typeof axisRef !== 'string') return prefix;

    const axisNumber = axisRef.replace(prefix[0], '');
    return axisNumber ? `${prefix}${axisNumber}` : prefix;
};

const getAnnotationPosition = (value: unknown, axisLayout: unknown): unknown => {
    const type = (axisLayout as Partial<Layout['xaxis']> | undefined)?.type;
    if (type !== 'log') return value;

    return typeof value === 'number' && value > 0 ? Math.log10(value) : undefined;
};

const traceToAnnotations = (trace: Data, layoutRecord: Record<string, unknown>): NonNullable<Layout['annotations']> => {
    const annotatedTrace = trace as AnnotatedTrace;
    if (!Array.isArray(annotatedTrace.text) || !Array.isArray(annotatedTrace.x) || !Array.isArray(annotatedTrace.y)) {
        return [];
    }

    const xref = annotatedTrace.xaxis ?? 'x';
    const yref = annotatedTrace.yaxis ?? 'y';
    const xAxisLayout = layoutRecord[traceAxisToLayoutKey(xref, 'xaxis')];
    const yAxisLayout = layoutRecord[traceAxisToLayoutKey(yref, 'yaxis')];
    const traceName = annotatedTrace.name || '';

    return annotatedTrace.text.flatMap((text, i) => {
        if (!text?.trim()) return [];

        const x = getAnnotationPosition(annotatedTrace.x[i], xAxisLayout);
        const y = getAnnotationPosition(annotatedTrace.y[i], yAxisLayout);
        if (x === undefined || y === undefined) return [];

        return {
            x,
            y,
            text,
            xref,
            yref,
            showarrow: false,
            yshift: 10,
            traceName,
        };
    });
};

const genThresholds = (
    xThreshold = {},
    yThreshold = {},
    ref = {
        xaxis: 'paper',
        yaxis: 'y',
    },
    xRange: unknown[] = [0, 1],
    yRange = [0, 1],
) => {
    const lines = [];

    const xLow = xThreshold && xThreshold['thresh-low'];
    const xHigh = xThreshold && xThreshold['thresh-high'];
    const xPrcMin = xThreshold && xThreshold['prc-min'];
    const xPrcMax = xThreshold && xThreshold['prc-max'];

    const yLow = yThreshold && yThreshold['thresh-low'];
    const yHigh = yThreshold && yThreshold['thresh-high'];
    const yPrcMin = yThreshold && yThreshold['prc-min'];
    const yPrcMax = yThreshold && yThreshold['prc-max'];
    const hasValue = (value) => {
        return value !== null && value !== undefined;
    };
    if (hasValue(xLow)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xLow,
            y0: yRange[0],
            x1: xLow,
            y1: yRange[1],
            line: {
                color: CONST.RED,
                width: 0.75,
            },
        });
    }
    if (hasValue(xHigh)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xHigh,
            y0: yRange[0],
            x1: xHigh,
            y1: yRange[1],
            line: {
                color: CONST.RED,
                width: 0.75,
            },
        });
    }
    if (hasValue(yLow)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xRange[0],
            y0: yLow,
            x1: xRange[1],
            y1: yLow,
            line: {
                color: CONST.RED,
                width: 0.75,
            },
            name: 'LCL',
            showlegend: true,
        });
    }
    if (hasValue(yHigh)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xRange[0],
            y0: yHigh,
            x1: xRange[1],
            y1: yHigh,
            line: {
                color: CONST.RED,
                width: 0.75,
            },
            name: 'UCL',
            showlegend: true,
        });
    }
    if (hasValue(xPrcMin)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xPrcMin,
            y0: yRange[0],
            x1: xPrcMin,
            y1: yRange[1],
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
        });
    }
    if (hasValue(xPrcMax)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xPrcMax,
            y0: yRange[0],
            x1: xPrcMax,
            y1: yRange[1],
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
        });
    }
    if (hasValue(yPrcMin)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xRange[0],
            y0: yPrcMin,
            x1: xRange[1],
            y1: yPrcMin,
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
            name: 'LAL',
            showlegend: true,
        });
    }
    if (hasValue(yPrcMax)) {
        lines.push({
            type: 'line',
            xref: ref.xaxis,
            yref: ref.yaxis,
            x0: xRange[0],
            y0: yPrcMax,
            x1: xRange[1],
            y1: yPrcMax,
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
            name: 'UAL',
            showlegend: true,
        });
    }

    return lines;
};

const handleDuplicatedLegend = (shapes: Shape[]): Shape[] => {
    const names = [];
    return shapes.map((shape) => {
        if (!names.includes(shape.name)) {
            names.push(shape.name);
            return shape;
        }
        return {
            ...shape,
            showlegend: false,
        };
    });
};

const applyConvertDatetimeToLocal = (orgSeries: PlotSeries) => {
    const series = {
        ...orgSeries,
        array_x: orgSeries.array_x.map((x: string | Date) => convertUtcToLocal(x, LOCAL_DATETIME_FORMAT)),
    };
    if (
        series.is_x_axis_binned &&
        Array.isArray(series.x_bin_mins) &&
        Array.isArray(series.x_bin_maxs) &&
        series.x_bin_mins.length === series.x_bin_maxs.length
    ) {
        series.x_bin_labels = series.x_bin_mins.map((minValue, index) => {
            const minLabel = convertUtcToLocal(minValue as string | Date, LOCAL_DATETIME_FORMAT);
            const maxLabel = convertUtcToLocal(series.x_bin_maxs?.[index] as string | Date, LOCAL_DATETIME_FORMAT);
            return minLabel === maxLabel ? minLabel : `${minLabel} ~ ${maxLabel}`;
        });
    }
    if (series.text && series.is_datetime_label) {
        series.text = series.text.map((x: string) => convertUtcToLocal(x, LOCAL_DATETIME_FORMAT));
    }
    return series;
};

const shouldConvertDatetimeToLocal = (series: PlotSeries, graphSettings: GraphSetting) =>
    series.x_axis_datatype === DataTypes.DATETIME.name &&
    series.x_axis_numeric !== true &&
    (graphSettings.xAxis === XAxisShowModes.Time || series.is_x_axis_binned);
