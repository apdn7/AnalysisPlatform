const csvResourceElements = {
    showResourcesBtnId: '#showResources',
    apiUrl: '/ap/api/setting/get_csv_resources',
    apiImportToDBUrl: 'api/setting/import_csv_to_db',
    apiCheckFolderUrl: '/ap/api/setting/check_folder',
    apiLoadDetail: '/ap/api/setting/ds_load_detail',
    dataTbl: '#csvDataTable',
    folderUrlInput: 'input[name="folderUrl"]',
    isFilePathHidden: '#isFilePath',
    fileName: '#fileName',
    connectResourceBtn: '#connectResourceBtn',
    i18nDirExist: 'i18nFileExist',
    i18nDirNotExist: 'i18nDirNotExist',
    okBtn: '#okBtn',
    csvFileName: '',
    alertMsgCheckFolder: '#alertMsgCheckFolder',
    alertInternalError: '#alertInternalError',
    alertDSErrMsgContent: '#alertMsgCheckFolder-content',
    directoryResource: 'input[name="directory-csv"]',
    dataTypeSelector: '.csv-datatype-selection',
    csvConfirmRegister: '#csvConfirmRegister',
    csvConfirmModal: '#CSVConfirmModal',
    resourceUrl: 'input[name="resource-url-csv"]',
    columnName: '.column-name',
    folderUrl: 'folderUrl',
    folderUrlId: '#folderUrl',
    directory: 'directory',
    csvConfirmModalMsg: '#csvConfirmModalMsg',
    msgWarnEmptyType: '#i18nWarnEmptyType',
    msgWarnManyGetdate: '#i18nWarnManyGetdate',
    msgConfirm: '#i18nConfirmMsg',
    sqlInputFile: '#form-control-file',
    skipHead: '#skipHead',
    skipTail: '#skipTail',
    csvNRows: '#csvNRows',
    csvIsTranspose: '#csvIsTranspose',
    optionalFunction: '#optionalFunction',
    withImportFlag: '#withImportFlag',
    changeAllFreqSameDSFlag: '#changeAllFreqSameDSFlag',
    delimiter: 'input[type="radio"][name="fileType"]:checked',
    fileTypeAuto: '#fileTypeAuto',
    csv: '#fileTypeCSV',
    tsv: '#fileTypeTSV',
    smc: '#fileTypeSMC',
    dataSrcId: 'data-ds-id',
    dsId: 'ds_',
    dataTypePredicted: '.data-type-predicted',
    dummyDatetimeDSModal: '#dummyDatetimeConfirmationModal',
    dummyDatetimeProcModal: '#dummyDatetimeProcConfirmationModal',
    csvSubmitBtn: 'button.saveDBInfoBtn[data-csv="1"]',
    duplColsModal: '#duplColsModal',
    dummyHeaderModal: '#dummyHeaderModal',
    dummyHeaderModalMsg: '#dummyHeaderModal .modal-msg',
    isDummyHeader: 'input[name=isDummyHeader]',
    isFileChecker: 'input[name=isFileChecker]',
};

const eles = {
    pollingFreq: '#pollingFreq',
    useOSTZOption: '#useOSTZOption',
    useOSTZConfirmBtn: '#useOSTZConfirmBtn',
    contextMenuName: '[name=contextMenu]',
    withImport: '#withImport',
    importLimit: '#importLimit',
    changeAllFreqSameDS: '#changeAllFreqSameDS',
};

const dbConfigElements = {
    csvModal: '#modal-db-csv',
    dbNameInput: '#tblDbConfig input[name="master-name"]',
    validateMsg: '#i18nDbNameEmpty',
    csvDBSourceName: '#csvDBSourceName',
    i18nDbSourceEmpty: '#i18nDbSourceEmpty',
    i18nDbSourceExist: '#i18nDbSourceExist',
    sqliteDbSource: '#sqlite_dbname',
    snowflakePrivateKeyFileInput: '#snowflake_private_key_file',
    snowflakeSWPrivateKeyFileInput: '#snowflake_software_workshop_private_key_file',
};

const withImportConstants = {
    YES: 'YES',
    NO: 'NO',
};

const getAllDatabaseConfig = async () => {
    const json = await fetch('/ap/api/setting/database_tables', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then((response) => response.clone().json())
        .catch();

    return json;
};

// hide loading screen
const loading = $('#configLoadingScreen');
loading.css('display', 'none');

$(() => {
    $('#import-limit-confirm-modal').on('hidden.bs.modal', () => {
        $(eles.importLimit).val(DB.getImportLimit());
    });

    stickyHeaders.load($('#dataLinkGroup'));

    DB.setImportLimit($(eles.importLimit).val());

    collapseConfig();
    $('#userBookmarkBar').hide();
    // show load settings menu
    handleLoadSettingBtns();

    // handle search in trace list
    handleSearchTraceList();
});

const DB = new Databases();

const clearOldValue = () => {
    // reset old datasource name
    $(dbConfigElements.csvDBSourceName).val('');
    $('span[id^="msg-test-db-conn-"]').text('');
    $(csvResourceElements.sqlInputFile).val('');
    // reset all test db connection messages before toggle edit connfiguration modals
    $('.check-db-msg').html('');

    // reset optional function
    $(csvResourceElements.optionalFunction).select2().val('').trigger('change');

    // hide loading
    $('#resourceLoading').hide();

    // hide warning msg
    $('#alert-msg-csvDbname').hide();
    $('div[id*=validation]').hide();

    // clear datasource type in modal
    $(`.saveDBInfoBtn`).attr('data-isV2', false);
    $(`#showResources`).attr('data-isV2', false);

    $('#dbsEncoding').text('');

    // clear edited flag
    userEditedDSName = false;

    // show btn-secondary as disabled button, and
    // add prevent submit handling to button
    // instead of add disabled attribution
    updateBtnStyleWithValidation($(csvResourceElements.csvSubmitBtn), false);
    $(eles.withImport).prop('checked', false);
};

const getDBItems = () => {
    const dtItems = {};
    $('tr[name="db-info"]').each((i, v) => {
        const item = {};
        const dbID = v.id;
        item[dbID] = {
            'type': $(`#${dbID} select[name="type"]`).val(),
            'master-name': $(`#${dbID} input[name="master-name"]`).val(),
            'comment': $(`#${dbID} textarea[name="comment"]`).val(),
        };
        Object.assign(dtItems, item);
    });
    return dtItems;
};

// Update polling freq
const UpdatePollingFreq = (pf, withImport = 'NO') => {
    let importFlg = false;
    if (withImport === 'YES') {
        importFlg = true;
    }

    const data = {
        POLLING_FREQUENCY: pf,
        with_import: importFlg,
    };
    fetch('api/setting/update_polling_freq', {
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
        })
        .catch((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
        });
};

// Update import limit
const updateImportLimit = (importLimit) => {
    const data = {
        IMPORT_LIMIT: importLimit,
    };

    fetch('api/setting/update_import_limit', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.clone().json())
        .then((json) => {
            showToastrMsg($('#i18nUpdateImportLimitSuccess').text(), MESSAGE_LEVEL.INFO);
        })
        .catch((json) => {
            showToastrMsg($('#i18nUpdateImportLimitFailed').text(), MESSAGE_LEVEL.ERROR);
        });
};

// display message after press test connection buttons
const displayTestDBConnectionMessage = (alertID, flaskMessage = { message: '', connected: false }) => {
    if (alertID === null || alertID === undefined) return;
    const alert = $(`#${alertID}`);
    // reset text
    alert.removeClass('spinner-grow');
    alert.removeClass('text-danger');
    alert.removeClass('text-success');

    if (!flaskMessage.connected) {
        alert.addClass('text-danger');
        alert.html(flaskMessage.message);
        alert.css('display', 'block');
    } else if (flaskMessage.connected) {
        alert.addClass('text-success');
        alert.html(flaskMessage.message);
        alert.css('display', 'block');
    }
};

const warningI18n = {
    invalidData: $('#i18nInvalidData').text(),
    referDataFile: $('#i18nReferDataFile').text(),
    jobList: $('#i18nJobList').text(),
    startImport: $('#i18nStartImport').text(),
    checkProgress: $('#i18nCheckProgress').text(),
    checkErrorJob: $('#i18nCheckErrorJob').text(),
    startBackup: $('#i18nStartBackup').text(),
    startRestore: $('#i18nStartRestore').text(),
    endBackup: $('#i18nEndBackup').text(),
    endRestore: $('#i18nEndRestore').text(),
    importAppSettingDone: $('#i18nImportAppSettingDone').text(),
    importAppSettingFailed: $('#i18nImportAppSettingFailed').text(),
};

const showToastr = () => {
    const { jobList } = warningI18n;
    const pathTextStyle = 'float:right; word-break: break-word;';
    const msgContent = `<p>${warningI18n.invalidData}
    <br>${warningI18n.referDataFile}
    <br><a style="${pathTextStyle}" href="file:///${importErrDir}" target="_blank">${importErrDir}</a></p>
    <p><br><span style="float:left;">${warningI18n.checkErrorJob}</span>
    <br><a style="float:right;" href="/ap/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const showJobAsToastr = () => {
    const { jobList } = warningI18n;
    const msgContent = `<p>${warningI18n.startImport}
    <br>${warningI18n.checkProgress}
    <br><a style="float:right;" href="/ap/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const showImportAppSettingDone = () => {
    const { jobList } = warningI18n;
    const msgContent = `<p>${warningI18n.importAppSettingDone}
    <br>${warningI18n.checkProgress}
    <br><a style="float:right;" href="/ap/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const updateOSTimezone = () => {
    const dbType = $(eles.useOSTZConfirmBtn).data('dbType');
    const useOSTZOption = $(eles.useOSTZOption).is(':checked');
    $(`#${dbType}_use_os_timezone`).val(useOSTZOption);
    $(eles.useOSTZOption).data('previous-value', useOSTZOption);
    // clear after updated
    $(eles.useOSTZOption).prop(':checked', true);
};

const revertOSTimezone = (modalID) => {
    const originValue = $(eles.useOSTZOption).data('previous-value');
    const dbType = $(eles.useOSTZConfirmBtn).data('dbType');

    $(`#${dbType}_use_os_timezone`).val(originValue);
    $(eles.useOSTZOption).prop('checked', originValue);
    $(`#${modalID}`).modal('toggle'); // close modal
};

const recentEdit = (itemID) => {
    const btn = $(`#${itemID} .btn-secondary:first`);
    if (!btn.hasClass('btn-recent')) {
        btn.addClass('btn-recent');
        btn.attr('title', 'Reserved');
        btn.find('.icon-secondary').addClass('icon-recent');
    }
};

const showToastrMsgFailLimit = (json) => {
    const failLimit = json.fail_limit || {};
    if (failLimit.reach_fail_limit) {
        const msgContent = i18n.reachFailLimit
            .replace('FILE_NAME', failLimit.file_name)
            .replace('FOLDER', failLimit.folder)
            .split('BREAK_LINE')
            .join('<br>');
        showToastrMsg(msgContent, MESSAGE_LEVEL.ERROR);
    }
};

const showDummyDatetimeModal = (json, isProcessPreview = false) => {
    const hasCTCol = json.has_ct_col || false;
    if (!hasCTCol) {
        const modalID = isProcessPreview
            ? csvResourceElements.dummyDatetimeProcModal
            : csvResourceElements.dummyDatetimeDSModal;
        // show modal
        $(modalID).modal('show');
    }
};

const showToastrMsgNoCTCol = (hasCTCol) => {
    if (!hasCTCol) {
        showToastrMsg(i18n.noCTColProc, MESSAGE_LEVEL.INFO);
    }
};

const showDuplColModal = () => {
    const modalID = csvResourceElements.duplColsModal;
    // show modal
    $(modalID).modal('show');
};

const handleSearchTraceList = () => {
    const searchTraceEle = $('#searchTraceList');
    initCommonSearchInput(searchTraceEle, 'flex-grow-1');
    const parent = searchTraceEle.closest('.trace-menu-content');
    const currentParentDivId = parent.length > 0 ? parent[0].id : null;
    if (!currentParentDivId) return;

    const originalCheckBoxs = $(`#${currentParentDivId} li`);
    let selectedEls = originalCheckBoxs;

    // multi select search with input immediately
    $(`#searchTraceList`).off('keypress input');
    $(`#searchTraceList`).on('keypress input', (event) => {
        const searchEle = event.currentTarget;
        let value = stringNormalization(searchEle.value.toLowerCase());
        // event.target.value = value;

        value = makeRegexForSearchCondition(value);

        const regex = new RegExp(value, 'i');

        selectedEls = $(parent)
            .find(`li`)
            .filter(function (index) {
                if (!index) return;
                const val = $(this).text().toLowerCase();
                $(this).removeClass('gray');
                $(this).toggle(regex.test(val));
                return regex.test(val);
            });

        if (event.keyCode === KEY_CODE.ENTER) {
            $(parent)
                .find(`li`)
                .filter(function f(index) {
                    if (index) {
                        const val = $(this).text().toLowerCase();
                        if (!regex.test(val)) {
                            $(this).addClass('gray');
                        } else {
                            $(this).removeClass('gray');
                        }
                        $(this).show();
                    }
                });
        }
    });

    // handle on click set selected items button
    $(`#setBtnSearch-searchTraceList`).on('click', function () {
        selectedEls.not('.has').find('input[name=process]').prop('checked', true).change();
    });

    // handle on click reset selected items button
    $(`#resetBtnSearch-searchTraceList`).on('click', function () {
        if (selectedEls.length) {
            // reset only searched element
            $(selectedEls).find('input[name=process]').prop('checked', false).change();
        }
    });
};

const showBackupDataToastr = () => {
    const { jobList } = warningI18n;
    const msgContent = `<p>${warningI18n.startBackup}
    <br>${warningI18n.checkProgress}
    <br><a style="float:right;" href="/ap/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const showRestoreDataToastr = () => {
    const { jobList } = warningI18n;
    const msgContent = `<p>${warningI18n.startRestore}
    <br>${warningI18n.checkProgress}
    <br><a style="float:right;" href="/ap/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const showBackupDataFinishedToastr = () => {
    const msgContent = `<p>${warningI18n.endBackup}</p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const showRestoreDataFinishedToastr = () => {
    const msgContent = `<p>${warningI18n.endRestore}</p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

const showToastClearTransactionData = () => {
    const i18nTexts = {
        abnormalTransactionDataShow: $('#i18nClearTransactionData').text().split('BREAK_LINE').join('<br>'),
    };

    const msgContent = `<p>${i18nTexts.abnormalTransactionDataShow}</p>`;

    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};
