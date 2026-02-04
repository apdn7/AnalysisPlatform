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
let pollingFrequencyOption = new PollingFrequencyOption('', 0);
// data type
const originalTypes = {
    0: null,
    1: 'INTEGER',
    2: 'REAL',
    3: 'TEXT',
    4: 'DATETIME',
    10: 'TEXT',
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
    POSTGRES_SOFTWARE_WORKSHOP: {
        name: 'postgres software workshop',
        i18nLabel: $('#i18nDSTypeSoftwareWorkshop').text(),
        configs: {
            type: 'POSTGRES_SOFTWARE_WORKSHOP',
            port: 5432,
            schema: 'public',
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
        },
    },
    SNOWFLAKE: {
        id: 'SNOWFLAKE',
        name: 'Snowflake',
        i18nLabel: $('#i18nDSTypeSnowflake').text(),
        configs: {
            type: 'SNOWFLAKE',
            port: 443,
            schema: 'public',
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
            auth_type_el: 'snowflakeAuthType',
        },
    },
    SNOWFLAKE_SOFTWARE_WORKSHOP: {
        id: 'SNOWFLAKE_SOFTWARE_WORKSHOP',
        name: 'Snowflake Software Workshop',
        master_type: 'OTHERS',
        i18nLabel: $('#i18nDSTypeSnowflakeSW').text(),
        configs: {
            type: 'SNOWFLAKE_SOFTWARE_WORKSHOP',
            port: 443,
            schema: 'public',
            dbname: '',
            host: '',
            username: '',
            password: '',
            use_os_timezone: false,
            auth_type_el: 'snowflakeSWAuthType',
        },
    },
    WEB: {
        name: 'web',
        i18nLabel: 'Web',
        configs: {
            type: 'WEB_API',
            url: '',
            id: '',
            username: '',
            password: '',
            authentication_type: 'NONE',
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
    lineGrpSelect: $('#modal-db-postgres_software_workshop select[name=swlineGrps]'),
    lineGroupContainer: $('#modal-db-postgres_software_workshop #lineGroupContainer'),
    sfLineGrpSelect: $('#modal-db-snowflake_software_workshop select[name=lineGrps]'),
    sfLineGroupContainer: $('#modal-db-snowflake_software_workshop #lineGroupContainer'),
    softwareWorkshopInputSearch: 'input#search',
    softwareWorkshopPreviewTbl: 'equipTable',
    softwareWorkshopSearchSetBtn: '#setBtnSearchETL',
    softwareWorkshopSearchResetBtn: '#resetBtnSearchETL',
    softwareWorkshopCheckAll: '#equipTable .check-all-equip',
    softwareWorkshopCheckItem: '#equipTable .check-item',
    confirmSaveSoftwareWorkshopProcesses: '#confirmSaveSoftwareWorkshopProcesses',
    snowflakeInputAreaAccessToken: {
        SNOWFLAKE: '#inputAreaAccessTokenType',
        SNOWFLAKE_SOFTWARE_WORKSHOP: '#inputSWAreaAccessTokenType',
    },
    snowflakeInputAreaPrivateKeyFile: {
        SNOWFLAKE: '#inputAreaKeypairType',
        SNOWFLAKE_SOFTWARE_WORKSHOP: '#inputSWAreaKeypairType',
    },
    pollingConfirmModal: '#polling-frequency-confirm-modal',
    pollingConfirmModalBody: '#polling-frequency-confirm-modal .modal-body',
};

const SNOWFLAKE_AUTH_TYPES = {
    ACCESS_TOKEN: 'access_token',
    KEYPAIR: 'keypair',
};

const WEB_AUTH_TYPES = {
    NONE: 'NONE',
    BASIC: 'BASIC',
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
    hiddenPlaceholder: $('#i18nPlaceholderHidden').text(),
};

const triggerEvents = {
    CHANGE: 'change',
    SELECT: 'select',
    ALL: 'all',
};

let line_grp_infos = [];

const checkFolderResources = async (folderUrl, originFolderUrl) => {
    const isFile = await checkIsFilePath(folderUrl, originFolderUrl);
    $.ajax({
        url: csvResourceElements.apiCheckFolderUrl,
        method: 'POST',
        data: JSON.stringify({
            url: folderUrl,
            isFile: isFile,
        }),
        contentType: 'application/json',
        success: (res) => {
            if (res.is_valid) {
                displayRegisterMessage(csvResourceElements.alertMsgCheckFolder, {
                    message: i18nDBCfg.dirExist,
                    is_error: false,
                });
                $(csvResourceElements.showResourcesBtnId).data('is_file', isFile);
                $(csvResourceElements.showResourcesBtnId).data('is_valid_folder', true);
                $(csvResourceElements.showResourcesBtnId).trigger('click');
            } else {
                displayRegisterMessage(csvResourceElements.alertMsgCheckFolder, {
                    message: res.err_msg,
                    is_error: true,
                });
                // hide loading
                $('#resourceLoading').hide();
                // hide preview table
                $(csvResourceElements.dataTbl).hide();
                disabledSaveDBBtn();
                return;
            }
        },
    });
};

const showLatestRecordsFromDS = (res, hasDT = true, useSuffix = true, isV2 = false) => {
    $(csvResourceElements.fileName).text(res.file_name);
    $(`${csvResourceElements.dataTbl} table thead tr`).html('');
    $(`${csvResourceElements.dataTbl} table tbody`).html('');
    $('#resourceLoading').hide();
    if (res.is_dummy_header) {
        $(csvResourceElements.dummyHeaderModalMsg).text($(i18nDBCfg.dummyHeader).text());
        $(csvResourceElements.dummyHeaderModal).modal('show');
    }
    if (res.partial_dummy_header) {
        $(csvResourceElements.dummyHeaderModalMsg).text($(i18nDBCfg.partialDummyHeader).text());
        $(csvResourceElements.dummyHeaderModal).modal('show');
    }
    let hasDuplCols = false;
    const predictedDatatypes = res.dataType;
    const dummyDatetimeIdx = res.dummy_datetime_idx;
    const colsName = useSuffix ? res.header : res.org_headers;
    colsName.forEach((column, idx) => {
        let columnColor = dummyDatetimeIdx === idx ? ' dummy_datetime_col' : '';
        const isDuplCol = res.has_dupl_cols ? res.same_values[idx].is_dupl : false;
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
            let columnColor = dummyDatetimeIdx === idx ? ' dummy_datetime_col' : '';
            const isDuplCol = res.has_dupl_cols ? res.same_values[idx].is_dupl : false;
            if (isDuplCol) {
                columnColor += ' dupl_col';
            }
            const rawVal = trimBoth(String(val));
            rowContent += `<td data-original="${rawVal}" class="${columnColor}">${rawVal}</td>`;
        });
        rowContent += '</tr>';
        $(`${csvResourceElements.dataTbl} table tbody`).append(rowContent);
    });
    csvResourceElements.csvFileName = res.file_name;
    $(csvResourceElements.skipHead).val(res.skip_head);
    $(csvResourceElements.skipTail).val(res.skip_tail);
    $(csvResourceElements.isFileChecker).val(res.is_file_checker);
    $(`${csvResourceElements.dataTbl}`).show();
    updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), false);
    if (!isV2 && res.file_name && hasDT && ((res.has_dupl_cols && useSuffix) || !res.has_dupl_cols)) {
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

const showResources = async (isFilePath = undefined, isValidFolder = undefined) => {
    $('#resourceLoading').show();
    const folderUrl = $(csvResourceElements.folderUrlInput).val();
    const originFolderUrl = $(csvResourceElements.folderUrlInput).data('originValue');
    if (isFilePath == undefined) {
        isFilePath = await checkIsFilePath(folderUrl, originFolderUrl);
    }
    const db_code = $(csvResourceElements.showResourcesBtnId).data('itemId');
    const isV2 = $(csvResourceElements.showResourcesBtnId).attr('data-isV2') === 'true' || false;
    if (isValidFolder == undefined) {
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
    }
    // get line skipping config
    const csvSkipHead = $('input[name=skip_head]').val() || null;
    const csvNRows = $(csvResourceElements.csvNRows).val() || null;
    const csvIsTranspose = $(csvResourceElements.csvIsTranspose).is(':checked');
    const isFileChecked = $(csvResourceElements.isFileChecker).val() == 'true';
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
            is_file_checker: isFileChecked,
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
                res.v2_processes_shown_name = [$(dbConfigElements.csvDBSourceName).val()];
            }
            // update process of V2
            if (res.v2_processes && res.v2_processes.length) {
                const v2ProcessList = res.v2_processes;
                const v2ProcessShownNameList = res.v2_processes_shown_name || res.v2_processes;
                const initSelectedProcessesVal = getCheckedV2Processes();

                addProcessList(v2ProcessList, v2ProcessShownNameList);

                // add list and check the checkbox
                $('input[name="v2Process"]').each((_, input) => {
                    const processName = $(input).val();
                    if (initSelectedProcessesVal.includes(processName)) {
                        $(input).prop('checked', true);
                        $(input).attr('data-observer', 'true');
                    } else {
                        $(input).attr('data-observer', 'false');
                    }
                });

                $('input[name="v2Process"]').on('change', () => {
                    const selectedProcess = getCheckedV2Processes();
                    if (selectedProcess.length) {
                        // enable OK button
                        updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), true);
                        $('button.saveDBInfoBtn[data-csv="1"]').prop('disabled', false);
                    } else {
                        updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), false);
                        $('button.saveDBInfoBtn[data-csv="1"]').prop('disabled', true);
                    }
                });

                // fix issue https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/823
                // In case all processes are selected, "全部" option will be checked.
                const processCount = $('[name="v2Process"]:not([value="All"])').length;
                const selectedProcessCount = $('[name="v2Process"]:not([value="All"]):checked').length;
                if (processCount > 0 && processCount === selectedProcessCount) {
                    $('[name="v2Process"][value="All"]').prop('checked', true);
                }
                // In case at least one process is selected, "OK" button will be enabled.
                if (processCount > 0) {
                    updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), true);
                    $(csvResourceElements.csvSubmitBtn).prop('disabled', false);
                }

                // update observer
                inputMutationObserver = new InputChangeObserver(document.getElementById('modal-db-csv'));
                inputMutationObserver.startObserving();
            }
            $('#resourceLoading').hide();
        },
        error: (error) => {
            $('#resourceLoading').hide();
            // disabled OK Button
            disabledSaveDBBtn();

            hideAlertMessages();
            displayRegisterMessage(csvResourceElements.alertInternalError, {
                message: i18nDBCfg.couldNotReadData.html(),
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
    addGroupListCheckboxWithSearch(parentId, parentId + '__selection', '', procsIds, processList, {
        name: name,
        checkedIds: checkedIds,
    });
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

const getSWProcessData = () => {
    const processData = [];
    const $equipTble = $(`#${dbElements.softwareWorkshopPreviewTbl}`);
    const selectedItems = $equipTble.find('input:checked').not('#groupTableCheckBoxHeader');
    if (selectedItems.length) {
        Array.from(selectedItems).forEach((item) => {
            processData.push({
                table_name: $(item).data('table-name'),
                child_equip_id: $(item).val(),
                master_type: $(item).data('master-type'),
                id: $(item).data('process_id'),
            });
        });
    }
    return processData;
};

// get new processes which selected from SoftwareWorkshop datasource
const getNewProcesses = (addedProcesses) => {
    const processItems = $('#tblProcConfig').find('tr[name=procInfo]');
    const processIds = Array.from(processItems.map((proc) => $(proc).data('proc-id')));
    return addedProcesses.filter((proc) => !processIds.includes(proc.id));
};

// Software workshop register datasource and processes
const saveSWDatasource = (dsCode, dsConfig, isDirectlyImport = false) => {
    const endPoint = 'api/setting/sw_register';
    const data = {
        datasource: dsConfig,
        processes: getSWProcessData(),
        is_directly_import: isDirectlyImport,
    };

    fetch(endPoint, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
            showMessage(json.flask_message.message);

            // 新規アイテムのattrを設定する。
            const itemName = 'name';
            if (!dsCode) {
                currentDSTR.attr('id', csvResourceElements.dsId + json.id);
                currentDSTR.attr(csvResourceElements.dataSrcId, json.id);
                // itemName = "master-name"
            }

            // データソース名とコメントの値を設定する。
            const dbType = getDbType(dsConfig.id);
            currentDSTR.find(`input[name="${itemName}"]`).val($(`#${dbType.toLowerCase()}_dbsourcename`).val());
            currentDSTR.find('textarea[name="comment"]').val($(`#${dbType.toLowerCase()}_comment`).val());

            PollingFrequencyOption.updateOptionsPollingFre(
                currentDSTR,
                dsConfig.type,
                dsConfig.id,
                dsConfig.polling_frequency / 60,
            );

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
            handleChangeSelectToInputForDBType();

            // if there is creating new datasource/ add new process from existing datasource
            // add new processes into GUI
            const newProcesses = getNewProcesses(json.processes);
            if (!dsCode || newProcesses.length) {
                newProcesses.forEach((proc) => {
                    addDisabledProcToTable(
                        proc.id,
                        proc.name_en,
                        proc.name_jp,
                        proc.name_local,
                        proc.shown_name,
                        proc.data_source.id,
                        proc.table_name,
                        proc.data_source.name,
                        proc.labels, // process label
                    );
                });
                // update trace configs
                $(tracingElements.confirmReloadBtn).trigger('click');
            }
        })
        .catch((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
        });
};

let tmpResource;

// call backend API to save
const saveDataSource = (dsCode, dsConfig, isDirectlyImport = false) => {
    const endPoint = 'api/setting/data_source_save';
    fetch(endPoint, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
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
            currentDSTR.find(`input[name="${itemName}"]`).val(dsConfig.name);
            currentDSTR.find('textarea[name="comment"]').val(dsConfig.comment);
            PollingFrequencyOption.updateOptionsPollingFre(
                currentDSTR,
                dsConfig.type,
                dsConfig.id,
                dsConfig.polling_frequency / 60,
            );
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
            handleChangeSelectToInputForDBType();
        })
        .catch((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
        });
};

const saveV2DataSource = (dsConfig) => {
    const loadingObj = loadingHandler();
    loadingObj.show();
    fetch('api/setting/v2_data_source_save', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dsConfig),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            $('#modal-db-csv').modal('hide');
            displayRegisterMessage('#alert-msg-db', json.flask_message);
            if (json.flask_message.is_error) {
                loadingObj.hide();
                return;
            }
            const dataSources = json.data.map((da) => JSON.parse(da.data_source));
            let index = 0;
            for (const dbs of dataSources) {
                index += 1;
                const itemName = 'name';
                currentDSTR.attr('id', csvResourceElements.dsId + dbs.id);
                currentDSTR.attr(csvResourceElements.dataSrcId, dbs.id);
                dbs.polling_frequency = dbs.polling_frequency == null ? 0 : dbs.polling_frequency;

                // データソース名とコメントの値を設定する。
                currentDSTR.find(`input[name="${itemName}"]`).val(dbs.name);
                currentDSTR.find('textarea[name="comment"]').val(dbs.comment);
                currentDSTR.find('select[name="type"]').val(dbs.type);
                PollingFrequencyOption.updateOptionsPollingFre(
                    currentDSTR,
                    dbs.type,
                    dbs.id,
                    dbs.polling_frequency / 60,
                );

                // change select to input
                handleChangeSelectToInputForDBType();

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
            loadingObj.hide();

            // show v2 process config automatically
            const dbsIds = json.data.map((da) => da.id);
            showAllV2ProcessConfigModal(dbsIds);
        });
};

const showAllV2ProcessConfigModal = (dbsIds, index = 1) => {
    setTimeout(async () => {
        if (index > dbsIds.length) {
            isV2ProcessConfigOpening = false;
            return;
        }
        if (!isV2ProcessConfigOpening) {
            resetIsShowFileName();
            await showV2ProcessConfigModal(dbsIds[index - 1]);
            index++;
        }
        showAllV2ProcessConfigModal(dbsIds, index);
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

const handleCloseProcConfigModal = (ele) => {
    // Use jspreadsheet to handle history inside process column table.
    // Because they have better history operation for excel, they will keep track for us
    // with proper undo + redo operation as well.
    const changedFromProcColumnsTable = spreadsheetProcConfig(procModalElements.procConfigTableName).isHasChange();
    const changedFromFunctionColumnsTable = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER).isHasChange();

    // Still use mutationObserver for outer changes.
    const changedFromMutationObserver =
        typeof inputMutationObserver !== 'undefined' &&
        inputMutationObserver.nodeStatus.filter((node) => node.modifyStatus).length > 0;

    if (changedFromProcColumnsTable || changedFromFunctionColumnsTable || changedFromMutationObserver) {
        $('#modifyConfirmationModal').modal('show');
        return;
    }
    hideAlertMessages();
    $(ele).closest('.modal').modal('hide');

    isV2ProcessConfigOpening = false;
    isClickPreviewMergeMode = false;
    // reset isInitialize: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/443
    isInitialize = false;
    resetIsShowFileName();
    functionConfigResetDefaultValues();
};

const handleCloseDSConfigModal = (ele) => {
    if (typeof inputMutationObserver !== 'undefined') {
        if (inputMutationObserver.nodeStatus.filter((node) => node.modifyStatus).length) {
            $('#modifyConfirmationModal').modal('show');
            return;
        }
        $(ele).closest('.modal').modal('hide');
    }
};

const showV2ProcessConfigModal = async (dbsId = null) => {
    if (!dbsId) return;
    const procRow = addProcToTable({ dbsId: dbsId });
    const btnShowDetail = procRow.find('button.proc-show-detail-btn');
    await showProcSettingModal(btnShowDetail, dbsId);
    isV2ProcessConfigOpening = true;
};

// get csv column infos
const getCsvColumns = () => {
    const columnNames = [];
    const columnTypes = [];
    const orders = [];
    // $(csvResourceElements.dataTypeSelector).each((i, item) => {
    $(csvResourceElements.dataTypePredicted).each((i, item) => {
        const columnName = $(`#col-${i}`).parent().find(csvResourceElements.columnName).text();
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
    if (!validateExistDBName($(dbConfigElements.csvDBSourceName).val()).isOk && !isV2) {
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
    const dbType = getDbType(dbItemId);
    const directory = $(csvResourceElements.folderUrlInput).val();
    // set default skipHead and skipTail
    const skipHead = $(csvResourceElements.skipHead).val() || null;
    const skipTail = $(csvResourceElements.skipTail).val() || null;
    const csvNRows = $(csvResourceElements.csvNRows).val() || null;
    const isFileChecker = $(csvResourceElements.isFileChecker).val().toLowerCase() === 'true';
    const csvIsTranspose = $(csvResourceElements.csvIsTranspose).is(':checked');
    const delimiter = $(csvResourceElements.delimiter).val();
    const optionalFunction = $(csvResourceElements.optionalFunction).val();
    const [columnNames, columnTypes, orders] = getCsvColumns();
    const isDummyHeader = $(csvResourceElements.isDummyHeader).val();
    const isFilePath = $(csvResourceElements.isFilePathHidden).val().toLowerCase() === 'true';

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
        is_file_checker: isFileChecker,
    };

    const dictDataSrc = {
        id: dbItemId,
        name: $('#csvDBSourceName').val(),
        type: dbType,
        comment: $('#csvComment').val(),
        csv_detail: dictCsvDetail,
        ...pollingFrequencyOption.genPollingFrequencyInfo(),
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
    let dataTypes = $(csvResourceElements.dataTypeSelector).find('option:checked');
    dataTypes = dataTypes.toArray().filter((dataType) => Number(dataType.value) === DataTypes.STRING.value);
    if (dataTypes.length > 1) {
        const warningMsg = `${dataTypes.length} ${$('#i18nTooManyString').text()}`;
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
    const hasCTCols = $(csvResourceElements.csvSubmitBtn).attr('data-has-ct') === 'true';
    if (!hasCTCols) {
        return;
    }
    const isV2 = $(csvResourceElements.csvSubmitBtn).attr('data-isV2') === 'true';
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
    const dbType = getDbType(dbItemId);
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
        url: $(`#${dbTypePrefix}_url`).val(),
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

const genWebInfo = () => {
    const dbItemId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dbType = getDbType(dbItemId);
    const domDBPrefix = dbType.toLowerCase();

    // Get DB Information
    const dictDetail = {
        id: dbItemId,
        url: $(`#${domDBPrefix}_url`).val(),
        authentication_type: $(`input[name=${domDBPrefix}_authentication_type]:checked`).val(),
        username: $(`#${domDBPrefix}_username`).val(),
        password: $(`#${domDBPrefix}_password`).val(),
    };

    const dictDataSrc = {
        id: dbItemId,
        name: $(`#${domDBPrefix}_dbsourcename`).val(),
        type: dbType,
        comment: $(`#${domDBPrefix}_comment`).val(),
        web_detail: dictDetail,
    };

    return dictDataSrc;
};

// DBInfoを生成する。
const genDBInfo = () => {
    const dbItemId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dbType = getDbType(dbItemId);
    const domDBPrefix = dbType.toLowerCase();

    // Get DB Information
    let dictDBDetail = {
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

    if ([DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.id, DB_CONFIGS.SNOWFLAKE.id].includes(dbType)) {
        const authTypeName = DB_CONFIGS[dbType].configs.auth_type_el;
        const snowflakeDBDetail = {
            pull_from: $(`#${domDBPrefix}_pull_from`).val() || moment().subtract(30, 'days').format('YYYY-MM-DD'),
            snowflake_role: $(`#${domDBPrefix}_role`).val(),
            snowflake_warehouse: $(`#${domDBPrefix}_warehouse`).val(),
            snowflake_private_key_file: $(`#${domDBPrefix}_private_key_file`).val(),
            snowflake_private_key_file_pwd: $(`#${domDBPrefix}_private_key_file_pwd`).val(),
            snowflake_authentication_type: $(`input[name='${authTypeName}']:checked`).val(),
            snowflake_access_token: $(`#${domDBPrefix}_access_token`).val(),
        };
        dictDBDetail = {
            ...dictDBDetail,
            ...snowflakeDBDetail,
        };
    }
    // Get DB Information

    const dictDataSrc = {
        id: dbItemId,
        name: $(`#${domDBPrefix}_dbsourcename`).val(),
        type: dbType,
        comment: $(`#${domDBPrefix}_comment`).val(),
        db_detail: dictDBDetail,
        ...pollingFrequencyOption.genPollingFrequencyInfo(),
    };

    return dictDataSrc;
};

// change select2 to input element for DB Type
const handleChangeSelectToInputForDBType = () => {
    const $selectDBType = currentDSTR.find('select[name="type"]');
    const $selectDisplayName = $selectDBType.find('option:selected').text();
    const DBTypeValue = $selectDBType.val();
    const $newInputEl = $('<input>', {
        'type': 'text',
        'name': 'type',
        'class': 'form-control',
        'value': $selectDisplayName,
        'data-db-type': DBTypeValue,
        'disabled': true,
    });

    $($selectDBType).replaceWith($newInputEl);
};

// DBInfoの保存を実施する。
const saveDBDataSource = (dataSrcId, dictDataSrc) => {
    // save
    saveDataSource(dataSrcId, dictDataSrc);

    // show toast after save
    $('.modal').modal('hide');
};

const saveDBInfo = () => {
    if (validateDBInfo()) {
        const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
        const dictDataSrc = genDBInfo();
        saveDBDataSource(dataSrcId, dictDataSrc);
    }
};

const saveDBSourceWeb = () => {
    const dictDataSrc = genWebInfo();
    if (validateWebInfor(dictDataSrc)) {
        const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
        saveDBDataSource(dataSrcId, dictDataSrc);
    }
};

const validateWebInfor = (dictDataSrc) => {
    const dbItemId = currentDSTR.attr(csvResourceElements.dataSrcId);
    const dbType = getDbType(dbItemId);
    const domDBPrefix = dbType.toLowerCase();
    const requiredWebDetails = ['username', 'password'];
    const requiredRows = ['name'];
    const errorMsg = {
        name: $('#i18nDbSourceEmpty').text(),
        url: $('#i18nPleaseInputURL').text(),
        username: $('#i18nPleaseInputUsername').text(),
        password: $('#i18nPleaseInputPassword').text(),
    };
    for (const key of requiredRows) {
        if (!dictDataSrc[key]) {
            if (key === 'name') {
                $(`#${domDBPrefix}_dbsourcename`).addClass('column-name-invalid');
            }
            $(`#${domDBPrefix}_${key}`).addClass('column-name-invalid');

            displayRegisterMessage(`#alert-${domDBPrefix}-validation`, {
                message: errorMsg[key],
                is_error: true,
            });
            return false;
        } else {
            if (key === 'name') {
                $(`#${domDBPrefix}_dbsourcename`).removeClass('column-name-invalid');
            }
            $(`#${domDBPrefix}_${key}`).removeClass('column-name-invalid');
        }
    }

    // check url
    if (!dictDataSrc.web_detail.url) {
        $(`#${domDBPrefix}_url`).addClass('column-name-invalid');
        displayRegisterMessage(`#alert-${domDBPrefix}-validation`, {
            message: errorMsg.url,
            is_error: true,
        });
        return false;
    } else {
        $(`#${domDBPrefix}_url`).removeClass('column-name-invalid');
    }

    // データベース名の存在をチェックする。
    if (!validateExistDBName($(`#${domDBPrefix}_dbsourcename`).val()).isOk) {
        displayRegisterMessage(`#alert-${domDBPrefix}-validation`, {
            message: validateExistDBName().message,
            is_error: true,
        });
        return false;
    }

    if (dictDataSrc.web_detail.authentication_type === WEB_AUTH_TYPES.NONE) return true;
    for (const key of requiredWebDetails) {
        if (dictDataSrc.id && key === 'password') continue;
        if (!dictDataSrc.web_detail[key]) {
            $(`#${domDBPrefix}_${key}`).addClass('column-name-invalid');
            displayRegisterMessage(`#alert-${domDBPrefix}-validation`, {
                message: errorMsg[key],
                is_error: true,
            });
            return false;
        } else {
            $(`#${domDBPrefix}_${key}`).removeClass('column-name-invalid');
        }
    }

    return true;
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
            DB.delete(dbItemId, ['host', 'port', 'schema', 'username', 'password']);
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
        Comment: '',
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
                <option value="${DB_CONFIGS.SNOWFLAKE.configs.type}">${DB_CONFIGS.SNOWFLAKE.i18nLabel}</option>
                <option value="${DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.configs.type}">${DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.i18nLabel}</option>
                <option value="${DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type}">${DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.i18nLabel}</option>
                <option value="${DB_CONFIGS.WEB.configs.type}">${DB_CONFIGS.WEB.i18nLabel}</option>
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
        <td>
            ${PollingFrequencyOption.pollingOptionHtml('mainCSV', 3)}
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
    PollingFrequencyOption.handleOnChangeMainPollingFrequency();
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
                    $(`select[name="databaseName"] option[value="${dsCode}"]`).remove();

                    // refresh Vis network
                    reloadTraceConfigFromDB(true);

                    // update datasource
                    cfgDS = $.grep(cfgDS, (e) => String(e.id) !== String(dsCode));
                },
                error: () => {
                    result = null;
                    // disabled OK Button
                    disabledSaveDBBtn();
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

const showMessage = (message) => {
    showToastrMsg(message, MESSAGE_LEVEL.INFO);
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
    const columnName = $(`table[name="latestDataTable"] thead th:eq(${idx})`).find('input')[0];
    const columnInSelectedTable = columnName
        ? $('#processColumnsTable').find(`tr[uid="${columnName.value}"]`)[0]
        : null;

    if (columnInSelectedTable) {
        Object.keys(defaultOptions).forEach((key) => {
            const activeDOM = $(columnInSelectedTable).find(`input[name="${key}"]`);
            activeDOM.prop('checked', defaultOptions[key].checked);

            if (Number(ele.value) === DataTypes.DATETIME.value) {
                activeDOM.prop('disabled', false);
            } else {
                activeDOM.prop('disabled', defaultOptions[key].disabled);
            }
        });
        let operatorOpt = '';
        if (Number(ele.value) === DataTypes.REAL.value || Number(ele.value) === DataTypes.INTEGER.value) {
            operatorOpt = operators[DataTypes.REAL.name];
            const coefNumber = $(columnInSelectedTable).find('input[name="coef"]')[0] || '';
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
        $(columnInSelectedTable).find('select[name="operator"]').append('<option>---</option>');
        $(columnInSelectedTable).find('select[name="operator"]').append(operatorEle);

        // update data type
        $(columnInSelectedTable).find('input[name="columnName"]').attr('data-type', getDataTypeFromID(ele.value));
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

const bindDBItemToModal = (selectedDatabaseType, dictDataSrc) => {
    // set default polling frequency = dictDataSrc.polling_frequency
    pollingFrequencyOption = new PollingFrequencyOption(selectedDatabaseType, dictDataSrc.polling_frequency);
    // Clear message
    clearOldValue();

    let domModalPrefix = selectedDatabaseType?.toLowerCase();

    // show upon db types
    switch (selectedDatabaseType) {
        case DB_CONFIGS.SQLITE.configs.type: {
            if (!dictDataSrc.db_detail) {
                $(`#${domModalPrefix}_dbname`).val('');
                $(`#${domModalPrefix}_dbsourcename`).val('');
                $(`#${domModalPrefix}_comment`).val('');
            } else {
                // load to modal
                $(`#${domModalPrefix}_dbname`).val(dictDataSrc.db_detail.dbname);
                $(`#${domModalPrefix}_dbsourcename`).val(dictDataSrc.name);
                $(`#${domModalPrefix}_comment`).val(dictDataSrc.comment);
            }
            // data observer
            $(`#modal-db-${domModalPrefix} input`).each((i, _ele) => {
                _ele.setAttribute('data-observer', _ele.value);
            });
            break;
        }
        case DB_CONFIGS.V2.configs.type:
        case DB_CONFIGS.CSV.configs.type: {
            // Default selected
            $(csvResourceElements.alertMsgCheckFolder).hide();
            $(csvResourceElements.dataTbl).hide();

            $(`${dbConfigElements.csvModal} #okBtn`).data('itemId', dictDataSrc.id);
            $(`${dbConfigElements.csvModal} #showResources`).data('itemId', dictDataSrc.id);

            // Clear old input data
            $(csvResourceElements.isFilePathHidden).val('');
            $(csvResourceElements.folderUrlInput).val('');
            $(csvResourceElements.folderUrlInput).data('originValue', '');
            $(csvResourceElements.fileName).text('');

            // clear observer of old input:
            $(csvResourceElements.isFilePathHidden).attr('data-observer', '');
            $(csvResourceElements.folderUrlInput).attr('data-observer', '');
            $(csvResourceElements.folderUrlInput).attr('data-observer', '');
            $(csvResourceElements.fileName).attr('data-observer', '');

            if (dictDataSrc.csv_detail) {
                if (dictDataSrc.csv_detail.directory) {
                    $(csvResourceElements.folderUrlInput).val(dictDataSrc.csv_detail.directory);
                    $(csvResourceElements.folderUrlInput).data('originValue', dictDataSrc.csv_detail.directory);

                    // update observer
                    $(csvResourceElements.folderUrlInput).attr('data-observer', dictDataSrc.csv_detail.directory);
                }
                $(csvResourceElements.isFilePathHidden).val(dictDataSrc.csv_detail.is_file_path);
                // update observer
                $(csvResourceElements.isFilePathHidden).attr('data-observer', dictDataSrc.csv_detail.is_file_path);

                // clear dictDataSrc.csv_detail.delimiter
                $(csvResourceElements.csv).attr('data-observer', '');
                $(csvResourceElements.tsv).attr('data-observer', '');
                $(csvResourceElements.smc).attr('data-observer', '');
                $(csvResourceElements.fileTypeAuto).attr('data-observer', '');

                // Update default delimiter radio button by DB_CONFIGS
                if (dictDataSrc.csv_detail.delimiter === 'CSV') {
                    $(csvResourceElements.csv)[0].checked = true;
                    $(csvResourceElements.csv).attr('data-observer', 'true');
                } else if (dictDataSrc.csv_detail.delimiter === 'TSV') {
                    $(csvResourceElements.tsv)[0].checked = true;
                    $(csvResourceElements.tsv).attr('data-observer', 'true');
                } else if (dictDataSrc.csv_detail.delimiter === 'SMC') {
                    $(csvResourceElements.smc)[0].checked = true;
                    $(csvResourceElements.smc).attr('data-observer', 'true');
                } else {
                    $(csvResourceElements.fileTypeAuto)[0].checked = true;
                    $(csvResourceElements.fileTypeAuto).attr('data-observer', 'true');
                }
                // line skipping
                const skipHead = dictDataSrc.csv_detail.skip_head;
                const isDummyHeader = dictDataSrc.csv_detail.dummy_header;
                const lineSkip = skipHead == 0 && !isDummyHeader ? '' : skipHead;
                const isFileChecker = dictDataSrc.csv_detail.is_file_checker;
                $(csvResourceElements.skipHead).val(lineSkip);
                $(csvResourceElements.csvNRows).val(dictDataSrc.csv_detail.n_rows);
                $(csvResourceElements.csvIsTranspose).prop('checked', !!dictDataSrc.csv_detail.is_transpose);
                $(csvResourceElements.isFileChecker).val(isFileChecker);

                // update observer:
                $(csvResourceElements.skipHead).attr('data-observer', lineSkip || '');
                $(csvResourceElements.csvNRows).attr('data-observer', dictDataSrc.csv_detail.n_rows || '');
                $(csvResourceElements.csvIsTranspose).attr('data-observer', !!dictDataSrc.csv_detail.is_transpose);

                // load optional function
                if (dictDataSrc.csv_detail.etl_func) {
                    $(csvResourceElements.optionalFunction)
                        .select2()
                        .val(dictDataSrc.csv_detail.etl_func)
                        .trigger('change');
                    $(dictDataSrc.csv_detail.etl_func).attr('data-observer', dictDataSrc.csv_detail.etl_func);
                }
            }

            // load master name + comment
            $('#csvDBSourceName').val(dictDataSrc.name).attr('data-observer', dictDataSrc.name);
            $('#csvComment').val(dictDataSrc.comment).attr('data-observer', dictDataSrc.comment);

            // for V2 datasource
            $(dbElements.v2ProcessDiv).hide();
            if (DB_CONFIGS.V2.configs.type === selectedDatabaseType) {
                domModalPrefix = 'csv';
                $(dbElements.v2ProcessDiv).show();
                // change title to V2 CSV
                dbElements.CSVTitle.text(dbElements.CSVTitle.text().replace('CSV/TSV', 'V2 CSV'));
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
                $(`#modal-db-${domModalPrefix} .saveDBInfoBtn`).attr('data-isV2', true);
                $(`.saveDBInfoBtn`).attr('data-isV2', true);
                $(csvResourceElements.showResourcesBtnId).attr('data-isV2', true);
            } else {
                // change title to csv / tsv
                dbElements.CSVTitle.text(dbElements.CSVTitle.text().replace('V2 CSV', 'CSV/TSV'));
                // show skip line
                $(csvResourceElements.skipHead).parent().show();
                // show csv nrows
                $(csvResourceElements.csvNRows).parent().show();
                // show transpose
                $(csvResourceElements.csvIsTranspose).parent().show();
            }
            break;
        }
        case DB_CONFIGS.WEB.configs.type:
            $(`#${domModalPrefix}_url`).val(dictDataSrc.web_detail.url);
            $(`#${domModalPrefix}_dbsourcename`).val(dictDataSrc.name);
            $(`#${domModalPrefix}_comment`).val(dictDataSrc.comment);
            $(`input[name=${domModalPrefix}_authentication_type][value=${dictDataSrc.web_detail.authentication_type}]`)
                .prop('checked', true)
                .trigger('change');
            $(`#${domModalPrefix}_password`).attr('placeholder', '');
            if (dictDataSrc.web_detail.authentication_type === WEB_AUTH_TYPES.BASIC && dictDataSrc.id) {
                $(`#${domModalPrefix}_username`).val(dictDataSrc.web_detail.username);
                $(`#${domModalPrefix}_password`).val('');
                $(`#${domModalPrefix}_password`).attr('placeholder', `<${i18nDBCfg.hiddenPlaceholder}>`);
            }
            break;
        default: {
            if (!dictDataSrc.db_detail) {
                break;
            }

            // Todo: Refactor Modal's inputs ID
            $(`#${domModalPrefix}_id`).val(dictDataSrc.id);
            $(`#${domModalPrefix}_dbsourcename`).val(dictDataSrc.name);
            $(`#${domModalPrefix}_comment`).val(dictDataSrc.comment);
            $(`#${domModalPrefix}_host`).val(dictDataSrc.db_detail.host);
            $(`#${domModalPrefix}_port`).val(dictDataSrc.db_detail.port);
            $(`#${domModalPrefix}_dbname`).val(dictDataSrc.db_detail.dbname);
            $(`#${domModalPrefix}_schema`).val(dictDataSrc.db_detail.schema);
            $(`#${domModalPrefix}_username`).val(dictDataSrc.db_detail.username);
            $(`#${domModalPrefix}_password`).val('');
            if (dictDataSrc.id) {
                $(`#${domModalPrefix}_password`).attr('placeholder', `<${i18nDBCfg.hiddenPlaceholder}>`);
            } else {
                $(`#${domModalPrefix}_password`).attr('placeholder', '');
            }
            $(`#${domModalPrefix}_use_os_timezone`).val(dictDataSrc.db_detail.use_os_timezone);
            if ([DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.id, DB_CONFIGS.SNOWFLAKE.id].includes(selectedDatabaseType)) {
                const pullFromValue =
                    dictDataSrc.db_detail && dictDataSrc.db_detail.pull_from
                        ? moment(dictDataSrc.db_detail.pull_from, 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ').format('YYYY-MM-DD')
                        : moment().subtract(30, 'days').format('YYYY-MM-DD');

                $(`#${domModalPrefix}_pull_from`).val(pullFromValue);
                $(`#${domModalPrefix}_role`).val(dictDataSrc.db_detail.snowflake_role);
                $(`#${domModalPrefix}_warehouse`).val(dictDataSrc.db_detail.snowflake_warehouse);
                $(`#${domModalPrefix}_private_key_file`).val(dictDataSrc.db_detail.snowflake_private_key_file);
                $(`#${domModalPrefix}_private_key_file_pwd`).val('');
                $(`#${domModalPrefix}_access_token`).val('');
                initializeDateTimePicker('snowflake_pull_from');
                initializeDateTimePicker('snowflake_software_workshop_pull_from');
                const authTypeName = DB_CONFIGS[selectedDatabaseType].configs.auth_type_el;
                if (dictDataSrc.id) {
                    const authTypeRadio = $(
                        `input[name='${authTypeName}'][value=${dictDataSrc.db_detail.snowflake_authentication_type}]`,
                    );
                    authTypeRadio.prop('checked', true).trigger('change');
                    $(`#${domModalPrefix}_access_token`).attr('placeholder', `<${i18nDBCfg.hiddenPlaceholder}>`);
                    $(`#${domModalPrefix}_private_key_file`).attr('placeholder', `<${i18nDBCfg.hiddenPlaceholder}>`);
                    $(`#${domModalPrefix}_private_key_file_pwd`).attr(
                        'placeholder',
                        `<${i18nDBCfg.hiddenPlaceholder}>`,
                    );
                } else {
                    $(`input[name='${authTypeName}'][value=${SNOWFLAKE_AUTH_TYPES.ACCESS_TOKEN}]`)
                        .prop('checked', true)
                        .trigger('change');
                    $(`#${domModalPrefix}_access_token`).attr('placeholder', '');
                    $(`#${domModalPrefix}_private_key_file`).attr('placeholder', '');
                    $(`#${domModalPrefix}_private_key_file_pwd`).attr('placeholder', '');
                }
            }
            $(eles.useOSTZOption).prop('checked', dictDataSrc.db_detail.use_os_timezone);
            $(eles.useOSTZOption).data('previous-value', dictDataSrc.db_detail.use_os_timezone);

            const dsType = dictDataSrc.type || dictDataSrc.db_detail.type || '';
            $(eles.useOSTZConfirmBtn).data('dbType', dsType.toLowerCase());

            // data observer
            $(`#modal-db-${domModalPrefix} input`).each((i, _ele) => {
                _ele.setAttribute('data-observer', _ele.value);
            });

            break;
        }
    }

    //  TODO: refactor modal ID
    $(`#modal-db-${domModalPrefix} input`).data('itemId', dictDataSrc.id);
    $(`#modal-db-${domModalPrefix} select`).data('itemId', dictDataSrc.id);
    $(`#modal-db-${domModalPrefix} .saveDBInfoBtn`).data('itemId', dictDataSrc.id);
    $(`#modal-db-${domModalPrefix} .saveDBInfoBtn`).data('dbType', dictDataSrc.type);
    $(`#modal-db-${domModalPrefix}`).modal('show');
    addAttributeToElement();

    // add observer for ds modal
    inputMutationObserver = new InputChangeObserver(document.getElementById(`modal-db-${domModalPrefix}`));
    inputMutationObserver.startObserving();
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
    let db_id = null;
    const db_id_val = $(`#modal-db-${dbType} input[name="${dbType}_id"]`).val();
    if (db_id_val) db_id = parseInt(db_id_val);
    Object.assign(data.db, {
        id: db_id,
        host: $(`#modal-db-${dbType} input[name="${dbType}_host"]`).val(),
        port: $(`#modal-db-${dbType} input[name="${dbType}_port"]`).val(),
        schema: $(`#modal-db-${dbType} input[name="${dbType}_schema"]`).val(),
        username: $(`#modal-db-${dbType} input[name="${dbType}_username"]`).val(),
        password: $(`#modal-db-${dbType} input[name="${dbType}_password"]`).val(),
        dbname: dbName,
        db_type: dbType,
    });

    const isSnowFlake = [
        DB_CONFIGS.SNOWFLAKE.configs.type.toLowerCase(),
        DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type.toLowerCase(),
    ].includes(dbType);
    if (isSnowFlake) {
        const authTypeElName = DB_CONFIGS[dbType.toUpperCase()].configs.auth_type_el;
        Object.assign(data.db, {
            snowflake_role: $(`#modal-db-${dbType} input[name="${dbType}_role"]`).val(),
            snowflake_warehouse: $(`#modal-db-${dbType} input[name="${dbType}_warehouse"]`).val(),
            snowflake_private_key_file: $(`#modal-db-${dbType} input[name="${dbType}_private_key_file"]`).val(),
            snowflake_private_key_file_pwd: $(`#modal-db-${dbType} input[name="${dbType}_private_key_file_pwd"]`).val(),
            snowflake_authentication_type: $(`input[name='${authTypeElName}']:checked`).val(),
            snowflake_access_token: $(`#modal-db-${dbType} input[name="${dbType}_access_token"]`).val(),
        });
    }

    let apiEndPoint = 'api/setting/check_db_connection';
    if (dbType === DB_CONFIGS.WEB.configs.type.toLowerCase()) {
        apiEndPoint = 'api/setting/check_web_connection';
    }

    const requestData = dbType === DB_CONFIGS.WEB.configs.type.toLowerCase() ? genWebInfo().web_detail : data;

    fetch(apiEndPoint, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
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
    const dsType = getDbType(dataSrcId);
    dbElements.lineGroupContainer.css('display', 'none');
    dbElements.sfLineGroupContainer.css('display', 'none');
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
            case DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    db_detail: DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.configs,
                };
                break;
            }
            case DB_CONFIGS.SNOWFLAKE.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    master_type: DB_CONFIGS.SNOWFLAKE.master_type,
                    db_detail: DB_CONFIGS.SNOWFLAKE.configs,
                };
                break;
            }
            case DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    master_type: DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.master_type,
                    db_detail: DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs,
                };
                break;
            }
            case DB_CONFIGS.WEB.configs.type: {
                jsonDictDataSrc = {
                    id: null,
                    comment: '',
                    web_detail: DB_CONFIGS.WEB.configs,
                };
                break;
            }
        }
        bindDBItemToModal(dsType, jsonDictDataSrc);
    } else {
        const url = new URL(`${csvResourceElements.apiLoadDetail}/${dataSrcId}`, window.location.href).href;
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        })
            .then((response) => response.clone().json())
            .then((json) => {
                if (json) {
                    bindDBItemToModal(dsType, json);
                    showResources();
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
    return [...$(`input[name=${name}]:checked`).map((i, el) => $(el).val())].filter((val) => val !== 'All');
};

const getV2ProcessData = (dictDataSrc) => {
    const v2Datasources = [];
    const v2SelectedProcess = getCheckedV2Processes();
    if (v2SelectedProcess.length) {
        v2SelectedProcess.forEach((processName) => {
            const subDatasourceByProcess = JSON.parse(JSON.stringify(dictDataSrc));
            const suffix = processName === DUMMY_V2_PROCESS_NAME ? '' : `_${processName}`;
            // #825: We do not need to add suffix when the datasource already exists
            if (!subDatasourceByProcess.id) {
                subDatasourceByProcess.name = `${subDatasourceByProcess.name}${suffix}`;
            }
            subDatasourceByProcess.csv_detail.process_name = processName;
            subDatasourceByProcess.csv_detail.auto_link = false;
            v2Datasources.push(subDatasourceByProcess);
        });
    }
    return v2Datasources;
};

// disabled OK Button when error happening
const disabledSaveDBBtn = () => {
    $(csvResourceElements.csvSubmitBtn).attr('data-has-ct', 'false');
    $(csvResourceElements.csvSubmitBtn).removeClass(' btn-primary').addClass('btn saveDBInfoBtn btn-secondary');
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
        const originFolderUrl = $(csvResourceElements.folderUrlInput).data('originValue');
        checkFolderResources(folderUrl, originFolderUrl).then(() => {});
    });
    $(csvResourceElements.showResourcesBtnId).on('click', () => {
        $('#resourceLoading').show();
        const isFile = $(csvResourceElements.showResourcesBtnId).data('is_file');
        const isValidFolder = $(csvResourceElements.showResourcesBtnId).data('is_valid_folder');
        showResources(isFile, isValidFolder);
        $(csvResourceElements.showResourcesBtnId).removeData('is_file');
        $(csvResourceElements.showResourcesBtnId).removeData('is_valid_folder');
    });

    $(csvResourceElements.csvConfirmRegister).on('click', (e) => {
        saveCSVDataSource().then(() => {});
    });

    // add an empty db row if there is no db config
    setTimeout(() => {
        const countDataSource = $(`${dbElements.tblDbConfigID} tbody tr[name=db-info]`).length;
        if (!countDataSource) {
            addDBConfigRow();
        }
    }, 500);
    $(dbElements.divDbConfig)[0].addEventListener('mouseup', handleMouseUp, false);

    $(dbConfigElements.csvDBSourceName).on('mouseup', () => {
        userEditedDSName = true;
    });
    [
        $(dbConfigElements.sqliteDbSource),
        $(dbConfigElements.snowflakePrivateKeyFileInput),
        $(dbConfigElements.snowflakeSWPrivateKeyFileInput),
    ].forEach((el) => {
        el.on('change', (el) => trimQuotesSpacesAndUpdate(el.target));
    });

    let debounceTimer;
    $(csvResourceElements.folderUrlId).on('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // hide elert message, preview table and ds name when the input is empty
            if ($(csvResourceElements.folderUrlInput).val().length === 0) {
                $(csvResourceElements.alertMsgCheckFolder).hide();
                $(csvResourceElements.dataTbl).hide();
                $(dbConfigElements.csvDBSourceName).val('');
                return;
            }

            trimQuotesSpacesAndUpdate(e.target);
            const fileName = e.target.value;
            const dbsName = $(dbConfigElements.csvDBSourceName).val();
            const existingDSID = $(dbConfigElements.csvDBSourceName).data('itemId');
            if (!existingDSID && (!userEditedDSName || !dbsName)) {
                const fullPath = fileName.replace(/\\/g, '//');
                const lastFolderName = fullPath.match(/([^/]*)\/*$/)[1];
                // autogen datasource name by latest folder name
                $(dbConfigElements.csvDBSourceName).val(lastFolderName);
            }
            // handle show data when enter a path to the input in Data Source Config
            $(csvResourceElements.connectResourceBtn).trigger('click');
            // $(csvResourceElements.showResourcesBtnId).trigger('click');
        }, 300); // delay input 300ms
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

    $('#btnCancelPollingFrequency').on('click', () => {
        pollingFrequencyOption.handleClickCancelPollingFrequency();
    });

    PollingFrequencyOption.handleOnChangeMainPollingFrequency();

    // searchDataSource
    onSearchTableContent('searchDataSource', 'tblDbConfig');
    onSearchTableContent('searchProcConfig', 'tblProcConfig');
    sortableTable('tblDbConfig', [0, 1, 2, 4, 5], 510, true);
    sortableTable('tblProcConfig', [0, 1, 2, 3, 5, 6], 510, true);
});

const getDbType = (dbItemId) => {
    if (typeof dbItemId !== 'undefined') {
        return currentDSTR.find('input[name=type]').attr('data-db-type');
    }
    // new data source
    return currentDSTR.find('select[name="type"]').val();
};

const previewSoftwareWorkshop = (dbType, html, msgID) => {
    // reset connection status text
    $(`#${msgID}`).html('');
    $(`#${msgID}`).addClass('spinner-grow');
    $(`#${msgID}`).removeClass('text-danger');
    $(`#${msgID}`).removeClass('text-success');

    // get form data
    const data = {
        db: {},
    };

    let db_id = null;
    const db_id_val = $(`#modal-db-${dbType} input[name="${dbType}_id"]`).val();
    if (db_id_val) db_id = parseInt(db_id_val);
    Object.assign(data.db, {
        id: db_id,
        host: $(`#modal-db-${dbType} input[name="${dbType}_host"]`).val(),
        port: $(`#modal-db-${dbType} input[name="${dbType}_port"]`).val(),
        schema: $(`#modal-db-${dbType} input[name="${dbType}_schema"]`).val(),
        username: $(`#modal-db-${dbType} input[name="${dbType}_username"]`).val(),
        password: $(`#modal-db-${dbType} input[name="${dbType}_password"]`).val(),
        dbname: $(`#modal-db-${dbType} input[name="${dbType}_dbname"]`).val(),
        db_type: dbType,
    });

    const isSnowFlake = [
        DB_CONFIGS.SNOWFLAKE.configs.type.toLowerCase(),
        DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type.toLowerCase(),
    ].includes(dbType);
    if (isSnowFlake) {
        const authTypeElName = DB_CONFIGS[dbType.toUpperCase()].configs.auth_type_el;
        Object.assign(data.db, {
            snowflake_role: $(`#modal-db-${dbType} input[name="${dbType}_role"]`).val(),
            snowflake_warehouse: $(`#modal-db-${dbType} input[name="${dbType}_warehouse"]`).val(),
            snowflake_private_key_file: $(`#modal-db-${dbType} input[name="${dbType}_private_key_file"]`).val(),
            snowflake_private_key_file_pwd: $(`#modal-db-${dbType} input[name="${dbType}_private_key_file_pwd"]`).val(),
            snowflake_authentication_type: $(`input[name='${authTypeElName}']:checked`).val(),
            snowflake_access_token: $(`#modal-db-${dbType} input[name="${dbType}_access_token"]`).val(),
        });
    }
    const $lineGroupContainer = !isSnowFlake ? dbElements.lineGroupContainer : dbElements.sfLineGroupContainer;
    const $lineGrpSelect = !isSnowFlake ? dbElements.lineGrpSelect : dbElements.sfLineGrpSelect;

    fetch('api/setting/preview_software_workshop', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            $lineGroupContainer.css('display', json.flask_message.connected ? '' : 'none');
            displayTestDBConnectionMessage(msgID, json.flask_message);
            line_grp_infos = json.db_info.line_group_infos;
            fillLineGroupIdSelect(json.db_info, $lineGrpSelect, isSnowFlake);
            document.getElementById('groupTable').replaceChildren();
            $lineGrpSelect.val(0).trigger('change'); // Select first line_group
        });
};

const fillLineGroupIdSelect = (data, lineGrpSelect, isSnowFlake) => {
    //  clear line group data first
    $(lineGrpSelect).empty();
    data.line_groups.forEach(function (line_grp, index) {
        const option_attribute = {
            value: index,
            text: line_grp,
        };
        lineGrpSelect.append($('<option/>', option_attribute));
    });
    $(lineGrpSelect).on('change', (e) => {
        // Khanh commented: Cái này là sao nhỉ? khó hiểu quá.
        // todo: confirm with Tuyen
        const processes = data.processes;
        let lineGroupInfos = data.line_group_infos[parseInt(e.currentTarget.value)].map((lineGroup) => {
            const mappedProc = processes.filter((proc) => {
                return proc.master_type === lineGroup.master_type && proc.process_factid === lineGroup.child_equip_id;
            });
            return {
                ...lineGroup,
                process_id: mappedProc.length && mappedProc[0].id,
            };
        });
        createGroupTable(lineGroupInfos, isSnowFlake);
    });
};

const fillChildEquipSelect = (line_grp_id) => {
    return;
};

const initChildEquipTableEvents = () => {
    $(dbElements.softwareWorkshopCheckAll).on('change', (e) => {
        $(dbElements.softwareWorkshopCheckItem).prop('checked', e.target.checked);
    });

    $(dbElements.softwareWorkshopCheckItem).on('change', (e) => {
        const lengthCheckedItems = $(`${dbElements.softwareWorkshopCheckItem}:checked`).length;
        const lengthItems = $(dbElements.softwareWorkshopCheckItem).length;
        $(dbElements.softwareWorkshopCheckAll).prop('checked', lengthCheckedItems === lengthItems);
    });

    $(dbElements.softwareWorkshopSearchSetBtn).on('click', (e) => {
        $(`#${dbElements.softwareWorkshopPreviewTbl}`)
            .find('tbody tr:visible:not(.gray) input[type=checkbox]')
            .prop('checked', true)
            .trigger('change');
    });

    $(dbElements.softwareWorkshopSearchResetBtn).on('click', (e) => {
        $(`#${dbElements.softwareWorkshopPreviewTbl}`)
            .find('tbody tr:visible:not(.gray) input[type=checkbox]')
            .prop('checked', false)
            .trigger('change');
    });
    onSearchTableContentByKeypressInput(dbElements.softwareWorkshopInputSearch, dbElements.softwareWorkshopPreviewTbl);
};

const showSoftwareWorkshopConfirmationModal = () => {
    $(dbElements.confirmSaveSoftwareWorkshopProcesses).modal('show');
};

const bulkImportSoftwareWorkshop = () => {
    if (validateDBInfo()) {
        // call SW Register
        const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
        const dictDataSrc = genDBInfo();

        // save SW with bulk import
        saveSWDatasource(dataSrcId, dictDataSrc, true);

        // show toast after save
        $('.modal').modal('hide');
    }
};

const bulkRegisterSoftwareWorkshop = () => {
    if (validateDBInfo()) {
        // call SW Register
        const dataSrcId = currentDSTR.attr(csvResourceElements.dataSrcId);
        const dictDataSrc = genDBInfo();

        // save SW without import
        saveSWDatasource(dataSrcId, dictDataSrc);

        // show toast after save
        $('.modal').modal('hide');
    }
};

const switchAuthTypeDisplay = (e, dbType = DB_CONFIGS.SNOWFLAKE.configs.type) => {
    const selectedAuthMode = e.value;
    switch (selectedAuthMode) {
        case SNOWFLAKE_AUTH_TYPES.ACCESS_TOKEN:
            $(dbElements.snowflakeInputAreaAccessToken[dbType]).css('display', 'block');
            $(dbElements.snowflakeInputAreaPrivateKeyFile[dbType]).css('display', 'none');
            break;
        case SNOWFLAKE_AUTH_TYPES.KEYPAIR:
            $(dbElements.snowflakeInputAreaPrivateKeyFile[dbType]).css('display', 'flex');
            $(dbElements.snowflakeInputAreaAccessToken[dbType]).css('display', 'none');
            break;
        default:
            $(dbElements.snowflakeInputAreaAccessToken[dbType]).css('display', 'block');
            $(dbElements.snowflakeInputAreaPrivateKeyFile[dbType]).css('display', 'none');
            break;
    }
};

const switchAuthTypeForWebAPI = (e) => {
    if (e.value == WEB_AUTH_TYPES.BASIC) {
        $('#webAuthInputArea').find('input').attr('disabled', false);
    } else {
        $('#webAuthInputArea').find('input').attr('disabled', true);
        $('#webAuthInputArea').find('input').val('');
    }
};
