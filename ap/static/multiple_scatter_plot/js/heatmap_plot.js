const heatmapColorPallets = [
    ['0', '#1E90FF'],
    ['0.5', '#FFFFFF'],
    ['1', '#FF4433'],
];

const generateHeatmapPlot = (prop, tickLen) => {
    const tickSize = prop.y.length >= 30 ? 10 : 12;

    const data = [
        {
            x: prop.x,
            y: prop.y,
            z: prop.z,
            zmax: 1,
            zmin: -1,
            type: 'heatmap',
            showscale: true,
            hoverongaps: true,
            uirevision: true,
            hoverinfo: 'none',
            colorbar: {
                tickfont: {
                    color: '#ffffff',
                    size: 14,
                },
            },
            colorscale: heatmapColorPallets,
        },
    ];

    const layout = {
        plot_bgcolor: '#666666',
        paper_bgcolor: '#222222',
        autosize: true,
        yaxis: {
            ticklen: 0,
            showline: true,
            showgrid: true,
            tickmode: 'array',
            tickvals: prop.y,
            ticktext: prop.yTickText,
            tickfont: {
                size: tickSize,
                color: 'white',
                font: 'Arial',
            },
            range: 'auto',
        },
        xaxis: {
            showline: true,
            showgrid: true,
            tickangle: -90,
            tickmode: 'array',
            ticklen: 0,
            tickfont: {
                size: 14,
                color: 'white',
            },
            range: 'auto',
            showticklabels: false,
        },
        hovermode: 'none',
        margin: {
            l: tickLen,
            b: 20,
            t: 20,
        },
    };

    const heatmapIconSettings = genPlotlyIconSettings();

    const config = {
        ...heatmapIconSettings,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' },
    };

    const hdPlot = document.getElementById(prop.canvasId);

    Plotly.react(prop.canvasId, data, layout, config);

    hdPlot.on('plotly_hover', (data) => {
        const { x, y, z } = data.points[0];
        const corr = z === null ? 1 : applySignificantDigit(z);
        const dataTable = genHoverDataTable([
            ['X', x],
            ['Y', y],
            [formElements.i18nMSPCorr, corr],
        ]);
        genDataPointHoverTable(
            dataTable,
            { x: data.event.pageX - 120, y: data.event.pageY },
            0,
            true,
            prop.canvasId,
            1,
        );
    });
    unHoverHandler(hdPlot);
};

const showHeatmap = (data) => {
    $(formElements.plotCardId).empty();
    $(formElements.plotCardId).append('<div id="heatmap-card"></div>');
    $(formElements.plotCardId).show();
    const offset = 68;
    const width = $(formElements.plotCardId).width();
    const windowHeight = $(window).height() - 100;
    const expectedHeight = Math.min(windowHeight, width);
    const expectedTickLen = Math.max(width - expectedHeight - offset, 100);

    const yTickText = data.y.map((text) =>
        trimTextLengthByPixel(text, expectedTickLen),
    );
    const actualMaxTickLen = getTickPixelSize(yTickText);

    const actualWidth = Math.min(
        expectedHeight + actualMaxTickLen + offset,
        width,
    );
    const actualHeight = actualWidth - (actualMaxTickLen + offset);

    $('#heatmap-card').css({
        width: actualWidth + 'px',
        height: actualHeight + 'px',
    });
    const prop = {
        ...data,
        yTickText,
        canvasId: 'heatmap-card',
    };

    generateHeatmapPlot(prop, actualMaxTickLen);
};

const getTickPixelSize = (tickTexts) => {
    const tickSize = tickTexts.length >= 30 ? 12 : 14;
    const tickSizes = [];
    for (const tick of tickTexts) {
        tickSizes.push(visualTextLength(tick, tickSize));
        $('.hide-element').remove();
    }

    return Math.max(...tickSizes) + 35;
};
