import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';

const fontSize = {
    tick: {
        base: 8,
        s: 10,
        m: 12,
        l: 14,
        xl: 16,
    },
    label: {
        base: 9,
        s: 11,
        m: 13,
        l: 15,
        xl: 17,
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
export default function CategoricalPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const titleParentWidthsRef = useRef(new WeakMap<Element, number>());

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
