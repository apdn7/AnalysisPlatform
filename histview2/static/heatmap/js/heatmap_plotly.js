/* eslint-disable max-len */

const createHeatMap = (prop) => {
    const common = {
        family: 'Calibri Light',
        tickSize: 10,
        titleSize: 11,
        bgcolor: '#222222',
        textcolor: '#ffffff',
        primaryColor: '#65c5f1',
    };

    const heatmapTrace = {
        // name: [],
        type: 'heatmap',
        y: prop.y || [],
        x: prop.x || [],
        zmax: prop.zmax,
        zmin: prop.zmin,
        z: prop.z || [],
        inherit: false,
        text: prop.hover || [],
        hoverinfo: 'text',
        colorbar: {
            title: prop.aggFunction,
            y: 0.48,
            len: 1.12,
            lenmode: 'fraction',
            thickness: 15,
            thicknessmode: 'pixels',
        },
        colorscale: prop.colorScale,
        hoverlabel: {
            font: {
                color: common.textcolor,
                size: common.tickSize,
                family: common.family,
                bgcolor: common.bgcolor,
            },
        },
    };
    const data = [heatmapTrace];
    const [_, yMax] = findMinMax(prop.yTickvals);
    const layout = {
        title: {
            text: '',
            font: {
                color: common.primaryColor,
                size: common.titleSize,
                family: common.family,
            },
        },
        plot_bgcolor: common.bgcolor,
        paper_bgcolor: common.bgcolor,
        font: {
            color: common.textcolor,
            family: common.family,
        },
        yaxis: {
            title: {
                text: prop.title,
                font: {
                    color: common.primaryColor,
                    size: common.titleSize,
                    family: common.family,
                },
            },
            mirror: true,
            ticklen: 0,
            showline: true,
            tickmode: 'array',
            ticktext: prop.yTicktext,
            tickvals: prop.yTickvals.map(y => y + 0.5),
            tickfont: {
                size: common.tickSize + 1,
                family: common.family,
            },
            range: [0.1, yMax + 1],
        },
        xaxis: {
            title: '',
            mirror: true,
            showline: true,
            tickangle: 0,
            tickmode: 'array',
            ticktext: prop.xTicktext,
            tickvals: prop.xTickvals,
            ticklen: 3,
            tickfont: {
                size: common.tickSize,
                family: common.family,
            },
        },
        zaxis: {
            title: prop.aggFunction,
        },
        autosize: true,
        margin: {
            l: prop.cardValue ? 60 : 45,
            r: 10,
            b: 35,
            t: 3,
        },
    };

    const heatmapIconSettings = genPlotlyIconSettings();
    const config = {
        ...heatmapIconSettings,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };

    Plotly.react(prop.canvasId, {
        data,
        layout,
        config,
    });
};
