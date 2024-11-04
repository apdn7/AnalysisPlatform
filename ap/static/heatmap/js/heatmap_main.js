const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_SENSOR = 2;
const MIN_NUMBER_OF_SENSOR = 2;
let tabID = null;
const graphStore = new GraphStore();
let response = null;
let heatmapData = {};
let currentXY = [];

const MAX_PLOT = 49;
const MAX_MATRIX = 7;
let currentMatrix = MAX_MATRIX;
const STR_PREFIX = '*_/&＠*_$%#';

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
    condProcSelectedItem: '#cond-proc-row select',
    condProcReg: /cond_proc/g,
    NO_FILTER: 'NO_FILTER',
};

const scpChartType = {
    SCATTER: 'scatter',
    HEATMAP: 'heatmap',
    VIOLIN: 'violin',
    HEATMAP_BY_INT: 'heatmap_by_int',
};

const discreteColorType = {
    LAST: 'last',
    FIRST: 'first',
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

const dataTypes = {
    TEXT: 'TEXT',
    INTEGER: 'INTEGER',
    REAL: 'REAL',
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
    hmColorSelect: 'hmColor',
    arrangeDivSwitch: 'arrange-div-switch',
    hmpArrangeDiv: 'hmpArrangeDiv',
};

const i18n = {
    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
    changeDivConfirmText: $('#i18nChangeDivConfirmText').text(),
    colorWarningMessage: $('#i18nColorWarningMessage').text(),
    changedToMaxValue: $('#i18nChangedDivisionNumberToMax').text(),
    reduceViolinNumberMessage: $('#i18nReduceViolinNumberMessage').text(),
    limitPerGraphMessage: $('#i18nLimitPerGraphMessage').text(),
    traceTimeLatestWarning: $('#i18nDivByNumberAndLatest').text(),
    isResampleMsg: $('#i18nViolinResampleMsg').text(),
    i18nGotoSCPMsg: $('#i18nGotoSCPMsg').text(),
    colorScaleSetting: $('#i18nSettingScale').text(),
    colorScaleCommon: $('#i18nCommonScale').text(),
    colorScaleThreshold: $('#i18nThresholdLine').text(),
    colorScaleAuto: $('#i18nAutoRange').text(),
    colorScaleFull: $('#i18nFullRange').text(),
    i18nErrorColorAggFunc: $('#i18nErrorColorAggFunc').text(),
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

const genGraph1DMatrix = (inputGraphs, asc = false, sort_key = 'sort_key') => {
    const rowCount = Math.ceil(MAX_PLOT / currentMatrix);
    const matrix = Array(rowCount)
        .fill()
        .map(() => Array(currentMatrix).fill(null));
    const graphs = inputGraphs.sort((a, b) =>
        sortMatrixFunc(a, b, asc, sort_key),
    );
    for (let i = 0; i < graphs.length; i++) {
        const itemIdx = Math.floor(i / currentMatrix);
        if (itemIdx >= matrix.length) continue;
        matrix[itemIdx][i % currentMatrix] = graphs[i];
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
    const matrix = Array(rowCount)
        .fill()
        .map(() => Array(currentMatrix).fill(null));
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

const genGraphMatrix = (
    inputGraphs,
    isShowVLabel,
    asc = false,
    sort_key = 'sort_key',
) => {
    if (isShowVLabel) {
        return genGraph2DMatrix(inputGraphs, asc);
    }
    return [genGraph1DMatrix(inputGraphs, asc, sort_key), null, null];
};

const onChangeDivisionNumber = () => {
    // with facet 1 <= value <= 7
    // without facet 1 <= value <= 49
    // If value exceed the max, changed to max anh show messenger
    const MAX_F = 7;
    const MAX_WF = 49;
    const MIN_VALUE = 1;
    $(`input[name=${CYCLIC_TERM.DIV_NUM}]`).on('change', (e) => {
        // uncheck if disable
        if (e.target.disabled) return;

        const value = Number(e.currentTarget.value);
        const formdata = collectFormData(formElements.formID);
        const facets = formdata.getAll(els.catExpBoxName).filter((e) => e);
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

// unique filters
const onlyUniqueFilter = (value, index, self) => self.indexOf(value) === index;

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
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp: true,
        isRequired: true,
        showColor: true,
        hasDiv: true,
        hideRealVariable: true,
        showFilter: true,
        disableSerialAsObjective: true,
    });
    endProcItem(() => {
        // show confirm when select Div
        onChangeDivInFacet();
    });

    // add first condition process
    const condProcItem = addCondProc(
        endProcs.ids,
        endProcs.names,
        '',
        formElements.formID,
        'btn-add-cond-proc',
    );
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // check number of sensors in [2,4]
    // setTimeout(addCheckNumberOfSensor, 3000);

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem(() => {
            onChangeDivInFacet();
        });
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

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

const validateDTypesForHMp = () => {
    const selectedVariables = [...$('input[name^=GET02_VALS_SELECT]:checked')];

    const targetVariableTypes = selectedVariables.map((el) =>
        $(`#dataType-${$(el).val()}`).val(),
    );
    const selectedTypes = new Set(targetVariableTypes).size;

    // add case "Cat" and "Str" to show in HMp
    const catStrType = ['Cat', 'Str'];
    const targetVariableShownType = selectedVariables.map((el) =>
        $(el).attr('data-type-shown-name'),
    );

    const isAllowedCatStrType =
        JSON.stringify(catStrType.sort()) ===
        JSON.stringify(targetVariableShownType.sort());

    if (selectedTypes > 1 && !isAllowedCatStrType) {
        // show error msg
        showToastrMsg(i18n.i18nGotoSCPMsg, MESSAGE_LEVEL.ERROR);
        return false;
    }
    // Show error message if not select a color variable and select color map (z-axis) not [Ratio(%)] or [Count]
    const isErrorColorType = checkWrongColorType();
    if (isErrorColorType) {
        showToastrMsg(i18n.i18nErrorColorAggFunc, MESSAGE_LEVEL.ERROR);
        return false;
    }
    return true;
};

const checkWrongColorType = () => {
    // Allow show HMP Heat Map graph with color map (z-axis) is [Ratio(%)] and [Count] when not select color variable
    const includeOtherColor = ['ratio', 'count'];
    const colorVarId = $('[name=colorVar]:checked').val();
    const functionCate = $('#function_cate').val();
    return !colorVarId && !includeOtherColor.includes(functionCate);
};

const hmpTracing = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({
        min: MAX_NUMBER_OF_SENSOR,
        max: MAX_NUMBER_OF_SENSOR,
    });
    updateStyleOfInvalidElements();

    if (!isValid) return;

    const isValidDTypes = validateDTypesForHMp();
    if (!isValidDTypes) return;

    // close sidebar
    beforeShowGraphCommon();

    removeHoverInfo();

    // Reset Graph setting
    resetGraphSetting();

    // save select xy to currentXY
    currentXY = latestSortColIds.slice(-2);

    scatterTraceData(true);
    // todo destroy old chart instances

    // mockup SCP result
    $('#sctr-card').html('');
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
    ['1.0', 'rgb(255, 0, 0)'],
];

const genDiscreteScale = (scale, discreteColors = false) => {
    if (!discreteColors) return scale;
    let discreteScale = [];
    scale.forEach((color, i) => {
        const nextIdx = i + 1;
        if (nextIdx < scale.length) {
            discreteScale = [...discreteScale, color];
            discreteScale = [...discreteScale, [scale[nextIdx][0], color[1]]];
        }
    });
    return discreteScale;
};

const genDiscreteColorBar = (customScaleSets, discreteColors, zrange) => {
    const scale = customScaleSets || defaultScaleSets;
    return [
        {
            colorscale: genDiscreteScale(scale, discreteColors),
            type: 'heatmap',
            z: [discreteColors.map((v, i) => i)],
            zmin: zrange.min,
            zmax: zrange.max,
            colorbar: {
                title: {
                    text: zrange.title,
                    size: CONST.COLORBAR.fontsize,
                },
                tickvals: [discreteColors],
            },
        },
    ];
};
const genColorScaleBar = (
    colorData,
    zmin,
    zmax,
    title,
    customScaleSets = null,
    discreteColors = false,
    height,
) => {
    const uniqueColorData = !discreteColors
        ? colorData.filter(onlyUniqueFilter)
        : discreteColors;
    const isString = _.isString(uniqueColorData[0]);
    const scale = customScaleSets || defaultScaleSets;
    let data = [
        {
            colorscale: scale,
            type: 'heatmap',
            z: [uniqueColorData],
            zmin: zmin,
            zmax: zmax,
            colorbar: {
                title: {
                    text: title,
                    size: CONST.COLORBAR.fontsize,
                },
                len: 1.2,
            },
        },
    ];

    // for heatmap with color is discrete scale
    // if (discreteColors) {
    //     data = genDiscreteColorBar(scale, discreteColors, {min: zmin, max: zmax, title: title});
    // }
    if (isString) {
        const tempVals = uniqueColorData.map(
            // (val, i) => i / (uniqueColorData.length - 1),
            (val, i) => i,
        );
        data[0].z = [tempVals];
        data[0].colorbar.title.size = 8;
        // data[0].colorbar.tickangle = -45;
        data[0].colorbar.tickvals = getNValueInArray(tempVals, 5);
        data[0].colorbar.ticktext = getNValueInArray(uniqueColorData, 5);
    }

    const layout = {
        height: height > 450 ? 450 : height,
        font: {
            color: CONST.WHITE, // text color
            size: CONST.COLORBAR.fontsize,
        },
        margin: {
            r: 300,
            l: 100,
            t: 15,
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

// generate scatter hover information
const removeEmptyFromMatrix = (matrix) => {
    const validRows = matrix.filter(
        (row) => row.filter((col) => col !== null).length > 0,
    );
    const invalidCols = [];
    // loop cols
    for (let i = 0; i < validRows[0].length; i++) {
        const colValues = validRows
            .map((row) => row[i])
            .filter((col) => col !== null);
        if (!colValues.length) {
            invalidCols.push(i);
        }
    }
    for (let i = validRows[0].length; i >= 0; i--) {
        if (invalidCols.includes(i)) {
            validRows.map((row) => row.splice(i, 1));
        }
    }

    return validRows;
};

const resetChartSize = () => {
    $('#sctr-card').removeAttr('style');
};

const rearrangeHeatmap = async () => {
    const arrangeMode = $('#rangeDiv').is(':checked');
    const settings = getCurrentSettings();
    // do not overwrite existing graph data
    const heatmapData = JSON.parse(JSON.stringify(graphStore.getTraceData()));
    if (heatmapData.full_div && arrangeMode) {
        // gen blank item
        let blankPlotDat = JSON.parse(
            JSON.stringify(heatmapData.array_plotdata[0]),
        );
        const alreadyDivPlot = heatmapData.array_plotdata.map(
            (plotDat) => plotDat.h_label,
        );
        blankPlotDat.array_z = blankPlotDat.array_z.map((z) =>
            [...z].fill(null),
        );
        blankPlotDat.orig_array_z = blankPlotDat.array_z;
        blankPlotDat.as_dummy_div = true;
        blankPlotDat.colors.fill(-1);
        heatmapData.full_div.forEach((divValue) => {
            if (!alreadyDivPlot.includes(divValue)) {
                // push an empty plot
                blankPlotDat.h_label = divValue;
                heatmapData.array_plotdata.push({ ...blankPlotDat });
            }
        });
        // sort by h_label in case of integer div
        heatmapData.array_plotdata.sort((a, b) => b.h_label - a.h_label);
    }
    await showSCP(heatmapData, settings);
};

const showSCP = async (
    res,
    settings = undefined,
    clearOnFlyFilter = false,
    autoUpdate = false,
) => {
    if (!res.array_plotdata) {
        loadingHide();
        return;
    }

    if (res) {
        if (isEmpty(settings)) {
            // save global
            graphStore.setTraceData(_.cloneDeep(res));
        }
        // share global var to base.js
        formDataQueried = lastUsedFormData;

        response = res;
        // remove old hover infor violin and heatmap
        removeHoverInfo();
        showHideGraphSetting(res);
        resetChartSize();
        const scpData = res.array_plotdata;
        const chartType = res.chartType || 'scatter';
        const is_cat_color = res.is_cat_color;
        const color_type = res.color_type;

        // fill options of scpColorScale
        fillColorScaleHtml(color_type, is_cat_color);

        // gen matrix
        const isShowFirstLabelH = res.is_show_first_h_label;

        const xName = res.x_name;
        const yName = res.y_name;

        // reverse array to show latest first
        let zoomRange = null;
        const isShowDate =
            res.COMMON.compareType === els.cyclicTerm ||
            res.COMMON.compareType === els.directTerm;

        const cloneScpPlotData = () => {
            const isShowArrangeDiv = $(`#${els.hmpArrangeDiv}`).is(':checked');
            let scpCloneData = JSON.parse(JSON.stringify(scpData));
            if (isShowArrangeDiv) return scpCloneData;

            // Ignore empty graphs
            return scpCloneData.filter((plot) => !plot.is_empty_graph);
        };

        const showGraph = (settings = { isShowForward: false }) => {
            const scpCloneData = cloneScpPlotData();
            let sortKey = 'sort_key';
            scpCloneData.sort((a, b) => b.h_label - a.h_label);
            sortKey = 'h_label';
            const [matrix] = genGraphMatrix(
                scpCloneData,
                res.is_show_v_label,
                !!settings.isShowForward,
                sortKey,
            );
            // todo: reverse v + hlabel + matrix
            const scpMatrix = removeEmptyFromMatrix(matrix);
            // scatter for category and real color
            $('#navigation-bar').removeAttr('style');
            $(window).off('resize');
            const divNumber =
                res.div_name && res.div_data_type === DataTypes.INTEGER.name;
            if (
                [scpChartType.HEATMAP, scpChartType.HEATMAP_BY_INT].includes(
                    chartType,
                )
            ) {
                const contentDomHeight = genHTMLContentMatrix(
                    scpMatrix,
                    'sctr-card',
                    xName,
                    yName,
                    isShowFirstLabelH,
                    isShowDate,
                    divNumber,
                );
                // get color agg function
                const aggColorFunc = res.COMMON.agg_color_function;
                const option = {
                    isShowNumberOfData:
                        res.COMMON.compareType === els.dataNumberTerm,
                    isShowFacet: res.is_show_v_label,
                    isShowDiv: res.div_name !== null,
                    hasLv2: res.level_names && res.level_names.length >= 2,
                    xDataType: res.x_data_type,
                    yDataType: res.y_data_type,
                    chartType,
                    colorName: res.color_name,
                    color_bar_title: res.color_bar_title,
                    divDataType: res.div_data_type,
                    hmpColor: settings.hmpColor || 'BLUE',
                    isDiscreteColor:
                        Object.values(discreteColorType).includes(aggColorFunc),
                    x_name: xName,
                    y_name: yName,
                    colorBarHeight: contentDomHeight,
                };
                heatmapData = { scpMatrix, option, zoomRange };
                genHeatMapPlots(scpMatrix, option, zoomRange, (event) => {
                    zoomRange = event;
                    const sets = getCurrentSettings();
                    showGraph(sets);
                });
            }

            // hide loadding icon
            loadingHide();

            if (!autoUpdate) {
                // scroll to chart
                const scpCardPosition =
                    getOffsetTopDisplayGraph('#colorSettingGrp');
                $('html,body').animate({ scrollTop: scpCardPosition }, 1000);
            }
            initFilterModal(res, clearOnFlyFilter);
        };

        if (settings) {
            showGraph(settings);
        } else {
            showGraph();
        }

        const onChangeChartScale = () => {
            $(`select[name=${els.scpChartScale}]`).off('change');
            $(`select[name=${els.scpChartScale}]`).on('change', (e) => {
                if (chartType === scpChartType.HEATMAP) return;
                loadingShow();
                setTimeout(() => {
                    const graphsettings = getCurrentSettings();
                    showGraph(graphsettings);
                }, 1000);
            });
        };
        const onChangeColorScale = () => {
            $(`select[name=${els.scpColorScale}]`).off('change');
            $(`select[name=${els.scpColorScale}]`).on('change', (e) => {
                loadingShow();
                setTimeout(() => {
                    const graphsettings = getCurrentSettings();
                    showGraph(graphsettings);
                }, 500);
            });
        };
        const onShowBackward = () => {
            $(`select[name=${els.showBackward}]`).off('change');
            $(`select[name=${els.showBackward}]`).on('change', () => {
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

        const onChangeHmColor = () => {
            $(`select[name=${els.hmColorSelect}]`)
                .off('change')
                .on('change', (e) => {
                    loadingShow();
                    setTimeout(() => {
                        const graphsettings = getCurrentSettings();
                        showGraph(graphsettings);
                    }, 1000);
                });
        };

        const onChangeArrangeDiv = () => {
            $(`#${els.hmpArrangeDiv}`)
                .off('change')
                .on('change', (event) => {
                    loadingShow();
                    setTimeout(() => {
                        const graphSettings = getCurrentSettings();
                        showGraph(graphSettings);
                    }, 1000);
                });
        };

        onChangeHmColor();
        onChangeColorScale();
        onShowBackward();
        onChangeChartScale();
        onChangeColNumber();
        onChangeArrangeDiv();
    }

    loadingHide();
};
const resetGraphSetting = () => {
    // Reset chart scale
    $(`select[name=${els.scpChartScale}]`).val('1');

    // Reset scpColorScale
    $(`select[name=${els.scpColorScale}]`).val('AUTO');

    // Reset backwards
    $(`select[name=${els.showBackward}]`).val('1');

    // Reset column number
    $(`select[name=${els.colNumber}]`).val(MAX_MATRIX);
    $(`select[name=${els.colNumber}]`).attr(CONST.DEFAULT_VALUE, MAX_MATRIX);

    $(`select[name=${els.hmColorSelect}]`).val('BLUE');

    // reset arrange button
    // $('input#rangeDiv').prop('checked', false);
    currentMatrix = MAX_MATRIX;

    // Reset Arrange Div switch button to OFF
    $(`.${els.arrangeDivSwitch}`)[0].style.setProperty(
        'display',
        'none',
        'important',
    );
    $(`input#${els.hmpArrangeDiv}`).prop('checked', false);
};

const genHTMLContentMatrix = (
    scpMatrix,
    cardID,
    xName,
    yName,
    isShowFirstLabelH,
    isShowDate,
    isDivNumber,
    stringCol = null,
) => {
    const totalRow = scpMatrix.length;
    const totalCol = scpMatrix[0].length;
    const firstLabelH = [];
    let oneRowHeight;
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

    // if stringCol = null => heatmap else violin
    const showDetailClass = (axis) => {
        if (!stringCol || stringCol === axis) {
            return 'show-detail';
        }
        return '';
    };

    const genContentDOM = (contentWidth) => {
        let contentDOM = '';
        oneRowHeight =
            totalCol > 1
                ? contentWidth / totalCol - 6 - 30 / (totalCol - 1)
                : contentWidth / totalCol - 6 - 30 / totalCol;

        for (let i = 0; i < totalRow; i++) {
            let height;
            if (totalCol > 1) {
                height =
                    i === totalRow - 1
                        ? `${contentWidth / totalCol - 6 - 30 / (totalCol - 1)}px`
                        : `${contentWidth / totalCol - 6 - 30 / (totalCol - 1) - 10}px`;
            } else {
                height =
                    i === totalRow - 1
                        ? `${contentWidth / totalCol - 6 - 30 / totalCol}px`
                        : `${contentWidth / totalCol - 6 - 30 / totalCol - 10}px`;
            }
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
                    width =
                        j === 0
                            ? `${contentWidth / totalCol + 24}px`
                            : `${contentWidth / totalCol - 6 - 30 / (totalCol - 1)}px`;
                } else {
                    width = '100%';
                }

                if (isShowFirstLabelH) {
                    labelH = i === 0 ? firstLabelH[j] : '';
                } else {
                    labelH = item
                        ? item.h_label === null
                            ? ''
                            : item.h_label
                        : '';
                }

                if (isShowDate) {
                    labelH =
                        labelH &&
                        labelH
                            .split(COMMON_CONSTANT.EN_DASH)
                            .map((vl) =>
                                formatDateTime(
                                    vl.trim(),
                                    DATE_FORMAT_WITHOUT_TZ,
                                    {
                                        withMillisecs: false,
                                    },
                                ),
                            )
                            .join(` ${COMMON_CONSTANT.EN_DASH} `);
                } else if (labelH && isDivNumber) {
                    labelH = `Cat${labelH}`;
                }

                const h = `<span class="title label-h" style="height: 18px">${labelH}</span>`;
                const hHtml = isShowFirstLabelH ? (labelH ? h : '') : h;

                column += `<div class="sctr-item chart-column graph-navi d-flex flex-column justify-content-end"
                        style="height: ${height}; width: ${width}; margin: 0 3px;">
                            ${hHtml}
                            <div id="scp-${i}-${j}" style="width: 100%; flex: 1"></div>
                        </div>`;
            }

            contentDOM += `
            <div style="width: 100%; height: ${height}; margin: 3px 0;" class="position-relative">
                <div class="matrix-level cat-exp-box"><span class="show-detail">${vLabel}</span></div>
                ${column}
            </div>
        `;
        }
        return `
                    <div class="position-absolute vertical-text" id="scpchart-ytitle">
                        <span class="${showDetailClass('y')}" data-id="${stringCol ? 'color' : 'y'}"
                        title="${yName}">${yName}</span>
                    </div>
                    ${contentDOM}
                     <div id="scpchart-xtitle">
                          <span class="${showDetailClass('x')}" data-id="${stringCol ? 'color' : 'x'}"
                          title="${xName}">${xName}</span>
                     </div>
        `;
    };

    const chartDom = `<div class="scpchart-wrapper d-flex">
                <div class="flex-grow-1" id="scpChartGrp" style="width: calc(100% - 30px);">
                  <div id="scpchart-content" class="position-relative" style="width: calc(100% - 50px); height:  calc(100% - 20px); margin-left: 50px;">
                    
                    </div>
                </div>
                <div class="colorbar ${!stringCol ? 'none-margin' : ''}">
                  <div id="coloScaleBar"></div>
                </div>
        </div>
        `;
    $(`#${cardID}`).html(chartDom).css({ height: 'auto' });
    const chartContentSelector = $(`#scpchart-content`);
    const contentWidth = $(chartContentSelector).width();
    // taking into account the width of the scrollbar
    const contentDOM = genContentDOM(contentWidth - 18);
    // make space for x label
    const contentDomHeight = oneRowHeight * totalRow + 80;
    $(chartContentSelector).html(contentDOM).css({ height: contentDomHeight });
    return contentDomHeight;
};

const genHeatMapPlots = (
    scpData,
    option,
    zoomRange = null,
    callback = null,
) => {
    let allColorValSets = [];
    const allYValues = [];
    const allXValues = [];
    // get common Y of each row
    scpData.forEach((row, i) => {
        let allYValue = [];
        row.forEach((item) => {
            if (item) {
                item.array_y = item.array_y.map((val) => val.toString());
                allYValue = [...allYValue, ...item.array_y];
                if (item.array_z) {
                    item.array_z.forEach((z) => {
                        allColorValSets = [
                            ...allColorValSets,
                            ...z.map((y) => y),
                        ];
                    });
                } else {
                    allColorValSets = item.colors;
                }
            }
        });
        allYValues.push(allYValue.filter(onlyUniqueFilter));
    });

    // const [zmin, zmax] = findMinMax(allColorValSets);
    const filteredValSets = allColorValSets.filter((i) => !isEmpty(i));
    const colorScale = genColorScale(
        filteredValSets,
        option.hmpColor,
        option.isDiscreteColor,
        scpData,
    );
    // get common X of each column
    const totalRow = scpData.length;
    for (let i = 0; i < scpData[0].length; i++) {
        let allXValue = [];
        for (let j = 0; j < totalRow; j++) {
            const item = scpData[j][i];
            if (item) {
                item.array_x = item.array_x.map((val) => val.toString());
                allXValue = [...allXValue, ...item.array_x];
            }
        }
        allXValues.push(allXValue.filter(onlyUniqueFilter));
    }

    scpData.forEach((row, i) => {
        row.forEach((item, j) => {
            const canvasID = `scp-${i}-${j}`;
            const graphDiv = document.getElementById(canvasID);
            const heatmapGraph = {};
            heatmapGraph.array_y =
                item && !item.as_dummy_div
                    ? item.array_y.map((val) => val.toString())
                    : allYValues[i];
            heatmapGraph.array_x =
                item && !item.as_dummy_div
                    ? item.array_x.map((val) => val.toString())
                    : allXValues[j];
            heatmapGraph.array_z =
                item && !item.as_dummy_div
                    ? item.array_z
                    : Array(allYValues[i].length).fill(
                          Array(allXValues[j].length).fill(-1),
                      );
            heatmapGraph.colorScale =
                item && !item.as_dummy_div
                    ? colorScale.scale
                    : [...colorScale.scale].map((color) => [
                          color[0],
                          '#222222',
                      ]);
            heatmapGraph.zmax = colorScale.zmax;
            heatmapGraph.zmin = colorScale.zmin;
            heatmapGraph.isShowY = j === 0;
            heatmapGraph.isShowX = i === scpData.length - 1;
            heatmapGraph.canvasId = canvasID;
            generateHeatmapPlot(heatmapGraph, option, zoomRange);
            graphDiv.on('plotly_relayout', (eventdata) => {
                callback(eventdata);
            });
            option.canvas_id = canvasID;
            graphDiv.on('plotly_hover', (data) => {
                setTimeout(() => {
                    $('.scp-hover-info').remove();
                    const dataScp = scpData[i][j];
                    if (!dataScp) return;

                    // for heatmap with color
                    if (dataScp.heatmap_matrix) {
                        dataScp.array_x = dataScp.heatmap_matrix.x;
                        dataScp.array_y = dataScp.heatmap_matrix.y;
                        dataScp.array_z = dataScp.heatmap_matrix.z;
                    }
                    const { x, y, pointIndex } = data.points[0];
                    const { pageX, pageY } = data.event;
                    makeHeatmapHoverInfoBox(
                        dataScp,
                        x,
                        y,
                        option,
                        pageX,
                        pageY,
                        pointIndex,
                    );
                }, 200);
            });

            unHoverHandler(graphDiv);

            graphDiv.addEventListener('mouseleave', () => {
                $('.scp-hover-info').remove();
            });
        });
    });

    if (option.divDataType === DataTypes.INTEGER.name) {
        $('#arrangeGraph').addClass('show');
    } else {
        $('#arrangeGraph').removeClass('show');
    }
    const colorBarTitle = option.color_bar_title
        ? option.color_bar_title
        : 'Count';

    let discreteColors = false;
    if (option.isDiscreteColor) {
        discreteColors = [];
        scpData.forEach((plot) => {
            const colorsVal = _.flatten(
                plot.map((i) => {
                    let colorValues = [];
                    if (i && i.colors_encode) {
                        colorValues = Object.values(i.colors_encode);
                    } else if (i) {
                        colorValues = i.colors;
                    }
                    return colorValues;
                }),
            );
            discreteColors = [...discreteColors, ...colorsVal];
        });
        discreteColors = Array.from(new Set(discreteColors));
        discreteColors.sort((a, b) => b - a);
    }
    genColorScaleBar(
        filteredValSets,
        colorScale.zmin,
        colorScale.zmax,
        colorBarTitle,
        colorScale.scale,
        discreteColors,
        option.colorBarHeight,
    );
};

const callToBackEndAPI = (
    settings = undefined,
    clearOnFlyFilter = false,
    autoUpdate = false,
) => {
    const formData = transformFormdata(clearOnFlyFilter, autoUpdate);
    if (settings) {
        formData.set('colNumber', settings.colNumber);
    }
    // clear old html elements
    $('.scp-hover-info').remove();

    showGraphCallApi(
        '/ap/api/hmp/plot',
        formData,
        REQUEST_TIMEOUT,
        async (res) => {
            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            await showSCP(res, settings, clearOnFlyFilter, autoUpdate);

            setPollingData(formData, handleSetPollingData, []);
        },
    );
};

const handleSetPollingData = () => {
    const settings = getCurrentSettings();
    callToBackEndAPI(settings, false, true);
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

// This function to check currentXY and 2 latest items in latestSortColIds
// In case: change or delete variable  without click "Display graph"
const checkIsUpdateXY = (newXY, currentXY) => {
    if (newXY.length !== currentXY.length) return false;
    const sortedNewXY = [...newXY].sort();
    const sortedCurrentXY = [...currentXY].sort();
    return sortedNewXY.every((val, idx) => val === sortedCurrentXY[idx]);
};

const transformXY = (formData) => {
    const XYDataTemp = latestSortColIds.slice(-2);
    const isUpdateXY = checkIsUpdateXY(XYDataTemp, currentXY);
    let XYData = '';
    // update XY when latest Sort is change order with CurrentXY else => using currentXY
    if (isUpdateXY) {
        XYData = [...XYDataTemp];
        currentXY = [...XYDataTemp];
    } else {
        XYData = [...currentXY];
    }

    // delete XY_AXIS_KEY:
    formData.delete(CONST.SCP_HMP_X_AXIS);
    formData.delete(CONST.SCP_HMP_Y_AXIS);

    // append XY_AXIS_KEY
    formData.append(CONST.SCP_HMP_X_AXIS, XYData[0]);
    formData.append(CONST.SCP_HMP_Y_AXIS, XYData[1]);

    return formData;
};
const transformFormdata = (clearOnFlyFilter = null, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
    let formData;
    if (clearOnFlyFilter) {
        const traceForm = $(formElements.formID);
        formData = new FormData(traceForm[0]);
        formData = transformFacetParams(formData);
        formData = genDatetimeRange(formData);
        formData = clearEmptyEndProcs(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        // transform cat label filter
        formData = transformCatFilterParams(formData);
    }

    // transfer for switch XY
    formData = transformXY(formData);
    return formData;
};

const scatterTraceData = (clearOnFlyFilter, setting = {}) => {
    const formData = transformFormdata(clearOnFlyFilter);

    showGraphCallApi(
        '/ap/api/hmp/plot',
        formData,
        REQUEST_TIMEOUT,
        async (res) => {
            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            $('#sctr-card').empty();

            // check result and show toastr msg
            if (
                isEmpty(res.array_plotdata) ||
                isEmpty(res.array_plotdata[0].array_y)
            ) {
                showToastrAnomalGraph();
            }

            await showSCP(res, setting, clearOnFlyFilter);

            // show toastr to inform result was truncated upto 5000
            if (res.is_res_limited) {
                showToastrMsg(
                    i18n.traceResulLimited.split('BREAK_LINE').join('<br>'),
                );
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

            setPollingData(formData, handleSetPollingData, []);
        },
    );

    $('#plot-cards').empty();
};

const initFilterModal = (res) => {
    // render cat, category label, filter in filter modal
    fillDataToFilterModal(res.filter_on_demand, () => {
        const setting = getCurrentSettings();
        handleSubmit(false, setting);
    });
};

const fillColorScaleHtml = (color_type, is_cat_color) => {
    const scpColorScaleSelect = $(`select[name=${els.scpColorScale}]`);
    scpColorScaleSelect.empty();
    const htmlIntReal = `<option value="SETTING">${i18n.colorScaleSetting}</option>
        <option value="COMMON">${i18n.colorScaleCommon}</option>
        <option value="THRESHOLD">${i18n.colorScaleThreshold}</option>
        <option value="AUTO">${i18n.colorScaleAuto}</option>
        <option value="FULL" selected>${i18n.colorScaleFull}</option>`;
    const htmlCatNon = `<option value="FULL" selected>${i18n.colorScaleFull}</option>
        <option value="AUTO">${i18n.colorScaleAuto}</option>`;
    if (is_cat_color || !color_type) {
        scpColorScaleSelect.append(htmlCatNon);
    } else if (
        !is_cat_color &&
        [dataTypes.INT, dataTypes.REAL].includes(color_type)
    ) {
        scpColorScaleSelect.append(htmlIntReal);
    } else {
        scpColorScaleSelect.append(htmlIntReal);
    }
};

const getCurrentSettings = () => {
    // get chart axis scale
    const chartScaleVal = $(`select[name=${els.scpChartScale}]`).val();
    const chartScale = chartScales[Number(chartScaleVal)];
    // get colors scale
    const colorScaleVal = $(`select[name=${els.scpColorScale}]`).val();
    const colorScale = colorScales[colorScaleVal];
    // get color set
    const hmpColor = $(`select[name=${els.hmColorSelect}]`).val();
    // get backward showing
    const isShowBackward = $(`select[name=${els.showBackward}]`).val();

    const colNumber = $(`select[name=${els.colNumber}]`).val();
    const isShowForward = !isShowBackward;
    currentMatrix = Number(colNumber);

    const plotType = null;

    return {
        chartScale,
        colorScale,
        isShowForward,
        colNumber,
        plotType,
        hmpColor,
    };
};

const downloadPlot = () => {
    clearOldScreenShot();
    loadingShow();
    html2canvas(document.getElementById('sctr-card'), {
        scale: 1,
        logging: true,
        backgroundColor: '#222222',
    }).then((canvas) => {
        canvas.id = 'tsCanvas';
        document.getElementById('screenshot').appendChild(canvas);
        // generate filename
        const filename = 'screenshot.png';
        const screenshot = document
            .getElementById('screenshot')
            .querySelectorAll('canvas')[0];
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
