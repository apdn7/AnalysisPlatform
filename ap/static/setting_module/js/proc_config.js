let currentProcItem;
const currentProcData = {};
const IS_CONFIG_PAGE = true;
let dicOriginDataType = {};
let dicProcessCols = {};

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
    deleteProcModal: '#deleteProcModal',
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
    confirmDeleteProc: $('#i18nConfirmDeleteProc').text(),
    warnDeleteMergedProc: $('#i18nWarDeleteMergedProc').text(),
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
        const statusClass =
            JOB_STATUS[row.status].class || JOB_STATUS.FAILED.class;
        let statusTooltip =
            JOB_STATUS[row.status].title || JOB_STATUS.FAILED.title;
        if (row.data_type_error) {
            statusTooltip = $(baseEles.i18nJobStatusMsg).text();
            statusTooltip = statusTooltip.replace(
                '__param__',
                row.db_master_name,
            );
        }
        const updatedStatus = `<div class="align-middle text-center" data-st="${statusClass}">
            <div class="" data-toggle="tooltip" data-placement="top" title="${statusTooltip}">
                <i class="fas fa-${statusClass} status-i"></i>
            </div>
        </div>`;

        const jobStatusEle = $(`#proc_${row.proc_id} .process-status`).first();
        if (
            jobStatusEle &&
            jobStatusEle.html() &&
            jobStatusEle.html().trim() !== ''
        ) {
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

const deleteProcess = async (procItem) => {
    currentProcItem = $(procItem).closest('tr');
    const procId = currentProcItem.data('proc-id');
    if (procId) {
        $('#btnDeleteProc').attr('data-item-id', procId);
        const isMergedProc = await checkIfProcessIsMerged(procId);
        if (isMergedProc) {
            $(procElements.deleteProcModal)
                .find('.modal-inform')
                .html(i18n.warnDeleteMergedProc);
        } else {
            $(procElements.deleteProcModal)
                .find('.modal-inform')
                .html(i18n.confirmDeleteProc);
        }
        $(procElements.deleteProcModal).modal('show');
    } else {
        // remove empty row
        $(currentProcItem).remove();
        updateTableRowNumber(procElements.tblProcConfig);
    }
};

const removeProcessConfigRow = (procId) => {
    $(`#proc_${procId}`).remove();
};

const confirmDelProc = () => {
    const procId = $('#btnDeleteProc').attr('data-item-id');
    fetch('api/setting/delete_process', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proc_id: procId }), // example: { proc_id: 3 }
    })
        .then((response) => response.clone().json())
        .then((res) => {
            // remove proc from HTML table
            const deleted_processes = res.deleted_processes;
            deleted_processes.forEach((proc_id) => {
                removeProcessConfigRow(proc_id);
            });

            // update row number
            // updateTableRowNumber(procElements.tblProcConfig);

            // refresh Vis network
            reloadTraceConfigFromDB();
        })
        .catch((e) => {
            console.error(e);
        });
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
        isSerial = /^.*シリアル|serial.*$/.test(
            col.column_name.toString().toLowerCase(),
        )
            ? 'checked'
            : '';
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
            loading.hide();

            procModalElements.proc.val(res.data.name_en);
            procModalElements.procJapaneseName.val(res.data.name_jp || '');
            procModalElements.procLocalName.val(res.data.name_local || '');
            procModalElements.procID.val(res.data.id);
            procModalElements.comment.val(res.data.comment);
            procModalElements.tables.val(res.data.table_name);
            procModalElements.dsID.val(res.data.data_source_id);
            procModalElements.fileName.val(res.data.file_name);
            procModalElements.isShowFileName.prop(
                'checked',
                !!res.data.is_show_file_name,
            );
            procModalElements.procDateTimeFormatInput.val(
                res.data.datetime_format || '',
            );
            currentProcData.ds_id = res.data.data_source_id;
            currentProcData.table_name = res.data.table_name;

            const dsLength = $(
                '#procSettingModal select[name=databaseName] option',
            ).length;
            if (dsLength > 0) {
                const modalConfirmMergeMode = document.querySelector(
                    procModalElements.confirmMergeMode,
                );
                modalConfirmMergeMode.deactivate = true;
                $(
                    `#procSettingModal select[name=databaseName] option[value="${res.data.data_source_id}"]`,
                )
                    .prop('selected', true)
                    .change();
                modalConfirmMergeMode.deactivate = false;
            }
            resetDicOriginData();
            let rowHtml = '';
            res.data.columns.forEach((row) => {
                row['data_type'] = row['predict_type'];
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
                procModalElements.tables.prop('disabled', true);
            }
            if (res.tables.tables) {
                const isSoftwareWorkshop =
                    res.tables.ds_type ===
                    DB_CONFIGS.SOFTWARE_WORKSHOP.configs.type;
                const processFactIds = res.tables.process_factids;
                const masterTypes = res.tables.master_types;
                res.tables.tables.forEach(function (tbl, index) {
                    const options = {
                        value: tbl,
                        text: tbl,
                        process_fact_id: isSoftwareWorkshop
                            ? processFactIds[index]
                            : '',
                        master_type: isSoftwareWorkshop
                            ? masterTypes[index]
                            : '',
                    };
                    if (res.data.table_name === tbl) {
                        options.selected = 'selected';
                    }

                    procModalElements.tables.append($('<option/>', options));
                });
            }

            // handling english name onchange
            handleEnglishNameChange(procModalElements.proc);
            handleEnglishNameChange($(procModalElements.systemNameInput));

            // disable datetime + as key columns
            validateFixedColumns();

            // show warning to reset data link config when change as link id
            validateCheckBoxesAll();

            showHideReRegisterBtn();

            // update row number
            updateTableRowNumber(null, $('table[name=processColumnsTable]'));

            $('#procSettingModal').modal('show');
            setTimeout(() => {
                if (!currentProcColumns) {
                    procModalElements.showRecordsBtn.click();
                }
            }, 300);
            fetchFunctionsAfterColumnsAreLoaded(procId, res.col_id_in_funcs);
            currentProcDataCols = res.data.columns;
            currentProcess = res.data;
            currentProcessId = res.data.id;

            // date time format
            initDatetimeFormatCheckboxAndInput();
        },
    });
};

function fetchFunctionsAfterColumnsAreLoaded(proc_id, cols) {
    if (!currentProcColumns) {
        setTimeout(
            () => fetchFunctionsAfterColumnsAreLoaded(proc_id, cols),
            500,
        );
    } else {
        FunctionInfo.getAllFunctionInfosApi(proc_id, cols).then(
            FunctionInfo.loadFunctionListTableAndInitDropDown,
        );
    }
}

const showHideReRegisterBtn = () => {
    procModalElements.reRegisterBtn.css('display', 'none');
    procModalElements.createOrUpdateProcCfgBtn.css('display', 'block');
    if (!isAddNewMode()) {
        procModalElements.reRegisterBtn.css('display', 'block');
        procModalElements.createOrUpdateProcCfgBtn.css('display', 'none');
    }
};

const isAddNewMode = () => isEmpty(procModalElements.procID.val() || null);

const showProcSettingModal = async (procItem, dbsId = null) => {
    $(functionConfigElements.collapseFunctionConfig).collapse('hide');
    FunctionInfo.resetInputFunctionInfo();
    FunctionInfo.removeAllFunctionRows();
    clearWarning();
    cleanOldData();
    showHideReRegisterBtn();
    prcPreviewDataOfFunctionColumn = {};

    currentProcItem = $(procItem).closest('tr');
    const procId = currentProcItem.data('proc-id');
    const loading = $('.loading');

    loading.show();
    handleEnglishNameChange(procModalElements.proc);

    const parentDataRow = $(procItem).parent().parent();
    const dataRowID = parentDataRow.data('rowid') ?? parentDataRow.attr('id');
    const parentID = parentDataRow.attr('data-proc-parent-id');
    const isHasParentID = !isEmpty(parentID);
    const isMergeMode =
        isHasParentID || isMergeModeFromProcRow(dataRowID, procId);
    currentProcDataCols = [];
    FunctionInfo.loadFunctionListTableAndInitDropDown();

    if (procId && !isMergeMode) {
        await getProcInfo(procId);
    } else {
        resetDicOriginData();
        procModalElements.dsID.val('');

        if (isMergeMode && !procId) {
            procModalElements.procMergeModeModal.modal('show');
        } else if (!isMergeMode) {
            procModalElements.procModal.modal('show');
        }
        loading.hide();
    }

    if (isMergeMode) {
        const processName = parentDataRow.find('input[name=processName]').val();
        const processNameLocal =
            docCookies.getItem('locale') === 'ja' ? 'jp' : 'en';

        let checkInterval = setInterval(() => {
            // check processes is available after call trace_config api
            if (!isEmpty(processes)) {
                clearInterval(checkInterval);
                // get base process id
                let baseProc = getBaseProcessInfo(
                    parentID,
                    processName,
                    processNameLocal,
                );
                // fill data for merge mode modal
                mergeModeProcess(procId, dataRowID, baseProc, dbsId);
            }
        }, 300);
    } else {
        //set attribute for Ok btn
        $(procModalElements.confirmImportDataBtn).attr(
            'data-is-merge-mode',
            false,
        );
        loadProcModal(procId, dataRowID, dbsId);
    }

    $('#processGeneralInfo select[name="tableName"]').select2(
        select2ConfigI18n,
    );

    // clear error message
    $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');

    // hide selection checkbox
    $(procModalElements.autoSelectAllColumn).hide();

    // reset select all checkbox to uncheck when showing modal
    changeSelectionCheckbox((autoSelect = false), (selectAll = false));
    // disable original column name
    $(procModalElements.columnNameInput).each(function f() {
        $(this).attr('disabled', true);
    });

    // show setting mode when loading proc config
    // showHideModes(false);

    // clear attr on buttons
    procModalElements.okBtn.removeAttr('data-has-ct');
};

const resetDicOriginData = () => {
    dicOriginDataType = {};
    dicProcessCols = {};
    currentProcess = null;
};

const changeDataSource = (e) => {
    const dsType = $(e).find(':selected').data('ds-type');
    const tableDOM = $(e).parent().parent().find('select[name="tableName"]')[0];

    const processName = $(e)
        .parent()
        .parent()
        .find("input[name='processName']")
        .val();

    if (dsType === 'CSV' || dsType === 'V2' || !dsType) {
        if (tableDOM) {
            $(tableDOM).hide();
            $(tableDOM).next().hide();
        }
    } else {
        const databaseId = $(e).val();
        const allProcesses =
            Object.keys(processes).map((key) => processes[key]) || [];
        const listProcessNameExisted = allProcesses.filter(
            (ds) => ds.shown_name === processName,
        );
        const tableProcesName = listProcessNameExisted[0]?.table_name || '';

        // check duplicate process name to fileter process table selector
        // if duplicate process name + ds is db => filter table in use
        // else no filter process table
        const processNameLocale =
            docCookies.getItem('locale') === 'ja' ? 'jp' : 'en';
        const isDuplicateProcessName = isDuplicatedProcessNameDataRow(
            processName,
            processNameLocale,
        );

        $.get(
            `api/setting/database_table/${databaseId}`,
            { _: $.now() },
            (res) => {
                // filter dbName in process table selector when choose ds is db and to enter merge mode
                const tables = res.tables
                    .filter((table) =>
                        isDuplicateProcessName
                            ? table !== tableProcesName
                            : true,
                    )
                    .map(
                        (tblName) =>
                            `<option value="${tblName}">${tblName}</option>`,
                    );
                const tableOptions = [
                    '<option value="">---</option>',
                    ...tables,
                ].join('');
                if (tableDOM) {
                    $(tableDOM).show();
                    $(tableDOM).next().show();
                    $(tableDOM).html(tableOptions);
                }
            },
        );
    }
};

const addProcToTable = (
    procId = null,
    procName = '',
    nameJP = '',
    nameLocal = '',
    procShownName = '',
    dbsId = null,
) => {
    // function to create proc_id

    const procConfigTextByLang = {
        procName: $('#i18nProcName').text(),
        dbName: $('#i18nDataSourceName').text(),
        tbName: $('#i18nTableName').text(),
        setting: $('#i18nSetting').text(),
        comment: $('#i18nComment').text(),
    };
    const allDS = cfgDS || [];
    const DSselection = allDS.map(
        (ds) =>
            `<option data-ds-type="${ds.type}" ${dbsId && Number(dbsId) === Number(ds.id) ? 'selected' : ''} value="${ds.id}">${ds.name}</option>`,
    );
    const DSSelectionWithDefaultVal = [
        '<option value="">---</option>',
        ...DSselection,
    ].join('');
    const dummyRowID = new Date().getTime().toString(36);
    const rowNumber = $(`${procElements.tblProcConfigID} tbody tr`).length;

    const newRecord = `
    <tr name="procInfo" ${procId ? `data-proc-id=${procId} id=proc_${procId}` : ''} ${dbsId ? `data-ds-id=${dbsId}` : ''} data-rowid="${dummyRowID}" data-test-id="${procShownName || ''}">
        <td class="col-number">${rowNumber + 1}</td>
        <td>
            <input data-name-en="${procName}" data-name-jp="${nameJP || ''}" data-name-local="${nameLocal || ''}" name="processName" class="form-control" type="text"
                placeholder="${procConfigTextByLang.procName}" value="${procShownName || ''}" ${procName ? 'disabled' : ''} ${dragDropRowInTable.DATA_ORDER_ATTR}
                onfocusout="hideDataSourceRegistered(this)">
        </td>
        <td>
            <select class="form-control" name="databaseName" ${dbsId ? 'disabled' : ''}
                onchange="changeDataSource(this);" onfocusin="focusInSelectDataSource(this)">${DSSelectionWithDefaultVal}</select>
        </td>
        <td>
            <select class="form-control" name="tableName" ${dbsId ? 'disabled' : ''}>
                <option value="">---</option>
            </select>
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-secondary icon-btn"
                onclick="showProcSettingModal(this)">
                <i class="fas fa-edit icon-secondary"></i></button>
        </td>
        <td>
            <textarea name="comment" class="form-control form-data"
                rows="1" placeholder="${procConfigTextByLang.comment}" disabled></textarea>
        </td>
        <td class="process-status" id=""></td>
        <td class="text-center">
            <button onclick="deleteProcess(this)" type="button"
                class="btn btn-secondary icon-btn">
                <i class="fas fa-trash-alt icon-secondary"></i>
            </button>
        </td>
    </tr>`;

    $(procElements.tableProcList).append(newRecord);
    if (procName && dbsId) {
        dragDropRowInTable.setItemLocalStorage(
            $(procElements.tableProcList)[0],
        ); // set proc table order
    }

    // Add search input for dropdown in database and tableName
    if (!procId) {
        const selectEls = $(`tr[data-rowid="${dummyRowID}"]`).find('select');
        $(selectEls).each(function () {
            $(this).select2({
                minimumResultsForSearch: 0,
                dropdownAutoWidth: true,
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
    }

    setTimeout(() => {
        scrollToBottom(`${procElements.tblProcConfig}_wrap`);
    }, 200);

    // updateTableRowNumber(procElements.tblProcConfig);
};

const hideDataSourceRegistered = (elem) => {
    const allProcesses =
        Object.keys(processes).map((key) => processes[key]) || [];
    const newProcessName = $(elem).val().trim();
    const listProcessNameExisted = allProcesses.filter(
        (ds) => ds.shown_name === newProcessName,
    );
    const rowAddProcess = $(elem).closest(
        `tr[name=${procModalElements.procsMasterInfo}]`,
    );

    const dsSelectorEl = rowAddProcess.find(
        `select[name=${procModalElements.procsdbName}]`,
    );
    // trigger change to filter process table
    if (dsSelectorEl.val()) {
        $(dsSelectorEl).trigger('change');
    }
    const processOptions = rowAddProcess.find(
        `select[name=${procModalElements.procsdbName}] option`,
    );

    processOptions.show();
    listProcessNameExisted.forEach((p) => {
        const dataSourceExisted = p.data_source;
        const csvAndV2DsType = [
            DB_CONFIGS.CSV.configs.type,
            DB_CONFIGS.V2.configs.type,
        ];

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
        $(procModalElements.selectAllColumn).css('display', 'none');
    });

    // add an empty process config when there is no process config
    setTimeout(() => {
        const countProcConfig = $(
            `${procElements.tableProcList} tr[name=procInfo]`,
        ).length;
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
    $(procElements.divProcConfig)[0].addEventListener(
        'mouseup',
        handleMouseUp,
        false,
    );

    // File name input by explorer
    const $fileName = $(procElements.fileName);
    const $selectFileBtn = $(procElements.fileNameBtn);
    const $selectFileInput = $(procElements.fileNameInput);

    $selectFileBtn.on('click', () => {
        $selectFileInput.click();
    });

    $selectFileInput.on('change', function () {
        const file = this.files[0];
        console.log(file);
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
    const allProcesses =
        Object.keys(processes).map((key) => processes[key]) || [];
    currentProcessName = $(
        `tr[${prefixAttr}=${dataRowID}] input[name=processName]`,
    ).val();
    const dataSourceNameElm = $(
        `tr[${prefixAttr}=${dataRowID}] select[name=databaseName]`,
    );
    const currentDataSourceVal = $(dataSourceNameElm).val();
    const currentDataSourceName = dataSourceNameElm
        .find('option:selected')
        .text();
    const currentProcessNameLocal =
        docCookies.getItem('locale') === 'ja' ? 'jp' : 'en';

    const isDuplicatedProcessName = isDuplicatedProcessNameDataRow(
        currentProcessName,
        currentProcessNameLocal,
    );
    const currentProcessNameProperty =
        currentProcessNameLocal === 'jp' ? 'name_jp' : 'name_en';
    const listProcessCurrentName = allProcesses.filter(
        (ds) => ds[currentProcessNameProperty] === currentProcessName,
    );

    if (isEmpty(currentDataSourceVal)) {
        return false;
    }

    listProcessCurrentName.filter((ds) =>
        listDataSourceName.push(ds?.data_source?.name),
    );

    if (listDataSourceName.indexOf(currentDataSourceName) > -1) {
        isSameDataSource = true;
    }

    // data source is DB
    const csvAndV2DsType = [
        DB_CONFIGS.CSV.configs.type,
        DB_CONFIGS.V2.configs.type,
    ];
    const processDsType = listProcessCurrentName[0]?.data_source?.type;
    const isDatabaseDSource = !csvAndV2DsType.includes(processDsType);

    return (
        !!(isDuplicatedProcessName && !isSameDataSource) ||
        !!(isDuplicatedProcessName && isDatabaseDSource)
    );
};
