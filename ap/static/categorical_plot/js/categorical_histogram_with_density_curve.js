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
    const yTitle = setParam('yTitle', '');
    const kdeData = setParam('kdeData', []);
    const minY = setParam('minY', 0);
    const maxY = setParam('maxY', 1);
    const minX = setParam('minX', null);
    const maxX = setParam('maxX', null);
    const chartInfos = setParam('chartInfos', {});
    const beforeRankValues = setParam('beforeRankValues', null);
    const plotData = setParam('plotData', []);
    const isCatLimited = setParam('isCatLimited', false);
    const allGroupNames = setParam('allGroupNames', []);
    const labelFmt = setParam('labelFmt', '');

    let customBinSize = 1;
    if (kdeData && kdeData.hist_labels.length > 1) {
        customBinSize = kdeData.hist_labels[1] - kdeData.hist_labels[0];
    }
    const maxKDE = Math.max(...kdeData.kde);
    const maxHist = Math.max(...kdeData.hist_counts);
    const transKDE = kdeData.kde.map((i) => (maxHist * i) / maxKDE);
    const kdeDensity = {
        y: kdeData.hist_labels,
        x: transKDE,
        customdata: {
            isbarchart: false,
            count: kdeData.hist_counts,
        },
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
        customdata: {
            isbarchart: false,
        },
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
        hoverinfo: 'none',
        // hovertemplate: '(%{y}, %{x})',
        yhoverformat: labelFmt,
    };

    // barchart
    const categoryLabels = [];
    const stepChartDat = [];
    let categoryIds = [];
    if (beforeRankValues && !isCatLimited) {
        categoryIds = [...beforeRankValues[0]];
        beforeRankValues[0].forEach((catId, idx) => {
            categoryLabels[catId - 1] = beforeRankValues[1][idx];
        });
        categoryLabels.reverse();
        categoryIds.sort().reverse(); // 4321
        categoryLabels.forEach((catName) => {
            const categoryCount =
                plotData.category_distributed[catName].counts_org;
            stepChartDat.push(categoryCount);
        });
    }
    const xData = genFullCategoryData(categoryIds, stepChartDat, allGroupNames);
    const barChart = {
        y: !isCatLimited ? allGroupNames.id : [],
        x: !isCatLimited ? xData : [],
        customdata: {
            isbarchart: true,
            groupname: allGroupNames,
        },
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
        // hovertemplate: '%{x}',
        hoverinfo: 'none',
        barmode: 'relative',
    };
    const data = !beforeRankValues ? [histogram, kdeDensity] : [barChart];

    // thresholds
    const lines = genThresholds({}, chartInfos);

    const layout = {
        showlegend: false,
        xaxis: {
            autorange: true,
            automargin: true,
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
            title: {
                text: yTitle,
                font: {
                    size: 10,
                    color: '#65c5f1',
                },
            },
            tickformat: labelFmt.includes('e') ? '.1e' : '',
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
            l: 43,
            r: 7,
            b: 35,
            t: 5,
            pad: 5,
        },
        shapes: lines,
        annotations: [],
    };

    if (beforeRankValues && !isCatLimited) {
        // layout.yaxis.tickangle = 45;
        // layout.yaxis.tickmode = 'array';
        layout.yaxis.tickvals = allGroupNames.id;
        layout.yaxis.ticktext = allGroupNames.id.map((cat) => '');
        const minYVal = Math.min(...allGroupNames.id);
        const maxYVal = Math.max(...allGroupNames.id);
        layout.yaxis.range = [minYVal - 1, maxYVal + 1];
        layout.yaxis.autorange = false;

        // add label to barchart

        allGroupNames.id.forEach((catId, k) => {
            const annonLabel = {
                x: 0,
                y: catId,
                text: allGroupNames.value[k],
                font: {
                    color: 'white',
                    size: 9,
                },
                textposition: 'bottom right',
                showarrow: false,
            };
            layout.annotations.push(annonLabel);
        });
    } else if (minY !== null && maxY !== null) {
        // do not compare minY, maxY vs 0!
        layout.yaxis.range = [minY, maxY];
        layout.yaxis.autorange = false;
    }

    if (maxX !== null && minX !== null) {
        layout.xaxis.range = [minX, maxX];
        layout.xaxis.autorange = false;
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
    hdPlot
        .on('plotly_hover', (data) => {
            drawShapes(data.points[0].x, data.points[0].y);
            if (data.points) {
                showInforTbl(data, true, canvasId);
            }
        })
        .on('plotly_unhover', (data) => {
            drawShapes(null, null, false);
        });
};
const drawEmptyHistogram = ($, paramObj) => {
    // ////////////// プライベート関数の定義 ////////////////////
    const setParam = (key, defaultValue) => {
        if (key in paramObj && !isEmpty(paramObj[key])) {
            return paramObj[key];
        }
        return defaultValue;
    };
    const canvasId = setParam('canvasId', '');
    const yLabelFreq = setParam('yLabelFreq', '度数(カウント)');
    const yTitle = setParam('yTitle', '');
    const data = [
        {
            x: [],
            y: [],
            type: 'bar',
            orientation: 'h',
        },
    ];
    const catLimitMsgs = $('#i18nCatLimitedMsg')
        .text()
        .split('BREAK_LINE')
        .join('<br>');
    const layout = {
        showlegend: false,
        xaxis: {
            showgrid: false,
            autorange: true,
            automargin: true,
            // title: {
            //     text: yLabelFreq,
            //     font: {
            //         color: 'rgba(255,255,255,1)',
            //         size: 10,
            //     },
            // },
            showticklabels: false,
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
        },
        yaxis: {
            // side: 'right',
            showgrid: false,
            showticklabels: false,
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
            // title: {
            //     text: yTitle,
            //     font: {
            //         size: 10,
            //         color: '#65c5f1',
            //     },
            // },
            tickformat: '',
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        hovermode: 'closest',
        autosize: true,
        margin: {
            l: 35,
            r: 7,
            b: 35,
            t: 5,
            pad: 5,
        },
        shapes: [],
        annotations: [
            {
                xref: 'x',
                yref: 'y',
                text: catLimitMsgs,
                showarrow: false,
                font: {
                    color: '#65c5f1',
                },
            },
        ],
    };
    Plotly.newPlot(canvasId, data, layout, {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    });
};
