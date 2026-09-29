let currentProcItem;
const currentProcData = {};
const IS_CONFIG_PAGE = true;
let dicOriginDataType = {};
let dicProcessCols = {};
let isInitialize = false;

const DB_CONFIG_CSV_TYPES = [DB.DB_CONFIGS.CSV.type, DB.DB_CONFIGS.V2.type];

// TODO: add other db types. This is currently not needed because databases are in else clause
const DB_CONFIG_DB_TYPES = [
    DB.DB_CONFIGS.POSTGRESQL.type,
    DB.DB_CONFIGS.SQLITE.type,
    DB.DB_CONFIGS.MYSQL.type,
    DB.DB_CONFIGS.MSSQL.type,
    DB.DB_CONFIGS.ORACLE.type,
];

const procElements = {
    tblProcConfig: 'tblProcConfig',
    tblProcConfigID: '#tblProcConfig',
    tableProcList: '#tblProcConfig tbody',
    procListChild: '#tblProcConfig tbody tr',
    divProcConfig: '#accordionPC',
    fileName: 'input[name=fileName]',
    fileNameInput: '#fileNameInput',
    fileNameBtn: '#fileNameBtn',
    dbTableList: '#dbTableList',
    fileInputPreview: '#fileInputPreview',
};

const i18n = {
    statusDone: $('#i18nStatusDone').text(),
    statusImporting: $('#i18nStatusImporting').text(),
    statusFailed: $('#i18nStatusFailed').text(),
    statusPending: $('#i18nStatusPending').text(),
    validLike: $('#i18nValidLike').text(),
    reachFailLimit: $('#i18nReachFailLimit').text(),
    noCTCol: $('#i18nNoCTCol').text(),
    noCTColProc: $('#i18nNoCTColPrc').text(),
    confirmDeleteProc: $('#i18nConfirmDeleteThisRecord').text(),
    warnDeleteMergedProc: $('#i18nWarDeleteMergedProc').text(),
    warnDeleteMergedParentProc: $('#i18nWarDeleteMergedParentProc').text(),
    warnDeleteMergedChildProc: $('#i18nWarDeleteMergedChildProc').text(),
    confirmContinue: $('#i18nConfirmContinue').text(),
    confirmIncreaseLimitImport: $('#i18nConfirmIncreaseLimitImport').text(),
    confirmDecreaseLimitImport: $('#i18nConfirmDecreaseLimitImport').text(),
    thisRecord: $('#i18nThisRecord').text(),
};

const JOB_STATUS = {
    DONE: {
        title: i18n.statusDone,
        class: 'check green',
    },
    FAILED: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
    },
    KILLED: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
    },
    PROCESSING: {
        title: i18n.statusImporting,
        class: 'spinner fa-spin',
    },
    PENDING: {
        title: i18n.statusPending,
        class: 'spinner fa-spin',
    },
};

const updateBackgroundJobs = (json) => {
    if (_.isEmpty(json)) {
        return;
    }

    Object.values(json).forEach((row) => {
        const statusClass = JOB_STATUS[row.status].class || JOB_STATUS.FAILED.class;
        let statusTooltip = JOB_STATUS[row.status].title || JOB_STATUS.FAILED.title;
        if (row.data_type_error) {
            statusTooltip = $(baseEles.i18nJobStatusMsg).text();
            statusTooltip = statusTooltip.replace('__param__', row.db_master_name);
        }
        const updatedStatus = `<div class="align-middle text-center" data-st="${statusClass}">
            <div class="" data-toggle="tooltip" data-placement="top" title="${statusTooltip}">
                <i class="fas fa-${statusClass} status-i"></i>
            </div>
        </div>`;

        const jobStatusEle = $(`#proc_${row.proc_id} .process-status`).first();
        if (jobStatusEle && jobStatusEle.html() && jobStatusEle.html().trim() !== '') {
            if (jobStatusEle.attr('data-status') !== row.status) {
                jobStatusEle.html(updatedStatus);
            }
        } else {
            jobStatusEle.html(updatedStatus);
        }
        jobStatusEle.attr('data-status', row.status);
    });
};

// to be refactored: this api is called in multiple files
const checkIfProcessIsMerged = async (procId) => {
    let data = null;
    await $.ajax({
        url: `api/setting/proc_config/${procId}`,
        type: 'GET',
        cache: false,
        success: (json) => {
            data = json.has_parent_or_children;
        },
        error: (e) => {
            console.log('error', e);
            data = null;
        },
    });
    return data;
};

// Fetch merge-group info for a process to decide the delete-confirmation flow.
// Returns { hasParentOrChildren, isChild }. The member processes themselves come from
// the delete preview endpoint, which also reports what distinguishes same-named processes.
const getProcessMergeInfo = async (procId) => {
    let info = { hasParentOrChildren: false, isChild: false };
    await $.ajax({
        url: `api/setting/proc_config/${procId}`,
        type: 'GET',
        cache: false,
        success: (json) => {
            info = {
                hasParentOrChildren: !!json.has_parent_or_children,
                isChild: !!json.is_child_process,
            };
        },
        error: (e) => {
            console.log('error', e);
        },
    });
    return info;
};

const deleteProcess = (procItem) => {
    const row = $(procItem).closest('tr');
    const procId = row.data('proc-id');

    if (!procId) {
        row.remove();
        updateTableRowNumber(procElements.tblProcConfig);
        updateProcessSelectionState();
        return;
    }

    openDeleteProcessesModal(row);
};

const removeProcessConfigRow = (procId) => {
    $(`#proc_${procId}`).remove();
};

const disableDatatime = (data_type, isAddNew) => {
    if (!isAddNew) return ' disabled';
    return data_type === DataTypes.DATETIME.name ? '' : ' disabled';
};

const genColConfigHTML = (col, isAddNew = true) => {
    const isDateTime = col.is_get_date ? 'checked' : '';
    let isSerial = col.is_serial_no ? ' checked' : '';
    const isAutoIncrement = col.is_auto_increment ? ' checked' : '';
    const disableDatetime = disableDatatime(col.data_type, isAddNew);
    const isDummyDatetime = col.is_dummy_datetime ? true : false;

    // if v2 col_name is シリアルNo -> auto check
    if (!isSerial && isAddNew) {
        isSerial = /^.*シリアル|serial.*$/.test(col.column_name.toString().toLowerCase()) ? 'checked' : '';
    }

    return `<tr name="selectedColumn" id="selectedColumn${col.column_name}" uid="${col.column_name}">
        <td class="col-number"></td>
        <td class="pr-row">
            <input data-type="${col.data_type}" name="${procModalElements.columnName}"
                class="form-control" value="${col.column_name}" disabled>
        </td>
        <td>
            <div class="custom-control custom-checkbox" style="text-align:center; vertical-align:middle">
                <input id="datetimeColumn${col.column_name}"
                    class="custom-control-input" is-dummy-datetime="${isDummyDatetime}" 
                    type="checkbox" name="${procModalElements.dateTime}" ${isDateTime} ${disableDatetime}>
                <label class="custom-control-label" for="datetimeColumn${col.column_name}"></label>
                <input id="isDummyDatetime${col.column_name}" type="hidden" name="${procModalElements.isDummyDatetime}"
                    value="${isDummyDatetime}">
            </div>
        </td>
        <td>
            <div class="custom-control custom-checkbox" style="text-align:center; vertical-align:middle">
                <input id="serialColumn${col.column_name}"
                    class="custom-control-input" type="checkbox" name="${procModalElements.serial}" ${isSerial}>
                <label class="custom-control-label" for="serialColumn${col.column_name}"></label>
            </div>
        </td>
        <td title="To be used to keep time consistency for import date (Option)">
            <div class="custom-control custom-checkbox" style="text-align:center; vertical-align:middle">
                <input id="autoIncrementColumn${col.column_name}"
                    class="custom-control-input" type="checkbox"
                    name="${procModalElements.auto_increment}" ${isAutoIncrement} ${disableDatetime}>
                <label class="custom-control-label" for="autoIncrementColumn${col.column_name}"></label>
            </div>
        </td>
        <td class="pr-row"><input name="${procModalElements.englishName}" class="form-control" type="text" value="${isDateTime && !isDummyDatetime && isAddNew ? 'Datetime' : col.name_en}"></td>
        <td class="pr-row"><input name="${procModalElements.japaneseName}" data-shown-name="1" class="form-control" type="text" value="${col.name_jp || ''}"></td>
        <td class="pr-row"><input name="${procModalElements.localName}" data-shown-name="1" class="form-control" type="text" value="${col.name_local || ''}"></td>
    </tr>`;
};

const getProcInfo = async (procId) => {
    return $.ajax({
        url: `api/setting/proc_config/${procId}`,
        type: 'GET',
        cache: false,
        success(res) {
            procModalElements.proc.val(res.data.name_en);
            procModalElements.procJapaneseName.val(res.data.name_jp || '');
            procModalElements.procLocalName.val(res.data.name_local || '');
            procModalElements.procID.val(res.data.id);
            procModalElements.comment.val(res.data.comment);
            procModalElements.tables.val(res.data.table_name);
            procModalElements.label.val(res.data.labels.map((l) => l.name)).trigger('change');
            procModalElements.optionalFunctions.val(res.data.etl_func);
            procModalElements.dsID.val(res.data.data_source_id);
            procModalElements.fileName.val(res.data.file_name);
            procModalElements.isShowFileName.prop('checked', !!res.data.is_show_file_name);
            procModalElements.procDateTimeFormatInput.val(res.data.datetime_format || '');
            currentProcData.ds_id = res.data.data_source_id;
            currentProcData.table_name = res.data.table_name;

            // update origin value in DOM
            procModalElements.proc[0].setAttribute('data-observer', res.data.name_en || '');
            procModalElements.procJapaneseName[0].setAttribute('data-observer', res.data.name_jp || '');
            procModalElements.procLocalName[0].setAttribute('data-observer', res.data.name_local || '');
            procModalElements.comment[0].setAttribute('data-observer', res.data.comment || '');
            procModalElements.fileName[0].setAttribute('data-observer', res.data.file_name || '');

            const dsLength = $('#procSettingModal select[name=databaseName] option').length;
            if (dsLength > 0) {
                const modalConfirmMergeMode = document.querySelector(procModalElements.confirmMergeMode);
                modalConfirmMergeMode.deactivate = true;
                $(`#procSettingModal select[name=databaseName] option[value="${res.data.data_source_id}"]`)
                    .prop('selected', true)
                    .change();
                modalConfirmMergeMode.deactivate = false;
            }
            resetDicOriginData();
            let rowHtml = '';
            res.data.columns.forEach((row) => {
                dicOriginDataType[row.column_name] = row.data_type;
                dicProcessCols[row.column_name] = row;
            });

            validateSelectedColumnInput();

            if (res.tables.ds_type === DB.DB_CONFIGS.CSV.type) {
                procModalElements.tables.append(
                    $('<option/>', {
                        value: '',
                        text: '---',
                    }),
                );
                propGroupTableDropdown(true);
            }

            // disable formula cell for ds not csv types
            isEnableFormulaForDs = DB_CONFIG_CSV_TYPES.includes(res.tables.ds_type.toLowerCase());

            if (res.tables.tables) {
                const isSoftwareWorkshop = res.tables.ds_type === DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.configs.type;
                const isSWSnowflake = res.tables.ds_type === DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type;
                const processFactIds = res.tables.process_factids;
                const masterTypes = res.tables.master_types;
                res.tables.tables.forEach(function (tbl, index) {
                    const options = {
                        value: tbl,
                        text: tbl,
                        process_fact_id: isSoftwareWorkshop || isSWSnowflake ? processFactIds[index] : '',
                        master_type: isSoftwareWorkshop || isSWSnowflake ? masterTypes[index] : '',
                    };
                    if (res.data.table_name === tbl) {
                        options.selected = 'selected';
                    }

                    procModalElements.tables.append($('<option/>', options));
                });
                if (procId) {
                    procModalElements.optionalFunctions.prop('disabled', true);
                }
            }

            // handling english name onchange
            handleEnglishNameChange(procModalElements.proc);
            handleEnglishNameChange($(procModalElements.systemNameInput));

            // disable datetime + as key columns
            validateFixedColumns();

            // show warning to reset data link config when change as link id
            validateCheckBoxesAll();
            if (!res.is_imported) {
                isInitialize = true;
                enableImportProcessConfig();
            } else {
                isInitialize = false;
                showHideReRegisterBtn();
                showHideInitialProcBtn();
            }

            // update row number
            updateTableRowNumber(null, $('table[name=processColumnsTable]'));

            $('#procSettingModal').modal('show');

            currentProcDataCols = res.data.columns;
            currentProcess = res.data;
            currentProcessId = res.data.id;

            // date time format
            initDatetimeFormatCheckboxAndInput();

            // toggle dropdown and file input
            if (DB_CONFIG_CSV_TYPES.includes(res.tables.ds_type.toLowerCase())) {
                $(procModalElements.fileInputPreview).show();
                $(procModalElements.grTableDropdown).hide();
            } else if (res.tables.ds_type.toLowerCase() === DB.DB_CONFIGS.WEB_API.type) {
                $(procModalElements.fileInputPreview).hide();
                $(procModalElements.grTableDropdown).hide();
            } else if (res.tables.tables.length) {
                $(procModalElements.fileInputPreview).hide();
                $(procModalElements.grTableDropdown).show();
            }
        },
    });
};

const showHideReRegisterBtn = () => {
    procModalElements.reRegisterBtn.css('display', 'none');
    procModalElements.createOrUpdateProcCfgBtn.css('display', 'block');
    if (!isAddNewMode()) {
        procModalElements.reRegisterBtn.css('display', 'block');
        procModalElements.createOrUpdateProcCfgBtn.css('display', 'none');
    }
};

// Show or hide the initialization process button (S255#02)
const showHideInitialProcBtn = () => {
    procModalElements.initializeProcessBtn.css('display', 'none');
    if (!isAddNewMode()) {
        procModalElements.initializeProcessBtn.css('display', 'block');
    }
};

const enableImportProcessConfig = () => {
    procModalElements.reRegisterBtn.css('display', 'none');
    procModalElements.initializeProcessBtn.css('display', 'none');
    procModalElements.createOrUpdateProcCfgBtn.css('display', 'block');
    //TODO: Enable checkbox [Datetime Format] allow change [Data Type] same import new process
};

const resetSampleDataDisplayModeRadio = () => {
    procModalElements.sampleDataDisplayRecordsRadio.prop('checked', true);
};

const isAddNewMode = () => isEmpty(procModalElements.procID.val() || null);

const showProcSettingModal = async (procItem, dbsId = null) => {
    procModalElements.etlFuncWarningMark = $('#procSettingModal #optional-func-warning-mark');
    $(functionConfigElements.collapseFunctionConfig).collapse('hide');
    // remove old table
    clearProcModalColumnTable(procModalElements.procConfigTableName);

    FunctionInfo.resetInputFunctionInfo();
    FunctionInfo.removeAllFunctionRows();
    clearWarning();
    cleanOldData();

    // hide selection checkbox
    $(procModalElements.autoSelectAllColumn).hide();

    // reset select all checkbox to uncheck when showing modal
    changeSelectionCheckbox((autoSelect = false), (selectAll = false));
    showHideReRegisterBtn();
    showHideInitialProcBtn();
    resetSampleDataDisplayModeRadio();
    prcPreviewDataOfFunctionColumn = {};

    currentProcItem = $(procItem).closest('tr');
    const procId = currentProcItem.data('proc-id');
    const loadingObj = loadingHandler();
    loadingObj.show();
    try {
        handleEnglishNameChange(procModalElements.proc);

        const parentDataRow = $(procItem).parent().parent();
        const dataRowID = parentDataRow.data('rowid') ?? parentDataRow.attr('id');
        const parentID = parentDataRow.attr('data-proc-parent-id');
        const isHasParentID = !isEmpty(parentID);
        const isMergeMode = isHasParentID || isMergeModeFromProcRow(dataRowID, procId);

        let modalName = '';
        let procInfoResponse = null;
        currentProcDataCols = [];
        if (procId && !isMergeMode) {
            procInfoResponse = await getProcInfo(procId);
        } else {
            resetDicOriginData();
            procModalElements.dsID.val('');

            if (isMergeMode && !procId) {
                procModalElements.procMergeModeModal.modal('show');
            } else if (!isMergeMode) {
                procModalElements.procModal.modal('show');
                FunctionInfo.loadFunctionListTableAndInitDropDown([]);
            }
        }

        if (isMergeMode) {
            const processName = parentDataRow.find('input[name=processName]').val();
            const processNameLocal = docCookies.getItem(keyPort('locale')) === 'ja' ? 'jp' : 'en';

            let checkInterval = setInterval(() => {
                // check processes is available after call trace_config api
                if (!isEmpty(processes)) {
                    clearInterval(checkInterval);
                    // get base process id
                    let baseProc = getBaseProcessInfo(parentID, processName, processNameLocal);
                    // fill data for merge mode modal
                    mergeModeProcess(procId, dataRowID, baseProc, dbsId);
                }
            }, 300);
            modalName = 'procSettingMergeModeModal';
            procModalElements.procMergeModeModal.removeData(DATA_DISCARD_CHANGE);
            if (procId) procModalElements.procMergeModeModal.data(DATA_DISCARD_CHANGE, true);
        } else {
            //set attribute for Ok btn
            $(procModalElements.confirmImportDataBtn).attr('data-is-merge-mode', false);
            await loadProcModal(procId, dataRowID, dbsId);
            // not available from v4.7.10
            // GenerateDefaultImportFilterTable(procId);
            modalName = 'procSettingModal';

            if (procId && !currentProcColumns) {
                await showRecordsBtnFunc();
            }
            if (procInfoResponse && currentProcColumns) {
                const functionInfos = await FunctionInfo.getAllFunctionInfosApi(
                    procId,
                    procInfoResponse.col_id_in_funcs,
                );

                FunctionInfo.loadFunctionListTableAndInitDropDown(functionInfos);
            }
        }

        $('#processGeneralInfo select[name="tableName"]').select2(select2ConfigI18n);

        // clear error message
        $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');

        // disable original column name
        $(procModalElements.columnNameInput).each(function f() {
            $(this).attr('disabled', true);
        });

        // show setting mode when loading proc config
        // showHideModes(false);

        // clear attr on buttons
        procModalElements.okBtn.removeAttr('data-has-ct');

        // input change observer for process cfg modal and process cfg merge mode modal
        inputMutationObserver = new InputChangeObserver(document.getElementById(modalName));
        inputMutationObserver.startObserving();
    } finally {
        loadingObj.hide();
    }
};

const resetDicOriginData = () => {
    dicOriginDataType = {};
    dicProcessCols = {};
    currentProcess = null;
};

const changeDataSource = (e) => {
    const dsType = $(e).find(':selected').data('ds-type').toLowerCase();
    const tableDOM = $(e).parent().parent().find('select[name="tableName"]')[0];

    const processName = $(e).parent().parent().find("input[name='processName']").val();

    if ([DB.DB_CONFIGS.CSV.type, DB.DB_CONFIGS.V2.type, DB.DB_CONFIGS.WEB_API.type].includes(dsType) || !dsType) {
        if (tableDOM) {
            $(tableDOM).hide();
            $(tableDOM).next().hide();
        }
    } else {
        const databaseId = $(e).val();
        const allProcesses = Object.keys(processes).map((key) => processes[key]) || [];
        const listProcessNameExisted = allProcesses.filter((ds) => ds.shown_name === processName);
        const tableProcesName = listProcessNameExisted[0]?.table_name || '';

        // check duplicate process name to fileter process table selector
        // if duplicate process name + ds is db => filter table in use
        // else no filter process table
        const processNameLocale = docCookies.getItem(keyPort('locale')) === 'ja' ? 'jp' : 'en';
        const isDuplicateProcessName = isDuplicatedProcessNameDataRow(processName, processNameLocale);

        $.get(`api/setting/database_table/${databaseId}`, { _: $.now() }, (res) => {
            // filter dbName in process table selector when choose ds is db and to enter merge mode
            const tables = res.tables
                .filter((table) => (isDuplicateProcessName ? table !== tableProcesName : true))
                .map((tblName) => `<option value="${tblName}">${tblName}</option>`);
            const tableOptions = ['<option value="">---</option>', ...tables].join('');
            if (tableDOM) {
                $(tableDOM).show();
                $(tableDOM).next().show();
                $(tableDOM).html(tableOptions);
            }
        });
    }
};

const generateProcessRow = (
    procId = null,
    procName = '',
    nameJP = '',
    nameLocal = '',
    procShownName = '',
    dbsId = null,
    tableName = '',
    dbsName = '',
    dummyRowID = '',
    labels = [],
    disabled = false,
) => {
    const procConfigTextByLang = {
        procName: $('#i18nProcName').text(),
        dbName: $('#i18nDataSourceName').text(),
        tbName: $('#i18nTableName').text(),
        setting: $('#i18nSetting').text(),
        comment: '',
    };
    const allDS = cfgDS || [];
    const dsSelection = allDS.map(
        (ds) =>
            `<option data-ds-type="${ds.type}" ${dbsId && Number(dbsId) === Number(ds.id) ? 'selected' : ''} value="${ds.id}">${ds.name}</option>`,
    );
    const DSSelectionWithDefaultVal = ['<option value="">---</option>', ...dsSelection].join('');
    const rowNumber = $(`${procElements.tblProcConfigID} tbody tr`).length;

    // for SW processes
    const tableEles = `<option value="${tableName}">${tableName || '---'}</option>`;

    // if creating a process row from AddNew (Plus) Button
    let dsSelector = `<select class="form-control" name="databaseName" ${dbsId ? 'disabled' : ''}
                             onChange="changeDataSource(this);"
                             onfocusin="focusInSelectDataSource(this)">${DSSelectionWithDefaultVal}</select>`;
    if (dbsName) {
        // if creating a process row then disable fields
        dsSelector = `<input class="form-control" name="databaseName" ${dbsId ? 'disabled' : ''}
                            value="${dbsName}"/>`;
    }

    let labelEles = '';
    if (labels) {
        labelEles = labels.map((label) => `<span class="process-label">${label.name}</span>`).join('');
    }

    const newRecord = `
<tr name="procInfo" ${procId ? `data-proc-id=${procId} id=proc_${procId}` : ''} ${dbsId ? `data-ds-id=${dbsId}` : ''} data-rowid="${dummyRowID}" data-test-id="${procShownName || ''}">
    <td class="text-center proc-select-column">
        <div class="custom-control custom-checkbox proc-checkbox-control">
            <input
                    id="select-process-${procId || dummyRowID}"
                    type="checkbox"
                    class="proc-select-checkbox proc-checkbox-input custom-control-input"
                    value=""
                    data-proc-id="${procId || ''}"
                    aria-label="Select"
                    ${!procId || disabled ? 'disabled' : ''}
            />
            <label
                    class="proc-checkbox-label custom-control-label"
                    for="select-process-${procId || dummyRowID}"
            ></label>
        </div>
    </td>
    <td class="col-number">${rowNumber + 1}</td>
    <td>
        <input data-name-en="${procName}" data-name-jp="${nameJP || ''}" data-name-local="${nameLocal || ''}" name="processName" class="form-control" type="text"
            placeholder="${procConfigTextByLang.procName}" value="${procShownName || ''}" ${procName ? 'disabled' : ''} ${dragDropRowInTable.DATA_ORDER_ATTR}
            onfocusout="hideDataSourceRegistered(this)"/>
    </td>
    <td>
        ${dsSelector}
    </td>
    <td>
        <select class="form-control" name="tableName" ${dbsId ? 'disabled' : ''}>
            ${tableEles}
        </select>
    </td>
    <td class="text-center">
        <button type="button" class="btn btn-secondary icon-btn proc-show-detail-btn" ${disabled ? 'disabled' : ''}
            onclick="showProcSettingModal(this)">
            <i class="fas fa-edit icon-secondary"></i></button>
    </td>
    <td>
        <textarea name="comment" class="form-control form-data"
            rows="1" placeholder="${procConfigTextByLang.comment}" disabled></textarea>
    </td>
     <td>
        <div class="process-labels">${labelEles}</div>
    </td>
    <td class="process-status" id=""></td>
    <td class="text-center">
        <button onclick="deleteProcess(this)" type="button" ${disabled ? 'disabled' : ''}
            class="btn btn-secondary icon-btn proc-delete-btn">
            <i class="fas fa-trash-alt icon-secondary"></i>
        </button>
    </td>
</tr>`;

    return newRecord;
};

const addProcToTable = ({
    procId = null,
    procName = '',
    nameJP = '',
    nameLocal = '',
    procShownName = '',
    dbsId = null,
    tableName = '',
    dbsName = '',
    labels = [],
} = {}) => {
    const dummyRowID = new Date().getTime().toString(36);
    const newRecord = generateProcessRow(
        procId,
        procName,
        nameJP,
        nameLocal,
        procShownName,
        dbsId,
        tableName,
        dbsName,
        dummyRowID,
        labels,
    );

    const $procTable = $(procElements.tableProcList);
    if (!$procTable.find(`#proc_${procId}`).length) {
        $procTable.append(newRecord);
        const showAllLabelsInUse = isShowAllLabelsInUse();
        if (labels.length > 0) {
            labels.forEach((label) => {
                addLabelIfNotExist(label.name);
                if (!showAllLabelsInUse) {
                    activateLabel(label.name);
                }
            });
            filterProcessByLabels();
        }
    }
    if (procName && dbsId) {
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
    }

    // Add search input for dropdown in database and tableName
    if (!procId) {
        const selectEls = $(`tr[data-rowid="${dummyRowID}"]`).find('select');
        $(selectEls).each(function () {
            $(this).select2({
                minimumResultsForSearch: 0,
                dropdownAutoWidth: true,
                dropdownPosition: 'below',
                language: {
                    noResults: function (params) {
                        return i18nCommon.notApplicable;
                    },
                },
            });

            // Set placeholder for each select2 instance
            $(this)
                .data('select2')
                .$dropdown.find(':input.select2-search__field')
                .attr('placeholder', i18nCommon.search + '...');
        });

        // Select datasource and table --- START
        const dsSelectorEl = $(`#tblProcConfig select`);
        let selectElPosition = null;
        let maxDropdownHeight;
        $(dsSelectorEl).on('select2:opening', function (e) {
            selectElPosition = window.scrollY;

            const numberOfOptions = $(this).find('option').length;
            const selectElClientRect = $(this).next('span.select2')[0].getBoundingClientRect();
            const selectElRectBottom = selectElClientRect.bottom;
            const windowHeight = $(window).height();
            // find max_dropdown_height by: (1) items in dropdown, (2) height of 30 items, (3) browser height
            maxDropdownHeight = Math.min(
                numberOfOptions * SELECT_OPTION_HEIGHT_IN_PX,
                SELECT_OPTION_HEIGHT_IN_PX * MAX_OPTION_COUNT_DS_TABLE,
                windowHeight,
            );
            // always display dropdown is below the selectEl
            if (
                selectElRectBottom + maxDropdownHeight > windowHeight &&
                maxDropdownHeight + SELECT2_SCROLL_TO_TOP_OFFSET < windowHeight
            ) {
                const scrollTo =
                    $(window).scrollTop() +
                    selectElRectBottom +
                    maxDropdownHeight -
                    windowHeight +
                    SELECT2_SCROLL_TO_TOP_OFFSET;
                $('html').animate(
                    {
                        scrollTop: scrollTo,
                    },
                    100,
                );
            } else if (maxDropdownHeight === windowHeight) {
                maxDropdownHeight -= 100; // to display bottom of dropdown (100 ~ height_of_selectEl + height_of_search)
                $('html').animate(
                    {
                        scrollTop: $(window).scrollTop() + selectElClientRect.top,
                    },
                    100,
                );
            } else {
                selectElPosition = null;
            }
        });

        $(dsSelectorEl).on('select2:open', function (e) {
            const selectName = $(this).attr('name');

            // Hide existed ds
            if (selectName === procModalElements.procsdbName) {
                focusInSelectDataSource(this);
            }
            resizeListOptionSelect2({ select2El: $(this), isDisplay30Options: true, maxDropdownHeight });
        });

        // when selecting option => auto scroll to old position of select element
        $(dsSelectorEl).on('select2:select', function (e) {
            if (selectElPosition) {
                $('html').scrollTop(selectElPosition + SELECT2_SCROLL_TO_TOP_OFFSET);
            }
        });
        // Select datasource and table --- END
    }

    setTimeout(() => {
        scrollToBottom(`${procElements.tblProcConfig}_wrap`);
    }, 200);

    // updateTableRowNumber(procElements.tblProcConfig);
    return $procTable.children().last();
};

const addDisabledProcToTable = (
    procId = null,
    procName = '',
    nameJP = '',
    nameLocal = '',
    procShownName = '',
    dbsId = null,
    tableName = '',
    dbsName = '',
    labels = [],
) => {
    const dummyRowID = new Date().getTime().toString(36);
    const newRecord = generateProcessRow(
        procId,
        procName,
        nameJP,
        nameLocal,
        procShownName,
        dbsId,
        tableName,
        dbsName,
        dummyRowID,
        labels,
        true,
    );

    const $procTable = $(procElements.tableProcList);
    if (!$procTable.find(`#proc_${procId}`).length) {
        $procTable.append(newRecord);
        const showAllLabelsInUse = isShowAllLabelsInUse();
        if (labels.length > 0) {
            labels.forEach((label) => {
                addLabelIfNotExist(label.name);
                if (!showAllLabelsInUse) {
                    activateLabel(label.name);
                }
            });
            filterProcessByLabels();
        }
    }
    // set order for temp. process to avoid aut-arrange in table
    if (procName && dbsId) {
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
    }
};

const hideDataSourceRegistered = (elem) => {
    const allProcesses = Object.keys(processes).map((key) => processes[key]) || [];
    const newProcessName = $(elem).val().trim();
    const listProcessNameExisted = allProcesses.filter((ds) => ds.shown_name === newProcessName);
    const rowAddProcess = $(elem).closest(`tr[name=${procModalElements.procsMasterInfo}]`);

    const dsSelectorEl = rowAddProcess.find(`select[name=${procModalElements.procsdbName}]`);
    // trigger change to filter process table
    if (dsSelectorEl.val()) {
        $(dsSelectorEl).trigger('change');
    }
    const processOptions = rowAddProcess.find(`select[name=${procModalElements.procsdbName}] option`);

    processOptions.show();
    listProcessNameExisted.forEach((p) => {
        const dataSourceExisted = p.data_source;
        const csvAndV2DsType = [DB_CONFIGS.CSV.configs.type, DB_CONFIGS.V2.configs.type];

        if (dataSourceExisted && dataSourceExisted.name) {
            processOptions
                .filter(function () {
                    // hide exist data source and data source db
                    return (
                        $(this).text().trim() === dataSourceExisted.name &&
                        csvAndV2DsType.includes($(this).attr('data-ds-type'))
                    );
                })
                .hide();

            // wait to render list of li
            setTimeout(() => {
                $('.select2-results__option').each(function () {
                    if ($(this).text().trim() === dataSourceExisted.name) {
                        $(this).hide();
                    }
                });
            }, 0);
        }
    });
};

const focusInSelectDataSource = (elem) => {
    const elemProcessName = $(elem)
        .closest(`tr[name=${procModalElements.procsMasterInfo}]`)
        .find(`input[name=${procModalElements.procsMasterName}]`);
    hideDataSourceRegistered(elemProcessName);
};

$(() => {
    procModalElements.procModal.on('hidden.bs.modal', () => {
        currentProcessId = null;
        $(procModalElements.selectAllColumn).css('display', 'none');
    });

    // add an empty process config when there is no process config
    setTimeout(() => {
        const countProcConfig = $(`${procElements.tableProcList} tr[name=procInfo]`).length;
        if (!countProcConfig) {
            addProcToTable();
        }
    }, 500);

    // drag & drop for tables
    $(`#${procElements.tblProcConfig} tbody`).sortable({
        helper: dragDropRowInTable.fixHelper,
        update: dragDropRowInTable.updateOrder,
    });

    // resort table
    dragDropRowInTable.sortRowInTable(procElements.tblProcConfig);

    // set table order
    $(procElements.divProcConfig)[0].addEventListener('mouseup', handleMouseUp, false);

    // File name input by explorer
    const $fileName = $(procElements.fileName);
    const $selectFileBtn = $(procElements.fileNameBtn);
    const $selectFileInput = $(procElements.fileNameInput);

    $selectFileBtn.on('click', () => {
        $selectFileInput.click();
    });

    $selectFileInput.on('change', function () {
        const file = this.files[0];
        if (file) {
            $fileName.val(file.name);
        }
    });
});

const isMergeModeFromProcRow = (dataRowID, procId) => {
    // Check merge mode for case edit process registered
    if (procId) return !!$(`#proc_${procId}`).data('proc-parent-id');

    // Flow check merge mode for case add new row process
    let listDataSourceName = [];
    let isSameDataSource = false;
    const prefixAttr = procId ? 'id' : 'data-rowId';
    const allProcesses = Object.keys(processes).map((key) => processes[key]) || [];
    currentProcessName = $(`tr[${prefixAttr}=${dataRowID}] input[name=processName]`).val();
    const dataSourceNameElm = $(`tr[${prefixAttr}=${dataRowID}] select[name=databaseName]`);
    const currentDataSourceVal = $(dataSourceNameElm).val();
    const currentDataSourceName = dataSourceNameElm.find('option:selected').text();
    const currentProcessNameLocal = docCookies.getItem(keyPort('locale')) === 'ja' ? 'jp' : 'en';

    const isDuplicatedProcessName = isDuplicatedProcessNameDataRow(currentProcessName, currentProcessNameLocal);
    const currentProcessNameProperty = currentProcessNameLocal === 'jp' ? 'name_jp' : 'name_en';
    const listProcessCurrentName = allProcesses.filter((ds) => ds[currentProcessNameProperty] === currentProcessName);

    if (isEmpty(currentDataSourceVal)) {
        return false;
    }

    listProcessCurrentName.filter((ds) => listDataSourceName.push(ds?.data_source?.name));

    if (listDataSourceName.indexOf(currentDataSourceName) > -1) {
        isSameDataSource = true;
    }

    // data source is DB
    const csvAndV2DsType = [DB_CONFIGS.CSV.configs.type, DB_CONFIGS.V2.configs.type];
    const processDsType = listProcessCurrentName[0]?.data_source?.type;
    const isDatabaseDSource = !csvAndV2DsType.includes(processDsType);

    return !!(isDuplicatedProcessName && !isSameDataSource) || !!(isDuplicatedProcessName && isDatabaseDSource);
};

const propGroupTableDropdown = (value) => {
    procModalElements.tables.prop('disabled', value);
    procModalElements.optionalFunctions.prop('disabled', value);
};

const showConfigProcessWarning = (elmId, message) => {
    displayRegisterMessage(elmId, {
        message: message,
        is_error: true,
    });
};

const showWarningMark = (elmMark, elmMess, messageError) => {
    procModalElements.btnFuncWarningMark.attr('title', messageError);
    elmMark.show();
    elmMark
        .closest('label.btn-warning-mark')
        .off('click', () => {
            showConfigProcessWarning(elmMess, messageError);
        })
        .on('click', (e) => {
            showConfigProcessWarning(elmMess, messageError);
        });
    showConfigProcessWarning(elmMess, messageError);
};

const getProcessInfo = async (procId) => {
    let data = null;
    await $.ajax({
        url: `api/setting/proc_config/${procId}`,
        type: 'GET',
        cache: false,
        success: (json) => {
            data = json.data;
        },
        error: (e) => {
            console.log('error', e);
            data = null;
        },
    });
    return data;
};

const changeImportLimit = (e) => {
    const $modal = $('#import-limit-confirm-modal');
    const $messageEl = $modal.find('.modal-inform');
    const $selectLimitEl = $(e);
    const limit = Number($selectLimitEl.val());
    const originalValue = parseInt($selectLimitEl.data('original-value'));

    $('#btn-confirm-import-limit').attr('data-item-id', 'CONFIRM_IMPORT_LIMIT');
    $('#btn-confirm-import-limit').attr('data-pf', limit);
    $('#btn-confirm-import-limit').off('click');
    $('#btn-confirm-import-limit').on('click', () => {
        $selectLimitEl.val(Number(limit));
        $selectLimitEl.data('original-value', Number(limit));
        // call api to update limit import
        updateImportLimit(limit);
        DB.setImportLimit(limit);
    });
    $('#btn-cancel-import-limit').off('click');
    $('#btn-cancel-import-limit').on('click', () => {
        $(eles.importLimit).val(DB.getImportLimit());
    });

    let isIncrease = false;
    if (limit === 0 || (originalValue !== 0 && originalValue < limit)) {
        isIncrease = true;
    }
    $messageEl.text(isIncrease ? i18n.confirmIncreaseLimitImport : i18n.confirmDecreaseLimitImport);
    $modal.modal('show');
};

// Multi-process deletion functions
const getSelectedProcessRows = () =>
    $('#tblProcConfig tbody .proc-select-checkbox:checked').closest('tr[name="procInfo"]');

const getVisibleProcessCheckboxes = () =>
    $('#tblProcConfig tbody tr[name="procInfo"]:visible').find('.proc-select-checkbox:not(:disabled)');

const getAllProcessCheckboxes = () =>
    $('#tblProcConfig tbody tr[name="procInfo"]').find('.proc-select-checkbox:not(:disabled)');

const updateProcessSelectionState = () => {
    const selectedRows = getSelectedProcessRows();
    const selectedCount = selectedRows.length;
    const allCheckboxes = getAllProcessCheckboxes();

    $('#selected-proc-count').text(selectedCount);
    $('#btn-delete-selected-procs').prop('disabled', !is_authorized || selectedCount === 0);
    $('#select-all-processes')
        .prop('checked', allCheckboxes.length > 0 && selectedCount === allCheckboxes.length)
        .prop('indeterminate', selectedCount > 0 && selectedCount < allCheckboxes.length);
};

const deleteProcesses = (processIds, reloadRelatedProcessData = false) =>
    $.ajax({
        url: 'api/setting/delete_processes',
        type: 'POST',
        data: JSON.stringify({
            proc_ids: processIds,
            reload_related_process_data: reloadRelatedProcessData,
        }),
        dataType: 'json',
        contentType: 'application/json',
        processData: false,
    });

const applyDeletedProcesses = (result = {}) => {
    const deletedProcessIds = result.deleted_process_ids || [];

    deletedProcessIds.forEach((processId) => {
        $(`#proc_${processId}`).remove();
    });

    if (deletedProcessIds.length) {
        reloadTraceConfigFromDB(true);
    }

    updateTableRowNumber('tblProcConfig');

    // A process that could not be deleted stays in the table; tell the user instead of
    // letting the row silently reappear as if nothing happened.
    const failedProcessIds = result.failed_process_ids || [];
    if (failedProcessIds.length) {
        console.error('Failed to delete processes:', failedProcessIds);
        alert(`${i18n.deleteFailed || 'Failed to delete processes'}: ${failedProcessIds.length}`);
    }
};

let pendingDeleteProcRows = $();

// Classify selected processes (parents/children/reload targets) for the bulk-delete modal.
// Returns a promise resolving to { selectedParents, selectedChildren, reloadTargets }.
const getDeleteProcessesPreview = (processIds) =>
    new Promise((resolve) => {
        $.ajax({
            url: 'api/setting/delete_processes/preview',
            type: 'POST',
            data: JSON.stringify({ proc_ids: processIds }),
            dataType: 'json',
            contentType: 'application/json',
            processData: false,
        })
            .done((json) => {
                resolve({
                    selectedParents: json.selected_parents || [],
                    selectedChildren: json.selected_children || [],
                    reloadTargets: json.reload_targets || [],
                });
            })
            .fail(() => {
                resolve({ selectedParents: [], selectedChildren: [], reloadTargets: [] });
            });
    });

// Render a list of names into a <ul>, keeping the styling used by the delete modal.
const renderDeleteProcNames = ($listEl, names) => {
    $listEl.empty();
    (names || []).forEach((name) => {
        $('<li></li>')
            .css({
                'border-bottom': '1px solid #444444',
                'padding': '8px',
            })
            .text(name)
            .appendTo($listEl);
    });
};

// A merged child always has the same name as its parent, so the name alone cannot identify
// a process of a merge group. Append the data source/table shown in the process config table.
const formatDeleteProcLabel = (proc) => {
    if (!proc) return '';
    const details = [proc.data_source_name, proc.table_name].filter(Boolean).join(' / ');
    return details ? `${proc.name} (${details})` : proc.name;
};

// Read the data source shown in a process config row (an input once the row is registered,
// a select while it is still being configured).
const getRowDataSourceName = ($row) => {
    const $input = $row.find('input[name="databaseName"]');
    if ($input.length) {
        return ($input.val() || '').trim();
    }
    return $row.find('select[name="databaseName"] option:selected').text().trim();
};

// Qualify only the entries whose name is not unique in the list, so a merge group (whose
// processes share one name) stays readable without adding noise to unrelated processes.
const qualifyDuplicateProcLabels = (procs) => {
    const nameCounts = {};
    procs.forEach((proc) => {
        nameCounts[proc.name] = (nameCounts[proc.name] || 0) + 1;
    });
    return procs.map((proc) => (nameCounts[proc.name] > 1 ? formatDeleteProcLabel(proc) : proc.name));
};

// Render the two conditional warning blocks of the delete modal from a classified selection.
// Shared by the single- and multi-selection flows so both stay consistent with the spec.
const renderDeleteWarningBlocks = (preview) => {
    // Block #1: selected merge destinations; deleting one also deletes the processes merged into it.
    if (preview.selectedParents.length) {
        renderDeleteProcNames($('#delete-proc-parents-list'), preview.selectedParents.map(formatDeleteProcLabel));
        $('#delete-proc-parents-block').show();
    }

    // Block #2: parents that survive the deletion but must reload their already-imported data.
    // Empty when every affected parent is deleted too, so there is nothing left to reload.
    if (preview.reloadTargets.length) {
        renderDeleteProcNames($('#delete-proc-reload-list'), preview.reloadTargets.map(formatDeleteProcLabel));
        $('#delete-proc-children-block').show();
        // Reload checkbox (default checked) + note; the confirm handler reads its state.
        $('#delete-proc-reload-wrapper').show();
    }
};

const openDeleteProcessesModal = async (rows) => {
    pendingDeleteProcRows = rows;

    const messageElement = $('#delete-proc-confirm-message');
    const listElement = $('#delete-proc-confirm-list');
    const listWrapper = $('#delete-proc-confirm-list-wrapper');
    const trailingElement = $('#delete-proc-confirm-trailing');
    const reloadWrapper = $('#delete-proc-reload-wrapper');
    const reloadCheckbox = $('#delete-proc-reload-checkbox');
    const count = rows.length;

    // Reset transient modal state on each open to avoid leaked state between opens.
    listElement.empty();
    listWrapper.hide();
    trailingElement.hide().text('');
    reloadWrapper.hide();
    reloadCheckbox.prop('checked', true);
    $('#delete-proc-parents-block').hide();
    $('#delete-proc-parents-list').empty();
    $('#delete-proc-children-block').hide();
    $('#delete-proc-reload-list').empty();

    const appendRelatedNames = (names) => {
        listElement.empty();
        (names || []).forEach((name) => {
            $('<li></li>')
                .css({
                    'border-bottom': '1px solid #444444',
                    'padding': '8px',
                })
                .text(name)
                .appendTo(listElement);
        });
        if (names && names.length) {
            listWrapper.show();
        }
    };

    if (count > 1) {
        messageElement.text(messageElement.data('multiple-message') || `Delete ${count} processes?`);

        const procNames = rows
            .map((_index, row) => {
                const $row = $(row);
                return {
                    name: $row.find('input[name="processName"]').val() || $row.find('td:nth-child(3)').text().trim(),
                    data_source_name: getRowDataSourceName($row),
                };
            })
            .get()
            .filter((proc) => proc.name);

        appendRelatedNames(qualifyDuplicateProcLabels(procNames));

        // Classify the selection on the backend to render the two conditional warning blocks.
        const processIds = rows
            .map((_index, row) => $(row).attr('data-proc-id'))
            .get()
            .filter(Boolean)
            .map((id) => parseInt(id));

        if (processIds.length) {
            const preview = await getDeleteProcessesPreview(processIds);
            renderDeleteWarningBlocks(preview);
        }
    } else {
        const row = rows.first();
        const procId = row.data('proc-id');
        const procName = row.find('input[name="processName"]').val() || row.find('td:nth-child(3)').text().trim();
        const procNameHtml = `<span style="color: #f8fbfd; font-weight: bold;">${procName} </span>`;
        const singleMessage = i18n.confirmDeleteProc || messageElement.data('single-message');
        const defaultMessage =
            procName && i18n.thisRecord && singleMessage.includes(i18n.thisRecord)
                ? singleMessage.replace(i18n.thisRecord, procNameHtml)
                : singleMessage;

        if (procId) {
            const mergeInfo = await getProcessMergeInfo(procId);
            if (!mergeInfo.hasParentOrChildren) {
                // Not a merge process -> keep default confirmation message.
                messageElement.html(defaultMessage);
            } else {
                // Merge process: the dedicated message explains the consequence, while the
                // lists follow the same classification as the multi-selection flow so the
                // process being deleted is always listed and the warnings stay consistent.
                messageElement.text(
                    mergeInfo.isChild ? i18n.warnDeleteMergedChildProc : i18n.warnDeleteMergedParentProc,
                );
                appendRelatedNames([procName].filter(Boolean));

                renderDeleteWarningBlocks(await getDeleteProcessesPreview([parseInt(procId)]));

                trailingElement.text(i18n.confirmContinue).show();
            }
        } else {
            messageElement.html(defaultMessage);
        }
    }

    $('#deleteProcessesModal').modal('show');
};

const confirmDelProcs = () => {
    const rows = pendingDeleteProcRows;
    const processIds = rows
        .map((_index, row) => $(row).attr('data-proc-id'))
        .get()
        .filter(Boolean)
        .map((id) => parseInt(id));

    if (processIds.length === 0) {
        $('#deleteProcessesModal').modal('hide');
        return;
    }

    // Only relevant when the child-process reload option (Modal B) is visible.
    const reloadRelatedProcessData =
        $('#delete-proc-reload-wrapper').is(':visible') && $('#delete-proc-reload-checkbox').is(':checked');

    deleteProcesses(processIds, reloadRelatedProcessData)
        .done((response) => {
            const result = response.result || response;
            applyDeletedProcesses(result);
            $('#deleteProcessesModal').modal('hide');
            updateProcessSelectionState();
        })
        .fail((error) => {
            console.error('Failed to delete processes:', error);
            $('#deleteProcessesModal').modal('hide');
            alert('Failed to delete processes');
        })
        .always(() => {
            pendingDeleteProcRows = $();
        });
};

// Initialize event listeners for multi-process deletion
$(document).ready(() => {
    // Select all checkbox
    $('#select-all-processes').on('change', function () {
        const isChecked = $(this).is(':checked');
        getVisibleProcessCheckboxes().prop('checked', isChecked);
        updateProcessSelectionState();
    });

    // Individual process checkboxes
    $(document).on('change', '.proc-select-checkbox', function () {
        updateProcessSelectionState();
    });

    // Delete selected button
    $('#btn-delete-selected-procs').on('click', function () {
        const selectedRows = getSelectedProcessRows();
        if (selectedRows.length > 0) {
            openDeleteProcessesModal(selectedRows);
        }
    });

    // Confirm delete button in modal
    $(document).on('click', '#btn-confirm-delete-procs', function () {
        confirmDelProcs();
    });

    // Initialize state on page load
    updateProcessSelectionState();
});
