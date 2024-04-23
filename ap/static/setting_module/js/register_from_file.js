const registerFromFileEles = {
    folderBrowser: '#folderBrowser',
    fileBrowser: '#fileBrowser',
    directoryRadios: 'input[name=directorySelector]',
    checkedDirectoryRadio: 'input[name=directorySelector]:checked',
    folderRadio: '#directoryTypeFolder',
    fileRadio: '#directoryTypeFile',
    fileBrowseButton: '#browseFileBtn',
    folderBrowseButton: '#browseFolderBtn',
    fileUrl: $('input[name=fileUrl]'),
    folderUrl: $('input[name=folderUrl]'),
    refFileUrl: $('input[name=fileName]'),
    progressDisplay: '#progressDisplay',
    registerButton: '#registerDataSourceProcBtn',
    databaseName: $('input[name=databaseName]'),
    processEnName: $('input[name=processName]'),
    processJapaneseName: $('input[name=processJapaneseName]'),
    processLocalName: $('input[name=processLocalName]'),
};

const inputDOMByPath = {
    directory: registerFromFileEles.folderUrl,
    file: registerFromFileEles.fileUrl,
    reference_file: registerFromFileEles.refFileUrl,
}

let processInfo = null;
let registeredProcessId = null;

// override from db_config.js to use generateProcessList function from proc_config_modal.js todo move to common js file
let dicProcessCols = {};
let dicOriginDataType = {};

const i18n = {
    statusDone: $('#i18nStatusDone').text(),
    statusImporting: $('#i18nStatusImporting').text(),
    statusFailed: $('#i18nStatusFailed').text(),
    statusPending: $('#i18nStatusPending').text(),
    validLike: $('#i18nValidLike').text(),
    reachFailLimit: $('#i18nReachFailLimit').text(),
    noCTCol: $('#i18nNoCTCol').text(),
    noCTColProc: $('#i18nNoCTColPrc').text(),
}

const registerI18n = {
    i18nFileIsSelected: $('#i18nFileIsSelected').text(),
    i18nProgressSourceSelected: $('#i18nProgressSourceSelected').text(),
    i18nDbSourceExist: $('#i18nDbSourceExist').text(),
    i18nProcessNameIsAlreadyRegistered: $('#i18nProcessNameIsAlreadyRegistered').text(),
    i18nDataSourceNameIsAlreadyRegistered: $('#i18nDataSourceNameIsAlreadyRegistered').text(),
    i18nProcessRegisterStart: $('#i18nProcessRegisterStart').text(),
    i18nProgressFolderCheck: $('#i18nProgressFolderCheck').text(),
    i18nProgressImportingData: $('#i18nProgressImportingData').text(),
    i18nProgressFinished: $('#i18nProgressFinished').text(),
};

const registerSteps = {
    IMPORTING: "importing"
}

const ICON_STATUS = {
    SUCCESS: "success",
    PROCESSING: "processing",
    WARNING: "warning",
}

const REGISTER_JOB_STATUS = {
    DONE: "DONE",
    FAILED: "FAILED",
    PROCESSING: "PROCESSING",
}

const parseIntData = (v) => {
    let val = trimBoth(String(v));
    if (isEmpty(val)) {
        val = '';
    } else {
        val = parseInt(Number(val));
        if (isNaN(val)) {
            val = '';
        }
    }
    return val;
};

const changeBackgroundColor = (ele) => {
    if ([DataTypes.STRING.name, DataTypes.REAL_SEP.name, DataTypes.EU_REAL_SEP.name].includes(ele.getAttribute('value'))) {
        $(ele).closest('.config-data-type-dropdown').find('[name=dataType]')
            .css('color', 'orange');
    } else {
        $(ele).closest('.config-data-type-dropdown').find('[name=dataType]')
            .css('color', 'white');
    }
};

const parseDataType = (ele, idx) => {
    // change background color
    changeBackgroundColor(ele);

    const vals = [...procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${idx}) .sample-data`)].map(el => $(el));

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
};


const parseFloatData = (v) => {
    let val = trimBoth(String(v));
    if (isEmpty(val)) {
        val = '';
    } else if (val.toLowerCase() === COMMON_CONSTANT.INF.toLowerCase()) {
        val = COMMON_CONSTANT.INF.toLowerCase();
    } else if (val.toLowerCase() === COMMON_CONSTANT.MINF.toLowerCase()) {
        val = COMMON_CONSTANT.MINF.toLowerCase();
    } else {
        // TODO why do we need to re-parse?
        val = parseFloat(Number(val));
        if (isNaN(val)) {
            val = '';
        }
    }
    return val;
};

const isAddNewMode = () => true;
// override end

$(registerFromFileEles.directoryRadios).on("change", (e) => {
    const self = $(e.currentTarget)
    const value = self[0].value
    if(value === "folder"){
        $(registerFromFileEles.fileBrowser).hide()
        $(registerFromFileEles.folderBrowser).show()
    } else if (value === "file"){
        $(registerFromFileEles.folderBrowser).hide()
        $(registerFromFileEles.fileBrowser).show()
    }
})

const resourceSelection = (resource_type) => {
    fetch(`/ap/api/setting/browser/${resource_type}`, {cache: 'no-store'})
        .then(res => res.json())
        .then(res => {
            if (res.path) {
                $(inputDOMByPath[res.kind]).val(res.path).change();
            }
        });
}

// fileHandle is a FileSystemFileHandle
// withWrite is a boolean set to true if write

async function verifyPermission(fileHandle, withWrite) {
  const opts = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }

  const opfsRoot = await navigator.storage.getDirectory();
    // A FileSystemDirectoryHandle whose type is "directory"
    // and whose name is "".
    console.log(opfsRoot);

  // Check if we already have permission, if so, return true.
  if ((await fileHandle.queryPermission(opts)) === "granted") {
    return true;
  }

  // Request permission to the file, if the user grants permission, return true.
  if ((await fileHandle.requestPermission(opts)) === "granted") {
    return true;
  }

  // The user did not grant permission, return false.
  return false;
}

const handleOnChangeFolderAndFileUrl = async () => {
    // remove add red border
    [registerFromFileEles.fileUrl, registerFromFileEles.folderUrl, registerFromFileEles.refFileUrl].forEach(el => {
        removeBorderFromInvalidInput($(el));
    })
    const isFile = $(registerFromFileEles.checkedDirectoryRadio).val() !== 'folder';
    let url = '';
    let fileUrl = '';
    if (isFile) {
        url = $(registerFromFileEles.fileUrl).val().trim();
        // clear folder input
        $(registerFromFileEles.folderUrl).val('');
        $(registerFromFileEles.refFileUrl).val('');
    } else {
        url = $(registerFromFileEles.folderUrl).val().trim();
        fileUrl = $(registerFromFileEles.refFileUrl).val().trim();
        // clear file input
        $(registerFromFileEles.fileUrl).val('');
    }

    resetProgressBar();
    if (!url) {
        disableRegisterDataFileBtn();
        resetPreviewTableContent();
        return;
    };
    enableRegisterDataFileBtn();
    
    const checkResult = await checkFolder(url, isFile)

    if (!checkResult.is_valid || !checkResult.is_valid_file) {
        // show error msg to the right side
        addMessengerToProgressBar(checkResult.err_msg, ICON_STATUS.WARNING);
        if (isFile) {
            addBorderToInvalidInput($(registerFromFileEles.fileUrl));
        } else {
            addBorderToInvalidInput($(registerFromFileEles.folderUrl));
        }
        resetPreviewTableContent();
        return;
    }

    if (!isFile && fileUrl) {
        // check selected filename
        const checkFileName = await checkFolder(fileUrl, true)

        if (!checkFileName.is_valid || !checkFileName.is_valid_file) {
            // show error msg to the right side
            addMessengerToProgressBar(checkFileName.err_msg, ICON_STATUS.WARNING);
            addBorderToInvalidInput($(registerFromFileEles.refFileUrl));
            resetPreviewTableContent();
            return;
        }
    }

    // show ✔  ファイルが選択されました msg
    addMessengerToProgressBar(registerI18n.i18nProgressSourceSelected);

    fillDsNameAndProcessName(url, isFile);

    // show latest record
     const formData = new FormData();
     if (isFile) {
        formData.set('fileName', url);
     } else {
         formData.set('folder', url);
         formData.set('fileName', fileUrl);
     }

     await getLatestRecord(formData);

};


const fillDsNameAndProcessName = (url, isFile) => {
    checkOnFocus = false;
    const {loadGUIFromUrl} = getRequestParams();
    if (loadGUIFromUrl) return;
    // fill data source name
    const folderName = getDbSourceAndProcessNameFromUrl(url, isFile);
    registerFromFileEles.databaseName.val(folderName);
    if (isJPLocale) {
        registerFromFileEles.processJapaneseName.val(folderName).trigger('change');
    } else {
        registerFromFileEles.processLocalName.val(folderName).trigger('change');
    }
};

const checkEmptyDataSourceAndProcessName = () => {
    const dbsName = registerFromFileEles.databaseName.val();
    const procNameEn = registerFromFileEles.processEnName.val();

    if (!dbsName && !procNameEn) return false;

    return true;
};

const checkDuplicatedDbsAndProcessName = async () => {
    [registerFromFileEles.databaseName, registerFromFileEles.processEnName, registerFromFileEles.processJapaneseName, registerFromFileEles.processLocalName].forEach(el => {
        removeBorderFromInvalidInput(el);
    })
    const dbsName = registerFromFileEles.databaseName.val();
    const procNameEn = registerFromFileEles.processEnName.val();
    const procNameJp = registerFromFileEles.processJapaneseName.val();
    const procNameLocal = registerFromFileEles.processLocalName.val();

    let isValid = true;
    const isDuplicatedDbsName = await checkDuplicatedDataSourceName(dbsName);
    const [isDuplicatedProcNameEn, isDuplicatedProcNameJp, isDuplicatedProcNameLocal] = await checkDuplicatedProcessName(procNameEn, procNameJp, procNameLocal);
    if (isDuplicatedDbsName) {
        isValid = false;
        // show duplicated dbs msg
        addMessengerToProgressBar(registerI18n.i18nDataSourceNameIsAlreadyRegistered, ICON_STATUS.WARNING);
        addBorderToInvalidInput(registerFromFileEles.databaseName);
    }

    if (isDuplicatedProcNameEn || isDuplicatedProcNameJp || isDuplicatedProcNameLocal) {
        isValid = false;
        // show duplicated process msg
        addMessengerToProgressBar(registerI18n.i18nProcessNameIsAlreadyRegistered, ICON_STATUS.WARNING);

        if (isDuplicatedProcNameEn) {
            addBorderToInvalidInput(registerFromFileEles.processEnName);
        }
        if (isDuplicatedProcNameJp) {
            addBorderToInvalidInput(registerFromFileEles.processJapaneseName);
        }
        if (isDuplicatedProcNameLocal) {
            addBorderToInvalidInput(registerFromFileEles.processLocalName);
        }
    }

    return isValid;
};

const addBorderToInvalidInput = (inputEl) => {
    inputEl.addClass('column-name-invalid');
};

const removeBorderFromInvalidInput = (inputEl) => {
    inputEl.removeClass('column-name-invalid');
};

const checkFolder = async (folderUrl, isFile) => {
    const data = {
        url: folderUrl,
        isFile: isFile
    };
    const response = await fetchData('/ap/api/setting/check_folder', JSON.stringify(data), 'POST');
    return response;
};

const getLatestRecord = async (data) => {
    // '/ap/api/setting/show_latest_records'
    try {
         const option = {
            url: '/ap/api/setting/show_latest_records',
            data: data,
            dataType: 'json',
            type: 'POST',
            contentType: false,
            processData: false,
            cache: false,
        };

         $.ajax({
            ...option,
            success: async (json) => {
                prcPreviewData = json;
                dataGroupType = json.data_group_type;
                const dummyDatetimeIdx = json.dummy_datetime_idx;
                json.cols = json.cols.map(col => {
                     return {
                        ...col,
                        is_checked: true,
                    }
                })
                generateProcessList(json.cols, json.rows, dummyDatetimeIdx, true, true, true);
            }
         });

    } catch (e) {
        console.log(e);
    }
};

const addMessengerToProgressBar = (msg = '',
                                   status= ICON_STATUS.SUCCESS,
                                   step = '',
                                   modify= false,
                                   addJobLink = false,
                                   ) => {
    const progressContent = $(registerFromFileEles.progressDisplay);
    let iconClass = ''
    let stepClass = ''
    if(step){
        stepClass = `progress-msg-${step}`
    }
    switch(status) {
        case ICON_STATUS.SUCCESS:
            iconClass = 'fa-check'
            break;
        case ICON_STATUS.WARNING:
            iconClass = 'fa-triangle-exclamation'
            break;
        case ICON_STATUS.PROCESSING:
            iconClass = 'fa-solid fa-spinner'
            break;
        default:
            break;
    }
    const msgContent = status === ICON_STATUS.WARNING && addJobLink ? `<a href="/ap/config/job" target="_blank" class="hint-text">${msg}</a>` : msg;

    const msgDiv = `
        <div class="d-flex align-items-center ${stepClass}">
            <i class="fas ${iconClass}"></i><span>${msgContent}</span>
        </div>
    `;
    if(!modify){
        progressContent.prepend(msgDiv);
    }
    else {
        $(`.${stepClass}`).remove();
        progressContent.prepend(msgDiv)
    }
};

const resetProgressBar = () => {
    $(registerFromFileEles.progressDisplay).empty();
    [registerFromFileEles.databaseName, registerFromFileEles.processEnName, registerFromFileEles.processJapaneseName, registerFromFileEles.processLocalName].forEach(el => {
        el.val('');
        removeBorderFromInvalidInput(el);
    })
};


const resetPreviewTableContent = () => {
    procModalElements.processColumnsTableBody.empty();
    procModalElements.processColumnsSampleDataTableBody.empty();
};

const checkDuplicatedDataSourceName = async (dbsName = '') => {
    // /ap/api/setting/check_duplicated_db_source
    const data = {
        name: dbsName
    }
    const response = await fetchData('/ap/api/setting/check_duplicated_db_source', JSON.stringify(data), 'POST');
    return response.is_duplicated;
};

const checkDuplicatedProcessName = async (nameEn = '', nameJp = '', nameLocal = '') => {
    // /ap/api/setting/check_duplicated_db_source
    const data = {
        name_en: nameEn,
        name_jp: nameJp,
        name_local: nameLocal
    }
    const response = await fetchData('/ap/api/setting/check_duplicated_process_name', JSON.stringify(data), 'POST');
    return response.is_duplicated;
};

const getDbSourceAndProcessNameFromUrl = (url, isFile) => {
    const fullPath = url.replace(/\\/g, '/').split('/');
    const folderName = isFile ? fullPath[fullPath.length - 2] : fullPath[fullPath.length - 1];
    return folderName;
};

const saveDataSourceAndProc = async () => {
    processInfo = null;
    // clear old status
    // to do: clear all #progressDisplay

    // check duplicated dbs and process name
    const isValid = await checkDuplicatedDbsAndProcessName();
    if (!isValid) return;

    const isFillDbs = checkEmptyDataSourceAndProcessName();
    if (!isFillDbs) return;

    addMessengerToProgressBar(registerI18n.i18nProcessRegisterStart)
    addMessengerToProgressBar(registerI18n.i18nProgressFolderCheck)
    let dataSourcePath = '';
    const dataSourceName = $(registerFromFileEles.databaseName).val()
    const registerMode = $(registerFromFileEles.checkedDirectoryRadio).val()
    const selectJson = getSelectedColumnsAsJson();
    const [procCfgData, unusedColumns] = collectProcCfgData(selectJson);
    if(registerMode === "folder") {
        dataSourcePath = $(inputDOMByPath.directory).val()
    }
    else if(registerMode === "file") {
        dataSourcePath = $(inputDOMByPath.file).val()
    }
    const dictCsvInfo = {
        name: dataSourceName,
        type: "CSV",
        csv_detail: {
            directory: dataSourcePath,
            delimiter: "Auto",
            csv_columns: procCfgData.columns,
        }
    };

    const data = {
        proc_config: procCfgData,
        import_data: true,
        unused_columns: unusedColumns,
        csv_info: dictCsvInfo,
    }
    try {
        const response = await fetchData('/ap/api/setting/register_source_and_proc', JSON.stringify(data), 'POST');
        processInfo = response.process_info;
        registeredProcessId = processInfo.id;
    } catch (e) {
        console.log(e)
    }
};

const redirectToCHMPage = async (processId) => {
    // go to chm after import data
    // const processId = processInfo.id;
    const res = await fetchData(`/ap/api/setting/redirect_to_chm_page/${processId}`, '', 'GET');
    goToOtherPage(res.url, true);
};

const updateDataRegisterStatus = (postDat) => {
    if (postDat.data.process_id !== registeredProcessId) return;
    // processing
    if (postDat.data.status === REGISTER_JOB_STATUS.PROCESSING) {
        addMessengerToProgressBar(
            registerI18n.i18nProgressImportingData,
            ICON_STATUS.PROCESSING,
            registerSteps.IMPORTING
        )
    }
    // failed importing
    if (postDat.data.status === REGISTER_JOB_STATUS.FAILED) {
        addMessengerToProgressBar(
            registerI18n.i18nProgressImportingData,
            ICON_STATUS.WARNING,
            registerSteps.IMPORTING,
            true,
            true
        )
    }
    if (postDat.data.status === REGISTER_JOB_STATUS.DONE) {
        // modify processing to check icon
        addMessengerToProgressBar(
            registerI18n.i18nProgressImportingData,
            ICON_STATUS.SUCCESS,
            registerSteps.IMPORTING,
            true
        )
        // add finish item
        addMessengerToProgressBar(
            registerI18n.i18nProgressFinished,
            ICON_STATUS.SUCCESS,
            registerSteps.IMPORTING
        )
    }
    // redirect if first chunk of data be imported
    if (postDat.data.is_first_imported) {
        setTimeout(async () => {
            await redirectToCHMPage(postDat.data.process_id);
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
        processNameLocal
    }
};

const handleLoadGUiFromExternalAPIRequest = () => {
    const {
        loadGUIFromUrl,
        sourceFolder,
        sourceFile,
        estimationFile,
        dataSourceName,
        procesNameJp,
        processNameLocal
    } = getRequestParams();

    if (!loadGUIFromUrl) return;
    // If both source_folder and source_file is given, use source_folder
    // If source_file and estimation_file is given, ignore estimation_file

    const isFile = sourceFile && !sourceFolder;

    if (isFile) {
        $(registerFromFileEles.directoryRadios).val('file').trigger('change');
        registerFromFileEles.fileUrl.val(sourceFile).trigger('change');
    } else {
        if (sourceFolder) {
            registerFromFileEles.folderUrl.val(sourceFolder).trigger('change');
        }

        if (estimationFile) {
            registerFromFileEles.refFileUrl.val(estimationFile);
        }
    }

    setTimeout(()=> {
        // set data source name
        if (dataSourceName) {
            registerFromFileEles.databaseName.val(dataSourceName);
        }
        if (procesNameJp) {
            registerFromFileEles.processJapaneseName.val(procesNameJp).trigger('change');
        }
        if (processNameLocal) {
            registerFromFileEles.processLocalName.val(processNameLocal);
        }

        if (processNameLocal && !procesNameJp) {
            registerFromFileEles.processLocalName.trigger('change');
        }
    }, 500);

    setTimeout(() => {
        // click register data
        $(registerFromFileEles.registerButton).trigger('click');
    }, 1000);
};

const disableRegisterDataFileBtn = () => {
    $(registerFromFileEles.registerButton).prop('disabled', true).removeClass('btn-primary').addClass('btn-secondary');
};

const enableRegisterDataFileBtn = () => {
    $(registerFromFileEles.registerButton).prop('disabled', false).removeClass('btn-secondary').addClass('btn-primary');
};

$(document).ready(() => {
     checkOnFocus = false;
    // hide folder/file picker button if there is not server admin
    if (!isAdmin) {
        $('.btn-browse').css('display', 'none');
    }

    disableRegisterDataFileBtn();

    handleLoadGUiFromExternalAPIRequest();
});