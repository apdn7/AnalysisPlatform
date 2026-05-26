const COLOR_DEFAULT = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
];

const MAX_TICKS = 9;
const drawAgPPlot = (
    data,
    plotData,
    countByXAxis,
    div,
    isCyclicCalender,
    canvasId,
    yScale,
    xAxisOrder,
    yAxisDisplayMode,
    divFromTo,
    isCommonScale = false,
    chartViewHeightNumber,
) => {
    const { agg_function, color_name, color_column_type, unique_color, fmt, shown_name, judge_color } = plotData;

    const isLineChart = agg_function && agg_function.toLowerCase() !== 'count';
    const isXOrderByYValue = xAxisOrder == X_AXIS_OPTION.Y_AXIS_VALUE;
    const xOrder = isXOrderByYValue && !isLineChart ? 'total descending' : undefined;
    const showPercent =
        [AGP_YAXIS_DISPLAY_MODES.Y_AXIS_TOTAL, AGP_YAXIS_DISPLAY_MODES.Y_AXIS_FACET].includes(yAxisDisplayMode) &&
        !isLineChart;

    let xTitles = data[0] ? [...data[0].x] : [];
    const tickLen = xTitles.length ? xTitles[0].length : 0;
    const tickSize = tickLen > 5 ? 10 : 12;

    data = prepareColorForTrace(data, unique_color, color_column_type, judge_color);
    if (isLineChart && yScale) {
        data = getOutlierTraceData(data, yScale, plotData);
    }

    let yMin, yMax;
    if (isLineChart || (yScale && isCommonScale)) {
        const offset = (yScale['y-max'] - yScale['y-min']) * 0.018;
        yMin = yScale['y-min'] - offset;
        yMax = yScale['y-max'] + offset;
    }

    if (isXOrderByYValue && isLineChart) {
        data = sortDataByMaxDescending(data);
    }

    const maxTicks = isXOrderByYValue ? xTitles.length : MAX_TICKS;
    const bottomMargin = (chartViewHeightNumber / 4) * (window.innerHeight / 100);

    const layout = {
        barmode: 'stack',
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        autosize: true,
        xaxis: {
            tickmode: 'array',
            ticktext: reduceTicksArray(
                xTitles.map((val) => val.slice(1)),
                maxTicks,
            ),
            tickvals: reduceTicksArray(xTitles, maxTicks),
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: tickSize,
            },
            tickangle: isXOrderByYValue ? '-90' : null,
            spikemode: 'across',
            spikethickness: 1,
            spikedash: 'solid',
            spikecolor: 'rgb(255, 0, 0)',
            tickformat: 'c',
            domain: [0, 1],
            nticks: isXOrderByYValue ? xTitles.length : 8,
            categoryorder: xOrder,
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
            // tickformat: showPercent ? ',.0%' : fmt ? (fmt.includes('e') ? '.1e' : fmt) : '',
            tickformat: '',
            range: showPercent ? [0, 100] : yScale ? [yMin, yMax] : null,
            autorange: yScale ? false : true,
        },
        showlegend: true,
        legend: {
            title: {
                text: `${showPercent ? '%' : agg_function}<br><sub>${color_name || shown_name}</sub>`,
            },
            font: {
                family: 'sans-serif',
                size: 12,
                color: '#ffffff',
            },
            bgcolor: 'transparent',
            xanchor: 'right',
            x: 1.07,
            traceorder: 'normal',
            // itemsizing: "constant",
            // itemwidth: 200
        },
        margin: {
            b: isXOrderByYValue ? bottomMargin : 60,
            t: 20,
            r: 10,
        },
    };

    if (showPercent) {
        layout.yaxis.ticksuffix = '%';
        data.forEach((item) => {
            item.y = item.y.map((i) => i * 100);
        });
    }

    if (isLineChart) {
        layout.xaxis.range = [-0.5, div.length - 0.5];
        layout.legend.traceorder = 'reversed';
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
        const { x, y, name, type, isOutlier, colorName, outlierVal, colId } = data.points[0].data;
        const xVal = x[dpIndex].slice(1);
        const color = colorName || name;
        const hasColor = !!color_name;
        const nByXAndColor = y[dpIndex];
        let dataTable = '';
        const isShowFromTo = div.length === useDivFromTo.length - 1;
        const period = [];
        const fromTo = [];
        if (isCyclicCalender && isShowFromTo) {
            const index = div.indexOf(xVal);
            let from, to;
            if (index !== -1) {
                from = useDivFromTo[index];
                to = useDivFromTo[index + 1];
            }

            if (from && to) {
                period.push(['Period', `${from}${DATETIME_PICKER_SEPARATOR}${to}`]);
            }
        }

        if (divFromTo) {
            // show from, to of Data number division
            const divIndex = div.indexOf(xVal);
            if (divIndex !== -1) {
                const fromToOb = divFromTo[divIndex];
                fromTo.push(['From', formatDateTime(fromToOb[0])], ['To', formatDateTime(fromToOb[1])]);
            }
        }
        if (type.includes('lines') || isOutlier) {
            const showVal = [];
            if (isOutlier) {
                showVal.push([i18n.outlier, applySignificantDigit(outlierVal[dpIndex])]);
            } else {
                showVal.push([agg_function, applySignificantDigit(nByXAndColor)]);
            }
            dataTable = genHoverDataTable([['x', xVal], ...period, ['Color', color], ...showVal, ...fromTo]);
        } else {
            const nByX = showPercent ? '100%' : countByXAxis[colId][xVal];
            const NByColor = showPercent
                ? `${applySignificantDigit(nByXAndColor)}%`
                : applySignificantDigit(nByXAndColor);

            const NByColorHover = hasColor ? [['N by x and Color', NByColor]] : [];

            dataTable = genHoverDataTable([
                ['x', xVal],
                ...period,
                ['Color', color],
                ...NByColorHover,
                ['N by x', applySignificantDigit(nByX)],
                ...fromTo,
            ]);
        }
        genDataPointHoverTable(
            dataTable,
            {
                x: data.event.pageX - 220,
                y: data.event.pageY,
            },
            0,
            true,
            canvasId,
            1,
        );
    });

    /**
     * Set data-hover for each tick label and bind events
     */
    agPPlot.on('plotly_afterplot', () => {
        if (isXOrderByYValue) {
            const currentPlot = document.getElementById(canvasId);
            const renderedTickTextElements = document.querySelectorAll(`#${canvasId} .xtick text`);
            // calculated like tickSize
            const fontSize = renderedTickTextElements.length > 5 ? 10 : 12;
            const ellipsisPixelLen = visualTextLength('...', fontSize);
            const pixelLenLimit = (chartViewHeightNumber / 4) * (window.innerHeight / 100); // 25% of chart's height
            renderedTickTextElements.forEach((ele, i) => {
                ele.innerHTML = formatVerticalLabel(
                    ele.dataset.unformatted,
                    pixelLenLimit,
                    ellipsisPixelLen,
                    ele.getAttribute('x'),
                    ele.getAttribute('y'),
                    fontSize,
                );
            });
            $('g.xtick text')
                .off('mouseover')
                .on('mouseover', (e) => {
                    const fullTickLabel = $(e.currentTarget).attr('data-unformatted');
                    $('#fullTickLabel').text(fullTickLabel);
                    showTickLabelTooltip(e);
                })
                .off('mouseout')
                .on('mouseout', () => {
                    $('#fullTickLabel').text('');
                    $('#fullTickLabel').hide();
                })
                // must be enabled so that mouseover events work
                .css({
                    'pointer-events': 'auto',
                });
        }
    });

    unHoverHandler(agPPlot);
};

const reduceTicksArray = (array, maxTick = MAX_TICKS) => {
    const nTicks = maxTick;
    const isReduce = array.length > maxTick;
    if (!isReduce) return array;
    let nextIndex = array.length / nTicks < 2 ? 2 : Math.round(array.length / nTicks);
    if (nextIndex * nTicks > maxTick) {
        nextIndex += 1;
    }
    const res = [];
    let i = 0;
    while (i < array.length) {
        res.push(array[i]);
        i += nextIndex;
    }

    return res;
};

const prepareColorForTrace = (data, uniqueColor, colorColumnType, judgeColor) => {
    let styles = [];
    const getDefaultColor = (colorType, colorName, index) => {
        let color = COLOR_DEFAULT[index];
        // When variable data type is judge: Change color scale to OK:Blue, NG:Red in AgP
        if (colorType === masterDataGroup.JUDGE && judgeColor) {
            color = JUDGE_COLOR_DEFAULT[judgeColor[colorName]];
        }
        return color;
    };
    if (uniqueColor.length > 0) {
        styles = uniqueColor.map((color, k) => ({
            target: color,
            color: getDefaultColor(colorColumnType, color, k),
        }));
    } else {
        styles = data.map((data, k) => ({
            target: data.name,
            color: COLOR_DEFAULT[k],
        }));
    }

    return data.map((da) => {
        const colors = styles.filter((st) => st.target === da.name);
        const color = colors.length > 0 ? styles.filter((st) => st.target === da.name)[0].color : '';
        return {
            ...da,
            marker: {
                color: color,
            },
            line: {
                ...da.line,
                color: color,
            },
        };
    });
};

const getOutlierTraceData = (datas, yScale, plotData) => {
    const { lower_outlier_idxs, upper_outlier_idxs } = yScale;
    const { array_y } = plotData;

    const outlierTraceList = [];

    datas = datas.map((data) => {
        let isHasOutlier = false;
        const outlierTrace = {
            ...data,
            colorName: data.name,
            name: i18n.outlier,
            mode: 'markers',
            marker: {
                symbol: '4',
                size: 8,
            },
            isOutlier: true,
            showlegend: false,
        };
        let cloneY = Array.from(outlierTrace.y).fill(null);
        let outlierVal = Array.from(outlierTrace.y).fill(null);
        for (const i of lower_outlier_idxs) {
            const lowerOutlier = array_y[i];
            const indexList = getAllIndexes(data.y, lowerOutlier);
            for (const index of indexList) {
                isHasOutlier = true;
                cloneY[index] = yScale['y-min'];
                outlierVal[index] = data.y[index];
                data.y[index] = null;
            }
        }

        for (const i of upper_outlier_idxs) {
            const upperOutlier = array_y[i];
            const indexList = getAllIndexes(data.y, upperOutlier);
            for (const index of indexList) {
                isHasOutlier = true;
                cloneY[index] = yScale['y-max'];
                outlierVal[index] = data.y[index];
                data.y[index] = null;
            }
        }
        if (isHasOutlier) {
            outlierTrace.y = cloneY;
            outlierTrace.outlierVal = outlierVal;
            outlierTraceList.push(outlierTrace);
        }

        return data;
    });

    datas = outlierTraceList.concat(datas);

    return datas;
};

function getAllIndexes(arr, val) {
    let indexes = [],
        i = -1;
    while ((i = arr.indexOf(val, i + 1)) != -1) {
        indexes.push(i);
    }
    return indexes;
}

const sortDataByMaxDescending = (data) => {
    const categoryValues = {};
    data.forEach((trace) => {
        trace.x.forEach((category, index) => {
            if (!categoryValues[category]) {
                categoryValues[category] = [];
            }
            categoryValues[category].push(trace.y[index]);
        });
    });

    const maxValues = Object.values(categoryValues).map((values) => {
        return Math.max(...values);
    });

    return data.map((trace) => {
        // Create an array of indices
        const indices = Array.from({ length: trace.x.length }, (_, i) => i);
        indices.sort((a, b) => maxValues[b] - maxValues[a]);
        return {
            ...trace,
            x: indices.map((i) => trace.x[i]),
            y: indices.map((i) => trace.y[i]),
        };
    });
};

/**
 * Used to format AgP's vertical label text (might be used for other charts later)
 * If the text's length exceeds pixelLenLimit for the first time, format into two tspan elements to be used for plotly
 * For the second time, truncate with ellipsis
 * @param text input text
 * @param pixelLenLimit maximum length (width) allowed
 * @param parentX x attribute of parent element
 * @param parentY y attribute of parent element
 * @param dx dx attribute of parent element
 * @param dy dy attribute for second line of text (usually 1.3em of current fontsize)
 * @param textSize font size
 */
const formatVerticalLabel = (
    text,
    pixelLenLimit,
    ellipsisPixelLen,
    parentX,
    parentY,
    textSize = 12,
    dx = 0,
    dy = 1.3,
) => {
    let tmp = text;
    const textPixelLen = visualTextLength(tmp, textSize);
    if (textPixelLen > pixelLenLimit) {
        const pixelLimitSecondLine = pixelLenLimit - ellipsisPixelLen;
        let firstLine = '';
        let secondLine = '';
        const step = Math.round(text.length / (textPixelLen / pixelLenLimit));
        firstLine = tmp.substring(0, step);
        secondLine = tmp.substring(step);
        const secondLinePixelLen = visualTextLength(secondLine, textSize);
        if (secondLinePixelLen > pixelLenLimit) {
            const step = Math.floor(secondLine.length / (secondLinePixelLen / pixelLimitSecondLine));
            secondLine = secondLine.substring(0, step);
            secondLine += '...';
        }
        return `<tspan class="line" dx="${dx}em" dy="0em" x=${parentX} y=${parentY}>${firstLine}</tspan><tspan class="line" dx="${dx}em" dy="${dy}em" x=${parentX} y=${parentY}>${secondLine}</tspan>`;
    } else {
        return text;
    }
};
