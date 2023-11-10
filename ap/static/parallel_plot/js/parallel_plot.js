/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
let tabID = null;

// save paracords tracing data
const MAX_NUMBER_OF_SENSOR = 60;
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

const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    endProcCateSelectedItem: '#end-proc-cate-row select',
    condProcReg: /cond_proc/g,
    i18nAllSelection: $('#i18nAllSelection').text(),
    i18nNoFilter: $('#i18nNoFilter').text(),
    NO_FILTER: 'NO_FILTER',
    showOutliersDivID: '#showOutlier',
    i18nShowOutliers: $('#i18nShowOutliers').text(),
    i18nHideOutliers: $('#i18nHideOutliers').text(),
    i18nMSPCorr: $('#i18nMSPCorr').text(),
    END_PROC: 'end_proc',
    VAL_SELECTED: 'GET02_VALS_SELECT',
    // isRemoveOutlier: $('#isRemoveOutlier'),
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
        CATEGORIZED: 'categorized_real'
    },
    corrOrdering: {
        orderBy: ['correlation', 'top'],
        corrValue: ['corr_value', 'max_vars'],
        orderLim: ['top_vars'],
        all: ['correlation', 'top', 'corr_value', 'max_vars', 'top_vars'],
    },
    orderOptions: {
        setting: 'setting',
        process: 'process',
        correlation: 'correlation',
    }
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
        hideCTCol: true,
        showLabels: true,
        labelAsFilter: true,
    });
    endProcItem();

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
         condProcItem();
         updateSelectedItems();
         addAttributeToElement();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        updateSelectedItems();
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

// add end proc
const addEndProc = (procIds, procVals, realSensor = true, isRequired = false) => {
    const sensorType = realSensor ? 'real' : 'cate';

    // in category sensors box, use end_proc21 instead of end_proc1

    let minDynamicCard;
    let maxDynamicCard;
    if (realSensor) {
        minDynamicCard = 1;
        maxDynamicCard = 50;
    } else {
        minDynamicCard = 51;
        maxDynamicCard = 100;
    }

    let count = minDynamicCard;

    const innerFunc = () => {
        const itemList = [];
        for (let i = 0; i < procIds.length; i++) {
            const itemId = procIds[i];
            const itemVal = procVals[i].name;
            const itemEnVal = procVals[i].en_name;
            itemList.push(`<option value="${itemId}" title="${itemEnVal}">${itemVal}</option>`);
        }
        // btn-add-end-proc-paracords-real
        while (checkExistDataGenBtn(`btn-add-end-proc-paracords-${sensorType}`, count, '', maxDynamicCard)) {
            count = countUp(count, minDynamicCard, maxDynamicCard);
        }

        const parentId = `end-proc-process-div-${count}-parent`;

        const proc = `<div class="col-12 col-xl-6 col-lg-12 col-md-12 col-sm-12 p-1">
                <div class="card end-proc table-bordered py-sm-3" id="${parentId}">
                        <span class="pull-right clickable close-icon" data-effect="fadeOut">
                            <i class="fa fa-times"></i>
                        </span>
                        <div class="d-flex align-items-center" id="end-proc-process-div-${sensorType}-${count}">
                            <span class="mr-2">${i18nCommon.process}</span>
                            <div class="w-auto flex-grow-1">
                                <select class="form-control select2-selection--single
                                    select-n-columns
                                    ${isRequired ? 'required-input' : ''}"
                                    name="end_proc${count}" id="end-proc-${sensorType}-${count}"
                                    data-gen-btn="btn-add-end-proc-paracords-${sensorType}"
                                    onchange="endProcOnChange(${count}, '${sensorType}', ${isRequired})">
                                    ${itemList.join(' ')}
                                </select>
                            </div>
                        </div>
                        <div id="end-proc-val-div-${sensorType}-${count}">
                        </div>
                     </div>
                    </div>`;
        $(`#end-proc-paracords-${sensorType}-row div`).last().before(proc);

        cardRemovalByClick(`#end-proc-paracords-${sensorType}-row div`);
    };
    return innerFunc;
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
        const selectedValue = formData.getAll(formElements.VAL_SELECTED + endProcSuf[k]).filter(x => x !== 'All');
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
            v.map(selection => formData.append(`${formElements.VAL_SELECTED}${k}`, selection));
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

const resetSetting = (isRedirectFromJump=false) => {
    // reset setting variables
    $("select[name='show-var']").val('all');
    const orderValue = isRedirectFromJump ? 'setting' : 'correlation';
    $(`input[name='sort_by'][value=${orderValue}]`).prop('checked', true);
};

const clearTargetTmp = () => {
    targetSensorName = null;
    targetSensorDat = null;
    targetSensorIndex = null;
    targetDim = null;
};
const getSensorTypes = (sensorDat) => {
    let hasRealSensors = false;
    let hasCatSensors = false;
    sensorDat.forEach((sensor) => {
        if (sensor.col_detail.type === DataTypes.REAL.name) {
            hasRealSensors = true;
        } else {
            hasCatSensors = true;
        }
    });
    if (hasRealSensors && hasCatSensors) {
        return paracordsSetting.showVariables.ALL;
    }
    if (hasRealSensors) {
        return paracordsSetting.showVariables.REAL;
    }
    return paracordsSetting.showVariables.CATEGORY;
};

const collectFormDataPCP = (clearOnFlyFilter) => {
    let formData = collectFormData(formElements.formID);
    if (clearOnFlyFilter) {
        formData = mergeTargetProc(formData);
        formData = genDatetimeRange(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }
    return formData;
};

const showParallelGraph = (clearOnFlyFilter = false, isRedirectFromJump=false) => {
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
        let defaultShowOrder = isRedirectFromJump ?
            paracordsSetting.orderOptions.setting :
            paracordsSetting.orderOptions.correlation;
        // set order default value for paracat only
        if (sensorTypes === paracordsSetting.showVariables.CATEGORY) {
            defaultShowOrder = paracordsSetting.orderOptions.process;
        }
        showParacords(res, isRedirectFromJump, sensorTypes, clearOnFlyFilter, defaultShowOrder);

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
    const isSortedByCorr = sortedOptions === CONST.CORR;
    const showOrderFrom = $("input[name='corr_value']").val();
    const showMaxVars = showOrder === CONST.CORR ? Number($("input[name='max_vars']").val()) : undefined;
    const showTopVars = showOrder === CONST.CORR ? Number($("input[name='top_vars']").val()) : undefined;
    return {
        showVariable,
        showOrder,
        showOrderFrom,
        showMaxVars,
        showTopVars,
        isSortedByCorr,
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
const handleSelectMenuItem = (e, updatePosition=false) => {
    // get setting options
    const settings = getSettingOptions();

    // bind target sensor
    const selectedDim = $(e).attr('data-target-dim') || null;
    if (selectedDim) {
        const [, dim] = selectedDim.split('-').map(i => Number(i));

        // bindTargetSensor(selectedDim);
        // updateParacords
        // if (paracordTraces) {
        //     settings.showVariable = getSensorTypes(paracordTraces.array_plotdata);
        // }

        let objectVar = Number(dim);
        if (updatePosition) {
            // update pcp data
            updateParacords(dim);
            [, objectVar] = getObjectiveDim(true);
            showParacords(
                paracordTraces,
                false,
                settings.showVariable,
                false,
                settings.showOrder,
                settings.showOrderFrom,
                objectVar,
                settings.showMaxVars,
                settings.showTopVars,
                settings.isSortedByCorr,
                true,
                selectedDim);
        } else {
            showParacords(
                paracordTraces,
                false,
                settings.showVariable,
                true,
                settings.showOrder,
                settings.showOrderFrom,
                objectVar,
                settings.showMaxVars,
                settings.showTopVars,
                settings.isSortedByCorr);
        }
    }

    hideMenu();
};

const callBackendAPI = async (filter) => {
    loadingShow();
    let formData = lastUsedFormData;
    formData = transformCatFilterParams(formData);

    showGraphCallApi('/ap/api/pcp/index', formData, REQUEST_TIMEOUT, async (res) => {
        paracordTraces = res;
        const settings = getSettingOptions();
        needUpdateDimColor = true;

        // clear old target variables
        if (settings.showVariable === 'category') {
            // clearTargetTmp();
            const previousEndDim = getDPVFromLatestCatDim();
            if (previousEndDim) {
                updateTargetDim(previousEndDim);
            }
        }

        if (paracordTraces) {
            const endDim = getDimOrderingFromODF();
            const [, dim] = endDim || targetDim;
            showParacords(
                paracordTraces,
                false,
                settings.showVariable,
                filter,
                settings.showOrder,
                settings.showOrderFrom,
                dim,
                settings.showMaxVars,
                settings.showTopVars,
                settings.isSortedByCorr,
                false,
            );
            $('#updateParacords').addClass('hide');
        }

        removeOutlierOptionChanged = false;
        removeOutliers = 0;
    });
};

const showParacordWithSettings = async (filter = false) => {
    // close sidebar
    beforeShowGraphCommon(false);

    $('#updateParacords').removeClass('hide');
    if (removeOutlierOptionChanged || filter) {
        await callBackendAPI(filter);
        return;
    }

    const settings = getSettingOptions();

    // get settings from after filter by on-demand
    if (filter) {
        settings.showVariable = getSensorTypes(paracordTraces.array_plotdata);
    }

    if (paracordTraces) {
        const [, dim] = targetDim;
        showParacords(
            paracordTraces,
            false,
            settings.showVariable,
            filter,
            settings.showOrder,
            settings.showOrderFrom,
            dim,
            settings.showMaxVars,
            settings.showTopVars,
            settings.isSortedByCorr,
            false,
        );
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
        const [x,] = translateVal.replace('translate', '')
            .replace('(', '')
            .replace(')', '')
            .split(',')
            .map(val => Number(val))
        return x;
    } ;
    const dimensions = $('g.dimension')
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

const changeDimColor = (isParacat=false) => {
    const allDim = $('#paracord-plot g.y-axis');
    const lastDim = $(`#paracord-plot g.y-axis:eq(${allDim.length - 1})`);
    // const dpvID = lastDim.length ? lastDim.find('text.axis-title:eq(0)').data('dpv') : null;
    const dpvID = targetDim ? `${targetDim[0]}-${targetDim[1]}` : null;
    if (dpvID) {
        const sameProcDim = $('#paracord-plot g.y-axis').find(`.axis-title[data-dpv^=${dpvID.split('-')[0]}]`);
        const tspanLabel = '.axis-title tspan.line>tspan';
        // reset all dim color
        allDim.find(tspanLabel).css('fill', CONST.WHITE);
        sameProcDim.find('tspan.line>tspan').css('fill', CONST.LIGHT_BLUE);
        // set target dim color
        lastDim.find(tspanLabel).css('fill', CONST.YELLOW);
        updateTargetDim(dpvID);
    }

    // for category chart
    if (isParacat) {
        const allCatDim = $('g.dimension').find('.dimlabel:eq(0)');
        // reset color of all dimension
        allCatDim.css('fill', CONST.WHITE);

        const endDim = getEndCatDimFromChart();
        // assign blue for same process columns
        const objectiveDPV = dpvID;
        if (objectiveDPV) {
            const [processID,] = objectiveDPV.split('-');
            allCatDim.filter((i, v) => $(v).data('dpv') === objectiveDPV)
                .css('fill', CONST.YELLOW);
            allCatDim.filter((i, v) => $(v).data('dpv').split('-')[0] === processID && $(v).data('dpv') !== objectiveDPV)
                .css('fill', CONST.LIGHT_BLUE);
            if (needUpdateDimColor) {
                if (endDim && endDim.length) {
                    endDim.css('fill', CONST.YELLOW);
                } else {
                    allCatDim.last().css('fill', CONST.YELLOW);
                }
                updateTargetDim(objectiveDPV);
            }
        }
    }
    needUpdateDimColor = false;
};

const updateTargetDim = (targetDPV, changeColor=false) => {
    if (paracordTraces) {
        // update on-demand-filter modal content
        const dimPositions = getDimPositionFromGraph();
        if (dimPositions && latestDimensionInChart) {
            const {category} = paracordTraces.filter_on_demand;
            const dimAfterUpdate = updateDimPosition(dimPositions);
            const odfData = updateCategoryOrdering(category, dimAfterUpdate);
            const filterData = {
                ...paracordTraces.filter_on_demand,
                category: odfData,
            }
            fillDataToFilterModal(filterData, () => {
                showParacordWithSettings(true);
            });
        }

        const newTargetDPV = targetDPV.split('-').map(i => Number(i));
        clearTargetTmp();
        // re-assign target dimension information
        paracordTraces.array_plotdata.forEach((dat, idx) => {
            if (dat.col_detail.id === newTargetDPV[1] && dat.col_detail.proc_id === newTargetDPV[0]) {
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
        const transDats = $(dim).attr('transform').match(/\(([^)]+)\)/)[1].split(',');
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

// todo: merge parameters to props
const showParacords = (dat, isRedirectFromJump=false, showVar = 'all', clearOnFlyFilter = false,
                       showOrder = paracordsSetting.orderOptions.correlation,
                       showOrderFrom = '0.7', objective = null,
                       maxDim = null, topDim = 8, isSortedByCorr = false,
                       useDefaultMaxCorr = true, explainVar=null) => {
    $('#paracord-plot').html('');
    const isParacat = showVar==paracordsSetting.showVariables.CATEGORY ||
        showVar==paracordsSetting.showVariables.CATEGORIZED;
    const useCategorized = showVar==paracordsSetting.showVariables.CATEGORIZED;
    const objectVarID = objective || dat.COMMON.objectiveVar[0] || null;
    const plotDat = dat.array_plotdata;
    const startProcID = dat.COMMON.start_proc;
    const totalRecord = dat.actual_record_number;
    let data = {};
    const dPVar = [];
    const dNames = [];
    const showFilterClass = 'show-detail click-only';
    // check showOrdering option
    // const orderBy = showOrder === CONST.CORR ? Number(showOrderFrom) : null;
    let orderBy = null;
    let maxVars = null;
    if (showOrder === CONST.CORR) {
        orderBy = isSortedByCorr ? Number(showOrderFrom) : 0;
        maxVars = isSortedByCorr ? maxDim : topDim;
    }
    const corrMatrix = dat.corrs;
    const getTargetSensorDat = (plotData) => {
        if (objectVarID) {
            const pcpDat = graphStore.getPCPArrayPlotDataByID(Number(objectVarID));
            if (!_.isEmpty(pcpDat)) {
                targetSensorDat = pcpDat.data.array_y;
                if (useCategorized && pcpDat.data.categorized_data.length) {
                    targetSensorDat = pcpDat.data.categorized_data;
                }
                targetSensorIndex = pcpDat.key;
                // targetSensorName = pcpDat.data.col_detail.name;
                targetDim = [pcpDat.data.col_detail.proc_id, pcpDat.data.col_detail.id];
                return targetSensorDat;
            }
        }
        if (!targetSensorDat) {
            for (let i = plotData.length - 1; i >= 0; i--) {
                const arrayYDat = plotData[i].array_y.filter(el => el);
                if (((plotData[i].col_detail.type === DataTypes.REAL.name && showVar !== 'category')
                        || (plotData[i].col_detail.type === CONST.CATEGORY && showVar === 'category'))
                    // && Number(startProcID) === plotData[i].col_detail.proc_id
                    && !isEmpty(arrayYDat)
                ) {
                    targetSensorDat = plotData[i].array_y;
                    if (useCategorized && plotData[i].categorized_data.length) {
                        targetSensorDat = plotData[i].categorized_data;
                    }
                    targetSensorIndex = i;
                    // targetSensorName = plotData[i].col_detail.name;
                    targetDim = [plotData[i].col_detail.proc_id, plotData[i].col_detail.id];
                    break;
                }
            }
            if (!targetDim) {
                const endEl = plotData.length - 1;
                targetSensorDat = plotData[endEl].array_y;
                if (useCategorized && plotData[endEl].categorized_data.length) {
                    targetSensorDat = plotData[endEl].categorized_data;
                }
                targetSensorIndex = endEl;
                targetDim = [plotData[endEl].col_detail.proc_id, plotData[endEl].col_detail.id];
            }
        }
        // todo: get the last real sensor which not empty
        return targetSensorDat;
    };
    // eslint-disable-next-line no-nested-ternary
    const propComparator = propName => (a, b) => (Math.abs(a[propName]) === Math.abs(b[propName])
        ? 0 : Math.abs(a[propName]) < Math.abs(b[propName]) ? -1 : 1);

    // sort number in array
    const propDimValCompare = (a, b) => (a - b);
    const onlyUnique = (value, index, self) => self.indexOf(value) === index;

    // generate dimension range text for real sensor
    const genDimRangeText = (dimValues, infIDX, minfIDX, isInt = false, fmt) => {
        const notNADim = dimValues.filter(i => i === 0 || i);
        const [minText, maxText] = findMinMax(notNADim);
        const rangeVals = maxText - minText;
        const stepVals = rangeVals / 9;
        const fractionDigit = rangeVals <= 1 ? 3 : 2;
        let tickVals = Array(...Array(10)).map((v, i) => {
            const tickVal = (minText + (stepVals * i));
            if (isInt) {
                return parseInt(tickVal, 10);
            }

            if (fmt && fmt.includes('e')) {
                return applySignificantDigit(tickVal, 4, fmt);
            }

            return parseFloat(tickVal.toFixed(fractionDigit));
        });
    
        // check inf/-inf
        // const naPosition = minfIDX.length > 0 ? 2 : 1;
        // eslint-disable-next-line no-nested-ternary
        const naPosition = infIDX.length > 0 && minfIDX.length > 0
            ? 3 : ((infIDX.length > 0 || minfIDX.length > 0) ? 2 : 1);
        // inf position
        const infDumVal = minText - stepVals;
        const minfDumVal = minText - 2 * stepVals;
        // other way
        // const naPosition = minfIDX.length > 0 ? 2 : 1;
        // const infDumVal = maxText + stepVals;
        // const minfDumVal = minText - stepVals;
        let naVals = false;
        // check dim have na values
        const naDumVal = minText - naPosition * stepVals;
        const transDim = dimValues.map((v, i) => {
            if (CONST.NAV.includes(v)) {
                if (infIDX.includes(i)) {
                    v = infDumVal;
                } else if (minfIDX.includes(i)) {
                    v = minfDumVal;
                } else {
                    naVals = true;
                    v = naDumVal;
                }
            }
            return v;
        });
    
        let tickText = tickVals;
        if (infIDX.length > 0) {
            tickText = [...tickText, COMMON_CONSTANT.INF];
            tickVals = [...tickVals, infDumVal];
            // tickText = [COMMON_CONSTANT.INF, ...tickText];
            // tickVals = [infDumVal, ...tickVals];
        }
        if (minfIDX.length > 0) {
            tickText = [COMMON_CONSTANT.MINF, ...tickText];
            tickVals = [minfDumVal, ...tickVals];
        }
        if (naVals) {
            tickText = [COMMON_CONSTANT.NA, ...tickText];
            tickVals = [naDumVal, ...tickVals];
        }
        return {
            values: transDim,
            tickText,
            tickVals,
        };
    };

    const isIntDim = dimValues => dimValues.map(i => Number.isInteger(i)).includes(true);

    // get dimension values with NA
    const dimValWithNA = sensorDat => sensorDat.array_y.map((i) => {
        if (CONST.NAV.includes(i)) {
            return CONST.NA;
        }
        return i || 0;
    });
    const dimWithNASorted = (sensorDat) => {
        const sensorType = sensorDat.col_detail.type;
        const dimGroup = sensorDat.array_y.filter(onlyUnique).filter(i => !CONST.NAV.includes(i));
        const dimValWithoutNA = sensorType === DataTypes.TEXT.name ? dimGroup.sort() : dimGroup.sort(propDimValCompare);
        // dimValWithoutNA.reverse().push(CONST.NA);
        // dimValWithoutNA.push(CONST.NA);
        return dimValWithoutNA;
    };

    // encode category to number
    const getDatWithEncode = (sensorDat) => {
        const haveNAValues = sensorDat.array_y.map(i => CONST.NAV.includes(i)).includes(true);
        // filter value without na
        const uniqueGroup = sensorDat.array_y.filter(i => !CONST.NAV.includes(i)).filter(onlyUnique);
        const uniqueGroupByCode = {};

        const sensorType = sensorDat.col_detail.type;
        let uniqueGroupSorted = sensorType === DataTypes.TEXT.name ? uniqueGroup.sort() : uniqueGroup.sort(propDimValCompare);

        const tickText = [];
        const tickVals = [];
        let sensorDatTrans = [];
        if (haveNAValues) {
            uniqueGroupSorted = [COMMON_CONSTANT.NA, ...uniqueGroupSorted];
            sensorDat.array_y.forEach((v, k) => {
                sensorDatTrans[k] = CONST.NAV.includes(v) ? COMMON_CONSTANT.NA : v;
            });
        } else {
            sensorDatTrans = sensorDat.array_y;
        }
        uniqueGroupSorted.forEach((v, k) => {
            uniqueGroupByCode[v] = k + 1;
            tickText.push(v);
            tickVals.push(k + 1);
        });

        return {
            sensorDatCoded: sensorDatTrans.map(yVal => uniqueGroupByCode[yVal]),
            tickVals,
            tickText,
        };
    };

    const dimensionByType = (plotData, varType) => {
        let dimensionDat = [];
        const targetSensorData = getTargetSensorDat(plotData);
        let endDimension;
        let explainDimension;
        let labelColor;
        let dimensionLabel;

        const filteredPlotData = filterByShowVarType(plotData, varType);

        filteredPlotData.forEach((sensorDat) => {
            let sensorArrayY = [...sensorDat.array_y];
            if (useCategorized && sensorDat.categorized_data.length) {
                sensorArrayY = sensorDat.categorized_data;
            }
            labelColor = Number(startProcID) === sensorDat.col_detail.proc_id ? CONST.LIGHT_BLUE : CONST.WHITE;
            let dimProcName = shortTextName(sensorDat.col_detail.proc_name, limitSize = 14);
            let dimSensorName = shortTextName(sensorDat.col_detail.name);
            const isCategory = sensorDat.col_detail.is_category;
            const isCategorize = sensorDat.col_detail.type === DataTypes.REAL.name && useCategorized;
            const corr = getCorrelation(corrMatrix, sensorDat.col_detail.id, targetDim[1]);


            // TODO split chart by selected option

            if (sensorDat.col_detail.type !== DataTypes.REAL.name) {
                // show all or show category only
                // sensorDat.array_y = sensorDat.array_y.map(i => i || '');
                // always integer
                if (targetDim[1] === sensorDat.col_detail.id) {
                    labelColor = CONST.YELLOW;
                }
                const dms = {
                    // ticktext: tickNumbers,
                    process: sensorDat.col_detail.proc_id,
                    correlation: corr,
                    isReal: 0,
                    dPV: `${sensorDat.col_detail.proc_id}-${sensorDat.col_detail.id}`,
                    dName: `${sensorDat.col_detail.name} ${sensorDat.col_detail.proc_name}`,
                };
                const sensorDatCoded = getDatWithEncode(sensorDat);
                if (!_.isEmpty(sensorDat.rank_value)) {
                    const ranking = Object.keys(sensorDat.rank_value);
                    if (ranking.length > MAX_CAT_LABEL) {
                        const step = Math.floor(ranking.length / MAX_CAT_LABEL);
                        dms.tickvals = ranking.filter(k => (Number(k) === 0) || (Number(k) + 1) % step === 0);
                        dms.ticktext = dms.tickvals.map(i => sensorDat.rank_value[i]);
                    } else {
                        dms.tickvals = Object.keys(sensorDat.rank_value);
                        dms.ticktext = dms.tickvals.map(i => sensorDat.rank_value[i]);
                    }
                }
                dms.values = sensorArrayY;
                dms.tickvals = dms.tickvals.map(i => Number(i));
                // correlation for int column
                 let special_corr = '';
                if (sensorDat.col_detail.type === DataTypes.INTEGER.name) {
                    special_corr = `[${applySignificantDigit(corr)}]`;
                }
                if (isParacat) {
                    dms.label = `${dimSensorName} ${dimProcName}`;
                    dms.values = dimValWithNA(sensorDat); // use origin values for ticktext in case of category plot

                    dms.group = dms.tickvals;
                    dms.categoryarray = dms.tickvals;
    
                } else {
                    dms.label = `<span style="color: ${labelColor};">${dimSensorName}</span><br>`;
                    dms.label += `<span ${isCategory ? 'is-category' : ''} style="color: ${labelColor};">${dimProcName}${special_corr}</span>`;
                }

                if ((targetDim[1] !== sensorDat.col_detail.id) && (!orderBy || (orderBy && Math.abs(corr) >= orderBy))) {
                    if (explainVar && explainVar == `${sensorDat.col_detail.proc_id}-${sensorDat.col_detail.id}`) {
                        explainDimension = dms;
                    } else {
                        dimensionDat.push(dms);
                    }
                } else {
                    endDimension = dms;
                }
            } else if (sensorDat.col_detail.type === DataTypes.REAL.name) {
                // show real only
                const fmt = dat.fmt[sensorDat.end_col_id];
                const dimTextAndVals = genDimRangeText(sensorArrayY, sensorDat.inf_idx, sensorDat.m_inf_idx, false, fmt);
                const dimRange = findMinMax(dimTextAndVals.values);
                if (targetDim[1] === sensorDat.col_detail.id) {
                    labelColor = CONST.YELLOW;
                }
                dimensionLabel = `<span style="color: ${labelColor};" class="dim-sensor">${dimSensorName}</span><br>`;
                dimensionLabel += `<span style="color: ${labelColor};" class="dim-proc">${dimProcName}[${applySignificantDigit(corr)}]</span>`;
                // dimension label for real sensor, show in paracat
                if (isParacat) {
                    dimensionLabel = `${dimSensorName}[${applySignificantDigit(corr)}]`;
                }


                if (showVar === paracordsSetting.showVariables.CATEGORIZED) {
                    dimTextAndVals.values = dimTextAndVals.values.map(i => applySignificantDigit(i));
                }
                if ((targetDim[1] !== sensorDat.col_detail.id)
                    && (!orderBy || (orderBy && Math.abs(corr) >= orderBy))) {
                    if (explainVar && explainVar == `${sensorDat.col_detail.proc_id}-${sensorDat.col_detail.id}`) {
                        explainDimension = {
                            label: dimensionLabel,
                            values: dimTextAndVals.values,
                            process: sensorDat.col_detail.proc_id,
                            dPV: `${sensorDat.col_detail.proc_id}-${sensorDat.col_detail.id}`,
                            dName: `${sensorDat.col_detail.name} ${sensorDat.col_detail.proc_name}`,
                            correlation: corr,
                            isReal: 1,
                            range: dimRange,
                            ticktext: dimTextAndVals.tickText,
                            tickvals: dimTextAndVals.tickVals,
                        };
                    } else {
                        dimensionDat.push({
                            label: dimensionLabel,
                            values: dimTextAndVals.values,
                            process: sensorDat.col_detail.proc_id,
                            dPV: `${sensorDat.col_detail.proc_id}-${sensorDat.col_detail.id}`,
                            dName: `${sensorDat.col_detail.name} ${sensorDat.col_detail.proc_name}`,
                            correlation: corr,
                            isReal: 1,
                            isCategorize: isCategorize,
                            range: dimRange,
                            ticktext: dimTextAndVals.tickText,
                            tickvals: dimTextAndVals.tickVals,
                        });
                    }
                } else {
                    endDimension = {
                        label: dimensionLabel,
                        values: dimTextAndVals.values,
                        process: sensorDat.col_detail.proc_id,
                        dPV: `${sensorDat.col_detail.proc_id}-${sensorDat.col_detail.id}`,
                        dName: `${sensorDat.col_detail.name} ${sensorDat.col_detail.proc_name}`,
                        correlation: corr,
                        isReal: 1,
                        isCategorize: isCategorize,
                        range: dimRange,
                        ticktext: dimTextAndVals.tickText,
                        tickvals: dimTextAndVals.tickVals,
                    };
                }
            }
        });
    
        if (showOrder !== paracordsSetting.orderOptions.setting) {
            dimensionDat.sort(propComparator(showOrder));
        } else {
            dimensionDat.sort(propComparator('isReal'));
        }

        if (explainDimension) {
            dimensionDat.push(explainDimension);
        }

        // limitation
        if (maxVars && dimensionDat.length) {
            dimensionDat = dimensionDat.reverse().slice(0, maxVars).reverse();
        }
    
        if (useDefaultMaxCorr) {
            const corrVals = dimensionDat.length ? dimensionDat.map(i => i.correlation ? Number(i.correlation) : 0) : [];
            const maxCorr = Math.round(Math.max(...corrVals) * 0.8 * 1000) / 1000;
            if (maxCorr) {
                $('input[name=corr_value]').val(maxCorr);
                $('input[name=corr_value]').attr(CONST.DEFAULT_VALUE, maxCorr);
            }
        }

        if (endDimension) {
            dimensionDat.push(endDimension);
        }
        // remove corr in dimensionDat
        dimensionDat.forEach((dimension) => {
            delete dimension.correlation;
            delete dimension.process;
        });
        return dimensionDat;
    };

    let dimensions = dimensionByType(plotDat, showVar);

    // update dimension data
    dimensions.forEach((dimension) => {
        dPVar.push(dimension.dPV);
        dNames.push(dimension.dName);
    });

    // update show chart type selection
    const currentSelected = $('select[name=show-var]').val();
    if (showVar !== currentSelected) {
        $('select[name=show-var]').val(showVar);
    }

    if (isRedirectFromJump && latestSortColIds) {
        const orderedDim = [];
        latestSortColIds.forEach(dimKey => {
            const dim = dimensions.filter(dim => dim.dPV == dimKey);
            if (dim) {
                orderedDim.push(dim[0]);
            }
        });
        dimensions = orderedDim.reverse();
    }

    if (!clearOnFlyFilter && showOrder === paracordsSetting.orderOptions.settings) {
        // reassigne dim position after change by odf
        dimensions = rearrangeDimAfterODF(dimensions);
    }
    latestDimensionInChart = [...dimensions];
    if (isParacat) {
        dimensions = transformCategoryData(dimensions, useCategorized);
        // show category variables only
        // use parcats plot
        const endDim = dimensions[dimensions.length - 1];
        data = [
            {
                type: 'parcats',
                dimensions,
                line: {
                    reversescale: !!!endDim.isReal,
                    colorscale: dnJETColorScale,
                    color: endDim && endDim.values.filter(i => i !== null).map(i => Number(i)),
                    showscale: !!endDim.isReal,
                },
                hoveron: 'color',
                hoverinfo: 'none',
                labelfont: {size: 10.5},
                arrangement: 'freeform',
            },
        ];
    } else {
        const selectedCol = plotDat[targetSensorIndex] || plotDat[plotDat.length - 1];
        const fmt = dat.fmt[selectedCol.end_col_id];
        // show all or real varaibles
        // use parcoords plot
        data = [{
            type: 'parcoords',
            line: {
                showscale: true,
                reversescale: false,
                colorscale: dnJETColorScale,
                color: selectedCol.array_y,
                colorbar: {
                    tickformat: fmt,
                },
            },
            labelfont: {size: 10.5},
            hoverinfo: 'none',
            dimensions,
        }];
    }

    // apply sigdigit for ticks
    dimensions.forEach((dimension) => {
        dimension.ticktext = dimension.ticktext.map(i => {
            const tickVal = Number(i);
            if (!['NA', 'inf', '-inf'].includes(i) && !isNaN(tickVal)) {
                return applySignificantDigit(tickVal);
            }
            return i;
        });
    });
    // assign chart width by parent cards and  number of variables
    const mainCardWidth = $('#mainContent').width();
    const widthByDim = 130 * dimensions.length;
    let plotWidth = mainCardWidth - 50;
    if (widthByDim >= mainCardWidth) {
        plotWidth = widthByDim;
    }
    const plotHeight = $(window).height() - 150;
    const layout = {
        plot_bgcolor: '#303030',
        paper_bgcolor: '#303030',
        font: { color: CONST.WHITE },
        colorbar: {
            thickness: 1,
        },
        yaxis: {
            tickfont: {
                // color: 'red',
            },
        },
        width: plotWidth,
        height: plotHeight,
        padding: {
            t: 30,
        },
        margin: { l: 150, r: 150 },
        // responsive: false,
    };
    // hide setting as default
    $('#sctr-card').show();

    // set default setting
    setSettingOptions(showVar, showOrder);

    // draw paracords
    loadingUpdate(80);

    Plotly.newPlot('paracord-plot', data, layout, { ...genPlotlyIconSettings() });

    $('#paracord-plot').show();

    // assign dimension data
    const paralellPlot = document.getElementById('paracord-plot');
    paralellPlot.on('plotly_afterplot', () => {
        const axisDim = $('.axis-title');
        if (dPVar.length) {
            dPVar.forEach((dimension, i) => {
                $(axisDim[i]).attr('data-dpv', dimension);
                // $(axisDim[i]).attr('data-dName', dNames[i]);
            });
            dNames.forEach((dimension, i) => {
                $(axisDim[i]).attr('data-dName', dimension);
            });
        }

        if (isParacat && targetDim && dimensions) {
            // update dimension color for category variables
            const dimInSVG = document.getElementsByClassName('dimension');
            dimensions.forEach((dim, i) => {
                // add custom data
                $($(dimInSVG[i]).find('.dimlabel')[0]).attr('data-dpv', dim.dPV);
                $($(dimInSVG[i]).find('.dimlabel')[0]).attr('data-dName', dim.dName);
                if (dim.isCategorize) {
                    $($(dimInSVG[i]).find('.dimlabel')[0]).attr('is-categorize', dim.isCategorize);
                }
            });
        }
        if (!isRedirectFromJump || !latestSortColIds) {
            bindChangeDimColor(isParacat);
        }
    });
    
    paralellPlot.on('plotly_hover', (data) => {
        if (!data.points) return;
        const count = data.points.length;
        const offset = {
            x: data.event.pageX - 120,
            y: data.event.pageY,
        }
        const ratio = applySignificantDigit(count / totalRecord * 100);
        const tbl = genHoverDataTable([['N', applySignificantDigit(count)], ['Ratio', `${ratio}%`]]);

        genDataPointHoverTable(tbl, offset, 100, true, 'paracord-plot')
    });

    unHoverHandler(paralellPlot);

    $('.axis-title').each((i, el) => {
        const isCategory = $(el).attr('data-unformatted').toString().includes('is-category');
        if (isCategory) {
            $(el).find('tspan:last-child tspan').addClass(showFilterClass);
        }
    });
    
    $('.axis-title, text.dimlabel').contextmenu((e) => {
        const label = $(e.currentTarget).text();
        const dimInfo = $(e.currentTarget).data('dpv');

        if (label && dimInfo) {
            // [targetSensorName] = label.split(' ');
            // targetDim = dimInfo.split('-').map(i => Number(i));
            $('#contextMenuParallelPlot .menu-item').attr('data-target-dim', dimInfo);
        }
        selectTargetDimHandler(e);
    });

    $('html, body').animate({
        scrollTop: $('#sctr-card').offset().top,
    }, 500);

    // if showVar = 'category only' and
    const categoryOnly = plotDat.filter((data) => data.col_detail.is_category).length === plotDat.length;
    const isShowMsg = dimensions.length > 0 && !categoryOnly && changeVariableOnly;
    if ((showVar === paracordsSetting.showVariables.CATEGORY) &&
        isShowMsg) {
        const msgContent = $('#i18nRemoveRealInParcats').text();
        showToastrMsg(msgContent);
        changeVariableOnly = false;
    }

    setTimeout(()=> {
        loadingHide();
        $('text.dimlabel[data-dpv]:not([is-categorize])').addClass(showFilterClass);
        $('#paracord-plot').scrollLeft(1000);
        // update category position of on-demand-filter same as dimension
        const odfData = updateCategoryOrdering(dat.filter_on_demand.category, dimensions);
        const filterData = {
            ...dat.filter_on_demand,
            category: odfData,
        }
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

const updateParacords = (dimensionID) => {
    if (!paracordTraces) {
        return;
    }
    const plotData = paracordTraces.array_plotdata;
    let targetDim = plotData[plotData.length - 1];
    const explainDim = plotData.filter(dim => String(dim.end_col_id) == String(dimensionID));
    const pcpData = plotData.filter(dim => ![
        String(dimensionID),
        String(targetDim.end_col_id)
    ].includes(String(dim.end_col_id)));
    // update pcp data
    paracordTraces.array_plotdata = [...pcpData, ...explainDim, targetDim];
};
const showCategoryVarOnly = (selection) => {
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

const filterByShowVarType = (plotData, showVar) => plotData.filter((data) => {
    if (showVar === paracordsSetting.showVariables.ALL) {
        return true;
    }
    
    if (showVar === paracordsSetting.showVariables.NUMBER) {
        return data.col_detail.type === DataTypes.REAL.name || data.col_detail.type === DataTypes.INTEGER.name;
    }
    
    if (showVar === paracordsSetting.showVariables.CATEGORY) {
        return data.col_detail.is_category === true;
    }
    
    if (showVar === paracordsSetting.showVariables.REAL) {
        return data.col_detail.type === DataTypes.REAL.name;
    }

    if (showVar === paracordsSetting.showVariables.CATEGORIZED) {
        return [DataTypes.INTEGER.name, DataTypes.REAL.name].includes(data.col_detail.type) ||
            data.col_detail.is_category === true;
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
                $('input[name=sort_option][value=top]')
                    .prop('checked', true);
            }
        } else if (sortBy !== CONST.CORR) {
            $(`input[name=sort_by][value=${CONST.CORR}]`).prop('checked', true);
        }

        // sub input
        if (isSubInput && corrOrderBy !== CONST.CORR
            && paracordsSetting.corrOrdering.corrValue.includes(targetVal)) {
            // reset to corr order
            $('input[name=sort_option][value=correlation]')
                .prop('checked', true);
        }
        if (isSubInput && corrOrderBy === CONST.CORR
            && paracordsSetting.corrOrdering.orderLim.includes(targetVal)) {
            // reset to top variable limit
            $('input[name=sort_option][value=top]')
                .prop('checked', true);
        }
    
        const orderingName = $('input[name=sort_by]:checked').closest('.form-check').find('span:first').text();
        // update ordering name
        $('#ordering-name').text(orderingName);
    
        // update chart by settings
        loading.show();
        setTimeout(() => {
            showParacordWithSettings();
            loading.hide();
        }, 500);
    });
};

const dumpData = (type) => {
    const formData = lastUsedFormData || collectFormDataPCP(true);
    handleExportDataCommon(type, formData);
};

const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};

const getObjectiveDim = (asArray=false) => {
    const endRealDim = $('#paracord-plot g.y-axis:eq(-1)').find('text.axis-title').data('dpv');
    const endcatDim = $('#paracord-plot g.dimension:eq(-1)').find('.dimlabel:eq(0)').data('dpv');
    const endDimID = endRealDim || endcatDim;
    if (asArray) {
        return endDimID.split('-');
    }
    return endDimID;
};

const bindChangeDimColor = (isParacat=false) => {
    // update color of dimension
    changeDimColor(isParacat);

    // bind drag-drpo dimension events
    $('g.y-axis .axis-title, g.dimension text.dimlabel')
        .off('mouseover').on('mouseover', (e) => {
            const dimName = $(e.currentTarget).attr('data-dName');
            $('#dimFullName').text(dimName);
            showDimFullName(e);
        })
        .off('mouseout').on('mouseout', () => {
            $('#dimFullName').text('');
            $('#dimFullName').hide();
        })

};

const updateCategoryOrdering = (categoryData, dimensions) => {
    if (!categoryData.length || !dimensions.length) {
        return [];
    }
    const catsOnDemandFilter = dimensions.map(dim => {
        const [procID, colID] = dim.dPV.split('-').map(i => Number(i));
        const odfDims = categoryData.filter(catDim => catDim.proc_name == procID && catDim.column_id == colID);
        if (odfDims.length) {
            return odfDims[0];
        }
        return null;
    }).filter(dim => dim !== null);
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
    const dimOrderingFromODF = odfDims.map(dim => [Number(dim.end_proc_cate), Number(dim.GET02_CATE_SELECT[0])]);
    if (!dimOrderingFromODF || !dimOrderingFromODF.length) {
        return endDimIDFromChart.split('-').map(val => Number(val));
    }

    const dpvOrdering = dimOrderingFromODF.map(dim => `${dim[0]}-${dim[1]}`);
    const endDimFromODF = dpvOrdering[dpvOrdering.length - 1];

    if (dpvOrdering.includes(endDimIDFromChart)) {
        endDim = latestDimensionInChart.filter(dim => dim.dPV == endDimFromODF)[0];
    }
    return endDim.dPV.split('-').map(val => Number(val));
}

const rearrangeDimAfterODF = (data) => {
    if (!data.length) {
        return [];
    }

    let endDim;
    let unCatDims = [];
    let catDims = [];

    const [, odfDims] = getSortedCatExpAndCategories();
    const dimOrderingFromODF = odfDims.map(dim => [Number(dim.end_proc_cate), Number(dim.GET02_CATE_SELECT[0])]);
    if (!dimOrderingFromODF) {
        return data;
    }
    const endDimIDFromChart = data[data.length - 1].dPV;
    const dpvOrdering = dimOrderingFromODF.map(dim => `${dim[0]}-${dim[1]}`);
    const endDimFromODF = dpvOrdering[dpvOrdering.length - 1];

    if (!dpvOrdering.includes(endDimIDFromChart)) {
        // keep objective var from chart
        endDim = data[data.length - 1];
    } else {
        endDim = data.filter(dim => dim.dPV == endDimFromODF)[0];
    }

    // filter columns are not in category list and endDim
    unCatDims = data.filter(dim => !dpvOrdering.includes(dim.dPV) && dim.dPV !== endDim.dPV);

    catDims = dpvOrdering.filter(dimDPV => dimDPV !== endDim.dPV).map(dimDPV => {
        return data.filter(dim => dim.dPV === dimDPV)[0];
    });

    return [...catDims, ...unCatDims, endDim].filter(dim => dim !== undefined);
};

const getAllDimDPVFromChart = () => {
    const allDimInParal = Array.from($('#paracord-plot g.y-axis').find('text.axis-title'));
    const allDimInParac = $('g.dimension');

    const getParacDimPosition = (translateVal) => {
        const [x,] = translateVal.replace('translate', '')
            .replace('(', '')
            .replace(')', '')
            .split(',')
            .map(val => Number(val))
        return x;
    } ;

    // parallel graph
    if (allDimInParal.length) {
        return allDimInParal.map(dim => $(dim).data('dpv'));
    }

    let catDimPosition = allDimInParac.map((i, dim) => [[getParacDimPosition($(dim).attr('transform')), i]]);
    // sort categroy dimension by transform value
    catDimPosition.sort((a, b) => a[0] - b[0]);
    if (catDimPosition.length) {
        const dpvs = catDimPosition.map((_, dim) => $(allDimInParac[dim[1]]).find('text.dimlabel:eq(0)').data('dpv'));
        return Array.from(dpvs);
    }
    return []

};

const getDimPositionFromGraph = () => {
    if (!latestDimensionInChart) {
        return false;
    }
    const latestDimDPV = latestDimensionInChart.map(dim => dim.dPV);
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
        dimPositions.forEach(dPV => {
            dimensions.push(latestDimensionInChart.filter(dim => dim.dPV === dPV)[0]);
        })
        return dimensions;
    }
    return latestDimensionInChart;
};

const transformCategoryData = (dimensions, useCategorized) => {
    dimensions.forEach((dimension) => {
        dimension.values = dimension.values.map(i => Number(i));
        dimension.categoryorder = 'array'; // set 'array' to ordering groups by ticktext
        const [,colID] = dimension.dPV.split('-').map(i => Number(i));
        const [sensorDat] = paracordTraces ? paracordTraces.array_plotdata.filter(
            plot => plot.end_col_id == colID) : null;
        if (sensorDat && sensorDat.rank_value) {
            let rankVal = Object.keys(sensorDat.rank_value).map(i => Number(i)).sort((a, b) => a - b);
            if (dimension.isReal) {
                rankVal.reverse();
            }
            dimension.ticktext = rankVal.map(i => sensorDat.rank_value[i]);
            dimension.tickvals = rankVal;
            if (!rankVal.length) {
                let sensorArrayY = sensorDat.array_y;
                if (useCategorized && sensorDat.categorized_data.length) {
                    sensorArrayY = sensorDat.categorized_data;
                }
                let hasNA = sensorArrayY.includes(null);
                rankVal = Array.from(new Set(sensorArrayY.filter(i => i))).sort((a, b) => a - b);
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
                    const tickTextWtNA = dimension.ticktext.filter(tick => tick !== COMMON_CONSTANT.NA);
                    const tickValWtNA = dimension.tickvals.filter((val, i) => i !== naIndex);
                    const naVal = dimension.tickvals[naIndex];
                    // add NA to categories of sensors
                    dimension.ticktext = [...tickTextWtNA, COMMON_CONSTANT.NA];
                    dimension.tickvals = [...tickValWtNA, naVal];
                }
            }
            dimension.categoryarray = dimension.tickvals;
            dimension.group = dimension.ticktext;
        }
    });
    return dimensions;
};