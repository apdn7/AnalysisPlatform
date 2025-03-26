const i18nColorBar = {
    time_numberings: '#i18nColorBarTime',
    elapsed_time: '#i18nColorBarElapsedTime',
};

// if a color range with unique value less than 20, show colorbar as category
const COLOR_RANGE_LIMIT = 20;
const X_NORMAL = 0.015;
const Y_NORMAL = 0.025;
const SCATTER_MARGIN = {
    X_NORMAL: X_NORMAL,
    Y_NORMAL: Y_NORMAL,
    H_TITLE_MULTI_LINES: 0.05,
};

// unique filters
const onlyUniqueFilter = (value, index, self) => self.indexOf(value) === index;

const buildCategoryColors = (colorData) => {
    const uniqueColorData = colorData.filter(onlyUniqueFilter);
    const isString = _.isString(uniqueColorData[0]);

    if (isString) {
        // const tempVals = uniqueColorData.map((val, i) => i / uniqueColorData.length);
        // const tickvals = getNValueInArray(tempVals, 5);
        // const ticktext = getNValueInArray(uniqueColorData, 5);
        const tickVals = uniqueColorData.map((val, i) => i);
        const ticktext = uniqueColorData.map((val, i) => val);
        return [tickVals, ticktext];
    }
    return [null, null];
};

const narrowText = (text = '', n = 17) => {
    if (!text || text.length <= n) return text;

    return text.substr(0, n);
};

const genScatterLayout = (chartOptions) => {
    // add default len for colorBar and resize colorBar
    let colorBarLength = 0.5;
    let colorBarHeight = chartOptions.totalHeight * colorBarLength;

    if (colorBarHeight >= 450) {
        colorBarHeight = 450;
        colorBarLength = colorBarHeight / chartOptions.totalHeight;
    }

    const [tickVals, tickText] = buildCategoryColors(chartOptions.colorsValSets);
    let colorbarTitle = narrowText(chartOptions.colorVarName);
    if (chartOptions.colorOrderVar !== 'colors') {
        colorbarTitle = $(i18nColorBar[chartOptions.colorOrderVar]).text();
    }
    const layout = {
        coloraxis: {
            colorbar: {
                title: {
                    text: colorbarTitle,
                },
                len: colorBarLength,
                ticks: 'outside',
                ticklabeloverflow: 'allow',
                // tickmode: 'array',
                // dtick: 1000,
            },
            colorscale: chartOptions.colorScaleSets,
            showscale: !!colorbarTitle,
        },
        legend: {
            itemsizing: 'constant',
            tracegroupgap: 0,
        },
        margin: {
            t: 30,
            l: 100,
        },
        template: {
            data: {
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
            },
            layout: {
                annotationdefaults: {
                    arrowcolor: '#2a3f5f',
                    arrowhead: 0,
                    arrowwidth: 1,
                },
                coloraxis: {
                    colorbar: {
                        outlinewidth: 0,
                        ticks: '',
                    },
                },
                font: {
                    color: 'white',
                },
                hoverlabel: {
                    align: 'left',
                },
                hovermode: 'closest',
                mapbox: {
                    style: 'light',
                },
                paper_bgcolor: 'white',
                plot_bgcolor: '#E5ECF6',
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
                xaxis: {
                    automargin: true,
                    gridcolor: '#303030',
                    // linecolor: '#303030',
                    ticks: '',
                    title: {
                        standoff: 15,
                    },
                    zerolinecolor: '#303030',
                    zerolinewidth: 2,
                    showline: true,
                    linewidth: 2,
                    linecolor: 'rgba(96,96,96,0.2)',
                    mirror: true,
                    ticklen: 0,
                    tickformat: chartOptions.xFmt.includes('e') ? '.1e' : '',
                },
                yaxis: {
                    automargin: true,
                    gridcolor: '#303030',
                    // linecolor: '#303030',
                    ticks: '',
                    title: {
                        standoff: 15,
                    },
                    tickfont: {
                        size: chartOptions.yFmt.includes('e') ? 8 : 10,
                    },
                    zerolinecolor: '#303030',
                    zerolinewidth: 2,
                    showline: true, // show line in subplots
                    linewidth: 2, // show line in subplots
                    linecolor: 'rgba(96,96,96,0.2)', // show line in subplots
                    mirror: true, // draw line in both top and bottom of subplots
                    ticklen: 0, // remove redundant lines from axis
                    tickformat: chartOptions.yFmt.includes('e') ? '.1e' : '',
                },
            },
        },
        paper_bgcolor: '#222222',
        plot_bgcolor: '#222222',
        annotations: [
            {
                font: {},
                showarrow: false,
                text: '',
                xanchor: 'center',
                xref: 'paper',
                y: -0.1,
                yanchor: 'bottom',
                yref: 'paper',
            },
            {
                font: {},
                showarrow: false,
                text: '',
                yanchor: 'center',
                xanchor: 'bottom',
                yref: 'paper',
                x: -0.115,
                xref: 'paper',
                textangle: -90,
            },
        ],
        hovermode: 'closest',
        shapes: [],
    };
    if (tickVals) {
        layout.coloraxis.colorbar.tickvals = tickVals;
    }
    if (tickText) {
        layout.coloraxis.colorbar.ticktext = tickText;
    }
    return layout;
};
// todo: draw annotation for thresholds

const calcTickSteps = (rows, cols) => {
    const rowSteps = 1 / rows;
    const colSteps = 1 / cols;
    return [rowSteps, colSteps];
};

const calcTicksDomain = (idx, ticksStep, isCol = 0, defaultMargin = 0.015, totalColRow) => {
    // 0.035 is space between charts
    const margin = totalColRow > 1 ? defaultMargin : 0;
    const start = idx * ticksStep[isCol];
    const end = start + ticksStep[isCol] - margin;
    return [start, end];
};

const genLayoutAxis = (layoutAttrs, isNotEmptyPlot) => {
    const itemIdx = layoutAttrs.rowIdx * layoutAttrs.colsTotal + layoutAttrs.colIdx;
    const itemId = itemIdx !== 0 ? itemIdx + 1 : '';

    const yAxisName = `yaxis${itemId}`;
    const xAxisName = `xaxis${itemId}`;
    const yAxisId = `y${itemId}`;
    const xAxisId = `x${itemId}`;
    const ticksStep = calcTickSteps(layoutAttrs.rowsTotal, layoutAttrs.colsTotal);
    const isBreakLine = layoutAttrs.hLabel.includes('<br>');
    // const verticalMargin = (layoutAttrs.hLabel && isBreakLine && layoutAttrs.colsTotal > 1)
    //     ? SCATTER_MARGIN.H_TITLE_MULTI_LINES : SCATTER_MARGIN.Y_NORMAL;
    const yDomain = calcTicksDomain(layoutAttrs.rowIdx, ticksStep, 0, SCATTER_MARGIN.Y_NORMAL, layoutAttrs.rowsTotal);
    const xDomain = calcTicksDomain(layoutAttrs.colIdx, ticksStep, 1, SCATTER_MARGIN.X_NORMAL, layoutAttrs.colsTotal);

    const isShowXTicks = layoutAttrs.rowIdx === 0;
    const isShowYTicks = layoutAttrs.colIdx === 0;
    // const isShowXLabel = layoutAttrs.rowIdx === (layoutAttrs.rowsTotal - 1);
    // assign layout axis
    layoutAttrs.layout[xAxisName] = {
        anchor: yAxisId,
        domain: xDomain,
        // showticklabels: true,
        showticklabels: isShowXTicks,
        title: {
            text: '',
        },
        ticks: 'outside',
        // matches: 'x',
    };
    layoutAttrs.layout[yAxisName] = {
        anchor: xAxisId,
        domain: yDomain,
        // showticklabels: true,
        showticklabels: isShowYTicks,
        title: {
            text: '',
        },
        ticks: 'outside',
        // matches: 'y',
        // scaleanchor: xAxisId,
        // scaleratio: layoutAttrs.scaleRatio,
    };
    // annotation for top axis labels
    if (layoutAttrs.hLabel) {
        const centerOfXTicks = xDomain[0] + (xDomain[1] - xDomain[0]) / 2;
        // show title on top of plot with 2.5% margin
        const labelYPosition = yDomain[1] + SCATTER_MARGIN.Y_NORMAL;
        layoutAttrs.layout.annotations.push({
            font: {
                size: isBreakLine ? 9 : 11,
            },
            showarrow: false,
            text: layoutAttrs.hLabel,
            x: centerOfXTicks,
            xanchor: 'center',
            xref: 'paper',
            y: labelYPosition,
            yanchor: 'top',
            yref: 'paper',
        });
    }
    if (layoutAttrs.xScale) {
        layoutAttrs.layout[xAxisName].range = layoutAttrs.xScale;
    }
    if (layoutAttrs.yScale) {
        layoutAttrs.layout[yAxisName].range = layoutAttrs.yScale;
    }
    return {
        xaxis: xAxisId,
        yaxis: yAxisId,
    };
};

const removeInvalidDataPoints = (scpMatrix, xRange, yRange, colorVar = 'colors') => {
    scpMatrix.forEach((row) => {
        row.forEach((col) => {
            if (col) {
                const pointObjs = [];
                col.array_x.forEach((v, i) => {
                    if (
                        v >= xRange[0] &&
                        v <= xRange[1] &&
                        col.array_y[i] >= yRange[0] &&
                        col.array_y[i] <= yRange[1]
                    ) {
                        pointObjs.push({
                            x: v,
                            y: col.array_y[i],
                            colors: col.colors[i],
                            cycle_ids: col.cycle_ids[i],
                            elapsed_time: col.elapsed_time[i],
                            times: col.times[i],
                            x_serial: col.x_serial ? col.x_serial.map((xSerial) => xSerial.data[i]) : null,
                            y_serial: col.y_serial ? col.y_serial.map((ySerial) => ySerial.data[i]) : null,
                            time_numberings: col.time_numberings ? col.time_numberings[i] : null,
                        });
                    }
                });
                const comparator = (keys) => (a, b) => {
                    if (a[keys[0]] == b[keys[0]]) {
                        return a[keys[1]] - b[keys[1]];
                    }
                    return a[keys[0]] > b[keys[0]] ? 1 : -1;
                };
                pointObjs.sort(comparator([colorVar, 'cycle_ids']));
                // console.log();
                col.n_total = pointObjs.length;
                col.array_x = pointObjs.map((pointData) => pointData.x);
                col.array_y = pointObjs.map((pointData) => pointData.y);
                col.colors = pointObjs.map((pointData) => pointData.colors);
                col.cycle_ids = pointObjs.map((pointData) => pointData.cycle_ids);
                col.elapsed_time = pointObjs.map((pointData) => pointData.elapsed_time);
                col.times = pointObjs.map((pointData) => pointData.times);
                if (col.time_numberings) {
                    col.time_numberings = pointObjs.map((pointData) => pointData.time_numberings);
                }

                if (col.x_serial) {
                    col.x_serial.forEach((xSerial, i) => {
                        xSerial.data = pointObjs.map((pointData) => pointData.x_serial[i]);
                    });
                }
                if (col.y_serial) {
                    col.y_serial.forEach((ySerial, i) => {
                        ySerial.data = pointObjs.map((pointData) => pointData.y_serial[i]);
                    });
                }
            }
        });
    });
    return scpMatrix;
};
