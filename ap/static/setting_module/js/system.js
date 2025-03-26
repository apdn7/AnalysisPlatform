const systemElements = {
    divSystemConfig: '#cfgSystem',
    deleteLogDataModal: '#deleteLogDataModal',
    deleteDataFolderModal: '#deleteDataFolderModal',
    backupAndRestoreModal: '#backupAndRestoreModal',
    resetTransactionDataModal: '#resetTransactionDataModal',
    exportDataModal: '#exportDataModal',
    importDataModal: '#importDataModal',
    importDatabase: '#importDatabase',
    // TODO: Should this get a separate ID?
    uploadBackupFile: '#importSelectFileInput',
};

let defaultTimeRange = '';

const openBackupAndRestoreModal = () => {
    // TODO: this processId assignment is wrong
    if (!_.isEmpty(processes)) {
        processId = Object.keys(processes)[0];
    }
    generateHTMLBackupAndRestoreModal();
    hideRadioDefaultInterval();
    switchBackupRestoreTab(); // Switch to 'Backup' tab at default
    $(systemElements.backupAndRestoreModal).modal('show');
    defaultTimeRange = $('#datetimeRangePicker').val();
    // get process id
};

const closeBackupAndRestoreModal = () => {
    // TODO cleanup
    $(systemElements.backupAndRestoreModal).modal('hide');
    // reset default datetime
    handleSetValueToDateRangePicker(defaultTimeRange, false);
    closeCalenderModal();
    processId = undefined;

    // Release cache function after closing this modal
    $('#backupAndRestoreModal')[0].cacheFunction = undefined;
};

const generateHTMLBackupAndRestoreModal = () => {
    const processSelection = $('#backupAndRestoreProcessSelection');

    const processLists = Object.values(processes).map((process) => {
        return `<option value="${process.id}" title="${process.name_en}">${process.shown_name}</option>`;
    });

    // const uuid = create_UUID();
    const uuid = 1;
    // must set to end_proc because datetime picker use this ...
    const processSelectionId = `end_proc_${uuid}`;
    processSelection.html(
        `
<span>${i18nCommon.process}</span>
<div class="w-auto flex-grow-1">
    <select
        class="form-control select2-selection--single select-n-columns"
        name="${processSelectionId}"
        id="${processSelectionId}"
    >
        ${processLists.join(' ')}
    </select>
</div>
`,
    );

    addAttributeToElement(processSelection);
    processSelection.addClass('d-flex align-items-center');
    $(`#${processSelectionId}`).on('change', (e) => {
        processId = e.currentTarget.value;
        setProcessID();
    });
    initializeDateTimeRangePicker();
    showDataFinderButton(processId);
};

const getBackupAndRestoreInfo = () => {
    const selectDateTimeRange = $('#datetimeRangePicker').val();
    const [starting, ending] = selectDateTimeRange.split(DATETIME_PICKER_SEPARATOR);
    if (starting && ending) {
        const startTime = moment.utc(moment(starting)).format(DATETIME_FORMAT);
        const endTime = moment.utc(moment(ending)).format(DATETIME_FORMAT);
        return {
            processId: processId,
            startTime: startTime,
            endTime: endTime,
        };
    }
};

const doBackupData = async () => {
    const data = getBackupAndRestoreInfo();
    if (data.processId) {
        await fetch('/ap/api/setting/backup_data', {
            method: 'POST',
            body: JSON.stringify({
                process_id: data.processId,
                start_time: data.startTime,
                end_time: data.endTime,
            }),
        });
        showBackupDataToastr();
    }
    $(systemElements.backupAndRestoreModal).modal('hide');
    closeCalenderModal();
};

const doRestoreData = async () => {
    const data = getBackupAndRestoreInfo();
    if (data.processId) {
        await fetch('/ap/api/setting/restore_data', {
            method: 'POST',
            body: JSON.stringify({
                process_id: data.processId,
                start_time: data.startTime,
                end_time: data.endTime,
            }),
        });
        showRestoreDataToastr();
    }
    $(systemElements.backupAndRestoreModal).modal('hide');
    closeCalenderModal();
};

const hideRadioDefaultInterval = () => {
    $('#radioDefaultInterval').parent().addClass('d-none');
};

/**
 * Get Data Count For Calendar (Call api to re-get total records of backup or restore)
 */
function getDataCountForCalendar() {
    /** @type{function(): void | {
     *     tableFrom: function(): void,
     *     tableTo: function(): void,
     * }}
     * */
    const cacheFunction = document.getElementById('backupAndRestoreModal').cacheFunction;
    if (cacheFunction) {
        if (_.isFunction(cacheFunction)) {
            cacheFunction();
        } else {
            for (const func of Object.values(cacheFunction)) {
                func();
            }
        }
    }
}

/**
 * Switch Backup Restore Tab
 * @param {HTMLLIElement} liElement - a Li html element
 */
const switchBackupRestoreTab = (liElement = document.getElementById('liBackupTab')) => {
    // Set tab active
    liElement.classList.add('active');
    liElement.firstElementChild.classList.add('active');
    liElement.firstElementChild.setAttribute('aria-selected', String(true));

    // Set another tab deactivate
    const anotherLiElement = liElement.nextElementSibling ?? liElement.previousElementSibling;
    anotherLiElement.classList.remove('active');
    anotherLiElement.firstElementChild.classList.remove('active');
    anotherLiElement.firstElementChild.setAttribute('aria-selected', String(false));

    const aElement = /** @type{HTMLAnchorElement} */ liElement.firstElementChild;
    const currentTab = aElement.getAttribute('href').replace('#', '');
    $('#idFlagBKRT').val(currentTab);
    $(`#${aElement.dataset.showButtonId}`).show();
    $(`#${aElement.dataset.hideButtonId}`).hide();
    getDataCountForCalendar();
};

const showResetTransactionDataModal = () => {
    $(systemElements.resetTransactionDataModal).modal('show');
};

const resetTransactionData = () => {
    const url = '/ap/api/setting/reset_transaction_data';
    fetchWithLog(url, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        cache: 'no-cache',
    })
        .then((response) => response.clone().json())
        .then((data) => {
            // refresh Vis network
            reloadTraceConfigFromDB();
        })
        .catch((e) => {
            console.error(e);
        });
};

const showDeleteLogDataModal = () => {
    $(systemElements.deleteLogDataModal).modal('show');
};

const showDeleteDataFolderModal = () => {
    $(systemElements.deleteDataFolderModal).modal('show');
};

const deleteLogDataData = () => {
    const url = '/ap/api/setting/delete_log_data';
    fetchWithLog(url, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        cache: 'no-cache',
    })
        .then((response) => response.json())
        .then((data) => {
            console.log('Delete success:', data);
            // No need to show error because it always happens
            // if (data['errors']) {
            //     // show toast to notify user
            //     for (const error of data['errors']) {
            //         showToastrMsg(error['message'], MESSAGE_LEVEL.ERROR);
            //     }
            // }
        })
        .catch((e) => {
            console.error(e);
        });
};

const deleteDataFolder = () => {
    const url = '/ap/api/setting/delete_folder_data';
    fetchWithLog(url, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        cache: 'no-cache',
    })
        .then((response) => response.json())
        .then((data) => {
            console.log('Delete success:', data);
            // No need to show error because it always happens
            // if (data['errors']) {
            //     // show toast to notify user
            //     for (const error of data['errors']) {
            //         showToastrMsg(error['message'], MESSAGE_LEVEL.ERROR);
            //     }
            // }
        })
        .catch((e) => {
            console.error(e);
        });
};

const showZipExportModal = () => {
    $(systemElements.exportDataModal).modal('show');
};

const showZipImportModal = () => {
    $(systemElements.importDataModal).modal('show');
};

const zipExportDatabase = () => {
    const exportModeEle = $('[name=isExportMode]');
    const url = '/ap/api/setting/zip_export_database';
    const file_name = `AP_config_${moment().format('YYYYMMDDHHmmss')}.zip`;
    downloadTextFile(url, file_name, { cache: 'no-cache' });
    exportModeEle.remove();
    return false;
};

const startImportDataZipFile = () => {
    $(`${systemElements.importDatabase} .box__success span`).text('');
    $(`${systemElements.importDatabase} .box__success`).hide();
    $(systemElements.uploadBackupFile).val('');
    $(systemElements.importDatabase).modal('show');
};

const zipImportDatabase = () => {
    // TODO: Try not to use settingFile for drag drop case
    const filename = $('input[name="file"]').prop('files')[0] || settingFile;
    if (!filename.name) {
        return;
    }

    // Create a FormData object to send the file data
    const formData = new FormData();
    formData.append('file', filename);

    const url = '/ap/api/setting/zip_import_database';
    $.ajax({
        url: url, // Replace with the URL of the back-end server
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
            // response = jsonParse(response);
            // const redirectPage = response.page;
            showImportAppSettingDone();
            setTimeout(() => {
                location.reload();
            }, 1000);
        },
        error: function (xhr, status, error) {
            const msgContent = warningI18n.importAppSettingFailed;
            showToastrMsg(msgContent, MESSAGE_LEVEL.ERROR);
            console.error('Error uploading file:', error);
        },
    });
};

$(() => {
    $(systemElements.divSystemConfig)[0].addEventListener('contextmenu', baseRightClickHandler, false);
    $(systemElements.divSystemConfig)[0].addEventListener('mouseup', handleMouseUp, false);
});
