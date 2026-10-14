import { useEffect, useRef, useState } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize, themeColor } from '@/pages/multi-axis-plot/plotBuilder.ts';

export default function HMPPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };
        const chartGroup = document.getElementById('scpChartGrp');
        const chartDom = document.getElementById('scpchart-dom');
        if (chartDom) {
            chartDom.style.backgroundColor = colors.background;
        }
        if (chartGroup) {
            chartGroup.style.backgroundColor = colors.background;
        }
        const plots = document.querySelectorAll<HTMLElement>('#scpChartGrp .js-plotly-plot');
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
        // not using relayout because hmp have a callback that override relayout
        Array.from(plots).forEach((plotDOM) => {
            window.Plotly.update(
                plotDOM,
                {},
                {
                    'paper_bgcolor': colors.background,
                    'plot_bgcolor': colors.background,
                    'font.color': colors.text,
                    'xaxis.tickfont.color': colors.text,
                    'yaxis.tickfont.color': colors.text,
                    'hoverlabel.bgcolor': colors.background,
                    'hoverlabel.bordercolor': colors.border,
                    'hoverlabel.font.color': colors.text,
                },
            );
        });
    };

    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const scale = labelSize / fontSize.label.base;

        const heatmapPlots = Array.from(
            document.querySelectorAll<HTMLElement>('#scpChartGrp [id^="scp-"].js-plotly-plot'),
        );

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
        for (let i = 0; i < heatmapPlots.length; i++) {
            const plotDOM: any = heatmapPlots[i];
            const showY = (plotDOM.layout?.margin?.l ?? 0) > 0;
            const showX = (plotDOM.layout?.margin?.b ?? 0) > 0;
            void window.Plotly.update(
                plotDOM,
                {},
                {
                    'xaxis.tickfont.size': tickSize,
                    'yaxis.tickfont.size': tickSize,
                    'hoverlabel.font.size': tickSize,
                    'margin.l': showY ? Math.round(33 * scale) : 0,
                    'margin.b': showX ? Math.round(25 * scale) : 0,
                },
            );
        }
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
