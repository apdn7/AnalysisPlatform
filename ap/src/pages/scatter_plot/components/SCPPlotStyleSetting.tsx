import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize, themeColor } from '@/pages/multi-axis-plot/plotBuilder.ts';

export default function SCPPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');

    const getTargetPlot = () => {
        return Array.from(document.querySelectorAll('.js-plotly-plot'));
    };

    const handleOnchangeTheme = (themeKey) => {
        themeRef.current = themeKey;
        const colors = {
            background: themeColor.background[themeKey],
            text: themeColor.text[themeKey],
        };
        const chartDom = document.getElementById('scpchart-dom');
        if (chartDom) {
            chartDom.style.backgroundColor = colors.background;
        }
        const plotDOMs: any[] = getTargetPlot();
        const headers = Array.from(document.querySelectorAll('.sctr-item .label-h'));
        headers.forEach((el: any) => {
            el.style.backgroundColor = colors.background;
            el.style.color = colors.text;
        });
        const colorDOM = document.getElementById('coloScaleBar');

        if (colorDOM) {
            window.Plotly.relayout(colorDOM, {
                'paper_bgcolor': colors.background,
                'plot_bgcolor': colors.background,
                'font.color': colors.text,
            });
        }
        if (!plotDOMs.length) return;
        const layoutUpdate = {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'yaxis.tickfont.color': colors.text,
        };
        plotDOMs.forEach((plotDOM) => {
            if (plotDOM.layout) {
                window.Plotly.update(plotDOM, {}, layoutUpdate);
            }
        });
    };
    const handleOnchangeFontSize = (sizeKey) => {
        sizeRef.current = sizeKey;

        const plotDOMs: any[] = getTargetPlot();
        if (!plotDOMs.length) return;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;
        const scale = labelSize / fontSize.label.base;

        const headers = Array.from(document.querySelectorAll('.sctr-item .label-h'));
        headers.forEach((el: any) => {
            el.style.fontSize = `${tickSize}px`;
            el.style.height = `${Math.ceil(tickSize * 1.4)}px`;
        });

        const colorDOM = document.getElementById('coloScaleBar');

        if (colorDOM) {
            void window.Plotly.relayout(colorDOM, {
                'font.size': labelSize,
            });
        }
        plotDOMs.forEach((plotDOM, index) => {
            if (plotDOM.layout) {
                const annotations: any[] = plotDOM.layout.annotations || [];
                const showY = (plotDOM.layout?.margin?.l ?? 0) > 0;
                const layoutUpdate = {
                    'font.size': labelSize,
                    'xaxis.tickfont.size': tickSize,
                    'yaxis.tickfont.size': tickSize,
                    'padding.l': Math.round(33 * scale),
                    'margin.l': showY ? Math.round(33 * scale) : 0,
                    'margin.b': Math.round(25 * scale),
                };
                annotations.forEach((_, index) => {
                    layoutUpdate[`annotations[${index}].font.size`] = tickSize;
                });
                window.Plotly.update(plotDOM, {}, layoutUpdate);
            }
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
