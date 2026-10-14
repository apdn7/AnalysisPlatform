import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';

const fontSize = {
    tick: {
        base: 12,
        s: 14,
        m: 16,
        l: 18,
        xl: 20,
    },
    label: {
        base: 14,
        s: 16,
        m: 18,
        l: 20,
        xl: 22,
    },
};
const themeColor = {
    background: {
        dark: '#222222',
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
    tick: { dark: '#f8f8f8', light: '#444444' },
};
export default function FppPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');

    const updateChartJsFontSize = (sizeKey) => {
        const tickSize = fontSize.tick[sizeKey] !== undefined ? fontSize.tick[sizeKey] : fontSize.tick.base;
        const labelSize = fontSize.label[sizeKey] !== undefined ? fontSize.label[sizeKey] : fontSize.label.base;
        const KNOWN_TYPES = new Set(['timeSeries', 'histogram', 'scatter', 'whisker']);
        for (const idx in Chart.instances) {
            const chart = Chart.instances[idx];
            if (!chart || !chart.canvas) continue;
            const chartType = chart.canvas.getAttribute('chart-type');
            if (!KNOWN_TYPES.has(chartType)) continue;
            const scales: any = chart.config && chart.config.options && chart.config.options.scales;
            if (scales) {
                for (const scale of Object.values(scales) as any) {
                    // Skip scales configured as display:false — they are not rendered
                    if (!scale || scale.display === false) continue;
                    if (scale.ticks) {
                        scale.ticks.font = scale.ticks.font || {};
                        scale.ticks.font.size = tickSize;
                    }
                    if (scale.title) {
                        scale.title.font = scale.title.font || {};
                        scale.title.font.size = labelSize;
                    }
                }
            }
            // scatterInsideTitle is a chart plugin (not a scale) that renders column-name labels
            // inside the plot area; it matches axis title sizing rather than tick sizing
            if (chartType === 'scatter') {
                const sct =
                    chart.config &&
                    chart.config.options &&
                    chart.config.options.plugins &&
                    chart.config.options.plugins.scatterInsideTitle;
                if (sct) {
                    sct.font = sct.font || {};
                    sct.font.size = labelSize;
                }
            }
            chart.update('none');
        }
    };
    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const scale = labelSize / fontSize.label.base;

        const updateFont = {
            'font.size': tickSize,
            'legend.font.size': labelSize,
            'xaxis.tickfont.size': tickSize,
            'yaxis.tickfont.size': tickSize,
            'xaxis.title.font.size': labelSize,
            'yaxis.title.font.size': labelSize,
            'margin.l': Math.round(43 * scale),
            'margin.r': Math.round(7 * scale),
        };
        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            window.Plotly.relayout(plotDOM, updateFont);
        });
        updateChartJsFontSize(sizeKey);
        adjustCatetoryTableLength();
    };
    const updateChartJsTheme = (theme) => {
        const tickColor = themeColor.tick[theme] !== undefined ? themeColor.tick[theme] : themeColor.tick.dark;
        const gridColor = themeColor.grid[theme] !== undefined ? themeColor.grid[theme] : themeColor.grid.dark;
        const bgColor =
            themeColor.background[theme] !== undefined ? themeColor.background[theme] : themeColor.background.dark;
        const KNOWN_TYPES = new Set(['timeSeries', 'histogram', 'scatter', 'whisker']);
        for (const idx in Chart.instances) {
            const chart = Chart.instances[idx];
            if (!chart || !chart.canvas) continue;
            const chartType = chart.canvas.getAttribute('chart-type');
            if (!KNOWN_TYPES.has(chartType)) continue;
            const scales = chart.config && chart.config.options && chart.config.options.scales;
            if (scales) {
                for (const scale of Object.values(scales) as any) {
                    if (!scale || scale.display === false) continue;
                    // Whisker ticks are rgba(0,0,0,0) by design — overwriting breaks invisible-label layout
                    if (scale.ticks && chartType !== 'whisker') {
                        scale.ticks.color = tickColor;
                    }
                    if (scale.grid) {
                        scale.grid.color = gridColor;
                    }
                    // Scatter scale titles use per-series accent colors (BLUE/DARK_BLUE); preserve them
                    if (scale.title && chartType !== 'scatter') {
                        scale.title.color = tickColor;
                    }
                }
            }
            if (chart.canvas.parentElement) {
                chart.canvas.parentElement.style.backgroundColor = bgColor;
            }
            chart.update('none');
        }
    };

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const layoutUpdate = {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'xaxis.title.font.color': colors.text,
            'yaxis.tickfont.color': colors.text,
            'xaxis.gridcolor': themeColor.grid[newTheme],
            'yaxis.gridcolor': themeColor.grid[newTheme],
        };

        const plotArea = document.getElementsByClassName('plot-area');
        if (plotArea) {
            Array.from(plotArea).forEach((area: any) => {
                area.style.backgroundColor = colors.background;
            });
        }

        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            window.Plotly.relayout(plotDOM, layoutUpdate);
        });

        updateChartJsTheme(newTheme);
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
