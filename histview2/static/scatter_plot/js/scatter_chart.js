// eslint-disable-next-line no-unused-vars
const i18nColorBar = {
    time_numberings: '#i18nColorBarTime',
    elapsed_time: '#i18nColorBarElapsedTime',
};

// if a color range with unique value less than 20, show colorbar as category
const COLOR_RANGE_LIMIT = 20;

// unique filters
const onlyUniqueFilter = (value, index, self) => self.indexOf(value) === index;

const getNValueInArray = (array, n) => {
    if (n > array.length) return array;
    const nextIndex = array.length / n < 2 ? 2 : Math.floor(array.length / n);
    const res = [];
    let i = 0;
    while (i < array.length) {
        res.push(array[i]);
        i += nextIndex;
    }

    return res;
};

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

// eslint-disable-next-line no-unused-vars
const genScatterLayout = (chartOptions) => {
    const [tickVals, tickText] = buildCategoryColors(chartOptions.colorsValSets);
    let colorbarTitle = chartOptions.colorVarName;
    if (chartOptions.colorOrderVar !== 'colors') {
        colorbarTitle = $(i18nColorBar[chartOptions.colorOrderVar]).text();
    }
    const layout = {
        coloraxis: {
            colorbar: {
                title: {
                    text: colorbarTitle,
                },
                len: 0.5,
                ticks: 'outside',
                ticklabeloverflow: 'allow',
                // tickmode: 'array',
                // dtick: 1000,
            },
            colorscale: chartOptions.colorScaleSets,
            // showscale: true,
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
                },
                yaxis: {
                    automargin: true,
                    gridcolor: '#303030',
                    // linecolor: '#303030',
                    ticks: '',
                    title: {
                        standoff: 15,
                    },
                    zerolinecolor: '#303030',
                    zerolinewidth: 2,
                    showline: true, // show line in subplots
                    linewidth: 2, // show line in subplots
                    linecolor: 'rgba(96,96,96,0.2)', // show line in subplots
                    mirror: true, // draw line in both top and bottom of subplots
                    ticklen: 0, // remove redundant lines from axis
                },
            },
        },
        paper_bgcolor: '#222222',
        plot_bgcolor: '#222222',
        annotations: [
            {
                font: {},
                showarrow: false,
                text: chartOptions.xAxisLabel,
                xanchor: 'center',
                xref: 'paper',
                y: -0.06,
                yanchor: 'bottom',
                yref: 'paper',
            },
            {
                font: {},
                showarrow: false,
                text: chartOptions.yAxisLabel,
                yanchor: 'center',
                xanchor: 'bottom',
                yref: 'paper',
                x: -0.06,
                xref: 'paper',
                textangle: -90,
            },
        ],
        hovermode: 'closest',
        // hoverlabel: {
        //     bgcolor: '#222222',
        // },
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
    const rowSteps = (1 / rows);
    const colSteps = (1 / cols);
    return [rowSteps, colSteps];
};

const calcTicksDomain = (idx, ticksStep, isCol = 0) => {
    // 0.035 is space between charts
    const start = idx * ticksStep[isCol];
    const margin = isCol ? 0.015 : 0.025;
    const end = start + ticksStep[isCol] - margin;
    return [start, end];
};

// eslint-disable-next-line no-unused-vars
const genLayoutAxis = (layoutAttrs, isNotEmptyPlot) => {
    const itemIdx = layoutAttrs.rowIdx * layoutAttrs.colsTotal + layoutAttrs.colIdx;
    const itemId = itemIdx !== 0 ? (itemIdx + 1) : '';

    const yAxisName = `yaxis${itemId}`;
    const xAxisName = `xaxis${itemId}`;
    const yAxisId = `y${itemId}`;
    const xAxisId = `x${itemId}`;
    const ticksStep = calcTickSteps(layoutAttrs.rowsTotal, layoutAttrs.colsTotal);
    const yDomain = calcTicksDomain(layoutAttrs.rowIdx, ticksStep);
    const xDomain = calcTicksDomain(layoutAttrs.colIdx, ticksStep, 1);

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
        matches: 'x',
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
        matches: 'y',
        // scaleanchor: xAxisId,
        // scaleratio: layoutAttrs.scaleRatio,
    };
    // annotation for top axis labels
    if (layoutAttrs.hLabel) {
        const centerOfXTicks = xDomain[0] + ((xDomain[1] - xDomain[0]) / 2);
        // show title on top of plot with 2.5% margin
        const labelYPosition = yDomain[1] + 0.025;
        layoutAttrs.layout.annotations.push({
            font: {},
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
