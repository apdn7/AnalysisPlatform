const systemElements = {
    divSystemConfig: '#cfgSystem',
    backupAndRestoreModal: '#backupAndRestoreModal',
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
    const [starting, ending] = selectDateTimeRange.split(
        DATETIME_PICKER_SEPARATOR,
    );
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
    const cacheFunction = document.getElementById(
        'backupAndRestoreModal',
    ).cacheFunction;
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
const switchBackupRestoreTab = (
    liElement = document.getElementById('liBackupTab'),
) => {
    // Set tab active
    liElement.classList.add('active');
    liElement.firstElementChild.classList.add('active');
    liElement.firstElementChild.setAttribute('aria-selected', String(true));

    // Set another tab deactivate
    const anotherLiElement =
        liElement.nextElementSibling ?? liElement.previousElementSibling;
    anotherLiElement.classList.remove('active');
    anotherLiElement.firstElementChild.classList.remove('active');
    anotherLiElement.firstElementChild.setAttribute(
        'aria-selected',
        String(false),
    );

    const aElement =
        /** @type{HTMLAnchorElement} */ liElement.firstElementChild;
    const currentTab = aElement.getAttribute('href').replace('#', '');
    $('#idFlagBKRT').val(currentTab);
    $(`#${aElement.dataset.showButtonId}`).show();
    $(`#${aElement.dataset.hideButtonId}`).hide();
    getDataCountForCalendar();
};

$(() => {
    $(systemElements.divSystemConfig)[0].addEventListener(
        'contextmenu',
        baseRightClickHandler,
        false,
    );
    $(systemElements.divSystemConfig)[0].addEventListener(
        'mouseup',
        handleMouseUp,
        false,
    );
});
