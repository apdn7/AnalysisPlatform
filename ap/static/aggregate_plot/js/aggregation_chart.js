const drawAgPPlot = (data, aggFunc, countByXAxis, div, colorName, isCyclicCalender, canvasId, divArrays=[], fmt=null) => {
    let xTitles = data[0] ? [...data[0].x] : [];
    const tickLen = xTitles.length ? xTitles[0].length : 0;
    const tickSize =  tickLen > 5 ? 10 : 12;

    const layout = {
        barmode: 'stack',
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        autosize: true,
        xaxis: {
            tickmode: 'array',
            ticktext: reduceTicksArray(xTitles.map(val => val.slice(1)), tickLen),
            tickvals: reduceTicksArray(xTitles, tickLen),
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: tickSize,
            },
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
            tickformat: 'c',
            domain: [0, 1],
        },
        yaxis: {
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: 12,
            },
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
            tickformat: fmt ? (fmt.includes('e') ? '.1e' : fmt) : '',
        },
        showlegend: true,
        legend: {
            title: {
                text: `${aggFunc}<br><sub>${colorName}</sub>`,
            },
            font: {
                family: 'sans-serif',
                size: 12,
                color: '#ffffff'
            },
            bgcolor: 'transparent',
            xanchor: 'right',
            x: 1.07,
            // itemsizing: "constant",
            // itemwidth: 200
        },
        margin: {
            b: 60,
            t: 20,
            r: 10,
        }
    };

    const isLineChart = aggFunc && aggFunc.toLowerCase() !== 'count';

    if (isLineChart) {
        layout.xaxis.range = [-0.5, div.length - 0.5];
        layout.legend.traceorder = "reversed";
    }

    const heatmapIconSettings = genPlotlyIconSettings();
    const config = {
        ...heatmapIconSettings,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' },
    };
    Plotly.react(canvasId, data, layout, config);

    const agPPlot = document.getElementById(canvasId);

    agPPlot.on('plotly_hover', (data) => {
        const dpIndex = getDataPointIndex(data);
        const { x, y, name, type } = data.points[0].data;
        const xVal = x[dpIndex].slice(1);
        const color = name;
        const nByXAndColor = y[dpIndex];
        let dataTable = '';
        const isShowFromTo = div.length === divFromTo.length;
        const period = [];
        if (isCyclicCalender && isShowFromTo) {
            const index = divArrays.indexOf(xVal);
            let from, to;
            if (index !== -1) {
                from = divFromTo[index];
                if (index + 1 >= divFromTo.length) {
                    to = lastFrom;
                } else {
                    to = divFromTo[index + 1];
                }
            }

            if (from && to) {
                // period.push(['Period', `${from}${DATETIME_PICKER_SEPARATOR}${to}`])
            }
        }
        if (type.includes('lines')) {
            dataTable = genHoverDataTable([['x', xVal], ...period, ['Color', color], [aggFunc, applySignificantDigit(nByXAndColor)]]);
        } else {
            const nByX = countByXAxis[xVal];
            dataTable = genHoverDataTable([['x', xVal], ...period, ['Color', color], ['N by x and Color', applySignificantDigit(nByXAndColor)], ['N by x', applySignificantDigit(nByX)]]);
        }
        genDataPointHoverTable(
            dataTable,
            {
                x: data.event.pageX - 120, y: data.event.pageY,
            },
            0,
            true,
            canvasId,
            1
        );
    });
    unHoverHandler(agPPlot);
};

const reduceTicksArray = (array, tickLen) => {
    const nTicks = tickLen > 9 ? 20 : 30;
    const isReduce = (tickLen > 9 && array.length > 20) || array.length > 30;
    if (!isReduce) return array;
    const nextIndex = array.length / nTicks < 2 ? 2 : Math.floor(array.length / nTicks);
    const res = [];
    let i = 0;
    while (i < array.length) {
        res.push(array[i]);
        i += nextIndex;
    }

    return res;
};