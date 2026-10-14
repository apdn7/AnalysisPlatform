import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize } from '@/pages/multi-axis-plot/plotBuilder.ts';

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
};
export default function AggregatePlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');
    const titleParentWidthsRef = useRef(new WeakMap<Element, number>());

    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const scale = labelSize / fontSize.label.base;
        const titleDOMs = document.querySelectorAll('.tschart-title');
        const titleParentDOMs = document.querySelectorAll('.tschart-title-parent');

        if (titleDOMs.length && titleParentDOMs.length) {
            Array.from(titleDOMs).forEach((titleDOM: any) => {
                titleDOM.style.fontSize = `${tickSize}px`;
            });
            Array.from(titleParentDOMs).forEach((titleParentDOM: any) => {
                let originalWidth = titleParentWidthsRef.current.get(titleParentDOM);
                if (originalWidth === undefined) {
                    const computedWidth = Number.parseFloat(window.getComputedStyle(titleParentDOM).width);
                    originalWidth = Number.isFinite(computedWidth) ? computedWidth : 40;
                    titleParentWidthsRef.current.set(titleParentDOM, originalWidth);
                }
                titleParentDOM.style.width = `${Math.round(originalWidth * scale)}px`;
            });
        }
        const updateFont = {
            'font.size': tickSize,
            'xaxis.tickfont.size': tickSize,
            'legend.font.size': labelSize,
            'yaxis.tickfont.size': tickSize,
            'title.font.size': labelSize,
            'margin.r': Math.round(30 * scale),
            'margin.b': Math.round(60 * scale),
            'margin.t': Math.round(20 * scale),
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

        const titleDOMs = document.querySelectorAll('.tschart-title');

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
