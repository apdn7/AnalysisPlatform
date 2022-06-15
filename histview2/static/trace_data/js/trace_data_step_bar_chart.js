const StepBarChart = ($, paramObj) => {
    const canvasId = setParam('canvasId', 'hist01');
    const title = setParam('title', '');
    const plotData = setParam('plotData', []);
    const beforeRankValues = setParam('beforeRankValues', null);
    const categoryDistributed = setParam('categoryDistributed', null);
    const kdeData = setParam('kdeData', []);
    const threshLow = setParam('threshLow', '');
    const threshHigh = setParam('threshHigh', '');
    const prcMin = setParam('prcMin', '');
    const prcMax = setParam('prcMax', '');
    const [yMin, yMax] = findMinMax(plotData);
    const valMin = setParam('minY', yMin);
    const valMax = setParam('maxY', yMax);
    const xAxisOption = setParam('xAxisOption', 'TIME');
    const isCatLimited = setParam('isCatLimited', false);

    let tickConfig = {
        pad: 11,
        rotation: 20,
    };
    if (xAxisOption === 'INDEX') {
        tickConfig = {
            pad: 11,
            rotation: 0,
        };
    }


    // ////////////// プライベート関数の定義 ////////////////////
    function setParam(key, defaultValue) {
        if (key in paramObj && !isEmpty(paramObj[key])) {
            return paramObj[key];
        }
        return defaultValue;
    }

    // ////////////////////////////////////////////
    const ctx = $(`#${canvasId}`).get(0).getContext('2d');
    const labels = kdeData.hist_labels.reverse();
    const counts = kdeData.hist_counts.reverse();
    const categoryLabels = [];
    if (beforeRankValues) {
        Object.keys(beforeRankValues).forEach((v, k) => {
            categoryLabels.push(beforeRankValues[v]);
        });
    }

    categoryLabels.reverse();

    // get origin step bar chart data
    const stepChartDat = categoryLabels.map(label => categoryDistributed[label].pctg);

    const shortCatLabels = categoryLabels.map(label => categoryDistributed[label].short_name);
    const data = {
        labels: isCatLimited ? [] : shortCatLabels,
        datasets: [
            {
                label: 'Histogram',
                data: isCatLimited ? [] : stepChartDat,
                backgroundColor: '#75955d',
                order: 1,
                minBarLength: 2,
                categoryPercentage: 0.5,
                barPercentage: 0.5,
            },
        ],
    };

    const config = {
        type: 'bar',
        data,
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            spanGaps: true,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: false,
                },
                annotation: {
                    annotations: {},
                },
                tooltip: {
                    callbacks: {
                        label: function changeValue() {
                            return '';
                        },
                        title(tooltipItems) {
                            const tooltipData = tooltipItems[0];
                            const labelIndex = tooltipData.dataIndex;
                            const currentPlotDat = graphStore.getArrayPlotData(tooltipData.chart.canvas.id);
                            return buildStepChartHovering(labelIndex, currentPlotDat);
                        },
                    },
                    yAlign: 'top',
                    titleAlign: 'center',
                    bodyAlign: 'center',
                },
                chartAreaBorder: {
                    borderColor: CONST.COLOR_FRAME_BORDER,
                    borderWidth: 2,
                    borderDash: false,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                    },
                    ticks: {
                        minRotation: 0,
                        maxRotation: 0,
                        color: CONST.TICK,
                        callback(value, index, values) {
                            // if (index === (values.length-1)) {
                            //     return undefined;
                            // }
                            return `${value}%`; // convert it to percentage
                        },
                        autoSkip: true,
                        maxTicksLimit: 8,
                        align: 'end',
                        font: {
                            family: 'Calibri Light', size: 12,
                        },
                    },
                    grid: {
                        color: CONST.GRID,
                        drawTicks: false,
                    },
                    min: 0,
                    max: 100,
                    // afterTickToLabelConversion: function adjust(context) {
                    //     const { ticks } = context;
                    //     context.ticks[0].label = '';
                    //     if (ticks.length) context.ticks[ticks.length - 1].label = '';
                    //     for (const idx in context.ticks) {
                    //         context.ticks[idx].label = (context.ticks[idx].label || '').padStart(8, ' ');
                    //     }
                    // },
                },
                y: {
                    display: false,
                    position: 'left',
                    grid: {
                        color: CONST.GRID,
                    },
                    afterFit(scaleInstance) {
                        scaleInstance.width = 20;
                    },
                },
            },
            events: ['click', 'mousemove'],
            onClick(event) {
                removeAllCrossHair();
            },
            layout: {
                padding: {
                    bottom: -22,
                    top: 5,
                },
            },
        },
        plugins: [chartAreaBorder],
    };

    if (!isEmpty(threshHigh)) {
        config.options.plugins.annotation.annotations.ucl = createHistHorizonalThreshold(threshHigh, CONST.RED, CONST.UCL);
    }
    if (!isEmpty(threshLow)) {
        config.options.plugins.annotation.annotations.lcl = createHistHorizonalThreshold(threshLow, CONST.RED, CONST.LCL);
    }
    if (!isEmpty(prcMin)) {
        config.options.plugins.annotation.annotations.lpcl = createHistHorizonalThreshold(prcMin, CONST.BLUE, CONST.LPCL);
    }
    if (!isEmpty(prcMax)) {
        config.options.plugins.annotation.annotations.upcl = createHistHorizonalThreshold(prcMax, CONST.BLUE, CONST.UPCL);
    }

    // $(`#${canvasId}`).css('margin-top', '-5px');
    const chart = new Chart(ctx, config);

    const histObj = {
        histLabels: labels,
        histCounts: counts,
        title,
        threshHigh,
        threshLow,
        prcMin,
        prcMax,
        minY: valMin,
        maxY: valMax,
    };

    return {
        histObj,
        chartObject: chart,
    };
};

const buildStepChartHovering = (categoryIndex, plotDat) => {
    let categoryInfor = '';
    if (plotDat.category_distributed) {
        const beforeRankVals = [...plotDat.before_rank_values[0]];
        // because current we draw items from bot -> top,
        // so need to reversed to find cate name from rank value
        const rankedValueSorted = beforeRankVals.sort().reverse();
        const itemID = rankedValueSorted[categoryIndex];
        const rankedID = plotDat.before_rank_values[0].lastIndexOf(itemID);
        const categoryName = plotDat.before_rank_values[1][rankedID];
        const cateLabel = plotDat.category_distributed[categoryName].counts || '';
        if (cateLabel) {
            categoryInfor = `${categoryName}\n\r${cateLabel}`;
        }
    }
    return categoryInfor;
};
