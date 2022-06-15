/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(60000); // 1 minutes
let tabID = null;

// save paracords tracing data
const MAX_END_PROC = 60;
let paracordTraces;
let targetSensorName;
let targetDim;
let targetSensorDat;
let targetSensorIndex;
let removeOutlierOptionChanged = false;
const isSSEListening = false;
const graphStore = new GraphStore();
const loading = $('.loading');
const MAX_INT_LABEL_SIZE = 128;
const MAX_CAT_LABEL = 32;

const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-paracords-real-row select',
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
    isRemoveOutlier: $('#isRemoveOutlier'),
};

const i18n = {
    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    warning: $('#i18nWarning').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    warningTitle: $('#i18nWarningTitle').text(),
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
};

const CONST = {
    RED: 'rgba(255,0,0,1)',
    BLUE: 'rgba(101, 197, 241, 1)',
    REAL: 'REAL',
    TEXT: 'TEXT',
    INT: 'INTEGER',
    CORR: 'correlation',
    YELLOW: 'yellow',
    CATEGORY: 'category',
    LIGHT_BLUE: '#65c5f1',
    WHITE: '#ffffff',
    NAV: ['', 'null', null, 'nan', 'NA', '-inf', 'inf'],
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
    },
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
    const endProcRealItem = addEndProc(endProcs.ids, endProcs.names, true, true);
    endProcRealItem();

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // click even of end proc add button
    $('#btn-add-end-proc-paracords-real').click(() => {
        endProcRealItem();
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
    // auto hide setting box
    $('.paracord-options-menu').on({
        mouseleave(e) {
            $(e.currentTarget).toggleClass('show');
            hideSettingMenu();
        },
    });

    // context menu paracords
    $('.context-menu').mouseleave((e) => {
        hideMenu();
    });

    $('.menu-item').mouseleave((e) => {
        hideMenu();
    });

    formElements.isRemoveOutlier.on('change', () => {
        removeOutlierOptionChanged = true;
    });

    // validation
    initValidation(formElements.formID);

    initializeDateTimeRangePicker();
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
            const itemVal = procVals[i];
            itemList.push(`<option value="${itemId}">${itemVal}</option>`);
        }
        // btn-add-end-proc-paracords-real
        while (checkExistDataGenBtn(`btn-add-end-proc-paracords-${sensorType}`, count, '', maxDynamicCard)) {
            count = countUp(count, minDynamicCard, maxDynamicCard);
        }

        const parentId = `end-proc-process-div-${count}-parent`;

        const proc = `<div class="col-12 col-lg-6 col-sm-12 p-1">
                <div class="card end-proc table-bordered py-sm-3" id="${parentId}">
                        <span class="pull-right clickable close-icon" data-effect="fadeOut">
                            <i class="fa fa-times"></i>
                        </span>
                        <div class="d-flex align-items-center" id="end-proc-process-div-${sensorType}-${count}">
                            <span class="mr-2">${i18nCommon.process}</span>
                            <div class="w-auto flex-grow-1">
                                <select class="form-control select2-selection--single ${isRequired ? 'required-input' : ''}"
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

        resizeListOptionSelect2(parentId);

        cardRemovalByClick(`#end-proc-paracords-${sensorType}-row div`);
    };
    return innerFunc;
};

// add End Process children components ( line, machine , partno)
const endProcOnChange = async (count, sensorType, isRequired) => {
    const selectedProc = $(`#end-proc-${sensorType}-${count}`).val();
    const procInfo = procConfigs[selectedProc];

    // remove old elements
    $(`#end-proc-val-${sensorType}-${count}`).remove();
    if (procInfo == null) {
        updateSelectedItems();
        return;
    }
    const ids = [];
    const vals = [];
    const names = [];
    const checkedIds = [];
    const dataTypes = [];
    await procInfo.updateColumns();
    const columns = procInfo.getColumns();

    // check if need get default checked columns from local storage
    const parentId = `end-proc-val-div-${sensorType}-${count}`;

    let colTypeIncluded = [];
    if (sensorType === sTypes.REAL) {
        colTypeIncluded = CfgProcess.REAL_TYPES;
    } else {
        colTypeIncluded = CfgProcess.CATEGORY_TYPES;
    }
    const dataTypeTargets = CfgProcess.NUMERIC_AND_STR_TYPES;
    // eslint-disable-next-line no-restricted-syntax
    for (const col of columns) {
        if (dataTypeTargets.includes(col.data_type)) {
            ids.push(col.id);
            vals.push(col.column_name);
            names.push(col.name);
            // checkedIds.push(col.id);
            dataTypes.push(col.data_type);
        }
    }

    // load machine multi checkbox to Condition Proc.
    if (ids) {
        addGroupListCheckboxWithSearch(parentId, `end-proc-val-${sensorType}-${count}`, '',
            ids, vals, checkedIds, `GET02_VALS_SELECT${count}`, false, names,
            null, dataTypes, null, null, isRequired,
            null, true, objectiveID = null,
            false, [], null);
    }

    // disable selected procs or enable unselected procs
    updateSelectedItems();
    onchangeRequiredInput();
};


const parallelTraceDataWithDBChecking = (action) => {
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (!isValid) return;

    // close sidebar
    beforeShowGraphCommon();

    // reset Remove oulier when press showgraph btn
    formElements.isRemoveOutlier.val('0');

    // destroy old chart instances
    for (const graphIdx in Chart.instances) {
        Chart.instances[graphIdx].destroy();
    }

    if (action === 'TRACE-DATA') {
        // parallelTraceData();
        showParallelGraph();
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

    // remove outlier flag
    formData.set('isRemoveOutlier', formElements.isRemoveOutlier.val());

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

const resetSetting = () => {
    // reset setting variables
    $("input[name='show-var'][value='all']").prop('checked', true);
    $("input[name='sort_by'][value='setting']").prop('checked', true);
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
        if (sensor.col_detail.type === CONST.REAL) {
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
const showParallelGraph = () => {
    loadingShow();

    $('input#datetimeRangePicker').change();
    let formData = collectFormData(formElements.formID);

    formData = mergeTargetProc(formData);
    // convert to UTC datetime to query
    formData = convertFormDateTimeToUTC(formData);
    // formData.set('autoUpdateInterval', 0);

    $.ajax({
        url: '/histview2/api/pcp/index',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            const t0 = performance.now();
            loadingShow(true);

            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            paracordTraces = res;
            // store trace result
            graphStore.setTraceData(_.cloneDeep(res));

            // clear targetSensorIndex
            clearTargetTmp();

            // reset setting variables
            resetSetting();

            const sensorTypes = getSensorTypes(res.array_plotdata);
            showParacords(res, sensorTypes);

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);
            // check and do auto-update
            // longPolling();

            // move invalid filter
            setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);
            // if (checkResultExist(res)) {
            //     saveInvalidFilterCaller(true);
            // } else {
            //     saveInvalidFilterCaller();
            // }

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
    }).then(() => {
        loadingHide();
        afterRequestAction();
    });

    // showParallelPlot();
};

const hideMenu = () => {
    $('#contextMenuParallelPlot').css({ display: 'none' });
    hideSettingMenu();
};
const hideSettingMenu = () => {
    $('.paracord-options-menu').css({ display: 'none' });
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
    const showVariable = $("input[name='show-var']:checked").val();
    const showOrder = $("input[name='sort_by']:checked").val();
    const showOrderFrom = $("input[name='corr_value']").val();
    return {
        showVariable,
        showOrder,
        showOrderFrom,
    };
};

const setSettingOptions = (showVariable = false, showOrder = false) => {
    if (showVariable) {
        $(`input[name='show-var'][value='${showVariable}']`).prop('checked', true);
    }
    if (showOrder) {
        $(`input[name='sort_by'][value='${showOrder}']`).prop('checked', true);
    }
};

const bindTargetSensor = (targetDimension) => {
    const plotData = paracordTraces.array_plotdata;
    if (paracordTraces) {
        for (let i = plotData.length - 1; i >= 0; i--) {
            if (targetDimension && plotData[i].col_detail.id === targetDimension[1]) {
                targetSensorIndex = i;
                targetSensorDat = plotData[i].array_y;
                // targetSensorName = plotData[i].col_detail.name;
                // targetDim = [plotData[i].col_detail.proc_id, plotData[i].col_detail.id];
                break;
            }
        }
    }
    return targetDimension;
};
const handleSelectMenuItem = (e) => {
    // get setting options
    const settings = getSettingOptions();

    // bind target sensor
    const selectedDim = $(e).attr('data-target-dim') || null;
    if (selectedDim) {
        const [, dim] = selectedDim.split('-').map(i => Number(i));

        // bindTargetSensor(dim);
        // updateParacords
        showParacords(paracordTraces, settings.showVariable, settings.showOrder, settings.showOrderFrom, dim);
    }

    hideMenu();
};


const callBackendAPI = async () => {
    loadingShow();
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);

    formData = mergeTargetProc(formData);
    // convert to UTC datetime to query
    formData = convertFormDateTimeToUTC(formData);

    await $.ajax({
        url: '/histview2/api/pcp/index',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            paracordTraces = res;
            // const settings = getSettingOptions();
            //
            // // clear old target variables
            // if (settings.showVariable === 'category') {
            //     // clearTargetTmp();
            //     const previousEndDim = getDPVFromLatestCatDim();
            //     if (previousEndDim) {
            //         updateTargetDim(previousEndDim);
            //     }
            // }
            //
            // if (paracordTraces) {
            //     const [, dim] = targetDim;
            //     // setTimeout(showParacords, 2000);
            //     showParacords(paracordTraces, settings.showVariable, settings.showOrder, settings.showOrderFrom, dim);
            //     $('#updateParacords').addClass('hide');
            // }
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
        loadingHide();
    });

    removeOutlierOptionChanged = false;
};

const showParacordWithSettings = async () => {
    // close sidebar
    beforeShowGraphCommon();

    $('#updateParacords').removeClass('hide');

    if (removeOutlierOptionChanged) {
        await callBackendAPI();
    }

    const settings = getSettingOptions();

    // clear old target variables
    if (settings.showVariable === 'category') {
        // clearTargetTmp();
        const previousEndDim = getDPVFromLatestCatDim();
        if (previousEndDim) {
            updateTargetDim(previousEndDim);
        }
    }

    if (paracordTraces) {
        const [, dim] = targetDim;
        // setTimeout(showParacords, 2000);
        showParacords(paracordTraces, settings.showVariable, settings.showOrder, settings.showOrderFrom, dim);
        $('#updateParacords').addClass('hide');
    }
};

// convert dimension name to short name with ".."
const shortDimName = (dimensionName, limitSize = 21) => {
    // total length from name
    let nameLength = 0;
    let shortName = '';
    for (const char of [...dimensionName]) {
        nameLength += new Blob([char]).size;
        if (nameLength > limitSize) {
            break;
        }
        shortName += char;
    }
    if (nameLength >= limitSize) {
        shortName += '...';
    }
    return shortName;
};

const changeObjectiveVar = (objectiveID) => {
    if (objectiveID) {
        $(`input#objectiveVar-${objectiveID}`).prop('checked', true).change();
    }
};

const changeDimColor = () => {
    const allDim = $('#paracord-plot g.y-axis');
    const lastDim = $(`#paracord-plot g.y-axis:eq(${allDim.length - 1})`);
    const tspanLabel = '.axis-title tspan.line>tspan';
    // reset all dim color
    allDim.find(tspanLabel).css('fill', CONST.LIGHT_BLUE);
    // set target dim color
    lastDim.find(tspanLabel).css('fill', CONST.YELLOW);
};

const updateTargetDim = (targetDPV) => {
    if (paracordTraces) {
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

        changeDimColor();
        if (targetDim) {
            const objectiveID = targetDim[1] || null;
            changeObjectiveVar(objectiveID);
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
    console.log(latestDim);
    return latestDim;
};

// get end dimension from drawn chart
const getTargetDimFromChart = (dimensionDOM) => {
    const isCategory = $(dimensionDOM).hasClass('dimension');
    const totalSensors = !isCategory ? $('g.y-axis').length : $('g.dimension').length;
    const endDPV = !isCategory
        ? $(`g.y-axis:eq(${totalSensors - 1})`).find('.axis-title').data('dpv')
        : getDPVFromLatestCatDim();
    if (endDPV) {
        const [procID, colID] = endDPV.split('-');
        console.log(procConfigs[procID].getColumnById(colID));
        console.log(targetDim);
    }
    // update `selectedDim` if user move target dimension
    updateTargetDim(endDPV);
    return endDPV;
};
// get current dimension from drawn chart
const getCurrentDimFromChart = (dimensionDOM) => {
    const isCategory = $(dimensionDOM).hasClass('dimension');
    const currentDPV = !isCategory ? $(dimensionDOM).find('.axis-title').data('dpv')
        : $(dimensionDOM).find('.dimlabel').data('dpv');
    if (currentDPV) {
        const [procID, colID] = currentDPV.split('-');
        console.log(procConfigs[procID].getColumnById(colID));
        console.log(targetDim);
    }
    if (currentDPV) {
        updateTargetDim(currentDPV);
    }
    return currentDPV;
};

const showParacords = (dat, showVar = 'all', showOrder = 'setting', showOrderFrom = '0.7', objective = null) => {
    $('#paracord-plot').html('');
    const objectVarID = objective || dat.COMMON.objectiveVar[0] || null;
    const plotDat = dat.array_plotdata;
    const startProcID = dat.COMMON.start_proc;
    let data = {};
    const dPVar = [];
    const dNames = [];

    // check showOrdering option
    const orderBy = showOrder === CONST.correlation ? Number(showOrderFrom) : null;

    const getTargetSensorDat = (plotData) => {
        if (objectVarID) {
            const pcpDat = graphStore.getPCPArrayPlotDataByID(Number(objectVarID));
            if (!_.isEmpty(pcpDat)) {
                targetSensorDat = pcpDat.data.array_y;
                targetSensorIndex = pcpDat.key;
                // targetSensorName = pcpDat.data.col_detail.name;
                targetDim = [pcpDat.data.col_detail.proc_id, pcpDat.data.col_detail.id];
                return targetSensorDat;
            }
        }
        if (!targetSensorDat) {
            for (let i = plotData.length - 1; i >= 0; i--) {
                const arrayYDat = plotData[i].array_y.filter(el => el);
                if (((plotData[i].col_detail.type === CONST.REAL && showVar !== 'category')
                        || (plotData[i].col_detail.type === CONST.CATEGORY && showVar === 'category'))
                    // && Number(startProcID) === plotData[i].col_detail.proc_id
                    && !isEmpty(arrayYDat)
                ) {
                    targetSensorDat = plotData[i].array_y;
                    targetSensorIndex = i;
                    // targetSensorName = plotData[i].col_detail.name;
                    targetDim = [plotData[i].col_detail.proc_id, plotData[i].col_detail.id];
                    break;
                }
            }
            if (!targetDim) {
                const endEl = plotData.length - 1;
                targetSensorDat = plotData[endEl].array_y;
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
    const genDimRangeText = (dimValues, isInt = false) => {
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

            return parseFloat(tickVal.toFixed(fractionDigit));
        });

        // check dim have na values
        let naVals = false;
        const naDumVal = minText - stepVals;
        const transDim = dimValues.map((v) => {
            if (CONST.NAV.includes(v)) {
                naVals = true;
                v = naDumVal;
            }
            return v;
        });

        let tickText = tickVals;
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
        const dimValWithoutNA = sensorType === CONST.TEXT ? dimGroup.sort() : dimGroup.sort(propDimValCompare);
        // dimValWithoutNA.reverse().push(CONST.NA);
        dimValWithoutNA.push(CONST.NA);
        return dimValWithoutNA;
    };

    // encode category to number
    const getDatWithEncode = (sensorDat) => {
        const haveNAValues = sensorDat.array_y.map(i => CONST.NAV.includes(i)).includes(true);
        // filter value without na
        const uniqueGroup = sensorDat.array_y.filter(i => !CONST.NAV.includes(i)).filter(onlyUnique);
        const uniqueGroupByCode = {};

        const sensorType = sensorDat.col_detail.type;
        let uniqueGroupSorted = sensorType === CONST.TEXT ? uniqueGroup.sort() : uniqueGroup.sort(propDimValCompare);

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
        const dimensionDat = [];
        const targetSensorData = getTargetSensorDat(plotData);
        let endDimension;
        let labelColor;
        let dimensionLabel;

        plotData.forEach((sensorDat) => {
            labelColor = Number(startProcID) === sensorDat.col_detail.proc_id ? CONST.LIGHT_BLUE : CONST.WHITE;
            dimProcName = shortDimName(sensorDat.col_detail.proc_name, limitSize = 14);
            dimSensorName = shortDimName(sensorDat.col_detail.name);

            // TODO split chart by selected option

            if ((varType !== paracordsSetting.showVariables.REAL)
                && sensorDat.col_detail.type !== CONST.REAL
            ) {
                if (varType === paracordsSetting.showVariables.CATEGORY
                    && Object.keys(sensorDat.rank_value).length > MAX_INT_LABEL_SIZE) {
                    return;
                }
                // show all or show category only
                // sensorDat.array_y = sensorDat.array_y.map(i => i || '');
                // always integer
                if (targetDim[1] === sensorDat.col_detail.id) {
                    labelColor = CONST.YELLOW;
                }
                const dms = {
                    // ticktext: tickNumbers,
                    process: sensorDat.col_detail.proc_id,
                    correlation: 0,
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
                dms.values = sensorDat.array_y;
                if (showVar === paracordsSetting.showVariables.CATEGORY) {
                    dms.label = `${dimSensorName} ${dimProcName}`;
                    dms.values = dimValWithNA(sensorDat); // use origin values for ticktext in case of category plot
                    dms.group = dms.values.filter(onlyUnique);
                    dms.categoryarray = dimWithNASorted(sensorDat);
                    // dms.ticktext = dms.categoryarray;
                } else {
                    dms.label = `<span style="color: ${labelColor};">${dimSensorName}</span><br>`;
                    dms.label += `<span style="color: ${labelColor};">${dimProcName}</span>`;
                    // dms.ticktext = sensorDat.tickText;
                    // dms.tickvals = sensorDatCoded.tickVals;
                    // dms.values = sensorDatCoded.sensorDatCoded;
                    // dms.range = [Math.min(...dms.tickvals), Math.max(...dms.tickvals)];
                }
                if (targetDim[1] !== sensorDat.col_detail.id) {
                    dimensionDat.push(dms);
                } else {
                    endDimension = dms;
                }
            } else if (varType !== paracordsSetting.showVariables.CATEGORY
                && sensorDat.col_detail.type === CONST.REAL) {
                // show real only
                const dimTextAndVals = genDimRangeText(sensorDat.array_y);
                const dimRange = findMinMax(dimTextAndVals.values);
                const corr = getPearsonCorrelation(targetSensorData, sensorDat.array_y) || 0;
                if (targetDim[1] === sensorDat.col_detail.id) {
                    labelColor = CONST.YELLOW;
                }
                dimensionLabel = `<span style="color: ${labelColor};" class="dim-sensor">${dimSensorName}</span><br>`;
                dimensionLabel += `<span style="color: ${labelColor};" class="dim-proc">${dimProcName}[${corr}]</span>`;


                if ((targetDim[1] !== sensorDat.col_detail.id)
                    && (!orderBy || (orderBy && Math.abs(corr) >= orderBy))) {
                    dimensionDat.push({
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
                    });
                } else {
                    endDimension = {
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
                }
            }
        });

        if (showOrder !== 'setting') {
            dimensionDat.sort(propComparator(showOrder));
        } else {
            dimensionDat.sort(propComparator('isReal'));
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

    const dimensions = dimensionByType(plotDat, showVar);

    // update dimension data
    dimensions.forEach((dimension) => {
        dPVar.push(dimension.dPV);
        dNames.push(dimension.dName);
    });

    if (showVar === paracordsSetting.showVariables.CATEGORY) {
        // show category variables only
        // use parcats plot
        const endDim = dimensions[dimensions.length - 1];
        data = [
            {
                type: 'parcats',
                dimensions,
                line: {
                    reversescale: true,
                    colorscale: 'Jet',
                    color: endDim && endDim.values,
                    // showscale: true,
                },
                hoveron: 'color',
                hoverinfo: 'count+probability',
                labelfont: { size: 10.5 },
                arrangement: 'freeform',
            },
        ];
    } else {
        // show all or real varaibles
        // use parcoords plot
        data = [{
            type: 'parcoords',
            line: {
                // autocolorscale: true,
                showscale: true,
                reversescale: false,
                colorscale: 'Jet',
                color: plotDat[targetSensorIndex].array_y || plotDat[plotDat.length - 1].array_y,
            },
            labelfont: { size: 10.5 },
            dimensions,
        }];
    }

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
    // console.log(dimensions);

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

        if (showVar === paracordsSetting.showVariables.CATEGORY) {
            // update dimension color for category variables
            const dimInSVG = document.getElementsByClassName('dimension');
            if (targetDim && dimensions) {
                dimensions.forEach((dim, i) => {
                    let dimColor = '';
                    const dpv = targetDim.join('-');
                    const dimDPV = dim.dPV.split('-');
                    if (dim.dPV === dpv) {
                        dimColor = CONST.YELLOW;
                    } else if (dimDPV[0] === startProcID) {
                        dimColor = CONST.LIGHT_BLUE;
                    }
                    if (dimColor) {
                        $(dimInSVG[i]).find('.dimlabel')[0].style.fill = dimColor;
                    }
                    // add custom data
                    $($(dimInSVG[i]).find('.dimlabel')[0]).attr('data-dpv', dim.dPV);
                    $($(dimInSVG[i]).find('.dimlabel')[0]).attr('data-dName', dim.dName);
                });
            }
        }
    });
    $('.axis-title, text.dimlabel').contextmenu((e) => {
        const label = $(e.currentTarget).text();
        const dimInfo = $(e.currentTarget).data('dpv');

        if (label && dimInfo) {
            // [targetSensorName] = label.split(' ');
            // targetDim = dimInfo.split('-').map(i => Number(i));
            // console.log(dimInfo);
            $('#contextMenuParallelPlot .menu-item').attr('data-target-dim', dimInfo);
        }
        selectTargetDimHandler(e);
    });
    $('.axis-title, text.dimlabel')
        .mouseover((e) => {
            const dimName = $(e.currentTarget).attr('data-dName');
            $('#dimFullName').text(dimName);
            showDimFullName(e);
        })
        .mouseout((e) => {
            $('#dimFullName').text('');
            $('#dimFullName').hide();
        });

    $('g.y-axis, g.dimension').on('mousedown', (e) => {
        getCurrentDimFromChart(e.currentTarget);
    });
    $('g.y-axis, g.dimension').on('mouseup', (e) => {
        getTargetDimFromChart(e.currentTarget);
    });
    $('html, body').animate({
        scrollTop: $('#sctr-card').offset().top,
    }, 500);

    if (showVar === paracordsSetting.showVariables.CATEGORY) {
        const msgTitle = '';
        const msgContent = $('#i18nRemoveRealInParcats').text();
        showToastrMsg(msgContent, msgTitle);
    }
    // scroll to right of chart
    setTimeout(() => {
        loadingHide();
        $('#paracord-plot').scrollLeft(1000);
    }, 1000);
};

const showCategoryVarOnly = (selection) => {
    // console.log('category only');
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
};
