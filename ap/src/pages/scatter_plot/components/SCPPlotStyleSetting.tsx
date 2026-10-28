import { useEffect, useRef } from 'react';

import type { Annotation, Layout } from 'plotly.js';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize, themeColor } from '@/pages/multi-axis-plot/plotBuilder.ts';
import { type PlotStyleUpdate, usePlotStyleUpdate } from '@/shared/hooks/usePlotStyleUpdate';

type ScatterPlotElement = HTMLElement & {
    layout?: {
        annotations?: Partial<Annotation>[];
        margin?: { l?: number };
        height?: number;
    } & Partial<Record<`${'x' | 'y'}axis${string}`, Partial<Layout['xaxis']>>>;
    _fullLayout?: { _size?: { w: number; h: number; t: number; b: number }; font?: { family?: string } };
};

type MatrixFontBaseline = {
    height: number;
    paperHeight: number;
    top: number;
    bottom: number;
    lastHeight: number;
    axes: { key: `yaxis${string}`; low: number; high: number }[];
    titles: { index: number; text: string; x: number; y: number }[];
};

const matrixFontBaselines = new WeakMap<object, MatrixFontBaseline>();

const wrapMatrixTitle = (text: string, width: number, tickSize: number, family: string) => {
    const fragment = document.createElement('template');
    const escaped = document.createElement('span');
    return text
        .split(/<br\s*\/?>/i)
        .flatMap((line) => {
            fragment.innerHTML = line;
            const plain = fragment.content.textContent || '';
            if (visualTextLength(plain, tickSize, family) <= width) return [line];
            const lines: string[] = [];
            let current = '';
            for (const word of plain.split(/\s+/)) {
                const candidate = current ? `${current} ${word}` : word;
                if (visualTextLength(candidate, tickSize, family) <= width) {
                    current = candidate;
                    continue;
                }
                if (current) lines.push(current);
                current = '';
                for (const character of word) {
                    if (current && visualTextLength(current + character, tickSize, family) > width) {
                        lines.push(current);
                        current = '';
                    }
                    current += character;
                }
            }
            lines.push(current);
            return lines.map((part) => {
                escaped.textContent = part;
                return escaped.innerHTML;
            });
        })
        .join('<br>');
};

const rememberMatrixFontLayout = (plot: ScatterPlotElement) => {
    const layout = plot.layout;
    const size = plot._fullLayout?._size;
    if (plot.id !== 'sctr-card' || !layout || !size) return;

    let baseline = matrixFontBaselines.get(layout);
    if (!baseline) {
        const axes = Object.entries(layout).flatMap(([key, axis]) => {
            if (!/^yaxis\d*$/.test(key) || !axis || typeof axis !== 'object' || !('domain' in axis)) return [];
            const domain = axis.domain;
            if (!Array.isArray(domain) || domain.length !== 2 || !domain.every((value) => typeof value === 'number')) {
                return [];
            }
            return [{ key: key as `yaxis${string}`, low: domain[0], high: domain[1] }];
        });
        const titles = (layout.annotations || []).flatMap((title, index) =>
            title.text && title.yanchor === 'top' && typeof title.x === 'number' && typeof title.y === 'number'
                ? [{ index, text: title.text, x: title.x, y: title.y }]
                : [],
        );
        if (!axes.length || !titles.length) return;
        baseline = {
            axes,
            titles,
            height: plot.clientHeight,
            paperHeight: size.h,
            top: size.t,
            bottom: size.b,
            lastHeight: plot.clientHeight,
        };
        matrixFontBaselines.set(layout, baseline);
    }
    if (plot.clientHeight !== baseline.lastHeight) {
        baseline.height = plot.clientHeight;
        baseline.paperHeight = plot.clientHeight - baseline.top - baseline.bottom;
    }
};

const getMatrixFontLayout = (plot: ScatterPlotElement, tickSize: number): Record<string, unknown> => {
    const layout = plot.layout;
    const size = plot._fullLayout?._size;
    if (!layout || !size) return {};
    const baseline = matrixFontBaselines.get(layout);
    if (!baseline || baseline.paperHeight <= 0) return {};
    const rows = [...new Set(baseline.axes.map((axis) => axis.low))].sort((a, b) => a - b);
    const columns = [...new Set(baseline.titles.map((title) => title.x))].sort((a, b) => a - b);
    const columnStep = columns.length > 1 ? columns[1] - columns[0] : 1;
    const patch: Record<string, unknown> = {};
    let titleHeight = 0;
    const originalFont = ctx.font;
    try {
        baseline.titles.forEach((title) => {
            const width = Math.max(1, Math.min(columnStep, title.x * 2, (1 - title.x) * 2) * size.w - 12);
            const text = wrapMatrixTitle(title.text, width, tickSize, plot._fullLayout?.font?.family || 'Arial');
            if (layout.annotations?.[title.index]?.text !== text) {
                patch[`annotations[${title.index}].text`] = text;
            }
            titleHeight = Math.max(titleHeight, text.split('<br>').length * Math.ceil(tickSize * 1.3) + 8);
        });
    } finally {
        ctx.font = originalFont;
    }
    const originalGap = Math.min(
        ...baseline.axes.map((axis) => (1 / rows.length - (axis.high - axis.low)) * baseline.paperHeight),
    );
    const extra = Math.max(0, titleHeight - originalGap);
    const height = Math.max(baseline.height, baseline.height + extra * rows.length + size.b - baseline.bottom);
    const paperHeight = height - baseline.top - size.b;
    // Recompute from the original domains/text: repeated font changes must not accumulate spacing.
    baseline.axes.forEach((axis) => {
        const gap = (1 / rows.length - (axis.high - axis.low)) * baseline.paperHeight + extra;
        const high = axis.low + 1 / rows.length - gap / paperHeight;
        const domain = layout[axis.key]?.domain;
        if (domain?.[0] !== axis.low || domain?.[1] !== high) {
            patch[`${axis.key}.domain`] = [axis.low, high];
        }
    });
    if (layout.height !== height) patch.height = height;
    plot.style.height = `${height}px`;
    baseline.lastHeight = plot.clientHeight;
    [...rows].reverse().forEach((low, index) => {
        const label = plot.querySelector<HTMLElement>(`#scp-vlabel-${index}`);
        const axis = baseline.axes.find((axis) => axis.low === low);
        if (!label || !axis) return;
        const gap = (1 / rows.length - (axis.high - axis.low)) * baseline.paperHeight + extra;
        const high = low + 1 / rows.length - gap / paperHeight;
        label.style.top = `${size.t + (1 - (low + high) / 2) * paperHeight}px`;
    });
    return patch;
};

export default function SCPPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const { isUpdating, runStyleUpdate, cancelStyleUpdate } = usePlotStyleUpdate();

    const getTargetPlot = () => {
        return Array.from(document.querySelectorAll<ScatterPlotElement>('.js-plotly-plot'));
    };

    const getThemeStyle = (themeKey: string) => {
        const colors = {
            background: themeColor.background[themeKey],
            text: themeColor.text[themeKey],
        };
        const chartDom = document.getElementById('scpchart-dom');
        if (chartDom) {
            chartDom.style.backgroundColor = colors.background;
        }
        const headers = Array.from(document.querySelectorAll<HTMLElement>('.sctr-item .label-h'));
        headers.forEach((el) => {
            el.style.backgroundColor = colors.background;
            el.style.color = colors.text;
        });
        return {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'yaxis.tickfont.color': colors.text,
        };
    };
    const getFontStyle = (sizeKey: string) => {
        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;
        const scale = labelSize / fontSize.label.base;

        const yTitle = document.getElementById('scpchart-ytitle');
        if (yTitle) {
            yTitle.style.fontSize = `${labelSize}px`;
        }

        const headers = Array.from(document.querySelectorAll<HTMLElement>('.sctr-item .label-h'));
        headers.forEach((el) => {
            el.style.fontSize = `${tickSize}px`;
            el.style.height = `${Math.ceil(tickSize * 1.4)}px`;
        });

        return { labelSize, tickSize, scale };
    };

    const getStyleUpdateJobs = (themeKey?: string, sizeKey?: string): PlotStyleUpdate[] => {
        const plotDOMs = getTargetPlot();
        const themeStyle = themeKey === undefined ? undefined : getThemeStyle(themeKey);
        const fontStyle = sizeKey === undefined || !plotDOMs.length ? undefined : getFontStyle(sizeKey);
        const colorDOM: ScatterPlotElement | null = document.getElementById('coloScaleBar');
        const colorIsTarget = colorDOM !== null && plotDOMs.includes(colorDOM);
        const colorLayoutUpdate = {
            ...(themeStyle
                ? {
                      'paper_bgcolor': themeStyle.paper_bgcolor,
                      'plot_bgcolor': themeStyle.plot_bgcolor,
                      'font.color': themeStyle['font.color'],
                  }
                : {}),
            ...(fontStyle ? { 'font.size': fontStyle.labelSize } : {}),
        };

        // A selected colorbar receives its special patch together with the normal plot patch.
        if (colorDOM && !colorIsTarget) plotDOMs.push(colorDOM);
        return plotDOMs.map((plotDOM) => () => {
            if (plotDOM.isConnected === false) return;
            if (plotDOM.layout && (plotDOM !== colorDOM || colorIsTarget)) {
                const layoutUpdate: Record<string, string | number> = {
                    ...(plotDOM === colorDOM ? colorLayoutUpdate : {}),
                    ...themeStyle,
                };
                if (fontStyle) {
                    const { labelSize, tickSize, scale } = fontStyle;
                    const annotations = plotDOM.layout.annotations || [];
                    const showY = (plotDOM.layout?.margin?.l ?? 0) > 0;
                    Object.assign(layoutUpdate, {
                        'font.size': labelSize,
                        'xaxis.tickfont.size': tickSize,
                        'yaxis.tickfont.size': tickSize,
                        'padding.l': Math.round(33 * scale),
                        'margin.l': showY ? Math.round(33 * scale) : 0,
                        'margin.b': Math.round(25 * scale),
                    });
                    annotations.forEach((_, index) => {
                        layoutUpdate[`annotations[${index}].font.size`] = tickSize;
                    });
                }
                Object.keys(plotDOM.layout).forEach((axis) => {
                    if (!/^[xy]axis\d*$/.test(axis)) return;
                    if (themeStyle) {
                        layoutUpdate[`${axis}.tickfont.color`] = themeStyle['font.color'];
                    }
                    if (fontStyle) {
                        layoutUpdate[`${axis}.tickfont.size`] = fontStyle.tickSize;
                    }
                });
                if (fontStyle) rememberMatrixFontLayout(plotDOM);
                const update = window.Plotly.update(plotDOM, {}, layoutUpdate);
                if (fontStyle && plotDOM.id === 'sctr-card') {
                    const layout = plotDOM.layout;
                    // Font/colorbar changes affect paper width; fit headers after Plotly settles its margins.
                    return update.then(() => {
                        if (plotDOM.isConnected === false || plotDOM.layout !== layout) return;
                        const patch = getMatrixFontLayout(plotDOM, fontStyle.tickSize);
                        if (Object.keys(patch).length) return window.Plotly.relayout(plotDOM, patch);
                    });
                }
                return update;
            } else if (plotDOM === colorDOM && (themeStyle || fontStyle)) {
                return window.Plotly.relayout(plotDOM, colorLayoutUpdate);
            }
        });
    };

    const applyStyle = (themeKey?: string, sizeKey?: string) => {
        getStyleUpdateJobs(themeKey, sizeKey).forEach((update) => {
            void update();
        });
    };

    const handleOnchangeTheme = (themeKey: string) => {
        cancelStyleUpdate();
        themeRef.current = themeKey;
        applyStyle(themeKey);
    };

    const handleOnchangeFontSize = (sizeKey: string) => {
        cancelStyleUpdate();
        sizeRef.current = sizeKey;
        applyStyle(undefined, sizeKey);
    };

    const changeFontSize = (sizeKey: string) => {
        if (sizeKey === sizeRef.current) return handleOnchangeFontSize(sizeKey);
        sizeRef.current = sizeKey;
        void runStyleUpdate(() => getStyleUpdateJobs(undefined, sizeKey));
    };

    const changeTheme = (themeKey: string) => {
        if (themeKey === themeRef.current) return handleOnchangeTheme(themeKey);
        themeRef.current = themeKey;
        void runStyleUpdate(() => getStyleUpdateJobs(themeKey));
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
