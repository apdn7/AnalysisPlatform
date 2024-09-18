// shapes = sensorDat.groups
const rlpTemplate = (shapes, plotName = '') => ({
    template: {
        data: {
            bar: [
                {
                    error_x: {
                        color: '#2a3f5f',
                    },
                    error_y: {
                        color: '#2a3f5f',
                    },
                    marker: {
                        line: {
                            color: '#E5ECF6',
                            width: 0.5,
                        },
                    },
                    type: 'bar',
                },
            ],
            barpolar: [
                {
                    marker: {
                        line: {
                            color: '#E5ECF6',
                            width: 0.5,
                        },
                    },
                    type: 'barpolar',
                },
            ],
            carpet: [
                {
                    aaxis: {
                        endlinecolor: '#2a3f5f',
                        gridcolor: 'white',
                        linecolor: 'white',
                        minorgridcolor: 'white',
                        startlinecolor: '#2a3f5f',
                    },
                    baxis: {
                        endlinecolor: '#2a3f5f',
                        gridcolor: 'white',
                        linecolor: 'white',
                        minorgridcolor: 'white',
                        startlinecolor: '#2a3f5f',
                    },
                    type: 'carpet',
                },
            ],
            choropleth: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    type: 'choropleth',
                },
            ],
            contour: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    colorscale: [
                        [0.0, '#0d0887'],
                        [0.1111111111111111, '#46039f'],
                        [0.2222222222222222, '#7201a8'],
                        [0.3333333333333333, '#9c179e'],
                        [0.4444444444444444, '#bd3786'],
                        [0.5555555555555556, '#d8576b'],
                        [0.6666666666666666, '#ed7953'],
                        [0.7777777777777778, '#fb9f3a'],
                        [0.8888888888888888, '#fdca26'],
                        [1.0, '#f0f921'],
                    ],
                    type: 'contour',
                },
            ],
            contourcarpet: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    type: 'contourcarpet',
                },
            ],
            heatmap: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    colorscale: [
                        [0.0, '#0d0887'],
                        [0.1111111111111111, '#46039f'],
                        [0.2222222222222222, '#7201a8'],
                        [0.3333333333333333, '#9c179e'],
                        [0.4444444444444444, '#bd3786'],
                        [0.5555555555555556, '#d8576b'],
                        [0.6666666666666666, '#ed7953'],
                        [0.7777777777777778, '#fb9f3a'],
                        [0.8888888888888888, '#fdca26'],
                        [1.0, '#f0f921'],
                    ],
                    type: 'heatmap',
                },
            ],
            heatmapgl: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    colorscale: [
                        [0.0, '#0d0887'],
                        [0.1111111111111111, '#46039f'],
                        [0.2222222222222222, '#7201a8'],
                        [0.3333333333333333, '#9c179e'],
                        [0.4444444444444444, '#bd3786'],
                        [0.5555555555555556, '#d8576b'],
                        [0.6666666666666666, '#ed7953'],
                        [0.7777777777777778, '#fb9f3a'],
                        [0.8888888888888888, '#fdca26'],
                        [1.0, '#f0f921'],
                    ],
                    type: 'heatmapgl',
                },
            ],
            histogram: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'histogram',
                },
            ],
            histogram2d: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    colorscale: [
                        [0.0, '#0d0887'],
                        [0.1111111111111111, '#46039f'],
                        [0.2222222222222222, '#7201a8'],
                        [0.3333333333333333, '#9c179e'],
                        [0.4444444444444444, '#bd3786'],
                        [0.5555555555555556, '#d8576b'],
                        [0.6666666666666666, '#ed7953'],
                        [0.7777777777777778, '#fb9f3a'],
                        [0.8888888888888888, '#fdca26'],
                        [1.0, '#f0f921'],
                    ],
                    type: 'histogram2d',
                },
            ],
            histogram2dcontour: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    colorscale: [
                        [0.0, '#0d0887'],
                        [0.1111111111111111, '#46039f'],
                        [0.2222222222222222, '#7201a8'],
                        [0.3333333333333333, '#9c179e'],
                        [0.4444444444444444, '#bd3786'],
                        [0.5555555555555556, '#d8576b'],
                        [0.6666666666666666, '#ed7953'],
                        [0.7777777777777778, '#fb9f3a'],
                        [0.8888888888888888, '#fdca26'],
                        [1.0, '#f0f921'],
                    ],
                    type: 'histogram2dcontour',
                },
            ],
            mesh3d: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    type: 'mesh3d',
                },
            ],
            parcoords: [
                {
                    line: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'parcoords',
                },
            ],
            pie: [
                {
                    automargin: true,
                    type: 'pie',
                },
            ],
            scatter: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scatter',
                },
            ],
            scatter3d: [
                {
                    line: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scatter3d',
                },
            ],
            scattercarpet: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scattercarpet',
                },
            ],
            scattergeo: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scattergeo',
                },
            ],
            scattergl: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scattergl',
                },
            ],
            scattermapbox: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scattermapbox',
                },
            ],
            scatterpolar: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scatterpolar',
                },
            ],
            scatterpolargl: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scatterpolargl',
                },
            ],
            scatterternary: [
                {
                    marker: {
                        colorbar: {
                            outlinewidth: 0,
                            ticks: '',
                        },
                    },
                    type: 'scatterternary',
                },
            ],
            surface: [
                {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                    colorscale: [
                        [0.0, '#0d0887'],
                        [0.1111111111111111, '#46039f'],
                        [0.2222222222222222, '#7201a8'],
                        [0.3333333333333333, '#9c179e'],
                        [0.4444444444444444, '#bd3786'],
                        [0.5555555555555556, '#d8576b'],
                        [0.6666666666666666, '#ed7953'],
                        [0.7777777777777778, '#fb9f3a'],
                        [0.8888888888888888, '#fdca26'],
                        [1.0, '#f0f921'],
                    ],
                    type: 'surface',
                },
            ],
            table: [
                {
                    cells: {
                        fill: {
                            color: '#EBF0F8',
                        },
                        line: {
                            color: 'white',
                        },
                    },
                    header: {
                        fill: {
                            color: '#C8D4E3',
                        },
                        line: {
                            color: 'white',
                        },
                    },
                    type: 'table',
                },
            ],
        },
        layout: {
            annotationdefaults: {
                arrowcolor: '#2a3f5f',
                arrowhead: 0,
                arrowwidth: 1,
            },
            coloraxis: {
                colorbar: {
                    outlinewidth: 6,
                    ticks: '',
                },
            },
            colorscale: {
                diverging: [
                    [0, '#8e0152'],
                    [0.1, '#c51b7d'],
                    [0.2, '#de77ae'],
                    [0.3, '#f1b6da'],
                    [0.4, '#fde0ef'],
                    [0.5, '#f7f7f7'],
                    [0.6, '#e6f5d0'],
                    [0.7, '#b8e186'],
                    [0.8, '#7fbc41'],
                    [0.9, '#4d9221'],
                    [1, '#276419'],
                ],
                sequential: [
                    [0.0, '#0d0887'],
                    [0.1111111111111111, '#46039f'],
                    [0.2222222222222222, '#7201a8'],
                    [0.3333333333333333, '#9c179e'],
                    [0.4444444444444444, '#bd3786'],
                    [0.5555555555555556, '#d8576b'],
                    [0.6666666666666666, '#ed7953'],
                    [0.7777777777777778, '#fb9f3a'],
                    [0.8888888888888888, '#fdca26'],
                    [1.0, '#f0f921'],
                ],
                sequentialminus: [
                    [0.0, '#0d0887'],
                    [0.1111111111111111, '#46039f'],
                    [0.2222222222222222, '#7201a8'],
                    [0.3333333333333333, '#9c179e'],
                    [0.4444444444444444, '#bd3786'],
                    [0.5555555555555556, '#d8576b'],
                    [0.6666666666666666, '#ed7953'],
                    [0.7777777777777778, '#fb9f3a'],
                    [0.8888888888888888, '#fdca26'],
                    [1.0, '#f0f921'],
                ],
            },
            colorway: [
                '#636efa',
                '#EF553B',
                '#00cc96',
                '#ab63fa',
                '#FFA15A',
                '#19d3f3',
                '#FF6692',
                '#B6E880',
                '#FF97FF',
                '#FECB52',
            ],
            font: {
                color: 'white',
            },
            geo: {
                bgcolor: 'white',
                lakecolor: 'white',
                landcolor: '#E5ECF6',
                showlakes: true,
                showland: true,
                subunitcolor: 'white',
            },
            hoverlabel: {
                align: 'left',
            },
            hovermode: 'closest',
            mapbox: {
                style: 'light',
            },
            polar: {
                angularaxis: {
                    gridcolor: 'white',
                    linecolor: 'white',
                    ticks: '',
                },
                bgcolor: '#E5ECF6',
                radialaxis: {
                    gridcolor: 'white',
                    linecolor: 'white',
                    ticks: '',
                },
            },
            scene: {
                xaxis: {
                    backgroundcolor: '#E5ECF6',
                    gridcolor: 'white',
                    gridwidth: 2,
                    linecolor: 'white',
                    showbackground: true,
                    ticks: '',
                    zerolinecolor: 'white',
                },
                yaxis: {
                    backgroundcolor: '#E5ECF6',
                    gridcolor: 'white',
                    gridwidth: 2,
                    linecolor: 'white',
                    showbackground: true,
                    ticks: '',
                    zerolinecolor: 'white',
                },
                zaxis: {
                    backgroundcolor: '#E5ECF6',
                    gridcolor: 'white',
                    gridwidth: 2,
                    linecolor: 'white',
                    showbackground: true,
                    ticks: '',
                    zerolinecolor: 'white',
                },
            },
            shapedefaults: {
                line: {
                    color: '#2a3f5f',
                },
            },
            ternary: {
                aaxis: {
                    gridcolor: 'white',
                    linecolor: 'white',
                    ticks: '',
                },
                baxis: {
                    gridcolor: 'white',
                    linecolor: 'white',
                    ticks: '',
                },
                bgcolor: '#E5ECF6',
                caxis: {
                    gridcolor: 'white',
                    linecolor: 'white',
                    ticks: '',
                },
            },
            title: {
                x: 0.05,
            },
            xaxis2: {
                automargin: true,
                gridcolor: 'white',
                ticks: '',
                title: {
                    standoff: 15,
                },
                zerolinecolor: 'white',
                zerolinewidth: 2,
                anchor: 'y2',
            },
            yaxis2: {
                title: {
                    standoff: 15,
                },
                domain: [0, 0.75],
                automargin: true,
                gridcolor: '#272727',
                ticks: '',
                zerolinecolor: 'white',
                zerolinewidth: 2,
                anchor: 'x2',
                zeroline: false,
            },
            xaxis: {
                anchor: 'y',
                zeroline: false,
            },
            yaxis: {
                domain: [0.8, 1],
                anchor: 'x',
                zeroline: false,
            },
            shapes: [
                {
                    type: 'line',
                    xref: 'x',
                    yref: 'y',
                    x0: shapes[0],
                    y0: 0,
                    x1: shapes[shapes.length - 1],
                    y1: 0,
                    line: {
                        color: 'green',
                        width: 2,
                        dash: 'dot',
                    },
                    name: 'zeroline',
                },
            ],
        },
    },
    title: plotName,
    autosize: true,
    margin: {
        l: 60,
        r: 30,
        // b: 35,
        t: 30,
        pad: 5,
    },
    plot_bgcolor: '#222222',
    paper_bgcolor: '#222222',
});

const generateTickAsDatetime = (tickText) => {
    if (!isNaN(Number(tickText[0])) || !moment(tickText[0]).isValid()) {
        return tickText;
    }
    const format = getDateTimeFormat(
        tickText[0],
        tickText[tickText.length - 1],
        tickText.length,
    );
    return tickText.map((tick) => moment(tick).format(format));
};

const rlpByLineTemplate = (
    title,
    groupName,
    xaxisValue,
    yaxisValue,
    compareType,
    showXAxis = false,
    props,
    tickFmt = '',
) => {
    // re-scale groups in x-axes
    let textTicks = groupName;
    let valTicks = xaxisValue;
    // save categories to show/hide by button
    rlpXAxis[compareType].push(valTicks);

    const layout = {
        font: { color: 'white' },
        yaxis: {
            domain: [0, 0.65],
            type: 'linear',
            // dtick: 5,
            range: yaxisValue,
            fixedrange: true, // not allow yaxis to scroll
            autorange: false,
            // title: title,
            ticklen: 4,
            showgrid: true,
            gridcolor: '#444444',
            zeroline: true,
            nticks: 5,
            showline: true, // show lines and border here
            linecolor: '#757575',
            mirror: true,
            tickformat: tickFmt.includes('e') ? '.1e' : '',
        },
        yaxis2: {
            domain: [0.7, 1],
            fixedrange: true,
            ticklen: 3,
            showgrid: true,
            gridcolor: '#444444',
            zeroline: true,
            zerolinecolor: 'green',
            nticks: 3,
            showline: true, // show lines and border here
            linecolor: '#757575',
            linewidth: 1,
            mirror: true,
            tickformat: tickFmt.includes('e') ? '.1e' : '',
            exponentformat: 'e', // set to show exponent value
        },
        xaxis: {
            type: 'linear',
            range: [0.05, 1.2],
            autorange: false,
            ticklen: 4,
            showgrid: true,
            ticktext: textTicks,
            tickvals: showXAxis ? valTicks : [],
            // tickangle: -15,
            zeroline: true,
            gridcolor: '#444444',
            gridwidth: 1,
            tickmode: 'array',
            nticks: 20,
            tickfont: {
                size: 9,
            },
            showline: true, // show lines and border here
            linecolor: '#757575',
            linewidth: 1,
            mirror: true,
        },
        xaxis2: {
            anchor: 'y2',
            range: [0.05, 1.2],
            autorange: false,
            ticklen: 4,
            showgrid: true,
            ticktext: textTicks,
            tickvals: valTicks,
            zeroline: true,
            gridcolor: '#444444',
            gridwidth: 1,
            tickmode: 'array',
            nticks: 20,
            tickfont: {
                size: 9,
            },
            showticklabels: false, // hide xaxis tick labels for emd
            showline: true, // show lines and border here
            linecolor: '#757575',
            linewidth: 1,
            mirror: true,
        },
        autosize: true,
        margin: {
            l: 64,
            r: 10,
            b: showXAxis ? 23 : 15,
            t: 10,
            pad: 5,
        },
        hovermode: 'closest',
        showlegend: false, // TODO: return true to see RLP s90b4
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
    };
    return {
        template: {
            layout,
        },
    };
};

const rlpSingleLine = (yValue, xValue, lineColor, lineName, ntotal) => ({
    line: {
        color: lineColor,
        shape: 'spline',
        width: 1,
    },
    mode: 'lines',
    type: 'scatter',
    y: yValue,
    x: xValue,
    width: 10,
    text: lineName,
    name: '',
    hoverinfo: 'none',
    customdata: {
        isridgline: true,
        count: ntotal,
    },
    // hovertemplate: '%{text:}',
});
