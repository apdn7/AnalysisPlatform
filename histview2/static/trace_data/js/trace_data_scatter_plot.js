let avoidMultiClickCnt = 0;
let currentScaleOption;
// eslint-disable-next-line no-unused-vars
const scatterChart = (ctx, data, prop) => {
    const contextMenu = {
        scatter: 'contextMenuScatter',
    };

    const genScatterTitleColor = (propIdx) => {
        const colors = [CONST.BLUE, CONST.DARK_BLUE];
        const xTitleColor = colors[(propIdx + 1) % 2];
        const yTitleColor = colors[propIdx % 2];
        return [xTitleColor, yTitleColor];
    };

    const genDataPointHoverInfo = (dataPoint, prop) => {
        const xValue = applySignificantDigit(dataPoint.x);
        const yValue = applySignificantDigit(dataPoint.y);
        if (prop.xProcName && prop.yProcName) {
            return [`${prop.sensorMasters[prop.xSensorIdx]}@${prop.xProcName}: ${xValue}`,
                `${prop.sensorMasters[prop.xSensorIdx]}@${prop.yProcName}: ${yValue}`];
        }
        return [`${prop.sensorMasters[prop.xSensorIdx]}: ${xValue}`,
            `${prop.sensorMasters[prop.xSensorIdx]}: ${yValue}`];
    };
    const chartOptions = {
        interaction: {
            intersect: true,
            mode: 'nearest',
        },
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        spanGaps: true,
        parsing: false,
        scales: {
            x: {
                title: {
                    display: false,
                    text: prop.sensorMasters[prop.xSensorIdx],
                    font: {
                        family: 'Calibri Light',
                        size: 12,
                    },
                    color: [CONST.BLUE, CONST.DARK_BLUE][(prop.idx + 1) % 2],
                },
                ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                    sampleSize: 8,
                    align: 'end',
                    color: CONST.TICK,
                    font: {
                        family: 'Calibri Light', size: 12,
                    },
                    callback(value, index, values) {
                        let showVal = applySignificantDigit(value);
                        // align number to right
                        if (showVal.includes('e')) {
                            showVal = Number(value).toPrecision(3);
                        }
                        return showVal;
                    },
                },
                grid: {
                    color: CONST.GRID,
                    drawTicks: false,
                    drawBorder: false,
                },
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
                title: {
                    display: false,
                    // text: prop.sensorMasters[prop.ySensorIdx],
                    // fontSize: 11,
                    // color: [CONST.BLUE, CONST.DARK_BLUE][prop.idx % 2],
                },
                ticks: {
                    minRotation: 0,
                    maxRotation: 0,
                    sampleSize: 8,
                    maxTicksLimit: 9,
                    color: CONST.TICK,
                    callback(value, index, values) {
                        let showVal = applySignificantDigit(value);
                        // align number to right
                        if (showVal.includes('e')) {
                            showVal = Number(value).toPrecision(3);
                        }
                        return showVal;
                    },
                },
                grid: {
                    color: CONST.GRID,
                    drawTicks: false,
                    drawBorder: false,
                },
                afterTickToLabelConversion: function adjust(context) {
                    const { ticks } = context;
                    context.ticks[0].label = '';
                    if (ticks.length) context.ticks[ticks.length - 1].label = '';
                },
                afterFit(scaleInstance) {
                    scaleInstance.width = 60; // sets the width to 100px
                },
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            annotation: {
                drawTime: 'afterDraw',
                annotations: {},
            },
            chartAreaBorder: {
                borderColor: CONST.COLOR_FRAME_BORDER,
                borderWidth: 2,
                borderDash: false,
            },
            scatterInsideTitle: {
                color: genScatterTitleColor(prop.idx),
                xContent: [prop.sensorMasters[prop.xSensorIdx]],
                yContent: [prop.sensorMasters[prop.ySensorIdx]],
                font: {
                    family: 'Calibri Light',
                    size: 12,
                },
            },
            tooltip: {
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        const dataPointLabel = genDataPointHoverInfo(context.raw, prop);
                        return dataPointLabel;
                    },
                },
            },
        },
        events: ['click', 'mousemove'],
        layout: {
            padding: {
                top: 12,
            },
        },
        onClick(event) {
            avoidMultiClickCnt += 1;
            const curCnt = avoidMultiClickCnt;

            if (event.native.detail >= 2) {
                // on DOUBLE CLICK: draw all crosshair line on double click
                setTimeout(() => {
                    if (curCnt === avoidMultiClickCnt) {
                        scatterPlotOnDbClick(chart, event);
                    }
                }, 200);
            } else {
                // on SINGLE CLICK
                setTimeout(() => {
                    if (curCnt === avoidMultiClickCnt) {
                        scatterPlotOnClick(chart, event);
                    }
                }, 200);
            }
        },
        onHover(e) {
            const point = this.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
            // if (point.length) e.target.style.cursor = 'pointer';
            // else e.target.style.cursor = 'default';

            if (point.length) {
                // save hovered data index
                const chartCanvasId = chart.canvas.id;
                const hoveredIndex = point[0].index;
                const datasetId = point[0].datasetIndex;
                graphStore.saveHoveredDataPoint(chartCanvasId, {
                    index: hoveredIndex,
                    datasetIndex: datasetId,
                });
                graphStore.setSelectedCanvas(chartCanvasId);
            }
        },
    };

    const { procThresholds, uclThresholds, scaleMinMaxTicks } = prop;

    // set scale Ticks max/min for x/y-axis
    if (!isEmpty(scaleMinMaxTicks.minX)) {
        chartOptions.scales.x.min = scaleMinMaxTicks.minX;
    }

    if (!isEmpty(scaleMinMaxTicks.maxX)) {
        chartOptions.scales.x.max = scaleMinMaxTicks.maxX;
    }

    if (!isEmpty(scaleMinMaxTicks.minY)) {
        chartOptions.scales.y.min = scaleMinMaxTicks.minY;
    }

    if (!isEmpty(scaleMinMaxTicks.maxY)) {
        chartOptions.scales.y.max = scaleMinMaxTicks.maxY;
    }

    // procThresholds.xLow
    if (!isEmpty(procThresholds.xLow)) {
        chartOptions.plugins.annotation.annotations.vlpcl = createVerticalThreshold(procThresholds.xLow, CONST.BLUE, CONST.vLPCL);
    }

    // procThresholds.xHigh
    if (!isEmpty(procThresholds.xHigh)) {
        chartOptions.plugins.annotation.annotations.vupcl = createVerticalThreshold(procThresholds.xHigh, CONST.BLUE, CONST.vUPCL);
    }

    // procThresholds.yLow
    if (!isEmpty(procThresholds.yLow)) {
        chartOptions.plugins.annotation.annotations.lpcl = createHorizonalThreshold(procThresholds.yLow, CONST.BLUE, CONST.LPCL);
    }

    // procThresholds.yHigh
    if (!isEmpty(procThresholds.yHigh)) {
        chartOptions.plugins.annotation.annotations.upcl = createHorizonalThreshold(procThresholds.yHigh, CONST.BLUE, CONST.UPCL);
    }

    // draw line annotation
    if (!isEmpty(uclThresholds.xLow)) {
        chartOptions.plugins.annotation.annotations.vlcl = createVerticalThreshold(uclThresholds.xLow, CONST.RED, CONST.vLCL);
    }

    if (!isEmpty(uclThresholds.xHigh)) {
        chartOptions.plugins.annotation.annotations.vucl = createVerticalThreshold(uclThresholds.xHigh, CONST.RED, CONST.vUCL);
    }

    if (!isEmpty(uclThresholds.yLow)) {
        chartOptions.plugins.annotation.annotations.lcl = createHorizonalThreshold(uclThresholds.yLow, CONST.RED, CONST.LCL);
    }

    if (!isEmpty(uclThresholds.yHigh)) {
        chartOptions.plugins.annotation.annotations.ucl = createHorizonalThreshold(uclThresholds.yHigh, CONST.RED, CONST.UCL);
    }

    // destroy instance
    try {
        Chart.helpers.each(Chart.instances, (instance) => {
            const { id } = instance;
            const cvasId = instance.canvas.id;
            if (cvasId === ctx.attr('id')) {
                Chart.instances[id].destroy();
            }
        });
    } catch (e) {
        console.log(e);
    }

    const chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Scatter Dataset',
                    showLine: false,
                    pointBackgroundColor: '#89b368',
                    pointRadius: data.length < 100 ? 2 : 1.5,
                    data,
                },
            ],
        },
        options: chartOptions,
        plugins: [chartAreaBorder, scatterInsideTitle],
    });

    const canvas = $(ctx).get(0);
    const menu = document.getElementById(contextMenu.scatter);

    canvas.addEventListener('contextmenu', showContextMenu, false);
    canvas.addEventListener('mousedown', handleMouseDown, false);

    function handleMouseDown(e) { // later, not just mouse down, + mouseout of menu
        menu.style.display = 'none';
    }

    function showContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.display = 'block';
        graphStore.setSelectedCanvas(e.currentTarget.id);
    }

    return chart;
};

function scatterPlotOnDbClick(chart, event) {
    // remove all crosshair
    // removeAllCrossHair(false);

    // get clicked x,y values to draw cross hair lines
    const eventElement = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
    if (!eventElement || eventElement.length < 1) return;
    const clickedIdx = eventElement[0].index + 1;

    // timeseries chart
    // const chartIdx = chart.canvas.id.slice(-2);
    // const tsChartObj = graphStore.getTimeSeriesById(`chart${chartIdx}`);
    // const xValue = tsChartObj.data.labels[clickedIdx];

    // draw crosshair
    const canvasId = chart.canvas.id || 'chart01';
    drawCrossHairOnDoubleClick(clickedIdx, canvasId);
}

function scatterPlotOnClick(chart, event) {
    // get clicked x,y values to draw cross hair lines
    const eventElement = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
    if (!eventElement || eventElement.length < 1) {
        removeAllCrossHair(true, true, true);
        return;
    }
    const clickedIdx = eventElement[0].index;

    // remove all crosshair
    removeAllCrossHair(true, true, true);

    // position of clicked data point
    const clickedDataPoint = chart.data.datasets[0].data[clickedIdx];
    const xValue = clickedDataPoint.x;
    const yValue = clickedDataPoint.y;
    // console.log('xValue=', xValue, ', yValue=', yValue);
    chart.options.plugins.annotation.annotations['crosshair-x'] = scatterVertialLine(xValue, CONST.CH_SELF);
    chart.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(yValue, CONST.CH_SELF);
    chart.update(mode = 'none');

    // same row TODO use class to get
    const sameRowCanvases = $(event.chart.canvas).closest('div .chart-row').find('canvas');
    sameRowCanvases.each(function f() {
        const canvasId = $(this).attr('id');
        const chartType = $(this).attr('chart-type');

        if (chartType === 'histogram') {
            const histChartObject = graphStore.getHistById(canvasId);
            if (histChartObject) {
                histChartObject.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(yValue);
                histChartObject.update(mode = 'none');
            }
        }

        if (chartType === 'timeSeries') {
            // draw horizontal from yValue
            const tsChartObject = graphStore.getTimeSeriesById(canvasId);
            tsChartObject.options.plugins.annotation.annotations['crosshair-y'] = tsHorizonalLine(yValue);
            tsChartObject.update(mode = 'none');
        }
    });

    // draw crosshair corresponding timeseries
    const currentCanvasId = chart.canvas.id;
    drawNextChartCrosshair(currentCanvasId, clickedIdx);
}

const findNextRowId = (currentCanvasId) => {
    const scatterCanvasIds = [];
    $('canvas[chart-type=scatter]').each(function f() {
        scatterCanvasIds.push($(this).attr('id'));
    });
    const allTimeseriesCanvas = $('canvas[chart-type=timeSeries]');
    const numOfCarts = allTimeseriesCanvas.length;

    const currentRowIdx = scatterCanvasIds.indexOf(currentCanvasId);
    const nextRowIdx = (currentRowIdx + 1) % numOfCarts;
    return nextRowIdx;
};

const drawNextChartCrosshair = (currentCanvasId, clickedIdx) => {
    const allTimeseriesCanvas = $('canvas[chart-type=timeSeries]');
    const numOfCarts = allTimeseriesCanvas.length;
    const tsCanvasIds = [];
    allTimeseriesCanvas.each(function f() {
        tsCanvasIds.push($(this).attr('id'));
    });
    const scatterCanvasIds = [];
    $('canvas[chart-type=scatter]').each(function f() {
        scatterCanvasIds.push($(this).attr('id'));
    });
    const currentRowIdx = scatterCanvasIds.indexOf(currentCanvasId);
    const nextRowIdx = (currentRowIdx + 1) % numOfCarts;
    const nextTsCanvasId = tsCanvasIds[nextRowIdx];

    const tsChartObject = graphStore.getTimeSeriesById(nextTsCanvasId);
    const coYValue = tsChartObject.data.datasets[0].data[clickedIdx + 1];
    if (!isEmpty(coYValue)) {
        tsChartObject.options.plugins.annotation.annotations['crosshair-y'] = tsHorizonalLine(coYValue, CONST.CH_OTHER);
        tsChartObject.update(mode = 'none');
    }
};

const getPlotData = (data, xSensorIdx, ySensorIdx) => {
    if (xSensorIdx > data.array_plotdata.length - 1
        || ySensorIdx > data.array_plotdata.length - 1) {
        return null;
    }
    const xData = data.array_plotdata[xSensorIdx];
    const yData = data.array_plotdata[ySensorIdx];

    let xProcName = '';
    let yProcName = '';

    if (xData.end_proc_id !== yData.end_proc_id) {
        xProcName = data.proc_name[xData.end_proc_id] || '';
        yProcName = data.proc_name[yData.end_proc_id] || '';
    }

    return {
        xArr: xData.array_y,
        yArr: yData.array_y,
        xProcName,
        yProcName,
    };
};

// generate Scatter Plot
const generateScatterData = (xArr, yArr) => {
    if (xArr.length !== yArr.length) {
        return [];
    }
    const data = [];
    for (let i = 0; i < xArr.length; i++) {
        data.push({
            x: xArr[i],
            y: yArr[i],
        });
    }
    return data;
};


const getThresholdData = (data, xSensorIdx, ySensorIdx) => {
    const chartInfosX = data.array_plotdata[xSensorIdx].chart_infos || [];
    const chartInfosXOrg = data.array_plotdata[xSensorIdx].chart_infos_org || [];
    const chartInfosY = data.array_plotdata[ySensorIdx].chart_infos || [];
    const chartInfosYOrg = data.array_plotdata[ySensorIdx].chart_infos_org || [];
    const [latestChartInfoX, _x] = chooseLatestThresholds(chartInfosX, chartInfosXOrg);
    const [latestChartInfoY, _y] = chooseLatestThresholds(chartInfosY, chartInfosYOrg);
    const xScaleOption = getScaleInfo(data.array_plotdata[xSensorIdx], currentScaleOption);
    const yScaleOption = getScaleInfo(data.array_plotdata[ySensorIdx], currentScaleOption);

    return {
        procThresholds: {
            xLow: latestChartInfoX['prc-min'],
            xHigh: latestChartInfoX['prc-max'],
            yLow: latestChartInfoY['prc-min'],
            yHigh: latestChartInfoY['prc-max'],
        },
        uclThresholds: {
            xLow: latestChartInfoX['thresh-low'],
            xHigh: latestChartInfoX['thresh-high'],
            yLow: latestChartInfoY['thresh-low'],
            yHigh: latestChartInfoY['thresh-high'],
        },
        scaleMinMaxTicks: {
            // minX: data.array_plotdata[xSensorIdx]['y-min'],
            // maxX: data.array_plotdata[xSensorIdx]['y-max'],
            // minY: data.array_plotdata[ySensorIdx]['y-min'],
            // maxY: data.array_plotdata[ySensorIdx]['y-max'],
            minX: xScaleOption['y-min'],
            maxX: xScaleOption['y-max'],
            minY: yScaleOption['y-min'],
            maxY: yScaleOption['y-max'],
        },
    };
};

// get sensor master names to show to legends
const getSensorShowNames = (data) => {
    const selectedSensors = data.ARRAY_FORMVAL || [];
    const sensorMasters = selectedSensors.map((sensor) => {
        const endProc = sensor.end_proc;
        const sensorColId = sensor.GET02_VALS_SELECT;
        const sensorMaster = getColumnName(endProc, sensorColId);
        return sensorMaster;
    });

    return sensorMasters;
};

const produceScatterPlotCharts = (data, scaleOption = null) => {
    if (!data.array_plotdata.length) return;

    if (scaleOption) {
        currentScaleOption = scaleOption;
    }

    if (currentScaleOption === null) {
        return;
    }

    // get master names for sensors
    const sensorMasters = getSensorShowNames(data);
    const dictCanvasId2Scatter = {};

    $('.sctr-plot-ts').each((k, his) => {
        // get x/y sensor index -> get data
        const xSensorIdx = parseInt($(his).attr('x-sensor-idx'));
        const ySensorIdx = parseInt($(his).attr('y-sensor-idx'));

        // generate scatter plot data
        const pdt = getPlotData(data, xSensorIdx, ySensorIdx);
        if (!pdt) return;
        const scatterData = generateScatterData(pdt.xArr, pdt.yArr);

        // get threshold data
        const { uclThresholds, procThresholds, scaleMinMaxTicks } = getThresholdData(data, xSensorIdx, ySensorIdx);

        // chart properties
        const prop = {
            uclThresholds,
            procThresholds,
            sensorMasters,
            xSensorIdx,
            ySensorIdx,
            scaleMinMaxTicks,
            idx: k,
            xProcName: pdt.xProcName,
            yProcName: pdt.yProcName,
        };

        // produce scatter plot
        const chartObject = scatterChart($(his), scatterData, prop);

        // push to global storage to use later (to draw crosshair)
        const canvasId = $(his).attr('id');
        dictCanvasId2Scatter[canvasId] = chartObject;
    });
    return dictCanvasId2Scatter;
};

// put inside  ui-sortable event
const redrawScatterAfterMoveCart = () => {
    // destroy all scatter plots + reset dict
    for (const graphIdx in Chart.instances) {
        if (Chart.instances[graphIdx].canvas
            && $(Chart.instances[graphIdx].canvas).attr('chart-type') === 'scatter') {
            try {
                Chart.instances[graphIdx].destroy(); // destroy scatter plot instances
            } catch (e) {
                console.log(e);
            }
        }
    }

    // set store empty
    graphStore.setDctCanvas2Scatter({});

    // produce new indices for graphs
    const latestSensorOrders = [];
    $('.sctr-plot-ts').each((k, his) => {
        // replace old canvas by new canvas (but same content) to completly clear the instance
        const { outerHTML } = his;
        const canvasId = his.id;
        const parentDiv = $(his).parent();
        parentDiv.empty();
        parentDiv.append(outerHTML);

        // y is vertical axis -> sensor data of the same card
        const ySensorIdx = $(`#${canvasId}`).attr('y-sensor-idx');
        latestSensorOrders.push(ySensorIdx);
    });

    // re-new scatter axies
    $('.sctr-plot-ts').each((k, scatterContainter) => {
        // x is vertical axis -> sensor data of the next card
        const newXSensorIdx = latestSensorOrders[(k + 1) % latestSensorOrders.length];
        $(scatterContainter).attr('x-sensor-idx', newXSensorIdx);
    });

    // call produceScatterPlotCharts with traceDataResult
    const scatterPlots = produceScatterPlotCharts(graphStore.getTraceData());
    graphStore.setDctCanvas2Scatter(scatterPlots);
};


const addTimeSeriesCardSortableEventHandler = () => {
    /*
    * When user change order of timeseries card:
    * + we store order/position of those column/sensor to db.
    * + and re-draw scatter plots.
    * */
    $('.ui-sortable').sortable({
        update(event, ui) {
            // redraw scatter plots
            redrawScatterAfterMoveCart();

            // save orders to db proc-sensor-order,
            // trace data results will be ordered before sending to frontend
            // frontend just need to keep current code and work with index for plot_array
            const procSensorOrders = {};
            $('.chart-row').each((order, row) => {
                const proc = $(row).attr('proc');
                const sensor = $(row).attr('sensor');
                if (proc && sensor) {
                    if (!procSensorOrders[proc]) {
                        procSensorOrders[proc] = {};
                    }
                    procSensorOrders[proc][sensor] = order;
                }
            });

            // align label plot with first graph
            adjustCatetoryTableLength();

            fetch('/histview2/api/fpp/save_order', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orders: procSensorOrders,
                }),
            })
                .then(response => response.clone().json())
                .then(() => {
                })
                .catch(() => {
                });
        },
    });
};


const handleSelectSCPMenuItem = (selectedItem = 'click') => {
    const selectedCanvasId = graphStore.getSelectedCanvas();
    if (!selectedCanvasId) return;
    const scpChartObj = graphStore.getScatterById(selectedCanvasId);
    if (!scpChartObj) return;
    const lastHoveredDataPoint = graphStore.getLastHoveredDataPoint(selectedCanvasId);
    if (!lastHoveredDataPoint) return;

    const { index, datasetIndex } = lastHoveredDataPoint;
    const clickedDataPoint = scpChartObj.data.datasets[datasetIndex].data[index];
    const yValue = clickedDataPoint.y;
    const xValue = clickedDataPoint.x;
    switch (selectedItem) {
    case 'click': {
        removeAllCrossHair(true, true, true);
        scpChartObj.options.plugins.annotation.annotations['crosshair-x'] = scatterVertialLine(xValue, CONST.CH_SELF);
        scpChartObj.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(yValue, CONST.CH_SELF);
        scpChartObj.update(mode = 'none');

        // same row TODO use class to get
        const sameRowCanvases = $(`#${selectedCanvasId}`).closest('div .chart-row').find('canvas');
        sameRowCanvases.each(function f() {
            const canvasId = $(this).attr('id');
            const chartType = $(this).attr('chart-type');

            if (chartType === 'histogram') {
                const histChartObject = graphStore.getHistById(canvasId);
                if (histChartObject) {
                    histChartObject.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(yValue);
                    histChartObject.update(mode = 'none');
                }
            }

            if (chartType === 'timeSeries') {
                // draw horizontal from yValue
                const tsChartObject = graphStore.getTimeSeriesById(canvasId);
                tsChartObject.options.plugins.annotation.annotations['crosshair-y'] = tsHorizonalLine(yValue);
                tsChartObject.update(mode = 'none');
            }
        });

        // draw horizontal crosshair for the next timeseries
        drawNextChartCrosshair(selectedCanvasId, index);

        break;
    }
    case 'doubleClick': {
        drawCrossHairOnDoubleClick(index + 1, selectedCanvasId);
        break;
    }
    default:
    }
};

const createHorizonalThreshold = (threshHold, color = CONST.RED, id = CONST.UCL, borderDash = []) => ({
    type: 'line',
    id,
    mode: 'horizontal',
    scaleID: 'y',
    value: threshHold,
    borderColor: color,
    borderWidth: 0.6,
    borderDash,
});

const createVerticalThreshold = (threshHold, color = CONST.RED, id = CONST.vUCL, borderDash = []) => ({
    type: 'line',
    id,
    mode: 'vertical',
    scaleID: 'x',
    value: threshHold,
    borderColor: color,
    borderWidth: 0.6,
    borderDash,
});
