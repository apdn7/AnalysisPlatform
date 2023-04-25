/* eslint-disable no-restricted-syntax,prefer-arrow-callback */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 18;
const MAX_END_PROC = 18;
tabID = null;
let currentData = null;
const graphStore = new GraphStore();

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

    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    limitedHeatMap: $('#i18nLimitedHeatMap').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),

    REAL: ` : ${$('#i18nFloat').text()}`,
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
    heatmapScale: $('select[name=heatmapScale]'),
    resultSection: $('.result-section'),
};


const colorPalettes = [['0', '#18324c'], ['0.2', '#204465'], ['0.4', '#2d5e88'],
    ['0.6', '#3b7aae'], ['0.8', '#56b0f4'], ['1', '#6dc3fd']];

// maximum number of processes is 10.
const procColorPalettes = ['#6495ab', '#9d9a53', '#ae6e54', '#603567',
    '#00af91', '#d7cece', '#470f0f', '#0f1451',
    '#a4b790', '#000000'];

const showLimitResultToastr = () => {
    const msgContent = `<p>${i18n.limitedHeatMap.replace('BREAK_LINE', '<br>')}</p>`;
    showToastrMsg(msgContent);
};

const CHM_EXPORT_URL = {
    CSV: {
        ext_name: 'csv',
        url: '/ap/api/chm/csv_export',
    },
    TSV: {
        ext_name: 'tsv',
        url: '/ap/api/chm/tsv_export',
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
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp: true,
        isRequired: true,
    });
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

    formElements.heatmapScale.change((e) => {
        const scaleOption = e.currentTarget.value;
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

const showHeatMap = (clearOnFlyFilter = true) => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (isValid) {
        // close sidebar
        beforeShowGraphCommon(clearOnFlyFilter);

        beforeShowCHM(clearOnFlyFilter);

        queryDataAndShowHeatMap(clearOnFlyFilter);
    }
};

const beforeShowCHM = (clearOnFlyFilter) => {
    if (clearOnFlyFilter) {
        formElements.resultSection.css('display', 'none');
        formElements.plotCard.empty();
    }
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

const collectInputAsFormData = (clearOnFlyFilter) => {
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);
    if (clearOnFlyFilter) {
        const isLinkData = formData.get('start_proc') !== '0';
        if (countNumberProc(formData) > 1 && isLinkData) {
            formData.set('categoryVariable1', '');
        }

        // append client timezone
        formData.set('client_timezone', detectLocalTimezone());

        // choose default or recent datetime
        formData = genDatetimeRange(formData);
        resetCheckedCats();
        formData = transformFacetParams(formData);
        formData = transformCHMParams(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }

    return formData;
};

const queryDataAndShowHeatMap = (clearOnFlyFilter = true) => {

    let formData = collectInputAsFormData(clearOnFlyFilter);

    showGraphCallApi('/ap/api/chm/plot', formData, REQUEST_TIMEOUT, async (res) => {
        afterShowCHM();

        currentData = res;
        graphStore.setTraceData(_.cloneDeep(res));

        const getHeatmapScale = heatmapScale().get();
        formElements.heatmapScale.val(getHeatmapScale);
        drawHeatMap(res, getHeatmapScale);

        // show info table
        showInfoTable(res);

        loadGraphSetings(clearOnFlyFilter);

        const {catExpBox, cat_on_demand} = res;
        if (clearOnFlyFilter) {
            clearGlobalDict();
            initGlobalDict(catExpBox);
            initGlobalDict(cat_on_demand);
            initDicChecked(getDicChecked());
            initUniquePairList(res.dic_filter);
        }

        checkAndShowToastr(res, clearOnFlyFilter);

        longPolling(formData, () => {
            queryDataAndShowHeatMap(true);
        });
    });
};


const checkAndShowToastr = (data, clearOnFlyFilter) => {
    if (clearOnFlyFilter) {
        showToastrMsg(i18n.canChangeScale, MESSAGE_LEVEL.INFO);
    }

    if (data.is_res_limited) {
        showLimitResultToastr();
    }

    const arrayPlotData = data.array_plotdata || {};
    for (const procId in arrayPlotData) {
        const procPlotData = arrayPlotData[procId] || [];
        if (isEmpty(procPlotData)) {
            showToastrAnomalGraph();
            afterShowCHM();
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
        zFmt: plotData.z_fmt || '',
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

const createCardHTML = (graphId, title, facet) => {
    $('#plot-card-row').append(`
        <div class="col-xl-4 col-lg-6 col-sm-6 col-12" style="padding: 4px">
            <div class="chm-col d-flex dark-bg">
                <div class="chm-card-title-parent">
                    <div class="chm-card-title">
                        <span title="${title}">${title}</span>
                        ${facet ? `<span class="show-detail cat-exp-box" title="${facet}">${facet}</span>` : ''}
                    </div>
                </div>
                <div id="chm_${graphId}" class="chm-plot graph-navi" style="width: 100%"></div>
            </div>
        </div>
    `);

    if (facet) {
        $(`#chm_cate_${graphId}`).text(facet);
    }
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
        $(`#${plotContainerId}`).parent().css('border', `1px solid ${color}`);
    };

    const buildGraphTitle = (plotData, procId) => {
        const cfgProcess = procConfigs[parseInt(procId)] || procConfigs[procId];
        const sensorId = plotData.end_col;
        const column = cfgProcess.getColumnById(sensorId);
        const sensorName = column.name || sensorId;

        const cateValue = plotData.cate_value;
        let facetTitle = '';
        let title = `${cfgProcess.name}: ${sensorName}`;
        if (!isEmpty(cateValue)) {
            facetTitle = cateValue;
            if (Array.isArray(cateValue)) {
                facetTitle = cateValue.length > 1 ? `${cateValue[0]} | ${cateValue[1]}` : cateValue[0];
            }
            title = `${cfgProcess.name}-${sensorName}`;
        }
        return [title, sensorName, cateValue, facetTitle];
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
            const [title, sensorName, cardValue, facet] = buildGraphTitle(plotData, procId);
            plotData.sensorName = sensorName;
            plotData.title = title;
            plotData.cardValue = cardValue;

            createCardHTML(plotIdx, title, facet);

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

    // init filter modal
    fillDataToFilterModal(orgData.catExpBox, [], orgData.cat_on_demand, [], [], () => {
        showHeatMap(false);
    });
};


const selectHeatmapMenu = (scaleOption) => {
    const currentScale = formElements.heatmapScale.val();
    if (scaleOption === currentScale) {
        console.log('NO UPDATE');
        return;
    }
    heatmapScale().set(scaleOption);

    formElements.heatmapScale.val(scaleOption);
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

const dumpData = (exportType, dataSrc) => {
    const formData = lastUsedFormData || collectInputAsFormData(true);
    formData.set('export_from', dataSrc);
    if (exportType === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard(CHM_EXPORT_URL.TSV.url, formData);
    } else {
        exportData(
            CHM_EXPORT_URL[exportType].url,
            CHM_EXPORT_URL[exportType].ext_name,
            formData,
        );
    }
};

const handleExportData = (exportType) => {
    // hide export menu
    $(EXPORT_DOM.DROPDOWN_ID).removeClass('show');
    showGraphAndDumpData(exportType, dumpData);
};
