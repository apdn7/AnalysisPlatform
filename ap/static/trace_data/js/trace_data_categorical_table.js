/* eslint-disable */

// add border for boxes on hover
const showBorderWhenHoverCateBox = () => {
    $('.box-has-data').hover(
        function hoverIn() {
            $(this).addClass('cate-box-border');
        },
        function hoverOut() {
            $(this).removeClass('cate-box-border');
        },
    );
};

const buildCategoryBoxes = (
    cateCol,
    timeCol = null,
    uiStartTime = null,
    uiEndTime = null,
) => {
    let isIndex = false;
    if (timeCol === null) {
        isIndex = true;
        timeCol = Array.from(Array(cateCol.length), (_, i) => i + 1);
    }
    const strDtMin = uiStartTime || timeCol[0];
    const strDtMax = uiEndTime || timeCol[timeCol.length - 1];
    const firstTimeVal = timeCol[0];
    const firstTimeDt = isIndex ? firstTimeVal : new Date(firstTimeVal);
    const lastTimeVal = timeCol[timeCol.length - 1];
    const lastTimeDt = isIndex ? lastTimeVal : new Date(lastTimeVal);
    const maxDt = isIndex ? strDtMax : new Date(strDtMax);
    const minDt = isIndex ? strDtMin : new Date(strDtMin);
    const totalLen = maxDt - minDt;

    const len = cateCol.length;
    const boxes = [];
    // first box
    const firstBox = {
        boxEndPos: (firstTimeDt - minDt) / totalLen,
        boxStartPos: 0,
        cateName: '',
        count: '',
        endTime: firstTimeVal,
        startTime: strDtMin, // UI start_time
        startIndex: 0,
        endIndex: 0,
    };
    boxes.push(firstBox);

    let prevCateVal = '';
    const consecutiveAllowablePeriodPercent = 0.01; // 1% of totalLen
    for (let i = 0; i < len; i++) {
        const dtVal = isIndex ? timeCol[i] : new Date(timeCol[i]);
        const currentCateVal = cateCol[i];

        if (currentCateVal !== prevCateVal) {
            // update previous box
            if (boxes.length) {
                // update boxEndPos
                const prevBoxEndTime = boxes[boxes.length - 1].endTime;
                const endTimeObj = isIndex
                    ? prevBoxEndTime
                    : new Date(prevBoxEndTime);
                const prevBoxEndPos = (endTimeObj - minDt) / totalLen;
                boxes[boxes.length - 1].boxEndPos = prevBoxEndPos;

                // add empty/gap box
                if (boxes.length > 1) {
                    // don't need to add gap box after firstbox
                    boxes.push({
                        cateName: '',
                        count: 0,
                        startTime: prevBoxEndTime,
                        endTime: timeCol[i],
                        boxStartPos: prevBoxEndPos, // min = min time of time column.
                        boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
                        endIndex: i,
                    });
                }
            }

            // add new box: counting, fix start time, update end time, fix catename, fix boxStartPos
            boxes.push({
                cateName: currentCateVal,
                count: 1,
                startTime: timeCol[i],
                endTime: timeCol[i],
                boxStartPos: (dtVal - minDt) / totalLen, // min = min time of time column.
                boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
                startIndex: i,
                endIndex: i,
            });
        } else {
            const prevBoxEndTime = boxes[boxes.length - 1].endTime;
            const endTimeObj = isIndex
                ? prevBoxEndTime
                : new Date(prevBoxEndTime);
            const prevBoxEndPos = (endTimeObj - minDt) / totalLen;
            boxes[boxes.length - 1].boxEndPos = prevBoxEndPos;
            const currentRangePercent = (timeCol[i] - endTimeObj) / totalLen;

            // comment this code
            // In case period time is exceed allow range, break it by a empty box
            // if (currentRangePercent > consecutiveAllowablePeriodPercent) {
            //     // add empty/gap box
            //     boxes.push(
            //         {
            //             cateName: '',
            //             count: '',
            //             startTime: prevBoxEndTime,
            //             endTime: timeCol[i],
            //             boxStartPos: prevBoxEndPos, // min = min time of time column.
            //             boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
            //             endIndex: i,
            //         },
            //     );
            //
            //     // add next box
            //     boxes.push(
            //         {
            //             cateName: currentCateVal,
            //             count: 0,
            //             startTime: timeCol[i],
            //             boxStartPos: (dtVal - minDt) / totalLen, // min = min time of time column.
            //             boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
            //             startIndex: i,
            //         },
            //     );
            // }

            // in the same box: counting, update endTime,
            boxes[boxes.length - 1].count += 1;
            boxes[boxes.length - 1].endTime = timeCol[i];
            boxes[boxes.length - 1].endIndex = i;
        }
        // update prevCateVal
        prevCateVal = currentCateVal;
    }
    // update boxEndPos of the last box
    const endTimeObj = isIndex
        ? boxes[boxes.length - 1].endTime
        : new Date(boxes[boxes.length - 1].endTime);
    boxes[boxes.length - 1].boxEndPos = (endTimeObj - minDt) / totalLen;

    // last box
    const lastBox = {
        boxEndPos: 1,
        boxStartPos: (lastTimeDt - minDt) / totalLen,
        cateName: '',
        count: '',
        endTime: strDtMax,
        startTime: lastTimeVal,
        startIndex: timeCol.length - 1,
        endIndex: timeCol.length - 1,
    };
    boxes.push(lastBox);

    return boxes;
};

// // combine consecutive small boxes together
const combineEmptyBoxes = (boxes) => {
    let isNarrowBoxCombined = false;
    const numBox = boxes.length;
    const combinedBoxes = [];
    let previousIsEmpty = false;
    for (let i = 0; i < numBox; i++) {
        // clean small box -> treat as empty box
        if (boxes[i].boxEndPos - boxes[i].boxStartPos <= 0.002) {
            boxes[i].count = '';
            boxes[i].cateName = '';
        }

        if (boxes[i].count > 0) {
            // a box has data (count > 0)
            combinedBoxes.push(boxes[i]);

            // mark this box as previous non-empty box
            previousIsEmpty = false;
        } else {
            // an empty box
            if (previousIsEmpty) {
                // append to previous box
                const lastIdx = combinedBoxes.length - 1;
                combinedBoxes[lastIdx].boxEndPos = boxes[i].boxEndPos;
                combinedBoxes[lastIdx].endTime = boxes[i].endTime;
                isNarrowBoxCombined = true;
            } else {
                // add new empty box
                combinedBoxes.push(boxes[i]);
            }
            // mark this box as previous empty box
            previousIsEmpty = true;
        }
    }
    return { combinedBoxes, isNarrowBoxCombined };
};

const combineSmallBoxes = (boxes) => {
    let isNarrowBoxCombined = false;
    const numBox = boxes.length;
    const combinedBoxes = [];
    let previousIsSmall = false;
    for (let i = 0; i < numBox; i++) {
        const count = parseInt(boxes[i].count || 0);

        if (boxes[i].boxEndPos - boxes[i].boxStartPos > 0.002 && count > 0) {
            // a big box has data
            combinedBoxes.push(boxes[i]);

            // mark this box as previous non-empty box
            previousIsSmall = false;
        } else {
            // an empty box or small box
            if (previousIsSmall && i < numBox - 1) {
                // previous is small + current is small -> merge
                const lastIdx = combinedBoxes.length - 1;
                combinedBoxes[lastIdx].boxEndPos = boxes[i].boxEndPos;
                combinedBoxes[lastIdx].endTime = boxes[i].endTime;
                combinedBoxes[lastIdx].endIndex = boxes[i].endIndex;
                combinedBoxes[lastIdx].count =
                    parseInt(combinedBoxes[lastIdx].count || 0) + count;
                // combinedBoxes[lastIdx].cateName += `.${boxes[i].cateName}`;  // TODO display name
                combinedBoxes[lastIdx].isGroup = true;
                isNarrowBoxCombined = true;
            } else {
                // add new small box
                combinedBoxes.push(boxes[i]);
            }
            // mark this box as previous small box
            if (count > 0) {
                previousIsSmall = true;
            }
        }
    }
    return { combinedBoxes, isNarrowBoxCombined };
};

const createCateTableHTML = (
    cateBoxes,
    cateId,
    thinDataGroupCounts,
    indexOrderColumns,
    isThinData,
    xAxisOption,
) => {
    let tds = '';
    if (cateBoxes === null) {
        tds = `<td id="cate-${cateId}" style="width: 100%;" class="cate-td  keyboard-movement">
                <div id="${cateId}" line="${cateId}" class="cate-box">
                    <span class="cate-value">${i18n.overUniqueLimitLabel}
                        <span class="cate-tooltip">
                        ${i18n.overUniqueLimitWarning}<br>
                        ${i18n.overUniqueLimitRequest}
                        </span>
                    </span>
                </div>
            </td>`;
    }
    for (const idx in cateBoxes || []) {
        const cateBoxIdx = `cate-edge-${cateId}-${idx}`;
        const box = cateBoxes[idx];
        let widthPercent = box.boxEndPos - box.boxStartPos;
        if (idx === '0') {
            widthPercent = Number(box.boxEndPos - box.boxStartPos).toFixed(5);
        }

        let td = `<td class="cate-td box-no-data keyboard-movement" style="width: ${widthPercent * 100}%;">${box.cateName}</td>`;

        let leftEdge = '';
        let rightEdge = '';
        if (widthPercent > 0.01) {
            leftEdge = `<span data-id="${cateBoxIdx}-left" class="cate-edge cate-edge-left">&nbsp;</span>`;
            rightEdge = `<span data-id="${cateBoxIdx}-right" class="cate-edge cate-edge-right">&nbsp;</span>`;
        }

        if (box.count >= 0) {
            let colorClass = box.count > 0 ? 'box-has-data' : 'box-no-data'; // has data -> blue
            let showLabelBox = box.cateName;
            let showLabelTooltip = box.cateName;

            // // null case (no data for a period of time)
            // if (box.cateName == null){
            //     colorClass = 'box-no-data';
            //     showLabelTooltip = '';
            //     showLabelBox = '';
            // }

            // NA case (have data but it is unknown/undefined data)
            if (
                (box.cateName === '' || box.cateName === null) &&
                box.count > 0
            ) {
                colorClass = 'box-is-na';
                showLabelTooltip = COMMON_CONSTANT.NA;
                showLabelBox = COMMON_CONSTANT.NA;
            }

            // combined small boxes case
            if (box.isGroup) {
                colorClass = 'box-is-group';
                showLabelTooltip = i18n.cannotBeDisplayed;
                showLabelBox = '';
                widthPercent =
                    widthPercent > 0.01 ? widthPercent : widthPercent * 0.85;
            }

            let hoverStr = `${i18n.value}: ${showLabelTooltip}<br>`;
            let dataCount = 0;
            if (isThinData) {
                dataCount = thinDataGroupCounts
                    .slice(box.startIndex, box.endIndex + 1)
                    .reduce((a, b) => a + b, 0);
            } else {
                dataCount = box.count;
            }
            hoverStr += `${i18n.count}: ${dataCount}<br>`;

            if (xAxisOption === 'INDEX') {
                for (const dicOrder of indexOrderColumns) {
                    let val = [];
                    for (const aggKey of ['min', 'max', 'value']) {
                        if (dicOrder[aggKey]) {
                            // val.concat(dicOrder[aggKey].slice(box.startIndex, box.endIndex + 1));
                            val = [
                                ...val,
                                ...dicOrder[aggKey].slice(
                                    box.startIndex,
                                    box.endIndex + 1,
                                ),
                            ];
                        }
                    }
                    // console.log(val);
                    const [minVal, maxVal] = findMinMax(val);
                    hoverStr += `<br>${dicOrder['name']}:<br>`;
                    hoverStr += `${i18n.minVal}: ${checkTrue(minVal) ? minVal : COMMON_CONSTANT.NA}<br>`;
                    hoverStr += `${i18n.maxVal}: ${checkTrue(maxVal) ? maxVal : COMMON_CONSTANT.NA}<br>`;
                }
            } else {
                hoverStr += `${i18n.startTime}: ${new Date(box.startTime).toLocaleString()}<br>
                             ${i18n.endTime}: ${new Date(box.endTime).toLocaleString()}<br>`;
            }

            const boxInfo =
                box.count > 0
                    ? `<span class="cate-value">${showLabelBox} <span class="cate-tooltip"> ${hoverStr} </span> </span>`
                    : '';
            td = `<td style="width: ${widthPercent * 100}%;" class="cate-td ${colorClass} keyboard-movement">
                <div id="${cateId}-${idx}" line="${cateId}" col="${idx}" class="cate-box">
                    ${leftEdge}
                    ${boxInfo}
                    ${rightEdge}
                </div>
            </td>`;
        }
        tds = tds.concat(td);
    }
    const cateTableHTML = `<table cellspacing="0">
        <tr>${tds}</tr>
    </table>`;
    return cateTableHTML;
};

const pinCategoryTable = () => {
    // add graph-navi class back for all carts.
    resetIntabJumping();

    resetCateogryTablePosition();
    $(formElements.cateCard).toggleClass('pinned');
    $(formElements.cateCard).find('.btn-anchor').toggleClass('pin');

    scrollCategoryTable.load($(formElements.cateCard));
};

const createCateCard = (
    cateNameHTMLs,
    tableHTMLs,
    width,
    cols = {},
    traceDat = {},
) => {
    const tblWidthCSS = width ? `width: ${width}px;` : '';
    // tableHTMLs.length = 1;
    const cardHtml = `<div class="row chart-row " id="cateArea" style="margin: 0 auto;">
        ${
            tableHTMLs.length > 0
                ? `<div class="card shadow-sm cate-card mb-2">
            <div class="card-body p-2">
                 ${createAnchorHTML()}
                <div class="row pt-3" style="margin-bottom: 0.5rem;">
                    <div class="summary-col label-plot-summary-col">
                    </div>
                    <div class="col-sm-12 ts-col no-padding">
                        <div class="row" style="justify-content: space-evenly;">
                            <div class="col-sm-${cols.timeSeries} no-padding">
                                <div id="cateTable" style="${tblWidthCSS}">
                                    ${tableHTMLs.join('')}
                                </div>
                            </div>
                            <div class="col-sm-${cols.histogram + cols.scatterPlot} pl-3 pr-0">
                                <div id="cateTableLabel" style="">
                                    ${cateNameHTMLs.join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`
                : ''
        }
    </div>`;
    return cardHtml;
};

const createAnchorHTML = () => {
    return `
            <span class="btn-anchor position-absolute"
                data-pinned="false"
                onclick="pinCategoryTable();"><i class="fas fa-anchor"></i>
            </span>
        `;
};

const resetCateogryTablePosition = () => {
    $(formElements.cateCard).removeClass('cate-fixed');
    $(formElements.cateCard).removeClass('absolute').removeAttr('style');
};

// to check if div is resizing
let isDivResizing = false;

// adjust category table to be aligned with TS chart
const getFirstTSChartId = () => {
    const firstChartId =
        $('#plot-cards')
            .find('canvas[chart-type="timeSeries"]')
            .first()
            .attr('id') || 'chart01';
    return `#${firstChartId}`;
};

const getFirstHistChartId = () => {
    const firstChartId =
        $('#plot-cards')
            .find('canvas[chart-type="histogram"]')
            .first()
            .attr('id') || 'hist01';
    return `#${firstChartId}`;
};

const getChartErea = (canvasId) => {
    for (const idx in Chart.instances) {
        const chart = Chart.instances[idx];
        if (canvasId === `#${chart.canvas.id}`) {
            return chart.chartArea;
        }
    }
    return Object.values(Chart.instances)[0].chartArea;
};

const adjustCatetoryTableLength = () => {
    if (isDivResizing) {
        isDivResizing = false;
    }
    try {
        const cateTableContainer = $(formElements.cateTable);
        const firstTSChartId = getFirstTSChartId();
        if (isEmpty(firstTSChartId)) {
            cateTableContainer.css('width', '100%');
            $(`${formElements.cateTable} table`).each(function f() {
                $(this).css('width', '100%');
            });
            return;
        }
        const firstTSChart = $(getFirstTSChartId());

        // set catetable position
        const chartArea = getChartErea(firstTSChartId);
        const tableWidth1 = chartArea.right - chartArea.left + 2; // 2 is border width of two sides
        const zoomRate = Math.min(
            1,
            Math.round(window.devicePixelRatio * 100) / 100,
        );
        const adjust = Math.abs((1 - zoomRate) * 12);
        const chartOffsetLeft = firstTSChart.offset().left;
        const cateTblOffsetLeft = chartOffsetLeft + chartArea.left - 1 - adjust; // -1 to reserve left border
        cateTableContainer.offset({ left: cateTblOffsetLeft });

        const canvasOffsetLeft = firstTSChart.offset().left;
        const canvasOffsetRight = canvasOffsetLeft + firstTSChart.width();
        const tableWidth2 = canvasOffsetRight - cateTblOffsetLeft;
        const tableWidth = Math.min(tableWidth1, tableWidth2);

        // set tables width
        cateTableContainer.css('width', tableWidth - adjust);
        $(`${formElements.cateTable} table`).each(function f() {
            $(this).css('width', tableWidth - adjust);
        });
    } catch (error) {
        // console.log(error);
    }
};

// observe content div, if it resizes, resize catetable.
const contentResizeHandler = () => {
    function makePinnedChartResponsive() {
        $('.pinChart').css('width', $('#cate-card').width());
    }

    function onResize() {
        if (!isDivResizing) {
            isDivResizing = true;
            setTimeout(adjustCatetoryTableLength, 500);
            setTimeout(makePinnedChartResponsive, 500);
        }
    }

    new ResizeObserver(onResize).observe(document.getElementById('content'));
};

const scrollCategoryTable = (() => {
    jQuery.expr.filters.offscreen = (el) => {
        const rect = el.getBoundingClientRect();
        return (
            rect.x + rect.width < 0 ||
            rect.y + rect.height < 0 ||
            rect.x > window.innerWidth ||
            rect.y > window.innerHeight
        );
    };
    const $window = $(window);
    let $stickies;

    const whenScrolling = () => {
        $stickies.each((i, e) => {
            const $cardParent = $(e).parents().filter('form').parent().parent();
            const $thisSticky = $(e);
            const $stickyPosition = $thisSticky.data('originalPosition');

            if (
                $stickyPosition <= $window.scrollTop() &&
                !$cardParent.is(':offscreen')
            ) {
                const $nextSticky = $stickies.eq(i + 1);
                const $nextStickyPosition =
                    $nextSticky.data('originalPosition') -
                    $thisSticky.data('originalHeight');

                $thisSticky.addClass('cate-fixed');

                if (
                    $nextSticky.length > 0 &&
                    $thisSticky.offset().top >= $nextStickyPosition
                ) {
                    $thisSticky
                        .addClass('absolute')
                        .css('top', $nextStickyPosition);
                }

                // align scrolled category table with plot-cards
                const tableLeftOffset = $(formElements.tsPlotCards).offset()
                    .left;
                const plotCardWidth = $(formElements.tsPlotCards).outerWidth();
                $thisSticky.css('left', tableLeftOffset);
                $thisSticky.css('width', plotCardWidth);
            } else {
                const $prevSticky = $stickies.eq(i - 1);

                $thisSticky.removeClass('cate-fixed');

                if (
                    $prevSticky.length > 0 &&
                    $window.scrollTop() <=
                        $thisSticky.data('originalPosition') -
                            $thisSticky.data('originalHeight')
                ) {
                    $prevSticky.removeClass('absolute').removeAttr('style');
                }
            }
        });
    };
    const load = (stickies) => {
        if (
            typeof stickies === 'object' &&
            stickies instanceof jQuery &&
            stickies.length > 0
        ) {
            let $originWH = $(document).height();
            $stickies = stickies.each((_, e) => {
                const $thisSticky = $(e).wrap('<div class="">');

                $thisSticky
                    .data('originalPosition', $thisSticky.offset().top)
                    .data('originalHeight', $thisSticky.outerHeight());
            });

            $window.off('scroll.stickies').on('scroll.stickies', () => {
                // re-calc position
                const $newWH = $(document).height();
                if ($newWH !== $originWH) {
                    $stickies = stickies.each((_, e) => {
                        $(e).data('originalPosition', $(e).offset().top);
                    });
                    $originWH = $newWH;
                }
                // console.log($(stickies).hasClass('pinned'));
                if ($(stickies).hasClass('pinned')) {
                    whenScrolling();
                }
            });
        }
    };
    return {
        load,
    };
})();

const nonNACalcuation = (cates) => {
    if (!cates || cates.length === 0) {
        return [0, 0];
    }
    const total = cates.length;
    const nonNACount = cates.filter((c) => c !== null).length;
    return [
        Number((100 * nonNACount) / (total || 1)).toFixed(2),
        nonNACount,
        total,
    ];
};

const orderCategoryWithOrderSeries = (traceData, clearOnFlyFilter) => {
    const shouldOrderByIndexList = isShowIndexInGraphArea || clearOnFlyFilter;
    if (!shouldOrderByIndexList) return traceData.filter_on_demand.category;

    const { category } = traceData.filter_on_demand;

    const { indexOrderColumns } = traceData;
    const indexOrderColID = indexOrderColumns.map((col) => col.id);
    let categoryDataAfterOrdering = [];
    const notMatchedCat = [];
    category &&
        category.forEach((cat) => {
            const idx = indexOrderColID.indexOf(cat.column_id);
            if (idx !== -1) {
                // matched
                categoryDataAfterOrdering[idx] = cat;
            } else {
                notMatchedCat.push(cat);
            }
        });
    // remove empty category data
    categoryDataAfterOrdering = categoryDataAfterOrdering.filter(
        (cat) => cat !== null,
    );
    // cat which not match in serial ordering: shoow at below of category box
    categoryDataAfterOrdering = categoryDataAfterOrdering.concat(notMatchedCat);
    return categoryDataAfterOrdering;
};

const produceCategoricalTable = (traceData, options = {}) => {
    const { category } = traceData.filter_on_demand;
    // fix x-axis with datetime range
    const startDt = traceData.COMMON[CONST.STARTDATE];
    const startTm = traceData.COMMON[CONST.STARTTIME];
    const endDt = traceData.COMMON[CONST.ENDDATE];
    const endTm = traceData.COMMON[CONST.ENDTIME];
    const fmt = 'YYYY/MM/DD HH:mm';
    const uiStartTime = new Date(
        formatDateTime(`${startDt} ${startTm}`, fmt),
    ).toISOString();
    const uiEndTime = new Date(
        formatDateTime(`${endDt} ${endTm}`, fmt),
    ).toISOString();
    const { thinDataGroupCounts, indexOrderColumns, is_thin_data } = traceData;

    // calculate categorical boxes: start/end position, count, etc
    const dicAllCateBoxes = {};
    const cateNameHTMLs = [];

    if (category) {
        cateNameHTMLs.push(`<table class="cate-table">
            <thead>
                <tr class="cate-thead">
                    <th class="process-name">${i18n.process}</th>
                    <th class="column-name">${i18n.variable}</th>
                    <th class="ratio">${i18n.nonNARatio}</th>
                </tr>
            </thead>
            <tbody>`);
    }

    let isBoxCombined = false;
    const xAxisOption = traceData.COMMON.xOption;
    category.forEach((dicCate) => {
        let boxes = null;
        if (!dicCate.isOverUniqueLimit) {
            if (xAxisOption === 'INDEX') {
                boxes = buildCategoryBoxes(dicCate.data);
            } else {
                boxes = buildCategoryBoxes(
                    dicCate.data,
                    traceData.times,
                    uiStartTime,
                    uiEndTime,
                );
            }

            // pre-process boxes code
            // const { combinedBoxes, isNarrowBoxCombined } = combineEmptyBoxes(boxes);
            const { combinedBoxes, isNarrowBoxCombined } =
                combineSmallBoxes(boxes);
            boxes = combinedBoxes;
            isBoxCombined = isNarrowBoxCombined;
        }

        // non-na count
        let nonNAPercent = 0;
        let nonNACount = 0;
        let total = 0;
        if (dicCate.summary) {
            nonNAPercent = dicCate.summary.nonNAPercentage;
            nonNACount = applySignificantDigit(dicCate.summary.nonNACounts);
            total = applySignificantDigit(dicCate.summary.nTotal);
        } else {
            [nonNAPercent, nonNACount, total] = nonNACalcuation(dicCate.data);
        }

        const boxName = `${dicCate.proc_master_name} ${dicCate.column_master_name}`;
        dicAllCateBoxes[boxName] = boxes;

        // please leave it un-aligned
        cateNameHTMLs.push(`<tr class="cate-name">
                <td title="${dicCate.proc_master_name}">
                    ${dicCate.proc_master_name}
                </td>
                <td class="show-detail" data-id="${dicCate.column_id}" title="${dicCate.column_master_name}">
                    ${dicCate.column_master_name}
                </td>
                <td title="${nonNAPercent}% (${applySignificantDigit(nonNACount)}/${applySignificantDigit(total) || '0'})">
                    ${nonNAPercent}% (${applySignificantDigit(nonNACount)}/${applySignificantDigit(total) || '0'})
                </td>
            </tr>`);
    });

    cateNameHTMLs.push(`</tbody></table>`);

    // show msg to warn about combining narrow boxes
    if (isBoxCombined) {
        setTimeout(() => {
            const msgContent = i18n.hideNarrowBox;
            showToastrMsg(msgContent);
        }, 200);
    }

    // generate a table for each categorical field
    const tblHTMLs = [];
    Object.values(dicAllCateBoxes).forEach((cateBoxes, idx) => {
        const cateHTML = createCateTableHTML(
            cateBoxes,
            idx,
            thinDataGroupCounts,
            indexOrderColumns,
            is_thin_data,
            xAxisOption,
        );
        tblHTMLs.push(cateHTML);
    });

    let tableWidth = 0;
    try {
        // get width of current Time Series chart
        const chartArea = getChartErea(getFirstTSChartId()) || {};
        tableWidth = chartArea.right - chartArea.left;
    } catch (error) {
        // console.log(error);
    }

    // create HTML card for categorical table
    const cols = options.chartCols || {
        timeSeries: 9,
        histogram: 3,
        scatterPlot: 0,
    };
    const cateCardHTML = createCateCard(
        cateNameHTMLs,
        tblHTMLs,
        tableWidth,
        cols,
        traceData,
    );

    // clear old result
    $(formElements.cateCard).empty();

    // append new result
    $(formElements.cateCard).append(cateCardHTML);

    // reset position
    resetCateogryTablePosition();

    // draw crosshair line when hovering box edges
    addDrawVerticalLineEvent();

    // add border for boxes on hover
    showBorderWhenHoverCateBox();

    contentResizeHandler();

    // 116 13 save focused box for keyboard movement
    $('#cateTable table td').on('click', (e) => {
        // TODO 116
        savedBox = e.currentTarget;
    });

    initIndexModal();

    initDuplicatedSerial();
};

const name = {
    process: 'TermSerialProcess',
    serial: 'TermSerialColumn',
    order: 'TermSerialOrder',
    xOption: 'TermXOption',
};
let xOption = '';
let selectedSerials = null;
let selectedProcess = null;
let selectedProcessSerial = null; // using to check xAxisModal2
let currentTable = null;
let currentXOption = '';
let lastSelectedOrder = [];
let oldXOption = '';
const initIndexModal = () => {
    const xOptionSwitch = $(formElements.tsXScale);

    const setDefault = () => {
        xOptionSwitch.val(currentXOption);
        oldXOption = currentXOption;
        xOptionSwitch.attr(CONST.DEFAULT_VALUE, currentXOption);
        resetCustomSelect(xOptionSwitch);
    };

    // set default checked switch
    setDefault();
    $(formElements.tsXScale).off('change');
    $(formElements.tsXScale).on('change', function () {
        const option = $(this).val();
        if (option === CONST.XOPT_TIME && oldXOption === CONST.XOPT_TIME) {
            return;
        }
        if (option === CONST.XOPT_INDEX) {
            showSerialModal(formElements.serialTableModal2);
            setSelect2Selection(formElements.serialTable2);
            bindDragNDrop(
                $(`${formElements.serialTable2} tbody`),
                formElements.serialTable2,
                name.serial,
            );
            disableUnselectedOption(selectedSerials, name.serial);
            disableUnselectedOption(selectedProcess, name.process);

            $(formElements.btnAddSerial2).unbind('click');
            $(formElements.btnAddSerial2).on('click', () => {
                addSerialOrderRow(
                    formElements.serialTable2,
                    name.process,
                    name.serial,
                    name.order,
                    null,
                    null,
                    null,
                    null,
                    true,
                ).then(() => {
                    initSelect();
                    updateCurrentSelectedProcessSerial(name.serial);
                    disableUnselectedOption(selectedSerials, name.serial);
                    disableUnselectedOption(selectedProcess, name.process);
                });
            });
        }

        if (option === CONST.XOPT_TIME) {
            xOption = CONST.XOPT_TIME;
            currentXOption = xOption;
            oldXOption = xOption;
            handleSubmit(false);
        }
    });

    $(formElements.cancelOrderIndexModal).unbind('click');
    $(formElements.cancelOrderIndexModal).on('click', function () {
        setDefault();
        renderTableContent();
        if (currentXOption === CONST.XOPT_TIME) {
            $(formElements.tsXScale).val(currentXOption);
            resetCustomSelect($(formElements.tsXScale));
        }
    });

    $(formElements.okOrderIndexModal).unbind('click');
    $(formElements.okOrderIndexModal).on('click', () => {
        getLastedSelectedValue(
            formElements.serialTable2,
            name.process,
            name.serial,
            name.order,
        );
        xOption = CONST.XOPT_INDEX;
        currentXOption = xOption;
        // reset xAxisShowSettings
        xAxisShowSettings = null;
        isShowIndexInGraphArea = true;
        oldXOption = xOption;
        handleSubmit(false);
    });
};

function disableUnselectedOption(selectedSerials, serialName) {
    if (!selectedSerials) return;
    const serialSelects = $(`select[name=${serialName}]`);
    const procData = getProcessColSelected();

    serialSelects.each(function () {
        const selectElement = $(this);
        const options = [...selectElement.find('option')];
        const optionSelected = selectElement.val();

        for (const opt of options) {
            const option = $(opt);
            const val = option.val();
            const isGetDate = option.attr('data-is-get-date') === 'true';
            const isSerialNo = option.attr('data-is-serial-no') === 'true';
            const procColId = option.attr('data-selected-proc-id');
            const serialColDataId = option.val();
            const currentOption = `${procColId}-${serialColDataId}`;

            if (!selectedSerials.has(val)) {
                if ((isGetDate || isSerialNo) && procData.includes(procColId)) {
                    option.attr(
                        'disabled',
                        selectedProcessSerial &&
                            selectedProcessSerial.has(currentOption),
                    );
                } else {
                    option.attr('disabled', true);
                }
            } else if (procData.includes(procColId) && optionSelected !== val) {
                option.attr(
                    'disabled',
                    selectedProcessSerial &&
                        selectedProcessSerial.has(currentOption),
                );
            } else {
                option.attr('disabled', false);
            }
        }
    });
}

function initSelect() {
    bindChangeProcessEvent(
        formElements.serialTable2,
        name.process,
        name.serial,
        () => {
            disableUnselectedOption(selectedSerials, name.serial);
            disableUnselectedOption(selectedProcess, name.process);
        },
    );
    updatePriorityAndDisableSelected(formElements.serialTable2, name.serial);

    setTimeout(() => {
        // wait select2 to be shown
        bindChangeOrderColEvent(
            formElements.serialTable2,
            name.serial,
            () => {},
        );
    }, 200);
}

function getLastedSelectedValue(tableID, procName, columnName, orderName) {
    lastSelectedOrder = [];
    const mainTableBody = $(`${tableID} tbody tr`);

    mainTableBody.each((e, el) => {
        const proc = $(el).find(`[name="${procName}"]`).val() | '';
        const column = $(el).find(`[name="${columnName}"]`).val() | '';
        const order = $(el).find(`[name="${orderName}"]`).val() | '';
        lastSelectedOrder.push({
            serialProcess: proc,
            serialColumn: column,
            serialOrder: order,
        });
    });

    latestIndexOrder = [...lastSelectedOrder];
}

function renderTableContent() {
    $(`${formElements.serialTable2} tbody`).html('');
    // get start proc
    const startProc = getFirstSelectedProc();
    // get serial
    const procInfo = procConfigs[startProc];

    const hasAvailableOrderColumn =
        availableOrderingSettings[startProc] &&
        availableOrderingSettings[startProc].length > 0;

    const noTableRow = lastSelectedOrder.length <= 0;
    const isShowDefaultRow = hasAvailableOrderColumn && noTableRow;
    if (isShowDefaultRow) {
        addSerialOrderRow(
            formElements.serialTable2,
            name.process,
            name.serial,
            name.order,
            startProc,
            // sort availableOrderingSettings from min to max
            availableOrderingSettings[startProc][0],
            null,
            null,
            true,
        );
    } else {
        lastSelectedOrder.forEach((row, i) => {
            addSerialOrderRow(
                formElements.serialTable2,
                name.process,
                name.serial,
                name.order,
                row.serialProcess,
                row.serialColumn,
                row.serialOrder,
                null,
                true,
            );
        });
    }
    setTimeout(() => {
        selectedSerials = getSelectedOrderCols();
        selectedProcess = getSelectedOrderCols(
            formElements.serialTable,
            'serialProcess',
        );
        const availableProcess = new Set(
            Object.keys(availableOrderingSettings),
        );
        let availableSerials = [];
        Object.values(availableOrderingSettings).forEach((cols) =>
            availableSerials.push(...cols),
        );
        availableSerials = availableSerials.map((colID) => String(colID));
        selectedSerials = new Set([...selectedSerials, ...availableSerials]);
        selectedProcess = new Set([...selectedProcess, ...availableProcess]);
        // disableUnselectedOption(selectedSerials, name.serial);
        // disableUnselectedOption(selectedProcess, name.process);
        initSelect();
    }, 2000);
}

function initTableValue() {
    currentXOption = lastUsedFormData.get('xOption');
    if (currentXOption === CONST.XOPT_INDEX) {
        getLastedSelectedValue(
            formElements.serialTable,
            'serialProcess',
            'serialColumn',
            'serialOrder',
        );
    }

    if (
        isSaveGraphSetting() &&
        hasIndexOrderInGraphSetting(getGraphSettings())
    ) {
        const indexOrder = getIndexOrder();
        if (indexOrder.length > 0) {
            lastSelectedOrder = indexOrder;
            latestIndexOrder = lastSelectedOrder;
        }
    }
    renderTableContent();
}

function transformIndexOrderParams(formData) {
    if (xOption === CONST.XOPT_INDEX) {
        removeUnusedFormParams(formData);
        const latestFormData = collectFormData(formElements.formID);
        for (const item of latestFormData.entries()) {
            const key = item[0];
            const value = item[1];
            if (key === name.process) {
                formData.append(name.process, value);
            }
            if (key === name.serial) {
                formData.append(name.serial, value);
            }
            if (key === name.order) {
                formData.append(name.order, value);
            }
        }
    } else {
        formData = removeUnusedFormParams(formData);
    }
    formData.set('TermXOption', xOption);

    return formData;
}

function removeUnusedFormParams(formData, clearOnFlyFilter = false) {
    formData.delete(name.process);
    formData.delete(name.serial);
    formData.delete(name.order);

    if (clearOnFlyFilter) {
        if (formData.get('xOption') === CONST.XOPT_TIME) {
            formData.delete('serialProcess');
            formData.delete('serialColumn');
            formData.delete('serialOrder');
        }
    }

    return formData;
}

const bindGraphScaleEvent = () => {
    $('select[name=tsScaleY]').change(function f() {
        const scaleOption = $(this).children('option:selected').val() || '1';
        updateGraphScale(scaleOption);
    });
};

const initDuplicatedSerial = () => {
    const key = 'duplicated_serial';
    // set default value to duplicated serial
    $(formElements.duplicatedSerial).val(lastUsedFormData.get(key));

    // onchange
    $(formElements.duplicatedSerial).on('change', function (e) {
        const val = e.currentTarget.value;
        lastUsedFormData.set(key, val);
        handleSubmit(false);
    });
};
