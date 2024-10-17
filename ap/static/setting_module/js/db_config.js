// state
let currentDSTR;
let latestRecords;
let useDummyDatetime;
let v2DataSources = null;
const MAX_NUMBER_OF_SENSOR = 100000000;
const MIN_NUMBER_OF_SENSOR = 0;
let isV2ProcessConfigOpening = false;
let v2ImportInterval = null;
const DUMMY_V2_PROCESS_NAME = 'DUMMY_V2_PROCESS_NAME';
// data type
const originalTypes = {
    0: null,
    1: 'INTEGER',
    2: 'REAL',
    3: 'TEXT',
    4: 'DATETIME',
};

// Default config
const DB_CONFIGS = {
    POSTGRESQL: {
        name: 'postgresql',
        i18nLabel: $('#i18nDSTypePostgresql').text(),
        configs: {
            type: 'POSTGRESQL',
            port: 5432,
            schema: 'public',
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
        },
    },
    SQLITE: {
        name: 'sqlite',
        i18nLabel: $('#i18nDSTypeSqlite').text(),
        configs: {
            type: 'SQLITE',
            dbname: '',
            use_os_timezone: false,
        },
    },
    MSSQL: {
        name: 'mssqlserver',
        i18nLabel: $('#i18nDSTypeMssql').text(),
        configs: {
            type: 'MSSQLSERVER',
            port: 1433,
            schema: 'dbo',
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
        },
    },
    MYSQL: {
        name: 'mysql',
        i18nLabel: $('#i18nDSTypeMysql').text(),
        configs: {
            type: 'MYSQL',
            port: 3306,
            schema: null,
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
        },
    },
    ORACLE: {
        name: 'oracle',
        i18nLabel: $('#i18nDSTypeOracle').text(),
        configs: {
            type: 'ORACLE',
            port: 1521,
            schema: null,
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
        },
    },
    CSV: {
        name: 'csv/tsv',
        i18nLabel: $('#i18nDSTypeCsvTsvSsv').text(),
        configs: {
            type: 'CSV',
            directory: '',
            delimiter: 'Auto',
            use_os_timezone: false,
        },
    },
    V2: {
        name: 'v2 csv',
        i18nLabel: $('#i18nDSTypeV2Csv').text(),
        configs: {
            type: 'V2',
            directory: '',
            delimiter: 'Auto',
            use_os_timezone: false,
        },
    },
    SOFTWARE_WORKSHOP: {
        name: 'software workshop',
        i18nLabel: $('#i18nDSTypeSoftwareWorkshop').text(),
        configs: {
            type: 'SOFTWARE_WORKSHOP',
            port: 5432,
            schema: 'public',
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
        },
    },
};

const HttpStatusCode = {
    isOk: 200,
    serverErr: 500,
};

const dbElements = {
    tblDbConfig: 'tblDbConfig',
    tblDbConfigID: '#tblDbConfig',
    divDbConfig: '#data_source',
    v2ProcessDiv: '#v2ProcessDiv',
    v2ProcessSelection: '#v2ProcessSelection',
    saveDataSourceModal: '#createV2ProcessDataSource',
    CSVTitle: $('#CSVSelectedLabel'),
};

const DATETIME = originalTypes[4];

const i18nDBCfg = {
    subFolderWrongFormat: $('#i18nSubFolderWrongFormat').text(),
    dirExist: $(`#${csvResourceElements.i18nDirExist}`).text(),
    dirNotExist: $(`#${csvResourceElements.i18nDirNotExist}`).text(),
    noDatetimeColMsg: $('#i18nNoDatetimeCol').text(),
    fileNotFound: $('#i18nFileNotFoundMsg'),
    couldNotReadData: $('#i18nCouldNotReadData'),
    dummyHeader: $('#i18nDummyHeader'),
    partialDummyHeader: $('#i18nPartialDummyHeader'),
};

const triggerEvents = {
    CHANGE: 'change',
    SELECT: 'select',
    ALL: 'all',
};

const checkFolderResources = async (folderUrl, originFolderUrl) => {
    $.ajax({
        url: csvResourceElements.apiCheckFolderUrl,
        method: 'POST',
        data: JSON.stringify({
            url: folderUrl,
            isFile: await checkIsFilePath(folderUrl, originFolderUrl),
        }),
        contentType: 'application/json',
        success: (res) => {
            if (res.is_valid) {
                displayRegisterMessage(
                    csvResourceElements.alertMsgCheckFolder,
                    {
                        message: i18nDBCfg.dirExist,
                        is_error: false,
                    },
                );
                $(csvResourceElements.showResourcesBtnId).trigger('click');
            } else {
                displayRegisterMessage(
                    csvResourceElements.alertMsgCheckFolder,
                    {
                        message: res.err_msg,
                        is_error: true,
                    },
                );
                // hide loading
                $('#resourceLoading').hide();
                return;
            }
        },
    });
};

const showLatestRecordsFromDS = (
    res,
    hasDT = true,
    useSuffix = true,
    isV2 = false,
) => {
    $(csvResourceElements.fileName).text(res.file_name);
    $(`${csvResourceElements.dataTbl} table thead tr`).html('');
    $(`${csvResourceElements.dataTbl} table tbody`).html('');
    $('#resourceLoading').hide();
    if (res.is_dummy_header) {
        $(csvResourceElements.dummyHeaderModalMsg).text(
            $(i18nDBCfg.dummyHeader).text(),
        );
        $(csvResourceElements.dummyHeaderModal).modal('show');
    }
    if (res.partial_dummy_header) {
        $(csvResourceElements.dummyHeaderModalMsg).text(
            $(i18nDBCfg.partialDummyHeader).text(),
        );
        $(csvResourceElements.dummyHeaderModal).modal('show');
    }
    let hasDuplCols = false;
    const predictedDatatypes = res.dataType;
    const dummyDatetimeIdx = res.dummy_datetime_idx;
    const colsName = useSuffix ? res.header : res.org_headers;
    colsName.forEach((column, idx) => {
        let columnColor = dummyDatetimeIdx === idx ? ' dummy_datetime_col' : '';
        const isDuplCol = res.has_dupl_cols
            ? res.same_values[idx].is_dupl
            : false;
        if (isDuplCol) {
            columnColor += ' dupl_col';
            hasDuplCols = true;
        }
        const datatype = predictedDatatypes[idx];
        const tblHeader = `<th>
                    <input id="col-${idx}" class="data-type-predicted" value="${datatype}" type="hidden">
                    <div class="">
                        <label class="column-name${columnColor}" for="">${column}</label>
                    </div>
                </th>`;
        $(`${csvResourceElements.dataTbl} table thead tr`).append(tblHeader);
    });

    res.content.forEach((row) => {
        let rowContent = '<tr>';
        row.forEach((val, idx) => {
            const datatype = predictedDatatypes[idx];
            let columnColor =
                dummyDatetimeIdx === idx ? ' dummy_datetime_col' : '';
            const isDuplCol = res.has_dupl_cols
                ? res.same_values[idx].is_dupl
                : false;
            if (isDuplCol) {
                columnColor += ' dupl_col';
            }
            let formattedVal = val;
            formattedVal = trimBoth(String(formattedVal));
            if (datatype === DataTypes.DATETIME.value) {
                formattedVal = parseDatetimeStr(formattedVal);
            } else if (datatype === DataTypes.INTEGER.value) {
                formattedVal = parseIntData(formattedVal);
                if (isNaN(formattedVal)) {
                    formattedVal = '';
                }
            } else if (datatype === DataTypes.REAL.value) {
                formattedVal = parseFloatData(formattedVal);
            }
            rowContent += `<td data-original="${val}" class="${columnColor}">${formattedVal}</td>`;
        });
        rowContent += '</tr>';
        $(`${csvResourceElements.dataTbl} table tbody`).append(rowContent);
    });
    csvResourceElements.csvFileName = res.file_name;
    $(csvResourceElements.skipHead).val(res.skip_head);
    $(csvResourceElements.skipTail).val(res.skip_tail);
    $(`${csvResourceElements.dataTbl}`).show();
    updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), false);
    if (
        !isV2 &&
        res.file_name &&
        hasDT &&
        ((res.has_dupl_cols && useSuffix) || !res.has_dupl_cols)
    ) {
        // if show preview table ok, enable submit button
        $('button.saveDBInfoBtn[data-csv="1"]').removeAttr('disabled');
        updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), true);
    }
    // show message in case of has duplicated cols
    if (hasDuplCols) {
        const msgContent = '';
        showToastrMsg(msgContent);
    }

    // show encoding
    if (res.encoding) {
        $('#dbsEncoding').text(`Encoding: ${res.encoding}`);
    }
};

const addDummyDatetimeDS = (addCol = true) => {
    if (!addCol) {
        // update content of csv
        latestRecords.content.forEach((row) => row.shift());
        latestRecords.dataType.shift();
        latestRecords.header.shift();
        latestRecords.org_headers.shift();
        latestRecords.same_values.shift();
        latestRecords.dummy_datetime_idx = null;
    }
    useDummyDatetime = addCol;
    if (latestRecords.has_dupl_cols) {
        showDuplColModal();
    } else {
        showLatestRecordsFromDS(latestRecords, addCol);
    }
    if (addCol) {
        // clear old error message
        $(csvResourceElements.alertDSErrMsgContent).html('');
        $(csvResourceElements.alertMsgCheckFolder).hide();
        showToastrMsgNoCTCol(latestRecords.has_ct_col);
    } else {
        // clear old alert top msg
        $('.alert-top-fixed').hide();
        displayRegisterMessage(csvResourceElements.alertMsgCheckFolder, {
            message: i18nDBCfg.noDatetimeColMsg,
            is_error: true,
        });
    }
};

const genColSuffix = (agree = true) => {
    showLatestRecordsFromDS(latestRecords, useDummyDatetime, agree);
};

/**
 * Check Url Is File Path or not
 * @param {string} folderUrl - an Url string
 * @param {string} originFolderUrl - an origin Url string
 * @return {Promise<boolean>} - true: is file path, false: is not file path
 */
async function checkIsFilePath(folderUrl, originFolderUrl) {
    const $filePathHiddenEl = $(csvResourceElements.isFilePathHidden);
    let folderInfoPromise;
    if ($filePathHiddenEl.val() === '') {
        // in case of new data source and first time checking, always call api to check
        folderInfoPromise = checkFolderOrFile(folderUrl);
    } else if (folderUrl !== originFolderUrl) {
        // in case of Url changed, call api to check
        folderInfoPromise = checkFolderOrFile(folderUrl);
    } else {
        // in other cases, get value of isFilePath hidden input
        folderInfoPromise = new Promise((resolve) =>
            resolve({
                isFile: $filePathHiddenEl.val().toLowerCase() === String(true),
            }),
        );
    }

    const folderInfo = await folderInfoPromise;
    $filePathHiddenEl.val(folderInfo.isFile);
    return folderInfo.isFile;
}

const showResources = async () => {
    const folderUrl = $(csvResourceElements.folderUrlInput).val();
    const originFolderUrl = $(csvResourceElements.folderUrlInput).data(
        'originValue',
    );
    const isFilePath = await checkIsFilePath(folderUrl, originFolderUrl);
    const db_code = $(csvResourceElements.showResourcesBtnId).data('itemId');
    const isV2 =
        $(csvResourceElements.showResourcesBtnId).attr('data-isV2') ===
            'true' || false;
    const checkFolderAPI = '/ap/api/setting/check_folder';
    const checkFolderRes = await fetchData(
        checkFolderAPI,
        JSON.stringify({ url: folderUrl, isFile: isFilePath }),
        'POST',
    );
    if (checkFolderRes && !checkFolderRes.is_valid) {
        displayRegisterMessage(csvResourceElements.alertMsgCheckFolder, {
            message: checkFolderRes.err_msg,
            is_error: true,
        });
        // hide loading
        $('#resourceLoading').hide();
        return;
    }
    // get line skipping config
    const csvSkipHead = $('input[name=skip_head]').val() || null;
    const csvNRows = $(csvResourceElements.csvNRows).val() || null;
    const csvIsTranspose = $(csvResourceElements.csvIsTranspose).is(':checked');
    $.ajax({
        url: csvResourceElements.apiUrl,
        method: 'POST',
        data: JSON.stringify({
            db_code,
            url: folderUrl,
            etl_func: $('[name=optionalFunction]').val(),
            delimiter: $(csvResourceElements.delimiter).val(),
            isV2,
            skip_head: csvSkipHead,
            n_rows: csvNRows,
            is_transpose: csvIsTranspose,
            is_file: isFilePath,
        }),
        contentType: 'application/json',
        success: (res) => {
            $(csvResourceElements.alertInternalError).hide();
            showToastrMsgFailLimit(res);

            // save dummy header flag
            if (Object.keys(res).includes('is_dummy_header')) {
                $(csvResourceElements.isDummyHeader).val(res.is_dummy_header);
            }

            if (!res.has_ct_col) {
                showDummyDatetimeModal(res);
                latestRecords = res;
            } else if (res.has_dupl_cols) {
                showDuplColModal();
                latestRecords = res;
            } else {
                showLatestRecordsFromDS(res, true, true, !!res.v2_processes);
            }

            if (isV2 && res.is_process_null) {
                res.v2_processes = [DUMMY_V2_PROCESS_NAME];
                res.v2_processes_shown_name = [
                    $(dbConfigElements.csvDBSourceName).val(),
                ];
            }
            // update process of V2
            if (res.v2_processes && res.v2_processes.length) {
                const v2ProcessList = res.v2_processes;
                const v2ProcessShownNameList =
                    res.v2_processes_shown_name || res.v2_processes;
                addProcessList(v2ProcessList, v2ProcessShownNameList);
                $('input[name="v2Process"]').on('change', () => {
                    const selectedProcess = getCheckedV2Processes();
                    if (selectedProcess.length) {
                        // enable OK button
                        updateBtnStyleWithValidation(
                            $(csvResourceElements.csvSubmitBtn),
                            true,
                        );
                        $('button.saveDBInfoBtn[data-csv="1"]').prop(
                            'disabled',
                            false,
                        );
                    } else {
                        updateBtnStyleWithValidation(
                            $(csvResourceElements.csvSubmitBtn),
                            false,
                        );
                        $('button.saveDBInfoBtn[data-csv="1"]').prop(
                            'disabled',
                            true,
                        );
                    }
                });
            }
        },
        error: (error) => {
            $('#resourceLoading').hide();
            hideAlertMessages();
            displayRegisterMessage(csvResourceElements.alertInternalError, {
                message: i18nDBCfg.couldNotReadData.text(),
                is_error: true,
            });
        },
    });
};

const addProcessList = (
    procsIds,
    processList = [],
    checkedIds = [],
    parentId = 'v2ProcessSelection',
    name = 'v2Process',
) => {
    $(`#${parentId}`).empty();
    addGroupListCheckboxWithSearch(
        parentId,
        parentId + '__selection',
        '',
        procsIds,
        processList,
        { name: name, checkedIds: checkedIds },
    );
};

const validateDBName = () => {
    let isOk = true;
    const dbnames = $(dbConfigElements.csvDBSourceName).val();

    if (!$.trim(dbnames)) {
        isOk = false;
    }

    return {
        isOk,
        message: $(dbConfigElements.i18nDbSourceEmpty).text(),
    };
};

const validateExistDBName = (dbName) => {
    let isOk = true;
    const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const currentName = currentDSTR.find('input[name="name"]').val();

    const getFormData = genJsonfromHTML('#tblDbConfig', 'root', true);
    const dbNames = getFormData('name');

    if (dbNames.root.name != '') {
        // 既存レコードを修正案する場合。
        if (dataSrcId) {
            const index = dbNames.root.name.indexOf(currentName);
            if (index > -1) {
                dbNames.root.name.splice(index, 1);
            }
        }

        for (let i = 0; i < dbNames.root.name.length; i++) {
            if (dbNames.root.name[i] === dbName) {
                isOk = false;
                break;
            }
        }
    }

    return {
        isOk,
        message: $(dbConfigElements.i18nDbSourceExist).text(),
    };
};

let tmpResource;

// call backend API to save
const saveDataSource = (dsCode, dsConfig) => {
    fetch('api/setting/data_source_save', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dsConfig),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);

            // 新規アイテムのattrを設定する。
            const itemName = 'name';
            if (!dsCode) {
                currentDSTR.attr('id', csvResourceElements.dsId + json.id);
                currentDSTR.attr(csvResourceElements.dataSrcId, json.id);
                // itemName = "master-name"
            }

            // データソース名とコメントの値を設定する。
            const dbType = currentDSTR.find('select[name="type"]').val();
            if (dbType === DB_CONFIGS.CSV.configs.type) {
                currentDSTR
                    .find(`input[name="${itemName}"]`)
                    .val($('#csvDBSourceName').val());
                currentDSTR
                    .find('textarea[name="comment"]')
                    .val($('#csvComment').val());
            } else {
                currentDSTR
                    .find(`input[name="${itemName}"]`)
                    .val($(`#${dbType.toLowerCase()}_dbsourcename`).val());
                currentDSTR
                    .find('textarea[name="comment"]')
                    .val($(`#${dbType.toLowerCase()}_comment`).val());
            }

            // show toastr message to guide user to proceed to Process config
            showToastrToProceedProcessConfig();
            // remove tmp resource
            tmpResource = {};
            recentEdit(dsCode);

            // add new data source
            if (json.data_source) {
                const newDataSrc = JSON.parse(json.data_source);
                let isNew = true;
                for (let i = 0; i < cfgDS.length; i++) {
                    if (cfgDS[i].id === newDataSrc.id) {
                        cfgDS[i] = newDataSrc;
                        isNew = false;
                        break;
                    }
                }
                if (isNew) {
                    cfgDS.push(newDataSrc);

                    // update datasource in list of selection
                    $('select[name=databaseName]').append(
                        `<option data-ds-type="${newDataSrc.type}" value="${newDataSrc.id}">${newDataSrc.name}</option>`,
                    );
                }
            }
        })
        .catch((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
        });
};

const saveV2DataSource = (dsConfig) => {
    loading.css('z-index', 9999);
    loading.show();
    fetch('api/setting/v2_data_source_save', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dsConfig),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            $('#modal-db-csv').modal('hide');
            displayRegisterMessage('#alert-msg-db', json.flask_message);
            if (json.flask_message.is_error) {
                loading.hide();
                return;
            }
            const dataSources = json.data.map((da) =>
                JSON.parse(da.data_source),
            );
            let index = 0;
            for (const dbs of dataSources) {
                index += 1;
                const itemName = 'name';
                currentDSTR.attr('id', csvResourceElements.dsId + dbs.id);
                currentDSTR.attr(csvResourceElements.dataSrcId, dbs.id);

                // データソース名とコメントの値を設定する。
                currentDSTR.find(`input[name="${itemName}"]`).val(dbs.name);
                currentDSTR.find('textarea[name="comment"]').val(dbs.comment);
                currentDSTR.find('select[name="type"]').val(dbs.type);
                if (index < dataSources.length) {
                    currentDSTR = addDBConfigRow();
                }

                const allDSID = cfgDS.map((datasource) => datasource.id);
                if (allDSID.length && !allDSID.includes(dbs.id)) {
                    cfgDS.push(dbs);
                }
            }
            v2DataSources = null;
            // show toastr message to guide user to proceed to Process config
            showToastrToProceedProcessConfig();
            loading.hide();

            // show v2 process config automatically
            const dbsIds = json.data.map((da) => da.id);
            showAllV2ProcessConfigModal(dbsIds);
        });
};

const showAllV2ProcessConfigModal = (dbsIds) => {
    let index = 1;
    v2ImportInterval = setInterval(async () => {
        if (index > dbsIds.length) {
            clearInterval(v2ImportInterval);
            isV2ProcessConfigOpening = false;
        }

        if (!isV2ProcessConfigOpening) {
            resetIsShowFileName();
            await showV2ProcessConfigModal(dbsIds[index - 1]);
            index++;
        }
    }, 1000);
};

const disableIsShowFileName = () => {
    procModalElements.isShowFileName.prop('disabled', true);
    procModalElements.isShowFileName.prop('checked', false);
};

const resetIsShowFileName = () => {
    procModalElements.isShowFileName.prop('disabled', false);
    procModalElements.isShowFileName.prop('checked', false);
};

const handleCloseProcConfigModal = () => {
    isV2ProcessConfigOpening = false;
    isClickPreviewMergeMode = false;
    resetIsShowFileName();
    functionConfigResetDefaultValues();
};

const showV2ProcessConfigModal = async (dbsId = null) => {
    if (!dbsId) return;
    await showProcSettingModal(null, dbsId);
    isV2ProcessConfigOpening = true;
};

// get csv column infos
const getCsvColumns = () => {
    const columnNames = [];
    const columnTypes = [];
    const orders = [];
    // $(csvResourceElements.dataTypeSelector).each((i, item) => {
    $(csvResourceElements.dataTypePredicted).each((i, item) => {
        const columnName = $(`#col-${i}`)
            .parent()
            .find(csvResourceElements.columnName)
            .text();
        let dataType;
        if (parseInt($(item).val(), 10) === DataTypes.NONE.value) {
            dataType = originalTypes[3];
        } else {
            dataType = originalTypes[$(item).val()];
        }
        columnTypes.push(dataType);
        columnNames.push(columnName);
        orders.push(i + 1);
    });
    return [columnNames, columnTypes, orders];
};

const validateCsvInfo = (isV2) => {
    if (!validateDBName().isOk) {
        displayRegisterMessage('#alert-msg-csvDbname', {
            message: validateDBName().message,
            is_error: true,
        });
        return false;
    }

    // データベース名の存在をチェックする。
    if (
        !validateExistDBName($(dbConfigElements.csvDBSourceName).val()).isOk &&
        !isV2
    ) {
        displayRegisterMessage('#alert-msg-csvDbname', {
            message: validateExistDBName().message,
            is_error: true,
        });
        return false;
    }

    // const [columnNames, columnTypes, orders] = getCsvColumns();
    //
    // // Check if there is no get_date
    // const nbGetDateCol = columnTypes.filter(col => col === DATETIME).length;
    //
    // if (nbGetDateCol === 0) {
    //     const msgErrorNoGetdate = $(csvResourceElements.msgErrorNoGetdate).text();
    //     displayRegisterMessage(
    //         csvResourceElements.alertMsgCheckFolder,
    //         { message: msgErrorNoGetdate, is_error: true },
    //     );
    //     return false;
    // }

    const isWarning = false;
    // let msgWarnManyGetdate = '';
    // if (nbGetDateCol > 1) {
    //     msgWarnManyGetdate = $(csvResourceElements.msgWarnManyGetdate).text();
    //     const firstGetdateIdx = columnTypes.indexOf(DATETIME);
    //     const firstGetdate = columnNames[firstGetdateIdx] || '';
    //     msgWarnManyGetdate = `${msgWarnManyGetdate.replace('{col}', firstGetdate)}\n`;
    //     isWarning = true;
    // }

    if (isWarning) {
        $(csvResourceElements.csvConfirmModalMsg).text(
            `${msgWarnManyGetdate}${$(csvResourceElements.msgConfirm).text()}`,
        );

        $(csvResourceElements.csvConfirmModal).modal('show');
        return false;
    }

    return true;
};

// gen csv info
const genCsvInfo = async () => {
    const dbItemId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dbType = currentDSTR.find('select[name="type"]').val();
    const directory = $(csvResourceElements.folderUrlInput).val();
    // set default skipHead and skipTail
    const skipHead = $(csvResourceElements.skipHead).val() || null;
    const skipTail = $(csvResourceElements.skipTail).val() || null;
    const csvNRows = $(csvResourceElements.csvNRows).val() || null;
    const csvIsTranspose = $(csvResourceElements.csvIsTranspose).is(':checked');
    const delimiter = $(csvResourceElements.delimiter).val();
    const optionalFunction = $(csvResourceElements.optionalFunction).val();
    const [columnNames, columnTypes, orders] = getCsvColumns();
    const isDummyHeader = $(csvResourceElements.isDummyHeader).val();
    const isFilePath =
        $(csvResourceElements.isFilePathHidden).val().toLowerCase() === 'true';

    // Get csv Information
    const csvColumns = [];

    const dictCsvDetail = {
        id: dbItemId,
        directory,
        skip_head: skipHead,
        skip_tail: skipTail,
        n_rows: csvNRows,
        is_transpose: csvIsTranspose,
        etl_func: optionalFunction,
        delimiter,
        csv_columns: csvColumns,
        dummy_header: isDummyHeader,
        is_file_path: isFilePath,
    };

    const dictDataSrc = {
        id: dbItemId,
        name: $('#csvDBSourceName').val(),
        type: dbType,
        comment: $('#csvComment').val(),
        csv_detail: dictCsvDetail,
    };

    for (let i = 0; i < columnNames.length; i++) {
        csvColumns.push({
            data_source_id: dbItemId,
            column_name: columnNames[i],
            data_type: columnTypes[i],
            order: orders[i],
        });
    }

    return dictDataSrc;
};

const validateV2CSVDBSources = (dbs) => {
    // check duplicated db name
    let isDuplicatedDBName = false;
    for (const v2Dbs of dbs) {
        const dbName = v2Dbs.name;
        if (!validateExistDBName(dbName).isOk) {
            displayRegisterMessage('#alert-msg-csvDbname', {
                message: validateExistDBName().message,
                is_error: true,
            });
            isDuplicatedDBName = true;
        }
    }
    return isDuplicatedDBName;
};

const saveCSVDataSource = async (isV2 = false) => {
    const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dictDataSrc = await genCsvInfo();

    // save
    if (isV2) {
        // update V2 process data to dictDataSrc
        const v2DatasourceByProcess = getV2ProcessData(dictDataSrc);

        if (validateV2CSVDBSources(v2DatasourceByProcess)) return;
        hideAlertMessages();
        if (v2DatasourceByProcess.length > 1) {
            // show modal messenger
            $(dbElements.saveDataSourceModal).modal('show');
            v2DataSources = v2DatasourceByProcess;
        } else if (v2DatasourceByProcess.length == 1) {
            saveV2DataSource(v2DatasourceByProcess);
        }
    } else {
        saveDataSource(dataSrcId, dictDataSrc);
        $('#modal-db-csv').modal('hide');
    }

    // show toast after save
    let dataTypes = $(csvResourceElements.dataTypeSelector).find(
        'option:checked',
    );
    dataTypes = dataTypes
        .toArray()
        .filter(
            (dataType) => Number(dataType.value) === DataTypes.STRING.value,
        );
    if (dataTypes.length > 1) {
        const warningMsg = `${dataTypes.length} ${$(
            '#i18nTooManyString',
        ).text()}`;
        showToastrMsg(warningMsg);
    }
};

const handleSaveV2DataSources = () => {
    if (v2DataSources) {
        saveV2DataSource(v2DataSources);
    }
};

// save csv
const saveCSVInfo = async () => {
    const hasCTCols =
        $(csvResourceElements.csvSubmitBtn).attr('data-has-ct') === 'true';
    if (!hasCTCols) {
        return;
    }
    const isV2 =
        $(csvResourceElements.csvSubmitBtn).attr('data-isV2') === 'true';
    if (validateCsvInfo(isV2)) {
        await saveCSVDataSource(isV2);
    }
};

// const saveDBInfo
// const validateDBInfo
// const saveDBDataSource

// DBInfoの入力をチェックする
const validateDBInfo = () => {
    const dbItemId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dbType = currentDSTR.find('select[name="type"]').val().toLowerCase();
    const dbTypePrefix = dbType.toLowerCase();
    const dbItem = {};
    // Get DB Information
    const itemValues = {
        id: dbItemId,
        name: $(`#${dbTypePrefix}_dbsourcename`).val(),
        type: dbType,
        host: $(`#${dbTypePrefix}_host`).val(),
        port: $(`#${dbTypePrefix}_port`).val(),
        dbname: $(`#${dbTypePrefix}_dbname`).val(),
        schema: $(`#${dbTypePrefix}_schema`).val(),
        username: $(`#${dbTypePrefix}_username`).val(),
        password: $(`#${dbTypePrefix}_password`).val(),
        comment: $(`#${dbTypePrefix}_comment`).val(),
        use_os_timezone: $(`#${dbTypePrefix}_use_os_timezone`).val() === 'true',
    };
    dbItem[dbItemId] = itemValues;
    const validated = DB.validate(dbItem);
    if (!validated.isValid) {
        displayRegisterMessage(`#alert-${dbTypePrefix}-validation`, {
            message: $('#i18nDbSourceEmpty').text(),
            is_error: true,
        });
        return false;
    }

    // データベース名の存在をチェックする。
    if (!validateExistDBName($(`#${dbTypePrefix}_dbsourcename`).val()).isOk) {
        displayRegisterMessage(`#alert-${dbTypePrefix}-validation`, {
            message: validateExistDBName().message,
            is_error: true,
        });
        return false;
    }

    return true;
};

// DBInfoを生成する。
const genDBInfo = () => {
    const dbItemId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dbType = currentDSTR.find('select[name="type"]').val();
    const domDBPrefix = dbType.toLowerCase();

    // Get DB Information
    const dictDBDetail = {
        id: dbItemId,
        name: $(`#${domDBPrefix}_dbsourcename`).val(),
        type: dbType,
        host: $(`#${domDBPrefix}_host`).val(),
        port: $(`#${domDBPrefix}_port`).val(),
        dbname: $(`#${domDBPrefix}_dbname`).val(),
        schema: $(`#${domDBPrefix}_schema`).val(),
        username: $(`#${domDBPrefix}_username`).val(),
        password: $(`#${domDBPrefix}_password`).val(),
        comment: $(`#${domDBPrefix}_comment`).val(),
        use_os_timezone: $(`#${domDBPrefix}_use_os_timezone`).val() === 'true',
    };

    const dictDataSrc = {
        id: dbItemId,
        name: $(`#${domDBPrefix}_dbsourcename`).val(),
        type: dbType,
        comment: $(`#${domDBPrefix}_comment`).val(),
        db_detail: dictDBDetail,
    };

    return dictDataSrc;
};

// DBInfoの保存を実施する。
const saveDBDataSource = () => {
    const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dictDataSrc = genDBInfo();

    // save
    saveDataSource(dataSrcId, dictDataSrc);

    // show toast after save
    $('.modal').modal('hide');
};

const saveDBInfo = () => {
    if (validateDBInfo()) {
        saveDBDataSource();
    }
};

// save db
const saveDBInfo_old = () => {
    const dbItemId = $(e).data('itemId');
    const dbType = $(e).data('dbType');
    const dbItem = {};
    // Get DB Information
    const itemValues = {
        id: dbItemId,
        name: $(`#${dbType}_dbsourcename`).val(),
        type: dbType,
        host: $(`#${dbType}_host`).val(),
        port: $(`#${dbType}_port`).val(),
        dbname: $(`#${dbType}_dbname`).val(),
        schema: $(`#${dbType}_schema`).val(),
        username: $(`#${dbType}_username`).val(),
        password: $(`#${dbType}_password`).val(),
        comment: $(`#${dbType}_comment`).val(),
        use_os_timezone: $(`#${dbType}_use_os_timezone`).val() === 'true',
    };
    dbItem[dbItemId] = itemValues;
    const validated = DB.validate(dbItem);
    // Update instances
    if (validated.isValid) {
        DB.add(dbItem);
        if (dbType === DB_CONFIGS.SQLITE.configs.type) {
            dbItem[dbItemId].dbname = $(`#${dbType}_dbname`).val();
            DB.delete(dbItemId, [
                'host',
                'port',
                'schema',
                'username',
                'password',
            ]);
        }

        // call API here TODO test
        saveDataSource(dbItemId, dbItem);
        $(`#modal-db-${dbType}`).modal('hide');
        return true;
    }
    displayRegisterMessage(`#alert-${dbType}-validation`, {
        message: $('#i18nDbSourceEmpty').text(),
        is_error: true,
    });
    // return false;

    // TODO: Error handle if validate is failed
    // TODO: clean modal's data
};

const updateDBTable = (trId) => {
    const tableData = $(dbElements.tblDbConfigID).DataTable();
    const currentRow = $(dbElements.tblDbConfigID).find(`tr[id='${trId}']`);
    const input = currentRow.find("input[name='master-name']");
    const rowData = tableData.row(currentRow).data();
    input.attr('value', input.val());
    rowData[0] = input.get(0).outerHTML;
    return tableData.row(currentRow).data(rowData).draw();
};

const addDBConfigRow = () => {
    // function to create db_id
    const generateDbID = () => `db_${moment().format('YYMMDDHHmmssSSS')}`;

    // Todo: Refactor i18n
    const dbConfigTextByLang = {
        Setting: $('#i18nSetting').text(),
        DSName: $('#i18nDataSourceName').text(),
        Comment: $('#i18nComment').text(),
    };

    const rowNumber = $(`${dbElements.tblDbConfigID} tbody tr`).length;

    // const trID = generateDbID();
    const row = `<tr name="db-info">
        <td class="col-number">${rowNumber + 1}</td>
        <td>
            <input name="name" class="form-control"
             type="text" placeholder="${dbConfigTextByLang.DSName}" value="" ${dragDropRowInTable.DATA_ORDER_ATTR} 
             disabled="disabled">
        </td>
        <td class="text-center">
        <select name="type" class="form-control">
                <option value="${DB_CONFIGS.CSV.configs.type}">${DB_CONFIGS.CSV.i18nLabel}</option>
                <option value="${DB_CONFIGS.SQLITE.configs.type}">${DB_CONFIGS.SQLITE.i18nLabel}</option>
                <option value="${DB_CONFIGS.POSTGRESQL.configs.type}">${DB_CONFIGS.POSTGRESQL.i18nLabel}</option>
                <option value="${DB_CONFIGS.MSSQL.configs.type}">${DB_CONFIGS.MSSQL.i18nLabel}</option>
                <option value="${DB_CONFIGS.ORACLE.configs.type}">${DB_CONFIGS.ORACLE.i18nLabel}</option>
                <option value="${DB_CONFIGS.MYSQL.configs.type}">${DB_CONFIGS.MYSQL.i18nLabel}</option>
                <option value="${DB_CONFIGS.V2.configs.type}">${DB_CONFIGS.V2.i18nLabel}</option>
                <option value="${DB_CONFIGS.SOFTWARE_WORKSHOP.configs.type}">${DB_CONFIGS.SOFTWARE_WORKSHOP.i18nLabel}</option>
            </select>
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-secondary db-file icon-btn" onclick="loadDetail(this)"
                data-toggle="modal">
                <i class="fas fa-edit icon-secondary"></i>
            </button>
        </td>
        <td>
            <textarea name="comment"
                class="form-control" rows="1"
                disabled="disabled" placeholder="${dbConfigTextByLang.Comment}"></textarea>
        </td>
        <td class="text-center">
            <button onclick="deleteRow(this,null)" type="button" class="btn btn-secondary icon-btn">
                <i class="fas fa-trash-alt icon-secondary"></i>
            </button>
        </td>
    </tr>`;
    $(`#${dbElements.tblDbConfig} > tbody:last-child`).append(row);
    setTimeout(() => {
        scrollToBottom(`${dbElements.tblDbConfig}_wrap`);
    }, 200);
    return $(`#${dbElements.tblDbConfig} > tbody tr:last-child`);
    // filter code
    // resetDataTable(dbElements.tblDbConfigID, {}, [0, 1, 3], row);
    // updateTableRowNumber(dbElements.tblDbConfig);
};

const deleteRow = (self) => {
    $('#deleteDSModal').modal('show');
    currentDSTR = $(self).closest('tr');
};

const confirmDeleteDS = async () => {
    // save current data source tr element
    const dsCode = currentDSTR.attr(csvResourceElements.dataSrcId);
    $(currentDSTR).remove();

    // update row number
    // updateTableRowNumber(dbElements.tblDbConfig);

    if (!dsCode) {
        return;
    }

    // call backend API to delete
    const deleteDataSource = async (dsCode) => {
        try {
            let result;
            await $.ajax({
                url: 'api/setting/delete_datasource_cfg',
                data: JSON.stringify({ db_code: dsCode }),
                dataType: 'json',
                type: 'POST',
                contentType: false,
                processData: false,
                success: (res) => {
                    result = getNode(res, ['result', 'deleted_procs']);

                    // Delete record from DataSource
                    $(`#tblDbConfig tr[data-ds-id=${dsCode}]`).remove();

                    // Delete all Process in DataSource parent
                    $(`#tblProcConfig tr[data-ds-id=${dsCode}]`).remove();

                    // Delete datasource option in select tag
                    $(
                        `select[name="databaseName"] option[value="${dsCode}"]`,
                    ).remove();

                    // refresh Vis network
                    reloadTraceConfigFromDB();

                    // update datasource
                    cfgDS = $.grep(cfgDS, (e) => e.id !== dsCode);
                },
                error: () => {
                    result = null;
                },
            });
            return result;
        } catch (error) {
            return null;
        }
    };

    const deletedProcs = await deleteDataSource(dsCode);

    // delete from UI on success
    if (deletedProcs) {
        $(`#${dsCode}`).remove();

        // remove the deleted DS config in global variable
        DB.delete(dsCode);

        // remove relevant processes in UI
        deletedProcs.forEach((procCode) => {
            $(`#tblProcConfig tr[id=${procCode}]`).remove();
        });
    }
};

const showToastrToProceedProcessConfig = () => {
    const msgContent = `<p>${$('#i18nProceedToProcessConfig').text()}</p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const getDataTypeFromID = (dataTypeID) => {
    let currentDatType = '';
    Object.keys(DataTypes).forEach((key) => {
        if (DataTypes[key].value === Number(dataTypeID)) {
            currentDatType = DataTypes[key].name;
        }
    });
    return currentDatType;
};

const changeSelectedColumnRaw = (ele, idx) => {
    const defaultOptions = {
        dateTime: {
            checked: false,
            disabled: true,
        },
        auto_increment: {
            checked: false,
            disabled: false,
        },
        serial: {
            checked: false,
            disabled: false,
        },
    };
    const operators = {
        DEFAULT: {
            regex: 'Valid-like',
        },
        REAL: {
            '+': '+',
            '-': '-',
            '*': '*',
            '/': '/',
        },
    };
    // find column in setting table
    const columnName = $(
        `table[name="latestDataTable"] thead th:eq(${idx})`,
    ).find('input')[0];
    const columnInSelectedTable = columnName
        ? $('#processColumnsTable').find(`tr[uid="${columnName.value}"]`)[0]
        : null;

    if (columnInSelectedTable) {
        Object.keys(defaultOptions).forEach((key) => {
            const activeDOM = $(columnInSelectedTable).find(
                `input[name="${key}"]`,
            );
            activeDOM.prop('checked', defaultOptions[key].checked);

            if (Number(ele.value) === DataTypes.DATETIME.value) {
                activeDOM.prop('disabled', false);
            } else {
                activeDOM.prop('disabled', defaultOptions[key].disabled);
            }
        });
        let operatorOpt = '';
        if (
            Number(ele.value) === DataTypes.REAL.value ||
            Number(ele.value) === DataTypes.INTEGER.value
        ) {
            operatorOpt = operators[DataTypes.REAL.name];
            const coefNumber =
                $(columnInSelectedTable).find('input[name="coef"]')[0] || '';
            if (!Number(coefNumber.value)) {
                console.log('operator with string');
            }
        } else {
            operatorOpt = operators.DEFAULT;
        }
        const operatorEle = Object.keys(operatorOpt)
            .map((opt) => `<option value="${opt}">${operatorOpt[opt]}</option>`)
            .join('');
        $(columnInSelectedTable).find('select[name="operator"]').html('');
        $(columnInSelectedTable)
            .find('select[name="operator"]')
            .append('<option>---</option>');
        $(columnInSelectedTable)
            .find('select[name="operator"]')
            .append(operatorEle);

        // update data type
        $(columnInSelectedTable)
            .find('input[name="columnName"]')
            .attr('data-type', getDataTypeFromID(ele.value));
    }

    // update data type
    $(`table[name="latestDataTable"] thead th:eq(${idx})`)
        .find('input')
        .attr('data-type', getDataTypeFromID(ele.value));
};
const updateSubmitBtn = () => {
    let btnClass = ['btn-primary', 'btn-secondary'];
    procModalElements.createOrUpdateProcCfgBtn.attr('data-has-ct', true);
    procModalElements.createOrUpdateProcCfgBtn.removeClass(btnClass[1]);
    procModalElements.createOrUpdateProcCfgBtn.addClass(btnClass[0]);
    // hide err msg
    $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');
};
const parseDataType = (ele, idx) => {
    // change background color
    changeBackgroundColor(ele);

    const value = ele.getAttribute('raw-data-type');
    const dataColumn = $(ele).closest('tr').find('input[type=checkbox]');
    // do not parse `datetime`, `date`, and `time` here.
    if (
        value === DataTypes.DATETIME.name ||
        value === DataTypes.DATE.name ||
        value === DataTypes.TIME.name
    ) {
        const dataType = Object.entries(DataTypes).find(
            ([dtype, definition]) => definition.name === value,
        );
        if (dataType !== null) {
            const dataTypeName = dataType[1].name;
            showProcDatetimeFormatSampleData({
                colIdx: idx,
                dataType: dataTypeName,
            });
            dataColumn.attr('raw-data-type', dataTypeName);
        }
        return;
    }

    const vals = [
        ...procModalElements.processColumnsSampleDataTableBody.find(
            `tr:eq(${idx}) .sample-data`,
        ),
    ].map((el) => $(el));

    const attrName = 'data-original';

    switch (ele.getAttribute('value')) {
        case DataTypes.INTEGER.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                const isBigInt = Boolean(e.attr('is-big-int'));
                if (!isBigInt) {
                    val = parseIntData(val);
                }
                e.html(val);
            }
            break;
        case DataTypes.REAL.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = parseFloatData(val);
                e.html(val);
            }
            break;
        case DataTypes.DATETIME.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = parseDatetimeStr(val);
                e.html(val);
            }
            break;
        case DataTypes.DATE.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = parseDatetimeStr(val, true);
                e.html(val);
            }
            break;
        case DataTypes.TIME.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = parseTimeStr(val);
                e.html(val);
            }
            break;
        case DataTypes.REAL_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = val.replaceAll(',', '');
                val = parseFloatData(val);
                e.html(val);
            }
            break;
        case DataTypes.INTEGER_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = val.replaceAll(',', '');
                val = parseIntData(val);
                e.html(val);
            }
            break;
        case DataTypes.EU_REAL_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = val.replaceAll('.', '');
                val = val.replaceAll(',', '.');
                val = parseFloatData(val);
                e.html(val);
            }
            break;
        case DataTypes.EU_INTEGER_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = val.replaceAll('.', '');
                val = val.replaceAll(',', '.');
                val = parseIntData(val);
                e.html(val);
            }
            break;
        default:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = trimBoth(String(val));
                e.html(val);
            }
            break;
    }
    // changeSelectedColumnRaw(ele, idx);
    updateSubmitBtn();
};

const bindDBItemToModal = (selectedDatabaseType, dictDataSrc) => {
    // Clear message
    clearOldValue();

    let domModalPrefix = selectedDatabaseType.toLowerCase();

    // show upon db types
    switch (selectedDatabaseType) {
        case DB_CONFIGS.SQLITE.configs.type: {
            if (!dictDataSrc.db_detail) {
                $(`#${domModalPrefix}_dbname`).val('');
                $(`#${domModalPrefix}_dbsourcename`).val('');
                $(`#${domModalPrefix}_comment`).val('');
            } else {
                // load to modal
                $(`#${domModalPrefix}_dbname`).val(
                    dictDataSrc.db_detail.dbname,
                );
                $(`#${domModalPrefix}_dbsourcename`).val(dictDataSrc.name);
                $(`#${domModalPrefix}_comment`).val(dictDataSrc.comment);
            }
            break;
        }
        case DB_CONFIGS.V2.configs.type:
        case DB_CONFIGS.CSV.configs.type: {
            // Default selected
            $(csvResourceElements.alertMsgCheckFolder).hide();
            $(csvResourceElements.dataTbl).hide();

            $(`${dbConfigElements.csvModal} #okBtn`).data(
                'itemId',
                dictDataSrc.id,
            );
            $(`${dbConfigElements.csvModal} #showResources`).data(
                'itemId',
                dictDataSrc.id,
            );

            // Clear old input data
            $(csvResourceElements.isFilePathHidden).val('');
            $(csvResourceElements.folderUrlInput).val('');
            $(csvResourceElements.folderUrlInput).data('originValue', '');

            $(csvResourceElements.fileName).text('');

            if (dictDataSrc.csv_detail) {
                if (dictDataSrc.csv_detail.directory) {
                    $(csvResourceElements.folderUrlInput).val(
                        dictDataSrc.csv_detail.directory,
                    );
                    $(csvResourceElements.folderUrlInput).data(
                        'originValue',
                        dictDataSrc.csv_detail.directory,
                    );
                }
                $(csvResourceElements.isFilePathHidden).val(
                    dictDataSrc.csv_detail.is_file_path,
                );

                // Update default delimiter radio button by DB_CONFIGS
                if (dictDataSrc.csv_detail.delimiter === 'CSV') {
                    $(csvResourceElements.csv)[0].checked = true;
                } else if (dictDataSrc.csv_detail.delimiter === 'TSV') {
                    $(csvResourceElements.tsv)[0].checked = true;
                } else if (dictDataSrc.csv_detail.delimiter === 'SMC') {
                    $(csvResourceElements.smc)[0].checked = true;
                } else {
                    $(csvResourceElements.fileTypeAuto)[0].checked = true;
                }
                // line skipping
                const skipHead = dictDataSrc.csv_detail.skip_head;
                const isDummyHeader = dictDataSrc.csv_detail.dummy_header;
                const lineSkip =
                    skipHead == 0 && !isDummyHeader ? '' : skipHead;
                $(csvResourceElements.skipHead).val(lineSkip);
                $(csvResourceElements.csvNRows).val(
                    dictDataSrc.csv_detail.n_rows,
                );
                $(csvResourceElements.csvIsTranspose).prop(
                    'checked',
                    !!dictDataSrc.csv_detail.is_transpose,
                );

                // load optional function
                if (dictDataSrc.csv_detail.etl_func) {
                    $(csvResourceElements.optionalFunction)
                        .select2()
                        .val(dictDataSrc.csv_detail.etl_func)
                        .trigger('change');
                }
            }

            // load master name + comment
            $('#csvDBSourceName').val(dictDataSrc.name);
            $('#csvComment').val(dictDataSrc.comment);

            // for V2 datasource
            $(dbElements.v2ProcessDiv).hide();
            if (DB_CONFIGS.V2.configs.type === selectedDatabaseType) {
                domModalPrefix = 'csv';
                $(dbElements.v2ProcessDiv).show();
                // change title to V2 CSV
                dbElements.CSVTitle.text(
                    dbElements.CSVTitle.text().replace('CSV/TSV', 'V2 CSV'),
                );
                // hide skip line
                $(csvResourceElements.skipHead).parent().hide();
                // hide csv nrows
                $(csvResourceElements.csvNRows).parent().hide();
                // hide transpose
                $(csvResourceElements.csvIsTranspose).parent().hide();

                let processList = [];
                if (dictDataSrc.csv_detail.process_name) {
                    processList.push(dictDataSrc.csv_detail.process_name);
                }
                // add empty process
                addProcessList(processList, processList, processList);
                $(`#modal-db-${domModalPrefix} .saveDBInfoBtn`).attr(
                    'data-isV2',
                    true,
                );
                $(`.saveDBInfoBtn`).attr('data-isV2', true);
                $(csvResourceElements.showResourcesBtnId).attr(
                    'data-isV2',
                    true,
                );
            } else {
                // change title to csv / tsv
                dbElements.CSVTitle.text(
                    dbElements.CSVTitle.text().replace('V2 CSV', 'CSV/TSV'),
                );
                // show skip line
                $(csvResourceElements.skipHead).parent().show();
                // show csv nrows
                $(csvResourceElements.csvNRows).parent().show();
                // show transpose
                $(csvResourceElements.csvIsTranspose).parent().show();
            }
            break;
        }
        default: {
            if (!dictDataSrc.db_detail) {
                break;
            }

            // Todo: Refactor Modal's inputs ID
            $(`#${domModalPrefix}_dbsourcename`).val(dictDataSrc.name);
            $(`#${domModalPrefix}_comment`).val(dictDataSrc.comment);
            $(`#${domModalPrefix}_host`).val(dictDataSrc.db_detail.host);
            $(`#${domModalPrefix}_port`).val(dictDataSrc.db_detail.port);
            $(`#${domModalPrefix}_dbname`).val(dictDataSrc.db_detail.dbname);
            $(`#${domModalPrefix}_schema`).val(dictDataSrc.db_detail.schema);
            $(`#${domModalPrefix}_username`).val(
                dictDataSrc.db_detail.username,
            );
            $(`#${domModalPrefix}_password`).val(
                dictDataSrc.db_detail.password,
            );
            $(`#${domModalPrefix}_use_os_timezone`).val(
                dictDataSrc.db_detail.use_os_timezone,
            );
            $(eles.useOSTZOption).prop(
                'checked',
                dictDataSrc.db_detail.use_os_timezone,
            );
            $(eles.useOSTZOption).data(
                'previous-value',
                dictDataSrc.db_detail.use_os_timezone,
            );

            const dbTypeLower = dictDataSrc.type
                ? dictDataSrc.type.toLowerCase()
                : '';
            $(eles.useOSTZConfirmBtn).data('dbType', dbTypeLower);
            break;
        }
    }

    //  TODO: refactor modal ID
    $(`#modal-db-${domModalPrefix} input`).data('itemId', dictDataSrc.id);
    $(`#modal-db-${domModalPrefix} select`).data('itemId', dictDataSrc.id);
    $(`#modal-db-${domModalPrefix} .saveDBInfoBtn`).data(
        'itemId',
        dictDataSrc.id,
    );
    $(`#modal-db-${domModalPrefix} .saveDBInfoBtn`).data(
        'dbType',
        dictDataSrc.type,
    );
    $(`#modal-db-${domModalPrefix}`).modal('show');
    addAttributeToElement();
};

const checkDBConnection = (dbType, html, msgID) => {
    // reset connection status text
    $(`#${msgID}`).html('');
    $(`#${msgID}`).addClass('spinner-grow');
    $(`#${msgID}`).removeClass('text-danger');
    $(`#${msgID}`).removeClass('text-success');

    // get form data
    const data = {
        db: {},
    };

    let dbName = '';
    if (dbType === DB_CONFIGS.SQLITE.configs.type) {
        const filePath = $(`#${dbType}_dbname`).val();
        dbName = filePath;
    } else {
        dbName = $(`#modal-db-${dbType} input[name="${dbType}_dbname"]`).val();
    }
    Object.assign(data.db, {
        host: $(`#modal-db-${dbType} input[name="${dbType}_host"]`).val(),
        port: $(`#modal-db-${dbType} input[name="${dbType}_port"]`).val(),
        schema: $(`#modal-db-${dbType} input[name="${dbType}_schema"]`).val(),
        username: $(
            `#modal-db-${dbType} input[name="${dbType}_username"]`,
        ).val(),
        password: $(
            `#modal-db-${dbType} input[name="${dbType}_password"]`,
        ).val(),
        dbname: dbName,
        db_type: dbType,
    });

    fetch('api/setting/check_db_connection', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            displayTestDBConnectionMessage(msgID, json.flask_message);
        });
};

const loadDetail = (self) => {
    // save current data source tr element
    currentDSTR = $(self).closest('tr');
    const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dsType = currentDSTR.find('select[name="type"]').val();

    // When click (+) to create blank item
    if (dataSrcId === null || dataSrcId === undefined) {
        let jsonDictDataSrc = {};
        switch (dsType) {
            case DB_CONFIGS.SQLITE.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.SQLITE.configs,
                };
                break;
            }
            case DB_CONFIGS.POSTGRESQL.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.POSTGRESQL.configs,
                };
                break;
            }
            case DB_CONFIGS.MSSQL.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.MSSQL.configs,
                };
                break;
            }
            case DB_CONFIGS.ORACLE.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.ORACLE.configs,
                };
                break;
            }
            case DB_CONFIGS.MYSQL.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.MYSQL.configs,
                };
                break;
            }
            case DB_CONFIGS.CSV.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    csv_detail: DB_CONFIGS.CSV.configs,
                };
                break;
            }
            case DB_CONFIGS.V2.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    csv_detail: DB_CONFIGS.CSV.configs,
                };
                break;
            }
            case DB_CONFIGS.SOFTWARE_WORKSHOP.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.SOFTWARE_WORKSHOP.configs,
                };
                break;
            }
        }
        bindDBItemToModal(dsType, jsonDictDataSrc);
    } else {
        const url = new URL(
            `${csvResourceElements.apiLoadDetail}/${dataSrcId}`,
            window.location.href,
        ).href;
        fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        })
            .then((response) => response.clone().json())
            .then((json) => {
                if (json) {
                    bindDBItemToModal(dsType, json);
                }
            });
    }
};

// handle searching data source name
const searchDataSourceName = (element) => {
    const inputDataSourceName = element.currentTarget.value.trim();

    // when input nothing or only white space characters, show all data source in list
    if (inputDataSourceName.length === 0) {
        $('input[name="name"]').each(function () {
            $(this.closest('tr[name="db-info"]')).show();
        });

        return;
    }

    // find and show data source who's name is same with user input
    $('input[name="name"]').each(function () {
        const currentRow = $(this.closest('tr[name="db-info"]'));
        if (this.value.match(inputDataSourceName)) currentRow.show();
        else currentRow.hide();
    });
};

const getCheckedV2Processes = (name = 'v2Process') => {
    return [
        ...$(`input[name=${name}]:checked`).map((i, el) => $(el).val()),
    ].filter((val) => val !== 'All');
};

const getV2ProcessData = (dictDataSrc) => {
    const v2Datasources = [];
    const v2SelectedProcess = getCheckedV2Processes();
    if (v2SelectedProcess.length) {
        v2SelectedProcess.forEach((processName) => {
            const subDatasourceByProcess = JSON.parse(
                JSON.stringify(dictDataSrc),
            );
            const suffix =
                processName === DUMMY_V2_PROCESS_NAME ? '' : `_${processName}`;
            subDatasourceByProcess.name = `${subDatasourceByProcess.name}${suffix}`;
            subDatasourceByProcess.csv_detail.process_name = processName;
            subDatasourceByProcess.csv_detail.auto_link = false;
            v2Datasources.push(subDatasourceByProcess);
        });
    }
    return v2Datasources;
};

$(() => {
    // drag & drop for tables
    $(`#${dbElements.tblDbConfig} tbody`).sortable({
        helper: dragDropRowInTable.fixHelper,
        update: dragDropRowInTable.updateOrder,
    });

    // resort table
    dragDropRowInTable.sortRowInTable(dbElements.tblDbConfig);

    $(csvResourceElements.connectResourceBtn).on('click', () => {
        $(csvResourceElements.alertInternalError).hide();
        const folderUrl = $(csvResourceElements.folderUrlInput).val();
        const originFolderUrl = $(csvResourceElements.folderUrlInput).data(
            'originValue',
        );
        checkFolderResources(folderUrl, originFolderUrl).then(() => {});
    });
    $(csvResourceElements.showResourcesBtnId).on('click', () => {
        $('#resourceLoading').show();
        showResources();
    });

    $(csvResourceElements.csvConfirmRegister).on('click', (e) => {
        saveCSVDataSource().then(() => {});
    });

    // Multiple modal
    $(document).on('show.bs.modal', '.modal', (e) => {
        const zIndex = 1040 + 10 * $('.modal:visible').length;
        $(e.currentTarget).css('z-index', zIndex);
        setTimeout(() => {
            $('.modal-backdrop')
                .not('.modal-stack')
                .css('z-index', zIndex - 1)
                .addClass('modal-stack');
        }, 0);
    });

    // add an empty db row if there is no db config
    setTimeout(() => {
        const countDataSource = $(
            `${dbElements.tblDbConfigID} tbody tr[name=db-info]`,
        ).length;
        if (!countDataSource) {
            addDBConfigRow();
        }
    }, 500);
    $(dbElements.divDbConfig)[0].addEventListener(
        'mouseup',
        handleMouseUp,
        false,
    );

    $(dbConfigElements.csvDBSourceName).on('mouseup', () => {
        userEditedDSName = true;
    });
    $(dbConfigElements.sqliteDbSource).on('change', (e) => {
        e.target.value = $(e.currentTarget).val().replace(/"/g, '').trim();
    });
    $(csvResourceElements.folderUrlId).on('change', (e) => {
        const fileName = $(e.currentTarget).val().replace(/"/g, '').trim();
        e.target.value = fileName;
        const dbsName = $(dbConfigElements.csvDBSourceName).val();
        const existingDSID = $(dbConfigElements.csvDBSourceName).data('itemId');
        if (!existingDSID && (!userEditedDSName || !dbsName)) {
            const fullPath = fileName.replace(/\\/g, '//');
            const lastFolderName = fullPath.match(/([^/]*)\/*$/)[1];
            // autogen datasource name by latest folder name
            $(dbConfigElements.csvDBSourceName).val(lastFolderName);
        }
    });

    // add event to dbElements.txbSearchDataSourceName
    $(dbElements.txbSearchDataSourceName).keyup(searchDataSourceName);

    // convert skipHead to blank if value is out of range
    $(csvResourceElements.skipHead).on('change', (ele) => {
        const skipHead = $(ele.currentTarget);
        if (skipHead.is(':out-of-range')) {
            skipHead.val('');
        }
    });

    // searchDataSource
    onSearchTableContent('searchDataSource', 'tblDbConfig');
    onSearchTableContent('searchProcConfig', 'tblProcConfig');
    sortableTable('tblDbConfig', [0, 1, 2, 4], 510, true);
    sortableTable('tblProcConfig', [0, 1, 2, 3, 5], 510, true);
});
