import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { type PlotStyleUpdate, usePlotStyleUpdate } from '@/shared/hooks/usePlotStyleUpdate';

const fontSize = {
    tick: {
        base: 10.5,
        s: 12,
        m: 14,
        l: 16,
        xl: 18,
    },
    label: {
        base: 12,
        s: 14,
        m: 16,
        l: 18,
        xl: 20,
    },
};

const themeColor = {
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

type TickText = string | number | boolean | null;
type RlpPlotDOM = HTMLElement & {
    layout?: { xaxis?: { ticktext?: TickText[] } };
    _fullLayout?: {
        width?: number;
        _size?: { w?: number };
        xaxis?: { ticktext?: TickText[]; tickfont?: { family?: string } };
        yaxis2?: { nticks?: number };
    };
};

const originalTickTexts = new WeakMap<HTMLElement, TickText[]>();
const originalTitleWidths = new WeakMap<HTMLElement, number>();

export default function RidgelinePlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const { isUpdating, runStyleUpdate, cancelStyleUpdate } = usePlotStyleUpdate();

    const getLayoutUpdateJobs = (layoutUpdate: Record<string, unknown>): PlotStyleUpdate[] => {
        const plots = document.querySelectorAll<RlpPlotDOM>('.js-plotly-plot');
        return Array.from(plots, (plotDOM) => () => {
            if (plotDOM.isConnected === false) return;
            const update = { ...layoutUpdate };
            const tickSize = update['xaxis.tickfont.size'];
            if (typeof tickSize === 'number') {
                let tickTexts = originalTickTexts.get(plotDOM);
                if (tickTexts === undefined) {
                    const currentTexts = plotDOM._fullLayout?.xaxis?.ticktext ?? plotDOM.layout?.xaxis?.ticktext;
                    if (currentTexts) {
                        tickTexts = [...currentTexts];
                        originalTickTexts.set(plotDOM, tickTexts);
                    }
                }
                if (tickTexts) {
                    const largeFont = tickSize >= fontSize.tick.l;
                    let step = 1;
                    if (largeFont) {
                        const width =
                            plotDOM._fullLayout?._size?.w ?? plotDOM._fullLayout?.width ?? plotDOM.clientWidth;
                        const fontFamily = plotDOM._fullLayout?.xaxis?.tickfont?.family ?? 'Arial';
                        const previousFont = ctx.font;
                        let textWidth: number;
                        try {
                            textWidth = Math.max(
                                0,
                                ...tickTexts.flatMap((text) =>
                                    String(text)
                                        .split(/<br\s*\/?>/i)
                                        .map((line) => visualTextLength(line, tickSize, fontFamily)),
                                ),
                            );
                        } finally {
                            ctx.font = previousFont;
                        }
                        step = Math.max(2, Math.ceil(((textWidth + tickSize) * tickTexts.length) / width));
                    }
                    // Empty SVG text has an origin-based bounding box that makes legacy Plotly grow auto-margins.
                    update['xaxis.ticktext'] = tickTexts.map((text, index) =>
                        index % step || (typeof text === 'string' && !text.trim()) ? '\u00a0' : text,
                    );
                    update['xaxis.tickangle'] = largeFont ? 0 : 'auto';
                }
                const scale = tickSize / fontSize.tick.base;
                update['yaxis.nticks'] = Math.max(2, Math.floor(5 / scale));
                if (plotDOM._fullLayout?.yaxis2) {
                    update['yaxis2.nticks'] = tickSize === fontSize.tick.base ? 3 : 1;
                    update['yaxis2.automargin'] = true;
                }
            }
            return window.Plotly.relayout(plotDOM, update);
        });
    };

    const applyLayoutUpdate = (layoutUpdate: Record<string, unknown>) => {
        getLayoutUpdateJobs(layoutUpdate).forEach((update) => {
            void update();
        });
    };

    const updateFontStyle = (sizeKey: string) => {
        sizeRef.current = sizeKey;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const scale = labelSize / fontSize.label.base;
        const titleDOMs = document.querySelectorAll<HTMLElement>('.tschart-title');
        const titleParentDOMs = document.querySelectorAll<HTMLElement>('.tschart-title-parent');

        if (titleDOMs.length && titleParentDOMs.length) {
            titleDOMs.forEach((titleDOM) => {
                titleDOM.style.fontSize = `${labelSize}px`;
            });
            titleParentDOMs.forEach((titleParentDOM) => {
                let originalWidth = originalTitleWidths.get(titleParentDOM);
                if (originalWidth === undefined) {
                    const computedWidth = Number.parseFloat(window.getComputedStyle(titleParentDOM).width);
                    originalWidth = Number.isFinite(computedWidth) ? computedWidth : 40;
                    originalTitleWidths.set(titleParentDOM, originalWidth);
                }
                titleParentDOM.style.width = `${Math.round(originalWidth * scale)}px`;
            });
        }

        return {
            'autosize': true,
            'font.size': tickSize,
            'legend.font.size': labelSize,
            'xaxis.tickfont.size': tickSize,
            'xaxis.automargin': true,
            'yaxis.tickfont.size': tickSize,
            'yaxis.automargin': true,
            'xaxis.title.font.size': labelSize,
            'yaxis.title.font.size': labelSize,
        };
    };

    const updateThemeStyle = (newTheme: string) => {
        themeRef.current = newTheme;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const titleDOMs = document.querySelectorAll<HTMLElement>('.tschart-title');
        const titleParentDOMs = document.querySelectorAll<HTMLElement>('.tschart-title-parent');

        titleDOMs.forEach((titleDOM) => {
            titleDOM.style.backgroundColor = 'transparent';
        });
        titleParentDOMs.forEach((titleParentDOM) => {
            titleParentDOM.style.backgroundColor = colors.background;
        });

        return {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'legend.font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'yaxis.tickfont.color': colors.text,
        };
    };

    const handleOnchangeFontSize = (sizeKey: string) => {
        cancelStyleUpdate();
        applyLayoutUpdate(updateFontStyle(sizeKey));
    };

    const handleOnchangeTheme = (newTheme: string) => {
        cancelStyleUpdate();
        applyLayoutUpdate(updateThemeStyle(newTheme));
    };

    const changeFontSize = (sizeKey: string) => {
        if (sizeKey === sizeRef.current) return handleOnchangeFontSize(sizeKey);
        sizeRef.current = sizeKey;
        void runStyleUpdate(() => getLayoutUpdateJobs(updateFontStyle(sizeKey)));
    };

    const changeTheme = (themeKey: string) => {
        if (themeKey === themeRef.current) return handleOnchangeTheme(themeKey);
        themeRef.current = themeKey;
        void runStyleUpdate(() => getLayoutUpdateJobs(updateThemeStyle(themeKey)));
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
            applyLayoutUpdate({
                ...updateThemeStyle(themeRef.current),
                ...updateFontStyle(sizeRef.current),
            });
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
