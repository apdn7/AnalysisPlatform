const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_SENSOR = 2;
const MIN_NUMBER_OF_SENSOR = 1;
let tabID = null;
const graphStore = new GraphStore();
let currentXY = [];

const chartScales = {
    1: 'scale_setting',
    2: 'scale_common',
    3: 'scale_threshold',
    4: 'scale_auto',
    5: 'scale_full',
};

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
    timeVisSettingGrp: '#timeVisSettingGrp',
    yScaleOption: 'select[name=yScaleOption]',
};

const showTVChart = (res, setting = undefined, clearOnFlyFilter = false) => {
    $(formElements.timeVisSettingGrp).css('display', 'block');
    const chartParentEleID = 'card-parent';

    $(`#${chartParentEleID}`).empty();

    // show parent card
    $(`#${chartParentEleID}`).show();

    const { chartScale } = setting;
    graphStore.setTraceData(_.cloneDeep(res));
    const chartContainer = document.getElementById(chartParentEleID);
    // chart init
    if (res.array_plotdata && res.array_plotdata.length) {
        res.array_plotdata.forEach((plotData, index) => {
            const chartId = `tv-card-${index}`;
            const cardHtml = `
                <div class="card-border chart-wrapper time-vis-card" style="width: 100%; height: calc(30vw - 1rem);">
                    <div id="${chartId}" class="position-relative w-100 h-100"></div>
                </div>
            `;
            chartContainer.insertAdjacentHTML('beforeend', cardHtml);
            const timeVis = new TimeVis(chartId, {
                trace_groups: plotData,
                x_title: res.x_name,
                y_title: res.y_name,
                color_name: res.color_name,
                div_name: res.div_name,
                yMin: plotData[chartScale ?? chartScales[1]]['y-min'],
                yMax: plotData[chartScale ?? chartScales[1]]['y-max'],
            });
            // time_vis draw chart
            timeVis.draw();
        });
    }
    // scroll to chart
    scrollToEle(chartParentEleID);
};

const checkValidSelectedVariables = () => {
    const selectedVariables = [...$('input[name^=GET02_VALS_SELECT]:checked')];
    const targetVariableShownType = selectedVariables.map((el) => $(el).attr('data-type-shown-name'));
    let isValid =
        targetVariableShownType.includes(DataTypes.REAL.short) ||
        targetVariableShownType.includes(DataTypes.DATETIME.short) ||
        targetVariableShownType.includes(DataTypes.INTEGER.short);
    // div is required
    const hasDivValue = $('select[name=catExpBox] option:selected').text().includes('Div');
    if (!hasDivValue) {
        isValid = false;
        // updateStyleButtonByCheckingValid(true);
        // disable Show graph button
    }
    // Default div là main serial. Nếu không có main serial chọn serial đầu tiên.

    return isValid;
};

const transformFormdata = (clearOnFlyFilter = null, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }

    return getTimeVisFormData(formElements.formID, clearOnFlyFilter);
};

const timeVisTraceData = (clearOnFlyFilter, setting = {}) => {
    const formData = transformFormdata(clearOnFlyFilter);

    showGraphCallApi(
        '/ap/api/tv/plot',
        formData,
        REQUEST_TIMEOUT,
        async (res) => {
            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            // check result and show toastr msg
            if (isEmpty(res.array_plotdata)) {
                showToastrAnomalGraph();
            }

            showTVChart(res, setting, clearOnFlyFilter);

            // show toastr to inform result was truncated upto 5000
            if (res.is_res_limited) {
                showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'));
            }

            // show info table
            showInfoTable(res);

            setPollingData(formData, handleSetPollingData, []);
            fillDataToFilterModal(res.filter_on_demand, () => {
                timeVisTraceData(false);
            });
        },
        {
            'Accept-Encoding': 'gzip',
        },
    );
};

const handleSetPollingData = () => {
    const settings = getCurrentSettings();
    timeVisTraceData(false, settings);
};

const tvTracing = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({
        min: MIN_NUMBER_OF_SENSOR,
        max: MAX_NUMBER_OF_SENSOR,
    });
    updateStyleOfInvalidElements();

    if (!isValid) return;

    //check validate selected variables
    const isValidCheckVariables = checkValidSelectedVariables();
    if (!isValidCheckVariables) return;

    // close sidebar
    beforeShowGraphCommon();

    removeHoverInfo();

    // Reset Graph setting
    // resetGraphSetting();

    // save select xy to currentXY
    currentXY = latestSortColIds.slice(-2);
    timeVisTraceData(true);
};

const setGraphSetting = (e) => {
    const chartScale = chartScales[Number($(e).val())];
    const res = graphStore.getTraceData();
    const setting = {
        chartScale,
    };

    showTVChart(res, setting);
};

const handleSubmit = (clearOnFlyFilter = false, setting = {}) => {
    loadingShow();

    timeVisTraceData(clearOnFlyFilter, setting);
};

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
    formData.append(CONST.SCP_HMP_X_AXIS, XYData[0] || '');
    formData.append(CONST.SCP_HMP_Y_AXIS, XYData[1] || '');

    return formData;
};

const getTimeVisFormData = (formEleID, clearOnFlyFilter = null) => {
    let formData;
    if (clearOnFlyFilter) {
        const traceForm = $(formEleID);
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
        showFilter: true,
        hideStrVariable: true,
        colorTypes: CfgProcess_CONST.CATEGORY_TYPES,
        isDivRequired: true,
    });

    endProcItem();

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // check number of sensors in [2,4]
    // setTimeout(addCheckNumberOfSensor, 3000);

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem(() => {});
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // checkDisableScatterBtn();

    initializeDateTimeRangePicker();
    initializeDateTimePicker();

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
        keepValueEachDivision();
    }, 2000);

    // validate required init
    initValidation(formElements.formID);
});
