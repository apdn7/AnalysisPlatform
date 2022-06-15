/* eslint-disable no-restricted-syntax */
/* eslint-disable no-use-before-define */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const REQUEST_TIMEOUT = setRequestTimeOut(60000); // 1 minutes

const i18n = {
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
    error: $('#i18nError').text(),
    confirmQuestion: $('#i18nConfirmQuestion').text(),
    processName: $('#i18nProcessName').text(),
    shownName: $('#i18nShownName').text(),
    value: $('#i18nValue').text(),
    warning: $('#i18nWarning').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    warningTitle: $('#i18nWarningTitle').text(),
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),
    notEnoughSensor: $('#i18nNotEnoughSensor').text(),
    trainingData: $('#i18nTrainingData').text(),
    testingData: $('#i18nTestingData').text(),
};

const MAX_END_PROC = 60;

const MSG_MAPPING = {
    E_ALL_NA: $('#i18nE01AllNA').text(),
    E_PCA_NON_NUMERIC: $('#i18nE02NonNumeric').text(),
    E_ZERO_VARIANCE: $('#i18nE03ZeroVariance').text(),
    W_PCA_INTEGER: $('#i18nW01IntegerData').text(),
};

const CONST = {
    dateDiffTrain: 0,
    dateDiffTest: 0,
};

// formData is FormData object
const chooseTraceTimeIntervalPCA = (formData) => {
    const START_DATE = 'START_DATE';
    const START_TIME = 'START_TIME';
    const END_DATE = 'END_DATE';
    const END_TIME = 'END_TIME';
    if (!formData) return formData;

    const traceTimeOption = formData.get('traceTime');
    const recentTimeIntervals = formData.get('recentTimeInterval'); // in minute

    // unit is multiply of minute: minute=1, hour=60, day=1440, week=10080
    const timeUnit = formData.get('timeUnit');

    // get all datetime
    const startDates = [...formData.getAll(START_DATE)];
    const startTimes = [...formData.getAll(START_TIME)];
    const endDates = [...formData.getAll(END_DATE)];
    const endTimes = [...formData.getAll(END_TIME)];

    // clear all datetimes before customize
    [START_DATE, START_TIME, END_DATE, END_TIME].forEach(e => formData.delete(e));

    formData.append(START_DATE, startDates[0]);
    formData.append(START_TIME, startTimes[0]);
    formData.append(END_DATE, endDates[0]);
    formData.append(END_TIME, endTimes[0]);

    if (traceTimeOption === TRACE_TIME_CONST.RECENT) {
        const timeDiffMinute = Number(recentTimeIntervals) * Number(timeUnit);
        const newStartDate = moment().add(-timeDiffMinute, 'minute').format(DATE_FORMAT);
        const newStartTime = moment().add(-timeDiffMinute, 'minute').format(TIME_FORMAT);
        const newEndDate = moment().format(DATE_FORMAT);
        const newEndTime = moment().format(TIME_FORMAT);

        formData.append(START_DATE, newStartDate);
        formData.append(START_TIME, newStartTime);
        formData.append(END_DATE, newEndDate);
        formData.append(END_TIME, newEndTime);
    } else {
        formData.append(START_DATE, startDates[1]);
        formData.append(START_TIME, startTimes[1]);
        formData.append(END_DATE, endDates[1]);
        formData.append(END_TIME, endTimes[1]);
    }

    // delete empty conditional procs
    [...formData.keys()].forEach((key) => {
        if (key.startsWith('cond_proc') && isEmpty(formData.get(key))) {
            formData.delete(key);
        }
    });

    return formData;
};

const drawPCAPlotJSON = (res, clickOnChart) => {
    const chartConfig = {
        autosize: true,
    };

    const jsonPCABiplot = JSON.parse(res.json_pca_biplot);
    const jsonT2TimeSeries = JSON.parse(res.json_t2_time_series);
    const jsonQTimeSeries = JSON.parse(res.json_q_time_series);
    const jsonPCAScoreTrain = JSON.parse(res.json_pca_score_train);
    const jsonPCAScoreTest = JSON.parse(res.json_pca_score_test);
    const jsonQContribution = JSON.parse(res.json_q_contribution);
    const jsonT2Contribution = JSON.parse(res.json_t2_contribution);

    // draw graphs
    if (!clickOnChart) {
        if (jsonPCAScoreTrain) {
            drawXTrainScatter(jsonPCAScoreTrain, chartConfig, sizeOfData = res.dtsize_pca_score_train);
        }
        if (jsonPCAScoreTest) {
            drawXTestScatter(jsonPCAScoreTest, chartConfig, sizeOfData = res.dtsize_pca_score_test);
            if (jsonT2TimeSeries) {
                drawTimeSeriesT2Chart(jsonT2TimeSeries, jsonPCAScoreTest, chartConfig,
                    sizeOfData = res.dtsize_t2_time_series);
            }
            if (jsonQTimeSeries) {
                drawTimeSeriesQChart(jsonQTimeSeries, jsonPCAScoreTest, chartConfig,
                    sizeOfData = res.dtsize_q_time_series);
            }
        }
    }
    if (jsonQContribution) {
        drawQContributionChart(jsonQContribution, chartConfig, sizeOfData = res.dtsize_q_contribution);
    }
    if (jsonT2Contribution) {
        drawT2ContributionChart(jsonT2Contribution, chartConfig,
            sizeOfData = res.dtsize_t2_contribution);
    }
    if (jsonPCABiplot) {
        drawPCABiplotChart(jsonPCABiplot, chartConfig,
            sizeOfData = res.dtsize_pca_biplot);
    }
};

const drawPCAPlotList = (res, clickOnChart, sampleNo = null) => {
    const chartConfig = {
        autosize: true,
    };

    const jsonPCAScoreTrain = generateXTrainScatter(res.json_pca_score_train);
    if (jsonPCAScoreTrain && !clickOnChart) {
        drawXTrainScatter(jsonPCAScoreTrain, chartConfig, sizeOfData = res.dtsize_pca_score_train);
    }

    const jsonPCAScoreTest = generateXTestScatter(res.json_pca_score_test, res.json_pca_score_train);
    if (jsonPCAScoreTest && !clickOnChart) {
        drawXTestScatter(jsonPCAScoreTest, chartConfig, sizeOfData = res.dtsize_pca_score_test);
    }

    const jsonPCABiplot = generateBiplot(res.json_pca_biplot, res.json_pca_score_train, sampleNo);
    if (jsonPCABiplot) { drawPCABiplotChart(jsonPCABiplot, chartConfig, sizeOfData = res.dtsize_pca_biplot); }

    const jsonT2TimeSeries = res.json_t2_time_series;
    const jsonQTimeSeries = res.json_q_time_series;
    const jsonQContribution = res.json_q_contribution;
    const jsonT2Contribution = res.json_t2_contribution;

    if (jsonT2TimeSeries && !clickOnChart) {
        drawTimeSeriesT2ChartFromObj(jsonT2TimeSeries, jsonPCAScoreTest, chartConfig,
            sizeOfData = res.dtsize_t2_time_series);
    }
    if (jsonQTimeSeries && !clickOnChart) {
        drawTimeSeriesQChartFromObj(jsonQTimeSeries, jsonPCAScoreTest, chartConfig,
            sizeOfData = res.dtsize_q_time_series);
    }
    if (jsonQContribution) {
        drawQContributionChartFromObj(jsonQContribution, sampleNo, chartConfig,
            sizeOfData = res.dtsize_q_contribution, dpInfo = res.data_point_info,
            shortName = res.short_names);
    }
    if (jsonT2Contribution) {
        drawT2ContributionChartFromObj(jsonT2Contribution, sampleNo, chartConfig,
            sizeOfData = res.dtsize_t2_contribution, dpInfo = res.data_point_info,
            shortName = res.short_names);
    }
};


const checkValidNumSelectedSensors = (formData) => {
    const MAX_NUM = 60;
    const MIN_NUM = 1;
    const selectedSensors = [...formData.keys()].filter(e => e.match(/GET02_VALS_SELECT.+/));
    const numCheckedSensors = selectedSensors.length;
    return !(numCheckedSensors > MAX_NUM || numCheckedSensors < MIN_NUM);
};

const getPCAPlotsFromBackend = (formData, clickOnChart = false, sampleNo = null) => {
    loadingShow();

    const eleQCont = $(eles.qContributionChart);
    const eleT2Cont = $(eles.t2ContributionChart);
    const eleBiplot = $(eles.pcaBiplotChart);
    const eleRecordInfoTbl = $(eles.recordInfoTable);

    if (!checkValidNumSelectedSensors(formData)) {
        loadingHide();
        showTooManySensorToastr(60);
        return;
    }

    if (clickOnChart) {
        showLoading(eleQCont);
        showLoading(eleT2Cont);
        showLoading(eleBiplot);
        showLoading(eleRecordInfoTbl);
    } else {
        // loading.toggleClass('hide');
    }

    // Synchronize datetime of query with UI date-range
    syncTraceDateTime(
        parentId = 'testingDC',
        dtNames = {
            START_DATE: 'START_DATE',
            START_TIME: 'START_TIME',
            END_DATE: 'END_DATE',
            END_TIME: 'END_TIME',
        },
        dtValues = {
            START_DATE: formData.getAll('START_DATE')[1],
            START_TIME: formData.getAll('START_TIME')[1],
            END_DATE: formData.getAll('END_DATE')[1],
            END_TIME: formData.getAll('END_TIME')[1],
        },
    );

    // convert to UTC datetime to query
    formData = convertFormDateTimeToUTC(formData);

    $.ajax({
        url: '/histview2/api/analyze/pca',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            const t0 = performance.now();
            loadingShow(true);

            if (clickOnChart) {
                hideLoading(eleQCont);
                hideLoading(eleT2Cont);
                hideLoading(eleBiplot);
                hideLoading(eleRecordInfoTbl);
            } else {
                $('#plot-cards').show();
            }

            const json = false;
            if (json) {
                drawPCAPlotJSON(res, clickOnChart);
            } else {
                drawPCAPlotList(res, clickOnChart, sampleNo);
            }

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number_test);

            // show delete number of NAN records
            // const numSensors = countSelectedSensors(formData) || 1;
            // if (res.removed_outlier_nan_train) {
            //     showToastrDeleteNA(
            //         i18n.trainingData,
            //         numSensors * res.actual_record_number_train,
            //         res.removed_outlier_nan_train,
            //     );
            // }
            // if (res.removed_outlier_nan_test) {
            //     showToastrDeleteNA(i18n.testingData,
            //         numSensors * res.actual_record_number_test,
            //         res.removed_outlier_nan_test);
            // }
            if (!sampleNo) {
                showAllDeleteNAToastrMsgs(res, formData);
            }

            if (res.is_send_ga_off) {
                showGAToastr(true);
            }

            if (res.actual_record_number_train > SQL_LIMIT || res.actual_record_number_test > SQL_LIMIT) {
                showToastrMsg(i18n.SQLLimit, i18n.warningTitle);
            }

            // show toastr to inform result was truncated upto 5000
            if (res.is_res_limited_train || res.is_res_limited_test) {
                showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'), i18n.warningTitle);
            }

            // update record table info
            const jsonDataPointInfo = res.data_point_info;
            if (jsonDataPointInfo) {
                updateRecordInfo(dataInfos = jsonDataPointInfo, sampleNo = formData.get('sample_no'));
            }

            // move invalid filter
            setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);
            // if (checkResultExist(res)) {
            //     saveInvalidFilterCaller(true);
            // } else {
            //     saveInvalidFilterCaller();
            // }

            // hide loading inside ajax
            setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));

            $('html, body').animate({
                scrollTop: $('#plot-cards').offset().top,
            }, 1000);

            // export mode
            handleZipExport(res);
        },
        error: (res) => {
            loadingHide();

            // export mode
            handleZipExport(res);

            if (clickOnChart) {
                hideLoading(eleQCont);
                hideLoading(eleT2Cont);
                hideLoading(eleBiplot);
                hideLoading(eleRecordInfoTbl);
            } else {
                // loading.toggleClass('hide');
                loadingHide();
            }

            if (res.responseJSON) {
                const resJson = JSON.parse(res.responseJSON) || {};
                showToastr(resJson.json_errors);
                return;
            }

            errorHandling(res);
        },
    }).then(() => {
        loadingHide();
    });
};

const isIntegerDatatype = (type) => {
    const NUMERIC_TYPE = ['int', 'long'];
    if (!type) return false;
    // convert to lower case before compare
    const lowerType = type.toLowerCase();
    for (let i = 0; i < NUMERIC_TYPE.length; i++) {
        if (lowerType.includes(NUMERIC_TYPE[i])) { return true; }
    }
    return false;
};

const countSelectedSensors = (formData) => {
    let count = 0;
    for (const pair of formData.entries()) {
        const key = pair[0];
        if (key.startsWith('GET02_VALS_SELECT')) {
            count += 1;
        }
    }
    return count;
};

const createSensorRow = (sensor) => {
    let toolTip = '';
    for (const tip of sensor.tooltip) {
        if (tip.pos < 10) {
            toolTip = toolTip.concat(`${tip.pos}&nbsp;&nbsp;`);
        } else if (tip.pos < 100) {
            toolTip = toolTip.concat(`${tip.pos}&nbsp;`);
        } else {
            toolTip = toolTip.concat(`${tip.pos}`);
        }
        if (tip.pos !== 0) {
            toolTip = toolTip.concat(`&emsp;&emsp;${tip.val}`);
        }
        toolTip = toolTip.concat('<br>');
    }
    return {
        0: `<input type="hidden" name="procId" value="${sensor.proc_id}">
            <input type="hidden" name="colId" value="${sensor.col_id}">
            <input type="hidden" name="colType" value="${sensor.col_type}">
            <div class="custom-control custom-checkbox">
                <input type="checkbox" class="custom-control-input" value="${sensor.proc_id + sensor.col_id}" name="select-item" id="select-item-${sensor.proc_id + sensor.col_id}">
                <label class="custom-control-label" for="select-item-${sensor.proc_id + sensor.col_id}"></label>
            </div>`,
        1: `${sensor.proc_name}`,
        2: `${sensor.col_name}`,
        3: `${sensor.col_type}`,
        4: `${sensor.sample}<span class="tooltip-pca-text">${toolTip}</span>`,
    };
};

const collectInputAsFormData = () => {
    const traceForm = $(eles.formID);
    let formData = new FormData(traceForm[0]);
    formData = chooseTraceTimeIntervalPCA(formData);

    let isIntegerColChecked = false;
    let valCount = 0;

    for (const [key, value] of formData.entries()) {
        if (/GET02_VALS_SELECT/.test(key)) {
            valCount += 1;
            if ($(`#dataType-${value}`).val().toLowerCase() === 'int') {
                isIntegerColChecked = true;
            }
        }
    }

    formData.set('has_integer_col', isIntegerColChecked);
    formData.set('checked_val_count', valCount);

    return formData;
};

const getPCAPlots = () => {
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();

    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        const formData = collectInputAsFormData();

        // validate one sensor
        if (Number(formData.get('checked_val_count')) < 2) {
            showToastrMsg(i18n.notEnoughSensor, i18n.error, MESSAGE_LEVEL.ERROR);
            return;
        }

        // warning about integer column has_integer_col
        if (formData.get('has_integer_col') === 'true') {
            $(eles.msgContent).text(`${MSG_MAPPING.W_PCA_INTEGER}\n${i18n.confirmQuestion}`);
            $(eles.msgModal).modal('show');
        } else {
            getPCAPlotsFromBackend(formData);
        }
    }
};

const confirmWarningAndGetPCA = () => {
    $(eles.msgModal).modal('hide');

    const formData = collectInputAsFormData();
    getPCAPlotsFromBackend(formData);
};


const bindCheckEvents = () => {
    // check all event
    $(eles.selectAll).change(() => {
        const checkAllValue = $(eles.selectAll).is(':checked');
        $('#pcaConditionTbl tbody tr input').each(function f() {
            $(this).prop('checked', checkAllValue);
        });
    });

    // uncheck all if one item is unchecked
    $('#pcaConditionTbl tbody tr input').click(function f() {
        if (!$(this).is(':checked')) {
            $(eles.selectAll).prop('checked', false);
        }
    });
};

const setupDateTime = () => {
    const startDateElements = $('input[name="START_DATE"]');
    const endDateElements = $('input[name="END_DATE"]');
    const startTimeElements = $('input[name="START_TIME"]');
    const endTimeElements = $('input[name="END_TIME"]');

    initializeDateTime({
        START_DATE: $(startDateElements[0]),
        END_DATE: $(endDateElements[0]),
        START_TIME: $(startTimeElements[0]),
        END_TIME: $(endTimeElements[0]),
    });
    initializeDateTime({
        START_DATE: $(startDateElements[1]),
        END_DATE: $(endDateElements[1]),
        START_TIME: $(startTimeElements[1]),
        END_TIME: $(endTimeElements[1]),
    });
};

const addToolTip = () => {
    $('#pcaConditionTbl td:nth-child(5)').addClass('tooltip-pca');
};

const loadUserInputAgain = (parent) => {
    const inputForms = $('form');
    // load user input on page load
    setTimeout(() => {
        inputForms.each((i, form) => {
            try {
                const userInput = saveLoadUserInput(`#${form.id}`, window.location.pathname, parent);
                userInput();
            } catch (e) {
                console.log(e);
            }
        });
    }, 500);
};

const addClickEventAllRows = () => {
    // add click event of whole row for pcaConditionTbl
    $(eles.pcaConditionTblAllRows).each((i, element) => {
        const that = $(element);
        that.click((e) => {
            const currentRow = $(e.currentTarget);
            const currentCheckbox = $(currentRow.find('input[type="checkbox"]'));
            currentCheckbox.prop('checked', !currentCheckbox.is(':checked'));
        });
    });
};

const appendSensors = (sensors = []) => {
    if (!table) return;

    const rows = [];
    for (const sensor of sensors) {
        const row = createSensorRow(sensor);
        rows.push(row);
    }
    table.rows.add(rows).draw();

    addToolTip();
    loadUserInputAgain('pcaConditionTbl');

    if (sensors.length < 60) {
        $(eles.spinner).removeClass('spinner-grow');
    }

    addClickEventAllRows();
};

const loadSensors = () => {
    $(eles.spinner).addClass('spinner-grow');

    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
    };
    fetch('/histview2/api/analyze/sensor', requestOptions)
        .then(response => response.text())
        .catch(error => console.log('error', error));
    setTimeout(() => {
        $(eles.spinner).removeClass('spinner-grow');
    }, 20000);
};

let table = null;

$(() => {
    // generate process dropdown data
    const endProcs = genProcessDropdownData(procConfigs);
    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, false, false, true);
    endProcItem();
    updateSelectedItems();
    addAttributeToElement();

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        updateSelectedItems();
        addAttributeToElement();
    });

    // add first condition process
    const condProcs = genProcessDropdownData(procConfigs);
    const condProcItem = addCondProc(condProcs.ids, condProcs.names, '', eles.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(eles.btnAddCondProc).click(() => {
        condProcItem();
    });

    $(eles.msgConfirmBtn).click(() => {
        confirmWarningAndGetPCA();
    });

    // allow number > 0 only for latest time interval
    validateRecentTimeInterval($(eles.recentTimeIntervalInput));

    // bind choose sensors events
    bindCheckEvents();

    setupDateTime();

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    initializeDateTimeRangePicker();

    initValidation(eles.formID);
});
