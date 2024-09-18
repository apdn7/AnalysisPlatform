const drawXTrainScatter = (json, chartConfig = {}, sizeOfData = null) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;

    // customize jsonDtTrain
    figure.data[0].marker.color = 'white';
    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.legend = {
        bgcolor: 'transparent',
        bordercolor: 'transparent',
        font: {
            color: 'rgba(255,255,255,1)',
            family: '',
            size: 11,
        },
        xanchor: 'right',
        tracegroupgap: 3,
    };
    figure.layout.autosize = true;
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';
    figure.layout.xaxis.title.font = {
        color: 'rgba(255,255,255,1)',
        family: '',
        size: 14,
    };
    figure.layout.yaxis.title.font = {
        color: 'rgba(255,255,255,1)',
        family: '',
        size: 14,
    };
    figure.layout.xaxis.tickfont.color = 'rgba(255,255,255,1)';
    figure.layout.yaxis.tickfont.color = 'rgba(255,255,255,1)';
    figure.layout.xaxis.autorange = true;
    figure.layout.yaxis.autorange = true;
    figure.layout.annotations[0].font.color = 'rgba(255,255,255,1)';
    delete figure.layout.yaxis.scaleanchor;

    // remove Guide text from annotation
    figure.layout.annotations[0].text = '';
    figure.data.forEach((dat) => {
        if (dat.mode === 'markers') {
            dat.hoverinfo = 'none';
        } else if (Array.isArray(dat.text)) {
            dat.text = dat.text.map((t) => t.split('<br />')[0]);
        }
    });
    // plot config
    const plotConfig = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };

    const pcaXTrainPlot = document.getElementById('xTrain');
    // plot xtrain data
    Plotly.newPlot('xTrain', figure.data, figure.layout, plotConfig);
    pcaXTrainPlot.on('plotly_hover', (data) => {
        const dataPoint = data.points[0];
        if (dataPoint.data.mode === 'markers') {
            showDataTablePCA(data, 'scatter', 'xTrain');
        } else {
            $('#dp-info-content').hide();
        }
    });

    unHoverHandler(pcaXTrainPlot);

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

const drawXTestScatter = (
    json,
    chartConfig = {},
    sizeOfData = null,
    arrayPlotdata = null,
) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;

    // customize jsonDtTest
    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.legend = {
        bgcolor: 'transparent',
        bordercolor: 'transparent',
        font: {
            color: 'rgba(255,255,255,1)',
            family: '',
            size: 11,
        },
        y: -0.1,
        tracegroupgap: 3,
        orientation: 'h',
    };
    delete figure.layout.yaxis.scaleanchor;
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';
    delete figure.layout.xaxis.title;
    delete figure.layout.yaxis.title;
    figure.layout.xaxis.autorange = true;
    figure.layout.yaxis.autorange = true;
    figure.layout.autosize = true;
    // figure.layout.annotations[0].font.color = 'rgba(255,255,255,1)';
    figure.layout.xaxis.tickfont.color = 'rgba(255,255,255,1)';
    figure.layout.yaxis.tickfont.color = 'rgba(255,255,255,1)';
    figure.data.forEach((dat) => {
        if (dat.mode === 'markers') {
            dat.hoverinfo = 'none';
        } else if (Array.isArray(dat.text)) {
            dat.text = dat.text.map((t) => t.split('<br />')[0]);
        }
    });
    // plot config
    const plotConfig = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };

    // assign custome data to plot-view handling on data-point
    // apply for first/ full data points only
    if (arrayPlotdata) {
        scpCustomData = {
            proc_id_x: arrayPlotdata[0].end_proc_id,
            sensor_id_x: arrayPlotdata[0].end_col_id,
        };
    }
    figure.data[0].customdata = scpCustomData;

    // plot xtest data
    const xTestElement = document.getElementById('xTest');

    Plotly.newPlot('xTest', figure.data, figure.layout, plotConfig);

    // xtest click event
    xTestElement
        .on('plotly_click', (dataPoint) => {
            // to spread sampleNo to other charts
            const { pointIndex } = dataPoint.points[0];
            dataPoint.points[0].sampleNo = pointIndex + 1;
            dataPoint.points[0].clickedDataIndex = pointIndex;

            // to broadcast click event to other charts
            broadcastClickEvent(
                dataPoint,
                (startingChart = 'xTest'),
                (jsonPCAScoreTest = json),
            );
        })
        .on('plotly_hover', (data) => {
            const dataPoint = data.points[0];
            if (dataPoint.data.mode === 'markers') {
                showDataTablePCA(data, 'scatter', 'xTest');
            } else {
                $('#dp-info-content').hide();
            }
        });

    unHoverHandler(xTestElement);
    showCustomContextMenu(xTestElement);

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

const showDataTablePCA = (data, type = 'bar', chartID) => {
    const dpIndex = getDataPointIndex(data);
    const dataPoint = data.points[0];
    const xValue = applySignificantDigit(dataPoint.data.x[dpIndex]);
    const yValue = applySignificantDigit(dataPoint.data.y[dpIndex]);
    const genDataTable = (x, y) => {
        let tblContent = '<tr>';
        if (type === 'scatter') {
            tblContent += genTRItems('PC1', x);
            tblContent += genTRItems('PC2', y);
        }
        if (type === 'timeseries') {
            tblContent += genTRItems('Index', x);
            tblContent += genTRItems('T2_Statics', y);
        }
        tblContent += '</tr>';
        return tblContent;
    };
    const dataTable = genDataTable(xValue, yValue);
    genDataPointHoverTable(
        dataTable,
        {
            x: data.event.pageX - 120,
            y: data.event.pageY,
        },
        130,
        true,
        chartID,
    );
};
