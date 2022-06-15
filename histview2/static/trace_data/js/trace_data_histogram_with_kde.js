/* eslint-disable guard-for-in */
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
    const beforeRankValues = setParam('beforeRankValues', null);
    const isThinData = setParam('isThinData', false);
    const kdeData = setParam('kdeData', []);
    const threshHigh = setParam('threshHigh', '');
    const threshLow = setParam('threshLow', '');
    const prcMax = setParam('prcMax', '');
    const prcMin = setParam('prcMin', '');
    const valMin = setParam('minY', 0);
    const valMax = setParam('maxY', 1);
    const plotdata = setParam('plotdata', []);

    let customBinSize = 1;
    if (kdeData && kdeData.hist_labels.length > 1) {
        customBinSize = kdeData.hist_labels[1] - kdeData.hist_labels[0];
    }

    const procMasterName = setParam('procMasterName', '');
    const sensorName = setParam('sensorName', '');
    const catExpBox = setParam('catExpBox', null);
    const catExpBoxHTML = (catExpBox) ? `<br>${catExpBox}` : '';
    const graphTitle = `${procMasterName}<br>${sensorName}${catExpBoxHTML}`;

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
            width: 1,
        },
        type: 'scatter',
        orientation: 'h',
        xaxis: 'x',
        marker: {
            color: isThinData ? CONST.COLOR_THIN : '#d07e00',
        },
        hoverinfo: 'none',
    };

    const [histYMin, histYMax] = findMinMax(kdeData.hist_labels);
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
        nbinsy: kdeData.hist_counts.length,
        ybins: {
            end: histYMax,
            size: customBinSize,
            start: histYMin,
        },
        hovertemplate: '%{x}',
    };

    const categoryLabels = [];
    const stepChartDat = [];
    let categoryIds = [];
    if (beforeRankValues) {
        categoryIds = [...beforeRankValues[0]];
        beforeRankValues[0].forEach((catId, idx) => {
            categoryLabels[catId - 1] = beforeRankValues[1][idx];
        });
        categoryLabels.reverse();
        categoryIds.sort().reverse(); // 4321
        categoryLabels.forEach((catName) => {
            const categoryCount = plotdata.category_distributed[catName].counts_org;
            stepChartDat.push(categoryCount);
        });
    }

    const barChart = {
        y: categoryIds,
        x: stepChartDat,
        orientation: 'h',
        marker: {
            color: '#496433',
            line: {
                color: '#89b368',
                width: 1,
            },
        },
        name: '',
        opacity: 1,
        type: 'bar',
        hovertemplate: '%{x}',
        barmode: 'relative',
    };
    const data = !beforeRankValues ? [histogram, kdeDensity] : [barChart];

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
                color: '#65c5f1',
                width: 1,
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
                color: '#65c5f1',
                width: 1,
            },
        });
    }

    const layout = {
        showlegend: false,
        title: {
            display: false,
            text: graphTitle,
            font: {
                color: '#65c5f1',
                size: 11,
            },
        },
        xaxis: {
            autorange: true,
            automargin: true,
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
            // range: globalRange,
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
        autosize: true, // responsive histogram
        margin: {
            l: 30,
            r: 7,
            b: 7,
            t: 35,
            pad: 5,
        },
        shapes: lines,
        annotations: [],
    };

    if (beforeRankValues) {
        // layout.yaxis.tickangle = 45;
        // layout.yaxis.tickmode = 'array';
        layout.yaxis.tickvals = categoryIds;
        layout.yaxis.ticktext = categoryIds.map(cat => '');
        layout.yaxis.range = [valMin - 1, valMax + 1];
        layout.yaxis.autorange = false;

        // add label to barchart

        categoryIds.forEach((catId, k) => {
            const annonLabel = {
                x: 0,
                y: catId,
                text: categoryLabels[k],
                font: {
                    color: 'white',
                    size: 9,
                },
                textposition: 'bottom right',
                showarrow: false,
            };
            layout.annotations.push(annonLabel);
        });
    } else if (valMin !== null && valMax !== null) {
        layout.yaxis.range = [valMin, valMax];
        layout.yaxis.autorange = false;
    }
    Plotly.newPlot(canvasId, data, layout, {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    });
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
        if (data.points) {
            drawShapes(data.points[0].x, data.points[0].y, true);
        }
    })
        .on('plotly_unhover', (data) => {
            drawShapes(null, null, false);
        });
};
