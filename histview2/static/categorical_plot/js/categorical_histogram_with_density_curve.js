/* eslint-disable no-restricted-syntax */
// eslint-disable-next-line no-unused-vars
const HistogramWithDensityCurve = ($, paramObj) => {
    // ////////////// プライベート関数の定義 ////////////////////
    const setParam = (key, defaultValue) => {
        if (key in paramObj && !isEmpty(paramObj[key])) {
            return paramObj[key];
        }
        return defaultValue;
    };


    const canvasId = setParam('canvasId', '');
    const yLabelFreq = setParam('yLabelFreq', '度数(カウント)');
    const kdeData = setParam('kdeData', []);
    const minY = setParam('minY', 0);
    const maxY = setParam('maxY', 1);
    const threshHigh = setParam('threshHigh', '');
    const threshLow = setParam('threshLow', '');
    const prcMax = setParam('prcMax', '');
    const prcMin = setParam('prcMin', '');


    const timeCond = setParam('timeCond', '');
    const tabPrefix = setParam('tabPrefix', '');
    const categoryValue = setParam('categoryValue', '');

    // convert UTC to local time to show to UI
    const startLocalDt = moment.utc(timeCond.start_dt).local();
    const endLocalDt = moment.utc(timeCond.end_dt).local();
    const startDate = startLocalDt.format(DATE_FORMAT);
    const startTime = startLocalDt.format(TIME_FORMAT);
    const endDate = endLocalDt.format(DATE_FORMAT);
    const endTime = endLocalDt.format(TIME_FORMAT);

    let graphTitle;
    if ([eles.termTabPrefix, eles.cyclicTermTabPrefix].includes(tabPrefix)) {
        graphTitle = `${startDate} ${startTime} -<br>${endDate} ${endTime}  <br>${categoryValue}`;
    } else {
        graphTitle = categoryValue;
    }

    let customBinSize = 1;
    if (kdeData && kdeData.hist_labels.length > 1) {
        customBinSize = kdeData.hist_labels[1] - kdeData.hist_labels[0];
    }
    const maxKDE = Math.max(...kdeData.kde);
    const maxHist = Math.max(...kdeData.hist_counts);
    const transKDE = kdeData.kde.map(i => maxHist * i / maxKDE);
    const kdeDensity = {
        y: kdeData.hist_labels,
        x: transKDE,
        mode: 'lines',
        name: 'KDE',
        line: {
            shape: 'spline',
            width: 1.25,
        },
        type: 'scatter',
        orientation: 'h',
        xaxis: 'x',
        marker: {
            color: '#F39C12',
        },
        hoverinfo: 'none',
    };
    const histogram = {
        y: kdeData.hist_labels,
        x: kdeData.hist_counts,
        histfunc: 'sum',
        orientation: 'h',
        marker: {
            color: '#89b368',
            line: {
                color: '#89b368',
                width: 0.2,
            },
        },
        name: '',
        opacity: 0.75,
        type: 'histogram',
        autobiny: false,
        autobinx: false,
        // nbinsy: kdeData.hist_counts.length,
        ybins: {
            end: kdeData.hist_labels[kdeData.hist_labels.length - 1],
            size: customBinSize,
            start: kdeData.hist_labels[0],
        },
        hovertemplate: '%{x}',
    };
    const data = [
        histogram,
        kdeDensity,
    ];
    // thresholds
    const lines = [];
    if (!isEmpty(threshHigh)) {
        lines.push({
            type: 'line',
            xref: 'paper',
            x0: 0,
            y0: threshHigh,
            x1: 1,
            y1: threshHigh,
            line: {
                color: 'rgb(255, 0, 0)',
                width: 1,
            },
        });
    }
    if (!isEmpty(threshLow)) {
        lines.push({
            type: 'line',
            xref: 'paper',
            x0: 0,
            y0: threshLow,
            x1: 1,
            y1: threshLow,
            line: {
                color: 'rgb(255, 0, 0)',
                width: 1,
            },
        });
    }
    if (!isEmpty(prcMax)) {
        lines.push({
            type: 'line',
            xref: 'paper',
            x0: 0,
            y0: prcMax,
            x1: 1,
            y1: prcMax,
            line: {
                color: '#4276ad',
                width: 1,
                // dash: 'dot',
            },
        });
    }
    if (!isEmpty(prcMin)) {
        lines.push({
            type: 'line',
            xref: 'paper',
            x0: 0,
            y0: prcMin,
            x1: 1,
            y1: prcMin,
            line: {
                color: '#4276ad',
                width: 1,
                // dash: 'dot',
            },
        });
    }
    const layout = {
        showlegend: false,
        title: {
            text: graphTitle,
            font: {
                color: '#65c5f1',
                size: 10,
            },
        },
        xaxis: {
            autorange: true,
            automargin: false,
            title: {
                text: yLabelFreq,
                font: {
                    color: 'rgba(255,255,255,1)',
                    size: 10,
                },
            },
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: 8,
            },
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
        },
        yaxis: {
            // side: 'right',
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: 8,
            },
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
        },
        xaxis2: {
            automargin: false,
            side: 'top',
            overlaying: 'x',
            rangemode: 'tozero',
            autorange: true,
            showgrid: false,
            showticklabels: false,
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
            tickfont: {
                size: 8,
            },
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        hovermode: 'closest',
        autosize: true,
        margin: {
            l: 30,
            r: 7,
            b: 35,
            t: 35,
            pad: 5,
        },
        shapes: lines,
    };

    // do not compare minY, maxY vs 0!
    if (minY !== null && maxY !== null) {
        layout.yaxis.range = [minY, maxY];
        layout.yaxis.autorange = false;
    }
    try {
        Plotly.newPlot(canvasId, data, layout, {
            displayModeBar: false,
            responsive: true, // responsive histogram
            useResizeHandler: true, // responsive histogram
            style: { width: '100%', height: '100%' }, // responsive histogram
        });
    } catch (e) {
        console.log(canvasId, data, layout);
        console.log(e);
    }

    const drawShapes = (x = null, y = null, display = true) => {
        const plots = document.querySelectorAll('.hd-plot');
        for (const plot of plots) {
            const currentShapes = plot.layout.shapes;
            const layoutUpdates = {};
            layoutUpdates.shapes = [...currentShapes];

            // remove old crosshair
            const lastShape = layoutUpdates.shapes.slice(-1)[0];
            if (lastShape && lastShape.name === 'crosshair') {
                layoutUpdates.shapes.pop();
            }

            // add new crosshair
            if (display) {
                layoutUpdates.shapes.push({
                    type: 'line',
                    xref: 'paper',
                    x0: 0,
                    y0: y,
                    x1: 10000,
                    y1: y,
                    line: {
                        color: 'rgb(255, 0, 0)',
                        width: 1,
                        dash: 'solid',
                    },
                    name: 'crosshair',
                });
            }
            Plotly.update(plot, {}, layoutUpdates);
        }
    };

    const hdPlot = document.getElementById(canvasId);
    hdPlot.on('plotly_hover', (data) => {
        drawShapes(data.points[0].x, data.points[0].y);
    })
        .on('plotly_unhover', (data) => {
            drawShapes(null, null, false);
        });
};
