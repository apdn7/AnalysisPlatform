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

const genHistogramLayout = (xrange = false, yrange = false, fmt, isLargeOfSensors=false, chartLabel='') => {
    const styleLayout = {
        font: {
            size: 11,
            color: 'white',
        },
        showlegend: false,
        margin: {
            l: 7,
            r: 10,
            b: 5,
            t: 10,
            // pad: 5,
        },
        hovermode: 'closest',
        bargap: 0,
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        xaxis: {
            showticklabels: !isLargeOfSensors,
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
            showticklabels: !isLargeOfSensors,
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
        bargroupgap: 0.1,
    };
    if (xrange) {
        styleLayout.xaxis.range = xrange;
    }
    if (yrange) {
        styleLayout.yaxis.range = yrange;
    }
    if (!isLargeOfSensors) {
        styleLayout.title = {
            text: chartLabel,
            font: {
                size: 11,
                color: '#65c5f1',
            },
            xref: 'paper',
            x: 0.5,
        };
        styleLayout.margin = {
            l: 40,
            r: 15,
            b: 20,
            t: 25,
        };
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
};
