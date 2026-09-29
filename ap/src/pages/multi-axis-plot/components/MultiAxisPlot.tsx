import { type CSSProperties, type ChangeEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type { Config, Data, Layout, PlotDatum, PlotRestyleEvent, PlotlyHTMLElement } from 'plotly.js';
import Plotly from 'plotly.js/dist/plotly';

import CategoryAggregate from '@/pages/multi-axis-plot/components/CategoryAggregate.tsx';
import DisplayGraphButton from '@/pages/multi-axis-plot/components/DisplayGraphButton.tsx';
import MaPGraphSettings from '@/pages/multi-axis-plot/components/GraphSettings.tsx';
import PlotContextMenu from '@/pages/multi-axis-plot/components/PlotContextMenu.tsx';
import XAxisSelect, {
    type XDataType,
    getDefaultXAxisOption,
    getXAxisOptions,
} from '@/pages/multi-axis-plot/components/XAxisSelect.tsx';
import { type LayoutData, type SubPlot, useLayoutConfigData } from '@/pages/multi-axis-plot/useLayoutConfigData.ts';

import {
    type GraphSetting,
    YAxisShowModes,
    buildPlotFigure,
    createStackedDataCache,
    getChartBodyHeight,
    themeColor,
} from '../plotBuilder';
import { plotConfig } from '../plotSettings';
import type { PlotSeries, PlotSeriesCollection, SubplotCount } from '../types';
import './MultiAxisPlot.scss';

const defaultSettings: GraphSetting = {
    fontSize: 'base',
    theme: 'dark',
    plotStyle: 'auto',
    transpose: false,
    yAxis: YAxisShowModes.Normal,
    xAxis: 'TIME',
    xDatatype: 'DATETIME',
    showProcess: false,
};

type PlotMode = 'normal' | 'stacked';

type TraceAnnotation = NonNullable<Layout['annotations']>[number] & {
    traceName?: string;
};

const isTraceVisible = (trace: Data): boolean => {
    const visible = (trace as { visible?: boolean | 'legendonly' }).visible;
    return visible !== false && visible !== 'legendonly';
};

const syncTraceAnnotationVisibility = (
    plot: PlotlyHTMLElement,
    annotationTraceNames: Array<string | undefined>,
    traceIndices: number[],
): void => {
    const visibilityByTraceName = new Map<string, boolean>();
    traceIndices.forEach((traceIndex) => {
        const trace = plot.data[traceIndex];
        if (trace?.name) {
            visibilityByTraceName.set(trace.name, isTraceVisible(trace));
        }
    });

    const annotationVisibilityUpdate: Record<string, boolean> = {};

    annotationTraceNames.forEach((traceName, annotationIndex) => {
        if (!traceName || !visibilityByTraceName.has(traceName)) return;

        const visible = visibilityByTraceName.get(traceName) as boolean;
        const annotation = plot.layout.annotations?.[annotationIndex];
        if ((annotation?.visible !== false) === visible) return;

        annotationVisibilityUpdate[`annotations[${annotationIndex}].visible`] = visible;
    });

    // Apply every annotation visibility change from one legend action in a single Plotly update.
    if (Object.keys(annotationVisibilityUpdate).length > 0) {
        void Plotly.relayout(plot, annotationVisibilityUpdate as Partial<Layout>);
    }
};

const normalizeXOption = (xOption: string, xDatatype?: string) => {
    const options = getXAxisOptions(xDatatype);
    return options.some((option) => String(option.value) === xOption) ? xOption : getDefaultXAxisOption(xDatatype);
};

const getPlotMode = (yAxis: YAxisShowModes): PlotMode =>
    yAxis === YAxisShowModes.Stack ||
    yAxis === YAxisShowModes.PercentStack ||
    yAxis === YAxisShowModes.BinStack ||
    yAxis === YAxisShowModes.BinPercentStack
        ? 'stacked'
        : 'normal';

const normalizePlotDataGroups = (data: PlotSeriesCollection): PlotSeries[][] => {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    const plotDataGroups = Array.isArray(data[0]) ? (data as PlotSeries[][]) : [data as PlotSeries[]];

    return plotDataGroups.filter((plotData) => Array.isArray(plotData) && plotData.length > 0);
};

const getDefaultPlotStyle = (plotDataGroups: PlotSeries[][]): string => {
    const maxDataPointCount = Math.max(
        0,
        ...plotDataGroups.flatMap((plotData) => plotData.map((series) => series.array_y?.length ?? 0)),
    );

    return maxDataPointCount <= 128 ? 'auto' : 'markers';
};

const DEFAULT_DATA_POINT_LIMIT = 8192;
const DATA_POINT_LABEL_LIMIT = 128;
const COMPLETE_NTH_VALUE_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/;

function DataPointLimitModal({ layout, onClose }: { layout: Partial<LayoutData>; onClose: () => void }) {
    const { t } = useTranslation();
    const formattedLimit = DEFAULT_DATA_POINT_LIMIT.toLocaleString();
    const [nthValue, setNthValue] = useState('1');

    const handleNthValueChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        if (/^-?(?:\d+\.?\d*|\.\d*)?$/.test(nextValue)) {
            setNthValue(nextValue);
        }
    };

    const handleDisplayWindow = (windowSize: number, showLabels: boolean) => {
        const requestNthValue = COMPLETE_NTH_VALUE_PATTERN.test(nthValue) ? nthValue : '1';
        if (requestNthValue !== nthValue) {
            setNthValue(requestNthValue);
        }
        window.requestMapDataPointWindow?.(requestNthValue, windowSize, showLabels);
        onClose();
    };

    const handleOnClickJumpToFPP = () => {
        jumpFromMAPToFPP(layout);
        onClose();
    };

    return (
        <div className="multi-axis-plot-limit-modal" role="dialog" aria-modal="true">
            <div className="multi-axis-plot-limit-modal__title">
                {t('Data count exceeds {{limit}}.', { limit: formattedLimit })}
            </div>
            <div className="multi-axis-plot-limit-modal__row">
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--jump"
                    onClick={handleOnClickJumpToFPP}
                >
                    {t('Jump to FPP')}
                </button>
                <span>{t('Display in FPP high-speed mode (opens in a new page)')}</span>
            </div>
            <div className="multi-axis-plot-limit-modal__data-options">
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--primary"
                    onClick={() => handleDisplayWindow(DEFAULT_DATA_POINT_LIMIT, false)}
                >
                    {DEFAULT_DATA_POINT_LIMIT}
                </button>
                <label className="multi-axis-plot-limit-modal__nth">
                    <input
                        type="text"
                        inputMode="decimal"
                        pattern="-?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)?"
                        aria-label={t('Nth')}
                        value={nthValue}
                        onChange={handleNthValueChange}
                    />
                </label>
                <span>
                    {t('Show only the first n-th {{limit}} data points (no labels)', { limit: formattedLimit })}
                </span>
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--primary"
                    onClick={() => handleDisplayWindow(DATA_POINT_LABEL_LIMIT, true)}
                >
                    {DATA_POINT_LABEL_LIMIT}
                </button>
                <span>
                    {t(
                        'Show only the first n-th {{limit}} data points (with labels) *Negative values count from the end',
                        { limit: DATA_POINT_LABEL_LIMIT },
                    )}
                </span>
            </div>
            <div className="multi-axis-plot-limit-modal__row">
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--cancel"
                    onClick={onClose}
                >
                    {t('Cancel')}
                </button>
            </div>
        </div>
    );
}

function LabDataPointLimitModal({
    onClose,
    actualRecordNumber,
}: {
    onClose: () => void;
    actualRecordNumber: number | null;
}) {
    const { t } = useTranslation();
    const [nthValue, setNthValue] = useState('1');

    const handleNthValueChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        if (/^-?(?:\d+\.?\d*|\.\d*)?$/.test(nextValue)) {
            setNthValue(nextValue);
        }
    };

    const handleOnClickContinue = () => {
        // Show every data point by index, without labels — no windowing/slicing.
        const fullWindowSize =
            actualRecordNumber && actualRecordNumber > 0 ? actualRecordNumber : DATA_POINT_LABEL_LIMIT;
        window.requestMapDataPointWindow?.('1', fullWindowSize, false);
        onClose();
    };

    const handleDisplayWindow = (windowSize: number, showLabels: boolean) => {
        const requestNthValue = COMPLETE_NTH_VALUE_PATTERN.test(nthValue) ? nthValue : '1';
        if (requestNthValue !== nthValue) {
            setNthValue(requestNthValue);
        }
        window.requestMapDataPointWindow?.(requestNthValue, windowSize, showLabels);
        onClose();
    };

    return (
        <div className="multi-axis-plot-limit-modal" role="dialog" aria-modal="true">
            <div className="multi-axis-plot-limit-modal__title">
                {t('Data count exceeds {{limit}}.', { limit: DATA_POINT_LABEL_LIMIT })}
            </div>
            <div className="multi-axis-plot-limit-modal__row">
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--jump"
                    onClick={handleOnClickContinue}
                >
                    {t('Continue')}
                </button>
                <span>{t('Show data as index only, without labels')}</span>
            </div>
            <div className="multi-axis-plot-limit-modal__data-options multi-axis-plot-limit-modal__data-options--single-row">
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--primary"
                    onClick={() => handleDisplayWindow(DATA_POINT_LABEL_LIMIT, true)}
                >
                    {DATA_POINT_LABEL_LIMIT}
                </button>
                <label style={{ marginBottom: '0px' }} className="multi-axis-plot-limit-modal__nth">
                    <input
                        type="text"
                        inputMode="decimal"
                        pattern="-?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)?"
                        aria-label={t('Nth')}
                        value={nthValue}
                        onChange={handleNthValueChange}
                    />
                </label>
                <span>
                    {t(
                        'Show only the first n-th {{limit}} data points (with labels) *Negative values count from the end',
                        { limit: DATA_POINT_LABEL_LIMIT },
                    )}
                </span>
            </div>
            <div className="multi-axis-plot-limit-modal__row">
                <button
                    type="button"
                    className="multi-axis-plot-limit-modal__button multi-axis-plot-limit-modal__button--cancel"
                    onClick={onClose}
                >
                    {t('Cancel')}
                </button>
            </div>
        </div>
    );
}

type PlotlyReactChartProps = {
    data: Data[];
    layout: Partial<Layout>;
    config: Partial<Config>;
    mode: PlotMode;
    className: string;
    style: CSSProperties;
    hoveredPointRef: RefObject<PlotDatum | null>;
};

function PlotlyReactChart({ data, layout, config, mode, className, style, hoveredPointRef }: PlotlyReactChartProps) {
    const normalPlotRef = useRef<HTMLDivElement | null>(null);
    const stackedPlotRef = useRef<HTMLDivElement | null>(null);
    const getActivePlot = (): any => (mode === 'stacked' ? stackedPlotRef.current : normalPlotRef.current);
    useEffect(() => {
        const activePlot = getActivePlot() as PlotlyHTMLElement;
        if (!activePlot) return;
        const annotationTraceNames = ((layout.annotations ?? []) as TraceAnnotation[]).map(
            (annotation) => annotation.traceName,
        );
        const onHover = (event) => {
            hoveredPointRef.current = event.points[0];
        };
        const unHover = () => {
            hoveredPointRef.current = null;
        };
        const onRestyle = (event?: PlotRestyleEvent) => {
            const [update, traceIndices] = event ?? [];
            if (!update || !Object.prototype.hasOwnProperty.call(update, 'visible') || !Array.isArray(traceIndices)) {
                return;
            }

            syncTraceAnnotationVisibility(activePlot, annotationTraceNames, traceIndices);
        };

        void Plotly.react(activePlot, data, layout, config);

        activePlot.on('plotly_hover', onHover);
        activePlot.on('plotly_unhover', unHover);
        activePlot.on('plotly_restyle', onRestyle);
        return () => {
            activePlot.removeAllListeners('plotly_hover');
            activePlot.removeAllListeners('plotly_unhover');
            activePlot.removeAllListeners('plotly_restyle');
        };
    }, [data, layout, config, mode]);

    useEffect(() => {
        const resizePlot = () => {
            const activePlot = getActivePlot();
            if (activePlot) {
                void Plotly.Plots.resize(activePlot);
            }
        };

        window.addEventListener('resize', resizePlot);
        return () => {
            window.removeEventListener('resize', resizePlot);
        };
    }, [mode]);

    useEffect(
        () => () => {
            if (normalPlotRef.current) {
                Plotly.purge(normalPlotRef.current);
            }
            if (stackedPlotRef.current) {
                Plotly.purge(stackedPlotRef.current);
            }
        },
        [],
    );

    return (
        <div className={className} style={{ ...style, position: 'relative', overflow: 'hidden' }}>
            <div
                ref={normalPlotRef}
                data-plotly-active={mode === 'normal'}
                style={{
                    position: 'absolute',
                    inset: 0,
                    visibility: mode === 'normal' ? 'visible' : 'hidden',
                    pointerEvents: mode === 'normal' ? 'auto' : 'none',
                }}
            />
            <div
                ref={stackedPlotRef}
                data-plotly-active={mode === 'stacked'}
                style={{
                    position: 'absolute',
                    inset: 0,
                    visibility: mode === 'stacked' ? 'visible' : 'hidden',
                    pointerEvents: mode === 'stacked' ? 'auto' : 'none',
                }}
            />
        </div>
    );
}

type MultiAxisPlotChartProps = {
    chartIndex: number;
    graphSettings: GraphSetting;
    plotData: PlotSeries[];
    onClickShowGraph: any;
};

function MultiAxisPlotChart({ chartIndex, graphSettings, plotData, onClickShowGraph }: MultiAxisPlotChartProps) {
    const hoveredPointRef = useRef<PlotDatum | null>(null);
    const subplotCount = Math.max(...plotData.map((series) => series.plot_no)) as SubplotCount;
    const chartHeight = getChartBodyHeight(subplotCount);
    const plotMode = getPlotMode(graphSettings.yAxis);
    const stackedDataCache = useMemo(() => createStackedDataCache(), [plotData]);
    const plotFigure = useMemo(
        () => buildPlotFigure(plotData, graphSettings, { stackedDataCache, height: chartHeight }),
        [
            plotData,
            stackedDataCache,
            chartHeight,
            graphSettings.fontSize,
            graphSettings.theme,
            graphSettings.plotStyle,
            graphSettings.transpose,
            graphSettings.yAxis,
            graphSettings.xAxis,
            graphSettings.xDatatype,
            graphSettings.showProcess,
        ],
    );

    return (
        <div
            className="multi-axis-plot__chart"
            data-chart-index={chartIndex}
            style={{
                backgroundColor: themeColor.background[graphSettings.theme],
                color: themeColor.text[graphSettings.theme],
                height: chartHeight,
            }}
        >
            <PlotContextMenu
                onClickShowGraph={onClickShowGraph}
                hoveredPointRef={hoveredPointRef}
                graphSettings={graphSettings}
                visiblePlotData={plotData}
            >
                <PlotlyReactChart
                    hoveredPointRef={hoveredPointRef}
                    data={plotFigure.data}
                    layout={plotFigure.layout}
                    config={plotConfig}
                    mode={plotMode}
                    className="multi-axis-plot__plot"
                    style={{ width: '100%', height: '100%' }}
                />
            </PlotContextMenu>
        </div>
    );
}

export default function MultiAxisPlot() {
    const [graphSettings, setGraphSettings] = useState<GraphSetting>(defaultSettings);
    const [guiPortalNode, setGuiPortalNode] = useState<HTMLElement | null>(null);
    const [plotDataGroups, setPlotDataGroups] = useState<PlotSeries[][]>([]);
    const { collectLayoutData, layout, getLayoutState } = useLayoutConfigData();
    const [xDatatype, setXDatatype] = useState('DATETIME');
    const [xOption, setXOption] = useState('TIME');
    const [isDisableYOptions, setDisableYOptions] = useState<boolean>(false);
    const [isDataPointLimitModalOpen, setIsDataPointLimitModalOpen] = useState(false);
    const [isLabLimitModalOpen, setIsLabLimitModalOpen] = useState(false);
    const [labLimitActualRecordNumber, setLabLimitActualRecordNumber] = useState<number | null>(null);
    const [isShowCategoryAggregate, setIsShowCategoryAggregate] = useState<boolean>(false);
    const pendingYAxisRef = useRef<YAxisShowModes | null>(null);

    useEffect(() => {
        const nextXDatatype = layout.x_datatype ?? 'DATETIME';
        setXDatatype(nextXDatatype);
        const nextXOption = normalizeXOption(xOption, nextXDatatype);
        setXOption(nextXOption);
        if (layout.sub_plots.length && isIncludeAutoOr2nd(layout.sub_plots)) {
            setDisableYOptions(true);
        } else {
            setDisableYOptions(false);
        }
        setIsShowCategoryAggregate(nextXDatatype === 'CAT');
    }, [layout]);

    useEffect(() => {
        window.collectLayoutData = collectLayoutData;
        window.getLayoutState = getLayoutState;
        window.setMapXOption = (value: string) => {
            setXOption(normalizeXOption(value, xDatatype));
        };
        window.setMapPlotData = (
            data: PlotSeriesCollection,
            showProcessName: boolean,
            meta?: {
                dataPointLimitExceeded?: boolean;
                labLimitExceeded?: boolean;
                actualRecordNumber?: number;
                divSize?: number;
                numPrimaries?: number;
                divOrientation?: number;
            },
        ) => {
            const pendingYAxis = pendingYAxisRef.current;
            pendingYAxisRef.current = null;
            const nextPlotDataGroups = normalizePlotDataGroups(data);
            setGraphSettings((prev) => ({
                ...prev,
                showProcess: showProcessName,
                plotStyle: getDefaultPlotStyle(nextPlotDataGroups),
                divSize: meta?.divSize,
                numPrimaries: meta?.numPrimaries,
                divOrientation: meta?.divOrientation,
                ...(pendingYAxis ? { yAxis: pendingYAxis } : {}),
            }));
            setPlotDataGroups(nextPlotDataGroups);
            if (meta?.dataPointLimitExceeded) {
                setIsDataPointLimitModalOpen(true);
                setIsLabLimitModalOpen(false);
            } else {
                setIsDataPointLimitModalOpen(false);
                setIsLabLimitModalOpen(Boolean(meta?.labLimitExceeded));
                setLabLimitActualRecordNumber(
                    typeof meta?.actualRecordNumber === 'number' ? meta.actualRecordNumber : null,
                );
            }
        };
        return () => {
            delete window.collectLayoutData;
            delete window.getLayoutState;
            delete window.setMapXOption;
            delete window.setMapPlotData;
        };
    }, [collectLayoutData, getLayoutState, xDatatype]);

    useEffect(() => {
        const guiNode = document.getElementById('xAxisGuiArea');
        if (guiNode) {
            setGuiPortalNode(guiNode);
        }
    }, []);

    const handleClickShowGraph = () => {
        clearOnFlyFilter = true;
        const currentLayout = collectLayoutData();
        const nextXDatatype = currentLayout.x_datatype ?? xDatatype;
        const nextXOption = normalizeXOption(xOption, nextXDatatype);
        setXDatatype(nextXDatatype);
        setXOption(nextXOption);
        setGraphSettings({
            ...graphSettings,
            xAxis: nextXOption,
            xDatatype: nextXDatatype,
        });
    };

    const handleOnchange = (value) => {
        setXOption(value);
    };

    const handleYAxisChange = (yAxis: YAxisShowModes, shouldReloadPlotData: boolean) => {
        if (!shouldReloadPlotData) {
            setGraphSettings((prev) => ({
                ...prev,
                yAxis,
            }));
            return true;
        }

        pendingYAxisRef.current = yAxis;
        window.setTimeout(() => {
            if (!mapTracing()) {
                pendingYAxisRef.current = null;
            }
        }, 0);
        return true;
    };

    const isIncludeAutoOr2nd = (subPlots: SubPlot[]): boolean => {
        return subPlots.some((plot) => (plot.sub && plot.sub.length) || (plot.add && plot.add.length));
    };

    return (
        <>
            {guiPortalNode &&
                createPortal(
                    <XAxisSelect
                        id="xOption"
                        onChange={handleOnchange}
                        xOptionValue={xOption}
                        xType={xDatatype as XDataType}
                        cssClass="w-auto"
                        name="xOption"
                        label=""
                    />,
                    guiPortalNode,
                )}

            <CategoryAggregate isShow={isShowCategoryAggregate} />
            <CategoryAggregate isShow={isShowCategoryAggregate} prefix="term" />

            <DisplayGraphButton onClickShowGraph={handleClickShowGraph}></DisplayGraphButton>
            <MaPGraphSettings
                isDisableYOptions={isDisableYOptions}
                graphSettings={graphSettings}
                setGraphSettings={setGraphSettings}
                xOptionValue={xOption}
                onXAxisChange={setXOption}
                onYAxisChange={handleYAxisChange}
                visiblePlotDataGroups={plotDataGroups}
                layout={layout}
            />
            <section id="multi-axis-plot" data-component="MultiAxisPlot">
                <div className="multi-axis-plot__charts">
                    {plotDataGroups.map((plotData, index) => (
                        <MultiAxisPlotChart
                            onClickShowGraph={handleClickShowGraph}
                            key={`multi-axis-plot-chart-${index}`}
                            chartIndex={index}
                            graphSettings={graphSettings}
                            plotData={plotData}
                        />
                    ))}
                </div>
            </section>
            {isDataPointLimitModalOpen && (
                <DataPointLimitModal onClose={() => setIsDataPointLimitModalOpen(false)} layout={layout} />
            )}
            {isLabLimitModalOpen && (
                <LabDataPointLimitModal
                    onClose={() => setIsLabLimitModalOpen(false)}
                    actualRecordNumber={labLimitActualRecordNumber}
                />
            )}
        </>
    );
}
