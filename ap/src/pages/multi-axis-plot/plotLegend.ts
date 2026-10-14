// Plotly emits this native event, but its type declarations omit the listener overload.
declare module 'plotly.js' {
    interface PlotlyHTMLElement {
        on(event: 'plotly_beforehover', fn: (event: MouseEvent) => void): void;
    }
}

type LegendMarker = SVGPathElement & {
    __data__?: {
        color?: string;
        trace?: {
            marker?: {
                coloraxis?: string;
            };
        };
    };
};

export const hideNumericLegendPoints = (plot: HTMLElement): void => {
    plot.querySelectorAll<LegendMarker>('g.infolayer > g.legend .legendpoints path.scatterpts').forEach((marker) => {
        const coloraxis = marker.__data__?.trace?.marker?.coloraxis;
        // Hide only the glyph; the legend name and click target remain intact.
        marker.style.display = coloraxis && plot.querySelector(`g.colorbar.cb${coloraxis}`) ? 'none' : '';
    });
};

export const syncNumericHoverLegendColors = (plot: HTMLElement): void => {
    plot.querySelectorAll<LegendMarker>('g.hoverlayer .legendpoints path.scatterpts').forEach((marker) => {
        const point = marker.__data__;
        if (point?.trace?.marker?.coloraxis && typeof point.color === 'string') {
            // Unified hover retains Plotly's resolved point color even though its legend glyph uses raw marker.color.
            marker.style.fill = point.color;
            marker.style.stroke = point.color;
        }
    });
};

export const withHiddenNumericLegendPoints = async <T>(render: () => Promise<T>): Promise<T> => {
    // Image export draws a temporary plot; hide its glyphs before Plotly serializes the SVG.
    const observer = new MutationObserver((mutations) => {
        const plots = new Set<HTMLElement>();
        mutations.forEach(({ target }) => {
            const element = target instanceof Element ? target : target.parentElement;
            const plot = element?.closest<HTMLElement>('.js-plotly-plot');
            if (plot) plots.add(plot);
        });
        plots.forEach(hideNumericLegendPoints);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try {
        return await render();
    } finally {
        observer.disconnect();
    }
};
