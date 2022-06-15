/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(120000); // 3 minutes
const MAX_NUMBER_OF_GRAPH = 20;
const MAX_END_PROC = 20;
const is_sse_listening = false;
const valueInfo = null;
const filterInfo = null;
const dicTabs = { '#byCategory': 'category', '#byCyclicTerm': 'cyclicTerm', '#byDirectTerm': 'directTerm' };

const rlpCardSize = {
    width: null,
    height: null,
};
// const procMaster = getParam.proc_master;
const eles = {
    varTabPrefix: 'category',
    directTermPrefix: 'directTerm',
    cyclicTermTabPrefix: 'cyclicTerm',
    varBtnAddCondProc: '#categorybtn-add-cond-proc',
    formID: 'RLPForm',
    mainFormId: '#RLPForm',
    endProcItems: '#end-proc-row .end-proc',
    condProcReg: /cond_proc/g,
    condProcProcessDiv: 'CondProcProcessDiv',
    condProcPartno: 'condProcPartno',
    categoryPlotTime: '.category-plot-time',
    categoryVariableSelect: 'CategoryVariableSelect',
    categoryPlotCards: 'CatePlotCards',
    condMachinePartnoDiv: 'CondMachinePartnoDiv',
    endProcProcess: 'EndProcProcess',
    endProcProcessDiv: 'EndProcProcessDiv',
    endProcVal: 'EndProcVal',
    endProcValDiv: 'EndProcValDiv',
    startDate: 'StartDate',
    startTime: 'StartTime',
    endDate: 'EndDate',
    endTime: 'EndTime',
    DateTimeDivName: 'DateTime',
    DateTimeEleName: 'DateTimeElement',
    dateTimeCloseBtn: 'DateTimeCloseBtn',
    VariableCloseBtn: 'VariableCloseBtn',
    categoryVariableName: 'categoryVariable',
    categoryValueMulti: 'categoryValueMulti',
    histograms: 'Histograms',
    plotInfoId: 'PlotDetailInfomation',
    traceTime: 'TraceTime',
    recentTimeInterval: 'recentTimeInterval',
    scatterPlotCards: 'ScatterPlotCards',
    summaryOption: 'SummaryOption',
    machineID: 'machine-id',
    lineList: 'line-list',
    checkBoxs: 'input[name=GET02_VALS_SELECT1][type=checkbox][value!=All]',
    stratifiedVarTabs: '#stratifiedVarTabs',
    sVColumns: '.categorySVColumns',
    showValueKey: 'GET02_VALS_SELECT1',
    sensorName: 'sensor_name',
    START_DATE: 'START_DATE',
    START_TIME: 'START_TIME',
    END_DATE: 'END_DATE',
    END_TIME: 'END_TIME',
};

const formElements = {
    NO_FILTER: 'NO_FILTER',
    mainForm: '#RLPForm',
    endProcSelectedItem: '#end-proc-row select',
};

const i18n = {
    machineName: $('#i18nMachine').text(),
    partNoName: $('#i18nPartNo').text(),
    dateRange: $('#i18nDateRange').text(),
    dateRecent: $('#i18nRecent').text(),
    hour: $('#i18nHour').text(),
    minute: $('#i18nMinute').text(),
    day: $('#i18nDay').text(),
    week: $('#i18nWeek').text(),
    noFilter: $('#i18nNoFilter').text(),
    allSelection: $('#i18nAllSelection').text(),
    viewerTabName: $('#i18nViewer').text(),
    partNo: $('#i18nPartNo').text(),
    machineNo: $('#i18nMachine').text(),
    invalidInterval: $('#i18nInvalidInterval').text(),
    invalidWindowLenth: $('#i18nInvalidWindowLength').text(),
    invalidNumRL: $('#i18nInvalidNumRL').text(),
    startDateTime: $('#i18nStartDateTime').text(),
    startDateTimeHover: $('#i18nStartDateTimeHover').text(),
    interval: $('#i18nInterval').text(),
    intervalHover: $('#i18nIntervalHover').text(),
    windowLength: $('#i18nWindowLength').text(),
    windowLengthHover: $('#i18nWindowLengthHover').text(),
    numRL: $('#i18nNumRL').text(),
    numRLHover: $('#i18nNumRLHover').text(),
    warningTitle: $('#i18nWarningTitle').text(),
    selectFacet: $('#i18nSelectCatExpBox').text(),
    selectTooManyValue: $('#i18nTooManyValue').text(),
    FewDataPointInRLP: $('#i18nFewDataPointInRLP').text(),
    datetimeFrom: $('#i18nDatetimeFrom').text(),
    datetimeTo: $('#i18nDatetimeTo').text(),
    datetimeRange: $('#i18nDatetimeRange').text(),
    timestamp: $('#i18nTimestamp').text(),
};

$(() => {
    // hide loading screen
    const loading = $('.loading');
    loading.addClass('hide');

    // add first end process
    const endProcs = genProcessDropdownData(procConfigs);

    const varEndProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, true, true, true);
    varEndProcItem();

    // add endproc
    $('#btn-add-end-proc').click(() => {
        varEndProcItem();
        updateSelectedItems();
        addAttributeToElement();
    });

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names,
        eles.varTabPrefix, formElements.mainForm, 'btnAddCondProc');
    condProcItem();

    // click event of condition proc add button
    $(eles.varBtnAddCondProc).click(() => {
        condProcItem();
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // click even of end proc add button
    $('#btn-add-end-proc-rlpcat').click(() => {
        varEndProcItem();
        addAttributeToElement();
    });

    initValidation(eles.mainFormId);

    initTargetPeriod();
    toggleDisableAllInputOfNoneDisplayEl($('#for-cyclicTerm'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-directTerm'));

    // add limit after running load_user_setting
    setTimeout(() => {
        // add validations for target period
        validateTargetPeriodInput();
    }, 600);

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.WINDOW_LENGTH, CYCLIC_TERM.WINDOW_LENGTH_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.INTERVAL, CYCLIC_TERM.INTERVAL_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.DIV_NUM, { MAX: 150, MIN: 2, DEFAULT: 30 });

    initializeDateTimeRangePicker();
    initializeDateTimePicker();

    // drag & drop for tables
    $('.ui-sortable').sortable();
});

const loading = $('.loading');

const isFormDataValid = (eleIdPrefix, formData) => {
    // validate number of sensors
    const selectedSensors = formData.getAll(eles.showValueKey).filter(e => e !== 'All');
    if (selectedSensors.length > 8 || selectedSensors.length < 1) {
        showToastrMsg(i18n.selectTooManyValue, i18n.warningTitle);
        return 1;
    }

    if (eleIdPrefix === 'var' || eleIdPrefix === 'category') {
        const endProcCat = formData.get('end_proc_cate1');
        if (!endProcCat || endProcCat === 'null') {
            return 4;
        }
    }
    // check endProc = '---'
    const endProc = formData.get('end_proc1');
    if (isEmpty(endProc)) {
        return 3;
    }

    if (eleIdPrefix === eles.varTabPrefix) {
        // check required keys
        const requiredKeys = [eles.categoryVariableName, eles.categoryValueMulti];
        const formKeys = [...formData.keys()];
        for (const chkKey of requiredKeys) {
            const result = formKeys.some(e => e.startsWith(chkKey));
            if (result === false) {
                return 2;
            }
        }
    }

    return 0;
};

const reformatFormData = (eleIdPrefix, formData) => {
    let formatedFormData = formData;

    // generate start_procs
    // [...formatedFormData].forEach((formItem) => {
    //     // find end proc key in formData
    //     if (formItem[0].includes('end_proc')) {
    //         const procUID = formItem[0].match(/(\d+)/)[0];
    //         formatedFormData.set(`start_proc${procUID}`, formItem[1]);
    //     }
    // });

    formatedFormData.set('compareType', eleIdPrefix);

    if (eleIdPrefix === eles.cyclicTermTabPrefix) {
        formatedFormData = chooseCyclicTraceTimeInterval(formatedFormData);
    } else if (eleIdPrefix === eles.varTabPrefix) {
        formatedFormData = chooseTraceTimeIntervals(formatedFormData);
    }

    // convert to UTC datetime to query
    formatedFormData = convertFormDateTimeToUTC(formatedFormData);

    return formatedFormData;
};


const emdToColor = (emdArray) => {
    if (emdArray) {
        const maxValue = Math.max(...emdArray.map(i => Math.abs(i)));
        const minValue = Math.min(...emdArray);

        return emdArray.map((emdValue) => {
            let hValue;
            // max = min -> default color in zero
            if (maxValue === minValue) {
                hValue = 120;
            } else {
                hValue = 120 * (1 - emdValue / maxValue);
            }
            const hsv = {
                h: hValue,
                s: 1,
                v: 1,
            };
            return hsv2rgb(hsv);
        });
    }
    return [];
};

const createEMDTrace = (emdGroup, emdData, emdColors) => ({
    x: emdGroup,
    y: emdData,
    xaxis: 'x2',
    mode: 'lines+markers',
    type: 'scatter',
    line: {
        width: 1,
        color: '#444444',
    },
    marker: {
        color: emdColors,
    },
    showlegend: false,
});

const createEMDByLine = (emdGroup, emdData, emdColors) => ({
    line: { width: 1, color: '#444444' },
    marker: {
        color: emdColors,
    },
    mode: 'lines+markers',
    showlegend: false,
    type: 'scatter',
    y: emdData,
    x: emdGroup,
    xaxis: 'x2',
    yaxis: 'y2',
    text: emdData,
    name: '', // hoverstring: yvalue + name
    hovertemplate: '<b>%{text:.2f}</b>',
});

const rlpXAxis = {
    category: [],
    cyclicTerm: [],
    directTerm: [],
};

const showRidgeLine = (res, eleIdPrefix = 'category') => {
    const rlpCard = $('#RLPCard');
    rlpCard.html('');
    rlpCard.show();

    const numGraphs = res.array_plotdata.length;

    const rlpCSSSetting = {
        itemHeight: [50, 50, 33, 25],
        titleHeight: [21, 21, 13, 9],
    };
    let itemMaxHeight;
    let titleMaxHeight;
    if (res.array_plotdata.length >= 4) {
        itemMaxHeight = rlpCSSSetting.itemHeight[3];
        titleMaxHeight = rlpCSSSetting.titleHeight[3];
    } else {
        itemMaxHeight = rlpCSSSetting.itemHeight[res.array_plotdata.length - 1];
        titleMaxHeight = rlpCSSSetting.titleHeight[res.array_plotdata.length - 1];
    }
    const rlpItemHeight = `calc(${itemMaxHeight}vh - 10px)`;

    const { compareType } = res.COMMON;
    Object.keys(res.array_plotdata).forEach((plotName, plotKey) => {
        // const originalData = [];
        const ridgelineCardID = `${eleIdPrefix}RLPCard-${plotName}`;
        const rlpCardGroupID = `${eleIdPrefix}RLPCardGroup-${plotName}`;

        const emdData = res.emd[plotKey] || [];
        const emdColors = emdToColor(emdData);
        const rlpColors = [...emdColors];
        const sensorData = res.array_plotdata[plotName];
        const originXAxis = [...sensorData.rlp_xaxis];

        rlpCard.append(`<div class="ridgeLineItem graph-navi" id="${rlpCardGroupID}">
            <div class="chart-title" style="transform: rotate(-90deg) translateY(-7vw) translateX(-${titleMaxHeight}vh); line-height: 1.2;">
                <span title="${sensorData.proc_name}">${sensorData.proc_name}</span><br>
                <span title="${sensorData.sensor_name}">${sensorData.sensor_name}</span><br>
                <span title="${sensorData.catExpBox}">${sensorData.catExpBox || ''}</span>
            </div>
            <div class="ridgeLineCard-full" id="${ridgelineCardID}" style="height: ${rlpItemHeight};padding-left: 10px;"></div>
            <div class="pin-chart">
                <span class="btn-anchor"
                    data-pinned="false"
                    onclick="pinChart('${rlpCardGroupID}');"><i class="fas fa-anchor"></i></span>
            </div>
        </div>`);


        // remove empty rlp
        for (let idx = sensorData.ridgelines.length - 1; idx >= 0; idx--) {
            if (sensorData.ridgelines[idx].trans_kde.length === 0) {
                sensorData.ridgelines.splice(idx, 1);
                sensorData.rlp_xaxis.splice(idx, 1);
            }
        }

        // tmp groups for EMD zero case
        let groupsName;
        if (sensorData.categories.length === 1 && sensorData.categories.length < sensorData.ridgelines.length) {
            groupsName = sensorData.ridgelines.map(rlp => rlp.cate_name);
        } else {
            groupsName = sensorData.categories;
        }


        const isNumber = value => !Number.isNaN(Number(value));

        const datetimeCategory = [];
        // convert local time if category is datetime
        const categories = groupsName.map((group) => {
            if (eleIdPrefix === eles.varTabPrefix) {
                return group;
            }
            const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';
            const timeRange = group.split(' |');
            if (moment(timeRange[0]).isValid()) {
                const startDt = timeRange[0];
                const endDt = timeRange[1];
                const startDateTime = formatDateTime(startDt, DATETIME_FORMAT);
                const endDateTime = formatDateTime(endDt, DATETIME_FORMAT);
                datetimeCategory.push(`${startDateTime} ${COMMON_CONSTANT.EN_DASH} ${endDateTime}${timeRange.slice(2).length ? ` | ${timeRange.slice(2).join(' | ')}` : ''}`);
                return `${startDateTime}`;
            }
            return group;
        });

        const props = {
            mBottom: 50,
        };

        // check show axis label
        const showXAxis = $(`#${eleIdPrefix}ShowOutlier`).is(':checked');

        // rlp new layout
        const rlpLayout = rlpByLineTemplate(
            sensorData.sensor_name,
            categories,
            // originXAxis,
            sensorData.rlp_xaxis,
            sensorData.rlp_yaxis,
            nticks = 20,
            compareType,
            showXAxis,
            props,
        );

        // rlp new data
        const rlpData = [];
        const exceptIdx = [];
        const rlpLengh = sensorData.ridgelines.length - 1;
        for (let k = 0; k <= rlpLengh; k++) {
            if (sensorData.ridgelines[k].trans_kde.length) {
                const histLabels = sensorData.ridgelines[k].kde_data.hist_labels;
                const transKDE = sensorData.ridgelines[k].trans_kde;
                const lineColor = (sensorData.ridgelines[k].data_counts >= 8) ? rlpColors[k] : '#808080';
                const rlpLabel = datetimeCategory.length ? datetimeCategory[k] : categories[k];
                const rlpInst = rlpSingleLine(
                    histLabels,
                    transKDE,
                    lineColor,
                    rlpLabel,
                );
                rlpData.push(rlpInst);

                if (sensorData.ridgelines[k].data_counts < 8) {
                    exceptIdx.push(k);
                }
            }
        }
        const validEMDDat = emdData.filter((v, i) => !exceptIdx.includes(i));
        const validRLPXAxis = sensorData.rlp_xaxis.filter((v, i) => !exceptIdx.includes(i));
        const validEMDColor = emdColors.filter((v, i) => !exceptIdx.includes(i));
        // calc emd
        // const emdXasis = [];
        // const rlpLen = sensorData.rlp_xaxis.length - 1;
        // for (let i = 0; i <= rlpLen; i++) {
        //     emdXasis.push(sensorData.rlp_xaxis[i]);
        // }

        // remove emdData in case of data point less than 8
        if (validEMDDat) {
            const rlpEMD = createEMDByLine(validRLPXAxis, validEMDDat, validEMDColor);
            // push emd to data list
            rlpData.push(rlpEMD);
        }

        Plotly.newPlot(
            ridgelineCardID,
            rlpData,
            rlpLayout,
            {
                ...genPlotlyIconSettings(),
                responsive: true, // responsive
                useResizeHandler: true, // responsive
                style: { width: '100%', height: 250 }, // responsive
            },
        );

        // report progress
        loadingUpdate(loadingProgressBackend + plotKey * ((100 - loadingProgressBackend) / (numGraphs || 1)));
    });

    $('html, body').animate({
        scrollTop: rlpCard.offset().top,
    }, 1000);
};

const isRLPHasFewDataPoint = (res) => {
    for (const plotData of res.array_plotdata) {
        for (const ridge of plotData.ridgelines) {
            if (ridge.data_counts > 0 && ridge.data_counts < 50) {
                return true;
            }
        }
    }
};

const showGraph = () => {
    const eleIdPrefix = $('select[name=compareType]').val();
    // reset show x axis switch
    $('#categoryShowOutlier').prop('checked', false);
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();

    if (!isValid) return;

    // close sidebar
    beforeShowGraphCommon();
    loadingShow();

    const traceForm = $(eles.mainFormId);
    let formData = new FormData(traceForm[0]);
    // reformat formdata
    formData = reformatFormData(eleIdPrefix, formData);
    formData = transformFacetParams(formData);
    formData = transformCategoryVariableParams(formData, procConfigs);
    formData = transformCategoryTraceTime(formData, eleIdPrefix);
    // validate form
    const validateFlg = isFormDataValid(eleIdPrefix, formData);
    if (validateFlg === 4) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectFacet, i18n.warningTitle);
        return;
    }
    if (validateFlg !== 0) {
        loadingHide();
        showToastrAnomalGraph();
        return;
    }


    $.ajax({
        url: '/histview2/api/rlp/index',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            const t0 = performance.now();

            loadingShow(true);

            // Sprint73_#18.1 : array_xのlengthをチェックする
            if (isRLPHasFewDataPoint(res)) {
                showToastrMsg(i18n.FewDataPointInRLP, i18n.warningTitle);
            }

            // show limit graphs displayed message
            if (res.isGraphLimited) {
                showToastrMsg(i18nCommon.limitDisplayedGraphs.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
            }

            // show result section
            $(`#${eles.categoryPlotCards}`).css('display', 'block');

            // show graphs
            showRidgeLine(res, eleIdPrefix);

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);

            // move invalid filter
            setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);
            // if (checkResultExist(res)) {
            //     saveInvalidFilterCaller(true);
            // } else {
            //     saveInvalidFilterCaller();
            // }

            autoUpdate(formData);

            setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));
            // export mode
            handleZipExport(res);
        },
        error: (res) => {
            loadingHide();
            errorHandling(res);
            // export mode
            handleZipExport(res);
        },
    }).then(() => {
        afterRequestAction();
    });
};

const dataExport = async (eleIdPrefix, type, download = true, clipboard = false) => {
    const traceForm = $(eles.mainFormId);
    let formData = new FormData(traceForm[0]);
    // reformat formdata
    formData = reformatFormData(eleIdPrefix, formData);
    formData = transformFacetParams(formData);
    formData = transformCategoryVariableParams(formData, procConfigs);
    formData = transformCategoryTraceTime(formData, eleIdPrefix);
    // validate form
    const validateFlg = isFormDataValid(eleIdPrefix, formData);
    if (validateFlg === 4) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectFacet, i18n.warningTitle);
        return;
    }
    if (validateFlg !== 0) {
        loading.addClass('hide');
        showToastrAnomalGraph();
        return;
    }

    // append client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    formData.set('client_timezone', timezone);

    const query = new URLSearchParams(formData);
    const queryString = query.toString();

    // query.forEach((value, key) => {
    //     if (isEmpty(value)) {
    //         query.delete(key);
    //     }
    // });
    const exportType = type === 'tsv_export' ? type : 'csv_export';

    if (queryString && queryString.includes('GET02_VALS_SELECT')) {
        const url = `/histview2/api/rlp/${exportType}?${queryString}`;
        const filename = `${getCurrentTimeStr()}_out.${exportType.substring(0, 3)}`;
        if (download) {
            downloadTextFile(url, filename);
        }
        if (clipboard) {
            copyTextToClipboard(url);
        }
        // setTimeout(() => {
        //     window.location.href = `/histview2/api/rlp/${exportType}?${queryString}`;
        //     loading.addClass('hide');
        // }, 500);
    }
    loading.addClass('hide');
    // return false;
};

const csvExport = () => {
    loadingShow();
    const eleIdPrefix = $('select[name=compareType]').val();
    dataExport(eleIdPrefix).then(() => {
        loadingHide();
        showToastrStartedCSV();
    });
};

const tsvExport = () => {
    loadingShow();
    const eleIdPrefix = $('select[name=compareType]').val();
    dataExport(eleIdPrefix, 'tsv_export').then(() => {
        loadingHide();
        showToastrStartedCSV(false);
    });
};

// eslint-disable-next-line no-unused-vars
const scrollRLPChart = (() => {
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
        const stickiesParentCard = $stickies.closest('.card')[0].id;
        const currentTerm = stickiesParentCard.split('RLPCard')[0];

        const pinnedCardHeight = $($(`#${stickiesParentCard} .ridgeLineItem`)[0]).height();
        const anchorPosition = $(`#${currentTerm}ShowOutlier`).parent().parent().offset().top;
        const isScrollOverCategoryTabl = $(window).scrollTop() + pinnedCardHeight < anchorPosition;
        if (isScrollOverCategoryTabl) {
            if ($stickies.find('.btn-anchor').hasClass('pin')
                && $stickies.hasClass('pinChart')) {
                $stickies.removeClass('pinChart');
            }
        } else if ($stickies.find('.btn-anchor').hasClass('pin')) {
            $stickies.addClass('pinChart');
        }
    };
    const load = (stickies) => {
        if (typeof stickies === 'object'
            && stickies instanceof jQuery
            && stickies.length > 0
            // && stickies.id !== 'cate-card'
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

                whenScrolling();
            });
        }
    };
    return {
        load,
    };
})();

const pinChart = (chartDOMId) => {
    const $activeItemDOM = $(`#${chartDOMId}`);
    const originWidth = $activeItemDOM.closest('.card').width();
    const originHeight = $activeItemDOM.closest('.card').find('.ridgeLineItem').height();

    const anchor = $activeItemDOM.find('span.btn-anchor');
    const isPinned = anchor.attr('data-pinned');
    // remove all pinned charts and pinned anchors
    $('.ridgeLineItem').removeClass('pinChart');
    $('.ridgeLineItem').find('span.btn-anchor').removeClass('pin');
    // reset marker in anchor
    $('.ridgeLineItem').find('span.btn-anchor').attr('data-pinned', false);

    // TODO: unpin ts chart here
    if (isPinned !== 'true') {
        // make pin current chart
        $activeItemDOM.toggleClass('pinChart');
        $activeItemDOM.find('span.btn-anchor').toggleClass('pin');
        $activeItemDOM.find('span.btn-anchor').attr('data-pinned', true);

        // set width for pinned chart
        $('.pinChart').css({
            width: originWidth,
            height: originHeight + 2,
        });

        // pin as scroll
        scrollRLPChart.load($activeItemDOM);
    }
};

const showXAxisLabel = (element) => {
    const isShowAxis = $(element).is(':checked');
    const currentTerm = $(element).attr('id').split('ShowOutlier')[0];
    $('#RLPCard .ridgeLineItem').find('.ridgeLineCard-full').each((i, card) => {
        const layout = {
            xaxis: {
                tickvals: isShowAxis ? rlpXAxis[currentTerm][i] : [],
            },
        };
        Plotly.relayout(card.id, layout);
    });
};

const ridgelineTsvClipBoard = () => {
    loadingShow();
    const eleIdPrefix = $('select[name=compareType]').val();
    dataExport(eleIdPrefix, 'tsv_export', false, true).then(() => {
        loadingHide();
    });
};
