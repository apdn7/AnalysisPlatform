/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 20;
const MAX_END_PROC = 20;
let valueInfo = null;
const graphStore = new GraphStore();
const dicTabs = { '#byCategory': 'category', '#byCyclicTerm': 'cyclicTerm', '#byDirectTerm': 'directTerm' };
let resData = null;
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
    showValuePartial: 'GET02_VALS_SELECT',
    sensorName: 'sensor_name',
    endProc: 'end_proc',
};

const formElements = {
    NO_FILTER: 'NO_FILTER',
    mainForm: '#RLPForm',
    endProcSelectedItem: '#end-proc-row select',
    yScaleOption: 'select[name=yScaleOption]',
    showXAxisOption: '#showXAxis',
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
    selectFacet: $('#i18nSelectCatExpBox').text(),
    selectDivRequiredMessage: $('#i18nSelectDivMessage').text(),
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

    const varEndProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, true,
        true, true, false, false, false, true, true);
    varEndProcItem(() => {
        onChangeDivInFacet();
    });

    // add endproc
    $('#btn-add-end-proc').click(() => {
        varEndProcItem(() => {
             onChangeDivInFacet();
        });
        updateSelectedItems();
        addAttributeToElement();
    });

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names,
        eles.varTabPrefix, formElements.mainForm, `${eles.varTabPrefix}btn-add-cond-proc`);
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
        keepValueEachDivision();
    }, 2000);

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.WINDOW_LENGTH, CYCLIC_TERM.WINDOW_LENGTH_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.INTERVAL, CYCLIC_TERM.INTERVAL_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.DIV_NUM, { MAX: 150, MIN: 2, DEFAULT: 30 });

    onChangeDivideOption();

    initializeDateTimeRangePicker();
    initializeDateTimePicker();

    // drag & drop for tables
    $('.ui-sortable').sortable();

    $('select[name=filterEmd]').off('change');
    $('select[name=filterEmd]').on('change', (e) => {
        loadingShow();
        const emdType = e.currentTarget.value;
        resData.emdType = emdType;
        showRidgeLine(resData, resData.COMMON.compareType, true)
        loadingHide();
    })
});

const loading = $('.loading');

const isFormDataValid = (eleIdPrefix, formData) => {

    if (eleIdPrefix === eles.varTabPrefix) {
        const hasDiv = formData.get('div');
        if (!hasDiv) {
            return 4;
        }
    }

    return 0;
};

const reformatFormData = (eleIdPrefix, formData) => {
    let formatedFormData = formData;
    formatedFormData.set('compareType', eleIdPrefix);
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

const createEMDByLine = (emdGroup, emdData, emdColors) => {
    let sortedEmd = [...emdData].sort();
    const start = Math.floor(sortedEmd.length * 0.05);
    const end = sortedEmd.length - start;
    sortedEmd = sortedEmd.slice(start, end);
    const fmt = sortedEmd.length > 0 ? significantDigitFmt(Math.max(...sortedEmd)) : '';
    const res = {
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
        hovertemplate: `<b>%{text:${fmt}}</b>`,
        customdata: {
            isridgline: false,
        },
    };
    return [res, fmt];
};

const rlpXAxis = {
    category: [],
    cyclicTerm: [],
    directTerm: [],
};

const showRidgeLine = (res, eleIdPrefix = 'category', isFilterEmd = false) => {
    const rlpCard = $('#RLPCard');
    rlpCard.html('');
    rlpCard.show();

    const numGraphs = res.array_plotdata.length;

    rlpXAxis[eleIdPrefix] = [];

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
    const rlpItemHeight = `calc(${itemMaxHeight}vh - 15px)`;

    const { compareType } = res.COMMON;
    const startProc = res.COMMON.start_proc;
    Object.keys(res.array_plotdata).forEach((plotName, plotKey) => {
        const { emdType } = res;
        let step = emdType === EMDType.BOTH ? 2 : 1;
        let fixedStep = 2;
        let emdIdx = plotKey * (isFilterEmd ? fixedStep : step);
        if (emdType === EMDType.DIFF && isFilterEmd) {
            emdIdx += 1;
        }
        let showType = '';
        for (let i = 1; i <= step; i += 1) {
            if (emdType === EMDType.BOTH) {
                showType = i === 1 ? '(Drift)' : '(Diff)';
            }
            renderRidgeLine(rlpCard, eleIdPrefix, res, plotName, startProc, numGraphs,
                titleMaxHeight, rlpItemHeight, compareType, showType, emdIdx);
            emdIdx += 1;
        }
    });

    $('html, body').animate({
        scrollTop: rlpCard.offset().top,
    }, 1000);
};


const renderRidgeLine = (rlpCard, eleIdPrefix, res, plotName, startProc, numGraphs, titleMaxHeight, rlpItemHeight, compareType, emdType, emdIdx) => {
    // const originalData = [];
    const ridgelineCardID = `${eleIdPrefix}RLPCard-${plotName}-${emdIdx}`;
    const rlpCardGroupID = `${eleIdPrefix}RLPCardGroup-${plotName}-${emdIdx}`;

    const emdData = res.emd[emdIdx] || [];
    const sensorData = res.array_plotdata[plotName];
    const transEMDFromRidgeline = (emdDat, ridgelines) => {
        const transEMD = [];
        let startkey = 0;
        for (k = 0; k < ridgelines.length; k++) {
            if (ridgelines[k].trans_kde.length) {
                transEMD[k] = emdDat[startkey];
                startkey += 1;
            } else {
                transEMD[k] = null;
            }
        }
        return transEMD;
    };
    const emdColors = emdToColor(emdData);
    const rlpColors = [...emdColors];
    const transRLPColors = transEMDFromRidgeline(rlpColors, sensorData.ridgelines);
    const catExpBox = sensorData.catExpBox && _.isArray(sensorData.catExpBox) ? sensorData.catExpBox.join(' | ') : sensorData.catExpBox;

    const fromStartProcClass = String(startProc) === String(sensorData.end_proc_id) ? ' card-active' : '';
    const facetLabel = catExpBox && catExpBox !== 'None' ? catExpBox : '';
    const facetDetailHTML = facetLabel ? `<span class="show-detail cat-exp-box" title="${catExpBox}">${facetLabel}</span>` : '';
    const titleStyle = facetLabel && emdType ? 'width: 80px' : (facetLabel && !emdType || !facetLabel && emdType) ? 'width: 65px' : '';
    rlpCard.append(`<div class="ridgeLineItem graph-navi${fromStartProcClass}" id="${rlpCardGroupID}">
             <div class="tschart-title-parent" style="${titleStyle}">
                <div class="tschart-title" style="width: ${rlpItemHeight};">
                   <span title="${sensorData.proc_name}">${sensorData.proc_name}</span>
                   <span title="${sensorData.sensor_name}">${sensorData.sensor_name}</span>
                   ${facetDetailHTML}
                   <span title="${emdType}">${emdType}</span>
               </div>
              </div>
           <div class="ridgeLineCard-full" id="${ridgelineCardID}" style="height: ${rlpItemHeight};"></div>
           <div class="pin-chart">
               <span class="btn-anchor"
                    data-pinned="false"
                    onclick="pinChart('${rlpCardGroupID}');"><i class="fas fa-anchor"></i></span>
            </div>
        </div>`);

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
    const showXAxis = $('#showXAxis').is(':checked');

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
        res.fmt[sensorData.sensor_id],
    );

    // rlp new data
    const rlpData = [];
    const exceptIdx = [];
    const rlpLengh = sensorData.ridgelines.length - 1;
    for (let k = 0; k <= rlpLengh; k++) {
        if (sensorData.ridgelines[k].trans_kde.length > -1) {
            const histLabels = sensorData.ridgelines[k].kde_data.hist_labels;
            const ntotal = sensorData.ridgelines[k].data_counts;
            const transKDE = sensorData.ridgelines[k].trans_kde;
            const lineColor = (sensorData.ridgelines[k].data_counts >= 8) ? transRLPColors[k] : '#808080';
            const rlpLabel = datetimeCategory.length ? datetimeCategory[k] : categories[k];
            const rlpInst = rlpSingleLine(
                histLabels,
                transKDE,
                lineColor,
                rlpLabel,
                ntotal,
            );
            rlpData.push(rlpInst);

            if (sensorData.ridgelines[k].data_counts < 8) {
                exceptIdx.push(k);
            }
        }
    }
    // get all ridgelines which has trans_kde but data_counts < 8
    const inValidEMDIdx = sensorData.ridgelines.filter(i => i.trans_kde.length).map((v, i) => {
        if (v.data_counts > 0 && v.data_counts < 8) {
            return i;
        }
        return null;
    }).filter(i => i);
    // EMD and color will be excluding the ridgeline which data counts < 8
    const validEMDDat = emdData.filter((v, i) => !inValidEMDIdx.includes(i));
    const validRLPXAxis = sensorData.rlp_xaxis.filter((v, i) => !exceptIdx.includes(i)
        && sensorData.ridgelines[i].trans_kde.length);
    const validEMDColor = emdColors.filter((v, i) => !inValidEMDIdx.includes(i));

    // remove emdData in case of data point less than 8
    if (validEMDDat) {
        const [rlpEMD, fmt] = createEMDByLine(validRLPXAxis, validEMDDat, validEMDColor);
        rlpLayout.template.layout.yaxis2.tickformat = fmt.includes('e') ? '.1e' : '';
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
            style: {width: '100%', height: 250}, // responsive
        },
    );
    const hdPlot = document.getElementById(ridgelineCardID);
    const rlpDataTable = (data) => {
        const isRLP = data.points[0].data.customdata.isridgline;
        if (isRLP) {
            const genDataTable = (from, to, yValue) => {
                const isDIV = to === undefined;
                let tblContent = '<tr>';
                if (!isDIV) {
                    tblContent += genTRItems('From', from);
                    tblContent += genTRItems('To', to);
                } else {
                    tblContent += genTRItems('DIV', from);
                }
                tblContent += genTRItems('N', yValue);
                tblContent += '</tr>';
                return tblContent;
            };
            const dpIndex = ('pointIndex' in data.points[0])
                ? data.points[0].pointIndex
                : data.points[0].pointIndices[0];
            // "2022-03-15 07:00 – 2022-03-17 07:00"
            let textValue = '';
            if (data.points[0].data.text) {
                textValue = String(data.points[0].data.text);
            }
            const label = textValue.split(' – ');
            const yValue = data.points[0].data.customdata.count || 0;
            const dataTable = genDataTable(label[0], label[1], yValue);
            genDataPointHoverTable(
                dataTable,
                {
                    x: data.event.pageX - 120, y: data.event.pageY,
                },
                175,
                true,
                ridgelineCardID,
            );
        }
    };
    hdPlot.on('plotly_hover', (data) => {
        rlpDataTable(data);
    });

    unHoverHandler(hdPlot);
    // report progress
    loadingUpdate(loadingProgressBackend + emdIdx * ((100 - loadingProgressBackend) / (numGraphs || 1)));
};

const isRLPHasFewDataPoint = (res) => {
    let result = false;
    for (const plotData of res.array_plotdata) {
        for (const ridge of plotData.ridgelines) {
            if (ridge.data_counts > 0 && ridge.data_counts < 50) {
                result = true;
            }
        }
    }
    return result;
};

const collectRLPFormData = (clearOnFlyFilter, eleIdPrefix) => {
    const traceForm = $(eles.mainFormId);
    let formData = new FormData(traceForm[0]);

    if (clearOnFlyFilter) {
        // reformat formdata
        formData = reformatFormData(eleIdPrefix, formData);
        formData = transformFacetParams(formData);
        formData = transformCategoryVariableParams(formData, procConfigs);
        formData = transformCategoryTraceTime(formData, eleIdPrefix);
        formData = genDatetimeRange(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }
    return formData;
};

const showGraph = (clearOnFlyFilter = true) => {
    requestStartedAt = performance.now();
    const eleIdPrefix = $('select[name=compareType]').val();
    // reset show x axis switch
    $('#categoryShowOutlier').prop('checked', false);
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();

    if (!isValid) return;

    // close sidebar
    beforeShowGraphCommon(clearOnFlyFilter);

    if (clearOnFlyFilter) {
        resetCheckedCats();
    }

    let formData = collectRLPFormData(clearOnFlyFilter, eleIdPrefix);

    // validate form
    const validateFlg = isFormDataValid(eleIdPrefix, formData);
    if (validateFlg === 4) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectDivRequiredMessage, i18n.warningTitle);
        return;
    }
    if (validateFlg !== 0) {
        loadingHide();
        showToastrAnomalGraph();
        return;
    }

    showGraphCallApi('/ap/api/rlp/index', formData, REQUEST_TIMEOUT, async (res) => {
        resData = res;
        graphStore.setTraceData(_.cloneDeep(res));
        // Sprint73_#18.1 : array_xのlengthをチェックする
        if (isRLPHasFewDataPoint(res)) {
            showToastrMsg(i18n.FewDataPointInRLP);
        }

        // show limit graphs displayed message
        if (res.isGraphLimited) {
            showToastrMsg(i18nCommon.limitDisplayedGraphs.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
        }

        // show result section
        $(`#${eles.categoryPlotCards}`).css('display', 'block');

        // disable emd type in chart
        const isDisabledEMD = res.emdType !== EMDType.BOTH;
        $('select[name=filterEmd]').val(res.emdType);
        $('select[name=filterEmd]').prop('disabled', isDisabledEMD);

        // reset yScaleOption value to graph setting
        $(formElements.yScaleOption).val(1);

        // show graphs
        showRidgeLine(res, eleIdPrefix);
        isGraphShown = true;

        // show info table
        showInfoTable(res);

        loadGraphSetings(clearOnFlyFilter);

        // init filter modal
        const { catExpBox, cat_on_demand } = res;
        if (clearOnFlyFilter) {
            clearGlobalDict();
            initGlobalDict(catExpBox);
            initGlobalDict(cat_on_demand);
            initDicChecked(getDicChecked());
            initUniquePairList(res.dic_filter);
        }

        // render cat, category label filer modal
        fillDataToFilterModal(catExpBox || [], [], cat_on_demand, [], [], () => {
            showGraph(false);
        });

        longPolling(formData, () => {
            showGraph(true);
        });
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
        const anchorPosition = $('#showXAxis').parent().parent().offset().top;
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
    $('.ridgeLineItem').removeAttr('style');
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
        });

        // pin as scroll
        scrollRLPChart.load($activeItemDOM);
    }
};

const showXAxisLabel = (element) => {
    const isShowAxis = $(element).is(':checked');
    const comparetype = resData.COMMON.compareType;
    $('#RLPCard .ridgeLineItem').find('.ridgeLineCard-full').each((i, card) => {
        const layout = {
            xaxis: {
                tickvals: isShowAxis ? rlpXAxis[comparetype][i] : [],
            },
            margin: {
                b: isShowAxis ? 23 : 15,
            },
        };
        Plotly.relayout(card.id, layout);
    });
};

const changeRLPScale = () => {
    // on select rlp y-scale option
    const graphScaleSelected = $(formElements.yScaleOption).val();
    const isShowAxis = $(formElements.showXAxisOption).is(':checked');
    const comparetype = resData.COMMON.compareType;
    $('#RLPCard .ridgeLineItem').find('.ridgeLineCard-full').each((i, card) => {
        const variableIDx = Number(card.id.split('-')[1]);
        const layout = {
            xaxis: {
                tickvals: isShowAxis ? rlpXAxis[comparetype][i] : [],
            },
            margin: {
                b: isShowAxis ? 23 : 15,
            },
        };
        const scaleOption = getScaleInfo(resData.array_plotdata[variableIDx], graphScaleSelected);
        const yMin = resData ? scaleOption['y-min'] : undefined;
        const yMax = resData ? scaleOption['y-max'] : undefined;
        if (yMin !== undefined && yMax !== undefined) {
            layout.yaxis = {
                range: [yMin, yMax],
            };
        }
        // for EMD
        let emdArr = resData.emd[i];
        if (scaleOptionConst.COMMON === graphScaleSelected) {
            let allEMDValue = [];
            resData.emd.forEach(e => allEMDValue = [...allEMDValue, ...e]);
            if (allEMDValue.length) {
                emdArr = allEMDValue;
            }
        }
        const EMDRange = [Math.min(...emdArr), Math.max(...emdArr)];
        if (EMDRange) {
            // padding 10% for EMD graph
            const EMDPadding = (EMDRange[1] - EMDRange[0]) * 0.1;
            layout.yaxis2 = {
                range: [EMDRange[0] - EMDPadding, EMDRange[1] + EMDPadding],
            };
        }
        Plotly.relayout(card.id, layout);
    });
};

const dumpData = (type, exportFrom) => {
    const eleIdPrefix = $('select[name=compareType]').val();
    const formData = lastUsedFormData || collectRLPFormData(true, eleIdPrefix);
    formData.set('export_from', exportFrom);

    if (type === EXPORT_TYPE.CSV) {
        exportData('/ap/api/rlp/csv_export', 'csv', formData);
    }

    if (type === EXPORT_TYPE.TSV) {
        exportData('/ap/api/rlp/tsv_export', 'tsv', formData);
    }

    if (type === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard('/ap/api/rlp/tsv_export', formData);
    }
};

const handleExportData = (type) => {
    const eleIdPrefix = $('select[name=compareType]').val();
    const formData = lastUsedFormData || collectRLPFormData(true, eleIdPrefix);
    // validate form
    const validateFlg = isFormDataValid(eleIdPrefix, formData);
    if (validateFlg === 4) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectDivRequiredMessage, i18n.warningTitle);
        return;
    }
    if (validateFlg !== 0) {
        loading.addClass('hide');
        showToastrAnomalGraph();
        return;
    }

    showGraphAndDumpData(type, dumpData);
};
