import {
    type MouseEvent,
    type MutableRefObject,
    type ReactNode,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';
import type { PlotDatum } from 'plotly.js';

import { triggerNativeChange } from '@/shared/utils/helpers.ts';

import { type GraphSetting, applyDefaultSeriesColors } from '../plotBuilder';
import { type ExportImageSize, copyPlotToClipboard, savePlotAsPng } from '../plotExport';
import type { PlotSeries } from '../types';

type Props = {
    children: ReactNode;
    graphSettings: GraphSetting;
    visiblePlotData: PlotSeries[];
    hoveredPointRef: RefObject<PlotDatum | null>;
    onClickShowGraph: any;
};

type MenuState = {
    plotNumber: number;
    exportSize: ExportImageSize;
    panelExportSize: ExportImageSize;
    showXAxisLabels: boolean;
    showCategoryBoundaryLabels: boolean;
    plotExportOptions: {
        margin: typeof PLOT_EXPORT_MARGIN;
        rightAxisReserveRatio: number;
        maximumSubAxis: number;
        extraYAxisOffset: number;
    };
    x: number;
    y: number;
};

const MENU_WIDTH = 190;
const MENU_HEIGHT = 190;
const VIEWPORT_PADDING = 8;
const PLOT_EXPORT_MARGIN = {
    t: 20,
    r: 96,
    b: 52,
    l: 56,
};
const PLOT_EXPORT_TOP_MARGIN = 20;
const PLOT_EXPORT_RIGHT_MARGIN = 96;
const PLOT_EXPORT_BOTTOM_MARGIN_WITH_X_LABELS = 52;
const PLOT_EXPORT_BOTTOM_MARGIN_WITHOUT_X_LABELS = 20;
const PLOT_EXPORT_LEFT_MARGIN = 56;
const PLOT_EXPORT_EXTRA_Y_AXIS_OFFSET = {
    base: 0.04,
    s: 0.04,
    m: 0.045,
    l: 0.05,
    xl: 0.06,
};

type PlotlyHTMLElement = HTMLElement & {
    _fullLayout?: Record<string, { domain?: [number, number] }>;
};

const getActivePlotContainer = (container: HTMLElement): HTMLElement =>
    container.querySelector<HTMLElement>('[data-plotly-active="true"]') ?? container;

const getElementExportSize = (element: Element): ExportImageSize => {
    const bounds = element.getBoundingClientRect();

    return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
    };
};

const isSameSubplotColumn = (first: DOMRect, second: DOMRect): boolean => Math.abs(first.left - second.left) < 2;

const isLowestSubplotInColumn = (targetRegion: SVGElement, subplotRegions: SVGElement[]): boolean => {
    const targetBounds = targetRegion.getBoundingClientRect();

    return !subplotRegions.some((region) => {
        const bounds = region.getBoundingClientRect();

        return isSameSubplotColumn(targetBounds, bounds) && bounds.top > targetBounds.top;
    });
};

const isHighestSubplotInColumn = (targetRegion: SVGElement, subplotRegions: SVGElement[]): boolean => {
    const targetBounds = targetRegion.getBoundingClientRect();

    return !subplotRegions.some((region) => {
        const bounds = region.getBoundingClientRect();

        return isSameSubplotColumn(targetBounds, bounds) && bounds.top < targetBounds.top;
    });
};

const getVisibleSecondaryAxisCount = (plotData: PlotSeries[]): number =>
    plotData.filter((series) => series.class === 'sub').length;

const getPlotDataWithVisibleColors = (
    visiblePlotData: PlotSeries[],
    plotNumber: number,
    theme: string,
): PlotSeries[] => {
    const normalizedVisiblePlotData = applyDefaultSeriesColors(visiblePlotData, theme);

    return normalizedVisiblePlotData.filter((series) => series.plot_no === plotNumber);
};

const xAxisLayoutKey = (axisNumber: number): string => (axisNumber === 1 ? 'xaxis' : `xaxis${axisNumber}`);

const getXAxisDomainWidth = (panel: Element, axisNumber: number): number | undefined => {
    const domain = (panel as PlotlyHTMLElement)._fullLayout?.[xAxisLayoutKey(axisNumber)]?.domain;
    if (!domain) return undefined;

    const [start, end] = domain;
    const domainWidth = end - start;

    return domainWidth > 0 ? domainWidth : undefined;
};

const getExportExtraYAxisOffset = (
    plotAreaWidth: number,
    panel: Element,
    axisNumber: number,
    secondaryAxisCount: number,
    fontSize: GraphSetting['fontSize'],
): number => {
    const chartOffset = PLOT_EXPORT_EXTRA_Y_AXIS_OFFSET[fontSize];
    const xDomainWidth = getXAxisDomainWidth(panel, axisNumber);
    if (!xDomainWidth || secondaryAxisCount === 0) return chartOffset;

    const chartPaperWidth = plotAreaWidth / xDomainWidth;
    const chartOffsetWidth = chartOffset * chartPaperWidth;

    return chartOffsetWidth / (plotAreaWidth + secondaryAxisCount * chartOffsetWidth);
};

const getPlotExportGeometry = (
    plotArea: ExportImageSize,
    showXAxisLabels: boolean,
    secondaryAxisCount: number,
    extraYAxisOffset: number,
): {
    size: ExportImageSize;
    margin: typeof PLOT_EXPORT_MARGIN;
    rightAxisReserveRatio: number;
    maximumSubAxis: number;
    extraYAxisOffset: number;
} => {
    const rightAxisReserveRatio = secondaryAxisCount * extraYAxisOffset;
    const margin = {
        ...PLOT_EXPORT_MARGIN,
        r: PLOT_EXPORT_RIGHT_MARGIN,
        b: showXAxisLabels ? PLOT_EXPORT_BOTTOM_MARGIN_WITH_X_LABELS : PLOT_EXPORT_BOTTOM_MARGIN_WITHOUT_X_LABELS,
    };
    const plotPaperWidth = plotArea.width / (1 - rightAxisReserveRatio);

    return {
        size: {
            width: plotPaperWidth + PLOT_EXPORT_LEFT_MARGIN + PLOT_EXPORT_RIGHT_MARGIN,
            height: plotArea.height + PLOT_EXPORT_TOP_MARGIN + margin.b,
        },
        margin,
        rightAxisReserveRatio,
        maximumSubAxis: secondaryAxisCount,
        extraYAxisOffset,
    };
};

const getTargetPlotNumber = (
    container: HTMLElement,
    clientX: number,
    clientY: number,
    visiblePlotNumbers: number[],
    visiblePlotData: PlotSeries[],
    graphSettings: GraphSetting,
): {
    plotNumber: number;
    exportSize: ExportImageSize;
    panelExportSize: ExportImageSize;
    showXAxisLabels: boolean;
    showCategoryBoundaryLabels: boolean;
    plotExportOptions: MenuState['plotExportOptions'];
} | null => {
    const activePlotContainer = getActivePlotContainer(container);
    const subplotRegions = Array.from(activePlotContainer.querySelectorAll<SVGElement>('.nsewdrag[data-subplot]'));
    const targetRegion = subplotRegions.find((region) => {
        const bounds = region.getBoundingClientRect();

        return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
    });

    if (!targetRegion) {
        return null;
    }

    const subplotId = targetRegion.dataset.subplot ?? '';
    const axisNumber = Number(subplotId.match(/^x(\d*)y/)?.[1] || 1);
    const plotNumber = visiblePlotNumbers[axisNumber - 1];

    if (!plotNumber) {
        return null;
    }

    const showXAxisLabels = isLowestSubplotInColumn(targetRegion, subplotRegions);
    const showCategoryBoundaryLabels = isHighestSubplotInColumn(targetRegion, subplotRegions);
    const panel = activePlotContainer.querySelector('.js-plotly-plot') ?? activePlotContainer;
    const plotData = getPlotDataWithVisibleColors(visiblePlotData, plotNumber, graphSettings.theme);
    const plotArea = getElementExportSize(targetRegion);
    const secondaryAxisCount = getVisibleSecondaryAxisCount(plotData);
    const plotExportGeometry = getPlotExportGeometry(
        plotArea,
        showXAxisLabels,
        secondaryAxisCount,
        getExportExtraYAxisOffset(plotArea.width, panel, axisNumber, secondaryAxisCount, graphSettings.fontSize),
    );

    return {
        plotNumber,
        exportSize: plotExportGeometry.size,
        panelExportSize: getElementExportSize(panel),
        showXAxisLabels,
        showCategoryBoundaryLabels,
        plotExportOptions: {
            margin: plotExportGeometry.margin,
            rightAxisReserveRatio: plotExportGeometry.rightAxisReserveRatio,
            maximumSubAxis: plotExportGeometry.maximumSubAxis,
            extraYAxisOffset: plotExportGeometry.extraYAxisOffset,
        },
    };
};

export default function PlotContextMenu({
    children,
    graphSettings,
    visiblePlotData,
    hoveredPointRef,
    onClickShowGraph,
}: Props) {
    const { t } = useTranslation();
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isDisableCopyToClipboard, setIsDisableCopyToClipboard] = useState<boolean>(false);
    const [datePoint, setDatePoint] = useState(null);
    const isCT = graphSettings.xDatatype === DataTypes.DATETIME.name;

    useEffect(() => {
        if (!menu) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeMenu();
            }
        };

        window.addEventListener('click', closeMenu);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [menu]);

    useEffect(() => {
        const hostName = window.location.hostname;
        if (!['localhost', '127.0.0.1'].includes(hostName)) {
            setIsDisableCopyToClipboard(true);
        }
    }, []);

    const visiblePlotNumbers = [...new Set(visiblePlotData.map((series) => series.plot_no))].sort(
        (plotNumberA, plotNumberB) => plotNumberA - plotNumberB,
    );

    const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        const targetPlot = getTargetPlotNumber(
            event.currentTarget,
            event.clientX,
            event.clientY,
            visiblePlotNumbers,
            visiblePlotData,
            graphSettings,
        );

        if (!targetPlot) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (hoveredPointRef.current) {
            const { x } = hoveredPointRef.current;
            setDatePoint(x);
        }
        setMenu({
            plotNumber: targetPlot.plotNumber,
            exportSize: targetPlot.exportSize,
            panelExportSize: targetPlot.panelExportSize,
            showXAxisLabels: targetPlot.showXAxisLabels,
            showCategoryBoundaryLabels: targetPlot.showCategoryBoundaryLabels,
            plotExportOptions: targetPlot.plotExportOptions,
            x: Math.max(VIEWPORT_PADDING, Math.min(event.clientX, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING)),
            y: Math.max(VIEWPORT_PADDING, Math.min(event.clientY, window.innerHeight - MENU_HEIGHT - VIEWPORT_PADDING)),
        });
    };

    const runPlotAction = async (action: (plotData: PlotSeries[]) => Promise<void>) => {
        if (!menu || isProcessing) {
            return;
        }

        const plotData = getPlotDataWithVisibleColors(visiblePlotData, menu.plotNumber, graphSettings.theme);
        setIsProcessing(true);

        try {
            await action(plotData);
            setMenu(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const runPanelAction = async (action: (plotData: PlotSeries[]) => Promise<void>) => {
        if (!menu || isProcessing) {
            return;
        }

        setIsProcessing(true);

        try {
            await action(visiblePlotData);
            setMenu(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const closeMenu = () => setMenu(null);

    const handleChangeDateTimeRange = (from: boolean, to: boolean) => {
        if (!datePoint) return;
        const el = document.getElementById('datetimeRangePicker') as HTMLInputElement;
        const selectDateTimeRange = el.value;
        const [starting, ending] = selectDateTimeRange.split(DATETIME_PICKER_SEPARATOR);
        if (from) {
            const timeRange = `${datePoint}${DATETIME_PICKER_SEPARATOR}${ending}`;
            triggerNativeChange(el, timeRange);
        }
        if (to) {
            let dpoint: any = dayjs(datePoint);
            if (dpoint.second() > 0) {
                dpoint = dpoint.add(1, 'minute').format(DATE_FORMAT_WITHOUT_TZ);
            }
            const timeRange = `${starting}${DATETIME_PICKER_SEPARATOR}${dpoint}`;
            triggerNativeChange(el, timeRange);
        }
        if (mapTracing()) {
            onClickShowGraph();
        }

        closeMenu();
    };

    return (
        <div className="multi-axis-plot__context-target" onContextMenuCapture={handleContextMenu}>
            {children}
            {menu
                ? createPortal(
                      <ul
                          className="context-menu"
                          role="menu"
                          style={{ left: menu.x, top: menu.y }}
                          onClick={(event) => event.stopPropagation()}
                          onContextMenu={(event) => event.preventDefault()}
                      >
                          {isCT && (
                              <>
                                  <div className="multi-axis-plot__context-menu-label">Plot Range Adjustment</div>
                                  <li
                                      role="menuitem"
                                      className={
                                          !hoveredPointRef.current ? 'menu-item menu-item-disabled' : 'menu-item'
                                      }
                                      aria-disabled={!hoveredPointRef.current}
                                      onClick={() => handleChangeDateTimeRange(true, false)}
                                  >
                                      From
                                  </li>
                                  <li
                                      role="menuitem"
                                      className={
                                          !hoveredPointRef.current ? 'menu-item menu-item-disabled' : 'menu-item'
                                      }
                                      aria-disabled={!hoveredPointRef.current}
                                      onClick={() => handleChangeDateTimeRange(false, true)}
                                  >
                                      To
                                  </li>
                              </>
                          )}

                          <div className="multi-axis-plot__context-menu-label">Plot</div>
                          <li
                              role="menuitem"
                              className="menu-item"
                              aria-disabled={isProcessing}
                              onClick={() =>
                                  void runPlotAction((plotData) =>
                                      savePlotAsPng(
                                          plotData,
                                          graphSettings,
                                          `multi-axis-plot-${menu.plotNumber}`,
                                          menu.exportSize,
                                          {
                                              figureOptions: {
                                                  showLegend: false,
                                                  normalizeSubplots: true,
                                                  reserveLegendSpace: false,
                                                  xAxisLabelsByPlotNo: {
                                                      [menu.plotNumber]: menu.showXAxisLabels,
                                                  },
                                                  categoryBoundaryLabelsByPlotNo: {
                                                      [menu.plotNumber]: menu.showCategoryBoundaryLabels,
                                                  },
                                                  margin: menu.plotExportOptions.margin,
                                                  rightAxisReserveRatio: menu.plotExportOptions.rightAxisReserveRatio,
                                                  maximumSubAxis: menu.plotExportOptions.maximumSubAxis,
                                                  extraYAxisOffset: menu.plotExportOptions.extraYAxisOffset,
                                              },
                                          },
                                      ),
                                  )
                              }
                          >
                              {t('Save to PNG')}
                          </li>
                          <li
                              role="menuitem"
                              className={isDisableCopyToClipboard ? 'menu-item menu-item-disabled' : 'menu-item'}
                              aria-disabled={isProcessing || isDisableCopyToClipboard}
                              onClick={() =>
                                  void runPlotAction((plotData) =>
                                      copyPlotToClipboard(plotData, graphSettings, menu.exportSize, {
                                          figureOptions: {
                                              showLegend: false,
                                              normalizeSubplots: true,
                                              reserveLegendSpace: false,
                                              xAxisLabelsByPlotNo: {
                                                  [menu.plotNumber]: menu.showXAxisLabels,
                                              },
                                              categoryBoundaryLabelsByPlotNo: {
                                                  [menu.plotNumber]: menu.showCategoryBoundaryLabels,
                                              },
                                              margin: menu.plotExportOptions.margin,
                                              rightAxisReserveRatio: menu.plotExportOptions.rightAxisReserveRatio,
                                              maximumSubAxis: menu.plotExportOptions.maximumSubAxis,
                                              extraYAxisOffset: menu.plotExportOptions.extraYAxisOffset,
                                          },
                                      }),
                                  )
                              }
                          >
                              {t('Copy to Clipboard')}
                          </li>
                          <div className="multi-axis-plot__context-menu-separator" />
                          <div className="multi-axis-plot__context-menu-label">Panel</div>
                          <li
                              role="menuitem"
                              className="menu-item"
                              aria-disabled={isProcessing}
                              onClick={() =>
                                  void runPanelAction((plotData) =>
                                      savePlotAsPng(
                                          plotData,
                                          graphSettings,
                                          'multi-axis-plot-panel',
                                          menu.panelExportSize,
                                      ),
                                  )
                              }
                          >
                              {t('Save to PNG')}
                          </li>
                          <li
                              role="menuitem"
                              className={isDisableCopyToClipboard ? 'menu-item menu-item-disabled' : 'menu-item'}
                              aria-disabled={isProcessing || isDisableCopyToClipboard}
                              onClick={() =>
                                  void runPanelAction((plotData) =>
                                      copyPlotToClipboard(plotData, graphSettings, menu.panelExportSize),
                                  )
                              }
                          >
                              {t('Copy to Clipboard')}
                          </li>
                      </ul>,
                      document.body,
                  )
                : null}
        </div>
    );
}
