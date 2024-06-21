/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 20;
const MAX_NUMBER_OF_SENSOR = 20;
const MIN_NUMBER_OF_SENSOR = 0;
let valueInfo = null;
const graphStore = new GraphStore();
const dicTabs = { '#byCategory': 'category', '#byCyclicTerm': 'cyclicTerm', '#byDirectTerm': 'directTerm' };
let resData = null;
let judgeScaleData = {};
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
    condProcSelectedItem: '#categorycond-proc-row select',
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

    const varEndProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp: true,
        isRequired: true,
        hasDiv: true,
        hideStrVariable: true,
        showFilter: true,
        judge: true,
        disableSerialAsObjective: true,
    });
    varEndProcItem(() => {
        onChangeDivInFacet();
    });

    // add endproc
    $('#btn-add-end-proc').click(() => {
        varEndProcItem(() => {
             onChangeDivInFacet();
        });
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
    // default is show cyclicTerm, so disable category and directTerm's content tab
    toggleDisableAllInputOfNoneDisplayEl($('#for-category'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-directTerm'));

    $('#divideOption').trigger('change');


    // add limit after running load_user_setting
    setTimeout(() => {
        // add validations for target period
        validateTargetPeriodInput();
        keepValueEachDivision();
    }, 2000);

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.DIV_NUM, { MAX: 240, MIN: 2, DEFAULT: 120 });

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

const ngRateToColor = (ngRateArray, yScaleFixed=false) => {
    if (ngRateArray) {
        let maxValue = yScaleFixed ? 100 : Math.max(...ngRateArray.map(i => Math.abs(i)));
        let minValue =  yScaleFixed ? 0 : Math.min(...ngRateArray);
        if (maxValue === minValue) {
            maxValue = 100;
            minValue = 0;
        }
        return ngRateArray.map((ngRateValue) => {
            hValue = 120 * (1 - ((ngRateValue - minValue) / (maxValue - minValue)));
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

const createEMDByLine = (emdGroup, emdData, emdColors, nTotalList, labelList) => {
    const fmt = getFmtValueOfArrayTrim5Percent(emdData);
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
        text: labelList,
        name: '', // hoverstring: yvalue + name
        hoverinfo: 'none',
        customdata: {
            isridgline: false,
            count: nTotalList,
            fmt: fmt,
        },
    };
    return [res, fmt];
};

const rlpXAxis = {
    category: [],
    cyclicTerm: [],
    directTerm: [],
};

const judgeXAxis = {
    category: [],
    cyclicTerm: [],
    directTerm: [],
};

let judgeLayout = [];

const showRidgeLine = (res, eleIdPrefix = 'category', isFilterEmd = false) => {
    const rlpCard = $('#RLPCard');
    rlpCard.html('');
    rlpCard.show();

    const numGraphs = res.array_plotdata.length;

    rlpXAxis[eleIdPrefix] = [];
    judgeXAxis[eleIdPrefix] = [];
    judgeLayout = [];

    const rlpItemHeight = `calc(15vw - 1rem)`;
    const { emdType } = res;
    const { compareType } = res.COMMON;
    const startProc = res.COMMON.start_proc;
    // check show axis label
    const showXAxis = $('#showXAxis').is(':checked');

    // generate mock judge data
    let judgeIndex = 0
    if (res.ng_rates) {
        for (const judgeData of res.ng_rates) {
            judgeData.x = res.rlp_xaxis;
            renderJudgeChart(eleIdPrefix, rlpCard, judgeIndex, judgeData, startProc, emdType === EMDType.BOTH ? '1' : '', rlpItemHeight, showXAxis)
            judgeIndex ++;
        }
    }

    Object.keys(res.array_plotdata).forEach((plotName, plotKey) => {
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
                rlpItemHeight, compareType, showType, emdIdx, showXAxis);

            emdIdx += 1;
        }
    });
};

const renderJudgeChart = (eleIdPrefix, rlpCard, idx, judgeData, startProcId, emdType, rlpItemHeight, showXAxis) => {
    const colId = judgeData.end_col_id;
    const ngCondition = `${judgeData.NGCondition} ${judgeData.NGConditionValue}`
    const [CTTile, fromStartProcClass, facetDetailHTML, titleStyle] = genCommonTitleChartInfo(colId, startProcId, judgeData.end_proc_id, judgeData.catExpBox, emdType);
    const cardId = `judgeChart${colId}-${idx}`;
    const cardGroupID = `judgeChartGroup${colId}-${idx}`;
    const showName = `${judgeData.sensor_name}${CTTile} ${ngCondition}`;
    rlpCard.append(`
        <div class="ridgeLineItem judgeChart graph-navi${fromStartProcClass}" id="${cardGroupID}">
             <div class="tschart-title-parent" style="${titleStyle}">
                <div class="tschart-title" style="width: ${rlpItemHeight};">
                   <span title="NG rate [%]">NG rate [%]</span>
                   <span title="${showName}">${showName}</span>
                   ${facetDetailHTML}
               </div>
              </div>
           <div class="ridgeLineCard-full" id="${cardId}" style="height: ${rlpItemHeight};"></div>
           <div class="pin-chart">
               <span class="btn-anchor"
                    data-pinned="false"
                    onclick="pinChart('${cardGroupID}');"><i class="fas fa-anchor"></i></span>
            </div>
        </div>
    `);

    const noneIdxs = judgeData.y.map((rateVal, idx) => rateVal == null ? idx : null).filter(i => i);
    judgeData.x = judgeData.x.filter((x, idx) => !noneIdxs.includes(idx));
    judgeData.y = judgeData.y.filter((y, idx) => !noneIdxs.includes(idx));
    judgeData.count = judgeData.count.filter((c, idx) => !noneIdxs.includes(idx));
    // judgeData.categories = judgeData.categories.filter((cat, idx) => !noneIdxs.includes(idx));
    let [groupName, categories, datetimeCategory, tickTexts, tickVals] = genTickTextAndTickValue(eleIdPrefix, resData.categories, [], resData.rlp_xaxis, 9);
    categories =  categories.filter((y, idx) => !noneIdxs.includes(idx));
    datetimeCategory = datetimeCategory.filter((y, idx) => !noneIdxs.includes(idx));
    judgeXAxis[eleIdPrefix].push(tickVals);

    const markerColor = ngRateToColor(judgeData.y);
    const data = [{
        marker: {
            color: markerColor
            // colorscale: dnJETColorScale,
            // color: judgeData.y
        },
        mode: 'lines+markers',
        type: 'scatter',
        y: judgeData.y,
        x: judgeData.x,
        text: judgeData.count,
        hoverinfo: 'none',
        line: { width: 1, color: '#444444' },
    }];

    const layout = {
        font: { color: 'white' },
        yaxis: {
            type: 'linear',
            ticklen: 4,
            tickmode: 'array',
            showgrid: true,
            gridcolor: '#444444',
            autorange: true,
            // range: [0, 100],
            gridwidth: 1,
            zeroline: true,
            nticks: 5,
            showline: true, // show lines and border here
            linecolor: '#757575',
            linewidth: 0.5,
            mirror: true,
        },
        xaxis: {
            type: 'linear',
            ticklen: 0,
            autorange: false,
            showgrid: true,
            zeroline: true,
            gridcolor: '#444444',
            gridwidth: 1,
            tickmode: 'array',
            ticktext: tickTexts,
            tickvals: showXAxis ? tickVals : [],
            nticks: 20,
            tickfont: {
                size: 9,
            },
            showline: true, // show lines and border here
            linecolor: '#757575',
            linewidth: 1,
            mirror: true,
            range: [0.05, 1.2]
        },
        margin: {
            l: 64,
            r: 10,
            b: showXAxis ? 23 : 15,
            t: 10,
            pad: 5,
        },
        autosize: true,
        showlegend: false,
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
    }

    judgeLayout.push(layout)
    // judgeScaleData[cardId].layout = layout;
    judgeScaleData[cardId] = {
        color: judgeData.y,
        layout,
        data,
    };

    const judgePlot = document.getElementById(cardId);

    Plotly.newPlot(
        cardId,
        data,
        layout,
        {
            ...genPlotlyIconSettings(),
            responsive: true, // responsive
            useResizeHandler: true, // responsive
            style: {width: '100%', height: 250}, // responsive
        },
    );

    judgePlot.on('plotly_hover', (data) => {
        const dataPoint = data.points && data.points[0];
        const y = dataPoint.y;
        const count = dataPoint.text;
        const position =  {x: data.event.pageX - 120, y: data.event.pageY};
        const pointIndex = dataPoint.pointIndex;
        const catName = datetimeCategory.length ? 'Category' : 'Div';
        const catVal = datetimeCategory.length ? datetimeCategory[pointIndex] : categories[pointIndex];
        const hoverInfo = [
            [judgeData.sensor_name, ngCondition],
            ['NG rate', applySignificantDigit(y) + ' %'],
        ];
        if (!datetimeCategory.length) {
            hoverInfo.push(['Div', categories[pointIndex]]);
        } else {
            const [from, to] = datetimeCategory[pointIndex]
                ? datetimeCategory[pointIndex].split(COMMON_CONSTANT.EN_DASH)
                : [null, null];
            if (from && to) {
                hoverInfo.push(['From', from]);
                hoverInfo.push(['To', to]);
            }
        }
        hoverInfo.push(['N', count]);
        genDataPointHoverTable(
            genHoverDataTable(hoverInfo),
            position,
            120,
            true,
            cardId,
        )
    });

    unHoverHandler(judgePlot);
};

const genCommonTitleChartInfo = (colId, startProcId, endProcId, catExpBox, emdType) => {
    const cfgProcess = procConfigs[parseInt(endProcId)] || procConfigs[endProcId];
    const column = cfgProcess.getColumnById(colId);
    const isColCT = column.data_type === DataTypes.DATETIME.name;
    const CTTile = isColCT ? ` (${DataTypes.DATETIME.short}) [sec]` : '';

    catExpBox = catExpBox && _.isArray(catExpBox) ? catExpBox.join(' | ') : catExpBox;

    const fromStartProcClass = String(startProcId) === String(endProcId) ? ' card-active' : '';
    const facetLabel = catExpBox && catExpBox !== 'None' ? catExpBox : '';
    const facetDetailHTML = facetLabel ? `<span class="show-detail cat-exp-box" title="${catExpBox}">${facetLabel}</span>` : '';
    const titleStyle = facetLabel && emdType ? 'width: 80px' : (facetLabel && !emdType || !facetLabel && emdType) ? 'width: 65px' : '';

    return [CTTile, fromStartProcClass, facetDetailHTML, titleStyle]
};


const renderRidgeLine = (rlpCard, eleIdPrefix, res, plotName, startProc, numGraphs, rlpItemHeight, compareType, emdType, emdIdx, showXAxis) => {
    // const originalData = [];
    const ridgelineCardID = `${eleIdPrefix}RLPCard-${plotName}-${emdIdx}`;
    const rlpCardGroupID = `${eleIdPrefix}RLPCardGroup-${plotName}-${emdIdx}`;

    const emdData = res.emd[emdIdx] || [];
    const sensorData = res.array_plotdata[plotName];
    const end_proc_id = sensorData.end_proc_id;

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

    const [CTTile, fromStartProcClass, facetDetailHTML, titleStyle] = genCommonTitleChartInfo(sensorData.sensor_id, startProc, end_proc_id, sensorData.catExpBox, emdType);

    rlpCard.append(`<div class="ridgeLineItem ridgeLineChart graph-navi${fromStartProcClass}" id="${rlpCardGroupID}">
             <div class="tschart-title-parent" style="${titleStyle}">
                <div class="tschart-title" style="width: ${rlpItemHeight};">
                   <span title="${sensorData.proc_name}">${sensorData.proc_name}</span>
                   <span title="${sensorData.sensor_name}">${sensorData.sensor_name}${CTTile}</span>
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

    const props = {
        mBottom: 50,
    };

    const { yMin, yMax } = getYSaleOption(sensorData);
    const yRange = checkTrue(yMax) && checkTrue(yMax) ? [yMin, yMax] : sensorData.rlp_yaxis;

    const [groupName, categories, datetimeCategory, tickTexts, tickVals] = genTickTextAndTickValue(eleIdPrefix, resData.categories, sensorData.ridgelines, sensorData.rlp_xaxis, 9);

    // rlp new layout
    const rlpLayout = rlpByLineTemplate(
        sensorData.sensor_name,
        tickTexts, // categories
        tickVals,
        yRange,
        compareType,
        showXAxis,
        props,
        res.fmt[sensorData.sensor_id],
    );

    // rlp new data
    const rlpData = [];
    const exceptIdx = [];
    const rlpLengh = sensorData.ridgelines.length - 1;
    let nTotalList = [];
    let labelList = [];
    for (let k = 0; k <= rlpLengh; k++) {
        if (sensorData.ridgelines[k].trans_kde.length > -1) {
            const histLabels = sensorData.ridgelines[k].kde_data.hist_labels;
            const ntotal = sensorData.ridgelines[k].data_counts;
            const transKDE = sensorData.ridgelines[k].trans_kde;
            const lineColor = (sensorData.ridgelines[k].data_counts >= 8) ? transRLPColors[k] : '#808080';
            const rlpLabel = datetimeCategory.length ? datetimeCategory[k] : categories[k];
            nTotalList.push(ntotal);
            labelList.push(rlpLabel);
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
    nTotalList = nTotalList.filter((v, i) => !exceptIdx.includes(i));
    labelList = labelList.filter((v, i) => !exceptIdx.includes(i));
    const validRLPXAxis = sensorData.rlp_xaxis.filter((v, i) => !exceptIdx.includes(i)
        && sensorData.ridgelines[i].trans_kde.length);
    const validEMDColor = emdColors.filter((v, i) => !inValidEMDIdx.includes(i));

    // remove emdData in case of data point less than 8
    if (validEMDDat) {
        const [rlpEMD, fmt] = createEMDByLine(validRLPXAxis, validEMDDat, validEMDColor, nTotalList, labelList);
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
        const dpIndex = ('pointIndex' in data.points[0])
            ? data.points[0].pointIndex
            : data.points[0].pointIndices[0];

        // "2022-03-15 07:00 – 2022-03-17 07:00"
        let textValue = '';
        const text = data.points[0].data.text;
        if (data.points[0].data.text) {
            if (_.isArray(text)) {
                textValue = String(text[dpIndex]);
            } else {
                textValue = String(text);
            }
        }
        const label = textValue.split(' – ');
        let dataTable = '';
        const genDataTable = (from, to, yValue, emd = null) => {
            const isDIV = to === undefined;
            let tblContent = '<tr>';
            if (emd) {
                tblContent += genTRItems('EMD', emd);
            }
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
        if (isRLP) {
            const yValue = data.points[0].data.customdata.count || 0;
            dataTable = genDataTable(label[0], label[1], yValue);

        } else {
            const count = data.points[0].data.customdata.count[dpIndex];
            const fmt = data.points[0].data.customdata.fmt;
            const emd = applySignificantDigit(data.points[0].y, 4, fmt);
            dataTable = genDataTable(label[0], label[1], count, emd);
        }

        genDataPointHoverTable(
            dataTable,
            {
                x: data.event.pageX - 120, y: data.event.pageY,
            },
            175,
            true,
            ridgelineCardID,
        );
    };
    hdPlot.on('plotly_hover', (data) => {
        rlpDataTable(data);
    });

    unHoverHandler(hdPlot);
    // report progress
    loadingUpdate(loadingProgressBackend + emdIdx * ((100 - loadingProgressBackend) / (numGraphs || 1)));
};

const genTickTextAndTickValue = (eleIdPrefix, categories, ridgelines, xAxisVals, nticks = 9) => {
     // tmp groups for EMD zero case
    let groupName = [];
    if (categories.length === 1 && categories.length < ridgelines.length) {
        groupName = ridgelines.map(rlp => rlp.cate_name);
    } else {
        groupName = categories;
    }

    if (!(groupName.length === xAxisVals.length)) {
        // In case special dataset, force same length
        // Detail in link: <https://trello.com/c/RvoiSnh0/93-31e-bug-fix-labels-not-displayed-on-hover-and-x-axis-when-decomposing-in-rlp-dev>
        const uniqueGroupName = new Set(groupName);
        uniqueGroupName.delete(null);
        groupName = Array.from(uniqueGroupName);
    }

     const datetimeCategory = [];
    // convert local time if category is datetime
    categories = groupName.map((group) => {
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

     // re-scale groups in x-axes
    let tickVals = [...xAxisVals];
    let tickTexts = [...categories];
    if (nticks > 0) {
        const step = Math.ceil(tickTexts.length / nticks); // nticks = 20, groups = 100 -> step = 5
        const tickIndexs = groupName.map((v, i) => ((i % step === 0) ? i : null)).filter(i => i !== null);
        tickTexts = categories.filter((v, i) => tickIndexs.includes(i));
        tickTexts = tickTexts.map(tick => (_.isString(tick) ? tick.replace('|', '<br>~') : tick));
        tickVals = tickVals.filter((v, i) => tickIndexs.includes(i));
    }

    return [groupName, categories, datetimeCategory, tickTexts, tickVals];
}

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

const collectRLPFormData = (clearOnFlyFilter, eleIdPrefix, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
    const traceForm = $(eles.mainFormId);
    let formData = new FormData(traceForm[0]);

    if (clearOnFlyFilter) {
        // reformat formdata
        formData = reformatFormData(eleIdPrefix, formData);
        formData = transformFacetParams(formData);
        formData = transformCategoryTraceTime(formData, eleIdPrefix);
        formData = genDatetimeRange(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }

    // set key for jump_func
    formData.set('function_real', 'median');
    formData.set('mode', '7');
    formData.set('step', '4');
    formData.set('function_cate', 'median');
    formData.set('function_real', 'median');
    formData.set('client_timezone', detectLocalTimezone());

    return formData;
};

const showGraph = (clearOnFlyFilter = true, autoUpdate = false) => {
    requestStartedAt = performance.now();
    const eleIdPrefix = $('select[name=compareType]').val();
    if (clearOnFlyFilter) {
        // reset show x axis switch
        $('#categoryShowOutlier').prop('checked', false);
        const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
        updateStyleOfInvalidElements();

        if (!isValid) return;
    }

    // close sidebar
    beforeShowGraphCommon(clearOnFlyFilter);

    if (clearOnFlyFilter) {
         resetCheckedCats();
    }

    let formData = collectRLPFormData(clearOnFlyFilter, eleIdPrefix, autoUpdate);

    // validate form
    const validateFlg = isFormDataValid(eleIdPrefix, formData);
    if (validateFlg === 4) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectDivRequiredMessage);
        return;
    }
    if (validateFlg !== 0) {
        loadingHide();
        showToastrAnomalGraph();
        return;
    }

    if (clearOnFlyFilter) {
        resetGraphSetting();
    }

    showGraphCallApi('/ap/api/rlp/index', formData, REQUEST_TIMEOUT, async (res) => {
        res = sortResponseData(res);
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

        // show graphs
        showRidgeLine(res, eleIdPrefix);
        isGraphShown = true;

        // show info table
        showInfoTable(res);

        if (!autoUpdate) {
             $('html, body').animate({
                scrollTop: $('#RLPCard').offset().top,
            }, 1000);
        };

        // render cat, category label filer modal
        fillDataToFilterModal(res.filter_on_demand, () => {
            showGraph(false);
        });

        setPollingData(formData, showGraph, [false, true]);
    });
};

const sortResponseData = (res) => {
    if (!latestSortColIds.length || !res.array_plotdata) return res;
    // attach emd to each plotData
    let index = 0;
    for (let i = 0; i < res.array_plotdata.length; i += 1) {
        res.array_plotdata[i].emd = []
        if (res.emdType === 'both') {
            for (let j = 0; j < 2; j+=1) {
                res.array_plotdata[i].emd.push(res.emd[index]);
                index ++;
            }
        } else {
            res.array_plotdata[i].emd = [res.emd[i]];
        }
    }

    res.array_plotdata = sortGraphs(res.array_plotdata, 'sensor_id', latestSortColIds);
    res.emd = []
    for (let i = 0; i < res.array_plotdata.length; i += 1) {
        res.emd.push(...res.array_plotdata[i].emd);
    }

    return res;
};

const handleSortGraphPosition = () => {
    loadingShow();
    const eleIdPrefix = resData.COMMON.compareType;
    resData = sortResponseData(resData);
    showRidgeLine(resData, eleIdPrefix);
    loadingHide();
}


const resetGraphSetting = () => {
     // reset yScaleOption value to graph setting
    $(formElements.yScaleOption).val(1);
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
        if (!$stickies.closest('.card').length) return;
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
    $('#RLPCard .ridgeLineChart').find('.ridgeLineCard-full').each((i, card) => {
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

    $('#RLPCard .judgeChart').find('.ridgeLineCard-full').each((i, card) => {
        const layout = judgeLayout[i];
        layout.xaxis.tickvals = isShowAxis ? judgeXAxis[comparetype][i] : [];
        layout.margin.b = isShowAxis ? 23 : 15;
        Plotly.relayout(card.id, layout);
    });
};

const getYSaleOption = (scaleData) => {
    const graphScaleSelected = $(formElements.yScaleOption).val();
    const scaleOption = getScaleInfo(scaleData, graphScaleSelected);
    const yMin = scaleOption ? scaleOption['y-min'] : undefined;
    const yMax = scaleOption ? scaleOption['y-max'] : undefined;
    return {
        yMin,
        yMax
    }
};

const changeRLPScale = () => {
    // on select rlp y-scale option
    const graphScaleSelected = $(formElements.yScaleOption).val();
    const isShowAxis = $(formElements.showXAxisOption).is(':checked');
    const comparetype = resData.COMMON.compareType;
    $('#RLPCard .ridgeLineChart').find('.ridgeLineCard-full').each((i, card) => {
        const variableIDx = Number(card.id.split('-')[1]);
        const layout = {
            xaxis: {
                tickvals: isShowAxis ? rlpXAxis[comparetype][i] : [],
            },
            margin: {
                b: isShowAxis ? 23 : 15,
            },
        };
        const { yMin, yMax } = getYSaleOption(resData.array_plotdata[variableIDx])
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
    // for NG rate
    $('#RLPCard .judgeChart ').find('.ridgeLineCard-full').each((i, card) => {
        let {layout, color} = judgeScaleData[card.id];
        // deeply clone origin data with colorscale
        let data = _.cloneDeep(judgeScaleData[card.id].data);
        // set default y axis range
        layout.yaxis.autorange = true;
        let isCommonScale = scaleOptionConst.COMMON === graphScaleSelected;
        if (isCommonScale) {
            layout.yaxis.autorange = false;
            layout.yaxis.range = [0, 100];
            data[0].marker.color = ngRateToColor(color, isCommonScale);
        }
        Plotly.react(card.id, data, layout);
    });
};

const dumpData = (type, exportFrom) => {
    const eleIdPrefix = $('select[name=compareType]').val();
    const formData = lastUsedFormData || collectRLPFormData(true, eleIdPrefix);
    formData.set('export_from', exportFrom);

    if (type === EXPORT_TYPE.CSV) {
        exportData('/ap/api/rlp/data_export/csv', 'csv', formData);
    }

    if (type === EXPORT_TYPE.TSV) {
        exportData('/ap/api/rlp/data_export/tsv', 'tsv', formData);
    }

    if (type === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard('/ap/api/rlp/data_export/tsv', formData);
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
        showToastrMsg(i18n.selectDivRequiredMessage);
        return;
    }
    if (validateFlg !== 0) {
        loading.addClass('hide');
        showToastrAnomalGraph();
        return;
    }

    showGraphAndDumpData(type, dumpData);
};
