import { useEffect, useRef } from 'react';

import FontSizeBlock from '@/pages/multi-axis-plot/components/FontSizeBlock.tsx';
import ThemeBlock from '@/pages/multi-axis-plot/components/ThemeBlock.tsx';
import { fontSize } from '@/pages/multi-axis-plot/plotBuilder.ts';
import { type PlotStyleUpdate, usePlotStyleUpdate } from '@/shared/hooks/usePlotStyleUpdate';

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
    const { isUpdating, runStyleUpdate, cancelStyleUpdate } = usePlotStyleUpdate();

    const getLayoutUpdateJobs = (layoutUpdate: Record<string, unknown>): PlotStyleUpdate[] => {
        const plots = document.querySelectorAll<HTMLElement>('.js-plotly-plot');
        return Array.from(plots, (plotDOM) => () => {
            if (plotDOM.isConnected === false) return;
            return window.Plotly.relayout(plotDOM, layoutUpdate);
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

        return {
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
    };

    const updateThemeStyle = (newTheme: string) => {
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
