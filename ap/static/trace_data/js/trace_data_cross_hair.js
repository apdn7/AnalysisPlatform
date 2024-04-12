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

const colors = ['#91e2ff', '#9d9a53', '#ae6e54', '#603567', '#00af91', '#d7cece', '#470f0f', '#0f1451',
        '#a4b790', '#4eb55d', '#bf4db4', '#ba8534'];

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

function showVerticalLine(offsetTop, offsetLeft, lineHeight, isLeft = true, index = 0) {
    const color = colors[index]
    const showLine = (crossV, crossH, offsetTop, offsetLeft, lineHeight) => {
        crossV.css({display: 'block'});
        crossH.css({display: 'block'});
        crossH.css({'border-left': `1px solid ${color}`});
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

const handleShowAnchor = (e) => {
    const contextMenu = $(e).parent();
    const line = contextMenu.attr('line');
    const col = contextMenu.attr('col');
    const cateBox = $(`.cate-box#${line}-${col}`);
    genSingleCross(cateBox);
};

const handleHideCusorInLine = (e) => {
    const contextMenu = $(e).parent();
    const line = contextMenu.attr('line');
    hideAllCrossAnchorInline(line);
};

const handleShowALLCusorInLine = (e) => {
    const contextMenu = $(e).parent();
    const line = contextMenu.attr('line');
    genAllCrossInLine(line);
};

const genVerticalCrossLineHtml = (edgeLeft, edgeRight, id) => {
    const idLeft = edgeLeft.length > 0 ? edgeLeft.attr('data-id') : null;
    const idRight = edgeRight.length > 0 ? edgeRight.attr('data-id') : null;
    // maximum 12 labels
    const color = colors[id];
    let crossLeft = '';
    let crossRight = '';
    if (idLeft) {
        const offsetTopLeft = edgeLeft.offset().top;
        const offsetLeftLeft = edgeLeft.offset().left;
        const lineHeightLeft = $('#baseFooter').offset().top - offsetTopLeft;
        crossLeft = `
        <div id="${idLeft}-v" line="${id}" data-parent-id="${idLeft}" class="cross cross-anchor cross-line" style="display: block; top: ${offsetTopLeft}px">
            <div id="${idLeft}-h" class="cross" style="border-left: 1px solid ${color}; display: block; height: ${lineHeightLeft}px; left: ${offsetLeftLeft}px;"></div>
        </div>`;
    };

    if (idRight) {
        const offsetTopRight = edgeRight.offset().top;
        const offsetLeftRight = edgeRight.offset().left + edgeRight.outerWidth();
        const lineHeighRight = $('#baseFooter').offset().top - offsetTopRight;
        crossRight = `
        <div id="${idRight}-v" line="${id}" class="cross cross-anchor cross-line" style="display: block; top: ${offsetTopRight}px">
            <div id="${idRight}-h" class="cross" style="border-left: 1px solid ${color}; display: block; height: ${lineHeighRight}px; left: ${offsetLeftRight}px;"></div>
        </div>`;
    };

    return [crossLeft, crossRight];
};

const genAllCrossInLine = (lineId = null) => {
    const cateBoxEl = lineId !== null ? `.cate-box[line=${lineId}]` : '.cate-box';
    $(`${formElements.cateTable} ${cateBoxEl}`).parent().attr('gen-all', 1);
    $(`${formElements.cateTable} ${cateBoxEl}`).each(function () {
        genSingleCross(this);
    });
};

const genSingleCross = (e) => {
    const id = Number($(e).attr('line'));

    const edgeLeft = $(e).find('.cate-edge-left');
    const edgeRight = $(e).find('.cate-edge-right');

    const [crossLeft, crossRight] = genVerticalCrossLineHtml(edgeLeft, edgeRight, id);

    $('body').append(crossLeft);
    $('body').append(crossRight);
};

const hideAllCrossAnchorInline = (lineId) => {
    if (lineId) {
        $(`${formElements.cateTable} .cate-box[line=${lineId}]`).parent().removeAttr('gen-all');
        $(`.cross[line=${lineId}]`).remove();
    } else {
        $(`${formElements.cateTable} .cate-box`).parent().removeAttr('gen-all');
        $('.cross-anchor').remove();
    }
};

const resetPositionOfCrossLine = () => {
   const anchorLabels = [...$('.cross-line[data-parent-id]')].map(el => $(el).attr('data-parent-id'));
   hideAllCrossAnchorInline();
   for (const parentId of anchorLabels) {
       handleShowAnchor($(`[data-id=${parentId}]`));
   }
};

const hideOneCross = (line, col) => {
    const id = `cate-edge-${line}-${col}`;
    $(`#${id}-right-v`).remove();
    $(`#${id}-left-v`).remove();
};

const showOneCrossAnchor = (e) => {
    const cateBox = $(e).parent();
    genSingleCross(cateBox);
};

const addDrawVerticalLineEvent = () => {

    $('.cate-box').on('click', (e) => {
        const target = e.target.closest('.cate-box');
        const [line, col] = $(target).attr('id').split('-');
        const id = `cate-edge-${line}-${col}`;
        const hasCross = $(`#${id}-right-v`).length || $(`#${id}-left-v`).length;
        if (hasCross) {
            hideOneCross(line, col);
        } else {
            genSingleCross(target);
        }
    });

    $('.cate-box').on('dblclick', (e) => {
        const target = e.target.closest('.cate-box');
        const [line, _] = $(target).attr('id').split('-');
        const hasAllCross = $(`${formElements.cateTable} .cate-box[line=${line}]`).parent().attr('gen-all');
        if (hasAllCross) {
            hideAllCrossAnchorInline(line);
        } else {
            genAllCrossInLine(line);
        }
    });

    $('.cate-box').on('contextmenu', (e) => {
        e.preventDefault();
        const cateEdge = $(e.target.closest('.cate-box')).find('.cate-edge')[0];
        const ids = cateEdge ? $(cateEdge).attr('data-id').split('-') : [];
        rightClickHandler(e, formElements.labelPlotContextMenu);

        $(formElements.labelPlotContextMenu).attr('line', ids[2]);
        $(formElements.labelPlotContextMenu).attr('col', ids[3]);
    });

    // show a vertical red line when hover to edge of category boxes
    $(`${formElements.cateTable} .cate-edge`).each(function f() {
        $(this).on('mouseover', (e) => {
            const targets = $(e.currentTarget).closest('td').find('.cate-edge');
            const index = Number($(targets).parent().attr('line')) || 0;
            for (const target of targets) {
                const edge = $(target);
                const offsetTop = edge.offset().top;
                let offsetLeft = edge.offset().left;
                let isLeft = true;
                if (edge.hasClass('cate-edge-right')) {
                    offsetLeft = edge.offset().left + edge.outerWidth();
                    isLeft = false;
                }
                const lineHeight = $('#baseFooter').offset().top - offsetTop;
                showVerticalLine(offsetTop, offsetLeft, lineHeight, isLeft, index);
            }
        });
    });
};

function showVerticalLineOnClick(clickEvent) {
    // show red vertical line on category table when user click in graph
    const offsetTop = $(celes.cateTable)[0]
        ? $(celes.cateTable).offset().top : $('#plot-cards').offset().top;
    const offsetLeft = clickEvent.native.clientX;
    const lineHeight = $(celes.cateTable).height() || 0;
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

const histHorizontalLine = (yValue, props=undefined, color = CONST.CH_OTHER) => {
    // histogram is drawing as reverse mode
    // need to get item in chart from yValue
    let values = yValue;
    if (props) {
        const catLabel = props.rank_values[yValue];
        values = props.cat_labels.indexOf(catLabel);
    }

    return {
        id: 'crosshair-y',
        type: 'line',
        mode: 'horizontal',
        scaleID: 'y',
        value: values,
        borderColor: color,
        borderWidth: 1,
        label: {
            enabled: true,
            position: 'center',
            content: yValue,
            backgroundColor: 'rgba(0,0,0,0.1)',
        },
    };
};

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
                    props = undefined;
                    if (histChartObject.data.rank_values && histChartObject.data.cat_labels) {
                        props = {
                            rank_values: histChartObject.data.rank_values || undefined,
                            cat_labels: histChartObject.data.cat_labels || undefined,
                        };
                    }
                    histChartObject.options.plugins.annotation.annotations['crosshair-y'] = histHorizontalLine(coYValue, props);
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
                props = undefined;
                if (histChartObject.data.rank_values && histChartObject.data.cat_labels) {
                    props = {
                        rank_values: histChartObject.data.rank_values || undefined,
                        cat_labels: histChartObject.data.cat_labels || undefined,
                    };
                }
                histChartObject.options.plugins.annotation.annotations['crosshair-y'] = histHorizontalLine(yValue, props, color);
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
