const genHistogramTrace = (plotData, scaleOption) => {
    const scaleInfo = getScaleInfo(plotData, scaleOption);
    const kdeData = scaleInfo.kde_data;
    const fmt = kdeData.label_fmt;
    let customBinSize = 1;
    if (kdeData && kdeData.hist_labels.length > 1) {
        customBinSize = kdeData.hist_labels[1] - kdeData.hist_labels[0];
    }

    const traces = [];
    const histogram = {
        x: kdeData.hist_labels,
        y: kdeData.hist_counts,
        histfunc: 'sum',
        marker: {
            color: CONST.COLOR_NORMAL,
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
        // nbinsx: plotData.scale_setting.kde_data.hist_counts.length,
        xbins: {
            end: kdeData.hist_labels[kdeData.hist_labels.length - 1],
            size: customBinSize,
            start: kdeData.hist_labels[0],
        },
        xhoverformat: fmt,
        hoverinfo: 'none',
    };
    traces.push(histogram);
    if (kdeData.hist_labels && kdeData.kde) {
        const maxKDE = Math.max(...kdeData.kde);
        const maxHist = Math.max(...kdeData.hist_counts);
        const transKDE = kdeData.kde.map(i => maxHist * i / maxKDE);
        traces.push({
            line: {
                color: 'orange',
                shape: 'spline',
                width: 1,
            },
            mode: 'lines',
            type: 'scatter',
            x: kdeData.hist_labels,
            y: transKDE,
            name: '',
            xaxis: 'x',
            yaxis: 'y',
            hoverinfo: 'none',
            customdata: {
                count: kdeData.hist_counts,
            },
        });
    }
    return [traces, fmt];
};

const genHistogramLayout = (xrange = false, yrange = false, fmt) => {
    const styleLayout = {
        font: {
            size: 11,
            color: 'white',
        },
        showlegend: false,
        margin: {
            l: 40,
            r: 15,
            b: 20,
            t: 25,
            // pad: 5,
        },
        hovermode: 'closest',
        bargap: 0,
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        xaxis: {
            showgrid: true,
            gridcolor: '#303030',
            autotick: true,
            // nticks: 9,
            tickfont: {
                size: fmt.includes('e') ? 8 : 10,
            },
            tickformat: fmt.includes('e') ? '.1e' : '',
        },
        yaxis: {
            showgrid: true,
            gridcolor: '#303030',
            autotick: true,
            // nticks: 9,
            side: 'left',
            tickfont: {
                size: 10,
            },
            rangemode: 'tozero',
        },
    };
    if (xrange) {
        styleLayout.xaxis.range = xrange;
    }
    if (yrange) {
        styleLayout.yaxis.range = yrange;
    }
    return styleLayout;
};

// threshold lines
const addHistogramThresholds = (layout, maxHistNum, histLabels, xThreshold) => {
    layout.shapes = [];
    const ref = { xaxis: 'x', yaxis: 'y' };

    if (histLabels.length > 0) {
        layout.shapes = genThresholds(xThreshold, {}, ref, null, [0, maxHistNum]);
    }

    return layout;

    // draw line annotation
    // if (!isEmpty(procThresholds.xMin)) {
    //     const procMinBin = binarySearch(histLabels, procThresholds.xMin, ((x, y) => x - y));
    //     if (histLabels.length > procMinBin + 1) {
    //         layout.shapes.push({
    //             type: 'line',
    //             xref: 'x',
    //             yref: 'y',
    //             x0: procThresholds.xMin,
    //             y0: 0,
    //             x1: procThresholds.xMin,
    //             y1: maxHistNum,
    //             line: {
    //                 color: CONST.BLUE,
    //                 width: 0.75,
    //             },
    //         });
    //     }
    // }
    //
    // if (!isEmpty(procThresholds.xMax)) {
    //     const procMaxBin = binarySearch(histLabels, procThresholds.xMax, ((x, y) => x - y));
    //     if (histLabels.length > procMaxBin + 1) {
    //         layout.shapes.push({
    //             type: 'line',
    //             xref: 'x',
    //             yref: 'y',
    //             x0: procThresholds.xMax,
    //             y0: 0,
    //             x1: procThresholds.xMax,
    //             y1: maxHistNum,
    //             line: {
    //                 color: CONST.BLUE,
    //                 width: 0.75,
    //             },
    //         });
    //     }
    // }
    //
    // // // draw line annotation
    // if (!isEmpty(uclThresholds.xMin)) {
    //     const uclMinBin = binarySearch(histLabels, uclThresholds.xMin, ((x, y) => x - y));
    //     if (histLabels.length > uclMinBin + 1) {
    //         layout.shapes.push({
    //             type: 'line',
    //             xref: 'x',
    //             yref: 'y',
    //             x0: uclThresholds.xMin,
    //             y0: 0,
    //             x1: uclThresholds.xMin,
    //             y1: maxHistNum,
    //             line: {
    //                 color: CONST.RED,
    //                 width: 0.75,
    //             },
    //         });
    //     }
    // }
    //
    // if (!isEmpty(uclThresholds.xMax)) {
    //     const uclMaxBin = binarySearch(histLabels, uclThresholds.xMax, ((x, y) => x - y));
    //     if (histLabels.length > uclMaxBin + 1) {
    //         layout.shapes.push({
    //             type: 'line',
    //             xref: 'x',
    //             yref: 'y',
    //             x0: uclThresholds.xMax,
    //             y0: 0,
    //             x1: uclThresholds.xMax,
    //             y1: maxHistNum,
    //             line: {
    //                 color: CONST.RED,
    //                 width: 0.75,
    //             },
    //         });
    //     }
    // }
    //
    // return layout;
};
