/**
 * @file Contains all constant that serve for data type dropdown.
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 * @author Tran Nguyen Duc Huy <huytnd1@fpt.com>
 * @author Tran Ngoc Tinh <tinhtn@fpt.com>
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 */

const registerFromFileEles = {
    folderBrowser: '#folderBrowser',
    fileBrowser: '#fileBrowser',
    directoryRadios: 'input[name=directorySelector]',
    fileBrowseButton: '#browseFileBtn',
    containerReferenceFile: '#containerReferenceFile',
    confirmRegisterByFile: '#confirmRegisterByFile',
    registerAllFilesButton: '#register-all-file',
    registerOneFileButton: '#register-one-file',
    folderUrl: $('input[name=folderUrl]'),
    refFileUrl: $('input[name=fileName]'),
    progressDisplay: '#progressDisplay',
    registerButton: '#registerDataSourceProcBtn',
    databaseName: $('input[name=databaseName]'),
    processEnName: $('input[name=processName]'),
    processJapaneseName: $('input[name=processJapaneseName]'),
    processLocalName: $('input[name=processLocalName]'),
    processOriginName: $('input[name=processOriginName]'),
};

// override from db_config.js to use generateProcessList function from proc_config_modal.js todo move to common js file
let dicProcessCols = {};

const i18n = {
    statusDone: $('#i18nStatusDone').text(),
    statusImporting: $('#i18nStatusImporting').text(),
    statusFailed: $('#i18nStatusFailed').text(),
    statusPending: $('#i18nStatusPending').text(),
    validLike: $('#i18nValidLike').text(),
    reachFailLimit: $('#i18nReachFailLimit').text(),
    noCTCol: $('#i18nNoCTCol').text(),
    noCTColProc: $('#i18nNoCTColPrc').text(),
    processName: document.getElementById('i18nProcessName_').textContent,
    dataType: document.getElementById('i18ni18nDataType').textContent,
    systemNameHoverMsg: document.getElementById('i18nSystemNameHoverMsg')
        .textContent,
    japaneseName: document.getElementById('i18nJapaneseName').textContent,
    localName: document.getElementById('i18nLocalName').textContent,
    unit: $('#i18nUnit').text(),
    alreadyRegistered: document.getElementById('i18nAlreadyRegistered')
        .textContent,
    columnRawName: document.getElementById('i18nColumnRawName').textContent,
    format: document.getElementById('i18nFormat').textContent,
    sampleData: document.getElementById('i18nSampleData').textContent,
    operatorHover: document.getElementById('i18nOperatorHover').textContent,
    operator: document.getElementById('i18nOperator').textContent,
    coefHover: document.getElementById('i18nCoefHover').textContent,
    coef: document.getElementById('i18nCoef').textContent,
};

const registerI18n = {
    i18nFileIsSelected: $('#i18nFileIsSelected').text(),
    i18nProgressSourceSelected: $('#i18nProgressSourceSelected').text(),
    i18nDbSourceExist: $('#i18nDbSourceExist').text(),
    i18nProcessNameIsAlreadyRegistered: $(
        '#i18nProcessNameIsAlreadyRegistered',
    ).text(),
    i18nDataSourceNameIsAlreadyRegistered: $(
        '#i18nDataSourceNameIsAlreadyRegistered',
    ).text(),
    i18nProcessRegisterStart: $('#i18nProcessRegisterStart').text(),
    i18nProgressFolderCheck: $('#i18nProgressFolderCheck').text(),
    i18nProgressImportingData: $('#i18nProgressImportingData').text(),
    i18nProgressFinished: $('#i18nProgressFinished').text(),
    i18nDataSourceNameIsEmpty: $('#i18nDataSourceNameIsEmpty').text(),
    i18nProcessNameIsEmpty: $('#i18nProcessNameIsEmpty').text(),
    i18nProgressGenDataTable: 'Generate Data Table',
    i18nProgressScanFile: 'Scan File',
    i18nProgressScanMaster: 'Scan Master',
    i18nProgressScanDataType: 'Scan Data Type',
    i18nProgressPullData: 'Pull CSV Data',
    i18nErrorNoGetdate: $('#i18nErrorNoGetdate').text(),
    i18nScanning: 'Scanning',
};

const registerSteps = {
    IMPORTING: 'importing',
    SCANNING: 'SCANNING',
};

const ICON_STATUS = {
    SUCCESS: 'success',
    PROCESSING: 'processing',
    WARNING: 'warning',
};

const REGISTER_JOB_STATUS = {
    DONE: 'DONE',
    FAILED: 'FAILED',
    PROCESSING: 'PROCESSING',
};

const isAddNewMode = () => true;
// override end

$(registerFromFileEles.directoryRadios).on('change', (e) => {
    const self = $(e.currentTarget);
    const value = self[0].value;
    if (value === 'folder') {
        $(registerFromFileEles.fileBrowser).hide();
        $(registerFromFileEles.folderBrowser).show();
    } else if (value === 'file') {
        $(registerFromFileEles.folderBrowser).hide();
        $(registerFromFileEles.fileBrowser).show();
    }
});

/**
 * Validate input data source URL and file
 * @return {Promise<boolean>} - true: valid, false: invalid
 */
async function validateInputUrlAndFile() {
    // remove add red border
    [registerFromFileEles.folderUrl, registerFromFileEles.refFileUrl].forEach(
        (el) => {
            removeBorderFromInvalidInput(el);
        },
    );

    const urlInfo = await getUrlInfo();

    resetProgressBar();
    if (!urlInfo.url) {
        disableRegisterDataFileBtn();
        resetPreviewTableContent();
        clearCacheDatasourceConfig();
        showHideRefFile(false);
        return false;
    }

    const checkResult = await checkFolder(
        urlInfo.isFile ? urlInfo.fileUrl : urlInfo.url,
        urlInfo.isFile,
    );

    if (!checkResult.is_valid || !checkResult.is_valid_file) {
        // show error msg to the right side
        addMessengerToProgressBar(checkResult.err_msg, ICON_STATUS.WARNING);
        addBorderToInvalidInput($(registerFromFileEles.folderUrl));
        disableRegisterDataFileBtn();
        resetPreviewTableContent();
        return false;
    }

    if (!urlInfo.isFile && urlInfo.fileUrl) {
        // check selected filename
        const checkFileName = await checkFolder(urlInfo.fileUrl, true);

        if (!checkFileName.is_valid || !checkFileName.is_valid_file) {
            // show error msg to the right side
            addMessengerToProgressBar(
                checkFileName.err_msg,
                ICON_STATUS.WARNING,
            );
            addBorderToInvalidInput($(registerFromFileEles.refFileUrl));
            disableRegisterDataFileBtn();
            resetPreviewTableContent();
            return false;
        }
    }

    return true;
}

/**
 * Handle Url | File Url changes
 * @param {boolean} isVerifyUrl - true: will do check url is file or not, false: do not check
 * @return {Promise<void>}
 */
const handleOnChangeFolderAndFileUrl = async (isVerifyUrl) => {
    // remove add red border
    [registerFromFileEles.folderUrl, registerFromFileEles.refFileUrl].forEach(
        (el) => {
            removeQuotesfromInputAndUpdate(el);
            removeLastBackslashFromInputAndUpdate(el);
        },
    );
    hiddenPreviewContentData();
    removeExtendSections();

    if (isVerifyUrl) {
        const url = $(registerFromFileEles.folderUrl).val().trim();
        const folderOrFileInfo = await checkFolderOrFile(url);
        // Show modal confirm import one data file of all files in the same folder
        if (folderOrFileInfo.isFile) {
            $(registerFromFileEles.registerAllFilesButton).data('url', url);
            $(registerFromFileEles.confirmRegisterByFile).modal('show');
            return;
        } else {
            showHideRefFile(true);
        }
    }

    const isValid = await validateInputUrlAndFile();
    if (!isValid) return;

    // show ✔  ファイルが選択されました msg
    addMessengerToProgressBar(registerI18n.i18nProgressSourceSelected);

    // call api to collect latest records'
    const urlInfo = await getUrlInfo();
    const formData = new FormData();
    if (urlInfo.isFile) {
        formData.set('fileName', urlInfo.fileUrl);
    } else {
        formData.set('folder', urlInfo.url);
        formData.set('fileName', urlInfo.fileUrl);
    }
    const request = getLatestRecord(formData);

    await handleResponseData(request);

    enableRegisterDataFileBtn();
};

const fillDatasourceName = (url, isFile) => {
    checkOnFocus = false;
    const folderName = getDbSourceAndProcessNameFromUrl(url, isFile);
    // loading from external api
    const params = getRequestParams();
    if (params.loadGUIFromUrl) {
        // fill datasource and proc name fields if not provided
        if (!params.dataSourceName) {
            registerFromFileEles.databaseName.val(folderName);
            registerFromFileEles.databaseName[0].dataset.originalValue =
                folderName;
        }
        return;
    }

    registerFromFileEles.databaseName.val(folderName);
    registerFromFileEles.databaseName[0].dataset.originalValue = folderName;
};

const fillProcessName = (url, isFile) => {
    checkOnFocus = false;
    const folderName = getDbSourceAndProcessNameFromUrl(url, isFile);
    registerFromFileEles.processOriginName.val(folderName);
    registerFromFileEles.processEnName[0].dataset.originalValue = folderName;
    registerFromFileEles.processEnName.val(folderName).trigger('change');

    // loading from external api
    const params = getRequestParams();
    if (params.loadGUIFromUrl) {
        // fill proc name fields if not provided
        if (isJPLocale && !params.procesNameJp) {
            registerFromFileEles.processJapaneseName[0].dataset.originalValue =
                folderName;
            registerFromFileEles.processJapaneseName
                .val(folderName)
                .trigger('change');
        } else if (!isJPLocale && !params.processNameLocal) {
            registerFromFileEles.processLocalName[0].dataset.originalValue =
                folderName;
            registerFromFileEles.processLocalName
                .val(folderName)
                .trigger('change');
        }
        return;
    }

    // fill data source name
    if (isJPLocale) {
        registerFromFileEles.processJapaneseName[0].dataset.originalValue =
            folderName;
        registerFromFileEles.processJapaneseName
            .val(folderName)
            .trigger('change');
    } else {
        registerFromFileEles.processLocalName[0].dataset.originalValue =
            folderName;
        registerFromFileEles.processLocalName.val(folderName).trigger('change');
    }
};

/**
 * Check data source name is empty or not
 * @return {boolean} - true: datasource name is empty, otherwise.
 */
function isDataSourceNameEmpty() {
    removeBorderFromInvalidInput(registerFromFileEles.databaseName);
    const isEmpty = registerFromFileEles.databaseName.val().trim() === '';
    if (isEmpty) {
        addMessengerToProgressBar(
            registerI18n.i18nDataSourceNameIsEmpty,
            ICON_STATUS.WARNING,
        );
        addBorderToInvalidInput(registerFromFileEles.databaseName);
    }

    return isEmpty;
}

/**
 * Check all process names are empty or not
 * @return {boolean} - true: at least one process name is empty, false: all process names are not empty
 */
function isProcessNameEmpty() {
    let isEmpty = false;
    document
        .querySelectorAll(
            'div[id^="procSettingModal"] form[id^="procCfgForm"] input[name="processName"]',
        )
        .forEach((processNameElement) => {
            const $processNameElement = $(processNameElement);
            removeBorderFromInvalidInput($processNameElement);
            if (processNameElement.value.trim() === '') {
                isEmpty = true;
                addBorderToInvalidInput($processNameElement);
            }
        });

    if (isEmpty) {
        addMessengerToProgressBar(
            registerI18n.i18nProcessNameIsEmpty,
            ICON_STATUS.WARNING,
        );
    }

    return isEmpty;
}

/**
 * Check Data Source Name is duplicated with exist ones in DB or not
 * @return {Promise<boolean>} - true: duplicate with exist data source name in DB, false: unique (not duplicate)
 */
async function isDataSourceNameDuplicate() {
    removeBorderFromInvalidInput(registerFromFileEles.databaseName);
    const dbsName = registerFromFileEles.databaseName.val();

    let isDuplicate = false;
    const isDuplicatedDbsName = await checkDuplicatedDataSourceName(dbsName);
    if (isDuplicatedDbsName) {
        isDuplicate = true;
        // show duplicated dbs msg
        addMessengerToProgressBar(
            registerI18n.i18nDataSourceNameIsAlreadyRegistered,
            ICON_STATUS.WARNING,
        );
        addBorderToInvalidInput(registerFromFileEles.databaseName);
    }

    return isDuplicate;
}

/**
 * Check Process Names is duplicated with exist ones in DB and each others or not
 * @return {Promise<boolean>} - true: duplicate, false: not duplicate
 */
async function isProcessNameDuplicate() {
    const processSystemNameElements = document.querySelectorAll(
        'input[name="processName"]',
    );
    const processJapaneseNameElements = document.querySelectorAll(
        'input[name="processJapaneseName"]',
    );
    const processLocalNameElements = document.querySelectorAll(
        'input[name="processLocalName"]',
    );

    [
        ...processSystemNameElements,
        ...processJapaneseNameElements,
        ...processLocalNameElements,
    ].forEach((el) => {
        removeBorderFromInvalidInput($(el));
    });

    let isDuplicate = false;
    // Check duplicate with exist processes in Database
    for (let i = 0; i < processSystemNameElements.length; i++) {
        const processSystemNameElement = processSystemNameElements[i];
        const processJapaneseNameElement = processJapaneseNameElements[i];
        const processLocalNameElement = processLocalNameElements[i];
        const [
            isDuplicatedNameSystem,
            isDuplicatedNameJapanese,
            isDuplicatedNameLocal,
        ] = await checkDuplicatedProcessName(
            processSystemNameElement.value,
            processJapaneseNameElement.value,
            processLocalNameElement.value,
        );
        if (
            isDuplicatedNameSystem ||
            isDuplicatedNameJapanese ||
            isDuplicatedNameLocal
        ) {
            isDuplicate = true;
            if (isDuplicatedNameSystem) {
                addBorderToInvalidInput($(processSystemNameElement));
            }
            if (isDuplicatedNameJapanese) {
                addBorderToInvalidInput($(processJapaneseNameElement));
            }
            if (isDuplicatedNameLocal) {
                addBorderToInvalidInput($(processLocalNameElement));
            }
        }
    }

    // Check duplicate each others
    [
        processSystemNameElements,
        processJapaneseNameElements,
        processLocalNameElements,
    ].forEach((nameElements) => {
        const existNames = [];
        nameElements.forEach((nameElement) => {
            if (nameElement.value === '' || nameElement.value == null) {
                // No check for empty name
                return true;
            }

            if (existNames.includes(nameElement.value)) {
                isDuplicate = true;
                addBorderToInvalidInput($(nameElement));
            } else {
                existNames.push(nameElement.value);
            }

            return true;
        });
    });

    if (isDuplicate) {
        // show duplicated process msg
        addMessengerToProgressBar(
            registerI18n.i18nProcessNameIsAlreadyRegistered,
            ICON_STATUS.WARNING,
        );
    }

    return isDuplicate;
}

/**
 * Add Red Border To Target Input
 * @param {jQuery} inputEl - an input jQuery object
 */
const addBorderToInvalidInput = (inputEl) => {
    inputEl.addClass('column-name-invalid');
};

/**
 * Remove Red Border To Target Input
 * @param {jQuery} inputEl - an input jQuery object
 */
const removeBorderFromInvalidInput = (inputEl) => {
    inputEl.removeClass('column-name-invalid');
};

/**
 * Check folder Url  Info
 * @param {string} folderUrl - a folder path
 * @param {boolean} isFile - is file or not
 * @return {Promise<{
 *    status: number,
 *    url: string,
 *    is_exists: boolean,
 *    dir: string,
 *    not_empty_dir: boolean,
 *    is_valid: boolean,
 *    err_msg: string,
 *    is_valid_file: boolean,
 * }>}
 */
const checkFolder = async (folderUrl, isFile) => {
    const data = {
        url: folderUrl,
        isFile: isFile,
    };
    return await fetchData(
        '/ap/api/setting/check_folder',
        JSON.stringify(data),
        'POST',
    );
};

/**
 * Get latest record
 * @param data
 * @return {Promise<LatestRecordOfProcess>} - an object that contains all information of data source and process config
 */
const getLatestRecord = (data) =>
    new Promise((resolve, reject) => {
        try {
            const option = {
                url: '/ap/api/setting/show_latest_records_for_register_by_file',
                data: data,
                dataType: 'json',
                type: 'POST',
                contentType: false,
                processData: false,
                cache: false,
            };

            $.ajax({
                ...option,
                success: (json) => {
                    resolve(json);
                },
                error: (jqXHR, textStatus, errorThrown) => {
                    reject(jqXHR, textStatus, errorThrown);
                },
            }).then(() => {});
        } catch (e) {
            console.log(e);
        }
    });

/**
 * Render Datasource Config Base on response data
 * @param {LatestRecordOfProcess} data - a response data that contains all process config & data source information
 * @return {Promise<void>}
 */
async function renderDatasourceConfig(data) {
    const urlInfo = await getUrlInfo();
    fillDatasourceName(
        urlInfo.isFile ? urlInfo.fileUrl : urlInfo.url,
        urlInfo.isFile,
    );
    if (data.datasourceConfig?.master_type === 'V2') {
        // In case of V2 data
    } else {
        // TODO: check this code necessary ???
        // In case of OTHER csv
        fillProcessName(
            urlInfo.isFile ? urlInfo.fileUrl : urlInfo.url,
            urlInfo.isFile,
        );
    }

    const datasourceNameElement = document.getElementById('databaseName');
    data.datasourceConfig.name = datasourceNameElement.value.trim();
    data.datasourceConfig.csv_detail.is_file_path = urlInfo.isFile;
    datasourceNameElement.__cache__ = data.datasourceConfig;
}

/**
 * Clear cache of data source config
 */
function clearCacheDatasourceConfig() {
    const datasourceNameElement = document.getElementById('databaseName');
    delete datasourceNameElement.__cache__;
}

/**
 * Handle response data -> render process config UI
 * @param {Promise<LatestRecordOfProcess>} request
 * @return {Promise<void>}
 */
async function handleResponseData(request) {
    addMessengerToProgressBar(
        registerI18n.i18nScanning,
        ICON_STATUS.PROCESSING,
        registerSteps.SCANNING,
    );

    const data = await request;

    // render data source config before render process config
    await renderDatasourceConfig(data);

    const processConfigs =
        /** @type {ProcessData[]} */
        data.datasourceConfig.master_type !== 'V2'
            ? await convertStructureData(data)
            : convertStructureDataV2(data);
    displayPreviewContentData();
    renderProcessConfig(processConfigs);

    addMessengerToProgressBar(
        registerI18n.i18nScanning,
        ICON_STATUS.SUCCESS,
        registerSteps.SCANNING,
        true,
    );
}

/**
 * Convert Structure Data from other to V2
 * @param {LatestRecordOfProcess} data - a response data that contains all process config & data source information
 * @return {Promise<[{data: {name_local: null, columns: {}[], name: *, name_jp: *, is_csv: boolean, name_en: *, shown_name: *}, rows: {}[]}]>}
 */
async function convertStructureData(data) {
    const urlInfo = await getUrlInfo();
    const dataSourceAndProcessName = getDbSourceAndProcessNameFromUrl(
        urlInfo.isFile ? urlInfo.fileUrl : urlInfo.url,
        urlInfo.isFile,
    );
    const otherData = /** @type OtherProcessData */ data.processConfigs[0];
    return [
        {
            data: {
                columns: otherData.cols,
                is_csv: true,
                name: dataSourceAndProcessName,
                name_en: dataSourceAndProcessName,
                name_jp: dataSourceAndProcessName,
                name_local: null,
                shown_name: dataSourceAndProcessName,
                origin_name: dataSourceAndProcessName,
                dummy_datetime_idx: otherData.dummy_datetime_idx,
            },
            rows: otherData.rows,
        },
    ];
}

/**
 * Convert Structure Data from other to V2
 * @param {LatestRecordOfProcess} data - a response data that contains all process config & data source information
 * @description THIS METHOD ONLY USED FOR EDGE SERVER (NOT BRIDGE STATION)
 * @return {[{data: {name_local: null, columns: {}[], name: *, name_jp: *, is_csv: boolean, name_en: *, shown_name: *}, rows: {}[]}]}
 */
function convertStructureDataV2(data) {
    const isShowJapaneseName = docCookies.getItem('locale') === 'ja';
    return data.processConfigs.map((processConfig) => {
        return {
            data: {
                columns: processConfig.cols,
                is_csv: true,
                name: processConfig.name,
                name_en: processConfig.name_en,
                name_jp: processConfig.name_jp,
                name_local: processConfig.name_local,
                shown_name: isShowJapaneseName
                    ? processConfig.name_jp
                    : processConfig.name_en,
                origin_name: processConfig.origin_name,
                dummy_datetime_idx: processConfig.dummy_datetime_idx,
            },
            rows: processConfig.rows,
        };
    });
}

/**
 * Render (1-n) Process Config(s) for response data
 * @param {ProcessData[]} data - a response data that contains all process config(s) information
 */
function renderProcessConfig(data) {
    data.forEach((processData, index) => {
        // TODO: is_checked attribute must be include in response data.
        processData.data.columns.forEach(
            (processColumnConfig) => (processColumnConfig.is_checked = true),
        );

        // This set id logic ONLY APPLY for EDGE SERVER
        processData.data.id =
            processData.data.id == null ? index : processData.data.id;

        /** @type ProcessConfigSection */
        let processConfigSectionObj;
        if (index === 0) {
            // In case of main section, no need to render
            processConfigSectionObj =
                ProcessConfigSection.createProcessConfigSectionForMain(
                    processData.data,
                    processData.rows,
                );
        } else {
            // In case of extend section, need to render
            processConfigSectionObj =
                ProcessConfigSection.createProcessConfigSectionForExtend(
                    processData.data,
                    processData.rows,
                );

            processConfigSectionObj.render();
        }

        processConfigSectionObj.injectEvents();
    });
}

const addMessengerToProgressBar = (
    msg = '',
    status = ICON_STATUS.SUCCESS,
    step = '',
    modify = false,
    addJobLink = false,
) => {
    const progressContent = $(registerFromFileEles.progressDisplay);
    let iconClass = '';
    let stepClass = '';
    if (step) {
        stepClass = `progress-msg-${step}`;
    }
    switch (status) {
        case ICON_STATUS.SUCCESS:
            iconClass = 'fa-check';
            break;
        case ICON_STATUS.WARNING:
            iconClass = 'fa-triangle-exclamation';
            break;
        case ICON_STATUS.PROCESSING:
            iconClass = 'fa-solid fa-spinner fa-spin';
            break;
        default:
            break;
    }
    const msgContent =
        status === ICON_STATUS.WARNING && addJobLink
            ? `<a href="/ap/config/job" target="_blank" class="hint-text">${msg}</a>`
            : msg;

    const msgDiv = `
        <div class="d-flex align-items-center ${stepClass}">
            <i class="fas ${iconClass}"></i><span>${msgContent}</span>
        </div>
    `;
    if (!modify) {
        progressContent.prepend(msgDiv);
    } else {
        $(`.${stepClass}`).remove();
        progressContent.prepend(msgDiv);
    }
};

const resetProgressBar = () => {
    $(registerFromFileEles.progressDisplay).empty();
    [
        registerFromFileEles.databaseName,
        registerFromFileEles.processEnName,
        registerFromFileEles.processJapaneseName,
        registerFromFileEles.processLocalName,
    ].forEach((el) => {
        el.val('');
        removeBorderFromInvalidInput(el);
    });
};

const resetPreviewTableContent = () => {
    procModalElements.processColumnsTableBody.empty();
    procModalElements.processColumnsSampleDataTableBody.empty();
};

/**
 * Check Duplicated Data Source Name
 * @param {string} datasourceName
 * @return {Promise<boolean>} - true: is duplicate, false: not duplicate
 */
const checkDuplicatedDataSourceName = async (datasourceName = '') => {
    const data = {
        name: datasourceName,
    };
    const response = await fetchData(
        '/ap/api/setting/check_duplicated_db_source',
        JSON.stringify(data),
        'POST',
    );
    return response.is_duplicated;
};

/**
 * Check Duplicated Process Name
 * @param {string} nameEn - Name English
 * @param {string} nameJp - Name Japanese
 * @param {string} nameLocal - Name Local
 * @return {Promise<boolean[3]>} - a list of boolean
 *    - true: is duplicate | false: not duplicate,  <--English-->
 *    - true: is duplicate | false: not duplicate,  <--Japanese-->
 *    - true: is duplicate | false: not duplicate,  <--Local-->
 */
const checkDuplicatedProcessName = async (
    nameEn = '',
    nameJp = '',
    nameLocal = '',
) => {
    const data = {
        name_en: nameEn,
        name_jp: nameJp,
        name_local: nameLocal,
    };
    /** @type {{is_duplicated: boolean[3]}} */
    const response = await fetchData(
        '/ap/api/setting/check_duplicated_process_name',
        JSON.stringify(data),
        'POST',
    );
    return response.is_duplicated;
};

const getDbSourceAndProcessNameFromUrl = (url, isFile) => {
    const fullPath = url.replace(/\\/g, '/').split('/');
    return isFile
        ? fullPath[fullPath.length - 2]
        : fullPath[fullPath.length - 1];
};

/**
 * Get Url info
 * @return {Promise<{isFile: boolean, url: string, fileUrl: string}>}
 */
function getUrlInfo() {
    return new Promise(function (resolve) {
        let url = $(registerFromFileEles.folderUrl).val().trim();
        let fileUrl = $(registerFromFileEles.refFileUrl).val().trim();
        checkFolderOrFile(url).then((urlInfo) => {
            let isFile;
            if (urlInfo.isFile) {
                isFile = true;
                fileUrl = url;
                url = getFolderPathFromFilePath(url);
            } else {
                isFile =
                    fileUrl !== '' &&
                    $(registerFromFileEles.containerReferenceFile)[0].style
                        .display !== 'none';
            }

            resolve({
                url: url,
                isFile: isFile,
                fileUrl: fileUrl,
            });
        });
    });
}

/**
 * Check there must be a main::Datetime column for each process
 * @return {boolean} - true: main::Datetime is already selected, false: not have main::Datetime in process config
 */
const isMainDatetimeColumnSelected = () => {
    let isSelected = true;
    const tableBodyElements = document.querySelectorAll(
        'table[name=processColumnsTable] tbody',
    );
    tableBodyElements.forEach((tableBodyElement) => {
        const $mainDatetime = $(tableBodyElement).find(
            'td.column-date-type button>span[data-attr-key="is_get_date"]',
        );

        const isExistMainDatetimeColumn = $mainDatetime.length > 0;
        const isMainDatetimeColumnChecked = $mainDatetime
            .closest('tr')
            .find('td.column-raw-name input[type="checkbox"]')
            .is(':checked');
        if (!(isExistMainDatetimeColumn && isMainDatetimeColumnChecked)) {
            isSelected = false;
        }
    });

    if (!isSelected) {
        addMessengerToProgressBar(
            registerI18n.i18nErrorNoGetdate,
            ICON_STATUS.WARNING,
        );
    }

    return isSelected;
};

/**
 * Collect Process Data
 * @return {RequestProcessData[]} - a list of process data
 */
function collectProcessConfigInfos() {
    const processConfigs = [];
    const sectionHTMLObjects = document.querySelectorAll(
        '[id^="procSettingModal"]',
    );
    sectionHTMLObjects.forEach((sectionHTMLObject) => {
        const processConfigSection =
            sectionHTMLObject.__object__ != null
                ? sectionHTMLObject.__object__
                : new ProcessConfigSection(sectionHTMLObject);
        const requestProcessConfig =
            processConfigSection.collectProcessConfig();
        const processConfig =
            ProcessConfigSection.splitUsedColumnAndUnusedColumn(
                requestProcessConfig,
            );
        processConfigs.push(processConfig);
    });

    return processConfigs;
}

/**
 * Collect data source config
 * @return {DatasourceConfig} - an object of data source config
 */
function collectDatasourceInfo() {
    const datasourceNameElement = document.getElementById('databaseName');
    datasourceNameElement.__cache__.name = datasourceNameElement.value.trim();
    return datasourceNameElement.__cache__;
}

/**
 * Collect all information of data source and process config
 * @return {{
 *    import_data: boolean,
 *    proc_configs: RequestProcessData[],
 *    request_id: string,
 *    csv_info: DatasourceConfig,
 * }}
 */
function collectAllDataInfo() {
    const processConfigs = collectProcessConfigInfos();
    const datasourceConfig = collectDatasourceInfo();
    window.RegisterByFileRequestID = create_UUID();
    window.newProcessIds = undefined;
    window.sseProcessIds = [];

    return {
        csv_info: datasourceConfig,
        proc_configs: processConfigs,
        import_data: true,
        request_id: window.RegisterByFileRequestID,
    };
}

/**
 * Save DataSource And Processes
 * @return {Promise<void>}
 */
const saveDataSourceAndProc = async () => {
    const isDSNameEmpty = isDataSourceNameEmpty();
    const isProcNameEmpty = isProcessNameEmpty();
    if (isDSNameEmpty || isProcNameEmpty) return;

    // check duplicated dbs and process name
    const isDSNameDuplicate = await isDataSourceNameDuplicate();
    const isProcNameDuplicate = await isProcessNameDuplicate();
    if (isDSNameDuplicate || isProcNameDuplicate) return;

    // check is_get_date column is already defined
    const isDatetimeColumnSelected = isMainDatetimeColumnSelected();
    if (!isDatetimeColumnSelected) return;

    addMessengerToProgressBar(registerI18n.i18nProcessRegisterStart);
    addMessengerToProgressBar(registerI18n.i18nProgressFolderCheck);

    const data = collectAllDataInfo();
    try {
        $(registerFromFileEles.registerButton)
            .prop('disabled', true)
            .removeClass('btn-primary')
            .addClass('btn-secondary');
        /**
         * @type {{
         *    message: string,
         *    is_error: boolean,
         *    processIds: number[],
         * }}
         */
        const response = await fetchData(
            '/ap/api/setting/register_source_and_proc',
            JSON.stringify(data),
            'POST',
        ).catch((err) => {
            addMessengerToProgressBar(
                err.responseJSON.message,
                ICON_STATUS.WARNING,
            );
            console.error(`[Backend Error] ${err.responseJSON.detail}`);
        });

        if (response) {
            addMessengerToProgressBar(response.message, ICON_STATUS.SUCCESS);
            window.newProcessIds = response.processIds;
            console.log(response.processIds);
        }
    } catch (e) {
        console.log(e);
    }
};

/**
 * Redirect To CHM Page
 * @param processId
 * @return {Promise<void>}
 */
const redirectToCHMPage = async (processId) => {
    // go to chm after import data
    // const processId = processInfo.id;
    const res = await fetchData(
        `/ap/api/setting/redirect_to_chm_page/${processId}`,
        '',
        'GET',
    );
    goToOtherPage(res.url, true);
};

const redirectToPage = async (processIds, page) => {
    const data = {
        page: page,
        processIds: processIds,
    };
    const res = await fetchData(
        `/ap/api/setting/redirect_to_page`,
        JSON.stringify(data),
        'POST',
    );
    goToOtherPage(res.url, true);
};

/**
 * Update Data Register Status
 * @param {{
 *     data: {
 *         RegisterByFileRequestID: string,
 *         step: string,
 *         status: string,
 *         is_first_imported: boolean,
 *         process_id: number,
 *         use_dummy_datetime: boolean,
 *     },
 * }} postDat - a dictionary contains SSE message from Backend
 */
const updateDataRegisterStatus = (postDat) => {
    if (postDat.data.RegisterByFileRequestID !== window.RegisterByFileRequestID)
        return;

    // switch (postDat.data.step) {
    //     case registerSteps.GEN_DATA_TABLE:
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressGenDataTable,
    //             ICON_STATUS.PROCESSING,
    //             registerSteps.GEN_DATA_TABLE,
    //         );
    //         break;
    //
    //     case registerSteps.SCAN_FILE:
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressGenDataTable,
    //             ICON_STATUS.SUCCESS,
    //             registerSteps.GEN_DATA_TABLE,
    //             true,
    //         );
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressScanFile,
    //             ICON_STATUS.PROCESSING,
    //             registerSteps.SCAN_FILE,
    //         );
    //         break;
    //
    //     case registerSteps.SCAN_MASTER:
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressScanFile,
    //             ICON_STATUS.SUCCESS,
    //             registerSteps.SCAN_FILE,
    //             true,
    //         );
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressScanMaster,
    //             ICON_STATUS.PROCESSING,
    //             registerSteps.SCAN_MASTER,
    //         );
    //         break;
    //
    //     case registerSteps.SCAN_DATA_TYPE:
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressScanMaster,
    //             ICON_STATUS.SUCCESS,
    //             registerSteps.SCAN_MASTER,
    //             true,
    //         );
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressScanDataType,
    //             ICON_STATUS.PROCESSING,
    //             registerSteps.SCAN_DATA_TYPE,
    //         );
    //         break;
    //
    //     case registerSteps.PULL_CSV_DATA:
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressScanDataType,
    //             ICON_STATUS.SUCCESS,
    //             registerSteps.SCAN_DATA_TYPE,
    //             true,
    //         );
    //         addMessengerToProgressBar(
    //             registerI18n.i18nProgressPullData,
    //             ICON_STATUS.PROCESSING,
    //             registerSteps.PULL_CSV_DATA,
    //         );
    //         break;
    // }

    // processing
    switch (postDat.data.status) {
        case REGISTER_JOB_STATUS.PROCESSING:
            // addMessengerToProgressBar(
            //     registerI18n.i18nProgressPullData,
            //     ICON_STATUS.SUCCESS,
            //     registerSteps.PULL_CSV_DATA,
            //     true,
            // );
            addMessengerToProgressBar(
                registerI18n.i18nProgressImportingData,
                ICON_STATUS.PROCESSING,
                registerSteps.IMPORTING,
                true,
            );
            break;

        case postDat.data.status === REGISTER_JOB_STATUS.FAILED:
            addMessengerToProgressBar(
                registerI18n.i18nProgressImportingData,
                ICON_STATUS.WARNING,
                registerSteps.IMPORTING,
                true,
                true,
            );
            break;

        case postDat.data.status === REGISTER_JOB_STATUS.DONE:
            // modify processing to check icon
            addMessengerToProgressBar(
                registerI18n.i18nProgressImportingData,
                ICON_STATUS.SUCCESS,
                registerSteps.IMPORTING,
                true,
            );
            // add finish item
            addMessengerToProgressBar(
                registerI18n.i18nProgressFinished,
                ICON_STATUS.SUCCESS,
                registerSteps.IMPORTING,
                true,
            );
            break;
    }

    // redirect if first chunk of data be imported
    if (postDat.data.is_first_imported) {
        console.log(postDat.data.process_id);
        if (!window.sseProcessIds.includes(postDat.data.process_id)) {
            // Add process id into ready list that contains processes have already imported data
            window.sseProcessIds.push(postDat.data.process_id);
        }

        if (
            window.newProcessIds &&
            window.newProcessIds.length !== window.sseProcessIds.length
        ) {
            // in case there are some process that not have data yet, wait to import data
            return;
        }

        console.log('Ready to show graph...');
        // in case all processes have data, redirect to show graph page
        setTimeout(async () => {
            const pageRedirect = postDat.data.use_dummy_datetime
                ? 'ap/fpp'
                : 'ap/chm';
            await redirectToPage(window.newProcessIds, pageRedirect);
        }, 3000);
    }
};

const getRequestParams = () => {
    const loadGUIFromUrl = !!getParamFromUrl('load_gui_from_url');
    const sourceFolder = getParamFromUrl('source_folder');
    const sourceFile = getParamFromUrl('source_file');
    const estimationFile = getParamFromUrl('estimation_file');
    const dataSourceName = getParamFromUrl('data_source_name');
    const procesNameJp = getParamFromUrl('process_name_jp');
    const processNameLocal = getParamFromUrl('process_name_local');
    return {
        loadGUIFromUrl,
        sourceFolder,
        sourceFile,
        estimationFile,
        dataSourceName,
        procesNameJp,
        processNameLocal,
    };
};

const handleLoadGUiFromExternalAPIRequest = () => {
    const {
        loadGUIFromUrl,
        sourceFolder,
        sourceFile,
        estimationFile,
        dataSourceName,
        procesNameJp,
        processNameLocal,
    } = getRequestParams();

    if (!loadGUIFromUrl) return;
    // If both source_folder and source_file is given, use source_folder
    // If source_file and estimation_file is given, ignore estimation_file

    const isFile = sourceFile && !sourceFolder;

    if (isFile) {
        $(registerFromFileEles.directoryRadios).val('file').trigger('change');
    } else {
        if (sourceFolder) {
            registerFromFileEles.folderUrl.val(sourceFolder).trigger('change');
        }

        if (estimationFile) {
            registerFromFileEles.refFileUrl.val(estimationFile);
        }
    }

    setTimeout(() => {
        // set data source name
        if (dataSourceName) {
            registerFromFileEles.databaseName.val(dataSourceName);
        }
        if (procesNameJp) {
            registerFromFileEles.processJapaneseName
                .val(procesNameJp)
                .trigger('change');
        }
        if (processNameLocal) {
            registerFromFileEles.processLocalName.val(processNameLocal);
        }

        if (processNameLocal && !procesNameJp) {
            registerFromFileEles.processLocalName.trigger('change');
        }
    }, 500);

    clickRegisterButtonWhenEnabled();
};

function clickRegisterButtonWhenEnabled() {
    // poll until all values are filled and button is enabled
    if (
        Object.prototype.hasOwnProperty.call(
            $(registerFromFileEles.registerButton),
            'disabled',
        ) ||
        !$(registerFromFileEles.processEnName).val()
    ) {
        setTimeout(clickRegisterButtonWhenEnabled, 500);
    } else {
        // click register data
        $(registerFromFileEles.registerButton).trigger('click');
    }
}

const disableRegisterDataFileBtn = () => {
    $(registerFromFileEles.registerButton)
        .prop('disabled', true)
        .removeClass('btn-primary')
        .addClass('btn-secondary');
};

const enableRegisterDataFileBtn = () => {
    $(registerFromFileEles.registerButton)
        .prop('disabled', false)
        .removeClass('btn-secondary')
        .addClass('btn-primary');
};

const removeQuotesfromInputAndUpdate = (inputEl) => {
    const url = $(inputEl).val().replace(/"/g, '');
    $(inputEl).val(url);
};

const removeLastBackslashFromInputAndUpdate = (inputEl) => {
    const url = $(inputEl).val().replace(/\\$/g, '');
    $(inputEl).val(url);
};

const displayPreviewContentData = () => {
    $(procModalElements.procPreviewSection).show();
};

const hiddenPreviewContentData = () => {
    $(procModalElements.procPreviewSection).hide();
};

const showHideRefFile = (isShow) => {
    const display = isShow ? '' : 'none';
    $(registerFromFileEles.containerReferenceFile)[0].style.setProperty(
        'display',
        display,
        'important',
    );
    if (!isShow) {
        $(registerFromFileEles.refFileUrl).val('');
    }
};

/**
 * Get Folder Path From File Path
 * @param {string} filePath - a file path
 * @return {string} - a folder path
 */
function getFolderPathFromFilePath(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\');
    const lastForwardSlash = filePath.lastIndexOf('/');
    const lastIndex = Math.max(lastSlashIndex, lastForwardSlash);
    return filePath.substring(0, lastIndex).replace(/^\/+|\/+$/g, '');
}

const switchToRegisterByFolder = (event) => {
    showHideRefFile(true);

    // Change file path to folder path
    const filePath = $(event.currentTarget).data('url');
    const folderPath = getFolderPathFromFilePath(filePath);
    $(registerFromFileEles.folderUrl).val(folderPath);

    handleOnChangeFolderAndFileUrl(false).then(() => {});
};

/**
 * Remove all process configs in extend section html
 */
function removeExtendSections() {
    document
        .querySelectorAll('div.section.extend-section')
        .forEach((extendSection) => $(extendSection).remove());
}

jQuery(function () {
    checkOnFocus = false;
    // hide folder/file picker button if there is not server admin
    if (!isAdmin) {
        $('.btn-browse').css('display', 'none');
    }

    $(registerFromFileEles.registerAllFilesButton).on(
        'click',
        switchToRegisterByFolder,
    );
    $(registerFromFileEles.registerOneFileButton).on('click', () => {
        showHideRefFile(false);
        handleOnChangeFolderAndFileUrl(false).then(() => {});
    });

    disableRegisterDataFileBtn();

    handleLoadGUiFromExternalAPIRequest();

    // This logic is ONLY for EDGE SERVER to avoid bug relate to merge mode
    setTimeout(() => {
        procModalElements.proc.off('focusout').on('focusout', () => {
            checkDuplicateProcessName('data-name-en');
        });
    }, 200);
});
