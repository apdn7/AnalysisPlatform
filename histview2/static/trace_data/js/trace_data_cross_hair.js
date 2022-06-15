let isRemoveCrosshair = true;
const celes = {
    crossV: '.cross.v',
    crossH: '.cross.h',
    crossVLeft: '.cross.v.left',
    crossHLeft: '.cross.h.left',
    crossVRight: '.cross.v.right',
    crossHRight: '.cross.h.right',
    cateTable: '#cateTable',
};

/*
* VERTICAL LINE AT CATEGORY TABLE
* */
function removeVerticalLine() {
    if (isRemoveCrosshair) {
        $(celes.crossV).css({display: 'none'});
        $(celes.crossH).css({display: 'none'});
    }
    isRemoveCrosshair = true;
}

function showVerticalLine(offsetTop, offsetLeft, lineHeight, isLeft = true) {
    const showLine = (crossV, crossH, offsetTop, offsetLeft, lineHeight) => {
        crossV.css({display: 'block'});
        crossH.css({display: 'block'});
        crossH.css({'border-left': '1px solid #91e2ff'});
        crossV.css({top: offsetTop});
        crossH.css({left: offsetLeft});
        crossH.css({height: lineHeight});
    };

    if (isLeft) {
        showLine($(celes.crossVLeft), $(celes.crossHLeft), offsetTop, offsetLeft, lineHeight);
    } else {
        showLine($(celes.crossVRight), $(celes.crossHRight), offsetTop, offsetLeft, lineHeight);
    }
}

const addDrawVerticalLineEvent = () => {
    // show a vertical red line when hover to edge of category boxes
    $(`${formElements.cateTable} .cate-edge`).each(function f() {
        $(this).on('mouseover', (e) => {
            const targets = $(e.currentTarget).closest('td').find('.cate-edge');
            for (const target of targets) {
                const edge = $(target);
                const offsetTop = edge.offset().top;
                let offsetLeft = edge.offset().left;
                let isLeft = true;
                if (edge.hasClass('cate-edge-right')) {
                    offsetLeft = edge.offset().left + edge.outerWidth();
                    isLeft = false;
                }
                const lineHeight = $(document).height() - offsetTop;
                showVerticalLine(offsetTop, offsetLeft, lineHeight, isLeft);
            }
        });
    });
};

function showVerticalLineOnClick(clickEvent) {
    // show red vertical line on category table when user click in graph
    const offsetTop = $(celes.cateTable).offset().top;
    const offsetLeft = clickEvent.native.clientX;
    const lineHeight = $(celes.cateTable).height();
    showVerticalLine(offsetTop, offsetLeft, lineHeight);
}

function removeCrossHairOfChart(graphObj, update = true) {
    if (!graphObj) return;
    try {
        if (graphObj.options.plugins.annotation.annotations['crosshair-x']
            || graphObj.options.plugins.annotation.annotations['crosshair-y']) {
            delete graphObj.options.plugins.annotation.annotations['crosshair-x'];
            delete graphObj.options.plugins.annotation.annotations['crosshair-y'];
            if (update) graphObj.update(mode = 'none');
        }
    } catch (e) {
        console.log(e);
    }
}

function removeThresholdsOfChart(graphObj, type = CONST.ALL) {
    if (!graphObj) return;
//     try {
//         const verticalIds = [CONST.vUCL, CONST.vLCL, CONST.vUPCL, CONST.vLPCL];
//         const horizonalIds = [CONST.UCL, CONST.LCL, CONST.UPCL, CONST.LPCL];
//         let toBeRemovedIds = horizonalIds + verticalIds;
//         if (type === CONST.VERTICAL) {
//             toBeRemovedIds = verticalIds;
//         } else if (type === CONST.HORIZONTAL) {
//             toBeRemovedIds = horizonalIds;
//         }
//         const lines = graphObj.options.plugins.annotation.annotations;
//         const newLines = [];
//         for (let i = 0; i < lines.length; i++) {
//             if (!toBeRemovedIds.includes(lines[i].id)) {
//                 newLines.push(lines[i]);
//             }
//         }
//         graphObj.options.plugins.annotation.annotations = newLines;
//         graphObj.update(mode='none');
//     } catch (e) {
//         console.log(e);
//     }
}

// remove all cross hair when click outside of graph canvas
$(document).on('click', (e) => {
    const target = $(e.target);
    const isCanvasContextMenu = target.hasClass('menu-item');
    if (!isCanvasContextMenu) {
        hideFPPContextMenu();
    }

    removeVerticalLine();

    const hideFilteringTable = !target.closest('.show-filter-info').length;
    if (hideFilteringTable) {
        const filterInfoTable = $(formElements.settingHoverContent);
        const originalOffset = $('#sim').offset();
        if (originalOffset) {
            filterInfoTable.css({
                top: '',
                left: '',
            });
        }
        filterInfoTable.css({
            display: '',
        });
    }

    // hide index-inform-content when click
    const indexInfo = target.closest('.index-inform-content');
    if (!indexInfo.length) {
        $('.index-inform-content').css({display: 'none'});
    }

    // hide all tooltips of cate box
    $('.cate-tooltip').css({visibility: 'hidden'});
});

function removeAllCrossHair(updateTS = true, updateHist = true, updateSct = true) {
    graphStore.getAllTimeSeries().forEach((graphObj) => {
        removeCrossHairOfChart(graphObj, updateTS);
    });

    graphStore.getAllHistogram().forEach((graphObj) => {
        removeCrossHairOfChart(graphObj, updateHist);
    });

    graphStore.getAllScatterPlot().forEach((graphObj) => {
        removeCrossHairOfChart(graphObj, updateSct);
    });
}


const scatterHorizontalline = (yValue, color = CONST.CH_OTHER) => ({
    type: 'line',
    id: 'crosshair-y',
    mode: 'horizontal',
    scaleID: 'y',
    value: yValue,
    borderColor: color,
    borderWidth: 1,
    label: {
        enabled: true,
        position: 'center',
        content: yValue,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});

const scatterVertialLine = (xValue, color = CONST.CH_OTHER) => ({
    type: 'line',
    id: 'crosshair-x',
    mode: 'vertical',
    scaleID: 'x',
    value: xValue,
    borderColor: color,
    borderWidth: 1,
    label: {
        enabled: true,
        position: 'center',
        content: xValue,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});

const histHorizontalLine = (yValue, color = CONST.CH_OTHER) => ({
    id: 'crosshair-y',
    type: 'line',
    mode: 'horizontal',
    scaleID: 'y',
    value: yValue,
    borderColor: color,
    borderWidth: 1,
    label: {
        enabled: true,
        position: 'center',
        content: yValue,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});

const tsHorizonalLine = (yValue, color = CONST.CH_OTHER) => ({
    type: 'line',
    id: 'crosshair-y',
    mode: 'horizontal',
    scaleID: 'y',
    value: yValue,
    borderColor: color,
    borderWidth: 1,
    label: {
        enabled: true,
        position: 'center',
        content: yValue,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});

const tsVerticalLine = (xValue, color = CONST.CH_OTHER) => ({
    type: 'line',
    id: 'crosshair-x',
    mode: 'vertical',
    scaleID: 'x',
    value: isNaN(xValue) ? xValue : xValue - 1,
    borderColor: color,
    borderWidth: 1,
    label: {
        enabled: true,
        position: 'center',
        content: xValue.toLocaleString(),
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});

const drawCrossHairOnDoubleClick = (clickPosition, selectedCanvasId) => {
    removeAllCrossHair(false, false, false);

    const allChartCanvas = $('#plot-cards').find('canvas');
    allChartCanvas.each(function f() {
        const canvasId = $(this).attr('id');
        const chartType = $(this).attr('chart-type');
        let color = CONST.CH_OTHER;
        if (canvasId === selectedCanvasId) {
            color = CONST.CH_SELF;
        }
        if (chartType === 'scatter') {
            // draw horizontal from yValue
            const scatterChartObject = graphStore.getScatterById(canvasId);
            if (!scatterChartObject) {
                return;
            }
            // draw vertical from corresponding xValue
            const scatterDataPoint = scatterChartObject.data.datasets[0].data[clickPosition - 1];
            if (scatterDataPoint) {
                const cXValue = scatterDataPoint.x;
                const cYValue = scatterDataPoint.y;
                if (!isEmpty(cXValue) && !isEmpty(cYValue)) {
                    scatterChartObject.options.plugins.annotation.annotations['crosshair-x'] = scatterVertialLine(cXValue, color);
                    scatterChartObject.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(cYValue, color);
                    scatterChartObject.update(mode = 'none');
                }
            }
        }

        if (chartType === 'histogram') {
            // draw horizontal from yValue
            const histChartObject = graphStore.getHistById(canvasId);
            // get time series chart of the row of histogram to get corresponding yValue
            const coTimeSeriesGraph = graphStore.getTimeSeriesFromHist(canvasId);
            if (coTimeSeriesGraph) {
                // get coYValue from clickPosition
                const coYValue = coTimeSeriesGraph.data.datasets[0].data[clickPosition];
                if (!isEmpty(coYValue) && histChartObject) {
                    histChartObject.options.plugins.annotation.annotations['crosshair-y'] = histHorizontalLine(coYValue);
                    histChartObject.update(mode = 'none');
                }
            }
        }

        if (chartType === 'timeSeries') {
            const tsChartObject = graphStore.getTimeSeriesById(canvasId);

            // draw horizontal from yValue
            // corresponding data point may be normal/irregular data point
            const coClickedData = tsChartObject.data.datasets[0].data[clickPosition]
                || tsChartObject.data.datasets[1].data[clickPosition];
            const xValue = tsChartObject.data.labels[clickPosition];
            // dont draw horizontal line if that data point is null
            if (!isEmpty(coClickedData)) {
                tsChartObject.options.plugins.annotation.annotations['crosshair-y'] = tsHorizonalLine(coClickedData, color);
            }

            // draw vertical from xValue
            tsChartObject.options.plugins.annotation.annotations['crosshair-x'] = tsVerticalLine(xValue, color);
            tsChartObject.update(mode = 'none');
        }
    });
};

const drawCrosshairSingleClick = (clickPosition, xValue, yValue, selectedCanvasId) => {
    console.log('drawCrosshairSingleClick');
    removeAllCrossHair(false, true, true);

    // find histogram and scatter plot at the same row
    const sameRowCanvases = $(`#${selectedCanvasId}`).closest('div .chart-row').find('canvas');
    sameRowCanvases.each(function f() {
        const canvasId = $(this).attr('id');
        const chartType = $(this).attr('chart-type');
        let color = CONST.CH_OTHER;
        if (canvasId === selectedCanvasId) {
            color = CONST.CH_SELF;
        }

        if (chartType === 'scatter') {
            const scatterChartObject = graphStore.getScatterById(canvasId);
            if (scatterChartObject) {
                scatterChartObject.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(yValue, color);
                scatterChartObject.update(mode = 'none');
            }
        }

        if (chartType === 'histogram') {
            const histChartObject = graphStore.getHistById(canvasId);
            if (histChartObject) {
                histChartObject.options.plugins.annotation.annotations['crosshair-y'] = scatterHorizontalline(yValue, color);
                histChartObject.update(mode = 'none');
            }
        }

        if (chartType === 'timeSeries') {
            // draw vertical from xValue
            const tsChartObject = graphStore.getTimeSeriesById(canvasId);
            // draw horizontal from yValue
            tsChartObject.options.plugins.annotation.annotations['crosshair-y'] = tsHorizonalLine(yValue, color);
            tsChartObject.update(mode = 'none');
        }
    });

    graphStore.getAllTimeSeries().forEach((graphObj) => {
        const canvasId = graphObj.canvas.id;
        let color = CONST.CH_OTHER;
        if (canvasId === selectedCanvasId) {
            color = CONST.CH_SELF;
        }
        graphObj.options.plugins.annotation.annotations['crosshair-x'] = tsVerticalLine(xValue, color);
        graphObj.update(mode = 'none');
    });
};
