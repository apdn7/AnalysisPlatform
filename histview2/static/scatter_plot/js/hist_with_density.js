/* eslint-disable prefer-destructuring */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
/* eslint-disable no-unused-vars */
function HistogramsWithDensity($, paramObj, chartObject = null, dtPoints = null) {
    // 内部変数の初期化
    const defaultChartID = '#histograms-1';
    const density = setParam('density', null);
    // const kdeData = setParam('kdeData', []);
    const histData = setParam('histData', []);
    const plotData = setParam('plotData', []);
    const numBins = setParam('numBins', 128);
    const valMin = setParam('minY', Math.min.apply(null, plotData));
    const valMax = setParam('maxY', Math.max.apply(null, plotData));
    const procThresholds = setParam('procThresholds', {});
    const uclThresholds = setParam('uclThresholds', {});
    const canvasId = setParam('canvasId', defaultChartID);
    let histObj = setParam('histObj', []);

    // ////////////// プライベート関数の定義 ////////////////////
    function setParam(key, defaultValue) {
        if (key in paramObj && !isEmpty(paramObj[key])) {
            return paramObj[key];
        }
        return defaultValue;
    }

    if (histObj.length === 0) {
        const labels = histData.hist_labels;
        const counts = histData.hist_counts;
        histObj = {
            histLabels: labels,
            histCounts: counts,
        };

        if (!counts || !labels) { histObj = genHistLabelsCounts(plotData, numBins, valMin, valMax); }
    }

    // /////////////////// Chart.js関係の関数 /////////////////////////
    const chartConfig = {
        type: 'bar',
        data: {},
        options: {
            // responsive: true,
            maintainAspectRatio: false,
            scales: {
                yAxes: [{
                    id: 'Histogram',
                    type: 'linear',
                    position: 'left',
                    ticks: {
                        fontColor: '#fff',
                        beginAtZero: true,
                        callback(value) { return value % 1 === 0 ? value : ''; },
                        maxTicksLimit: 5,
                        fontSize: 14,
                        fontFamily: 'Calibri Light',
                        fontWeight: '400'
                    },
                    gridLines: {
                        color: '#3c3c3c',
                        zeroLineColor: '#3c3c3c',
                    },
                },
                {
                    id: 'Density',
                    type: 'linear',
                    position: 'right',
                    gridLines: {
                        display: false,
                        color: '#3c3c3c',
                        zeroLineColor: '#3c3c3c',
                    },
                    ticks: {
                        display: false,
                        reverse: false,
                        beginAtZero: true,
                        fontColor: '#fff',
                    },
                }],
                xAxes: [{
                    id: 'x-axis-0',
                    gridLines: {
                        display: true,
                        zeroLineColor: '#3c3c3c',
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        maxRotation: 0,
                        // minRotation: 15,
                        fontColor: '#fff',
                        fontSize: 14,
                        fontFamily: 'Calibri Light',
                        fontWeight: '400'
                    },
                    // https://stackoverflow.com/questions/43063407/hide-min-and-max-values-from-y-axis-in-chart-js
                    beforeTickToLabelConversion(scaleInstance) {
                        scaleInstance.ticks = scaleInstance.ticks.map(tick => Number(tick).toFixed(0));
                        // const ticks = scaleInstance.ticks.map(tick => Number(tick));
                    //     const max = Math.max(...ticks);
                    //     const min = Math.min(...ticks);
                    //     const {
                    //         niceMin,
                    //         niceMax,
                    //         tickSpacing,
                    //     } = calculateNiceRange(min, max, 10);
                    //     const precisionMax = getPrecision(niceMax);
                    //     const precisionMin = getPrecision(niceMin);
                    //     const precisionStep = getPrecision(tickSpacing);
                    //     const precision = Math.max(precisionMin, precisionMax, precisionStep);
                    //
                    //     const newScaleInstanceStr = ticks.map(tick => Number(tick).toFixed(precision));
                    //     scaleInstance.ticks = newScaleInstanceStr;
                    },
                }],
            },
            legend: {
                display: false,
            },
            title: {
                display: false,
                position: 'top',
                text: dtPoints.label,
                fontColor: '#65c5f1',
            },
            annotation: {
                annotations: [],
            },
        },
        // responsive: true,
    };

    const configData = {
        labels: histObj.histLabels,
        datasets: [{
            id: 'Histogram',
            label: 'サンプル数',
            borderWidth: 0,
            backgroundColor: '#89b368', // histogram data color
        }],
    };

    chartConfig.options.scales.yAxes[0].gridLines.color = '#444'; // chart grid color of y
    chartConfig.options.scales.xAxes[0].gridLines.color = '#444'; // chart grid color of x

    chartConfig.data = configData;

    Chart.defaults.global.datasets.bar.barThickness = 2.25;
    Chart.defaults.global.datasets.bar.maxBarThickness = 10;

    drawChart();

    const canvas = $(`#${canvasId}`).get(0);
    const chartTitle = $(`#${canvasId}`).parent().parent().find('.chart-title').get(0);

    if (chartTitle) {
        $(chartTitle).text(dtPoints.label);
    }
    // auto-refresh code
    let chart = chartObject;
    try {
        if (!chart) {
            chart = new Chart(canvas, chartConfig);
        } else {
            chart.data.labels = histObj.histLabels;
            chart.data.datasets[0].data = histObj.histCounts;
            chart.update();
        }
    } catch (error) {
        console.log(error);
    }

    // ///////////////////////////////////////////////
    function drawChart() {
        // if (!isEmpty(xLabel)) {
        //     chartConfig.options.scales.xAxes[0].scaleLabel.labelString = xLabel;
        // }

        if (!isEmpty(histObj.histLabels)) {
            chartConfig.data.labels = histObj.histLabels;
        }

        if (!isEmpty(histObj.histCounts)) {
            chartConfig.data.datasets[0].data = histObj.histCounts;
            if (density) {
                chartConfig.data.datasets[1] = {
                    label: 'Density',
                    yAxisID: 'Density',
                    type: 'line',
                    data: histData.kde, // change later
                    backgroundColor: 'orange',
                    borderColor: '#EC932F',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 0.5,
                };
            }
        }

        // draw line annotation
        if (!isEmpty(procThresholds.xMin)) {
            const procMinBin = binarySearch(histObj.histLabels, procThresholds.xMin, ((x, y) => x - y));
            if (histObj.histLabels.length > procMinBin + 1) {
                chartConfig.options.annotation.annotations.push({
                    type: 'line',
                    drawTime: 'beforeDatasetsDraw',
                    id: 'pvline1',
                    mode: 'vertical',
                    scaleID: 'x-axis-0',
                    value: histObj.histLabels[procMinBin + 1],
                    borderColor: CONST.BLUE,
                    borderWidth: 1,
                });
            }
        }

        if (!isEmpty(procThresholds.xMax)) {
            const procMaxBin = binarySearch(histObj.histLabels, procThresholds.xMax, ((x, y) => x - y));
            if (histObj.histLabels.length > procMaxBin + 1) {
                chartConfig.options.annotation.annotations.push({
                    type: 'line',
                    drawTime: 'beforeDatasetsDraw',
                    id: 'pvline2',
                    mode: 'vertical',
                    scaleID: 'x-axis-0',
                    value: histObj.histLabels[procMaxBin + 1],
                    borderColor: CONST.BLUE,
                    borderWidth: 1,
                });
            }
        }

        // // draw line annotation
        if (!isEmpty(uclThresholds.xMin)) {
            const uclMinBin = binarySearch(histObj.histLabels, uclThresholds.xMin, ((x, y) => x - y));
            if (histObj.histLabels.length > uclMinBin + 1) {
                chartConfig.options.annotation.annotations.push({
                    type: 'line',
                    drawTime: 'beforeDatasetsDraw',
                    id: 'uvline1',
                    mode: 'vertical',
                    scaleID: 'x-axis-0',
                    value: histObj.histLabels[uclMinBin + 1],
                    borderColor: CONST.RED,
                    borderWidth: 1,
                });
            }
        }

        if (!isEmpty(uclThresholds.xMax)) {
            const uclMaxBin = binarySearch(histObj.histLabels, uclThresholds.xMax, ((x, y) => x - y));
            if (histObj.histLabels.length > uclMaxBin + 1) {
                chartConfig.options.annotation.annotations.push({
                    type: 'line',
                    drawTime: 'beforeDatasetsDraw',
                    id: 'uvline2',
                    mode: 'vertical',
                    scaleID: 'x-axis-0',
                    value: histObj.histLabels[uclMaxBin + 1],
                    borderColor: CONST.RED,
                    borderWidth: 1,
                });
            }
        }
    }
    return chart;
}
