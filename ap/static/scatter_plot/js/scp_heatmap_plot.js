/* eslint-disable no-unused-vars */
const colorPalettes = [
    ['0', '#222222'],
    ['0.000001', '#18324c'],
    ['0.2', '#204465'],
    ['0.4', '#2d5e88'],
    ['0.6', '#3b7aae'],
    ['0.8', '#56b0f4'],
    ['1', '#6dc3fd']];

const generateHeatmapPlot = (prop, option, zoomRange) => {
    let xRange = null;
    let yRange = null;
    if (zoomRange) {
        if (!zoomRange['xaxis.autorange']) {
            xRange = zoomRange['xaxis.range[0]'] && zoomRange['xaxis.range[1]'] ? [zoomRange['xaxis.range[0]'], zoomRange['xaxis.range[1]']] : null;
            yRange = zoomRange['yaxis.range[0]'] && zoomRange['yaxis.range[1]'] ? [zoomRange['yaxis.range[0]'], zoomRange['yaxis.range[1]']] : null;
        }
    }

    const data = [{
        x: prop.array_x,
        y: prop.array_y,
        z: prop.array_z,
        type: 'heatmap',
        showscale: false,
        hoverongaps: true,
        uirevision: true,
        hoverinfo: 'none',
        colorscale: colorPalettes,
        zmax: prop.zmax,
        zmin: prop.zmin - 1,
    }];

    const layout = {
        plot_bgcolor: '#222222',
        paper_bgcolor: 'transparent',
        autosize: true,
        margin: {
            r: 0,
            l: prop.isShowY ? 33 : 0,
            t: 0,
            b: prop.isShowX ? 25 : 0,
        },
        yaxis: {
            ticklen: 0,
            showline: true,
            tickmode: 'array',
            ticktext: prop.array_y,
            tickvals: prop.array_y,
            showgrid: true,
            tickfont: {
                size: 8,
                color: 'white',
            },
            range: yRange,
        },
        xaxis: {
            showline: true,
            showgrid: true,
            tickangle: 0,
            tickmode: 'array',
            ticktext: prop.array_x,
            tickvals: prop.array_x,
            ticklen: 0,
            tickfont: {
                size: 8,
                color: 'white',
            },
            range: xRange,
        },
        hoverlabel: {
            align: 'left',
            bgcolor: '#222',
            bordercolor: '#222',
            font: {
                color: '#fff',
                size: 10,
            },
        },
        hovermode: 'closest',
    };

    const config = {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' },
    };

    Plotly.react(prop.canvasId, data, layout, config);
};

const makeHeatmapHoverInfoBox = (prop, xVal, yVal, option, x, y) => {
    if (!prop) return;
    const j = prop.array_x.indexOf(xVal.toString());
    const i = prop.array_y.indexOf(yVal.toString());
    const numberOfData = option.isShowNumberOfData ? prop.h_label : null;
    const facet = option.isShowFacet ? `Lv1 = ${prop.v_label.toString().split('|')[0]} ${option.hasLv2 ? `, Lv2 = ${prop.v_label.toString().split('|')[1] || prop.h_label}` : ''}` : null;
    const div = option.isShowDiv ? prop.h_label : null;
    showSCPDataTable(
        {
            data_no: numberOfData,
            facet,
            category: div,
            ratio: `${prop.array_z[i][j] || COMMON_CONSTANT.NA}%`,
            n_total: prop.n_total,
            from: formatDateTime(prop.time_min),
            to: formatDateTime(prop.time_max),
            n: prop.orig_array_z[i][j] || COMMON_CONSTANT.NA,
        }, {
            x: x - 55,
            y: y,
        },
        option.canvas_id,
        'heatmap',
    );
};
