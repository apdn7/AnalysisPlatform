import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { themeColor as defaultThemeColor, fontSize } from '@/pages/multi-axis-plot/plotBuilder.ts';

const themeColor = {
    background: {
        dark: '#222222',
        light: '#ffffff',
    },
    text: {
        dark: '#65c5f1',
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
export default function SankeyPlotStyleSetting() {
    const sizeRef = useRef('base');
    const themeRef = useRef('dark');

    const handleOnchangeFontSize = (sizeKey: string) => {
        sizeRef.current = sizeKey;

        const labelSize = fontSize.label[sizeKey] ?? fontSize.label.base;
        const tickSize = fontSize.tick[sizeKey] ?? fontSize.tick.base;

        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any, index) => {
            const updateFont = {
                'font.size': tickSize,
                'xaxis.tickfont.size': tickSize,
                'legend.font.size': labelSize,
                'yaxis.tickfont.size': tickSize,
                'yaxis.title.font.size': labelSize,
                'xaxis.title.font.size': labelSize,
            };
            const title = plotDOM.layout?.title?.text;
            if (title) {
                updateFont['title.font.size'] = labelSize;
            }
            window.Plotly.relayout(plotDOM, updateFont);
        });
    };

    const handleOnchangeTheme = (newTheme: string) => {
        themeRef.current = newTheme;
        const colors = {
            background: themeColor.background[newTheme],
            text: themeColor.text[newTheme],
            defaultText: defaultThemeColor.text[newTheme],
            border: themeColor.border[newTheme],
        };

        const bgThemes = document.querySelectorAll('.dark-bg');
        if (bgThemes.length) {
            Array.from(bgThemes).forEach((bgTheme: any) => {
                bgTheme.style.backgroundColor = colors.background;
                bgTheme.style.color = bgTheme.id === 'skd-summary' ? colors.defaultText : colors.text;
            });
        }

        const plots = document.querySelectorAll('.js-plotly-plot');
        Array.from(plots).forEach((plotDOM: any) => {
            const textColor = ['graphContainer', 'barContainer'].includes(plotDOM.id)
                ? colors.text
                : colors.defaultText;
            const layoutUpdate = {
                'paper_bgcolor': colors.background,
                'plot_bgcolor': colors.background,
                'font.color': textColor,
                'legend.font.color': textColor,
                'xaxis.tickfont.color': textColor,
                'yaxis.tickfont.color': textColor,
                'title.font.color': colors.defaultText,
                'xaxis.title.font.color': colors.defaultText,
                'yaxis.title.font.color': colors.defaultText,
                'legend.bgcolor': colors.background,
            };
            if (plotDOM.id === 'barContainer') {
                window.Plotly.update(
                    plotDOM,
                    {
                        'insidetextfont.color': textColor,
                        'outsidetextfont.color': textColor,
                    },
                    layoutUpdate,
                );
            } else {
                window.Plotly.relayout(plotDOM, layoutUpdate);
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
