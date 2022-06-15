/* eslint-disable no-restricted-syntax,prefer-arrow-callback */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(200000); // 5 minutes
const MAX_NUMBER_OF_GRAPH = 18;
const MAX_END_PROC = 18;
tabID = null;
let currentData = null;

const eles = {
    endProcSelectedItem: '#end-proc-row select',
    endProcRow: 'end-proc-row',
    condProcProcessDiv: 'CondProcProcessDiv',
    condProcPartno: 'condProcPartno',
    categoryVariableSelect: 'CategoryVariableSelect',
    condMachinePartnoDiv: 'CondMachinePartnoDiv',
    endProcProcess: 'EndProcProcess',
    endProcProcessDiv: 'EndProcProcessDiv',
    endProcVal: 'EndProcVal',
    endProcValDiv: 'EndProcValDiv',
    categoryVariableName: 'categoryVariable',
    categoryValueMulti: 'categoryValueMulti',
    sVColumns: '.SVColumns',
    sensorName: 'sensor_name',
    REAL: 'real',
    CATE: 'cate',
    SPLITTER: '|',
    contextMenu: '#contextMenuHeatmap',
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
    interval: $('#i18nInterval').text(),
    windowLength: $('#i18nWindowLength').text(),
    numRL: $('#i18nNumRL').text(),
    warningTitle: $('#i18nWarningTitle').text(),
    selectTooManyValue: $('#i18nTooManyValue').text(),

    FewDataPointInRLP: $('#i18nFewDataPointInRLP').text(),
    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    warning: $('#i18nWarning').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    limitedHeatMap: $('#i18nLimitedHeatMap').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),

    REAL: ` : ${$('#i18nReal').text()}`,
    CATE: ` : ${$('#i18nCat').text()}`,
    tooManySensors: $('#i18nTooManySensors').text(),
    canChangeScale: $('#i18nCanChangeScale').text(),
};


const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#showGraphBtn',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcReg: /cond_proc/g,
    i18nAllSelection: $('#i18nAllSelection').text(),
    i18nNoFilter: $('#i18nNoFilter').text(),
    NO_FILTER: 'NO_FILTER',
    showOutliersDivID: '#showOutlier',
    i18nShowOutliers: $('#i18nShowOutliers').text(),
    i18nHideOutliers: $('#i18nHideOutliers').text(),
    i18nMSPCorr: $('#i18nMSPCorr').text(),
    plotCardId: '#plot-cards',
    plotCard: $('#plot-cards'),
    stepHour: $('#stepHour'),
    stepMinute: $('#stepMinute'),
    mode: $('#mode'),
    categoryForm: '#traceDataForm',
    stratifiedVar: $('#categoryStratifiedVar'),
    heatmapCard: '#heatmapCard',
    heatmapScale: $('input[name=heatmapScale]'),
    resultSection: $('.result-section'),
};


const colorPalettes = [['0', '#18324c'], ['0.2', '#204465'], ['0.4', '#2d5e88'],
    ['0.6', '#3b7aae'], ['0.8', '#56b0f4'], ['1', '#6dc3fd']];

// maximum number of processes is 10.
const procColorPalettes = ['#6495ab', '#9d9a53', '#ae6e54', '#603567',
    '#00af91', '#d7cece', '#470f0f', '#0f1451',
    '#a4b790', '#000000'];

const showLimitResultToastr = () => {
    const msgTitle = i18n.warning;
    const msgContent = `<p>${i18n.limitedHeatMap.replace('BREAK_LINE', '<br>')}</p>`;
    showToastrMsg(msgContent, msgTitle);
};

const checkValidNumSelectedSensors = () => {
    const MAX_NUM = 10;
    const MIN_NUM = 1;
    const numCheckedSensors = countNumSensorSelected();
    return !(numCheckedSensors > MAX_NUM || numCheckedSensors < MIN_NUM);
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
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, true, true, true);
    endProcItem(endProcOnChange, checkAndHideStratifiedVar);


    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem(endProcOnChange, checkAndHideStratifiedVar);
        updateSelectedItems();
        checkAndHideStratifiedVar();
        addAttributeToElement();
    });

    // set default states
    setDefaultHeatmapCycle();

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // bind events for changing scales
    bindScaleEvent();

    // validation
    initValidation(formElements.formID);

    initializeDateTimeRangePicker();
});

const heatmapScale = () => {
    const set = (scale = 'common') => {
        localStorage.setItem('heatmapScale', scale);
        return scale;
    };
    const get = () => {
        const isCommonScale = localStorage.getItem('heatmapScale');
        return isCommonScale || 'auto';
    };
    const reset = () => {
        localStorage.removeItem('heatmapScale');
        return null;
    };
    return { set, get, reset };
};

const bindScaleEvent = () => {
    // bind showing context menu event
    $('body').on('contextmenu', formElements.plotCardId, (e) => {
        e.preventDefault();
        rightClickHandler(e, eles.contextMenu);
    });
    $('body')[0].addEventListener('mouseup', handleMouseUp, false);

    formElements.heatmapScale.change(() => {
        const scaleOption = formElements.heatmapScale.filter(':checked').val();
        // set scale option to draw in next time
        heatmapScale().set(scaleOption);
        drawHeatMap(currentData, scaleOption);
    });
};

const setDefaultHeatmapCycle = () => {
    // hide step minute by default
    formElements.stepMinute.css('display', 'none');
    formElements.stepHour.val(15);
    formElements.stepHour.css('display', 'block');
    formElements.stepHour.val(4);
    formElements.mode.on('change', () => {
        const currentMode = formElements.mode.val();
        if (`${currentMode}` === '1') {
            formElements.stepHour.css('display', 'none');
            formElements.stepMinute.css('display', 'block');
            formElements.stepMinute.val(15);
        } else {
            formElements.stepMinute.css('display', 'none');
            formElements.stepHour.css('display', 'block');
            formElements.stepHour.val(4);
        }
    });
};

const parseProcGUIIndex = (keyName) => {
    const matchedElements = keyName.match(/\d+$/);
    if (matchedElements) {
        return matchedElements[0];
    }
    return null;
};

const getFirstProcId = () => {
    const firstProc = getFirstProcElement();
    return firstProc.val();
};

const updateSVBox = async () => {
    const idx = 1; // only 1 stratified var

    // clear svBox
    $(`#${eles.condMachinePartnoDiv}${idx}`).empty();

    const svSelected = $(eles.sVColumns).val();
    if (!svSelected) return;
    const svSelectedEndProc = getFirstProcId();
    const svProcInfo = procConfigs[svSelectedEndProc];
    const categoryValues = [];
    const categoryNames = [];

    // get configured filter details for the selected column
    await svProcInfo.updateFilters();
    const colRelevantFilter = svProcInfo.getFilterByColumnId(svSelected);
    const currentCheckedIds = [];
    const parentID = `${eles.condMachinePartnoDiv}${idx}`;

    if (colRelevantFilter) {
        const filterDetails = colRelevantFilter.filter_details || [];
        filterDetails.forEach((filterDetail) => {
            categoryValues.push(filterDetail.id);
            categoryNames.push(filterDetail.name);
            // currentCheckedIds.push(filterDetail.id);
        });
    }

    const svOptionParentId = `${eles.condProcPartno}${idx}`;
    if (svSelected !== '') { // TODO check
        addGroupListCheckboxWithSearch(
            parentID,
            svOptionParentId,
            '',
            categoryValues, categoryNames, currentCheckedIds,
            `${eles.categoryValueMulti}${idx}`, noFilter = true,
        );
    }
};

const countNumSensorSelected = (id = eles.endProcRow) => $(`#${id}`).find('input[type="checkbox"][value!=All]:checked').length || 0;

const checkAndHideStratifiedVar = () => {
    const card = $('#end-proc-row');
    const moreThanOneProcSelected = card && card.parent().find('.card').length > 1;
    // const numCheckedSensors = countNumSensorSelected();
    if (moreThanOneProcSelected) {
        formElements.stratifiedVar.css('display', 'none');
    } else {
        formElements.stratifiedVar.css('display', 'block');

        getStratifiedVars(getFirstProcId()).then(() => {
            $(eles.sVColumns).unbind('change');
            $(eles.sVColumns).on('change', updateSVBox);
            $(eles.sVColumns).val('');
            $(eles.sVColumns).trigger('change');
        });
    }
};

const getFirstProcElement = () => $(eles.endProcSelectedItem).first();


const cardRemovalByClickHeatMap = () => {
    $('.close-icon').on('click', (e) => {
        const card = $(e.currentTarget).closest('.card');
        if (!card.parent().length) return;
        const cardId = `${card.parent().get(0).id}`;

        if (cardId.endsWith(eles.endProcRow)) {
            if (card && card.parent().find('.card').length > 1) {
                card.fadeOut();
                card.remove();
                setTimeout(() => {
                    updateSelectedItems();
                }, 100);
            }
        }
        updateSelectedItems();
        checkAndHideStratifiedVar();
    });
};


// add condition proc
const addStratifiedVarBox = (values, displayNames) => {
    let id = 1;
    let count = 0;

    const addHtmlItem = () => {
        if (count >= 2) {
            return;
        }
        const itemList = [];
        for (let i = 0; i < values.length; i++) {
            const itemVal = values[i];
            const itemName = displayNames[i];
            itemList.push(`<option value="${itemVal}">${itemName}</option>`);
        }
        const selectId = `${eles.categoryVariableSelect}${id}`;
        const proc = `<div class="col-lg-6 col-sm-12 col-12 card cond-proc table-bordered py-sm-4">
                        <div id="${eles.condProcProcessDiv}${id}" name="${eles.condProcProcessDiv}">
                            <select name="${eles.categoryVariableName}${id}"
                                class="form-control select2-selection--single SVColumns"
                                id="${selectId}" data-load-level="2">
                                ${itemList.join(' ')}
                            </select>
                        </div>
                        <div id="${eles.condMachinePartnoDiv}${id}">
                        </div>
                     </div>`;
        $('#category-cond-proc-row div').last().before(proc);

        id++;
        count++;
    };
    return {
        addHtmlItem,
    };
};

const showHeatMap = () => {
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        beforeShowCHM();

        queryDataAndShowHeatMap();
    }
};

const beforeShowCHM = () => {
    loadingShow();
    formElements.resultSection.css('display', 'none');
    formElements.plotCard.empty();
};

const afterShowCHM = (abnormal = false) => {
    formElements.resultSection.css('display', 'block');
    const heatmapCard = $(`${formElements.heatmapCard}`);
    heatmapCard.show();
    if (abnormal) {
        formElements.resultSection.css('display', 'none');
        heatmapCard.hide();
    }
    loadingHide();
};


const countNumberProc = (formData) => {
    let numProc = 0;
    for (const pair of formData.entries()) {
        const key = pair[0];
        if (key.startsWith('end_proc')) {
            numProc += 1;
        }
    }
    return numProc;
};

const collectInputAsFormData = () => {
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);

    if (countNumberProc(formData) > 1) {
        formData.set('categoryVariable1', '');
    }

    // append client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    formData.set('client_timezone', timezone);

    // choose default or recent datetime
    formData = chooseTraceTimeInterval(formData);

    syncTraceDateTime(
        parentId = 'traceDataForm',
        dtNames = {
            START_DATE: 'START_DATE',
            START_TIME: 'START_TIME',
            END_DATE: 'END_DATE',
            END_TIME: 'END_TIME',
        },
        dtValues = {
            START_DATE: formData.get('START_DATE'),
            START_TIME: formData.get('START_TIME'),
            END_DATE: formData.get('END_DATE'),
            END_TIME: formData.get('END_TIME'),
        },
    );

    // convert to UTC datetime to query
    formData = convertFormDateTimeToUTC(formData);
    return formData;
};

const queryDataAndShowHeatMap = () => {
    if (!checkValidNumSelectedSensors()) {
        afterShowCHM(true);
        showTooManySensorToastr();
        return;
    }

    let formData = collectInputAsFormData();
    formData = transformFacetParams(formData);
    formData = transformCHMParams(formData);

    $.ajax({
        url: '/histview2/api/chm/plot',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            const t0 = performance.now();
            loadingShow(true);
            afterShowCHM();

            currentData = res;

            const getHeatmapScale = heatmapScale().get();
            formElements.heatmapScale.filter(`[value=${getHeatmapScale}]`).prop('checked', true);
            drawHeatMap(res, getHeatmapScale);

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);

            checkAndShowToastr(res);

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
            afterShowCHM(true);
            errorHandling(res);
            // export mode
            handleZipExport(res);
        },
    }).then(() => {
        loadingHide();
        afterRequestAction();
    });
};


const checkAndShowToastr = (data) => {
    showToastrMsg(i18n.canChangeScale, i18nCommon.warningTitle);

    if (data.is_res_limited) {
        showLimitResultToastr();
    }

    const arrayPlotData = data.array_plotdata || {};
    for (const procId in arrayPlotData) {
        const procPlotData = arrayPlotData[procId] || [];
        if (isEmpty(procPlotData)) {
            showToastrAnomalGraph();
            afterShowCHM(true);
            return;
        }
        for (const idx in procPlotData) {
            const plotData = procPlotData[idx];
            const zMax = plotData.z_max;
            const zMin = plotData.z_min;
            if (isEmpty(zMax) && isEmpty(zMin)) {
                showToastrAnomalGraph();
                afterShowCHM(true);
                return;
            }
        }
    }

    // show limit graphs displayed message
    if (data.isGraphLimited) {
        showToastrMsg(i18nCommon.limitDisplayedGraphs.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
    }
};


const drawHeatMapFromPlotData = (canvasId, plotData) => {
    const prop = {
        canvasId,
        x: plotData.x,
        y: plotData.y,
        z: plotData.z,
        zmax: plotData.z_max,
        zmin: plotData.z_min,
        hover: plotData.hover,
        sensorName: plotData.sensorName,
        aggFunction: plotData.agg_function,
        title: plotData.title,
        cardValue: plotData.cardValue,
        yTicktext: plotData.y_ticktext,
        yTickvals: plotData.y_tickvals,
        xTicktext: plotData.x_ticktext,
        xTickvals: plotData.x_tickvals,
        colorScale: colorPalettes,
    };

    createHeatMap(prop);
};

const createRowHTML = (length) => {
    const lenClass = length <= 4 ? 'custom-height' : '';
    const graphDiv = `<div id="plot-card-row" class="row no-gutters chm-row ui-sortable ${lenClass}"></div>`;
    formElements.plotCard.append(graphDiv);

    // drag & drop for tables
    $('.ui-sortable').sortable({});
};

const createCardHTML = (graphId) => {
    $('#plot-card-row').append(`
        <div class="col-lg-4 col-md-6 col-sm-6 col-12 chm-col">
            <div id="chm_${graphId}" class="chm-plot graph-navi"></div>
        </div>
    `);
};

const getCommonScale = (data) => {
    const procPlotDatas = data.array_plotdata;
    if (isEmpty(procPlotDatas)) {
        return [null, null];
    }

    let minScale = null;
    let maxScale = null;

    for (const procId in procPlotDatas) {
        const plotDatas = procPlotDatas[procId];
        if (isEmpty(plotDatas)) continue;

        for (const plotData of plotDatas) {
            const minZ = plotData.z_min;
            const maxZ = plotData.z_max;
            if (isEmpty(minScale) || !isEmpty(minZ) && minZ < minScale) {
                minScale = minZ;
            }
            if (isEmpty(maxScale) || !isEmpty(maxZ) && maxScale < maxZ) {
                maxScale = maxZ;
            }
        }
    }

    return [minScale, maxScale];
};

const setCommonScale = (data, minZ, maxZ) => {
    // set copied data only
    const procPlotDatas = data.array_plotdata;
    if (isEmpty(procPlotDatas) || isEmpty(minZ) || isEmpty(maxZ)) {
        return;
    }

    for (const procId in procPlotDatas) {
        const plotDatas = procPlotDatas[procId];
        if (isEmpty(plotDatas)) continue;

        for (const plotData of plotDatas) {
            plotData.z_min = minZ;
            plotData.z_max = maxZ;
        }
    }
};

const drawHeatMap = (orgData, scaleOption = 'auto') => {
    const data = _.cloneDeep(orgData); // if slow, change
    if (!data) {
        return;
    }
    formElements.plotCard.empty();
    formElements.plotCard.show();

    const arrayPlotData = data.array_plotdata || {};
    const procs = Object.keys(arrayPlotData);

    const colorGraph = (plotContainerId, procId) => {
        /* Graphs of the same process have the same color. */
        const procIdx = procs.indexOf(procId);
        const color = procColorPalettes[procIdx % 9];
        $(`#${plotContainerId}`).css('border', `1px solid ${color}`);
    };

    const buildGraphTitle = (plotData, procId) => {
        const cfgProcess = procConfigs[parseInt(procId)] || procConfigs[procId];
        const sensorId = plotData.end_col;
        const column = cfgProcess.getColumnById(sensorId);
        const sensorName = column.name || sensorId;

        const cateValue = plotData.cate_value;
        let title = `${cfgProcess.name}: ${sensorName}`;
        if (!isEmpty(cateValue)) {
            const cateColId = data.COMMON.categoryVariable1 || sensorId;
            const cateColumn = cfgProcess.getColumnById(cateColId);
            const caleColName = cateColumn.name || cateColId;
            title = `${cfgProcess.name}-${sensorName}<br>${caleColName}: ${cateValue}`;
        }
        return [title, sensorName, cateValue];
    };

    const [minZ, maxZ] = getCommonScale(data);
    if (!isEmpty(minZ) && !isEmpty(maxZ) && scaleOption === 'common') {
        setCommonScale(data, minZ, maxZ);
    }

    let plotIdx = 0;
    for (const procId in arrayPlotData) {
        const procPlotData = arrayPlotData[procId] || [];

        if (plotIdx === 0) {
            createRowHTML(procPlotData.length);
        }
        for (const idx in procPlotData) {
            const plotData = procPlotData[idx];
            const [title, sensorName, cardValue] = buildGraphTitle(plotData, procId);
            plotData.sensorName = sensorName;
            plotData.title = title;
            plotData.cardValue = cardValue;

            createCardHTML(plotIdx);

            // draw heat map
            const plotContainerId = `chm_${plotIdx}`;
            drawHeatMapFromPlotData(plotContainerId, plotData, plotIdx);

            // coloring
            colorGraph(plotContainerId, procId);

            plotIdx += 1;
        }
    }

    $('html, body').animate({
        scrollTop: formElements.plotCard.offset().top,
    }, 500);
};


const selectHeatmapMenu = (scaleOption) => {
    const currentScale = formElements.heatmapScale.filter(':checked').val();
    if (scaleOption === currentScale) {
        console.log('NO UPDATE');
        return;
    }
    heatmapScale().set(scaleOption);

    formElements.heatmapScale.not(':checked').prop('checked', true);
    drawHeatMap(currentData, scaleOption);

    hideContextMenu();
};


const endProcOnChange = (async (event) => {
    const curTarget = event.target;
    const idx = parseProcGUIIndex(curTarget.id);
    const selectedEndProc = curTarget.value;

    // clear old options of proc
    const clearOldOptions = (id) => {
        // remove old sensor list on change
        $(`#${eles.endProcVal}${id}`).remove();
        $(`#${eles.endProcValDiv}${id}`).empty();
        // clear stratified options
        const stratifiedVarSelectId = `#${eles.categoryVariableSelect}${id}`;
        $(stratifiedVarSelectId)
            .empty()
            .append('<option value="">---</option>');

        $(`#${eles.condMachinePartnoDiv}${id}`).empty();
    };
    clearOldOptions(idx);

    if (!selectedEndProc) return;

    const procInfo = procConfigs[selectedEndProc];
    if (!procInfo) return;

    await procInfo.updateColumns();
    const procColumns = procInfo.getColumns();
    const parentId = `${eles.endProcValDiv}${idx}`;

    const ids = [];
    const vals = [];
    const names = [];
    const checkedIds = [];
    for (const col of procColumns) {
        ids.push(col.id);
        vals.push(col.column_name);
        names.push(col.name);
    }

    // load end proc sensors
    if (ids) {
        addGroupListCheckboxWithSearch(
            parentId,
            `${eles.endProcVal}${idx}`,
            '', ids, vals, checkedIds,
            `GET02_VALS_SELECT${idx}`,
            false,
            names,
        );
    }

    updateSelectedItems();

    getStratifiedVars(selectedEndProc).then(() => {
        $(eles.sVColumns).unbind('change');
        $(eles.sVColumns).on('change', updateSVBox);
        $(eles.sVColumns).trigger('change');
    });
});
