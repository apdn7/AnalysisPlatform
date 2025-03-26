const REQUEST_TIMEOUT = setRequestTimeOut();
let tabID = null;

// save paracords tracing data
const MAX_NUMBER_OF_SENSOR = 60;
const MIN_NUMBER_OF_SENSOR = 0;
let paracordTraces;
let targetSensorName;
let targetDim;
let targetSensorDat;
let targetSensorIndex;
let removeOutlierOptionChanged = false;
let removeOutliers = 0;
const graphStore = new GraphStore();
const loading = $('.loading');
const MAX_INT_LABEL_SIZE = 128;
const MAX_CAT_LABEL = 32;
// let dimOrderingFromODF;
let latestDimensionInChart;
let changeVariableOnly = false;
let needUpdateDimColor = false;
let onlyExportSelectedData = false;

let pcpPlot = {};

const formElements = {
    formID: '#traceDataForm',
    btnAddCondProc: '#btn-add-cond-proc',
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcSelectedItem: '#cond-proc-row select',
    endProcCateSelectedItem: '#end-proc-cate-row select',
    condProcReg: /cond_proc/g,
    i18nAllSelection: $('#i18nAllSelection').text(),
    i18nNoFilter: $('#i18nNoFilter').text(),
    NO_FILTER: 'NO_FILTER',
    END_PROC: 'end_proc',
    VAL_SELECTED: 'GET02_VALS_SELECT',
    fineSelectEl: $('input#findSelect'),
    dataView: $('input#dataView'),
    showVar: $('select[name=show-var]'),
    yScaleOption: $('select[name=yScaleOption]'),
    showCT_Time: 'input#show-ct-time',
    // autoUpdateInterval: $('#autoUpdateInterval'),
};

const tableSelectedDataElems = {
    cardContainer: '#pcpCardDataSelected',
    tableHeader: '#tableViewDataSelected thead',
    tableHeaderTr: '#tableViewDataSelected thead tr',
    tableBody: '#tableViewDataSelected tbody',
    tableHeaderContent: '#tableViewDataSelected thead td',
    tableBodyTr: '#tableViewDataSelected tbody tr',
    tableBodyContent: '#tableViewDataSelected tbody tr td',
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
};

const sTypes = {
    REAL: 'real',
    CATEGORY: 'cate',
};

const paracordsSetting = {
    showVariables: {
        ALL: 'all',
        REAL: 'real',
        CATEGORY: 'category',
        NUMBER: 'number',
        CATEGORIZED: 'categorized_real',
    },
    corrOrdering: {
        orderBy: ['correlation', 'top'],
        corrValue: ['corr_value', 'max_vars'],
        orderLim: ['top_vars'],
        all: ['correlation', 'top', 'corr_value', 'max_vars', 'top_vars'],
    },
    orderOptions: {
        selectedOrder: 'selected_order',
        setting: 'setting',
        process: 'process',
        correlation: 'correlation',
    },
};

$(() => {
    // generate tab ID
    while (tabID === null || sessionStorage.getItem(tabID)) {
        tabID = Math.random();
    }

    // hide loading screen
    loading.addClass('hide');

    initializeDateTime();

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        isRequired: true,
        showObjective: true,
        shouldObjectiveIsTarget: true,
        hideCTCol: true,
        showFilter: true,
    });
    endProcItem();

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
        addAttributeToElement();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // change paracords setting
    $('.paracord-options-bar').on('click', (e) => {
        const menuTarget = $(e.currentTarget).attr('target');
        const settingMenu = $(`#${menuTarget}`);
        showSettingMenu(settingMenu, e);
    });

    // context menu paracords
    $('.context-menu').mouseleave((e) => {
        hideMenu();
    });

    // validation
    initValidation(formElements.formID);
    initializeDateTimeRangePicker();
    orderingEventHandler();
});

const showSettingMenu = (menu, domEvent) => {
    const menuHeight = menu.height();
    const windowHeight = $(window).height();
    const left = domEvent.clientX - 30;
    let top = domEvent.clientY + 10;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight;
    }
    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        display: 'block',
    });
};

const parallelTraceDataWithDBChecking = (action = 'TRACE-DATA', clearOnFlyFilter = false) => {
    requestStartedAt = performance.now();
    if (clearOnFlyFilter) {
        const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
        updateStyleOfInvalidElements();
        if (!isValid) return;

        // close sidebar
        beforeShowGraphCommon();

        // destroy old chart instances
        for (const graphIdx in Chart.instances) {
            Chart.instances[graphIdx].destroy();
        }
    }

    if (action === 'TRACE-DATA') {
        // parallelTraceData();
        showParallelGraph(clearOnFlyFilter, isDirectFromJumpFunction);
    }
};

// merge real and cate sensors in same proc
const mergeTargetProc = (formData) => {
    const endProcSuf = [];
    const endProcID = [];
    const uniqueProcs = [];
    const valSelected = {};
    for (const pair of formData.entries()) {
        if (pair[0].includes(formElements.END_PROC)) {
            endProcID.push(pair[1]);
            // get X from end_procX
            const suf = pair[0].split(formElements.END_PROC);
            endProcSuf.push(suf[1]);
        }
    }

    // find duplicate process from end_proc list
    endProcID.forEach((v, k) => {
        const selectedValue = formData.getAll(formElements.VAL_SELECTED + endProcSuf[k]).filter((x) => x !== 'All');
        const selectedObj = {};
        if (!uniqueProcs.includes(v)) {
            uniqueProcs.push(v);
            valSelected[endProcSuf[k]] = selectedValue;
        } else {
            valSelected[endProcSuf[k]] = [];
            const indexOfProc = endProcID.indexOf(v);
            const procSf = endProcSuf[indexOfProc];
            valSelected[procSf] = [...valSelected[procSf], ...selectedValue];
        }
    });

    Object.entries(valSelected).forEach(([k, v]) => {
        formData.delete(`${formElements.VAL_SELECTED}${k}`);
        if (v.length) {
            v.map((selection) => formData.append(`${formElements.VAL_SELECTED}${k}`, selection));
        } else {
            formData.delete(`${formElements.END_PROC}${k}`);
        }
    });

    // add target sensor
    if (!formData.get('target_sensor')) {
        formData.set('target_sensor', formData.get('GET02_VALS_SELECT11'));
    }

    // append objective var for new PCP
    const objectiveVar = formData.get('objectiveVar');
    if (objectiveVar) {
        const sensorValName = $(`#objectiveVar-${objectiveVar}`).closest('.row').find('input:eq(0)').attr('name');
        const allValsSelected = formData.getAll(sensorValName);
        if (sensorValName && !allValsSelected.includes(sensorValName)) {
            formData.append(sensorValName, objectiveVar);
        }
    }
    return formData;
};

const resetSetting = (isRedirectFromJump = false) => {
    // reset setting variables
    formElements.showVar.val('all');
    const orderValue = paracordsSetting.orderOptions.correlation;
    $(`input[name='sort_by'][value=${orderValue}]`).prop('checked', true);
    if (!isRedirectFromJump) {
        // default is top 8 variables
        $(`input[name='sort_option'][value=top]`).prop('checked', true);
    }
    $(formElements.yScaleOption).val(scaleOptionConst.AUTO);
    formElements.fineSelectEl.prop('checked', false);
};

const clearTargetTmp = () => {
    targetSensorName = null;
    targetSensorDat = null;
    targetSensorIndex = null;
    targetDim = null;
};
const getSensorTypes = (sensorDat) => {
    // All category -> category else real and category
    let isAllCategorySensors = true;
    for (const data of sensorDat) {
        if (!data.col_detail.is_category) {
            isAllCategorySensors = false;
            break;
        }
    }

    if (isAllCategorySensors) {
        return paracordsSetting.showVariables.CATEGORY;
    }

    return paracordsSetting.showVariables.ALL;
};

const collectFormDataPCP = (clearOnFlyFilter, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
    let formData = collectFormData(formElements.formID);
    if (clearOnFlyFilter) {
        formData = mergeTargetProc(formData);
        formData = genDatetimeRange(formData);
        formData.set('fine_select', '0');
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
        const fineSelect = formElements.fineSelectEl.is(':checked') ? 1 : 0;
        formData.set('fine_select', fineSelect);
    }
    return formData;
};

const showParallelGraph = (clearOnFlyFilter = false, isRedirectFromJump = false) => {
    const formData = collectFormDataPCP(clearOnFlyFilter);

    showGraphCallApi('/ap/api/pcp/index', formData, REQUEST_TIMEOUT, async (res) => {
        if (res.is_send_ga_off) {
            showGAToastr(true);
        }

        paracordTraces = res;
        // store trace result
        graphStore.setTraceData(_.cloneDeep(res));

        // clear targetSensorIndex
        clearTargetTmp();

        // reset setting variables
        if (clearOnFlyFilter) {
            resetSetting(isRedirectFromJump);
        }

        const sensorTypes = getSensorTypes(res.array_plotdata);
        // set sensor type default
        $('select[name=show-var]').val(sensorTypes);
        let defaultShowOrder = paracordsSetting.orderOptions.correlation;
        // set order default value for paracat only
        if (sensorTypes === paracordsSetting.showVariables.CATEGORY) {
            defaultShowOrder = paracordsSetting.orderOptions.process;
        }
        // sort graphs
        if (latestSortColIds.length) {
            res.ARRAY_FORMVAL = sortGraphs(res.ARRAY_FORMVAL, 'GET02_VALS_SELECT', latestSortColIds);
            res.array_plotdata = sortGraphs(res.array_plotdata, 'end_col_id', latestSortColIds);
        }
        showParacords(
            res,
            { showVars: sensorTypes, orderBy: defaultShowOrder },
            isRedirectFromJump,
            clearOnFlyFilter,
            null,
            true,
        );

        setPollingData(formData, handleSetPollingData, []);

        // show info table
        showInfoTable(res);
    });
};

const hideMenu = () => {
    $('#contextMenuParallelPlot').css({ display: 'none' });
    hideSettingMenu();
};
const hideSettingMenu = () => {
    $('#ordering-content').hide();
};

const selectTargetDimHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // show context menu when right click timeseries
    const menu = $('#contextMenuParallelPlot'); // TODO use const
    const menuHeight = menu.height();
    const windowHeight = $(window).height();
    const left = e.clientX;
    let top = e.clientY + 10;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight;
    }
    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        display: 'block',
    });

    return false;
};
const showDimFullName = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // show context menu when right click timeseries
    const menu = $('#dimFullName'); // TODO use const
    const menuHeight = menu.height();
    const windowHeight = $(window).height();
    const left = e.clientX;
    let top = e.clientY + 5;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight;
    }
    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        display: 'block',
    });

    return false;
};

const getSettingOptions = () => {
    const showVariable = $("select[name='show-var']").val();
    const showOrder = $("input[name='sort_by']:checked").val();
    const sortedOptions = $("input[name='sort_option']:checked").val();
    const yScaleOption = $("select[name='yScaleOption']").val();
    const isSortedByCorr = sortedOptions === CONST.CORR;
    const showOrderFrom = $("input[name='corr_value']").val();
    const showMaxVars = showOrder === CONST.CORR ? Number($("input[name='max_vars']").val()) : undefined;
    const showTopVars = showOrder === CONST.CORR ? Number($("input[name='top_vars']").val()) : undefined;
    const fineSelect = formElements.fineSelectEl.is(':checked');
    return {
        showVars: showVariable,
        orderBy: showOrder,
        corrSetting: {
            byCorr: isSortedByCorr,
            minCorr: showOrderFrom,
            varNum: showMaxVars,
            top: showTopVars,
        },
        yScaleOption: yScaleOption,
        fineSelect: fineSelect,
    };
};

const setSettingOptions = (showVariable = false, showOrder = false) => {
    if (showVariable) {
        $(`input[name='show-var'][value='${showVariable}']`).prop('checked', true);
    }
    if (showOrder) {
        $(`input[name='sort_by'][value='${showOrder}']`).prop('checked', true);
        const orderingName = $('input[name=sort_by]:checked').closest('.form-check').find('span:first').text();
        // update ordering name
        $('#ordering-name').text(orderingName);
    }
};

const handleSelectMenuItem = (e, updatePosition = false) => {
    // get setting options
    const settings = getSettingOptions();

    // bind target sensor
    const selectedDim = $(e).attr('data-target-dim') || null;
    if (selectedDim) {
        const [, dim] = selectedDim.split('-').map((i) => Number(i));

        let selectedCol = Number(dim);
        if (updatePosition) {
            const options = {
                explainDim: selectedCol,
            };
            paracordTraces.options = options;
            // update pcp data
            showParacords(paracordTraces, settings, false, false, options);
        } else {
            const options = {
                objectiveDim: selectedCol,
            };
            paracordTraces.options = options;
            showParacords(paracordTraces, settings, false, true, options);
        }
    }

    hideMenu();
};

const onChangeYScale = (selection) => {
    const settings = getSettingOptions();
    showParacords(paracordTraces, settings, false, false, paracordTraces.options);
};

const onChangeFineSelect = () => {
    const settings = getSettingOptions();
    showParacordWithSettings(true);
    showParacords(paracordTraces, settings, false, false, paracordTraces.options);
};

const onChangeDataView = (e) => {
    if (e.checked) {
        // display dataViewTable when select range => turn on the DataView btn
        getAndDisplayDataViewTable();
    } else {
        clearTableDataSelected();
    }
};

const callToBackEndAPI = async (filter, clearOnFlyFilter = false, autoUpdate = false) => {
    loadingShow();
    const formData = collectFormDataPCP(clearOnFlyFilter, autoUpdate);
    showGraphCallApi('/ap/api/pcp/index', formData, REQUEST_TIMEOUT, async (res) => {
        paracordTraces = res;
        const settings = getSettingOptions();
        needUpdateDimColor = true;
        graphStore.setTraceData(_.cloneDeep(res));

        // clear old target variables
        if (settings.showVariable === 'category') {
            // clearTargetTmp();
            const previousEndDim = getDPVFromLatestCatDim();
            if (previousEndDim) {
                updateTargetDim(previousEndDim);
            }
        }

        if (paracordTraces) {
            // do not use default corr threshold
            settings.useCorrDefaultThreshold = false;
            showParacords(paracordTraces, settings, false, filter);
            $('#updateParacords').addClass('hide');
        }

        setPollingData(formData, handleSetPollingData, []);

        removeOutlierOptionChanged = false;
        removeOutliers = 0;
    });
};

const handleSetPollingData = () => {
    const settings = collectFormDataPCP(false);
    callToBackEndAPI(settings, false, true);
};

const showParacordWithSettings = async (filter = false) => {
    // close sidebar
    beforeShowGraphCommon(false);

    $('#updateParacords').removeClass('hide');
    if (removeOutlierOptionChanged || filter) {
        await callToBackEndAPI(filter);
        return;
    }

    const settings = getSettingOptions();

    if (paracordTraces) {
        showParacords(paracordTraces, settings, false, filter);
        $('#updateParacords').addClass('hide');
    }
};

const changeObjectiveVar = (objectiveID) => {
    if (objectiveID) {
        $(`input#objectiveVar-${objectiveID}`).prop('checked', true).change();
    }
};

const getEndCatDimFromChart = () => {
    // paracat only
    const getPosition = (translateVal) => {
        const [x] = translateVal
            .replace('translate', '')
            .replace('(', '')
            .replace(')', '')
            .split(',')
            .map((val) => Number(val));
        return x;
    };
    const dimensions = $('g.dimension');
    let dimPosition = dimensions.map((i, dim) => [[getPosition($(dim).attr('transform')), i]]);
    dimPosition.sort((a, b) => b[0] - a[0]);
    if (dimPosition.length) {
        // last dim at first position of list
        const lastDimIdx = dimPosition[0][1];
        const lastDim = dimensions.find('text.dimlabel:eq(0)')[lastDimIdx];
        return $(lastDim);
    }
    return null;
};

const changeDimColor = (objective, isParacat = false) => {
    const allDim = $('#paracord-plot g.y-axis');
    const lastDim = $(`#paracord-plot g.y-axis:eq(${allDim.length - 1})`);
    if (objective.name) {
        const sameProcDim = $('#paracord-plot g.y-axis').find(`.axis-title[data-dpv^=${objective.procId}]`);
        const tspanLabel = '.axis-title tspan.line>tspan';
        // reset all dim color
        allDim.find(tspanLabel).css('fill', CONST.WHITE);
        sameProcDim.find('tspan.line>tspan').css('fill', CONST.LIGHT_BLUE);
        // set target dim color
        lastDim.find(tspanLabel).css('fill', CONST.YELLOW);
        updateTargetDim(objective.name);
    }

    // for category chart
    if (isParacat) {
        const allCatDim = $('g.dimension').find('.dimlabel:eq(0)');
        // reset color of all dimension
        allCatDim.css('fill', CONST.WHITE);

        const endDim = getEndCatDimFromChart();
        // assign blue for same process columns
        if (objective.name) {
            allCatDim.filter((i, v) => $(v).data('dpv') === objective.name).css('fill', CONST.YELLOW);
            allCatDim
                .filter(
                    (i, v) =>
                        $(v).data('dpv').split('-')[0] === String(objective.procId) &&
                        $(v).data('dpv') !== objective.name,
                )
                .css('fill', CONST.LIGHT_BLUE);
            if (needUpdateDimColor) {
                if (endDim && endDim.length) {
                    endDim.css('fill', CONST.YELLOW);
                } else {
                    allCatDim.last().css('fill', CONST.YELLOW);
                }
                updateTargetDim(objective.name);
            }
        }
    }
    needUpdateDimColor = false;
};

const updateTargetDim = (targetDPV, changeColor = false) => {
    if (paracordTraces) {
        // update on-demand-filter modal content
        const dimPositions = getDimPositionFromGraph();
        if (dimPositions && latestDimensionInChart) {
            const { category } = paracordTraces.filter_on_demand;
            const dimAfterUpdate = updateDimPosition(dimPositions);
            const odfData = updateCategoryOrdering(category, dimAfterUpdate);
            const filterData = {
                ...paracordTraces.filter_on_demand,
                category: odfData,
            };
            fillDataToFilterModal(filterData, () => {
                showParacordWithSettings(true);
            });
        }

        const newTargetDPV = targetDPV.split('-').map((i) => Number(i));
        clearTargetTmp();
        // re-assign target dimension information
        paracordTraces.array_plotdata.forEach((dat, idx) => {
            if (dat.col_detail.col_id === newTargetDPV[1] && dat.col_detail.proc_id === newTargetDPV[0]) {
                targetDim = newTargetDPV;
                targetSensorIndex = idx;
                targetSensorDat = dat.array_y;
            }
        });
        if (changeColor) {
            changeDimColor();
        }
    }
};

// in case of category graph, retrieve latest dimension by transform data
const getDPVFromLatestCatDim = () => {
    let latestDim = null;
    const dimensions = $('g.dimension');
    const transList = [];
    dimensions.each((idx, dim) => {
        const transDats = $(dim)
            .attr('transform')
            .match(/\(([^)]+)\)/)[1]
            .split(',');
        const transDat = Number(transDats[0]) || 0;
        transList.push(transDat);
        const [, maxTrans] = findMinMax([...transList, transDat]);
        if (maxTrans === transDat) {
            latestDim = dim;
        }
    });
    if (latestDim) {
        return $(latestDim).find('.dimlabel').data('dpv');
    }
    return latestDim;
};

const showParacords = (
    dat,
    settings = undefined,
    isRedirectFromJump = false,
    clearOnFlyFilter = false,
    options = null,
    isReturnToDefaultOrderingParams = false,
) => {
    $('#paracord-plot').html('');
    clearTableDataSelected();
    const showFilterClass = 'show-detail click-only';

    // hide setting as default
    $('#sctr-card').show();

    loadingUpdate(80);

    // assign chart width by parent cards and  number of variables
    const mainCardWidth = $('#mainContent').width();
    const plotHeight = $(window).height() - 150;

    pcpPlot = new ParallelPlot('paracord-plot', dat, mainCardWidth, plotHeight);
    pcpPlot.setSettings(settings);
    if (options && options.objectiveDim) {
        if (options.objectiveDim !== pcpPlot.objective.id) {
            pcpPlot.setObjective(options.objectiveDim);
        }
    }
    if (options && options.explainDim) {
        if (!pcpPlot.explain || options.explainDim !== pcpPlot.explain.id) {
            pcpPlot.setObjective(options.explainDim, true);
        }
    }
    pcpPlot.setJump(isRedirectFromJump);
    // set default setting
    setSettingOptions(pcpPlot.settings.showVars, pcpPlot.settings.orderBy);

    // const dimensions = pcp.data;
    pcpPlot.show(isReturnToDefaultOrderingParams);
    getSelectedValues();

    // $('#paracord-plot').show();

    $('html, body').animate(
        {
            scrollTop: getOffsetTopDisplayGraph('#sctr-card'),
        },
        500,
    );

    const plotDat = dat.array_plotdata;
    // if showVar = 'category only' and
    const categoryOnly = plotDat.filter((data) => data.col_detail.is_category).length === plotDat.length;
    const isShowMsg = pcpPlot.dimensions.length > 0 && !categoryOnly && changeVariableOnly;
    if (pcpPlot.settings.showVars === ParallelProps.showVariables.CATEGORY && isShowMsg) {
        const msgContent = $('#i18nRemoveRealInParcats').text();
        showToastrMsg(msgContent);
        changeVariableOnly = false;
    }

    setTimeout(() => {
        loadingHide();
        $('text.dimlabel[data-dpv]:not([is-categorize])').addClass(showFilterClass);
        $('#paracord-plot').scrollLeft(1000);
        // update category position of on-demand-filter same as dimension
        const odfData = updateCategoryOrdering(dat.filter_on_demand.category, pcpPlot.dimensions);
        const filterData = {
            ...dat.filter_on_demand,
            category: odfData,
        };
        fillDataToFilterModal(filterData, () => {
            showParacordWithSettings(true);
        });
        $('#categoriesBoxTitle').text('Category');

        // show message for casting inf/-inf
        if (dat.cast_inf_vals && clearOnFlyFilter) {
            const msgContent = $('#i18nInfCast').text();
            showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
        }
    }, 1000);
};

const propComparator = (propName) => (a, b) =>
    Math.abs(a[propName]) === Math.abs(b[propName]) ? 0 : Math.abs(a[propName]) < Math.abs(b[propName]) ? -1 : 1;

const updateParacords = (dimensionID) => {
    if (!paracordTraces) {
        return;
    }
    const plotData = paracordTraces.array_plotdata;
    let targetDim = plotData[plotData.length - 1];
    const explainDim = plotData.filter((dim) => String(dim.end_col_id) == String(dimensionID));
    const pcpData = plotData.filter(
        (dim) => ![String(dimensionID), String(targetDim.end_col_id)].includes(String(dim.end_col_id)),
    );
    // update pcp data
    paracordTraces.array_plotdata = [...pcpData, ...explainDim, targetDim];
};
const changeShowVariableByType = (selection) => {
    // hide scale y when selection is CATEGORY
    if (
        selection.value === paracordsSetting.showVariables.CATEGORY ||
        selection.value === paracordsSetting.showVariables.CATEGORIZED
    ) {
        $(formElements.yScaleOption).parent().addClass('hidden-important');
    } else {
        $(formElements.yScaleOption).parent().removeClass('hidden-important');
    }

    changeVariableOnly = true;
    needUpdateDimColor = true;
    let propOption = false;
    if (selection === CONST.CATEGORY) {
        propOption = true;
        const sortBy = $('input[name=sort_by]:checked').val();
        if (sortBy === CONST.CORR) {
            // use defaul ordering value
            $('input[name=sort_by][value=setting]').prop('checked', true);
        }
    }
    $('input[type=radio][name=sort_by][value=correlation]').prop('disabled', propOption);
    $('input[type=number][name=corr_value]').prop('disabled', propOption);

    loading.show();
    setTimeout(() => {
        // if there is categorized real selected, pass it to call API same as with ODF case
        showParacordWithSettings();
        loading.hide();
    }, 500);
};

const filterByShowVarType = (plotData, showVar) =>
    plotData.filter((data) => {
        if (showVar === paracordsSetting.showVariables.ALL) {
            return true;
        }

        if (showVar === paracordsSetting.showVariables.NUMBER) {
            return (
                data.col_detail.data_type === DataTypes.REAL.name ||
                data.col_detail.data_type === DataTypes.INTEGER.name
            );
        }

        if (showVar === paracordsSetting.showVariables.CATEGORY) {
            return data.col_detail.is_category === true;
        }

        if (showVar === paracordsSetting.showVariables.REAL) {
            return data.col_detail.data_type === DataTypes.REAL.name;
        }

        if (showVar === paracordsSetting.showVariables.CATEGORIZED) {
            return (
                [DataTypes.INTEGER.name, DataTypes.REAL.name].includes(data.col_detail.data_type) ||
                data.col_detail.is_category === true
            );
        }
    });

const orderingEventHandler = () => {
    $('input[data-action=reload]').on('change', (e) => {
        const isSubInput = $(e.target).hasClass('sub-input');
        const targetVal = isSubInput ? e.target.name : e.target.value;
        const sortBy = $('input[name=sort_by]:checked').val();
        const corrOrderBy = $('input[name=sort_option]:checked').val();
        if (!paracordsSetting.corrOrdering.all.includes(targetVal) || (sortBy === CONST.CORR && !corrOrderBy)) {
            // reset before change
            $('input[name=sort_option]').prop('checked', false);
            if (sortBy === CONST.CORR) {
                $('input[name=sort_option][value=top]').prop('checked', true);
            }
        } else if (sortBy !== CONST.CORR) {
            $(`input[name=sort_by][value=${CONST.CORR}]`).prop('checked', true);
        }

        // sub input
        if (isSubInput && corrOrderBy !== CONST.CORR && paracordsSetting.corrOrdering.corrValue.includes(targetVal)) {
            // reset to corr order
            $('input[name=sort_option][value=correlation]').prop('checked', true);
        }
        if (isSubInput && corrOrderBy === CONST.CORR && paracordsSetting.corrOrdering.orderLim.includes(targetVal)) {
            // reset to top variable limit
            $('input[name=sort_option][value=top]').prop('checked', true);
        }

        const orderingName = $('input[name=sort_by]:checked').closest('.form-check').find('span:first').text();
        // update ordering name
        $('#ordering-name').text(orderingName);

        // update chart by settings
        loading.show();

        setTimeout(() => {
            if (pcpPlot && sortBy === ParallelProps.orderBy.selected_order) {
                pcpPlot.setOrdering(latestSortColIds, true);
                pcpPlot.show();

                // hide menu
                $('#ordering-content').hide();
            } else {
                showParacordWithSettings();
            }
            loading.hide();
        }, 500);
    });
};

const dumpData = (type) => {
    const formData = lastUsedFormData || collectFormDataPCP(true);
    formData.set('constraint_range', JSON.stringify(pcpPlot.selectedConstraintRange));
    formData.set(CONST.ONLY_EXPORT_DATA_SELECTED, onlyExportSelectedData);
    if (onlyExportSelectedData) {
        formData.set('export_from', 'plot');
    }
    handleExportDataCommon(type, formData, '/ap/api/pcp/data_export');
};

const handleExportData = (type, exportDataSelected = false) => {
    onlyExportSelectedData = exportDataSelected;
    showGraphAndDumpData(type, dumpData);
};

const getObjectiveDim = (asArray = false) => {
    const endRealDim = $('#paracord-plot g.y-axis:eq(-1)').find('text.axis-title').data('dpv');
    const endcatDim = $('#paracord-plot g.dimension:eq(-1)').find('.dimlabel:eq(0)').data('dpv');
    const endDimID = endRealDim || endcatDim;
    if (asArray) {
        return endDimID.split('-');
    }
    return endDimID;
};

const bindChangeDimColor = (objective, isParacat = false) => {
    // update color of dimension
    changeDimColor(objective, isParacat);

    // bind drag-drpo dimension events
    $('g.y-axis .axis-title, g.dimension text.dimlabel')
        .off('mouseover')
        .on('mouseover', (e) => {
            const dimName = $(e.currentTarget).attr('data-dName');
            $('#dimFullName').text(dimName);
            showDimFullName(e);
        })
        .off('mouseout')
        .on('mouseout', () => {
            $('#dimFullName').text('');
            $('#dimFullName').hide();
        });
};

const updateCategoryOrdering = (categoryData, dimensions) => {
    if (!categoryData.length || !dimensions.length) {
        return [];
    }
    const catsOnDemandFilter = dimensions
        .map((dim) => {
            const [procID, colID] = dim.dimID.split('-').map((i) => Number(i));
            const odfDims = categoryData.filter((catDim) => catDim.proc_name == procID && catDim.column_id == colID);
            if (odfDims.length) {
                return odfDims[0];
            }
            return null;
        })
        .filter((dim) => dim !== null);
    return catsOnDemandFilter;
};

const getDimOrderingFromODF = () => {
    // const data = latestDimensionInChart;
    if (!latestDimensionInChart) {
        return null;
    }

    let endDim = latestDimensionInChart[latestDimensionInChart.length - 1];
    const endDimIDFromChart = endDim.dPV;

    const [, odfDims] = getSortedCatExpAndCategories();
    const dimOrderingFromODF = odfDims.map((dim) => [Number(dim.end_proc_cate), Number(dim.GET02_CATE_SELECT[0])]);
    if (!dimOrderingFromODF || !dimOrderingFromODF.length) {
        return endDimIDFromChart.split('-').map((val) => Number(val));
    }

    const dpvOrdering = dimOrderingFromODF.map((dim) => `${dim[0]}-${dim[1]}`);
    const endDimFromODF = dpvOrdering[dpvOrdering.length - 1];

    if (dpvOrdering.includes(endDimIDFromChart)) {
        endDim = latestDimensionInChart.filter((dim) => dim.dPV == endDimFromODF)[0];
    }
    return endDim.dPV.split('-').map((val) => Number(val));
};

const rearrangeDimAfterODF = (data) => {
    if (!data.length) {
        return [];
    }

    let endDim;
    let unCatDims = [];
    let catDims = [];

    const [, odfDims] = getSortedCatExpAndCategories();
    const dimOrderingFromODF = odfDims.map((dim) => [Number(dim.end_proc_cate), Number(dim.GET02_CATE_SELECT[0])]);
    if (!dimOrderingFromODF) {
        return data;
    }
    const endDimIDFromChart = data[data.length - 1].dPV;
    const dpvOrdering = dimOrderingFromODF.map((dim) => `${dim[0]}-${dim[1]}`);
    const endDimFromODF = dpvOrdering[dpvOrdering.length - 1];

    if (!dpvOrdering.includes(endDimIDFromChart)) {
        // keep objective var from chart
        endDim = data[data.length - 1];
    } else {
        endDim = data.filter((dim) => dim.dPV == endDimFromODF)[0];
    }

    // filter columns are not in category list and endDim
    unCatDims = data.filter((dim) => !dpvOrdering.includes(dim.dPV) && dim.dPV !== endDim.dPV);

    catDims = dpvOrdering
        .filter((dimDPV) => dimDPV !== endDim.dPV)
        .map((dimDPV) => {
            return data.filter((dim) => dim.dPV === dimDPV)[0];
        });

    return [...catDims, ...unCatDims, endDim].filter((dim) => dim !== undefined);
};

const getAllDimDPVFromChart = () => {
    const allDimInParal = Array.from($('#paracord-plot g.y-axis').find('text.axis-title'));
    const allDimInParac = $('g.dimension');

    const getParacDimPosition = (translateVal) => {
        const [x] = translateVal
            .replace('translate', '')
            .replace('(', '')
            .replace(')', '')
            .split(',')
            .map((val) => Number(val));
        return x;
    };

    // parallel graph
    if (allDimInParal.length) {
        return allDimInParal.map((dim) => $(dim).data('dpv'));
    }

    let catDimPosition = allDimInParac.map((i, dim) => [[getParacDimPosition($(dim).attr('transform')), i]]);
    // sort categroy dimension by transform value
    catDimPosition.sort((a, b) => a[0] - b[0]);
    if (catDimPosition.length) {
        const dpvs = catDimPosition.map((_, dim) => $(allDimInParac[dim[1]]).find('text.dimlabel:eq(0)').data('dpv'));
        return Array.from(dpvs);
    }
    return [];
};

const getDimPositionFromGraph = () => {
    if (!latestDimensionInChart) {
        return false;
    }
    const latestDimDPV = latestDimensionInChart.map((dim) => dim.dPV);
    const currentDimDPV = getAllDimDPVFromChart();
    const isChanged = JSON.stringify(latestDimDPV) !== JSON.stringify(currentDimDPV);
    if (isChanged) {
        return currentDimDPV;
    }
    return false;
};

const updateDimPosition = (dimPositions) => {
    if (latestDimensionInChart) {
        const dimensions = [];
        dimPositions.forEach((dPV) => {
            dimensions.push(latestDimensionInChart.filter((dim) => dim.dPV === dPV)[0]);
        });
        return dimensions;
    }
    return latestDimensionInChart;
};

const transformCategoryData = (dimensions, useCategorized) => {
    dimensions.forEach((dimension) => {
        const [, colID] = dimension.dPV.split('-').map((i) => Number(i));
        const [sensorDat] = paracordTraces
            ? paracordTraces.array_plotdata.filter((plot) => plot.end_col_id == colID)
            : null;
        const uniqueArrayY = Array.from(new Set(sensorDat.array_y)).length;
        // format ticks of dimension
        dimension.ticktext = dimension.ticktext.map((i) => applySignificantDigit(i));
        if (sensorDat.col_detail.data_type == DataTypes.INTEGER.name) {
            if (uniqueArrayY > MAX_INT_LABEL_SIZE) {
                dimension.values = sensorDat.categorized_data.map((i) => parseInt(i));
                return;
            }
        }
        dimension.values = dimension.values.map((i) => Number(i));
        dimension.categoryorder = 'array'; // set 'array' to ordering groups by ticktext

        if (sensorDat && Object.keys(sensorDat.rank_value).length) {
            let rankVal = Object.keys(sensorDat.rank_value)
                .map((i) => Number(i))
                .sort((a, b) => a - b);
            if (dimension.isReal) {
                rankVal.reverse();
            }
            dimension.ticktext = rankVal.map((i) => sensorDat.rank_value[i]);
            dimension.tickvals = rankVal;
            if (!rankVal.length) {
                let sensorArrayY = sensorDat.array_y;
                if (useCategorized && sensorDat.categorized_data.length) {
                    sensorArrayY = sensorDat.categorized_data;
                }
                let hasNA = sensorArrayY.includes(null);
                rankVal = Array.from(new Set(sensorArrayY.filter((i) => i))).sort((a, b) => a - b);
                if (dimension.isReal) {
                    rankVal.reverse(); // [3,2,1]
                }
                dimension.values = sensorArrayY;
                dimension.ticktext = rankVal;
                dimension.tickvals = rankVal;
                if (hasNA) {
                    // add NA to categories of sensors
                    dimension.ticktext = [...rankVal, COMMON_CONSTANT.NA];
                    dimension.tickvals = [...rankVal, null];
                }
            } else {
                const naIndex = dimension.ticktext.indexOf(COMMON_CONSTANT.NA);
                // has NA in rank_value
                if (naIndex >= 0) {
                    const tickTextWtNA = dimension.ticktext.filter((tick) => tick !== COMMON_CONSTANT.NA);
                    const tickValWtNA = dimension.tickvals.filter((val, i) => i !== naIndex);
                    const naVal = dimension.tickvals[naIndex];
                    // add NA to categories of sensors
                    dimension.ticktext = [...tickTextWtNA, COMMON_CONSTANT.NA];
                    dimension.tickvals = [...tickValWtNA, naVal];
                }
            }
            dimension.ticktext = dimension.ticktext.map((i) => String(i));
            dimension.categoryarray = dimension.tickvals;
            dimension.group = dimension.ticktext;
        }
    });
    return dimensions;
};

const rearrangeNominalVars = (data, categoryCols, prop) => {
    const isNominalScale = prop.is_nominal_scale == 'true';
    // re-arrange when there are nominal vars else do not apply
    let nominalVars = prop.nominal_vars ? prop.nominal_vars.map((i) => Number(i)) : [];
    if (isNominalScale) {
        nominalVars = categoryCols.map((col) => col.col_id);
    }

    if (nominalVars.length) {
        data.forEach((dim) => {
            const [, colID] = dim.dPV.split('-').map((i) => Number(i));
            if (nominalVars.includes(colID)) {
                const naIdx = dim.ticktext.indexOf(COMMON_CONSTANT.NA);
                const naValues = {
                    categoryarray: dim.categoryarray[naIdx],
                    group: dim.group[naIdx],
                    ticktext: dim.ticktext[naIdx],
                    tickvals: dim.tickvals[naIdx],
                };
                let tickVals = dim.ticktext
                    .map((tick) => (!isNaN(Number(tick)) ? Number(tick) : tick))
                    .filter((tick) => tick !== COMMON_CONSTANT.NA);
                let tickValsSorted = [...tickVals].sort((a, b) => a - b);
                const sortIndex = tickValsSorted.map((tick) => tickVals.indexOf(tick));
                dim.categoryarray = sortIndex.map((idx) => dim.categoryarray[idx]);
                dim.group = sortIndex.map((idx) => dim.group[idx]);
                dim.ticktext = sortIndex.map((idx) => dim.ticktext[idx]);
                dim.tickvals = sortIndex.map((idx) => dim.tickvals[idx]);
                if (naIdx >= 0) {
                    dim.categoryarray.push(naValues.categoryarray);
                    dim.group.push(naValues.group);
                    dim.ticktext.push(naValues.ticktext);
                    dim.tickvals.push(naValues.tickvals);
                }
            }
        });
    }
    return data;
};

const genObjectiveDimForNumberCol = (dimensions, objectVarID) => {
    const pcpDat = graphStore.getPCPArrayPlotDataByID(Number(objectVarID));
    const endDim = dimensions[dimensions.length - 1];
    let line = null;
    const NA = 'NA';
    const NAValue = -1;
    const maxVal = Math.max(...endDim.values) + 1;
    if (!isEmpty(pcpDat)) {
        // detect NA group
        let hasNA = false;
        if (endDim.ticktext.includes(NA)) {
            let naIdx = endDim.ticktext.indexOf(NA);
            if (naIdx < 0 && Object.keys(endDim).includes('group')) {
                naIdx = endDim.group.indexOf(NA);
            }
            hasNA = naIdx >= 0;
            if (hasNA) {
                endDim.categoryarray.splice(naIdx, 1);
                endDim.group.splice(naIdx, 1);
                endDim.ticktext.splice(naIdx, 1);
            }
        }

        // create dummy values
        let dummyVals = endDim.values;
        let uniqueVals = Array.from(new Set(dummyVals)).sort();
        let reverseVals = [...uniqueVals].reverse();
        // add NA again
        if (hasNA) {
            uniqueVals = [...uniqueVals.filter((i) => i !== NAValue), NAValue];
            reverseVals = [...reverseVals.filter((i) => i !== NAValue), NAValue];
        }
        // create dummy value
        endDim.values = dummyVals.map((i) => reverseVals[uniqueVals.indexOf(i)]);

        // update categoryarray
        endDim.categoryarray = uniqueVals;

        if (hasNA) {
            endDim.values = endDim.values.map((i) => (i == NAValue ? maxVal : i));
            endDim.categoryarray = endDim.categoryarray.map((i) => (i == NAValue ? maxVal : i));
        }
        // update tickvals
        endDim.tickvals = endDim.categoryarray;
        // update ticktext
        const tickWoNA = endDim.ticktext.reverse();
        endDim.ticktext = hasNA ? [...tickWoNA.filter((i) => i !== NA), NA] : tickWoNA;
        // update group
        endDim.group = endDim.ticktext;

        line = {
            color: endDim.values,
            colorscale: colorPallets.JET_REV.scale,
            showscale: false,
        };
    }
    return [dimensions, line];
};

const handleSortPCPDimension = (lastDimIsObjective = false) => {
    const dimensions = pcpPlot.dimensions;
    let dimensionOrdering = [...latestSortColIds];
    const sortBy = getSettingOptions();
    if (sortBy.orderBy !== ParallelProps.orderBy.selected_order) {
        return dimensions;
    }

    if (lastDimIsObjective) {
        let endDim = '';
        const dimAsObj = {};
        dimensionOrdering = [...dimensions];
        if (pcpPlot.objective.id) {
            dimensionOrdering.forEach((dim) => (dimAsObj[dim.dimID] = dim));
            dimOrdering = latestSortColIds.map((dimID) => {
                const [, colID] = dimID.split('-');
                if (String(pcpPlot.objective.id) !== String(colID)) {
                    return dimAsObj[dimID];
                } else {
                    endDim = dimID;
                }
                return null;
            });
            dimensionOrdering = dimOrdering.filter((i) => i !== null);
            dimensionOrdering = [...dimensionOrdering, dimAsObj[endDim]];
        }
    }
    pcpPlot.setOrdering(dimensionOrdering, !lastDimIsObjective);
    pcpPlot.show();
};

const getSelectedValues = () => {
    const graphDiv = document.getElementById(pcpPlot.plotDOMId);
    // do not execute data selection for categorized real graph
    if (
        [ParallelProps.showVariables.CATEGORY, ParallelProps.showVariables.CATEGORIZED].includes(
            pcpPlot.settings.showVars,
        )
    ) {
        return;
    }
    graphDiv.on('plotly_restyle', (data) => {
        const dimensionKey = Object.keys(data[0])[0];
        if (!dimensionKey || !dimensionKey.includes('constraintrange')) {
            // this event for reselect range of value in dimension only, not for other restyle events
            return;
        }
        const dimensionId = Number(dimensionKey.match(/\d+/g)[0]);
        const selectedDimension = pcpPlot.dimensions[dimensionId];
        let constraintRange = data[0][dimensionKey];
        if (constraintRange && _.isArray(constraintRange[0][0])) {
            constraintRange = constraintRange[0];
        }
        if (!selectedDimension.isNum && constraintRange) {
            // get category value by ticks text and ticks value
            // tim so nguyen trong mang
            constraintRange = constraintRange.map((range) => {
                const from = Math.round(range[0]);
                const to = Math.round(range[1]);
                const selectedValue = [];
                for (let i = from; i <= to; i++) {
                    selectedValue.push(i);
                }
                return selectedValue
                    .map((val) => {
                        const indexTickVal = selectedDimension.tickvals.indexOf(val);
                        return selectedDimension.ticktext[indexTickVal];
                    })
                    .filter((v) => v);
            });
        }
        pcpPlot.setSelectedValue(selectedDimension.colId, constraintRange);
        getAndDisplayDataViewTable();
    });
};

const onChangeShowCTTime = (e) => {
    $(e).attr('disabled', true);
    e.ready = true;
    const settingInfo = getSettingCommonInfo();
    const userSetting = JSON.parse(settingInfo.settings);
    const traceDataForm = userSetting.traceDataForm;
    const lastElementChecked = traceDataForm
        .filter(
            (item) =>
                (item.type === 'checkbox' && item.name.startsWith('GET02_VALS_SELECT') && item.checked) ||
                (item.type === 'radio' && item.name === 'objectiveVar' && item.checked),
        )
        .pop();
    const lastElementCheckedId = lastElementChecked?.id || '';
    $(formElements.showCT_Time).data('target-id-to-enable-ct', lastElementCheckedId);
    $(formElements.endProcSelectedItem).trigger('change');
    setTimeout(function () {
        applyUserSetting(settingInfo, null, false);
        if (!lastElementCheckedId) {
            enableCycleTimeAnalysis();
        }
    }, 100);
};

const getSelectedDataFrame = async () => {
    const formData = collectFormDataPCP(true);
    formData.set('export_from', 'plot');
    formData.set('constraint_range', JSON.stringify(pcpPlot.selectedConstraintRange));
    loadingShow();
    const queryString = genQueryStringFromFormData(formData);
    if (queryString && queryString.includes('GET02_VALS_SELECT')) {
        return await fetchSelectedDataFrame(queryString);
    }
    loadingHide();
    return null;
};

const fetchSelectedDataFrame = async (queryString) => {
    const dataFrame = await fetchData(`/ap/api/pcp/select_data?${queryString}`, {});
    return [dataFrame['cols'], dataFrame['rows'], dataFrame['cols_name']];
};

const buildPCPTableDataSelectedHeader = (columnsName) => {
    $(tableSelectedDataElems.tableHeaderTr).append('<td></td>');
    columnsName.forEach((columnName) => {
        const tdHtml = `
                <td class="show-raw-text parent-column-local-name">
                    ${columnName}
                </td>
        `;
        $(tableSelectedDataElems.tableHeaderTr).append(tdHtml);
    });
};

const buildPCPTableDataSelectedBody = (rows) => {
    let tbodyRowHtml = ``;
    rows.forEach((row, index) => {
        let tdHtml = ``;
        tdHtml += `<td >${index + 1}</td>`;
        Object.keys(row).forEach(function (key) {
            tdHtml += `
                <td class="show-raw-text parent-column-local-name">
                    ${row[key]}
                </td>`;
        });
        tbodyRowHtml += `<tr>${tdHtml}</tr>>`;
    });
    $(tableSelectedDataElems.tableBody).append(tbodyRowHtml);
};

const handlerPCPDisplayTableDataSelected = (dataSelected) => {
    clearTableDataSelected();
    if (isEmpty(dataSelected) || isEmpty(pcpPlot.selectedConstraintRange)) {
        // Hide table data selected if don't selected data
        $(tableSelectedDataElems.cardContainer).css('display', 'none');
        return;
    }
    const [_, rows, colsName] = dataSelected;
    $(tableSelectedDataElems.tableBodyContent).remove();
    $(tableSelectedDataElems.cardContainer).css('display', 'block');
    // Handler display table data selected
    buildPCPTableDataSelectedHeader(colsName);
    buildPCPTableDataSelectedBody(rows);
};

const getAndDisplayDataViewTable = () => {
    if (formElements.dataView.is(':checked')) {
        getSelectedDataFrame().then((r) => {
            loadingHide();
            handlerPCPDisplayTableDataSelected(r);
        });
    }
};

const clearTableDataSelected = () => {
    $(tableSelectedDataElems.tableHeaderContent).remove();
    $(tableSelectedDataElems.tableBodyContent).remove();
    $(tableSelectedDataElems.cardContainer).css('display', 'none');
};
