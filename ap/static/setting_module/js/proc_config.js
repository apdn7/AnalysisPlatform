/* eslint-disable no-bitwise */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
let currentProcItem;
const currentProcData = {};
const IS_CONFIG_PAGE = true;


const procElements = {
    tblProcConfig: 'tblProcConfig',
    tblProcConfigID: '#tblProcConfig',
    tableProcList: '#tblProcConfig tbody',
    procListChild: '#tblProcConfig tbody tr',
    divProcConfig: '#accordionPC',
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


const deleteProcess = (procItem) => {
    currentProcItem = $(procItem).closest('tr');
    const procId = currentProcItem.data('proc-id');
    if (procId) {
        $('#btnDeleteProc').attr('data-item-id', procId);
        $('#deleteProcModal').modal('show');
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
        body: JSON.stringify({proc_id: procId}), // example: { proc_id: 3 }
    })
        .then(response => response.clone().json())
        .then(() => {
            // remove proc from HTML table
            removeProcessConfigRow(procId);

            // update row number
            // updateTableRowNumber(procElements.tblProcConfig);

            // refresh Vis network
            reloadTraceConfigFromDB();
        })
        .catch(() => {
        });
};

const disableDatatime = (data_type, isAddNew) => {
    if (!isAddNew) return ' disabled';
    return data_type === DataTypes.DATETIME.name ? '' : ' disabled';
};

const genColConfigHTML = (col, isAddNew = true) => {
    const isDateTime = (col.is_get_date) ? 'checked' : '';
    let isSerial = (col.is_serial_no) ? ' checked' : '';
    const isAutoIncrement = (col.is_auto_increment) ? ' checked' : '';
    const isNumeric = isNumericDatatype(col.data_type);
    const [numericOperators, textOperators, coefHTML] = createOptCoefHTML(col.operator, col.coef, isNumeric);
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
                    class="custom-control-input" is-dummy-datetime="${isDummyDatetime}" type="checkbox" name="${procModalElements.dateTime}" ${isDateTime} ${disableDatetime}>
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
        <td class="pr-row">
            <select name="${procModalElements.operator}" class="form-control" type="text">
                <option value="">---</option>
                ${isNumeric ? numericOperators : textOperators}
            </select>
        </td>
        <td class="pr-row-sm pr-row">
            ${coefHTML}
        </td>
    </tr>`;
};


const getProcInfo = (procId) => {
    $.ajax({
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
            currentProcData.ds_id = res.data.data_source_id;
            currentProcData.table_name = res.data.table_name;

            const dsLength = $('#procSettingModal select[name=databaseName] option').length;
            if (dsLength > 0) {
                $(`#procSettingModal select[name=databaseName] option[value="${res.data.data_source_id}"]`)
                    .prop('selected', true).change();
            }
            res.data.columns.forEach((row) => {
                row['data_type'] = row['predict_type'];
                procModalElements.seletedColumnsBody.append(genColConfigHTML(row, false));
            });
            if (res.tables.ds_type === DB.DB_CONFIGS.CSV.type) {
                procModalElements.tables.append(
                    $('<option/>', {
                        value: '',
                        text: '---',
                    }),
                );
                procModalElements.tables.prop('disabled', true);
            }
            if (res.tables.tables) { // TODO many levels
                res.tables.tables.forEach((tbl) => {
                    const options = {
                        value: tbl,
                        text: tbl,
                    };
                    if (res.data.table_name === tbl) {
                        options.selected = 'selected';
                    }

                    procModalElements.tables.append(
                        $('<option/>', options),
                    );
                });
            }

            // validate coef when showing selected columns
            validateAllCoefs();

            // handling english name onchange
            handleEnglishNameChange();

            // disable datetime + as key columns
            validateFixedColumns();

            // show warning to reset data link config when change as link id
            validateCheckBoxesAll();

            showHideReRegisterBtn();

            // update row number
            updateTableRowNumber(null, $('table[name=selectedColumnsTable]'));

            $('#procSettingModal').modal('show');

            setTimeout(() => {
                if (!currentProcColumns) {
                    // show latest records
                    procModalElements.showRecordsBtn.click();
                }
            }, 300);
        },
    });
};

const showHideReRegisterBtn = () => {
    procModalElements.reRegisterBtn.css('display', 'none');
    if (!isAddNewMode()) {
        procModalElements.reRegisterBtn.css('display', 'block');
    }
};

const isAddNewMode = () => isEmpty(procModalElements.procID.val() || null);

const setProcessInfo = (procItem) => {
    const procDOM = $(procItem).parent().parent();
    const procName = procDOM.find('input[name="processName"]')[0];
    const dsName = procDOM.find('select[name="databaseName"]')[0];
    const tableName = procDOM.find('input[name="tableName"]')[0];

    if (procName) {
        procModalElements.proc.val($(procName).val());
    }
};
const showProcSettingModal = (procItem, dbsId = null) => {
    clearWarning();
    // clear user editted input flag
    userEditedProcName = false;

    // clear old procInfo
    currentProcColumns = null;
    $(procModalElements.prcSM).html('');
    $(procModalElements.settingContent).removeClass('hide');
    $(procModalElements.prcSM).parent().addClass('hide');

    currentProcItem = $(procItem).closest('tr');
    const procId = currentProcItem.data('proc-id');
    const loading = $('.loading');

    loading.show();

    // TODO: clear old input from form
    $(procModalElements.latestDataHeader).empty();
    $(procModalElements.latestDataBody).empty();
    $(procModalElements.seletedColumnsBody).empty();
    procModalElements.comment.val('');
    procModalElements.proc.val('');
    procModalElements.procLocalName.val('');
    procModalElements.procJapaneseName.val('');
    procModalElements.procID.val('');
    procModalElements.comment.val('');
    procModalElements.databases.html('');
    procModalElements.tables.html('');
    procModalElements.tables.prop('disabled', false);
    showHideReRegisterBtn();

    if (procId) {
        getProcInfo(procId);
    } else {
        procModalElements.dsID.val('');

        $('#procSettingModal').modal('show');
        loading.hide();
    }

    const dataRowID = $(procItem).parent().parent().data('rowid');
    loadProcModal(procId, dataRowID, dbsId);

    // set process name
    // setProcessInfo(procItem);

    $('#processGeneralInfo select[name="tableName"]').select2(select2ConfigI18n);

    // clear error message
    $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');

    // hide selection checkbox
    $(procModalElements.autoSelectAllColumn).hide();

    // reset select all checkbox to uncheck when showing modal
    changeSelectionCheckbox(autoSect = false, selectAll = false);
    // disable original column name
    $(procModalElements.columnNameInput).each(function f() {
        $(this).attr('disabled', true);
    });

    // show setting mode when loading proc config
    showHideModes(false);

    // clear attr on buttons
    procModalElements.okBtn.removeAttr('data-has-ct');
};
const changeDataSource = (e) => {
    const dsType = $(e).find('option:selected').data('ds-type');
    if (dsType === 'CSV' || dsType === 'V2') {
        const tableDOM = $(e).parent().parent().find('select[name="tableName"]')[0];
        if (tableDOM) {
            $(tableDOM).hide();
        }
    } else {
        const databaseId = $(e).val();
        $.get(`api/setting/database_table/${databaseId}`, {"_": $.now()}, (res) => {
            const tables = res.tables.map(tblName => `<option value="${tblName}">${tblName}</option>`);
            const tableOptions = ['<option value="">---</option>', ...tables].join('');
            const tableDOM = $(e).parent().parent().find('select[name="tableName"]')[0];
            if (tableDOM) {
                $(tableDOM).show();
                $(tableDOM).html(tableOptions);
            }
        });
    }
};

// eslint-disable-next-line no-unused-vars
const addProcToTable = (procId = null, procName = null, procShownName = null, dbsId = null) => {
    // function to create proc_id

    const procConfigTextByLang = {
        procName: $('#i18nProcName').text(),
        dbName: $('#i18nDataSourceName').text(),
        tbName: $('#i18nTableName').text(),
        setting: $('#i18nSetting').text(),
        comment: $('#i18nComment').text(),
    };
    const allDS = cfgDS || [];
    const DSselection = allDS.map(ds => `<option data-ds-type="${ds.type}" ${dbsId && Number(dbsId) === Number(ds.id) ? 'selected' : ''} value="${ds.id}">${ds.name}</option>`);
    const DSSelectionWithDefaultVal = ['<option value="">---</option>', ...DSselection].join('');
    const dummyRowID = (new Date().getTime()).toString(36);
    const rowNumber = $(`${procElements.tblProcConfigID} tbody tr`).length;
    // eslint-disable-next-line no-undef
    const newRecord = `
    <tr name="procInfo" ${procId ? `data-proc-id=${procId} id=proc_${procId}` : ''} ${dbsId ? `data-ds-id=${dbsId}` : ''} data-rowid="${dummyRowID}">
        <td class="col-number">${rowNumber + 1}</td>
        <td>
            <input data-name-en="${procName}" name="processName" class="form-control" type="text"
                placeholder="${procConfigTextByLang.procName}" value="${procShownName || ''}" ${procName ? 'disabled' : ''} ${dragDropRowInTable.DATA_ORDER_ATTR}>
        </td>
        <td class="text-center">
            <select class="form-control" name="databaseName" ${dbsId ? 'disabled' : ''}
                onchange="changeDataSource(this);">${DSSelectionWithDefaultVal}</select>
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
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
    }
    setTimeout(() => {
        scrollToBottom(`${procElements.tblProcConfig}_wrap`);
    }, 200);

    // updateTableRowNumber(procElements.tblProcConfig);
};

// handle searching process name
const searchProcName = (element) => {
    const inputProcName = element.currentTarget.value.trim();

    // when input nothing or only white space characters, show all proc in list
    if (inputProcName.length === 0) {
        $('input[name="processName"]').each(function () {
            $(this.closest('tr[name="procInfo"]')).show();
        });

        return;
    }

    // find and show proc who's name is same with user input
    $('input[name="processName"]').each(function () {
        const currentRow = $(this.closest('tr[name="procInfo"]'));
        if (this.value.match(inputProcName)) currentRow.show();
        else currentRow.hide();
    });
};

$(() => {
    procModalElements.procModal.on('hidden.bs.modal', () => {
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
    $(procElements.divProcConfig)[0].addEventListener('contextmenu', baseRightClickHandler, false);
    $(procElements.divProcConfig)[0].addEventListener('mouseup', handleMouseUp, false);
});
