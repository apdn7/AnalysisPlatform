import { useEffect, useRef } from 'react';

import Plotly from 'plotly.js/dist/plotly';

import FontSizeBlock from '@/shared/components/ui/FontSizeBlock.tsx';
import ThemeBlock from '@/shared/components/ui/ThemeBlock.tsx';

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
        dark: '#222',
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

export default function PCPPlotStyleSetting({}) {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');

    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;
        const plotDOM = document.getElementById('paracord-plot') as any;
        if (!plotDOM?.data) return;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const scale = labelSize / fontSize.label.base;

        Plotly.restyle(
            plotDOM,
            {
                'font.size': fontSize.tick[sizeKey],
                'margin.l': Math.round(100 * scale),
                'margin.r': Math.round(100 * scale),
                'padding.t': Math.round(30 * scale),
                'padding.b': Math.round(30 * scale),
                'labelfont.size': fontSize.tick[sizeKey],
                'tickfont.size': fontSize.tick[sizeKey],
                'rangefont.size': fontSize.tick[sizeKey],
                'line.colorbar.tickfont.size': fontSize.label[sizeKey],
            },
            [0],
        );
    };

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
        const plotDOM = document.getElementById('paracord-plot') as any;
        if (!plotDOM?.data) return;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const traceUpdate = {
            'labelfont.color': colors.text,
            'tickfont.color': colors.text,
            'rangefont.color': colors.text,
            'line.colorbar.tickfont.color': colors.text,
            'line.colorbar.outlinecolor': colors.border,
        };

        const layoutUpdate = {
            'plot_bgcolor': colors.background,
            'paper_bgcolor': colors.background,
            'font.color': colors.text,
        };

        Plotly.update(
            plotDOM,
            traceUpdate,
            layoutUpdate,
            [0], // trace index
        );
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
