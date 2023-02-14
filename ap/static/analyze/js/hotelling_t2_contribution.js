/* eslint-disable no-undef */
const drawT2ContributionChart = (json, chartConfig = {}, sizeOfData = null) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;

    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';
    figure.layout.xaxis.tickangle = -30;
    figure.layout.autosize = true;
    figure.layout.legend = {
        bgcolor: '#222222',
    };
    delete figure.layout.yaxis.scaleanchor;

    const len = figure.data.length;
    if (getNode(figure.data[len - 1], ['marker', 'colorbar'])) {
        figure.data[len - 1].marker.colorbar.bgcolor = 'transparent';
        figure.data[len - 1].marker.colorbar.thickness = 10;
    }

    Plotly.newPlot('t2ContributionChart', figure.data, figure.layout, {
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

const drawT2ContributionChartFromObj = (objData, sampleNo = null, chartConfig = {},
    sizeOfData = null, dpInfo=null,
    shortName = null) => {
    if (!objData) return;
    const startTime = performance.now();

    Plotly.newPlot('t2ContributionChart',
        genContributionChartData(objData, 't2', dpInfo),
        contributionChartLayout(objData, 't2', sampleNo, chartConfig, shortName), {
            responsive: true,
            ...genPlotlyIconSettings(),
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
