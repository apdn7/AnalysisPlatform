/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(60000); // 1 minutes
const MAX_END_PROC = 2;
let tabID = null;
const graphStore = new GraphStore();
// eslint-disable-next-line camelcase
let is_sse_listening = false;
let lastUsedFormData;
let response = null;

const MAX_MATRIX = 7;
let currentMatrix = MAX_MATRIX;

const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    divideOption: '#divideOption',
    changeDivideConfirmForm: '#changeCompareTypeConfirm',
    changeDivideConfirmOk: '#changeCompareTypeConfirmOK',
    changeDivideConfirmCancel: '#changeCompareTypeConfirmCancel',
    changeDivInFacetConfirm: '#changeDivInFacetConfirm',
    changeDivInFacetConfirmOK: '#changeDivInFacetConfirmOK',
    changeDivInFacetConfirmCancel: '#changeDivInFacetConfirmCancel',
    changeDivConfirmationText: '#changeDivConfirmationText',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcReg: /cond_proc/g,
    NO_FILTER: 'NO_FILTER',
};

const scpChartType = {
    SCATTER: 'scatter',
    HEATMAP: 'heatmap',
    VIOLIN: 'violin',
};

const chartScales = {
    1: 'scale_setting',
    2: 'scale_common',
    3: 'scale_threshold',
    4: 'scale_auto',
    5: 'scale_full',
};

const colorOrders = {
    0: 'colors',
    1: 'settingColors',
    2: 'time_numberings',
    3: 'elapsed_time',
};

const colorScales = {
    SETTING: 'scale_setting',
    COMMON: 'scale_common',
    THRESHOLD: 'scale_threshold',
    AUTO: 'scale_auto',
    FULL: 'scale_full',
};

const els = {
    category: 'category',
    cyclicTerm: 'cyclicTerm',
    directTerm: 'directTerm',
    dataNumberTerm: 'dataNumberTerm',
    catExpBoxName: 'catExpBox',
    divideOption: 'compareType',
    scpColorOrder: 'scpColorOrder',
    scpColorScale: 'scpColorScale',
    showBackward: 'showBackward',
    scpChartScale: 'scpChartScale',
    colNumber: 'colNumber',
};

const i18n = {
    total: $('#i18nTotal')
        .text(),
    average: $('#i18nAverage')
        .text(),
    frequence: $('#i18nFrequence')
        .text(),
    warning: $('#i18nWarning')
        .text(),
    gaUnable: $('#i18nGAUnable')
        .text(),
    gaCheckConnect: $('#i18nGACheckConnect')
        .text(),
    warningTitle: $('#i18nWarningTitle')
        .text(),
    traceResulLimited: $('#i18nTraceResultLimited')
        .text() || '',
    SQLLimit: $('#i18nSQLLimit')
        .text(),
    allSelection: $('#i18nAllSelection')
        .text(),
    noFilter: $('#i18nNoFilter')
        .text(),
    machineNo: $('#i18nMachineNo')
        .text(),
    partNo: $('#i18nPartNo')
        .text(),
    changeDivConfirmText: $('#i18nChangeDivConfirmText')
        .text(),
    colorWarningMessage: $('#i18nColorWarningMessage')
        .text(),
    changedToMaxValue: $('#i18nChangedDivisionNumberToMax')
        .text(),
    reduceViolinNumberMessage: $('#i18nReduceViolinNumberMessage')
        .text(),
    limitPerGraphMessage: $('#i18nLimitPerGraphMessage')
        .text(),
    traceTimeLatestWarning: $('#i18nDivByNumberAndLatest').text(),
};

const CONST = {
    RED: 'rgba(255,0,0,1)',
    BLUE: 'rgba(101, 197, 241, 1)',
    WHITE: 'rgba(255,255,255,1)',
    COLORBAR: {
        fontsize: 13,
    },
    BGR_COLOR: '#222222',
    DEFAULT: '#89b368',
};

const sortMatrixFunc = (a, b, asc = false, key = 'sort_key') => {
    let output1 = -1;
    let output2 = 1;
    if (asc) {
        output1 = 1;
        output2 = -1;
    }
    if (a[key] === b[key]) {
        if (key === 'v_label') {
            return 0;
        }
        return sortMatrixFunc(a, b, asc, 'v_label');
    }

    if (a[key] > b[key]) {
        return output1;
    }

    return output2;
};


const genGraph1DMatrix = (inputGraphs, asc = false) => {
    const matrix = Array(currentMatrix).fill().map(() => Array(currentMatrix).fill(null));
    const graphs = inputGraphs.sort((a, b) => sortMatrixFunc(a, b, asc));
    for (let i = 0; i < graphs.length; i++) {
        matrix[Math.floor(i / currentMatrix)][i % currentMatrix] = graphs[i];
    }

    return matrix;

}
const gen2DMatrixTitle = (graphs) => {
    const cols = [];
    const rows = [];
    for (const graph of graphs) {
        if (!cols.includes(graph.h_label)) {
            cols.push(graph.h_label);
        }
        if (!rows.includes(graph.v_label)) {
            rows.push(graph.v_label);
        }
    }
    rows.sort();
    return [rows, cols];
};

const genGraph2DMatrix = (inputGraphs, asc = false) => {
    const matrix = Array(currentMatrix).fill().map(() => Array(currentMatrix).fill(null));
    // TODO : truyen asc vao
    const graphs = inputGraphs.sort((a, b) => sortMatrixFunc(a, b, true));
    const [rows, cols] = gen2DMatrixTitle(graphs);
    for (const graph of graphs) {
        const col = cols.indexOf(graph.h_label);
        const row = rows.indexOf(graph.v_label);
        matrix[row][col] = graph;
    }

    if (!asc) {
        matrix.reverse();
        for (const graph of matrix) {
            graph.reverse();
        }
        rows.reverse();
        cols.reverse();
    }
    // if (!asc) {
    //     const outputMatrix = [];
    //     for (let graph of matrix.reverse()) {
    //         outputMatrix.push(graph.reverse())
    //     }
    //     return outputMatrix;
    // }

    return [matrix, rows, cols];
};

const genGraphMatrix = (inputGraphs, isShowVLabel, asc = false) => {
    if (isShowVLabel) {
        return genGraph2DMatrix(inputGraphs, asc);
    }
    return [genGraph1DMatrix(inputGraphs, asc), null, null]
};

const onChangeDivisionNumber = () => {
    // with facet 1 <= value <= 7
    // without facet 1 <= value <= 49
    // If value exceed the max, changed to max anh show messenger
    const MAX_F = 7;
    const MAX_WF = 49;
    const MIN_VALUE = 1;
    $(`input[name=${CYCLIC_TERM.DIV_NUM}]`)
        .on('change', (e) => {
            // uncheck if disable
            if (e.target.disabled) return;

            const value = Number(e.currentTarget.value);
            const formdata = collectFormData(formElements.formID);
            const facets = formdata.getAll(els.catExpBoxName)
                .filter(e => e);
            const hasFacet = facets.length > 0;

            if (hasFacet && value > MAX_F) {
                e.currentTarget.value = MAX_F;
                showToastrMsg(i18n.changedToMaxValue, i18nCommon.warningTitle);
            } else if (!hasFacet && value > MAX_WF) {
                e.currentTarget.value = MAX_WF;
                showToastrMsg(i18n.changedToMaxValue, i18nCommon.warningTitle);
            }

            if (!value || value < MIN_VALUE) {
                e.currentTarget.value = MIN_VALUE;
                showToastrMsg(i18n.changedToMaxValue, i18nCommon.warningTitle);
            }
        });
};

const onChangeTraceTimeDivisionByNumber = () => {
    $('input[name=varTraceTime2]').on('change', (e) => {
        const traceOption = e.currentTarget.value;
        if (traceOption === TRACE_TIME_CONST.RECENT && !e.target.disabled) {
            showToastrMsg(i18n.traceTimeLatestWarning);
        }
    });
};

const onChangeDivideOption = () => {
    let selectedCatExpBox = [];
    $(formElements.divideOption)
        .on('change', (e) => {
            // check if there Div was selected.
            selectedCatExpBox = $(`select[name=${els.catExpBoxName}] option:selected`)
                .filter((i, el) => el.value);
            const isSelectedDiv = [...selectedCatExpBox].map(el => el.value)
                .includes(facetLevels.DIV);
            const { value } = e.currentTarget;
            if (value !== els.category && isSelectedDiv) {
                $(formElements.changeDivideConfirmForm)
                    .modal()
                    .toggle();
            }
        });

    // when click cancel, let app select category divide.
    $(formElements.changeDivideConfirmCancel)
        .click(() => {
            $(formElements.divideOption)
                .val(els.category)
                .trigger('change');
        });

    // When click ok, the app clear selected Div and change divide option
    $(formElements.changeDivideConfirmOk)
        .click(() => {
            selectedCatExpBox.each((i, el) => {
                if (el.value === facetLevels.DIV) {
                    el.parentNode.value = '';
                }
            });
        });
};

const onChangeDivInFacet = () => {
    let currentSelectedDiv = null;
    $(`select[name=${els.catExpBoxName}]`)
        .on('change', (e) => {
            const { value } = e.currentTarget;
            currentSelectedDiv = $(e.currentTarget);
            const currentDivideOption = $(`select[name=${els.divideOption}]`)
                .val();
            const currentDivideOptionText = $(`select[name=${els.divideOption}] option:selected`)
                .text();

            if (value === facetLevels.DIV && currentDivideOption !== els.category) {
                const confirmText = i18n.changeDivConfirmText.replaceAll('XXX', currentDivideOptionText);
                $(formElements.changeDivConfirmationText)
                    .html(confirmText);
                $(formElements.changeDivInFacetConfirm)
                    .modal()
                    .toggle();
            }

            // trigger change division number
            $(`input[name=${CYCLIC_TERM.DIV_NUM}]`)
                .trigger('change');
        });

    $(formElements.changeDivInFacetConfirmOK)
        .on('click', () => {
            // automatically change divide option to Category
            $(formElements.divideOption)
                .val(els.category)
                .trigger('change');
        });

    $(formElements.changeDivInFacetConfirmCancel)
        .on('click', () => {
            // clear div variable.
            currentSelectedDiv.val('');
        });
};


$(() => {
    // generate tab ID
    while (tabID === null || sessionStorage.getItem(tabID)) {
        tabID = Math.random();
    }

    // hide loading screen
    const loading = $('.loading');
    loading.addClass('hide');

    initializeDateTime();

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, true, true, true, false, false, true);
    endProcItem(() => {
        // show confirm when select Div
        onChangeDivInFacet();
    });


    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc)
        .click(() => {
            condProcItem();
        });


    // check number of sensors in [2,4]
    // setTimeout(addCheckNumberOfSensor, 3000);

    // click even of end proc add button
    $('#btn-add-end-proc')
        .click(() => {
            endProcItem();
            updateSelectedItems();
            addAttributeToElement();
        });

    // Load userBookmarkBar
    $('#userBookmarkBar')
        .show();

    // checkDisableScatterBtn();

    initializeDateTimeRangePicker();
    initializeDateTimePicker();

    onChangeDivisionNumber();
    onChangeDivideOption();

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.WINDOW_LENGTH, CYCLIC_TERM.WINDOW_LENGTH_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.INTERVAL, CYCLIC_TERM.INTERVAL_MIN_MAX);

    // unactivate inputs
    initTargetPeriod();
    toggleDisableAllInputOfNoneDisplayEl($('#for-cyclicTerm'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-directTerm'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-dataNumberTerm'));

    // add limit after running load_user_setting
    setTimeout(() => {
        // add validations for target period
        validateTargetPeriodInput();
        onChangeTraceTimeDivisionByNumber();
    }, 2000);

    // validate required init
    initValidation(formElements.formID);
});

const loading = $('.loading');

const scpTracing = () => {
    const isValid = checkValidations({ min: MAX_END_PROC, max: MAX_END_PROC });
    updateStyleOfInvalidElements();

    if (!isValid) return;
    // close sidebar
    beforeShowGraphCommon();

    removeHoverInfo();

    // show loading screen
    loadingShow();

    // Reset Graph setting
    resetGraphSetting();

    scatterTraceData(true);
    // todo destroy old chart instances

    // mockup SCP result
    $('#sctr-card')
        .html('');
};

const colorTransform = (colorValSets, colorRange, dummyColorSet = false) => {
    // min value -> // hsv 100°, 100%, 100%
    // max value -> // hsv 0°, 100%, 100%
    const rangeVal = (colorRange.maxVal - colorRange.minVal);
    if (dummyColorSet) {
        return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(value => hsv2rgb({
            h: value,
            s: 1,
            v: 1,
        }));
    }
    return colorValSets.map((colorItem) => {
        const value = _.isString(colorItem) ? colorRange.codes.indexOf(colorItem) : colorItem;
        const newVal = (value - colorRange.minVal) * 100 / rangeVal;
        const hValue = Math.round(100 - newVal);
        return hsv2rgb({
            h: hValue,
            s: 1,
            v: 1,
        });
    });
};

const genColorValRange = (colorValSets) => {
    let colorContinuousVal = [];
    let uniqueColors = [];
    // in case of category value
    if (_.isString(colorValSets[0])) {
        // remove duplicated
        uniqueColors = colorValSets.filter(onlyUniqueFilter);
        // ['color1', 'color2', ...]
        uniqueColorCodes = uniqueColors.map((color, k) => k);
        colorContinuousVal = [...colorContinuousVal, ...uniqueColorCodes];
    } else {
        colorContinuousVal = [...colorContinuousVal, ...colorValSets];
    }
    const [minVal, maxVal] = findMinMax(colorContinuousVal);
    return {
        codes: uniqueColors,
        minVal,
        maxVal,
    };
};

const defaultScaleSets = [
    ['0.0', 'rgb(85, 255, 0)'],
    ['0.05', 'rgb(106, 255, 0)'],
    ['0.1', 'rgb(128, 255, 0)'],
    ['0.15', 'rgb(149, 255, 0)'],
    ['0.2', 'rgb(170, 255, 0)'],
    ['0.25', 'rgb(191, 255, 0)'],
    ['0.3', 'rgb(212, 255, 0)'],
    ['0.35', 'rgb(234, 255, 0)'],
    ['0.4', 'rgb(255, 255, 0)'],
    ['0.45', 'rgb(255, 234, 0)'],
    ['0.5', 'rgb(255, 213, 0)'],
    ['0.55', 'rgb(255, 191, 0)'],
    ['0.6', 'rgb(255, 170, 0)'],
    ['0.65', 'rgb(255, 149, 0)'],
    ['0.7', 'rgb(255, 128, 0)'],
    ['0.75', 'rgb(255, 106, 0)'],
    ['0.8', 'rgb(255, 85, 0)'],
    ['0.85', 'rgb(255, 64, 0)'],
    ['0.9', 'rgb(255, 42, 0)'],
    ['0.95', 'rgb(255, 21, 0)'],
    ['1.0', 'rgb(255, 0, 0)']];

const overDataScaleSets = [
    ['0.0', 'rgb(0,0,0)'],
    ['0.5', 'rgb(0, 0, 0)'],
    ['1.0', 'rgb(0, 0, 0)']];

const genColorScaleBar = (colorData, title, customScaleSets = null) => {
    const uniqueColorData = colorData.filter(onlyUniqueFilter);
    const isString = _.isString(uniqueColorData[0]);
    const data = [{
        colorscale: customScaleSets || defaultScaleSets,
        type: 'heatmap',
        z: [uniqueColorData],
        colorbar: {
            title: {
                text: title,
                size: CONST.COLORBAR.fontsize,
            },
        },
    }];
    if (isString) {
        const tempVals = uniqueColorData.map((val, i) => i / uniqueColorData.length);
        data[0].z = [tempVals];
        data[0].colorbar.title.size = 8;
        data[0].colorbar.tickangle = -45;
        data[0].colorbar.tickvals = getNValueInArray(tempVals, 5);
        data[0].colorbar.ticktext = getNValueInArray(uniqueColorData, 5);
    }

    const layout = {
        font: {
            color: CONST.WHITE, // text color
            size: CONST.COLORBAR.fontsize,
        },
        margin: {
            r: 300,
            l: 100,
        },
        xaxis: {
            autorange: false,
            showgrid: false,
            zeroline: false,
            showline: false,
            autotick: false,
            ticks: '',
            showticklabels: false,
        },
        yaxis: {
            showgrid: false,
            zeroline: false,
            showline: false,
            ticks: '',
            showticklabels: false,
        },
        // width: 100,
        padding: {
            r: -100,
            l: -100,
        },
        paper_bgcolor: CONST.BGR_COLOR,
        plot_bgcolor: CONST.BGR_COLOR,
    };
    Plotly.newPlot('coloScaleBar', data, layout, { displayModeBar: false });
};

const genTicksColor = (ticksList) => {
    // getNValueInArray(tempVals, 5);
    const ticks = getNValueInArray(ticksList, 5);
    return ticks;
};

const genThresholds = (layout, col, axis, xRange, yRange) => {
    if (!layout.shapes) {
        layout.shapes = [];
    }
    if (col.x_threshold && col.x_threshold['thresh-low']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: col.x_threshold['thresh-low'],
            y0: yRange[0],
            x1: col.x_threshold['thresh-low'],
            y1: yRange[1],
            line: {
                color: !col.isHideHover ? CONST.RED : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.x_threshold && col.x_threshold['thresh-high']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: col.x_threshold['thresh-high'],
            y0: yRange[0],
            x1: col.x_threshold['thresh-high'],
            y1: yRange[1],
            line: {
                color: !col.isHideHover ? CONST.RED : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.y_threshold && col.y_threshold['thresh-low']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: xRange[0],
            y0: col.y_threshold['thresh-low'],
            x1: xRange[1],
            y1: col.y_threshold['thresh-low'],
            line: {
                color: !col.isHideHover ? CONST.RED : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.y_threshold && col.y_threshold['thresh-high']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: xRange[0],
            y0: col.y_threshold['thresh-high'],
            x1: xRange[1],
            y1: col.y_threshold['thresh-high'],
            line: {
                color: !col.isHideHover ? CONST.RED : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.x_threshold && col.x_threshold['prc-min']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: col.x_threshold['prc-min'],
            y0: yRange[0],
            x1: col.x_threshold['prc-min'],
            y1: yRange[1],
            line: {
                color: !col.isHideHover ? CONST.BLUE : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.x_threshold && col.x_threshold['prc-max']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: col.x_threshold['prc-max'],
            y0: yRange[0],
            x1: col.x_threshold['prc-max'],
            y1: yRange[1],
            line: {
                color: !col.isHideHover ? CONST.BLUE : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.y_threshold && col.y_threshold['prc-min']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: xRange[0],
            y0: col.y_threshold['prc-min'],
            x1: xRange[1],
            y1: col.y_threshold['prc-min'],
            line: {
                color: !col.isHideHover ? CONST.BLUE : 'transparent',
                width: 0.75,
            },
        });
    }
    if (col.y_threshold && col.y_threshold['prc-max']) {
        layout.shapes.push({
            type: 'line',
            xref: axis.xaxis,
            yref: axis.yaxis,
            x0: xRange[0],
            y0: col.y_threshold['prc-max'],
            x1: xRange[1],
            y1: col.y_threshold['prc-max'],
            line: {
                color: !col.isHideHover ? CONST.BLUE : 'transparent',
                width: 0.75,
            },
        });
    }
};

const getHtitle = (showVTitle, showHTitle, isFirstCol, isFirstRow, hTitle, colDat, divType) => {
    let hLabel = '';
    if (showVTitle && !isFirstRow) {
        // in case of first row but no data in div category
        // do not show htitle
        return hLabel;
    }

    // if show V title (group), only show hTitle on first row
    if ((showVTitle && isFirstRow) || (!showVTitle && showHTitle)) {
        // else, if show H title
        hLabel = hTitle ? convertDateToLocal(hTitle) : '';
    }

    if (hLabel && divType && divType === DataTypes.INTEGER.name) {
        // for number division
        hLabel = `Cat${hLabel}`;
    }

    return hLabel;
};

const genScatterPlots = (scpDataMatrix, vLabels, hLabels, res, colorScaleOption = undefined,
    colorOrdering = undefined, chartScale = undefined) => {
    const scatterDat = [];
    const colorOrderVar = (colorOrdering === colorOrders[1] ? colorOrders[0] : colorOrdering) || colorOrders[0];
    // console.log(allColorValSets);
    let allColorValSets = [];
    if (!res.is_filtered && [DataTypes.STRING.name, DataTypes.INTEGER.name].includes(res.color_type)) {
        allColorValSets = (res.unique_color && res.unique_color.length && colorOrderVar === colorOrders[0])
            ? res.unique_color[0].unique_categories : [];
    }
    if (!allColorValSets.length || colorOrderVar !== colorOrders[0]) {
        res.array_plotdata.forEach((item) => {
            allColorValSets = [...allColorValSets, ...item[colorOrderVar]];
        });
    }
    let [minColorVal, maxColorVal] = findMinMax(allColorValSets);
    // category color, reassign by key instead of value
    // ['pass', 'fail'] -> [0, 1]
    if (!res.scale_color) {
        const encodingCategoryColor = allColorValSets.map((v, k) => k);
        [minColorVal, maxColorVal] = findMinMax(encodingCategoryColor);
    }
    let minColorRange = minColorVal;
    let maxColorRange = maxColorVal;
    if (colorScaleOption) {
        const scaleColorSettings = res.scale_color ? res.scale_color[colorScaleOption] : {};
        const minSettingColorVal = scaleColorSettings['y-min'];
        const maxSettingColorVal = scaleColorSettings['y-max'];
        if (minSettingColorVal) {
            [, minColorRange] = findMinMax([minColorVal, minSettingColorVal]);
        }
        if (maxSettingColorVal) {
            [maxColorRange] = findMinMax([maxColorVal, maxSettingColorVal]);
        }
    }
    const chartOptions = {
        yAxisLabel: res.y_name,
        xAxisLabel: res.x_name,
        colorScaleSets: defaultScaleSets,
        colorVarName: res.color_name,
        colorsValSets: allColorValSets,
        colorOrderVar,
    };
    const layout = genScatterLayout(chartOptions);
    const isShowRow = res.is_show_v_label;
    const isShowCol = res.is_show_h_label;
    // const isShowOnlyFirstCol = res.is_show_first_h_label;

    if (!chartScale) {
        // eslint-disable-next-line no-param-reassign
        chartScale = colorScales.SETTING;
    }
    const xRange = [res.scale_x[chartScale]['y-min'], res.scale_x[chartScale]['y-max']];
    const yRange = [res.scale_y[chartScale]['y-min'], res.scale_y[chartScale]['y-max']];
    const scaleRatio = (xRange[1] - xRange[0]) / (yRange[1] - yRange[0]);
    const layoutAttributes = {
        rowsTotal: scpDataMatrix.length,
        colsTotal: scpDataMatrix[0].length,
        layout,
        xScale: xRange,
        yScale: yRange,
        scaleRatio,
    };
    const canvasID = 'sctr-card';
    // sort in case of plot ordering by color variable only

    const reversedMatrix = [...scpDataMatrix].reverse();
    let reversedVlabels = [];
    if (vLabels) {
        reversedVlabels = [...vLabels].reverse();
    }


    reversedMatrix.forEach((row, r) => {
        row.forEach((col, c) => {
            // todo remove from loop
            let hTitle = col ? col.h_label : '';
            let vTitle = '';
            if (isShowRow) {
                hTitle = hLabels[c];
                vTitle = reversedVlabels[r];
            }
            const isFirstCol = c === 0;
            // const isFirstRow = r === 0;
            const isFirstRow = r === reversedMatrix.length - 1;
            layoutAttributes.vLabel = (isShowRow && isFirstCol) ? vTitle : '';
            layoutAttributes.hLabel = getHtitle(
                isShowRow, isShowCol, isFirstCol, isFirstRow, hTitle, col, res.div_data_type
            );
            layoutAttributes.rowIdx = r;
            layoutAttributes.colIdx = c;
            const axisItem = genLayoutAxis(layoutAttributes, !!col);
            let colors = col ? (col[colorOrderVar] || col.array_x) : [];
            colors = colors.filter(i => i);
            if (layout.coloraxis.colorbar.tickvals) {
                // category colors
                const tickVals = layout.coloraxis.colorbar.tickvals;
                const tickText = layout.coloraxis.colorbar.ticktext;
                colors = colors.map(clr => tickVals[tickText.indexOf(clr)]);
            }

            const traceDataInsideColorRange = {
                array_x: col ? col.array_x : [],
                array_y: col ? col.array_y : [],
                elapsed_time: col ? col.elapsed_time : [],
                times: col ? col.times : [],
                x_serial: col ? col.x_serial : [],
                y_serial: col ? col.x_serial : [],
                color_val: col ? col[colorOrderVar] : [],
            };
            const traceDataOutsideColorRange = {
                array_x: [],
                array_y: [],
                elapsed_time: [],
                times: [],
                x_serial: [],
                y_serial: [],
                color_val: [],
            };
            if (col) {
                if (minColorRange !== minColorVal || maxColorRange !== maxColorVal) {
                    // get keys of color in range
                    const colorKeysInsideOfRange = [];
                    const colorKeysOutsideOfRange = [];
                    const insideArrayX = [];
                    const insideArrayY = [];
                    const insideColorVal = [];
                    const insideElapsedTime = [];
                    const insideTimes = [];
                    const insideXSerial = [];
                    const insideYSerial = [];
                    col[colorOrderVar].forEach((v, k) => {
                        if (v >= minColorRange && v <= maxColorRange) {
                            colorKeysInsideOfRange.push(k);
                            insideColorVal.push(v);
                            insideArrayX.push(col.array_x[k]);
                            insideArrayY.push(col.array_y[k]);
                            insideElapsedTime.push(col.elapsed_time[k]);
                            insideTimes.push(col.times[k]);
                            if (col.x_serial && col.x_serial[k]) {
                                insideXSerial.push(col.x_serial[k]);
                            }
                            if (col.y_serial && col.y_serial[k]) {
                                insideYSerial.push(col.y_serial[k]);
                            }
                        } else {
                            colorKeysOutsideOfRange.push(k);
                            traceDataOutsideColorRange.color_val.push(v);
                            traceDataOutsideColorRange.array_x.push(col.array_x[k]);
                            traceDataOutsideColorRange.array_y.push(col.array_y[k]);
                            traceDataOutsideColorRange.elapsed_time.push(col.elapsed_time[k]);
                            traceDataOutsideColorRange.times.push(col.times[k]);
                            if (col.x_serial && col.x_serial[k]) {
                                traceDataOutsideColorRange.x_serial.push(col.x_serial[k]);
                            }
                            if (col.y_serial && col.y_serial[k]) {
                                traceDataOutsideColorRange.y_serial.push(col.y_serial[k]);
                            }
                        }
                    });
                    if (insideArrayX) {
                        traceDataInsideColorRange.array_x = insideArrayX;
                        traceDataInsideColorRange.array_y = insideArrayY;
                        traceDataInsideColorRange.elapsed_time = insideElapsedTime;
                        traceDataInsideColorRange.times = insideTimes;
                        traceDataInsideColorRange.color_val = insideColorVal;
                        traceDataInsideColorRange.x_serial = insideXSerial;
                        traceDataInsideColorRange.y_serial = insideYSerial;
                    }
                }
            }

            // outside items
            if (traceDataOutsideColorRange.array_x.length) {
                scatterItemOutsideColorRange = {
                    legendgroup: '',
                    marker: {
                        color: traceDataOutsideColorRange.color_val.length
                            ? traceDataOutsideColorRange.color_val : CONST.DEFAULT,
                        symbol: 'circle',
                        // coloraxis: 'coloraxis2',
                        colorscale: overDataScaleSets,
                    },
                    mode: 'markers',
                    name: '',
                    showlegend: false,
                    type: 'scatter',
                    x: traceDataOutsideColorRange.array_x,
                    xaxis: axisItem.xaxis,
                    y: traceDataOutsideColorRange.array_y,
                    yaxis: axisItem.yaxis,
                    hoverinfo: 'none',
                    customdata: {
                        columndata: col,
                        array_x: traceDataOutsideColorRange.array_x,
                        array_y: traceDataOutsideColorRange.array_y,
                        elapsed_time: traceDataOutsideColorRange.elapsed_time,
                        times: traceDataOutsideColorRange.times,
                        colors: traceDataOutsideColorRange.color_val,
                        x_serial: traceDataOutsideColorRange.x_serial,
                        y_serial: traceDataOutsideColorRange.y_serial,
                        htitle: hTitle,
                        vtitle: vTitle,
                    },
                };
                scatterDat.push(scatterItemOutsideColorRange);
            }
            const colorRange = res.scale_color ? traceDataInsideColorRange.color_val : colors;
            const scatterItemInsideColorRange = {
                legendgroup: '',
                marker: {
                    color: colorRange.length ? colorRange : CONST.DEFAULT,
                    symbol: 'circle',
                    coloraxis: 'coloraxis',
                    // coloraxis: colorAxR > 0 ? 'coloraxis2' : 'coloraxis',
                },
                mode: 'markers',
                name: `${vTitle}-${hTitle}`,
                showlegend: false,
                type: 'scatter',
                x: traceDataInsideColorRange.array_x,
                xaxis: axisItem.xaxis,
                y: traceDataInsideColorRange.array_y,
                yaxis: axisItem.yaxis,
                hoverinfo: 'none', // to use custom hover
                customdata: {
                    columndata: col,
                    array_x: traceDataInsideColorRange.array_x,
                    array_y: traceDataInsideColorRange.array_y,
                    elapsed_time: traceDataInsideColorRange.elapsed_time,
                    times: traceDataInsideColorRange.times,
                    colors: traceDataInsideColorRange.color_val,
                    x_serial: traceDataInsideColorRange.x_serial,
                    y_serial: traceDataInsideColorRange.y_serial,
                    htitle: hTitle,
                    vtitle: vTitle,
                },
            };
            if (colorScaleOption === colorScales.AUTO) {
                scatterItemInsideColorRange.marker.colorscale = chartOptions.colorScaleSets;
            }
            scatterDat.push(scatterItemInsideColorRange);

            if (col && (col.x_threshold || col.y_threshold)) {
                genThresholds(layout, col, axisItem, xRange, yRange);
            }
        });
    });

    layout.coloraxis.cmin = minColorVal;
    layout.coloraxis.cmax = maxColorVal;
    if (res.color_type === DataTypes.STRING.name && layout.coloraxis.colorbar.tickvals) {
        layout.coloraxis.colorbar.tickmode = 'array';
        const ticksColor = genTicksColor(layout.coloraxis.colorbar.tickvals);
        layout.coloraxis.colorbar.tickvals = ticksColor;
        [layout.coloraxis.cmin, layout.coloraxis.cmax] = findMinMax(ticksColor);
    } else {
        const customTicks = genLinearColorBar([minColorVal, maxColorVal]);
        layout.coloraxis.colorbar.tickvals = customTicks;
        layout.coloraxis.colorbar.ticktext = customTicks;
    }
    // console.log(scatterDat);
    $(`#${canvasID}`).html('').show();
    Plotly.newPlot(canvasID, scatterDat, layout, { responsive: true });
    const graphDiv = document.getElementById(canvasID);
    $('#sctr-card').off('mousemove').on('mousemove', () => {
        removeHoverInfo();
    });
    graphDiv.on('plotly_hover', (data) => {
        // eslint-disable-next-line no-shadow
        const dataScp = data.points.length
            ? data.points[0] : null;
        if (!dataScp) return;
        const {
            pageX,
            pageY,
        } = data.event;
        const option = {
            compare_type: res.COMMON.compareType,
            div_name: res.div_name,
            color_name: res.color_name,
            x_name: res.x_name,
            y_name: res.y_name,
            x_proc: res.x_proc,
            y_proc: res.y_proc,
        };
        const key = data.points[0].pointIndex;
        setTimeout(() => {
            makeScatterHoverInfoBox(dataScp, option, key, pageX, pageY);
        }, 100);
    });
};

const genLinearColorBar = (colorRange) => {
    const tickValues = [0, 0.25, 0.5, 0.75, 1];
    const stepValues = colorRange[1] - colorRange[0];
    const ticks = tickValues.map(tick => applySignificantDigit(colorRange[0] + tick * stepValues));
    return ticks;
};

// generate scatter hover information
const makeScatterHoverInfoBox = (prop, option, key, pageX, pageY) => {
    if (!prop || !prop.data.customdata.columndata) return;
    const col = prop.data.customdata.columndata;
    const vTitle = prop.data.customdata.vtitle;
    const hTitle = prop.data.customdata.htitle;
    const arxValue = prop.data.customdata.array_x;
    const aryValue = prop.data.customdata.array_y;
    const elapsedTimeValue = prop.data.customdata.elapsed_time;
    const timeValue = prop.data.customdata.times;
    const colorValue = prop.data.customdata.colors;
    const xSerial = prop.data.customdata.x_serial;
    const ySerial = prop.data.customdata.y_serial;
    const [lv1Label, lv2Label] = vTitle ? vTitle.toString()
        .split('|') : [null, null];
    const level1 = lv1Label ? `Lv1 = ${lv1Label}` : '';
    const level2 = lv2Label ? `Lv2 = ${lv2Label}` : '';
    const seperator = (level1 && level2) ? ', ' : '';
    const dataNum = (option.compare_type === els.dataNumberTerm
        && hTitle) ? `<br>Number of data: ${hTitle}` : '';
    const category = option.div_name ? `<br>Category: ${hTitle}` : '';
    const facet = (level1 || level2) ? `<br>Facet: ${level1}${seperator}${level2}` : '';
    const timeStart = col.time_min
        ? moment.utc(col.time_min)
            .local()
            .format(DATE_FORMAT_WITHOUT_TZ) : '';
    const timeEnd = col.time_max ? moment.utc(col.time_max)
        .local()
        .format(DATE_FORMAT_WITHOUT_TZ) : '';
    const getPointTime = pointer => (pointer ? moment.utc(pointer)
        .local()
        .format(DATE_FORMAT_WITHOUT_TZ) : '');
    const genSerialInfor = (xSerials, ySerials, itemIdx) => {
        let serialInfo = '';
        const xProcName = (option.x_proc !== option.y_proc) ? ` @${option.x_proc}` : '';
        const yProcName = (option.x_proc !== option.y_proc) ? ` @${option.y_proc}` : '';
        if (xSerials) {
            xSerials.forEach((serial) => {
                serialInfo += `<br>${serial.col_name}${xProcName}: ${serial.data[itemIdx]}`;
            });
        }
        if (ySerials) {
            ySerials.forEach((serial) => {
                serialInfo += `<br>${serial.col_name}${yProcName}: ${serial.data[itemIdx]}`;
            });
        }
        return serialInfo;
    };
    const itemValue = (i) => {
        const xValue = applySignificantDigit(arxValue[i]);
        const yValue = applySignificantDigit(aryValue[i]);
        if (option.x_proc !== option.y_proc) {
            return `<br>Value:
                <br>${option.x_name}@${option.x_proc} = ${xValue},
                <br>${option.y_name}@${option.y_proc} = ${yValue}`;
        }
        return `<br>Value: ${option.x_name} = ${xValue}, ${option.y_name} = ${yValue}`;
    };
    const serial = genSerialInfor(xSerial, ySerial, key);
    const colorVal = colorValue[key] ? applySignificantDigit(colorValue[key]) : '';
    const color = option.color_name ? `<br>${option.color_name}: ${colorVal}` : '';
    const pointInfo = `
        <div class="scp-hover-info position-absolute" style="top: ${pageY}px; left: ${pageX}px; z-index: 9;">
        Fig info.
        ${dataNum}
        ${category}
        ${facet}
        <br>Time range:
        <br>${timeStart} ${COMMON_CONSTANT.EN_DASH} ${timeEnd}
        <br>N: ${col.n_total}<br>
        <br>Plot info.
        ${serial}
        ${itemValue(key)}
        ${color}
        <br>Time: ${getPointTime(timeValue[key])}
        <br>Elapsed time: ${elapsedTimeValue[key] ? applySignificantDigit(elapsedTimeValue[key]) : ''}
        </div>`;

    removeHoverInfo();
    $('body').append(pointInfo);
    const thisWidth = $('.scp-hover-info').width();
    if ((thisWidth + pageX) >= (window.innerWidth - 100)) {
        $('.scp-hover-info').css({
            left: `${pageX - thisWidth / 2}px`,
        });
    }
};

const removeEmptyFromMatrix = (matrix) => {
    const validRows = matrix.filter(row => row.filter(col => col !== null).length > 0);
    const invalidCols = [];
    // loop cols
    for (let i = 0; i < validRows[0].length; i++) {
        const colValues = validRows.map(row => row[i])
            .filter(col => col !== null);
        if (!colValues.length) {
            invalidCols.push(i);
        }
    }
    for (let i = validRows[0].length; i >= 0; i--) {
        if (invalidCols.includes(i)) {
            validRows.map(row => row.splice(i, 1));
        }
    }

    return validRows;
};

const genVLabels = (vLabels, parentId = 'sctr-card', chartHeight) => {
    if (!vLabels || vLabels.length === 0) {
        return;
    }
    let vLabelHtml = '';
    const step = (chartHeight - 120) / vLabels.length;
    vLabels.forEach((vLabel, i) => {
        const top = i === 0 ? 100 : (i) * step + 100;
        vLabelHtml += `<div class="matrix-level position-absolute" i="${i}" style="height: calc(100% / ${vLabels.length} - 100px);left: 30px; top: ${top}px;"><span class="show-detail">${vLabel}</span></div>`;
    });

    $(`#${parentId}`)
        .append(vLabelHtml);
};

const showSCP = (res, settings = undefined, clearOnFlyFilter = false) => {
    if (res) {
        response = res;
        // remove old hover infor violin and heatmap
        removeHoverInfo();
        $('#colorSettingGrp')
            .show();
        const scpData = res.array_plotdata;
        const chartType = res.chartType || 'scatter';

        // gen matrix
        const isShowFirstLabelH = res.is_show_first_h_label;

        const xName = res.x_name;
        const yName = res.y_name;

        // Reset colorOder to setting colors
        // $(`select[name=${els.scpColorOrder}]`).val('1');
        // reverse array to show latest first
        let zoomRange = null;
        const isShowDate = res.COMMON.compareType === els.cyclicTerm || res.COMMON.compareType === els.directTerm;
        const showGraph = (settings = { isShowForward: false }) => {
            const scpCloneData = JSON.parse(JSON.stringify(scpData));
            const [matrix, vLabels, hLabels] = genGraphMatrix(scpCloneData, res.is_show_v_label, !!settings.isShowForward);
            // todo: reverse v + hlabel + matrix
            const scpMatrix = removeEmptyFromMatrix(matrix);
            // scatter for category and real color
            if (chartType === scpChartType.SCATTER) {
                // scpMatrix.reverse();
                const chartHeight = window.innerHeight - 100;
                $('#sctr-card').height(chartHeight);
                genScatterPlots(scpMatrix, vLabels, hLabels, res, settings.colorScale, settings.colorOrdering, settings.chartScale);
                genVLabels(vLabels, 'sctr-card', chartHeight);
            }
            const divNumber = res.div_name && res.div_data_type === DataTypes.INTEGER.name;
            if (chartType === scpChartType.HEATMAP) {
                genHTMLContentMatrix(scpMatrix, 'sctr-card', xName, yName, isShowFirstLabelH, isShowDate, divNumber);
                const option = {
                    isShowNumberOfData: res.COMMON.compareType === els.dataNumberTerm,
                    isShowFacet: res.is_show_v_label,
                    isShowDiv: res.div_name !== null,
                    hasLv2: res.level_names && res.level_names.length >= 2,
                };
                genHeatMapPlots(scpMatrix, option, zoomRange, (event) => {
                    zoomRange = event;
                    const sets = getCurrentSettings();
                    showGraph(sets);
                });
            }

            if (chartType === scpChartType.VIOLIN) {
                const stringCol = res.string_axis || null;
                genHTMLContentMatrix(scpMatrix, 'sctr-card', xName, yName, isShowFirstLabelH, isShowDate, divNumber, stringCol);
                const scale = res.scale_x || res.scale_y;
                const option = {
                    isShowNumberOfData: res.COMMON.compareType === els.dataNumberTerm,
                    isShowFacet: res.is_show_v_label,
                    hasLv2: res.level_names && res.level_names.length >= 2,
                    isShowDiv: res.div_name !== null,
                    xName: res.x_name,
                    yName: res.y_name,
                };
                genViolinPlots(scpMatrix, option, scale, settings.chartScale || chartScales[1], zoomRange, (event) => {
                    zoomRange = event;
                    const sets = getCurrentSettings();
                    showGraph(sets);
                });
            }

            // hide loadding icon
            loadingHide();

            // scroll to chart
            const scpCardPosition = $('#colorSettingGrp')
                .offset().top;
            $('html,body')
                .animate({ scrollTop: scpCardPosition }, 1000);
            initFilterModal(res, clearOnFlyFilter);
        };

        if (settings) {
            showGraph(settings);
        } else {
            showGraph();
        }

        const onChangeChartScale = () => {
            $(`select[name=${els.scpChartScale}]`)
                .off('change');
            $(`select[name=${els.scpChartScale}]`)
                .on('change', (e) => {
                    if (chartType === scpChartType.HEATMAP) return;
                    loadingShow();
                    setTimeout(() => {
                        const graphsettings = getCurrentSettings();
                        showGraph(graphsettings);
                    }, 1000);
                });
        };

        const onChangeColorOrder = () => {
            $(`select[name=${els.scpColorOrder}]`)
                .off('change');
            $(`select[name=${els.scpColorOrder}]`)
                .on('change', (e) => {
                    if (chartType !== scpChartType.SCATTER) return;
                    loadingShow();
                    setTimeout(() => {
                        $(`select[name=${els.scpColorScale}]`).val('FULL');
                        const graphsettings = getCurrentSettings();
                        callToBackEndAPI(graphsettings);
                    }, 1000);
                });
        };
        const onChangeColorScale = () => {
            $(`select[name=${els.scpColorScale}]`)
                .off('change');
            $(`select[name=${els.scpColorScale}]`)
                .on('change', (e) => {
                    if (chartType !== scpChartType.SCATTER) return;
                    loadingShow();
                    setTimeout(() => {
                        const graphsettings = getCurrentSettings();
                        showGraph(graphsettings);
                    }, 500);
                });
        };
        const onShowBackward = () => {
            $(`input[name=${els.showBackward}]`)
                .off('change');
            $(`input[name=${els.showBackward}]`)
                .on('change', () => {
                    loadingShow();
                    setTimeout(() => {
                        const graphsettings = getCurrentSettings();
                        showGraph(graphsettings);
                    }, 1000);
                });
        };
        const onChangeColNumber = () => {
            $(`select[name=${els.colNumber}]`)
                .off('change')
                .on('change', (e) => {
                    loadingShow();
                    setTimeout(() => {
                        const graphsettings = getCurrentSettings();
                        callToBackEndAPI(graphsettings);
                    }, 500);
                });
        };

        onChangeColorOrder();
        onChangeColorScale();
        onShowBackward();
        onChangeChartScale();
        onChangeColNumber();
    }

    loadingHide();
};
const resetGraphSetting = () => {
    // Reset chart scale
    $(`select[name=${els.scpChartScale}]`).val('1');

    // Reset scpColorScale
    $(`select[name=${els.scpColorScale}]`).val('FULL');

    // Reset colorOder to setting colors
    $(`select[name=${els.scpColorOrder}]`).val('1');

    // Reset backwards
    $(`input[name=${els.showBackward}]`).prop('checked', true);

    // Reset column number
    $(`select[name=${els.colNumber}]`).val(MAX_MATRIX);
    currentMatrix = MAX_MATRIX;

    $('#navigation-bar').hide();
};

const genHTMLContentMatrix = (scpMatrix, cardID, xName, yName, isShowFirstLabelH, isShowDate, isDivNumber, stringCol = null) => {
    let contentDOM = '';
    const totalRow = scpMatrix.length;
    const totalCol = scpMatrix[0].length;
    const firstLabelH = [];
    if (isShowFirstLabelH) {
        for (let i = 0; i < totalCol; i++) {
            for (let j = 0; j < totalRow; j++) {
                const item = scpMatrix[j][i];
                if (item) {
                    firstLabelH[i] = item.h_label === null ? '' : item.h_label;
                }
            }
        }
    }

    for (let i = 0; i < totalRow; i++) {
        let column = '';
        let vLabel = '';
        for (let j = 0; j < totalCol; j++) {
            let width;
            let labelH = '';
            const item = scpMatrix[i][j];
            if (item) {
                vLabel = item.v_label === null ? '' : item.v_label;
            }

            if (totalCol > 1) {
                width = j === 0 ? `calc(100% / ${totalCol} + 24px)` : `calc(100% / ${totalCol} - 6px - ${30 / (totalCol - 1)}px)`;
            } else {
                width = '100%';
            }

            if (isShowFirstLabelH) {
                labelH = i === 0 ? firstLabelH[j] : '';
            } else {
                labelH = item ? item.h_label === null ? '' : item.h_label : '';
            }


            if (isShowDate) {
                labelH = labelH && labelH.split(COMMON_CONSTANT.EN_DASH)
                    .map(vl => formatDateTime(vl.trim()))
                    .join(` ${COMMON_CONSTANT.EN_DASH} `);
            } else if (labelH && isDivNumber) {
                labelH = `Cat${labelH}`;
            }

            const h = `<span class="title label-h" style="height: 18px">${labelH}</span>`;
            const hHtml = isShowFirstLabelH ? labelH ? h : '' : h;

            column += `<div class="sctr-item chart-column graph-navi d-flex flex-column justify-content-end"
            style="height: 100%; width: ${width}; margin: 0 3px;">
                ${hHtml}
                <div id="scp-${i}-${j}" style="width: 100%; flex: 1"></div>
            </div>`;
        }


        const height = i === (totalRow - 1) ? `calc(100% / ${totalRow} + 20px)` : `calc(100% / ${totalRow} - 10px)`;

        contentDOM += `
            <div style="width: 100%; height: ${height}; margin: 3px 0;" class="position-relative">
                <div class="matrix-level"><span class="show-detail">${vLabel}</span></div>
                ${column}
            </div>
        `;
    }

    // if stringCol = null => heatmap else violin
    const showDetailClass = (axis) => {
        if (!stringCol || stringCol === axis) {
            return 'show-detail';
        }

        return '';
    };

    const chartDom = `<div class="scpchart-wrapper d-flex" style="width: 100%; height: 100vh;">
                <div class="flex-grow-1" id="scpChartGrp" style="width: calc(100% - 30px);">
                  <div id="scpchart-content" class="position-relative" style="width: calc(100% - 50px); height:  calc(100% - 20px); margin-left: 50px;">
                    <div class="position-absolute vertical-text" id="scpchart-ytitle">
                        <span class="${showDetailClass('y')}" data-id="${stringCol ? 'color' : 'y'}"
                        title="${yName}">${yName}</span>
                    </div>
                    ${contentDOM}
                     <div id="scpchart-xtitle" class="position-absolute">
                          <span class="${showDetailClass('x')}" data-id="${stringCol ? 'color' : 'x'}"
                          title="${xName}">${xName}</span>
                     </div>
                    </div>
                </div>
                <div class="colorbar ${!stringCol ? 'none-margin' : ''}">
                  <div id="coloScaleBar"></div>
                </div>
        </div>
        `;
    $('#navigation-bar').show();
    $(`#${cardID}`)
        .html(chartDom);
};

const genHeatMapPlots = (scpData, option, zoomRange = null, callback = null) => {
    let allColorValSets = [];
    const allYValues = [];
    const allXValues = [];
    // get common Y of each row
    scpData.forEach((row, i) => {
        let allYValue = [];
        row.forEach((item) => {
            if (item) {
                allYValue = [...allYValue, ...item.array_y];
                item.array_z.forEach((z) => {
                    allColorValSets = [...allColorValSets, ...z.map(y => y)];
                });
            }
        });
        allYValues.push(allYValue.filter(onlyUniqueFilter));
    });

    const [zmin, zmax] = findMinMax(allColorValSets);
    // get common X of each column
    const totalRow = scpData.length;
    for (let i = 0; i < scpData[0].length; i++) {
        let allXValue = [];
        for (let j = 0; j < totalRow; j++) {
            const item = scpData[j][i];
            if (item) allXValue = [...allXValue, ...item.array_x];
        }
        allXValues.push(allXValue.filter(onlyUniqueFilter));
    }

    scpData.forEach((row, i) => {
        row.forEach((item, j) => {
            const canvasID = `scp-${i}-${j}`;
            const graphDiv = document.getElementById(canvasID);
            if (item) {
                item.zmax = zmax;
                item.zmin = zmin;
                item.isShowY = j === 0;
                item.isShowX = i === scpData.length - 1;
                item.canvasId = canvasID;
                generateHeatmapPlot(item, option, zoomRange);
            } else if (!item) {
                const fakeItem = {};
                fakeItem.zmax = zmax;
                fakeItem.zmin = zmin;
                fakeItem.canvasId = canvasID;
                fakeItem.isShowY = j === 0;
                fakeItem.isShowX = i === scpData.length - 1;
                fakeItem.array_x = allXValues[j];
                fakeItem.array_y = allYValues[i];
                fakeItem.array_z = Array(allYValues[i].length)
                    .fill(Array(allXValues[j].length)
                        .fill(-1));
                generateHeatmapPlot(fakeItem, option, zoomRange);
            }
            graphDiv.on('plotly_relayout',
                (eventdata) => {
                    callback(eventdata);
                });

            graphDiv.on('plotly_hover', (data) => {
                setTimeout(() => {
                    $('.scp-hover-info')
                        .remove();
                    const dataScp = scpData[i][j];
                    if (!dataScp) return;
                    const {
                        x,
                        y,
                    } = data.points[0];
                    const {
                        pageX,
                        pageY,
                    } = data.event;
                    makeHeatmapHoverInfoBox(dataScp, x, y, option, pageX, pageY);
                }, 200);
            });

            graphDiv.addEventListener('mouseleave', () => {
                $('.scp-hover-info')
                    .remove();
            });
        });
    });

    genColorScaleBar(allColorValSets, 'Ratio[%]', colorPalettes);
};

const genViolinPlots = (scpData, option, scale, scaleOption, zoomRange = null, callback) => {
    const range = [];
    let yThreshold = null;
    let xThreshold = null;
    if (scaleOption) {
        range[0] = scale[scaleOption]['y-min'];
        range[1] = scale[scaleOption]['y-max'];
    } else {
        range[0] = scale.scale_full['y-min'];
        range[1] = scale.scale_full['y-max'];
    }
    let allColorValSets = [];
    let allColors = [];
    let isHorizontalViolin;
    scpData.forEach((row, i) => {
        row.forEach((item) => {
            if (item) {
                const itemColors = getColors(item);
                allColors = [...allColors, ...itemColors];
                isHorizontalViolin = _.isString(item.array_y[0]);
                if (!yThreshold) yThreshold = item.y_threshold;
                if (!xThreshold) xThreshold = item.x_threshold;
            }
        });
    });
    const uniqueColors = allColors.filter(onlyUniqueFilter);
    const styles = uniqueColors.map((color, k) => ({
        target: color,
        value: {
            line: { color: `#${((1 << 24) * k | 0).toString(16)}` },
        },
    }));

    scpData.map((row, i) => {
        row.map((item, j) => {
            const canvasID = `scp-${i}-${j}`;
            const graphDiv = document.getElementById(canvasID);
            if (item) {
                allColorValSets = [...allColorValSets, ...getColors(item)];
                item.canvasId = canvasID;
                item.isHorizontal = isHorizontalViolin;
                item.styles = styles;
                item.isShowY = j === 0;
                item.isShowX = i === scpData.length - 1;
                item.scale = range;
                item.uniqueColors = uniqueColors;
                if (!isHorizontalViolin) {
                    uniqueColors.forEach((value) => {
                        if (item.array_x.indexOf(value) === -1) {
                            item.array_x.push(value);
                            item.array_y.push([0]);
                        }
                    });
                } else {
                    uniqueColors.forEach((value) => {
                        if (item.array_y.indexOf(value) === -1) {
                            item.array_y.push(value);
                            item.array_x.push([0]);
                        }
                    });
                }
                generateViolinPlot(item, zoomRange);
                allColorValSets = [...allColorValSets, ...getColors(item)];
            } else if (!item) {
                const fakeItem = {};
                if (isHorizontalViolin) {
                    fakeItem.array_y = uniqueColors;
                    fakeItem.array_x = Array(uniqueColors.length)
                        .fill([0]);
                } else {
                    fakeItem.array_x = uniqueColors;
                    fakeItem.array_y = Array(uniqueColors.length)
                        .fill([0]);
                }
                fakeItem.isHorizontal = isHorizontalViolin;
                fakeItem.styles = styles;
                fakeItem.isShowY = j === 0;
                fakeItem.isHideHover = true;
                fakeItem.isShowX = i === scpData.length - 1;
                fakeItem.canvasId = canvasID;
                fakeItem.scale = range;
                fakeItem.uniqueColors = uniqueColors;
                fakeItem.y_threshold = yThreshold;
                fakeItem.x_threshold = xThreshold;
                generateViolinPlot(fakeItem, zoomRange);
            }
            graphDiv.on('plotly_relayout',
                (eventdata) => {
                    callback(eventdata);
                });

            graphDiv.on('plotly_hover', (data) => {
                // eslint-disable-next-line no-shadow
                setTimeout(() => {
                    $('.scp-hover-info')
                        .remove();
                    const dataScp = scpData[i][j];
                    if (!dataScp) return;
                    const {
                        pageX,
                        pageY,
                    } = data.event;
                    const key = dataScp.isHorizontal ? data.points[0].y : data.points[0].x;
                    makeHoverInfoBox(dataScp, key, option, pageX, pageY);
                }, 10);
            });

            graphDiv.addEventListener('mouseleave', () => {
                $('.scp-hover-info')
                    .remove();
            });
        });
    });

    genColorBarForViolin(allColorValSets, styles);
};

const getColors = (data) => {
    // if (data.colors && data.colors.length > 0) {
    //     return data.colors;
    // }
    if (_.isString(data.array_x[0])) {
        return data.array_x;
    }
    return data.array_y;
};

const genColorBarForViolin = (allColors, styles) => {
    const data = [{
        type: 'violin',
        x: allColors,
        box: {
            visible: false,
        },
        opacity: 1,
        // fillcolor: 'transparent',
        transforms: [{
            type: 'groupby',
            groups: allColors,
            styles,
        }],
        showlegend: true,

    }];

    const layout = {
        font: {
            color: 'white',
        },
        margin: {
            r: 300,
            l: 100,
        },
        xaxis: {
            autorange: false,
            showgrid: false,
            zeroline: false,
            showline: false,
            autotick: false,
            ticks: '',
            showticklabels: false,
        },
        yaxis: {
            showgrid: false,
            zeroline: false,
            showline: false,
            ticks: '',
            showticklabels: false,
        },
        width: 100,
        padding: {
            r: -100,
            l: -100,
        },
        paper_bgcolor: '#222222',
        plot_bgcolor: '#222222',
    };


    const config = {
        displayModeBar: false,
    };

    Plotly.newPlot('coloScaleBar', data, layout, config);
};

const shouldChartBeRefreshed = () => {
    // eslint-disable-next-line camelcase
    if (is_sse_listening) {
        return false;
    }
    const autoUpdateInterval = lastUsedFormData.get('autoUpdateInterval');
    if (autoUpdateInterval) {
        // eslint-disable-next-line camelcase
        is_sse_listening = true;
        return true;
    }
    return false;
};


const callToBackEndAPI = (settings = undefined) => {
    const formData = transformFormdata(false);
    if (settings) {
        formData.set('colNumber', settings.colNumber);
        formData.set('scpColorOrder', settings.colorOrderVal);
    }
    // clear old html elements
    $('.scp-hover-info')
        .remove();
    $.ajax({
        url: '/histview2/api/scp/plot',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            loadingShow(true);

            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            showSCP(res, settings);

            // check and do auto-update
            // longPolling();

            // hide loading inside ajax
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
    })
        .then(() => {
            loadingHide();
            afterRequestAction();
        });
};

const autoUpdateCharts = () => {
    loadingShow();
    const settings = getCurrentSettings();
    callToBackEndAPI(settings);
};

const validateXYColorType = (formData) => {
    const sensors = [];
    let color = null;
    for (const [key, value] of formData.entries()) {
        if (/GET02_VALS_SELECT/.test(key)) {
            sensors.push(Number(value));
        }

        if (key === 'colorVar') {
            color = Number(value);
        }
    }
    const xType = sensors[0] && $(`#dataType-${sensors[0]}`)
        .val();
    const yType = sensors[1] && $(`#dataType-${sensors[1]}`)
        .val();
    const colorType = color && $(`#dataType-${color}`)
        .val();

    if (xType === DataTypes.STRING.short && yType !== DataTypes.STRING.short) {
        if (colorType !== DataTypes.STRING.short) {
            formData.set('colorVar', sensors[0]);
            return false;
        }
    }

    if (yType === DataTypes.STRING.short && xType !== DataTypes.STRING.short) {
        if (colorType !== DataTypes.STRING.short) {
            formData.set('colorVar', sensors[1]);
            return false;
        }
    }

    if (xType === DataTypes.STRING.short && yType === DataTypes.STRING.short) {
        if (sensors[0] !== color || colorType !== DataTypes.STRING.short) return false;
    }

    return true;
};

const reformatFormData = (divition, formData) => {
    let formatedFormData = formData;
    if (divition === els.category || divition === els.dataNumberTerm) {
        formatedFormData = chooseTraceTimeIntervals(formatedFormData);
    }
    if (divition === els.cyclicTerm) {
        formatedFormData = chooseCyclicTraceTimeInterval(formatedFormData);
    }

    return formatedFormData;
};

const handleSubmit = (clearOnFlyFilter = false, setting = {}) => {
    loadingShow();
    const startTime = runTime();

    scatterTraceData(clearOnFlyFilter, setting);

    // send GA events
    const endTime = runTime();
    const traceTime = endTime - startTime;
    gtag('event', 'trace_time', {
        event_category: 'Trace Data',
        event_label: 'Trace Data',
        value: traceTime,
    });
};

const transformFormdata = (clearOnFlyFilter = null) => {
    const currentDivision = $(`select[name=${els.divideOption}]`)
        .val();
    if (clearOnFlyFilter) {
        const traceForm = $(formElements.formID);
        formData = new FormData(traceForm[0]);
        formData = transformFacetParams(formData);

        formData = transformDatetimeRange(formData);
        formData = reformatFormData(currentDivision, formData);

        // Show warning message if x or y is string type but color is not string.
        if (!validateXYColorType(formData)) {
            showToastrMsg(i18n.colorWarningMessage, i18n.warningTitle);
        }

        syncTraceDateTime(parentId = 'traceDataForm', dtNames = {
            START_DATE: 'START_DATE',
            START_TIME: 'START_TIME',
            END_DATE: 'END_DATE',
            END_TIME: 'END_TIME',
        }, dtValues = {
            START_DATE: formData.get('START_DATE'),
            START_TIME: formData.get('START_TIME'),
            END_DATE: formData.get('END_DATE'),
            END_TIME: formData.get('END_TIME'),
        });

        // convert to UTC datetime to query
        formData = convertFormDateTimeToUTC(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        // transform cat label filter
        formData = transformCatFilterParams(formData);
    }
    return formData;
};

const scatterTraceData = (clearOnFlyFilter, setting = {}) => {
    const formData = transformFormdata(clearOnFlyFilter);

    $.ajax({
        url: '/histview2/api/scp/plot',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            const t0 = performance.now();
            loadingShow();

            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            $('#sctr-card')
                .empty();

            // check result and show toastr msg
            if (isEmpty(res.array_plotdata) || isEmpty(res.array_plotdata[0].array_y)) {
                showToastrAnomalGraph();
            }

            // if (res.actual_record_number > SQL_LIMIT) {
            //     showToastrMsg(i18n.SQLLimit, i18n.warningTitle);
            // }

            // show toastr to inform result was truncated upto 5000
            if (res.is_res_limited) {
                showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE')
                    .join('<br>'), i18n.warningTitle);
            }

            // show reduced violin message
            if (res.is_reduce_violin_number) {
                showToastrMsg(i18n.reduceViolinNumberMessage);
            }

            // show reduced data per graph
            if (res.isDataLimited) {
                showToastrMsg(i18n.limitPerGraphMessage);
            }

            // showScatterCharts(res);
            showSCP(res, setting, clearOnFlyFilter);

            // show info table
            showInfoTable(res);

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);

            // check and do auto-update
            longPolling();

            // move invalid filter
            setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);

            // hide loading inside ajax
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
    })
        .then(() => {
            loadingHide();
            afterRequestAction();
        });

    $('#plot-cards')
        .empty();
};

const initFilterModal = (res, clearOnFlyFilter) => {
    const catExpBox = res.catExpBox || [];
    const uniqueCategories = res.unique_categories || [];
    const uniqueDiv = res.unique_div;
    const uniqueColor = res.unique_color;
    if (clearOnFlyFilter) {
        clearGlobalDict();
        initGlobalDict(catExpBox);
        initGlobalDict(uniqueCategories);
        initGlobalDict(uniqueDiv);
        initGlobalDict(uniqueColor);
    }

    // render cat, category label filer modal
    fillDataToFilterModal(catExpBox, uniqueCategories, uniqueDiv, uniqueColor, () => {
        const setting = getCurrentSettings();
        handleSubmit(false, setting);
    });
};

const longPolling = () => {
    if (shouldChartBeRefreshed()) {
        const source = openServerSentEvent();
        source.addEventListener(serverSentEventType.procLink, (event) => {
            autoUpdateCharts();
        }, false);
    }
};

const getCurrentSettings = () => {
    // get chart axis scale
    const chartScaleVal = $(`select[name=${els.scpChartScale}]`)
        .val();
    const chartScale = chartScales[Number(chartScaleVal)];
    // get colors scale
    const colorScaleVal = $(`select[name=${els.scpColorScale}]`)
        .val();
    const colorScale = colorScales[colorScaleVal];
    // get color ordering
    const colorOrderVal = $(`select[name=${els.scpColorOrder}]`)
        .val();
    const colorOrdering = colorOrders[Number(colorOrderVal)];
    // get backward showing
    const isShowBackward = $(`input[name=${els.showBackward}]`)
        .prop('checked');
    const colNumber = $(`select[name=${els.colNumber}]`)
        .val();
    const isShowForward = !isShowBackward;
    currentMatrix = Number(colNumber);

    return {
        chartScale,
        colorScale,
        colorOrdering,
        isShowForward,
        colNumber,
        colorOrderVal,
    };
};

const isValidDate = value => (isNaN(value) ? moment(value)
    .isValid() : false);

const convertDateToLocal = (hlabel) => {
    if (!hlabel.toString().includes(COMMON_CONSTANT.EN_DASH)) return hlabel;

    const seperateor = ` ${COMMON_CONSTANT.EN_DASH} `;
    const items = hlabel.split(seperateor);
    let isTermGroup = false;
    const hlabels = items.map((item) => {
        if (isValidDate(item)) {
            isTermGroup = true;
            return moment.utc(item)
                .local()
                .format(DATE_FORMAT_WITHOUT_TZ);
        }
        return item;
    });
    // in case of string, do not split 2 line in plot title - return orinal name
    if (!isTermGroup) {
        return hlabel;
    }
    if (hlabels.length > 1) {
        return hlabels.join(`${seperateor}<br>`);
    }
    return hlabels[0];
};

const downloadPlot = () => {
    clearOldScreenShot();
    loadingShow();
    html2canvas(document.getElementById('sctr-card'), {
        scale: 1, logging: true, backgroundColor: '#222222',
    }).then((canvas) => {
        canvas.id = 'tsCanvas';
        document.getElementById('screenshot').appendChild(canvas);
        // generate filename
        const filename = 'screenshot.png';
        const screenshot = document.getElementById('screenshot').querySelectorAll('canvas')[0];
        const targetLink = document.createElement('a');
        if (screenshot) {
            targetLink.setAttribute('download', filename);
            targetLink.href = screenshot.toDataURL();
        }
        loadingHide();
        setTimeout(() => {
            targetLink.click();
            clearOldScreenShot();
        }, 500);
    });
};
const autoScalePlot = () => {
    const sets = getCurrentSettings();
    showSCP(response, sets);
};
const resetAxesPlot = () => {
    $(`select[name=${els.scpChartScale}]`).val('1');
    const sets = getCurrentSettings();
    showSCP(response, sets);
};
const removeHoverInfo = () => {
    // remove old hover info
    $('.scp-hover-info').remove();
};
