const fppChartStyle = (() => {
    const fontSize = {
        tick: { base: 12, s: 14, m: 16, l: 18, xl: 20 },
        label: { base: 14, s: 16, m: 18, l: 20, xl: 22 },
    };
    const themeColor = {
        background: { dark: '#222222', light: '#ffffff' },
        text: { dark: '#f8f8f8', light: '#444444' },
        grid: { dark: '#444444', light: '#ececec' },
        line: { dark: '#444444', light: '#444444' },
        border: { dark: '#444444', light: '#000000' },
        tick: { dark: '#f8f8f8', light: '#444444' },
    };
    const chartTypes = new Set(['timeSeries', 'histogram', 'scatter', 'whisker']);

    const applyStyle = (chart, sizeKey, theme) => {
        const chartType = chart.canvas?.getAttribute('chart-type');
        if (!chartTypes.has(chartType)) return false;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;
        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickColor = themeColor.tick[theme] ?? themeColor.tick.dark;
        const gridColor = themeColor.grid[theme] ?? themeColor.grid.dark;
        let changed = false;
        const setOption = (options, key, value) => {
            if (options[key] !== value) {
                options[key] = value;
                changed = true;
            }
        };
        const options = chart.config.options;
        for (const scale of Object.values(options.scales || {})) {
            if (!scale || scale.display === false) continue;
            if (theme !== undefined) {
                // Whisker ticks are invisible; scatter titles retain their series colors.
                if (scale.ticks && chartType !== 'whisker') setOption(scale.ticks, 'color', tickColor);
                if (scale.grid) setOption(scale.grid, 'color', gridColor);
                if (scale.title && chartType !== 'scatter') setOption(scale.title, 'color', tickColor);
            }
            if (sizeKey !== undefined) {
                if (scale.ticks) {
                    scale.ticks.font = scale.ticks.font || {};
                    setOption(scale.ticks.font, 'size', tickSize);
                }
                if (scale.title) {
                    scale.title.font = scale.title.font || {};
                    setOption(scale.title.font, 'size', labelSize);
                }
            }
        }
        if (sizeKey !== undefined && chartType === 'scatter') {
            const title = options.plugins?.scatterInsideTitle;
            if (title) {
                title.font = title.font || {};
                setOption(title.font, 'size', labelSize);
            }
        }
        if (theme !== undefined && chart.canvas.parentElement) {
            chart.canvas.parentElement.style.backgroundColor =
                themeColor.background[theme] ?? themeColor.background.dark;
        }
        return changed;
    };

    // FPP-only registration applies style before the constructor's first chart update.
    Chart.register({
        id: 'fppStyle',
        beforeInit(chart) {
            const style = window.getStyleLayout?.() ?? { size: 'base', theme: 'dark' };
            applyStyle(chart, style.size, style.theme);
        },
    });

    const getUpdates = (sizeKey, theme) =>
        Object.values(Chart.instances)
            .filter((chart) => chartTypes.has(chart?.canvas?.getAttribute('chart-type')))
            .map((chart) => () => {
                if (
                    chart.canvas?.isConnected === false ||
                    (chart.id !== undefined && Chart.instances[chart.id] !== chart)
                ) {
                    return;
                }
                if (applyStyle(chart, sizeKey, theme)) chart.update('none');
            });

    return { fontSize, themeColor, getUpdates };
})();
