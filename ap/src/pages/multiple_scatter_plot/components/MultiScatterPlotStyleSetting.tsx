import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize } from '@/pages/multi-axis-plot/plotBuilder.ts';

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
export default function MultiScatterPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const titleParentWidthsRef = useRef(new WeakMap<Element, number>());

    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const scale = labelSize / fontSize.label.base;

        const layoutUpdate = {
            'font.size': tickSize,
            'xaxis.tickfont.size': tickSize,
            'legend.font.size': labelSize,
            'yaxis.tickfont.size': tickSize,
            'title.font.size': labelSize,
            'margin.l': Math.round(40 * scale),
            'margin.r': Math.round(15 * scale),
            'margin.b': Math.round(20 * scale),
            'margin.t': Math.round(25 * scale),
        };
        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            window.Plotly.relayout(plotDOM, layoutUpdate);
        });
    };

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const titleDOMs = document.querySelectorAll('.chm-card-title-parent');

        if (titleDOMs.length) {
            Array.from(titleDOMs).forEach((titleDOM: any) => {
                titleDOM.style.backgroundColor = colors.background;
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
