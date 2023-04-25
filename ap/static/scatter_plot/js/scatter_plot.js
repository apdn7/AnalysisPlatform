/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_END_PROC = 2;
let tabID = null;
const graphStore = new GraphStore();
let response = null;

const MAX_PLOT = 49;
const MAX_MATRIX = 7;
let currentMatrix = MAX_MATRIX;

const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    divideOption: '#divideOption',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
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
    gaUnable: $('#i18nGAUnable')
        .text(),
    gaCheckConnect: $('#i18nGACheckConnect')
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
    isResampleMsg: $('#i18nViolinResampleMsg').text(),
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
    const rowCount = Math.ceil(MAX_PLOT / currentMatrix);
    const matrix = Array(rowCount).fill().map(() => Array(currentMatrix).fill(null));
    const graphs = inputGraphs.sort((a, b) => sortMatrixFunc(a, b, asc));
    for (let i = 0; i < graphs.length; i++) {
        matrix[Math.floor(i / currentMatrix)][i % currentMatrix] = graphs[i];
    }

    return matrix;
};
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
    const rowCount = Math.ceil(MAX_PLOT / currentMatrix);
    const matrix = Array(rowCount).fill().map(() => Array(currentMatrix).fill(null));
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
    return [genGraph1DMatrix(inputGraphs, asc), null, null];
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
                showToastrMsg(i18n.changedToMaxValue);
            } else if (!hasFacet && value > MAX_WF) {
                e.currentTarget.value = MAX_WF;
                showToastrMsg(i18n.changedToMaxValue);
            }

            if (!value || value < MIN_VALUE) {
                e.currentTarget.value = MIN_VALUE;
                showToastrMsg(i18n.changedToMaxValue);
            }
        });
};

const onChangeTraceTimeDivisionByNumber = () => {
    $('input[name=varTraceTime2]').on('click', (e) => {
        const traceOption = e.currentTarget.value;
        if (traceOption === TRACE_TIME_CONST.RECENT && !e.target.disabled) {
            showToastrMsg(i18n.traceTimeLatestWarning);
        }
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
    const endProcItem = addEndProcMultiSelect(
        endProcs.ids,
        endProcs.names, {
            showDataType: true,
            showStrColumn: true,
            showCatExp: true,
            isRequired: true,
            showColor: true,
            hasDiv: true
        }
    );
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
            endProcItem(() => {
                onChangeDivInFacet();
            });
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
        keepValueEachDivision();
    }, 2000);

    // validate required init
    initValidation(formElements.formID);
});

const loading = $('.loading');

const scpTracing = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ min: MAX_END_PROC, max: MAX_END_PROC });
    updateStyleOfInvalidElements();

    if (!isValid) return;
    // close sidebar
    beforeShowGraphCommon();

    removeHoverInfo();

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

const violinDefaultColorSets = (numOfColors) => {
    const colorStep = Math.floor(360 / numOfColors);
    const defaultColors = [];
    for (let i = 0; i <= numOfColors; i++) {
        let color = hsv2rgb({
            h: i * colorStep,
            s: 0.5,
            v: 1,
        }, true);
        defaultColors.push(color);
    }
    return defaultColors;
};

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

const getHtitle = (showVTitle, showHTitle, isFirstCol, isFirstRow, hTitle, colDat, divType) => {
    if (!colDat) return '';

    let hLabel = '';
    if (showVTitle && !isFirstRow) {
        // in case of first row but no data in div category
        // do not show htitle
        return hLabel;
    }

    // if show V title (group), only show hTitle on first row
    if ((showVTitle && isFirstRow) || (!showVTitle && showHTitle)) {
        // else, if show H title
        hLabel = checkTrue(hTitle) ? convertDateToLocal(hTitle) : '';
    }

    if (checkTrue(hLabel) && divType && divType === DataTypes.INTEGER.name) {
        // for number division
        hLabel = `Cat${hTitle}`;
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
    if (res.unique_color.length && colorOrderVar === colorOrders[0]) {
        const allSetValue = new Set(allColorValSets);
        allColorValSets = res.unique_color[0].unique_categories
            .filter(color => Array.from(allSetValue).includes(color));
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
        xFmt: res.x_fmt || '',
        yFmt: res.y_fmt || '',
        colorFmt: res.color_fmt || '',
    };
    const layout = genScatterLayout(chartOptions);
    const isShowRow = res.is_show_v_label;
    const isShowCol = res.is_show_h_label;
    // const isShowOnlyFirstCol = res.is_show_first_h_label;

    if (!chartScale) {
        // eslint-disable-next-line no-param-reassign
        chartScale = colorScales.SETTING;
    }
    const xRange = calMinMaxYScale(res.scale_x[chartScale]['y-min'], res.scale_x[chartScale]['y-max'], chartScale);
    const yRange = calMinMaxYScale(res.scale_y[chartScale]['y-min'], res.scale_y[chartScale]['y-max'], chartScale);
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
                isShowRow, isShowCol, isFirstCol, isFirstRow, hTitle, col, res.div_data_type,
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
                org_color_val: col ? col.colors : [],
            };
            const traceDataOutsideColorRange = {
                array_x: [],
                array_y: [],
                elapsed_time: [],
                times: [],
                x_serial: [],
                y_serial: [],
                color_val: [],
                org_color_val: [],
            };
            if (col) {
                if (minColorRange !== minColorVal || maxColorRange !== maxColorVal) {
                    // get keys of color in range
                    const colorKeysInsideOfRange = [];
                    const colorKeysOutsideOfRange = [];
                    const insideArrayX = [];
                    const insideArrayY = [];
                    const insideColorVal = [];
                    const insideOrgColor = [];
                    const insideElapsedTime = [];
                    const insideTimes = [];
                    const insideXSerial = [];
                    const insideYSerial = [];
                    col[colorOrderVar].forEach((v, k) => {
                        if (v >= minColorRange && v <= maxColorRange) {
                            colorKeysInsideOfRange.push(k);
                            insideColorVal.push(v);
                            insideOrgColor.push(col.colors[k]);
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
                            traceDataOutsideColorRange.org_color_val.push(col.colors[k]);
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
                        traceDataInsideColorRange.org_color_val = insideOrgColor;
                    }
                }
            }

            // outside items
            if (traceDataOutsideColorRange.array_x.length) {
                scatterItemOutsideColorRange = {
                    legendgroup: '',
                    marker: {
                        color: traceDataOutsideColorRange.color_val.length
                            ? traceDataOutsideColorRange.color_val : CONST.COLOR_NORMAL,
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
                        org_colors: traceDataOutsideColorRange.org_color_val,
                        x_serial: traceDataOutsideColorRange.x_serial,
                        y_serial: traceDataOutsideColorRange.y_serial,
                        htitle: hTitle,
                        vtitle: vTitle,
                        proc_id_x: col && col.end_proc_id,
                        sensor_id_x: col && col.end_col_id,
                        cycle_ids: col && col.cycle_ids,
                        x_threshold: col.x_threshold,
                        y_threshold: col.y_threshold,
                    },
                };
                scatterDat.push(scatterItemOutsideColorRange);
            }
            const colorRange = res.scale_color ? traceDataInsideColorRange.color_val : colors;
            const scatterItemInsideColorRange = {
                legendgroup: '',
                marker: {
                    color: colorRange.length ? colorRange : CONST.COLOR_NORMAL,
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
                    org_colors: traceDataInsideColorRange.org_color_val,
                    x_serial: traceDataInsideColorRange.x_serial,
                    y_serial: traceDataInsideColorRange.y_serial,
                    htitle: hTitle,
                    vtitle: vTitle,
                    proc_id_x: col && col.end_proc_id,
                    sensor_id_x: col && col.end_col_id,
                    cycle_ids: col && col.cycle_ids,
                    x_threshold: col && col.x_threshold,
                    y_threshold: col && col.y_threshold,
                },
            };
            if (colorScaleOption === colorScales.AUTO) {
                scatterItemInsideColorRange.marker.colorscale = chartOptions.colorScaleSets;
            }
            scatterDat.push(scatterItemInsideColorRange);

            if (col && (col.x_threshold || col.y_threshold)) {
                layout.shapes.push(...genThresholds(col.x_threshold, col.y_threshold, axisItem, xRange, yRange));
            }
        });
    });

    layout.coloraxis.cmin = minColorRange;
    layout.coloraxis.cmax = maxColorRange;
    if ([DataTypes.STRING.name, DataTypes.INTEGER.name].includes(res.color_type)
        && layout.coloraxis.colorbar.tickvals) {
        let tickVals = layout.coloraxis.colorbar.tickvals;
        if (!tickVals) {
            tickVals = res.unique_color[0].unique_categories;
        }
        layout.coloraxis.colorbar.tickmode = 'array';
        const ticksColor = genTicksColor(tickVals);
        layout.coloraxis.colorbar.tickvals = ticksColor;
        [layout.coloraxis.cmin, layout.coloraxis.cmax] = findMinMax(ticksColor);
    } else {
        const isIntColor = res.color_type === DataTypes.INTEGER.name;
        const customTicks = genLinearColorBar([minColorRange, maxColorRange], isIntColor, chartOptions.colorFmt);
        layout.coloraxis.colorbar.tickvals = customTicks;
        layout.coloraxis.colorbar.ticktext = customTicks;
        // reassign colorbar range to show first tick and last tick
        if (customTicks.length) {
            let colorCMax = customTicks[customTicks.length - 1];
            colorCMax = Number(colorCMax);
            if (colorCMax > layout.coloraxis.cmax) {
                layout.coloraxis.cmax = colorCMax;
            }
            let colorCMin = customTicks[0];
            colorCMin = Number(colorCMin);
            if (colorCMin < layout.coloraxis.cmin) {
                layout.coloraxis.cmin = colorCMin;
            }
        }
    }
    // console.log(scatterDat);
    $(`#${canvasID}`).html('').show();
    const iconSettings = genPlotlyIconSettings();
    const config = {
        ...iconSettings,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };
    Plotly.newPlot(canvasID, scatterDat, layout, config);
    const graphDiv = document.getElementById(canvasID);
    showCustomContextMenu(graphDiv);
    // $('#sctr-card').off('mousemove').on('mousemove', () => {
    //     removeHoverInfo();
    // });
    graphDiv.on('plotly_hover', (data) => {
        let serials = res.serials;
        let datetime = res.datetime;
        // eslint-disable-next-line no-shadow
        const dataScp = data.points.length
            ? data.points[0] : null;
        if (!dataScp) return;
        const {
            pageX,
            pageY,
        } = data.event;
        if ('customdata' in dataScp.data) {
            if (dataScp.data.customdata.x_serial && dataScp.data.customdata.x_serial.length) {
                serials = dataScp.data.customdata.x_serial.map(xserials => xserials.data);
            }
            if (dataScp.data.customdata.times) {
                datetime = dataScp.data.customdata.times;
            }
        }
        const option = {
            compare_type: res.COMMON.compareType,
            div_name: res.div_name,
            color_name: res.color_name,
            x_name: res.x_name,
            y_name: res.y_name,
            x_proc: res.x_proc,
            y_proc: res.y_proc,
            canvas_id: canvasID,
            serials: serials,
            datetime: datetime,
            start_proc: res.start_proc,
        };
        const key = data.points[0].pointIndex;
        setTimeout(() => {
            makeScatterHoverInfoBox(dataScp, option, key, pageX, pageY);
        }, 100);
    });

    unHoverHandler(graphDiv);
    
    // const chartDOM = document.getElementById(canvasID);
    // window.removeEventListener('click', () => {
    // });
    // window.addEventListener('click', (e) => {
    //     $(`#${dpInforID}`).hide();
    // });
};

const genLinearColorBar = (colorRange, isIntColor=false, fmt) => {
    const tickValues = [0, 0.25, 0.5, 0.75, 1];
    const stepValues = colorRange[1] - colorRange[0];
    const newFmt = fmt.includes('e') ? '.1e' : fmt;
    const ticks = tickValues.map((tick) => {
        const tickValue = applySignificantDigit(colorRange[0] + tick * stepValues, 4, newFmt);
        if (isIntColor) {
            return Math.round(tickValue);
        }
        return tickValue;
    });
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
    const orgColorValue = prop.data.customdata.org_colors;
    const xSerial = prop.data.customdata.x_serial;
    const [lv1Label, lv2Label] = vTitle ? vTitle.toString()
        .split('|') : [null, null];
    const level1 = lv1Label ? `Lv1 = ${lv1Label}` : '';
    const level2 = lv2Label ? `Lv2 = ${lv2Label}` : '';
    const seperator = (level1 && level2) ? ', ' : '';
    const dataNo = (option.compare_type === els.dataNumberTerm
        && hTitle) ? hTitle : null;
    const category = option.div_name ? hTitle : null;
    const facet = (level1 || level2) ? `${level1}${seperator}${level2}` : null;
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
    const getPointValue = (i) => {
        const xValue = applySignificantDigit(arxValue[i]);
        const yValue = applySignificantDigit(aryValue[i]);
        return {
            x: xValue,
            y: yValue,
        };
    };
    const getDatetime = (key) => {
        let datetime = getPointTime(option.datetime[key]);
        const fromDiffStartProc = ![option.x_proc, option.y_proc].includes(option.start_proc);
        const xProcName = fromDiffStartProc ? ` @${option.start_proc}` : '';
        datetime += xProcName;
        return datetime;
    };
    const getSerial = (xSerials, itemIdx) => {
        let serialInfo = [];
        const fromDiffStartProc = ![option.x_proc, option.y_proc].includes(option.start_proc);
        const xProcName = fromDiffStartProc ? ` @${option.start_proc}` : '';
        if (xSerials) {
            serialInfo = xSerials.map((serial) => {
                return `${serial[itemIdx]}${xProcName}`;
            });
        }
        return serialInfo;
    };
    const colorVal = orgColorValue[key] ? applySignificantDigit(orgColorValue[key]) : '';
    const pointValue = getPointValue(key);
    const datetime = getDatetime(key);
    const serialValue = getSerial(option.serials, key);
    const xthreshold = prop.x_threshold;
    const ythreshold = prop.y_threshold;
    showSCPDataTable(
        {
            x: pointValue.x,
            y: pointValue.y,
            color: option.color_name ? colorVal : '',
            datetime,
            serial: serialValue,
            elapsed_time: elapsedTimeValue[key]
                ? applySignificantDigit(elapsedTimeValue[key])
                : '',
            from: timeStart,
            to: timeEnd,
            n_total: col.n_total,
            data_no: dataNo,
            category,
            facet,
            xthreshold,
            ythreshold,
        }, {
            x: pageX - 160,
            y: pageY,
        },
        option.canvas_id,
        'scatter',
    );
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

const genVLabels = (vLabels, parentId = 'sctr-card', chartHeight, figSize, xName, yName) => {
    // remove all rendered html
    $('.scp-html-tag').remove();

    // gen x_name y_name;
    const XYHtml = `
        <div class="position-absolute vertical-text scp-html-tag" id="scpchart-ytitle" style="left: -20px">
           <span title="${yName}">${yName}</span>
        </div>
        <div id="scpchart-xtitle" class="position-absolute scp-html-tag" style="bottom: 20px">
           <span title="${xName}">${xName}</span>
        </div>
    `;

    $(`#${parentId}`)
        .append(XYHtml);


    if (!vLabels || vLabels.length === 0) {
        return;
    }
    let vLabelHtml = '';
    const step = (chartHeight - 30) / vLabels.length;
    const spaceY = chartHeight * SCATTER_MARGIN.Y_NORMAL;
    vLabels.forEach((vLabel, i) => {
        const top = i === 0 ? spaceY + 30 : (i * step + spaceY);
        vLabelHtml += `<div id="scp-vlabel-${i}" class="matrix-level cat-exp-box position-absolute scp-html-tag" i="${i}" style="height: calc(100% / ${vLabels.length} - 100px);left: 60px; top: ${top}px;"><span class="show-detail" style="max-width: 70px; line-height: 1">${vLabel}</span></div>`;
    });

    $(`#${parentId}`)
        .append(vLabelHtml);

    // set width of label <= fig size
    vLabels.forEach((vla, i) => {
       const s = $(`#scp-vlabel-${i} span`);
       if (s.width() > figSize - 20) {
           s.width(figSize - 20)
       }
    });
};

const setChartSize = (scpMatrix, chartHeight, hasColorbar, hTileISBreakLine) => {
    SCATTER_MARGIN.X_NORMAL = X_NORMAL;
    SCATTER_MARGIN.Y_NORMAL = Y_NORMAL;

    const MIN_X_MARGIN = 70;
    const MIN_Y_MARGIN = 35;

    const nRow = scpMatrix.length;
    const nCol = scpMatrix[0].length;
    const xPage = $('#sctr-card').parent().width();
    const yPage = chartHeight;
    const xM1 = 70;
    const xM3 = hasColorbar ? 170 : 130;
    const chartWidth = xPage - xM1 - xM3;
    const xM2 = chartWidth * SCATTER_MARGIN.X_NORMAL;
    let xFig = (chartWidth - xM2 * (nCol - 1)) / nCol;

    const hOffset = 90;
    const chartH = yPage - hOffset;
    const yM2 = chartH * SCATTER_MARGIN.Y_NORMAL > MIN_Y_MARGIN ? MIN_Y_MARGIN : chartH * SCATTER_MARGIN.Y_NORMAL;
    let yFig = (chartH - yM2 * (nRow - 1)) / nRow;

    // Aspect ratio 1:1
    xFig = xFig > yFig ? yFig : xFig;
    yFig = yFig > xFig ? xFig : yFig;

    // Actual page layout
    let actualXPage = xFig * nCol + xM1 + xM3 + xM2 * (nCol - 1);
    let actualYPage = yFig * nRow + hOffset + yM2 * (nRow - 1);

     if (actualXPage * SCATTER_MARGIN.X_NORMAL < MIN_X_MARGIN) {
        const addMargin = (MIN_X_MARGIN - (actualYPage * SCATTER_MARGIN.X_NORMAL)) * (nCol - 1);
         if (actualXPage + addMargin < xPage) {
              actualXPage += addMargin;
              SCATTER_MARGIN.X_NORMAL = MIN_X_MARGIN / actualXPage;
         }

    }


    if ( hTileISBreakLine && actualYPage * SCATTER_MARGIN.Y_NORMAL < MIN_Y_MARGIN) {
        const addMargin = (MIN_Y_MARGIN - (actualYPage * SCATTER_MARGIN.Y_NORMAL)) * (nRow - 1);
        actualYPage += addMargin;
        SCATTER_MARGIN.Y_NORMAL = MIN_Y_MARGIN / actualYPage;
    }

    if (actualYPage * SCATTER_MARGIN.Y_NORMAL > MIN_Y_MARGIN) {
         SCATTER_MARGIN.Y_NORMAL = MIN_Y_MARGIN / actualYPage;
    }

    $('#sctr-card').height(actualYPage);
    $('#sctr-card').width(actualXPage);
    $('#sctr-card').css({maxWidth: `calc(100vw - 100px)`});

    return [actualYPage, xFig];
};

const resetChartSize = () => {
    $('#sctr-card').removeAttr('style');
};

const showSCP = async (res, settings = undefined, clearOnFlyFilter = false) => {
    if (!res.array_plotdata) {
        loadingHide();
        return;
    }

    if (res) {
        // save global
        graphStore.setTraceData(_.cloneDeep(res));
        // share global var to base.js
        formDataQueried = lastUsedFormData;

        response = res;
        // remove old hover infor violin and heatmap
        removeHoverInfo();
        $('#colorSettingGrp')
            .show();

        $('#sctr-card-parent').show();
        resetChartSize();
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
            $('#navigation-bar').removeAttr('style');
            $(window).off('resize');
            if (chartType === scpChartType.SCATTER) {
                $('#navigation-bar').hide();
                // scpMatrix.reverse();
                let chartHeight = window.innerHeight;
                const oneRowHeight = chartHeight / MAX_MATRIX;
                if (scpMatrix && scpMatrix.length > MAX_MATRIX) {
                    chartHeight = scpMatrix.length * oneRowHeight;
                }
                chartHeight -= 100;
                $('#sctr-card').height(chartHeight);
                let actualHeight;
                let figSize;
                const hasColorBar = res.color_name || (settings.colorOrdering && settings.colorOrdering !== colorOrders[1]);
                const isShowDateTime = [els.cyclicTerm, els.directTerm].includes(res.COMMON.compareType) ;
                [actualHeight, figSize] = setChartSize(scpMatrix, chartHeight, hasColorBar, isShowDateTime);
                genScatterPlots(scpMatrix, vLabels, hLabels, res, settings.colorScale, settings.colorOrdering, settings.chartScale);
                genVLabels(vLabels, 'sctr-card', actualHeight, figSize, res.x_name, res.y_name);

                $(window).on('resize', () => {
                    setTimeout(() => {
                            [actualHeight, figSize] = setChartSize(scpMatrix, chartHeight, hasColorBar, isShowDateTime);
                            genScatterPlots(scpMatrix, vLabels, hLabels, res, settings.colorScale, settings.colorOrdering, settings.chartScale);
                            genVLabels(vLabels, 'sctr-card', actualHeight, figSize, res.x_name, res.y_name);
                            initFilterModal(res, false);
                        },
                        1500)
                });
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
                const option = {
                    isShowNumberOfData: res.COMMON.compareType === els.dataNumberTerm,
                    isShowFacet: res.is_show_v_label,
                    hasLv2: res.level_names && res.level_names.length >= 2,
                    isShowDiv: res.div_name !== null,
                    xName: res.x_name,
                    yName: res.y_name,
                    xFmt: res.x_fmt,
                    yFmt: res.y_fmt,
                };
                genViolinPlots(scpMatrix, option, res.scale_x, res.scale_y, settings.chartScale || chartScales[1], zoomRange, (event) => {
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
            $(`select[name=${els.showBackward}]`)
                .off('change');
            $(`select[name=${els.showBackward}]`)
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
    $(`select[name=${els.showBackward}]`).val('1');

    // Reset column number
    $(`select[name=${els.colNumber}]`).val(MAX_MATRIX);
    $(`select[name=${els.colNumber}]`).attr(CONST.DEFAULT_VALUE, MAX_MATRIX);
    currentMatrix = MAX_MATRIX;
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
                <div class="matrix-level cat-exp-box"><span class="show-detail">${vLabel}</span></div>
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
    let chartDomHeight = 100;
    const oneRowHeight = chartDomHeight / 7;
    if (totalRow > MAX_MATRIX) {
        chartDomHeight = totalRow * oneRowHeight;
    }
    const chartDom = `<div class="scpchart-wrapper d-flex" style="width: 100%; height: ${chartDomHeight}vh;">
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
    $(`#${cardID}`)
        .html(chartDom).css({ height: 'auto' });
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
            option.canvas_id = canvasID;
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

            unHoverHandler(graphDiv);

            graphDiv.addEventListener('mouseleave', () => {
                $('.scp-hover-info')
                    .remove();
            });
        });
    });

    genColorScaleBar(allColorValSets, 'Ratio[%]', colorPalettes);
};

const genViolinPlots = (scpData, option, scaleX, scaleY, scaleOption = chartScales[1], zoomRange = null, callback) => {
    let rangeScaleX = [null, null];
    let rangeScaleY = [null, null];
    let yThreshold = null;
    let xThreshold = null;
    if (scaleOption) {
        rangeScaleX = scaleX && calMinMaxYScale(scaleX[scaleOption]['y-min'], scaleX[scaleOption]['y-max'], scaleOption)
        rangeScaleY = scaleY && calMinMaxYScale(scaleY[scaleOption]['y-min'], scaleY[scaleOption]['y-max'], scaleOption)
    }

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
    const uniqueColors = allColors.map(el => el.toString()).filter(onlyUniqueFilter);
    const violinColors = violinDefaultColorSets(uniqueColors.length);
    const styles = uniqueColors.map((color, k) => ({
        target: color,
        value: {
            // line: { color: `#${Math.floor((1 << 24) * k | 0).toString(16)}` },
            line: { color: `#${uniqueColors.length > 1 ? violinColors[k] : 0}`},
        },
    }));


    scpData.map((row, i) => {
        row.map((item, j) => {
            const canvasID = `scp-${i}-${j}`;
            const graphDiv = document.getElementById(canvasID);
            if (item) {
                item.canvasId = canvasID;
                item.isHorizontal = isHorizontalViolin;
                item.styles = styles;
                item.isShowY = j === 0;
                item.isShowX = i === scpData.length - 1;
                item.rangeScaleX = rangeScaleX;
                item.rangeScaleY = rangeScaleY;
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
                generateViolinPlot(item, zoomRange, option);
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
                fakeItem.rangeScaleX = rangeScaleX;
                fakeItem.rangeScaleY = rangeScaleY;
                fakeItem.uniqueColors = uniqueColors;
                fakeItem.y_threshold = yThreshold;
                fakeItem.x_threshold = xThreshold;
                generateViolinPlot(fakeItem, zoomRange, option);
            }
            graphDiv.on('plotly_relayout',
                (eventdata) => {
                    callback(eventdata);
                });
            option.canvas_id = canvasID;
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

            unHoverHandler(graphDiv);

            graphDiv.addEventListener('mouseleave', () => {
                $('.scp-hover-info')
                    .remove();
            });
        });
    });

    genColorBarForViolin(uniqueColors, styles);
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

const callToBackEndAPI = (settings = undefined, clearOnFlyFilter = false) => {
    const formData = transformFormdata(clearOnFlyFilter);
    if (settings) {
        formData.set('colNumber', settings.colNumber);
        formData.set('scpColorOrder', settings.colorOrderVal);
    }
    // clear old html elements
    $('.scp-hover-info')
        .remove();

    showGraphCallApi('/ap/api/scp/plot', formData, REQUEST_TIMEOUT, async (res) => {
        if (res.is_send_ga_off) {
            showGAToastr(true);
        }

        await showSCP(res, settings);

        // check and do auto-update
        longPolling(formData, () => {
            callToBackEndAPI(settings, true);
        });
    });
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
    let formData;
    if (clearOnFlyFilter) {
        const traceForm = $(formElements.formID);
        formData = new FormData(traceForm[0]);
        formData = transformFacetParams(formData);
        formData = genDatetimeRange(formData);
        // Show warning message if x or y is string type but color is not string.
        if (!validateXYColorType(formData)) {
            showToastrMsg(i18n.colorWarningMessage);
        }
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

    showGraphCallApi('/ap/api/scp/plot', formData, REQUEST_TIMEOUT, async (res) => {
        if (res.is_send_ga_off) {
            showGAToastr(true);
        }

        $('#sctr-card').empty();

        // check result and show toastr msg
        if (isEmpty(res.array_plotdata) || isEmpty(res.array_plotdata[0].array_y)) {
            showToastrAnomalGraph();
        }

        await showSCP(res, setting, clearOnFlyFilter);

        // show toastr to inform result was truncated upto 5000
        if (res.is_res_limited) {
            showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'));
        }

        // show reduced violin message
        if (res.is_reduce_violin_number) {
            showToastrMsg(i18n.reduceViolinNumberMessage);
        }

        // show reduced data per graph
        // only for scatter plot
        if (res.isDataLimited && res.chartType === scpChartType.SCATTER) {
            showToastrMsg(i18n.limitPerGraphMessage);
        }

        // show violin resampling msg
        if (res.is_resampling) {
            showToastrMsg(i18n.isResampleMsg);
        }

        // show info table
        showInfoTable(res);

        loadGraphSetings(clearOnFlyFilter);

        // check and do auto-update
        longPolling(formData, () => {
            const settings = getCurrentSettings();
            callToBackEndAPI(settings, true);
        });
    });

    $('#plot-cards').empty();
};

const initFilterModal = (res, clearOnFlyFilter) => {
    const facetList = [];
    const catExpBox = res.catExpBox || [];
    const uniqueCategories = res.unique_categories || [];
    const uniqueDiv = res.unique_div || [];
    const uniqueColor = res.unique_color || [];
    const catOnDemand = res.cat_on_demand || [];
     if (uniqueDiv && uniqueDiv.length > 0) {
        facetList.push(...uniqueDiv);
    }
    if (catExpBox && catExpBox.length > 0) {
        facetList.push(...catExpBox);
    }
    if (clearOnFlyFilter) {
        clearGlobalDict();
        initGlobalDict(catExpBox);
        initGlobalDict(uniqueCategories);
        initGlobalDict(uniqueDiv);
        initGlobalDict(uniqueColor);
        initGlobalDict(catOnDemand);
        initDicChecked(getDicChecked());
        initUniquePairList(res.dic_filter);
    }

    if (uniqueCategories) {
        uniqueCategories.sort((a, b) => {
            return a.column_master_name < b.column_master_name ? -1 : 1;
        });
    }
    // render cat, category label filer modal
    fillDataToFilterModal(facetList, uniqueCategories, catOnDemand, [], uniqueColor, () => {
        const setting = getCurrentSettings();
        handleSubmit(false, setting);
    });
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
    const isShowBackward = $(`select[name=${els.showBackward}]`).val();

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
const autoScalePlot = async () => {
    const sets = getCurrentSettings();
    await showSCP(response, sets);
};
const resetAxesPlot = async () => {
    $(`select[name=${els.scpChartScale}]`).val('1');
    const sets = getCurrentSettings();
    await showSCP(response, sets);
};

const setDateTimeToForm = (dateTime, formData) => {
    const splitDT = splitDateTimeRange(dateTime);
    // to uct
    const start = toUTCDateTime(splitDT.startDate, splitDT.startTime);
    const end = toUTCDateTime(splitDT.endDate, splitDT.endTime);
    formData.set(CONST.STARTDATE, start.date);
    formData.set(CONST.STARTTIME, start.time);
    formData.set(CONST.ENDDATE, end.date);
    formData.set(CONST.ENDTIME, end.time);
    return formData;
};

const dumpData = (type) => {
    let formData = lastUsedFormData || transformFormdata(true);
    const currentDivision = $(`select[name=${els.divideOption}]`).val();
    if (currentDivision === 'cyclicTerm') {
        const newDateTime = calDateTimeRangeForCyclic(currentDivision);
        formData = setDateTimeToForm(newDateTime, formData);
    } else if (currentDivision === 'directTerm') {
        const newDateTime = calDateTimeRangeForDirectTerm(currentDivision);
        formData = setDateTimeToForm(newDateTime, formData);
    }
    handleExportDataCommon(type, formData);
};
const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};
