const drawQContributionChart = (json, chartConfig = {}, sizeOfData = null) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;
    figure.layout.autosize = true;
    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';
    figure.layout.xaxis.tickangle = COMMON_CONSTANT.TICKS_ANGLE;
    figure.layout.legend = {
        bgcolor: '#222222',
    };
    delete figure.layout.yaxis.scaleanchor;

    const len = figure.data.length;
    if (getNode(figure.data[len - 1], ['marker', 'colorbar'])) {
        figure.data[len - 1].marker.colorbar.bgcolor = 'transparent';
        figure.data[len - 1].marker.colorbar.thickness = 10;
    }

    // const tickTexts = figure.layout.yaxis.ticktext;
    // figure.layout.yaxis.ticktext = tickTexts.map(v => (v.length > 10 ? `${v.substring(0, 9)}...` : v));
    Plotly.newPlot('qContributionChart', figure.data, figure.layout, {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    });

    // send plotting time event
    const endTime = performance.now();
    gtag('event', 'PCA_et', {
        event_category: 'ExecTime',
        event_label: 'JsPlot',
        value: endTime - startTime,
    });

    // send data size
    gtag('event', 'PCA_ds', {
        event_category: 'InputData',
        event_label: 'JsPlot',
        value: sizeOfData,
    });
};

const drawQContributionChartFromObj = (
    objData,
    sampleNo = null,
    chartConfig = {},
    sizeOfData = null,
    dpInfo = null,
    shortName = null,
) => {
    if (!objData) return;
    const startTime = performance.now();

    Plotly.newPlot(
        'qContributionChart',
        genContributionChartData(objData, 'q', dpInfo),
        contributionChartLayout(objData, 'q', sampleNo),
        {
            ...genPlotlyIconSettings(),
            responsive: true, // responsive histogram
            useResizeHandler: true, // responsive histogram
            style: { width: '100%', height: '100%' }, // responsive histogram
        },
    );

    // send plotting time event
    const endTime = performance.now();
    gtag('event', 'PCA_et', {
        event_category: 'ExecTime',
        event_label: 'JsPlot',
        value: endTime - startTime,
    });

    // send data size
    gtag('event', 'PCA_ds', {
        event_category: 'InputData',
        event_label: 'JsPlot',
        value: sizeOfData,
    });
};
