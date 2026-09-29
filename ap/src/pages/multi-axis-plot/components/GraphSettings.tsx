import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import PlotStyleSelect from '@/pages/multi-axis-plot/components/PlotStyleSelect.tsx';
import SaveAllButton from '@/pages/multi-axis-plot/components/SaveAllButton.tsx';
import Transpose from '@/pages/multi-axis-plot/components/Transpose.tsx';
import XAxisSelect, { type XDataType } from '@/pages/multi-axis-plot/components/XAxisSelect.tsx';
import YAxisSelect from '@/pages/multi-axis-plot/components/YAxisSelect.tsx';
import { YAxisShowModes } from '@/pages/multi-axis-plot/plotBuilder.ts';
import FontSizeBlock from '@/shared/components/ui/FontSizeBlock.tsx';
import SwitchButton from '@/shared/components/ui/SwitchButton.tsx';
import ThemeBlock from '@/shared/components/ui/ThemeBlock.tsx';

const isBinYAxisMode = (yAxis: YAxisShowModes) =>
    yAxis === YAxisShowModes.BinStack ||
    yAxis === YAxisShowModes.BinPercent ||
    yAxis === YAxisShowModes.BinPercentStack;

export default function MaPGraphSettings({
    graphSettings,
    setGraphSettings,
    visiblePlotDataGroups,
    isDisableYOptions,
    onXAxisChange,
    onYAxisChange,
    xOptionValue,
    layout,
    ...rest
}) {
    const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
    useEffect(() => {
        const node = document.getElementById('MaPGraphSettingReact');
        if (node) {
            setPortalNode(node);
        }
    }, []);

    const handleOnchangeXAxis = (xAxis: string) => {
        onXAxisChange?.(xAxis);
        setGraphSettings((prev) => ({
            ...prev,
            xAxis: xAxis,
        }));
    };

    const handleOnchangeYAxis = (YAxis: YAxisShowModes) => {
        const shouldReloadPlotData = isBinYAxisMode(graphSettings.yAxis) !== isBinYAxisMode(YAxis);
        if (onYAxisChange?.(YAxis, shouldReloadPlotData)) {
            return;
        }
        setGraphSettings((prev) => ({
            ...prev,
            yAxis: YAxis,
        }));
    };

    const handleOnchangePlotStyle = (plotStyle: string) => {
        setGraphSettings((prev) => ({
            ...prev,
            plotStyle: plotStyle,
        }));
    };

    const handleOnchangeTranspose = (transpose: boolean) => {
        setGraphSettings((prev) => ({
            ...prev,
            transpose,
        }));
    };

    const handleOnchangeShowProcess = (showProcess: boolean) => {
        setGraphSettings((prev) => ({
            ...prev,
            showProcess,
        }));
    };

    const handleOnchangeFontSize = (fontSize: string) => {
        setGraphSettings((prev) => ({
            ...prev,
            fontSize: fontSize,
        }));
    };

    const handleOnchangeTheme = (theme: string) => {
        setGraphSettings((prev) => ({
            ...prev,
            theme: theme,
        }));
    };

    return (
        <div>
            {portalNode &&
                createPortal(
                    <div className="d-flex flex-row justify-content-between align-items-center" {...rest}>
                        <div className="d-flex flex-row">
                            <XAxisSelect
                                onChange={handleOnchangeXAxis}
                                xOptionValue={xOptionValue ?? graphSettings.xAxis}
                                xType={graphSettings.xDatatype as XDataType}
                                cssClass="border-white w-auto scale-dropdown"
                                id="XAxisOrder"
                                name="XAxisOrder"
                                label="X axis"
                            />
                            <YAxisSelect
                                id="yAxisOption"
                                name="yAxisOption"
                                isDisableOptions={isDisableYOptions}
                                xOptionValue={xOptionValue ?? graphSettings.xAxis}
                                onChange={handleOnchangeYAxis}
                                yOptionValue={graphSettings.yAxis}
                            />
                            <PlotStyleSelect
                                id="mapPlotStyle"
                                name="mapPlotStyle"
                                onChange={handleOnchangePlotStyle}
                                plotStypeValue={graphSettings.plotStyle}
                            />
                            <Transpose onChange={handleOnchangeTranspose} transposeValue={graphSettings.transpose} />
                            <SwitchButton
                                id="showProcessName"
                                label="Show Process"
                                title="Process names are appended."
                                isChecked={graphSettings.showProcess}
                                onChange={handleOnchangeShowProcess}
                            />
                        </div>
                        <div className="d-flex flex-row justify-content-center align-items-center">
                            <FontSizeBlock onChange={handleOnchangeFontSize} fontSizeValue={graphSettings.fontSize} />
                            <ThemeBlock onChange={handleOnchangeTheme} themeValue={graphSettings.theme} />
                            <SaveAllButton
                                graphSettings={graphSettings}
                                visiblePlotDataGroups={visiblePlotDataGroups}
                            />
                        </div>
                    </div>,
                    portalNode,
                )}
        </div>
    );
}
