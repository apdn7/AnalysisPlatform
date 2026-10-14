import { useEffect, useRef, useState } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize, themeColor } from '@/pages/multi-axis-plot/plotBuilder.ts';

export default function WfPPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');

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
            'margin.l': Math.round(50 * scale),
            'margin.r': Math.round(80 * scale),
            'padding.t': Math.round(5 * scale),
            'padding.b': Math.round(50 * scale),
        };
        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            window.Plotly.relayout(plotDOM, updateFont);
        });
    };

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const graphDOM = document.getElementById('waveform-plot');

        if (graphDOM) {
            graphDOM.style.backgroundColor = colors.background;
        }

        const layoutUpdate = {
            'paper_bgcolor': colors.background,
            'plot_bgcolor': colors.background,
            'font.color': colors.text,
            'legend.font.color': colors.text,
            'xaxis.tickfont.color': colors.text,
            'yaxis.tickfont.color': colors.text,
        };

        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            window.Plotly.relayout(plotDOM, layoutUpdate);
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
