/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-mixed-operators */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-use-before-define */
/* eslint-disable no-undef */
const csvResourceElements = {
    showResourcesBtnId: '#showResources',
    apiUrl: '/histview2/api/setting/get_csv_resources',
    apiImportToDBUrl: 'api/setting/import_csv_to_db',
    apiCheckFolderUrl: '/histview2/api/setting/check_folder',
    apiLoadDetail: '/histview2/api/setting/ds_load_detail',
    dataTbl: '#csvDataTable',
    folderUrlInput: 'input[name="folderUrl"]',
    fileName: '#fileName',
    connectResourceBtn: '#connectResourceBtn',
    i18nDirExist: 'i18nDirExist',
    i18nDirNotExist: 'i18nDirNotExist',
    okBtn: '#okBtn',
    csvFileName: '',
    alertMsgCheckFolder: '#alertMsgCheckFolder',
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
    msgErrorNoGetdate: '#i18nErrorNoGetdate',
    msgConfirm: '#i18nConfirmMsg',
    sqlInputFile: '#form-control-file',
    skipHead: '#skipHead',
    skipTail: '#skipTail',
    optionalFunction: '#optionalFunction',
    withImportFlag: '#withImportFlag',
    delimiter: 'input[type="radio"][name="fileType"]:checked',
    fileTypeAuto: '#fileTypeAuto',
    csv: '#fileTypeCSV',
    tsv: '#fileTypeTSV',
    smc: '#fileTypeSMC',
    dataSrcId: 'data-ds-id',
    dsId: 'ds_',
    dataTypePredicted: '.data-type-predicted',
};

const eles = {
    pollingFreq: '#pollingFreq',
    useOSTZOption: '#useOSTZOption',
    useOSTZConfirmBtn: '#useOSTZConfirmBtn',
    contextMenuName: '[name=contextMenu]',
};

const dbConfigElements = {
    csvModal: '#modal-db-csv',
    dbNameInput: '#tblDbConfig input[name="master-name"]',
    validateMsg: '#i18nDbNameEmpty',
    csvDBSourceName: '#csvDBSourceName',
    i18nDbSourceEmpty: '#i18nDbSourceEmpty',
    i18nDbSourceExist: '#i18nDbSourceExist',
};

const withImportConstants = {
    YES: 'YES',
    NO: 'NO',
};

const getAllDatabaseConfig = async () => {
    const json = await fetch('/histview2/api/setting/database_tables', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
        .catch();

    return json;
};


const changePollingFreq = (selected) => {
    $(csvResourceElements.withImportFlag).hide();
    const procLength = $("tr[name='procInfo']").length;
    const pf = $(selected).val();
    if (procLength > 0) {
        $(csvResourceElements.withImportFlag).show();
    }
    $('#btn-confirm-register').attr('data-item-id', 'CONFIRM_DB');
    $('#btn-confirm-register').attr('data-pf', pf);
    $('#register-confirm-modal').modal('show');
};
// hide loading screen
const loading = $('#configLoadingScreen');
loading.css('display', 'none');

$(() => {
    $('#withImport').on('change', (evt) => {
        const isChecked = $(evt.target).is(':checked');
        if (isChecked) {
            $('#btn-confirm-register').attr('data-with-import', withImportConstants.YES);
        } else {
            $('#btn-confirm-register').attr('data-with-import', withImportConstants.NO);
        }
        // $("#withImport").is(":checked")
    });
    // click to register db configuration
    $('#db-config-register').click(() => {
        if (validateDBName().isOk) {
            $(csvResourceElements.withImportFlag).hide();
            const procLength = $("tr[name='procInfo']").length;
            if (procLength > 0) {
                $(csvResourceElements.withImportFlag).show();
            }
            $('#btn-confirm-register').attr('data-item-id', 'CONFIRM_DB');
            $('#register-confirm-modal').modal('show');
        } else {
            displayRegisterMessage('#alert-msg-db', {
                message: validateDBName().message,
                is_error: true,
            });
        }
    });

    // click to confirm register db infor
    $('#btn-confirm-register').click(() => {
        const section = $('#btn-confirm-register').attr('data-item-id');
        const withImport = $('#btn-confirm-register').attr('data-with-import');
        const pf = $('#btn-confirm-register').attr('data-pf');
        if (section === 'CONFIRM_BASIC') {
            RegistBasicConfig();
        } else if (section === 'CONFIRM_DB') {
            DB.setPollingFreq($(eles.pollingFreq).val());
            UpdatePollingFreq(pf, withImport);
        }
    });

    $('#register-confirm-modal').on('hidden.bs.modal', () => {
        $(eles.pollingFreq).val(DB.getPollingFreq());
    });

    stickyHeaders.load($('#db-config-register, #btn-trace-config-register'));

    // set polling
    DB.setPollingFreq($(eles.pollingFreq).val());

    collapseConfig();
    $('#userBookmarkBar').hide();
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
    $('button.saveDBInfoBtn[data-csv="1"]').prop('disabled', 'disabled');
};


const getDBItems = () => {
    const dtItems = {};
    $('tr[name="db-info"]').each((i, v) => {
        const item = {};
        const dbID = v.id;
        item[dbID] = {
            type: $(`#${dbID} select[name="type"]`).val(),
            'master-name': $(`#${dbID} input[name="master-name"]`).val(),
            comment: $(`#${dbID} textarea[name="comment"]`).val(),
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
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.clone().json())
        .then((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
        })
        .catch((json) => {
            displayRegisterMessage('#alert-msg-db', json.flask_message);
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
    warning: $('#i18nWarning').text(),
    invalidData: $('#i18nInvalidData').text(),
    referDataFile: $('#i18nReferDataFile').text(),
    jobList: $('#i18nJobList').text(),
    startImport: $('#i18nStartImport').text(),
    checkProgress: $('#i18nCheckProgress').text(),
    checkErrorJob: $('#i18nCheckErrorJob').text(),
};

const showToastr = () => {
    const msgTitle = warningI18n.warning;
    const { jobList } = warningI18n;
    const pathTextStyle = 'float:right; word-break: break-word;';
    const msgContent = `<p>${warningI18n.invalidData}
    <br>${warningI18n.referDataFile}
    <br><a style="${pathTextStyle}" href="file:///${importErrDir}" target="_blank">${importErrDir}</a></p>
    <p><br><span style="float:left;">${warningI18n.checkErrorJob}</span>
    <br><a style="float:right;" href="/histview2/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.INFO);
};

const showJobAsToastr = () => {
    const msgTitle = '';
    const { jobList } = warningI18n;
    const msgContent = `<p>${warningI18n.startImport}
    <br>${warningI18n.checkProgress}
    <br><a style="float:right;" href="/histview2/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.INFO);
};

const updateOSTimezone = () => {
    const dbType = $(eles.useOSTZConfirmBtn).data('dbType');
    const useOSTZOption = $(eles.useOSTZOption).is(':checked');
    $(`#${dbType}_use_os_timezone`).val(useOSTZOption);
    // clear after updated
    $(eles.useOSTZOption).prop(':checked', true);
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
            .split('BREAK_LINE').join('<br>');
        showToastrMsg(msgContent, i18nCommon.warningTitle);
    }
};
