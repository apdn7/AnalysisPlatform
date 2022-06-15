/* eslint-disable */
/* eslint-disable no-restricted-syntax */

// add border for boxes on hover
const showBorderWhenHoverCateBox = () => {
    $('.box-has-data').hover(
        function hoverIn() {
            $(this).addClass('cate-box-border');
        }, function hoverOut() {
            $(this).removeClass('cate-box-border');
        },
    );
};


const buildCategoryBoxes = (cateCol, timeCol = null, uiStartTime = null, uiEndTime = null) => {
    let isIndex = false;
    if (timeCol === null) {
        isIndex = true;
        timeCol = Array.from(Array(cateCol.length), (_, i) => i + 1)
    }
    const strDtMin = uiStartTime || timeCol[0];
    const strDtMax = uiEndTime || timeCol[timeCol.length - 1];
    const firstTimeVal = timeCol[0];
    const firstTimeDt = isIndex ? firstTimeVal : new Date(firstTimeVal)
    const lastTimeVal = timeCol[timeCol.length - 1];
    const lastTimeDt = isIndex ? lastTimeVal : new Date(lastTimeVal)
    const maxDt = isIndex ? strDtMax : new Date(strDtMax);
    const minDt = isIndex ? strDtMin : new Date(strDtMin);
    const totalLen = (maxDt - minDt);

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
                const endTimeObj = isIndex ? prevBoxEndTime : new Date(prevBoxEndTime);
                const prevBoxEndPos = (endTimeObj - minDt) / totalLen;
                boxes[boxes.length - 1].boxEndPos = prevBoxEndPos;

                // add empty/gap box
                if (boxes.length > 1) { // don't need to add gap box after firstbox
                    boxes.push(
                        {
                            cateName: '',
                            count: 0,
                            startTime: prevBoxEndTime,
                            endTime: timeCol[i],
                            boxStartPos: prevBoxEndPos, // min = min time of time column.
                            boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
                            endIndex: i,
                        },
                    );
                }
            }

            // add new box: counting, fix start time, update end time, fix catename, fix boxStartPos
            boxes.push(
                {
                    cateName: currentCateVal,
                    count: 1,
                    startTime: timeCol[i],
                    endTime: timeCol[i],
                    boxStartPos: (dtVal - minDt) / totalLen, // min = min time of time column.
                    boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
                    startIndex: i,
                    endIndex: i,
                },
            );
        } else {
            const prevBoxEndTime = boxes[boxes.length - 1].endTime;
            const endTimeObj = isIndex ? prevBoxEndTime : new Date(prevBoxEndTime);
            const prevBoxEndPos = (endTimeObj - minDt) / totalLen;
            boxes[boxes.length - 1].boxEndPos = prevBoxEndPos;
            const currentRangePercent = (timeCol[i] - endTimeObj) / totalLen;

            // In case period time is exceed allow range, break it by a empty box
            if (currentRangePercent > consecutiveAllowablePeriodPercent) {
                // add empty/gap box
                boxes.push(
                    {
                        cateName: '',
                        count: '',
                        startTime: prevBoxEndTime,
                        endTime: timeCol[i],
                        boxStartPos: prevBoxEndPos, // min = min time of time column.
                        boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
                        endIndex: i,
                    },
                );

                // add next box
                boxes.push(
                    {
                        cateName: currentCateVal,
                        count: 0,
                        startTime: timeCol[i],
                        boxStartPos: (dtVal - minDt) / totalLen, // min = min time of time column.
                        boxEndPos: (dtVal - minDt) / totalLen, // or just leave it empty
                        startIndex: i,
                    },
                );
            }

            // in the same box: counting, update endTime,
            boxes[boxes.length - 1].count += 1;
            boxes[boxes.length - 1].endTime = timeCol[i];
            boxes[boxes.length - 1].endIndex = i;
        }
        // update prevCateVal
        prevCateVal = currentCateVal;
    }
    // update boxEndPos of the last box
    const endTimeObj = isIndex ? boxes[boxes.length - 1].endTime : new Date(boxes[boxes.length - 1].endTime);
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

        if (boxes[i].count > 0) { // a box has data (count > 0)
            combinedBoxes.push(boxes[i]);

            // mark this box as previous non-empty box
            previousIsEmpty = false;
        } else { // an empty box
            if (previousIsEmpty) { // append to previous box
                const lastIdx = combinedBoxes.length - 1;
                combinedBoxes[lastIdx].boxEndPos = boxes[i].boxEndPos;
                combinedBoxes[lastIdx].endTime = boxes[i].endTime;
                isNarrowBoxCombined = true;
            } else { // add new empty box
                combinedBoxes.push(boxes[i]);
            }
            // mark this box as previous empty box
            previousIsEmpty = true;
        }
    }
    return {combinedBoxes, isNarrowBoxCombined};
};

const combineSmallBoxes = (boxes) => {
    let isNarrowBoxCombined = false;
    const numBox = boxes.length;
    const combinedBoxes = [];
    let previousIsSmall = false;
    for (let i = 0; i < numBox; i++) {
        const count = parseInt(boxes[i].count || 0);

        if (boxes[i].boxEndPos - boxes[i].boxStartPos > 0.002 && count > 0) { // a big box has data
            combinedBoxes.push(boxes[i]);

            // mark this box as previous non-empty box
            previousIsSmall = false;
        } else { // an empty box or small box
            if (previousIsSmall && i < numBox - 1) { // previous is small + current is small -> merge
                const lastIdx = combinedBoxes.length - 1;
                combinedBoxes[lastIdx].boxEndPos = boxes[i].boxEndPos;
                combinedBoxes[lastIdx].endTime = boxes[i].endTime;
                combinedBoxes[lastIdx].endIndex = boxes[i].endIndex;
                combinedBoxes[lastIdx].count = parseInt(combinedBoxes[lastIdx].count || 0) + count;
                // combinedBoxes[lastIdx].cateName += `.${boxes[i].cateName}`;  // TODO display name
                combinedBoxes[lastIdx].isGroup = true;
                isNarrowBoxCombined = true;
            } else { // add new small box
                combinedBoxes.push(boxes[i]);
            }
            // mark this box as previous small box
            if (count > 0) {
                previousIsSmall = true;
            }
        }
    }
    return {combinedBoxes, isNarrowBoxCombined};
};


const createCateTableHTML = (cateBoxes, thinDataGroupCounts, indexOrderColumns, isThinData, xAxisOption) => {
    let tds = '';
    if (cateBoxes === null) {
        tds = `<td style="width: 100%;" class="cate-td  keyboard-movement">
                <div class="cate-box">
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
        const box = cateBoxes[idx];
        let widthPercent = box.boxEndPos - box.boxStartPos;
        if (idx === '0') {
            widthPercent = Number(box.boxEndPos - box.boxStartPos).toFixed(5);
        }

        let td = `<td class="cate-td box-no-data" style="width: ${widthPercent * 100}%;">${box.cateName}</td>`;

        let leftEdge = '';
        let rightEdge = '';
        if (widthPercent > 0.01) {
            leftEdge = '<span class="cate-edge cate-edge-left">&nbsp;</span>';
            rightEdge = '<span class="cate-edge cate-edge-right">&nbsp;</span>';
        }

        if (box.count > 0) {
            let colorClass = 'box-has-data'; // has data -> blue
            let showLabelBox = box.cateName;
            let showLabelTooltip = box.cateName;

            // // null case (no data for a period of time)
            // if (box.cateName == null){
            //     colorClass = 'box-no-data';
            //     showLabelTooltip = '';
            //     showLabelBox = '';
            // }

            // NA case (have data but it is unknown/undefined data)
            if (box.cateName === '' || box.cateName === null) {
                colorClass = 'box-is-na';
                showLabelTooltip = COMMON_CONSTANT.NA;
                showLabelBox = COMMON_CONSTANT.NA;
            }

            // combined small boxes case
            if (box.isGroup) {
                colorClass = 'box-is-group';
                showLabelTooltip = i18n.cannotBeDisplayed;
                showLabelBox = '';
                widthPercent = widthPercent > 0.01 ? widthPercent : widthPercent * 0.85;
            }


            let hoverStr = `${i18n.value}: ${showLabelTooltip}<br>`;
            let dataCount = 0;
            if (isThinData) {
                dataCount = thinDataGroupCounts.slice(box.startIndex, box.endIndex + 1).reduce((a, b) => a + b, 0);
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
                            val = [...val, ...dicOrder[aggKey].slice(box.startIndex, box.endIndex + 1)];
                        }
                    }
                    // console.log(val);
                    const [minVal, maxVal] = findMinMax(val);
                    hoverStr += `<br>${dicOrder['name']}:<br>`;
                    hoverStr += `${i18n.minVal}: ${minVal}<br>`;
                    hoverStr += `${i18n.maxVal}: ${maxVal}<br>`;
                }

            } else {
                hoverStr += `${i18n.startTime}: ${new Date(box.startTime).toLocaleString()}<br>
                             ${i18n.endTime}: ${new Date(box.endTime).toLocaleString()}<br>`;
            }


            td = `<td style="width: ${widthPercent * 100}%;" class="cate-td ${colorClass} keyboard-movement">
                <div class="cate-box">
                    ${leftEdge}
                    <span class="cate-value">${showLabelBox} <span class="cate-tooltip"> ${hoverStr} </span> </span>
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


const buildSummarySelectMenuHTML = () => `
    <div class="summary-menu ml-2">
        <button id="summarySelectBtn" class="btn border-white btn-sm">...</button>
        <div class="summary-menu-content">
            <div class="form-check">
                <label class="form-check-label" for="radio1">
                    <input class="form-check-input" id="radio1" type="radio" name="summaryOption" value="none" checked>
                    <span>${i18nCommon.none || '非表示'}</span>
                </label>
            </div>
            <div class="form-check">
                <label class="form-check-label" for="radio3">
                    <input class="form-check-input" id="radio3" type="radio" name="summaryOption" value="count">
                    <span>${i18nCommon.sCount || '数え上げ'}</span>
                </label>
            </div>
            <div class="form-check">
                <label class="form-check-label" for="radio4">
                    <input class="form-check-input" id="radio4" type="radio" name="summaryOption" value="basic-statistics">
                    <span>${i18nCommon.basicStatistics || '基本統計量'}</span>
                </label>
            </div>
            <div class="form-check">
                <label class="form-check-label" for="radio5">
                    <input class="form-check-input" id="radio5" type="radio" name="summaryOption" value="non-parametric">
                    <span>${i18nCommon.nonParametric || 'ノンパラメトリック'}</span>
                </label>
            </div>
        </div>
    </div>`;

const pinCategoryTable = () => {
    // add graph-navi class back for all carts.
    resetIntabJumping();

    resetCateogryTablePosition();
    $(formElements.cateCard).toggleClass('pinned');
    $(formElements.cateCard).find('.btn-anchor').toggleClass('pin');

    scrollCategoryTable.load($(formElements.cateCard));
};

const getIndexOptDOM = (traceDat) => {
    let indexOpt = `<tr><td colspan="2"><label class="setting-label"><span class="hint-text">インデックス</span></label></td></tr>`;
    // let indexOpt = `<div class="setting-item">
    //     <label class="setting-label"><span class="hint-text">インデックス</span></label>`;

    const serialProc = traceDat[CONST.COMMON].serialProcess;
    const serialCol = traceDat[CONST.COMMON].serialColumn;

    const serialProcList = Array.isArray(serialProc) ? serialProc : [serialProc];
    const serialColList = Array.isArray(serialCol) ? serialCol : [serialCol];
    serialProcList.forEach((serial, k) => {
        const procID = Number(serial);
        const procName = procConfigs[procID] ? procConfigs[procID].name : '';
        let indexColName = '';
        if (procConfigs[procID]) {
            const indexCol = procConfigs[procID].getColumnById(serialColList[k]);
            indexColName = indexCol ? indexCol.name : '';
        }
        indexOpt += `<tr>
            <td>${procName}</td>
            <td>${indexColName}</td>
        </tr>`;
    });

    return indexOpt;

};
const getSettingInformHTML = (traceDat) => {
    const body = genInfoTableBody(traceDat);
    let settingDOM = '';
    settingDOM += `<div id="sim" class="setting-inform-modal show-filter-info">
                        <div class="setting-inform border-white" style="margin-left: 0">
                            <span><i class="fas fa-info-circle"></i></span>
                        </div>
                        <div id="settingHoverContent" class="setting-inform-content show-filter-info">
                            <button class="btn clipboard" style="float:right;"
                                data-clipboard-target="#setting-infor-table" title="Copy to Clipboard">
                                <i class="fa fa-copy" aria-hidden="true"></i>
                            </button>
                            <div class="setting-content">
                                <table class="table table-borderless" id="setting-infor-table">
                                    ${body}
                                </table>
                            </div>
                        </div>
                    </div>`;
    return settingDOM;
};

const createCateCard = (cateNameHTMLs, tableHTMLs, width, cols = {}, traceDat = {}) => {
    const summaryMenuHTML = buildSummarySelectMenuHTML();
    const settingInformHTML = getSettingInformHTML(traceDat);
    const tblWidthCSS = width ? `width: ${width}px;` : '';
    const cardHtml = `<div class="row chart-row " id="cateArea" style="margin: 0 auto;">
        <div class="position-relative" style="width: 100%">
            <div class="d-flex align-items-center position-absolute" style="top: -40px">
                 ${settingInformHTML}
                 ${summaryMenuHTML}
                 <div class="d-flex">
                     ${renderYScaleDropdownHTML('tsScaleY', 'ml-4')}
                     ${renderSwitchButton('indexOrderSwitch', 1, `X: ${i18n.index}`, '', 'ml-4')}
                 </div>
            </div>
        </div>
        ${tableHTMLs.length > 0 ? 
        `<div class="card shadow-sm cate-card chart-margin">
            <div class="card-body p-2">
                 ${createAnchorHTML()}
                <div class="row pt-3" style="margin-bottom: 0.5rem;">
                    <div class="summary-col">
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
        </div>` : '' }
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
}

const resetCateogryTablePosition = () => {
    $(formElements.cateCard).removeClass('cate-fixed');
    $(formElements.cateCard).removeClass('absolute').removeAttr('style');
};

// to check if div is resizing
let isDivResizing = false;

// adjust category table to be aligned with TS chart
const getFirstTSChartId = () => {
    const firstChartId = $('#plot-cards').find('canvas[chart-type="timeSeries"]').first().attr('id') || 'chart01';
    return `#${firstChartId}`;
}

const getFirstHistChartId = () => {
    const firstChartId = $('#plot-cards').find('canvas[chart-type="histogram"]').first().attr('id') || 'hist01';
    return `#${firstChartId}`;
}

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
        const zoomRate = Math.min(1, Math.round(window.devicePixelRatio * 100) / 100);
        const adjust = Math.abs((1 - zoomRate) * 12);
        const chartOffsetLeft = firstTSChart.offset().left;
        const cateTblOffsetLeft = chartOffsetLeft + chartArea.left - 1 - adjust; // -1 to reserve left border
        cateTableContainer.offset({left: cateTblOffsetLeft});

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

    new ResizeObserver(onResize)
        .observe(document.getElementById('content'));
};


// eslint-disable-next-line no-unused-vars
const scrollCategoryTable = (() => {
    jQuery.expr.filters.offscreen = (el) => {
        const rect = el.getBoundingClientRect();
        return (
            (rect.x + rect.width) < 0
            || (rect.y + rect.height) < 0
            || (rect.x > window.innerWidth || rect.y > window.innerHeight)
        );
    };
    const $window = $(window);
    let $stickies;

    const whenScrolling = () => {
        $stickies.each((i, e) => {
            const $cardParent = $(e).parents().filter('form')
                .parent()
                .parent();
            const $thisSticky = $(e);
            const $stickyPosition = $thisSticky.data('originalPosition');

            if ($stickyPosition <= $window.scrollTop() && !$cardParent.is(':offscreen')) {
                const $nextSticky = $stickies.eq(i + 1);
                const $nextStickyPosition = $nextSticky.data('originalPosition') - $thisSticky.data('originalHeight');

                $thisSticky.addClass('cate-fixed');

                if ($nextSticky.length > 0 && $thisSticky.offset().top >= $nextStickyPosition) {
                    $thisSticky.addClass('absolute').css('top', $nextStickyPosition);
                }

                // align scrolled category table with plot-cards
                const tableLeftOffset = $(formElements.tsPlotCards).offset().left;
                const plotCardWidth = $(formElements.tsPlotCards).outerWidth();
                $thisSticky.css('left', tableLeftOffset);
                $thisSticky.css('width', plotCardWidth);
            } else {
                const $prevSticky = $stickies.eq(i - 1);

                $thisSticky.removeClass('cate-fixed');

                if ($prevSticky.length > 0
                    && $window.scrollTop() <= $thisSticky.data('originalPosition') - $thisSticky.data('originalHeight')
                ) {
                    $prevSticky.removeClass('absolute').removeAttr('style');
                }
            }
        });
    };
    const load = (stickies) => {
        if (typeof stickies === 'object'
            && stickies instanceof jQuery
            && stickies.length > 0
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
    const nonNACount = cates.filter(c => c !== null).length;
    return [Number(100 * nonNACount / (total || 1)).toFixed(2), nonNACount, total];
};

const produceCategoricalTable = (traceData, options = {}) => {
    // fix x-axis with datetime range
    const traceForm = $(formElements.formID);
    const formData = new FormData(traceForm[0]);
    const startDt = formData.get('START_DATE');
    const startTm = formData.get('START_TIME');
    const endDt = formData.get('END_DATE');
    const endTm = formData.get('END_TIME');
    const uiStartTime = new Date(`${startDt} ${startTm}`).toISOString();
    const uiEndTime = new Date(`${endDt} ${endTm}`).toISOString();
    const {thinDataGroupCounts, indexOrderColumns, is_thin_data} = traceData;

    // calculate categorical boxes: start/end position, count, etc
    const dicAllCateBoxes = {};
    const cateNameHTMLs = [];

    if (traceData.category_data.length) {
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
    const xAxisOption = $(formElements.xOption).val();
    traceData.category_data.forEach((dicCate) => {
        let boxes = null;
        if (!dicCate.isOverUniqueLimit) {
            if (xAxisOption === 'INDEX') {
                boxes = buildCategoryBoxes(dicCate.data);
            } else {
                boxes = buildCategoryBoxes(dicCate.data, traceData.times, uiStartTime, uiEndTime);
            }

            // pre-process boxes code
            // const { combinedBoxes, isNarrowBoxCombined } = combineEmptyBoxes(boxes);
            const {combinedBoxes, isNarrowBoxCombined} = combineSmallBoxes(boxes);
            boxes = combinedBoxes;
            isBoxCombined = isNarrowBoxCombined;
        }

        // non-na count
        let nonNAPercent = 0;
        let nonNACount = 0;
        let total = 0;
        if (dicCate.summary) {
            nonNAPercent = dicCate.summary.nonNAPercentage;
            nonNACount = dicCate.summary.nonNACounts;
            total = dicCate.summary.nTotal;
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
                <td title="${nonNAPercent}% (${formatNumberWithCommas(nonNACount)}/${formatNumberWithCommas(total) || '0'})">
                    ${nonNAPercent}% (${formatNumberWithCommas(nonNACount)}/${formatNumberWithCommas(total) || '0'})
                </td>
            </tr>`)
    });

    cateNameHTMLs.push(`</tbody></table>`)

    // show msg to warn about combining narrow boxes
    if (isBoxCombined) {
        setTimeout(() => {
            const msgTitle = i18n.warningTitle;
            const msgContent = i18n.hideNarrowBox;
            showToastrMsg(msgContent, msgTitle);
        }, 200);
    }

    // generate a table for each categorical field
    const tblHTMLs = [];
    Object.values(dicAllCateBoxes).forEach((cateBoxes) => {
        const cateHTML = createCateTableHTML(cateBoxes, thinDataGroupCounts, indexOrderColumns, is_thin_data, xAxisOption);
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
    const cateCardHTML = createCateCard(cateNameHTMLs, tblHTMLs, tableWidth, cols, traceData);

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

    // bind scale event
    bindGraphScaleEvent();

    // 116 13 save focused box for keyboard movement
    $('#cateTable table td').on('click', (e) => {  // TODO 116
        savedBox = e.currentTarget;
    })

    initIndexModal();
};

const name = {
    process: 'TermSerialProcess',
    serial: 'TermSerialColumn',
    order: 'TermSerialOrder',
}
let xOption = '';
let selectedSerials = null;
let selectedProcess = null;
let currentTable = null;
let currentXOption = '';
let lastSelectedOrder = [];

const initIndexModal = () => {
    const xOptionSwitch = $(formElements.indexOrderSwitch);

    const setDefault = () => {
        if (currentXOption === CONST.XOPT_INDEX) {
            xOptionSwitch.prop('checked', true);
        } else {
            xOptionSwitch.prop('checked', false);
        }
    }

    // set default checked switch
    setDefault();

    $(formElements.indexOrderSwitch).on('change', function () {

        if ($(this).is(':checked')) {
            showSerialModal(formElements.serialTableModal2);
            setSelect2Selection(formElements.serialTable2)

            $(formElements.btnAddSerial2).unbind('click');
            $(formElements.btnAddSerial2).on('click', () => {
                addSerialOrderRow(formElements.serialTable2, name.process, name.serial, name.order).then(() => {
                    initSelect();
                    disableUnselectedOption(selectedSerials, name.serial);
                    disableUnselectedOption(selectedProcess, name.process);
                });
            });
        } else {
            xOption = CONST.XOPT_TIME;
            currentXOption = xOption;
            handleSubmit(false);
        }
    })

    $(formElements.cancelOrderIndexModal).unbind('click');
    $(formElements.cancelOrderIndexModal).on('click', function () {
        setDefault();
        renderTableContent();
    })

    $(formElements.okOrderIndexModal).unbind('click');
    $(formElements.okOrderIndexModal).on('click', () => {
        getLastedSelectedValue(formElements.serialTable2, name.process, name.serial, name.order)
        xOption = CONST.XOPT_INDEX;
        currentXOption = xOption;
        handleSubmit(false);
    })
}

function disableUnselectedOption(selectedSerials, serialName) {
    const serialSelects = $(`select[name=${serialName}]`);

    serialSelects.each(function () {
        const selectElement = $(this);
        const selectedVal = selectElement.val();
        const options = [...selectElement.find('option')];

        for (const opt of options) {
            const option = $(opt);
            const val = option.val();
            if (!selectedSerials.has(val)) {
                option.attr('disabled', true);
            }
            if (!selectedSerials.has(selectedVal)) {
                selectElement.val('').change();
            }
        }
    });
}

function initSelect() {
    bindChangeProcessEvent(formElements.serialTable2, name.process, name.serial, () => {
        disableUnselectedOption(selectedSerials, name.serial);
        disableUnselectedOption(selectedProcess, name.process);
    });
    updatePriorityAndDisableSelected(formElements.serialTable2, name.serial);

    setTimeout(() => { // wait select2 to be shown
        bindChangeOrderColEvent(formElements.serialTable2, name.serial, () => {
        });
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
            serialOder: order,
        })
    })
}

function renderTableContent() {
    $(`${formElements.serialTable2} tbody`).html('');
    lastSelectedOrder.forEach(row => {
        addSerialOrderRow(formElements.serialTable2, name.process, name.serial, name.order).then(() => {
            const trs = $(`${formElements.serialTable2} tbody tr`);
            const lastChild = trs[trs.length - 1]
            $(lastChild).find(`[name=${name.process}]`).val(row.serialProcess)
            $(lastChild).find(`[name=${name.serial}]`).val(row.serialColumn)
            $(lastChild).find(`[name=${name.order}]`).val(row.serialOder)
            initSelect();
        });
    })
    setTimeout(() => {
        selectedSerials = getSelectedOrderCols(formElements.serialTable2, name.serial);
        selectedProcess = getSelectedOrderCols(formElements.serialTable2, name.process);
        disableUnselectedOption(selectedSerials, name.serial);
        disableUnselectedOption(selectedProcess, name.process);
    }, 1000)
}

function initTableValue() {
    currentXOption = lastUsedFormData.get('xOption');
    getLastedSelectedValue(formElements.serialTable, 'serialProcess', 'serialColumn', 'serialOder')
    renderTableContent();
}

function transformIndexOrderParams(formData) {
    if (xOption === CONST.XOPT_INDEX) {
        const latestFormData = collectFormData();
        for (const item of latestFormData.entries()) {
            const key = item[0];
            const value = item[1];
            if (key === name.process) {
                formData.append(name.process, value)
            }
            if (key === name.serial) {
                formData.append(name.serial, value)
            }
            if (key === name.order) {
                formData.append(name.order, value)
            }
        }
    } else {
        formData = removeUnusedFormParams(formData);
    }
    formData.set('TermXOption', xOption);

    return formData;
}

function removeUnusedFormParams(formData, clearOnFlyFilter = false) {
    formData.delete(name.process)
    formData.delete(name.serial)
    formData.delete(name.order)

    if (clearOnFlyFilter) {
         if (formData.get('xOption') === CONST.XOPT_TIME) {
            formData.delete('serialProcess')
            formData.delete('serialColumn')
            formData.delete('serialOrder')
        }
    }

    return formData;
}

const bindGraphScaleEvent = () => {
    $('select[name=tsScaleY]').change(function f() {
        const scaleOption = $(this).children('option:selected').val() || '1';
        updateGraphScale(scaleOption);
    });
}

const clipboardInit = () => {
    $('.clipboard').tooltip({
        trigger: 'click',
        placement: 'bottom',
    });

    const clipboard = new ClipboardJS('.clipboard');

    clipboard.on('success', (e) => {
        setTooltip(e.trigger, 'Copied!');
    });

    clipboard.on('error', (e) => {
        setTooltip(e.trigger, 'Failed!');
    });
}