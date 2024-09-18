const drawPCABiplotChart = (json, chartConfig = {}, sizeOfData = null) => {
    if (!json) return;

    const startTime = performance.now();

    const figure = json;
    figure.layout.autosize = true;
    figure.layout.plot_bgcolor = '#222222';
    figure.layout.paper_bgcolor = '#222222';
    figure.layout.xaxis.gridcolor = '#444444';
    figure.layout.yaxis.gridcolor = '#444444';

    figure.data.forEach((dat) => {
        if (dat.mode === 'markers') {
            dat.hoverinfo = 'none';
        } else if (Array.isArray(dat.text) && dat.mode === 'lines') {
            dat.text = dat.text.map((t) => {
                if (t) {
                    if (t.split('<br />').length === 3) {
                        // for border only
                        return t.split('<br />')[0];
                    }
                    return '';
                }
                return '';
            });
        }
    });
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

    delete figure.layout.yaxis.scaleanchor;
    Plotly.newPlot('pcaBiplotChart', figure.data, figure.layout, {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
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
