const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 18;
const MAX_NUMBER_OF_SENSOR = 18;
const MIN_NUMBER_OF_SENSOR = 0;
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
    // color scale option in CHM
    colorReal: $('select[name=color_real]'),
    colorCat: $('select[name=color_cat]'),
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
    condProcSelectedItem: '#cond-proc-row select',
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

// maximum number of processes is 10.
const procColorPalettes = [
    '#6495ab',
    '#9d9a53',
    '#ae6e54',
    '#603567',
    '#00af91',
    '#d7cece',
    '#470f0f',
    '#0f1451',
    '#a4b790',
    '#000000',
];

const showLimitResultToastr = () => {
    const msgContent = `<p>${i18n.limitedHeatMap.replace('BREAK_LINE', '<br>')}</p>`;
    showToastrMsg(msgContent);
};

const CHM_EXPORT_URL = {
    CSV: {
        ext_name: 'csv',
        url: '/ap/api/chm/data_export/csv',
    },
    TSV: {
        ext_name: 'tsv',
        url: '/ap/api/chm/data_export/tsv',
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

    // remove week btn data finder
    $('#dataFinderWeekBtn').remove();

    initializeDateTime();

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp: true,
        isRequired: true,
        showFilter: true,
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
        drawHeatMap(currentData, scaleOption);
    });
};

const setDefaultHeatmapCycle = () => {
    // hide step minute by default
    formElements.stepMinute.css('display', 'none');
    formElements.stepHour.val(15);
    formElements.stepHour.css('display', 'block');
    formElements.stepHour.val(1);
    formElements.mode.on('change', () => {
        const currentMode = formElements.mode.val();
        if (`${currentMode}` === '1') {
            formElements.stepHour.css('display', 'none');
            formElements.stepMinute.css('display', 'block');
            formElements.stepMinute.val(15);
        } else {
            formElements.stepMinute.css('display', 'none');
            formElements.stepHour.css('display', 'block');
            formElements.stepHour.val(1);
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
    if (svSelected !== '') {
        // TODO check
        addGroupListCheckboxWithSearch(
            parentID,
            svOptionParentId,
            '',
            categoryValues,
            categoryNames,
            currentCheckedIds,
            `${eles.categoryValueMulti}${idx}`,
            (noFilter = true),
        );
    }
};

const countNumSensorSelected = (id = eles.endProcRow) =>
    $(`#${id}`).find('input[type="checkbox"][value!=All]:checked').length || 0;

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

const showHeatMap = (clearOnFlyFilter = true) => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
    updateStyleOfInvalidElements();
    if (clearOnFlyFilter) {
        formElements.heatmapScale.val('auto');
    }
    if (isValid) {
        // close sidebar
        beforeShowGraphCommon(clearOnFlyFilter);

        beforeShowCHM(clearOnFlyFilter);

        queryDataAndShowHeatMap(clearOnFlyFilter);
    }
};

const handleShowHeatmapWithOrder = () => {
    showHeatMap(false);
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

const collectInputAsFormData = (clearOnFlyFilter, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
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

const queryDataAndShowHeatMap = (clearOnFlyFilter = true, autoUpdate = false) => {
    let formData = collectInputAsFormData(clearOnFlyFilter, autoUpdate);

    showGraphCallApi('/ap/api/chm/plot', formData, REQUEST_TIMEOUT, async (res) => {
        afterShowCHM();

        res = sortArrayFormVal(res);
        currentData = res;
        graphStore.setTraceData(_.cloneDeep(res));

        const scale = formElements.heatmapScale.val();

        drawHeatMap(res, scale, autoUpdate);

        // show info table
        showInfoTable(res);

        checkAndShowToastr(res, clearOnFlyFilter);

        setPollingData(formData, queryDataAndShowHeatMap, [false, true]);
    });
};

const sortArrayFormVal = (res) => {
    const arrayPlotData = res.array_plotdata;
    if (!arrayPlotData) return;

    // flat array_plotdata
    res.array_plotdata = [];
    res.procs = Object.keys(arrayPlotData);
    for (const procId of Object.keys(arrayPlotData)) {
        const plotList = arrayPlotData[procId].map((plot) => {
            plot.proc_id = procId;
            return plot;
        });
        res.array_plotdata.push(...plotList);
    }
    // sort graphs
    if (latestSortColIds && latestSortColIds.length) {
        res.ARRAY_FORMVAL = sortGraphs(res.ARRAY_FORMVAL, 'GET02_VALS_SELECT', latestSortColIds);
        res.array_plotdata = sortGraphs(res.array_plotdata, 'end_col', latestSortColIds);
    }

    // if has facet and facet > 1 and sensor > 1 break row
    const sensors = [];
    let unitFacet = [];
    for (const plotdata of res.array_plotdata) {
        if (!sensors.includes(plotdata.end_col)) {
            sensors.push(plotdata.end_col);
        }
        if (plotdata.cate_value && !unitFacet.includes(plotdata.cate_value)) {
            unitFacet.push(plotdata.cate_value);
        }
    }
    res.row = 1; // default 1 row
    res.sensors = sensors;
    if (unitFacet.length > 1 && sensors.length > 1) {
        res.row = sensors.length;
    }

    return res;
};

const checkAndShowToastr = (data, clearOnFlyFilter) => {
    if (clearOnFlyFilter) {
        showToastrMsg(i18n.canChangeScale, MESSAGE_LEVEL.INFO);
    }

    if (data.is_res_limited) {
        showLimitResultToastr();
    }

    const arrayPlotData = data.array_plotdata || [];
    if (isEmpty(arrayPlotData)) {
        showToastrAnomalGraph();
        afterShowCHM();
        return;
    }

    for (const idx in arrayPlotData) {
        const plotData = arrayPlotData[idx];
        const zMax = plotData.z_max;
        const zMin = plotData.z_min;
        if (isEmpty(zMax) && isEmpty(zMin)) {
            showToastrAnomalGraph();
            afterShowCHM(true);
            return;
        }
    }

    // show limit graphs displayed message
    if (data.isGraphLimited) {
        showToastrMsg(i18nCommon.limitDisplayedGraphs.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
    }
};

const drawHeatMapFromPlotData = (canvasId, plotData) => {
    const numericDataTypes = [DataTypes.REAL.name, DataTypes.INTEGER.name, DataTypes.DATETIME.name];
    const colorSelectDOM =
        !plotData.is_serial_no && numericDataTypes.includes(plotData.data_type) ? eles.colorReal : eles.colorCat;
    const colorOption = colorSelectDOM.val();
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
        colorOption,
        dataType: plotData.data_type,
        zFmt: plotData.z_fmt || '',
        colorScaleCommon: plotData.color_scale_common || false,
    };

    createHeatMap(prop);
};

const createRowHTML = (rowIdx, length) => {
    const lenClass = length <= 4 ? 'custom-height' : '';
    const rowCardId = `plot-card-row-${rowIdx}`;
    const graphDiv = `<div id="${rowCardId}" class="row no-gutters chm-row ui-sortable ${lenClass}"></div>`;
    formElements.plotCard.append(graphDiv);

    // drag & drop for tables
    $('.ui-sortable').sortable({});

    return rowCardId;
};

const createCardHTML = (rowCardId, graphId, title, facet, isCTCol) => {
    const CTLabel = isCTCol ? ` (${DataTypes.DATETIME.short}) [sec]` : '';
    $(`#${rowCardId}`).append(`
        <div class="col-xl-4 col-lg-6 col-sm-6 col-12" style="padding: 4px">
            <div class="chm-col d-flex dark-bg">
                <div class="chm-card-title-parent">
                    <div class="chm-card-title">
                        <span title="${title}">${title}${CTLabel}</span>
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

    for (const plotData of procPlotDatas) {
        const minZ = plotData.z_min;
        const maxZ = plotData.z_max;
        if (isEmpty(minScale) || (!isEmpty(minZ) && minZ < minScale)) {
            minScale = minZ;
        }
        if (isEmpty(maxScale) || (!isEmpty(maxZ) && maxScale < maxZ)) {
            maxScale = maxZ;
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
    for (const plotData of procPlotDatas) {
        plotData.z_min = minZ;
        plotData.z_max = maxZ;
        plotData.color_scale_common = true;
    }
};

const drawHeatMap = (orgData, scaleOption = 'auto', autoUpdate = false) => {
    const data = _.cloneDeep(orgData); // if slow, change
    if (!data) {
        return;
    }
    formElements.plotCard.empty();
    formElements.plotCard.show();

    const arrayPlotData = data.array_plotdata || [];
    const procs = data.procs;

    const colorGraph = (plotContainerId, procId) => {
        /* Graphs of the same process have the same color. */
        const procIdx = procs.indexOf(procId);
        const color = procColorPalettes[procIdx % 9];
        $(`#${plotContainerId}`).parent().css('border', `1px solid ${color}`);
    };

    const buildGraphTitle = (plotData, procId) => {
        const { end_proc_name } = plotData;
        const sensorName = plotData.end_col_show_name;
        const isCTCol = plotData.data_type === DataTypes.DATETIME.name;

        const cateValue = plotData.cate_value;
        let facetTitle = '';
        let title = `${end_proc_name}: ${sensorName}`;
        if (!isEmpty(cateValue)) {
            facetTitle = cateValue;
            if (Array.isArray(cateValue)) {
                facetTitle = cateValue.length > 1 ? `${cateValue[0]} | ${cateValue[1]}` : cateValue[0];
            }
            title = `${end_proc_name}-${sensorName}`;
        }
        return [title, sensorName, cateValue, facetTitle, isCTCol];
    };

    const [minZ, maxZ] = getCommonScale(data);
    if (!isEmpty(minZ) && !isEmpty(maxZ) && scaleOption === 'common') {
        setCommonScale(data, minZ, maxZ);
    }

    for (let rowIdx = 0; rowIdx < orgData.row; rowIdx++) {
        const rowCardId = createRowHTML(rowIdx, arrayPlotData.length);
        for (const plotIdx in arrayPlotData) {
            const plotData = arrayPlotData[plotIdx];
            if (orgData.row > 1 && orgData.sensors[rowIdx] !== plotData.end_col) {
                continue;
            }
            const procId = plotData.proc_id;
            const [title, sensorName, cardValue, facet, isCTCol] = buildGraphTitle(plotData, procId);
            plotData.sensorName = sensorName;
            plotData.title = title;
            plotData.cardValue = cardValue;

            createCardHTML(rowCardId, `${rowIdx}_${plotIdx}`, title, facet, isCTCol);

            // draw heat map
            const plotContainerId = `chm_${rowIdx}_${plotIdx}`;
            drawHeatMapFromPlotData(plotContainerId, plotData);

            // coloring
            colorGraph(plotContainerId, procId);
        }
    }

    if (!autoUpdate) {
        $('html, body').animate(
            {
                scrollTop: getOffsetTopDisplayGraph('#scaleOption'),
            },
            500,
        );
    }

    // init filter modal

    fillDataToFilterModal(orgData.filter_on_demand, () => {
        showHeatMap(false);
    });
};

const selectHeatmapMenu = (scaleOption) => {
    drawHeatMap(currentData, scaleOption);

    formElements.heatmapScale.val(scaleOption);
    hideContextMenu();
};

const endProcOnChange = async (event) => {
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
        $(stratifiedVarSelectId).empty().append('<option value="">---</option>');

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
        vals.push(col.name_en);
        names.push(col.shown_name);
    }

    // load end proc sensors
    if (ids) {
        addGroupListCheckboxWithSearch(
            parentId,
            `${eles.endProcVal}${idx}`,
            '',
            ids,
            vals,
            checkedIds,
            `GET02_VALS_SELECT${idx}`,
            false,
            names,
        );
    }

    updateSelectedItems(false, $(formElements.endProcSelectedItem));

    getStratifiedVars(selectedEndProc).then(() => {
        $(eles.sVColumns).unbind('change');
        $(eles.sVColumns).on('change', updateSVBox);
        $(eles.sVColumns).trigger('change');
    });
};

const dumpData = (exportType, dataSrc) => {
    const formData = lastUsedFormData || collectInputAsFormData(true);
    formData.set('export_from', dataSrc);
    if (exportType === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard(CHM_EXPORT_URL.TSV.url, formData);
    } else {
        exportData(CHM_EXPORT_URL[exportType].url, CHM_EXPORT_URL[exportType].ext_name, formData);
    }
};

const handleExportData = (exportType) => {
    // hide export menu
    $(EXPORT_DOM.DROPDOWN_ID).removeClass('show');
    showGraphAndDumpData(exportType, dumpData);
};
