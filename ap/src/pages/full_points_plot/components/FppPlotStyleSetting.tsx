import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { type PlotStyleUpdate, usePlotStyleUpdate } from '@/shared/hooks/usePlotStyleUpdate';

// Legacy chart DOM can outlive the React style controls.
const titleParentWidths = new WeakMap<HTMLElement, number>();

export default function FppPlotStyleSetting() {
    const { fontSize, themeColor, getUpdates: getChartJsStyleUpdates } = fppChartStyle;
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const { isUpdating, runStyleUpdate, cancelStyleUpdate } = usePlotStyleUpdate();

    const updateChartJsStyle = (sizeKey?: string, theme?: string) => {
        getChartJsStyleUpdates(sizeKey, theme).forEach((update) => update());
    };

    const getFontLayout = (sizeKey: string) => {
        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const scale = labelSize / fontSize.label.base;

        document.querySelectorAll<HTMLElement>('#plot-cards .tschart-title').forEach((titleDOM) => {
            titleDOM.style.fontSize = `${labelSize}px`;
        });
        document.querySelectorAll<HTMLElement>('#plot-cards .tschart-title-parent').forEach((titleParentDOM) => {
            let originalWidth = titleParentWidths.get(titleParentDOM);
            if (originalWidth === undefined) {
                const computedWidth = Number.parseFloat(window.getComputedStyle(titleParentDOM).width);
                originalWidth = Number.isFinite(computedWidth) ? computedWidth : 40;
                titleParentWidths.set(titleParentDOM, originalWidth);
            }
            titleParentDOM.style.width = `${Math.round(originalWidth * scale)}px`;
        });

        return {
            'font.size': tickSize,
            'legend.font.size': labelSize,
            'xaxis.tickfont.size': tickSize,
            'yaxis.tickfont.size': tickSize,
            'xaxis.title.font.size': labelSize,
            'yaxis.title.font.size': labelSize,
            'margin.l': Math.round(43 * scale),
            'margin.r': Math.round(7 * scale),
        };
    };

    const getThemeLayout = (newTheme: string) => {
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const plotArea = document.getElementsByClassName('plot-area');
        Array.from(plotArea).forEach((area: HTMLElement) => {
            area.style.backgroundColor = colors.background;
        });

        return {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'xaxis.title.font.color': colors.text,
            'yaxis.tickfont.color': colors.text,
            'xaxis.gridcolor': themeColor.grid[newTheme],
            'yaxis.gridcolor': themeColor.grid[newTheme],
        };
    };

    const getPlotlyStyleUpdates = (layoutUpdate: Record<string, unknown>): PlotStyleUpdate[] => {
        const plots = document.querySelectorAll<HTMLElement>('.js-plotly-plot');
        return Array.from(plots, (plotDOM) => () => {
            if (plotDOM.isConnected === false) return;
            return window.Plotly.relayout(plotDOM, layoutUpdate);
        });
    };

    const updatePlotlyStyle = (layoutUpdate: Record<string, unknown>) => {
        getPlotlyStyleUpdates(layoutUpdate).forEach((update) => update());
    };

    const handleOnchangeFontSize = (sizeKey: string) => {
        cancelStyleUpdate();
        sizeRef.current = sizeKey;
        updatePlotlyStyle(getFontLayout(sizeKey));
        updateChartJsStyle(sizeKey);
        adjustCatetoryTableLength();
    };

    const handleOnchangeTheme = (newTheme: string) => {
        cancelStyleUpdate();
        themeRef.current = newTheme;
        updatePlotlyStyle(getThemeLayout(newTheme));
        updateChartJsStyle(undefined, newTheme);
    };

    const applyPlotStyle = () => {
        cancelStyleUpdate();
        updatePlotlyStyle({ ...getThemeLayout(themeRef.current), ...getFontLayout(sizeRef.current) });
        updateChartJsStyle(sizeRef.current, themeRef.current);
        adjustCatetoryTableLength();
    };

    const changeFontSize = (sizeKey: string) => {
        if (sizeKey === sizeRef.current) return handleOnchangeFontSize(sizeKey);
        sizeRef.current = sizeKey;
        void runStyleUpdate(
            () => [...getPlotlyStyleUpdates(getFontLayout(sizeKey)), ...getChartJsStyleUpdates(sizeKey)],
            adjustCatetoryTableLength,
        );
    };

    const changeTheme = (themeKey: string) => {
        if (themeKey === themeRef.current) return handleOnchangeTheme(themeKey);
        themeRef.current = themeKey;
        void runStyleUpdate(() => [
            ...getPlotlyStyleUpdates(getThemeLayout(themeKey)),
            ...getChartJsStyleUpdates(undefined, themeKey),
        ]);
    };

    useEffect(() => {
        window.applyPlotStyle = applyPlotStyle;
        window.getStyleLayout = () => ({
            theme: themeRef.current,
            size: sizeRef.current,
        });

        window.handleOnchangeTheme = (themeKey) => {
            handleOnchangeTheme(themeKey);
        };

        window.handleOnchangeFontsize = (sizeKey) => {
            handleOnchangeFontSize(sizeKey);
        };

        return () => {
            delete window.applyPlotStyle;
            delete window.getStyleLayout;
            delete window.handleOnchangeFontsize;
            delete window.handleOnchangeTheme;
        };
    }, []);

    return (
        <div className="d-flex flex-row justify-content-center align-items-center">
            <FontSizeBlock onChange={changeFontSize} fontSizeValue={sizeRef.current} disabled={isUpdating} />
            <ThemeBlock onChange={changeTheme} themeValue={themeRef.current} disabled={isUpdating} />
        </div>
    );
}
