import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize } from '@/pages/multi-axis-plot/plotBuilder.ts';

// Calendar heatmaps belong to the legacy Plotly instance, not the React bundle's version.

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

    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;

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
        const plots = document.querySelectorAll('#heatmapCard .js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            const appliedSize = isBase ? 'base' : sizeKey;
            if (plotDOM.dataset.chmSize === appliedSize) return;
            const compact = plotDOM.data[0].colorbar.thickness === 7;
            const traceUpdate = {
                'colorbar.tickfont.size': (compact ? 9 : 10) * tickScale,
                'colorbar.title.font.size': isBase ? null : (compact ? 11 : 12) * scale,
            };
            preserveResponsiveSize(plotDOM, () => {
                return window.Plotly.update(
                    plotDOM,
                    traceUpdate,
                    { ...updateFont, width: plotDOM._fullLayout.width, height: plotDOM._fullLayout.height },
                    [0],
                );
            });
            plotDOM.dataset.chmSize = appliedSize;
        });
    };

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
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

        const layoutUpdate = {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'legend.font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'yaxis.tickfont.color': colors.text,
        };

        const plots = document.querySelectorAll('#heatmapCard .js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            if (plotDOM.dataset.chmTheme === newTheme) return;
            // The process border is added after the initial plot. Changing colors must not
            // autosize against that smaller frame; Plotly's responsive resize still owns resizing.
            preserveResponsiveSize(plotDOM, () => {
                return window.Plotly.relayout(plotDOM, {
                    ...layoutUpdate,
                    width: plotDOM._fullLayout.width,
                    height: plotDOM._fullLayout.height,
                });
            });
            plotDOM.dataset.chmTheme = newTheme;
        });
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

        return () => {
            delete window.getStyleLayout;
            delete window.handleOnchangeFontsize;
            delete window.handleOnchangeTheme;
        };
    }, []);

    return (
        <div className="d-flex flex-row justify-content-center align-items-center">
            <FontSizeBlock onChange={handleOnchangeFontSize} fontSizeValue={sizeRef.current} />
            <ThemeBlock onChange={handleOnchangeTheme} themeValue={themeRef.current} />
        </div>
    );
}
