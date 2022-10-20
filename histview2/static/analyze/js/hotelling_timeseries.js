/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

const drawShapes = (x = null, display = true) => {
    const plots = document.querySelectorAll('#timeSeriesT2, #timeSeriesQ');
    const layoutUpdates = {};
    if (display) {
        layoutUpdates.shapes = [
            {
                type: 'line',
                yref: 'paper',
                x0: x,
                y0: -1,
                x1: x,
                y1: 1,
                line: {
                    color: 'rgb(255, 0, 0)',
                    width: 1,
                    dash: 'solid',
                },
                layer: 'above',
            },
        ];
    } else {
        layoutUpdates.shapes = [];
    }
    plots.forEach((plot) => {
        Plotly.update(plot, {}, layoutUpdates);
    });
};

const drawTimeSeriesT2Chart = (json, jsonDtTest = {}, chartConfig = {}, sizeOfData = null) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;

    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';
    figure.layout.legend = {
        bgcolor: 'transparent',
        bordercolor: 'transparent',
        borderwidth: 0.1,
        font: {
            color: 'rgba(255,255,255,1)',
            family: '',
            size: 12,
        },
        y: 0.95,
        xanchor: 'left',
        orientation: 'h',
        traceorder: 'reversed',
    };
    figure.layout.autosize = true;
    delete figure.layout.yaxis.scaleanchor;
    // plot config
    const plotConfig = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };


    const timeSeriesT2Element = document.getElementById('timeSeriesT2');

    Plotly.newPlot('timeSeriesT2', figure.data, figure.layout, plotConfig);

    // xtest click event
    timeSeriesT2Element.on('plotly_click', (dataPoint) => {
        // to spread sampleNo and clickedDataIndexto other charts
        const sampleNo = dataPoint.points[0].x;
        dataPoint.points[0].sampleNo = sampleNo;

        if (sampleNo > 0) {
            // clicked on Xtest
            dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        } else {
            return; // support test data only
            // dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        }

        // to broadcast click event to other charts
        broadcastClickEvent(dataPoint, startingChart = 'timeSeriesT2', jsonPCAScoreTest = jsonDtTest);
    });

    // Add hover event for t2 & q plots
    timeSeriesT2Element.on('plotly_hover', (data) => {
        drawShapes(data.points[0].x);
    }).on('plotly_unhover', (data) => {
        drawShapes(null, false);
    });
    // send plotting time
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

const drawTimeSeriesQChart = (json, jsonDtTest = {}, chartConfig = {}, sizeOfData = null) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;

    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';
    figure.layout.yaxis.tickmode = 'linear';
    figure.layout.legend = {
        bgcolor: 'transparent',
        bordercolor: 'transparent',
        borderwidth: 0.1,
        font: {
            color: 'rgba(255,255,255,1)',
            family: '',
            size: 12,
        },
        y: 0.95,
        xanchor: 'left',
        orientation: 'h',
        traceorder: 'reversed',
    };
    figure.layout.autosize = true;
    delete figure.layout.yaxis.scaleanchor;
    // plot config
    const plotConfig = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };

    const timeSeriesQElement = document.getElementById('timeSeriesQ');

    Plotly.newPlot('timeSeriesQ', figure.data, figure.layout, plotConfig);

    // xtest click event
    timeSeriesQElement.on('plotly_click', (dataPoint) => {
        // to spread sampleNo and clickedDataIndexto other charts
        const sampleNo = dataPoint.points[0].x;
        dataPoint.points[0].sampleNo = sampleNo;

        if (sampleNo > 0) {
            // clicked on Xtest
            dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        } else {
            return; // support test data only
            // dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        }

        // to broadcast click event to other charts
        broadcastClickEvent(dataPoint, startingChart = 'timeSeriesQ', jsonPCAScoreTest = jsonDtTest);
    });
    // Add hover event for t2 & q plots
    timeSeriesQElement.on('plotly_hover', (data) => {
        drawShapes(data.points[0].x);
    }).on('plotly_unhover', (data) => {
        drawShapes(null, false);
    });
    // send plotting time
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

const genTimeSeriesData = (data, type = 'test', label = 'T2_statics') => {
    retData = {
        x: [],
        y: [],
        text: [],
        type: 'scatter',
        mode: 'lines',
        line: {
            width: 1.88976377952756,
            color: '',
            dash: 'solid',
        },
        hoveron: 'points',
        name: type,
        legendgroup: type,
        showlegend: true,
        xaxis: 'x',
        yaxis: 'y',
        hoverinfo: 'text',
        frame: null,
    };
    retData.text = data.map((v, k) => {
        const n = (type === 'test') ? (k + 1) : (k + 1 - data.length);
        retData.line.color = (type === 'test') ? 'rgba(255,165,0,1)' : 'rgba(255,255,255,1)';
        retData.x.push(n);
        retData.y.push(v);
        return `sample_no:  ${n}<br />${label}: ${v}`;
    });
    return retData;
};

const drawTimeSeriesT2ChartFromObj = (objData, jsonDtTest = {}, chartConfig = {}, sizeOfData = null) => {
    if (!objData) return;

    // const chartConfig.width = $('#xTest').width();
    const startTime = performance.now();

    const t2TrainTimeSeries = genTimeSeriesData(objData.train, 'train');
    const t2TestTimeSeries = genTimeSeriesData(objData.test);
    const t2TimeSeriesData = [t2TrainTimeSeries, t2TestTimeSeries];
    const t2TimeSeriesLayout = {
        margin: {
            t: 24.8556800885568,
            r: 6.6417600664176,
            b: 36.086896360869,
            l: 28.5595682855957,
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        font: {
            color: 'rgba(0,0,0,1)',
            family: '',
            size: 13.2835201328352,
        },
        xaxis: {
            domain: [
                0,
                1,
            ],
            automargin: true,
            type: 'linear',
            autorange: true,
            ticks: 'outside',
            tickcolor: 'rgba(51,51,51,1)',
            ticklen: 3.3208800332088,
            tickwidth: 0.301898184837164,
            showticklabels: true,
            tickfont: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            tickangle: -0,
            showline: false,
            linecolor: null,
            linewidth: 0,
            showgrid: false,
            gridcolor: '#444444',
            gridwidth: 0,
            zeroline: false,
            anchor: 'y',
            title: {
                text: 'Sample No.',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
            },
            hoverformat: '.2f',
        },
        yaxis: {
            domain: [
                0,
                1,
            ],
            automargin: true,
            type: 'linear',
            autorange: true,
            tickmode: 'auto',
            nticks: 5,
            ticks: 'outside',
            tickcolor: 'rgba(51,51,51,1)',
            ticklen: 3.3208800332088,
            tickwidth: 0.301898184837164,
            showticklabels: true,
            tickfont: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            tickangle: -0,
            showline: false,
            linecolor: null,
            linewidth: 0,
            showgrid: false,
            gridcolor: '#444444',
            gridwidth: 0,
            zeroline: false,
            anchor: 'x',
            title: {
                text: 'T2 Statics',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
            },
            hoverformat: '.2f',
        },
        shapes: [
            {
                type: 'rect',
                fillcolor: null,
                line: {
                    color: null,
                    width: 0,
                    linetype: [],
                },
                yref: 'paper',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: 0,
                y1: 1,
            },
        ],
        showlegend: true,
        legend: {
            bgcolor: 'transparent',
            bordercolor: 'transparent',
            borderwidth: 0.1,
            font: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            x: 0,
            xanchor: 'left',
            y: 1,
        },
        hovermode: 'closest',
        barmode: 'relative',
        autosize: true,
    };
    const plotConfig = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };
    const timeSeriesT2Element = document.getElementById('timeSeriesT2');

    Plotly.newPlot(timeSeriesT2Element, t2TimeSeriesData, t2TimeSeriesLayout, plotConfig);

    // xtest click event
    timeSeriesT2Element.on('plotly_click', (dataPoint) => {
        // to spread sampleNo and clickedDataIndexto other charts
        const sampleNo = dataPoint.points[0].x;
        dataPoint.points[0].sampleNo = sampleNo;

        if (sampleNo > 0) {
            // clicked on Xtest
            dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        } else {
            return; // support test data only
            // dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        }

        // to broadcast click event to other charts
        broadcastClickEvent(dataPoint, startingChart = 'timeSeriesT2', jsonPCAScoreTest = jsonDtTest);
    });

    // Add hover event for t2 & q plots
    timeSeriesT2Element.on('plotly_hover', (data) => {
        drawShapes(data.points[0].x);
    }).on('plotly_unhover', (data) => {
        drawShapes(null, false);
    });
    // send plotting time
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

const drawTimeSeriesQChartFromObj = (objData, jsonDtTest = {}, chartConfig = {}, sizeOfData = null) => {
    if (!objData) return;

    const startTime = performance.now();

    const qTrainTimeSeries = genTimeSeriesData(objData.SPE, 'train', 'Q_statics');
    const qTestTimeSeries = genTimeSeriesData(objData.test, 'test', 'Q_statics');
    const qTimeSeriesData = [qTrainTimeSeries, qTestTimeSeries];
    const qTimeSeriesLayout = {
        margin: {
            t: 24.8556800885568,
            r: 6.6417600664176,
            b: 36.086896360869,
            l: 28.5595682855957,
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        font: {
            color: 'rgba(0,0,0,1)',
            family: '',
            size: 13.2835201328352,
        },
        xaxis: {
            domain: [
                0,
                1,
            ],
            automargin: true,
            type: 'linear',
            autorange: true,
            ticks: 'outside',
            tickcolor: 'rgba(51,51,51,1)',
            ticklen: 3.3208800332088,
            tickwidth: 0.301898184837164,
            showticklabels: true,
            tickfont: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            tickangle: -0,
            showline: false,
            linecolor: null,
            linewidth: 0,
            showgrid: false,
            gridcolor: '#444444',
            gridwidth: 0,
            zeroline: false,
            anchor: 'y',
            title: {
                text: 'Sample No.',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
            },
            hoverformat: '.2f',
        },
        yaxis: {
            domain: [
                0,
                1,
            ],
            automargin: true,
            type: 'linear',
            autorange: true,
            tickmode: 'auto',
            nticks: 5,
            ticks: 'outside',
            tickcolor: 'rgba(51,51,51,1)',
            ticklen: 3.3208800332088,
            tickwidth: 0.301898184837164,
            showticklabels: true,
            tickfont: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            tickangle: -0,
            showline: false,
            linecolor: null,
            linewidth: 0,
            showgrid: false,
            gridcolor: '#444444',
            gridwidth: 0,
            zeroline: false,
            anchor: 'x',
            title: {
                text: 'Q Statics',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
            },
            hoverformat: '.2f',
        },
        shapes: [
            {
                type: 'rect',
                fillcolor: null,
                line: {
                    color: null,
                    width: 0,
                    linetype: [],
                },
                yref: 'paper',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: 0,
                y1: 1,
            },
        ],
        showlegend: true,
        legend: {
            bgcolor: 'transparent',
            bordercolor: 'transparent',
            borderwidth: 0.1,
            font: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            x: 0,
            xanchor: 'left',
            y: 1,
        },
        hovermode: 'closest',
        barmode: 'relative',
        autosize: true,
    };
    const plotConfig = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };
    const timeSeriesQElement = document.getElementById('timeSeriesQ');

    Plotly.newPlot(timeSeriesQElement, qTimeSeriesData, qTimeSeriesLayout, plotConfig);

    // xtest click event
    timeSeriesQElement.on('plotly_click', (dataPoint) => {
        // to spread sampleNo and clickedDataIndexto other charts
        const sampleNo = dataPoint.points[0].x;
        dataPoint.points[0].sampleNo = sampleNo;

        if (sampleNo > 0) {
            // clicked on Xtest
            dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        } else {
            return; // support test data only
            // dataPoint.points[0].clickedDataIndex = sampleNo - 1;
        }

        // to broadcast click event to other charts
        broadcastClickEvent(dataPoint, startingChart = 'timeSeriesQ', jsonPCAScoreTest = jsonDtTest);
    });

    // Add hover event for t2 & q plots
    timeSeriesQElement.on('plotly_hover', (data) => {
        drawShapes(data.points[0].x);
    }).on('plotly_unhover', (data) => {
        drawShapes(null, false);
    });
    // send plotting time
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
