import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize } from '@/pages/multi-axis-plot/plotBuilder.ts';
import { type PlotStyleUpdate, usePlotStyleUpdate } from '@/shared/hooks/usePlotStyleUpdate';

// Calendar heatmaps belong to the legacy Plotly instance, not the React bundle's version.

type CalendarHeatmapElement = HTMLElement & {
    layout: { width?: number; height?: number };
    _fullLayout: { width: number; height: number };
    data: { colorbar: { thickness: number } }[];
};

const preserveResponsiveSize = (
    plot: HTMLElement & { layout: { width?: number; height?: number } },
    update: () => Promise<unknown>,
) => {
    const sizes = [plot, ...plot.querySelectorAll<HTMLElement>('.svg-container')].map((element) => ({
        element,
        width: element.style.width,
        height: element.style.height,
    }));
    const { width: layoutWidth, height: layoutHeight } = plot.layout;
    return update().finally(() => {
        // Plotly writes pixel dimensions during relayout; the CHM flex card owns the CSS size.
        sizes.forEach(({ element, width, height }) => {
            element.style.width = width;
            element.style.height = height;
        });
        if (layoutWidth === undefined) delete plot.layout.width;
        else plot.layout.width = layoutWidth;
        if (layoutHeight === undefined) delete plot.layout.height;
        else plot.layout.height = layoutHeight;
    });
};

const themeColor = {
    background: {
        dark: '#222222',
        light: '#ffffff',
    },
    text: {
        dark: '#ffffff',
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
export default function CalendarHeatmapPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const { isUpdating, runStyleUpdate, cancelStyleUpdate } = usePlotStyleUpdate();

    const getFontStyle = (sizeKey: string) => {
        const scale = (fontSize.label[sizeKey] ?? fontSize.label.base) / fontSize.label.base;
        const tickScale = (fontSize.tick[sizeKey] ?? fontSize.tick.base) / fontSize.tick.base;
        const isBase = scale === 1;
        const titleDOMs = document.querySelectorAll<HTMLElement>('#heatmapCard .chm-card-title');
        const titleParentDOMs = document.querySelectorAll<HTMLElement>('#heatmapCard .chm-card-title-parent');

        if (titleDOMs.length && titleParentDOMs.length) {
            Array.from(titleDOMs).forEach((titleDOM) => {
                titleDOM.style.fontSize = isBase ? '' : `${12 * scale}px`;
            });
            Array.from(titleParentDOMs).forEach((titleParentDOM) => {
                // CSS owns the 35px flex basis; computed width has already been flex-shrunk.
                titleParentDOM.style.width = isBase ? '' : `${35 * scale}px`;
            });
        }
        const updateFont = {
            'font.size': isBase ? null : 12 * scale,
            'xaxis.tickfont.size': 10 * tickScale,
            'legend.font.size': isBase ? null : 12 * scale,
            'yaxis.tickfont.size': 11 * tickScale,
            'title.font.size': 11 * scale,
            'margin.l': Math.round(30 * scale),
            'margin.b': Math.round(35 * scale),
            'margin.t': Math.round(3 * scale),
        };
        return { appliedSize: isBase ? 'base' : sizeKey, scale, tickScale, isBase, layoutUpdate: updateFont };
    };

    const getThemeStyle = (newTheme: string) => {
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const titleDOMs = document.querySelectorAll('#heatmapCard .chm-card-title-parent');

        if (titleDOMs.length) {
            Array.from(titleDOMs).forEach((titleDOM: any) => {
                titleDOM.style.backgroundColor = newTheme === 'dark' ? '' : colors.background;
            });
        }

        return {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'legend.font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'yaxis.tickfont.color': colors.text,
        };
    };

    const getStyleUpdateJobs = (
        themeKey?: string,
        sizeKey?: string,
        deferDatasetUpdates = false,
    ): PlotStyleUpdate[] => {
        const themeStyle = themeKey === undefined ? undefined : getThemeStyle(themeKey);
        const fontStyle = sizeKey === undefined ? undefined : getFontStyle(sizeKey);
        const plots = document.querySelectorAll<CalendarHeatmapElement>('#heatmapCard .js-plotly-plot');
        return Array.from(plots, (plotDOM) => () => {
            if (plotDOM.isConnected === false) return;
            const updateTheme = themeStyle && plotDOM.dataset.chmTheme !== themeKey;
            const updateSize = fontStyle && plotDOM.dataset.chmSize !== fontStyle.appliedSize;
            if (!updateTheme && !updateSize) return;

            const layoutUpdate = {
                ...(updateTheme ? themeStyle : {}),
                ...(updateSize ? fontStyle.layoutUpdate : {}),
                width: plotDOM._fullLayout.width,
                height: plotDOM._fullLayout.height,
            };
            // The process border is added after the initial plot. Changing colors must not
            // autosize against that smaller frame; Plotly's responsive resize still owns resizing.
            const update = preserveResponsiveSize(plotDOM, () => {
                if (updateSize) {
                    const compact = plotDOM.data[0].colorbar.thickness === 7;
                    const traceUpdate = {
                        'colorbar.tickfont.size': (compact ? 9 : 10) * fontStyle.tickScale,
                        'colorbar.title.font.size': fontStyle.isBase ? null : (compact ? 11 : 12) * fontStyle.scale,
                    };
                    return window.Plotly.update(plotDOM, traceUpdate, layoutUpdate, [0]);
                }
                return window.Plotly.relayout(plotDOM, layoutUpdate);
            });
            const markApplied = () => {
                if (updateTheme) plotDOM.dataset.chmTheme = themeKey;
                if (updateSize) plotDOM.dataset.chmSize = fontStyle.appliedSize;
            };
            if (deferDatasetUpdates) return update.then(markApplied);
            markApplied();
            return update;
        });
    };

    const applyStyle = (themeKey?: string, sizeKey?: string) => {
        getStyleUpdateJobs(themeKey, sizeKey).forEach((update) => {
            void update();
        });
    };

    const handleOnchangeFontSize = (sizeKey: string) => {
        cancelStyleUpdate();
        sizeRef.current = sizeKey;
        applyStyle(undefined, sizeKey);
    };

    const handleOnchangeTheme = (themeKey: string) => {
        cancelStyleUpdate();
        themeRef.current = themeKey;
        applyStyle(themeKey);
    };

    const changeFontSize = (sizeKey: string) => {
        if (sizeKey === sizeRef.current) return handleOnchangeFontSize(sizeKey);
        sizeRef.current = sizeKey;
        void runStyleUpdate(() => getStyleUpdateJobs(undefined, sizeKey, true));
    };

    const changeTheme = (themeKey: string) => {
        if (themeKey === themeRef.current) return handleOnchangeTheme(themeKey);
        themeRef.current = themeKey;
        void runStyleUpdate(() => getStyleUpdateJobs(themeKey, undefined, true));
    };

    useEffect(() => {
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

        window.applyPlotStyle = () => {
            cancelStyleUpdate();
            applyStyle(themeRef.current, sizeRef.current);
        };

        return () => {
            delete window.getStyleLayout;
            delete window.handleOnchangeFontsize;
            delete window.handleOnchangeTheme;
            delete window.applyPlotStyle;
        };
    }, []);

    return (
        <div className="d-flex flex-row justify-content-center align-items-center">
            <FontSizeBlock onChange={changeFontSize} fontSizeValue={sizeRef.current} disabled={isUpdating} />
            <ThemeBlock onChange={changeTheme} themeValue={themeRef.current} disabled={isUpdating} />
        </div>
    );
}
