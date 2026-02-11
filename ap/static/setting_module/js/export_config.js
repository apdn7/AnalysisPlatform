/**
 * @file Contains components, functions, and constants for data export.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @contributor ...
 */
const MAX_NUMBER_OF_SENSOR = 100000000;
const MIN_NUMBER_OF_SENSOR = 1;
const ExportConfigItems = {
    exportConfigTable: document.getElementById('tblExportConfig'),
    exportConfigIdInput: document.getElementById('exportConfigId'),
    processListSelect: document.getElementById('processList'),
    processColumnListUl: document.getElementById('processColumnList'),
    titleInput: document.getElementById('title'),
    folderPathInput: document.getElementById('folderPath'),
    csvExtensionInput: document.getElementById('csvExtension'),
    tsvExtensionInput: document.getElementById('tsvExtension'),
    exportFromInput: document.getElementById('exportFrom'),
    exportToInput: document.getElementById('exportTo'),
    exportFrequencySelect: document.getElementById('exportFrequency'),
    deleteExportConfigButton: document.getElementById('deleteExportConfig'),
    addExportConfigBtn: document.getElementById('btnAddExportContent'),
};

const formElements = {
    endProcSelectedItem: '#end-proc-row select',
};

async function checkFolderPath(folderPath) {
    const url = `${window.location.origin}/ap/api/setting/check_folder_path`;
    const requestData = { folder_path: folderPath };
    return await fetchData(url, JSON.stringify(requestData), 'POST').catch((error) => {
        const response = JSON.parse(error.responseText);
        return { is_valid: false, message: response.message };
    });
}

async function getAllExportConfigs() {
    const url = `${window.location.origin}/ap/api/setting/export_config`;
    const responseData = await fetchData(url, undefined, 'GET').catch((error) => {
        const response = JSON.parse(error.responseText);
        showToastrMsg(response.message, MESSAGE_LEVEL.ERROR);
        return null;
    });
    if (responseData) {
        for (let [i, exportConfigJson] of Object.entries(responseData.export_configs)) {
            const exportConfig = JSON.parse(exportConfigJson);
            // dummy id for component
            const exportElement = new ExportConfigComponent(exportConfig);
            exportConfig.uuid = exportElement.uuid;
            ExportConfigs.push(exportConfig);
        }
        // $(formElements.endProcSelectedItem).trigger('change')
    }
}

const ExportConfigs = [];

document.addEventListener('DOMContentLoaded', () => {
    $(ExportConfigItems.addExportConfigBtn).on({
        click: () => {
            new ExportConfigComponent(new ExportConfig());
        },
    });

    getAllExportConfigs().then(() => {
        $(formElements.endProcSelectedItem).on({
            change: async (e) => {
                const uuid = e.currentTarget.getAttribute('data-id');
                while (true) {
                    if (!document.querySelector(`#collapseExportConfigDetail${uuid} #end-proc-row ul.list-group`)) {
                        await sleep(0.5);
                        continue;
                    } else {
                        ExportConfigs.forEach((config, index) => {
                            // update selected column
                            document
                                .querySelector(`#collapseExportConfigDetail${config.uuid} #end-proc-row ul.list-group`)
                                .querySelectorAll('li:not(.keep-header)')
                                .forEach((itemLi) => {
                                    const inputEl = itemLi.querySelector('input');
                                    const processColumnId = parseInt(inputEl.value);
                                    inputEl.checked = !!config.export_details.find(
                                        (configDetail) => configDetail.process_column_id === processColumnId,
                                    );
                                });
                            document
                                .querySelectorAll(
                                    `#collapseExportConfigDetail${config.uuid} .filter-condition-card input`,
                                )
                                .forEach((input) => {
                                    const processColumnId = parseInt(input.value);
                                    if (!isNaN(processColumnId)) {
                                        input.checked = !!config.filters.find(
                                            (filter) => filter.filter_detail_id === processColumnId,
                                        );
                                        if (input.checked) {
                                            $(input).trigger('change');
                                        }
                                    }
                                });
                        });
                        break;
                    }
                }
            },
        });
        ExportConfigs.forEach((config, index) => {
            // select process id
            const processSelector = `#collapseExportConfigDetail${config.uuid} #end-proc-row select`;
            document.querySelector(processSelector).value = config.process_id;
            $(processSelector).trigger('change');
        });
    });
});

/**
 * @typedef {Object} ExportConfigObj
 * @property {number} id
 * @property {string} title
 * @property {string} export_from
 * @property {string} export_to
 * @property {number} process_id
 * @property {number} export_frequency
 * @property {string} folder_path
 * @property {string} file_type
 * @property {Array} export_details
 * @property {number} export_column_name_type
 *
 */

class ExportConfig {
    id = undefined;
    title = '';
    export_from = '';
    export_to = '';
    process_id = 0;
    export_frequency = 180;
    folder_path = '';
    file_type = 'CSV';
    export_details = [];
    uuid = '';
    filters = [];
    export_column_name_type = 0;

    /**
     *
     * @param {ExportConfigObj} initObj
     */
    constructor(initObj) {
        Object.assign(this, initObj);
    }

    /**
     * Whether this is one time export or not
     * @returns {boolean}
     */
    exportOnlyOnce() {
        return this.export_frequency === 0;
    }

    /**
     * Initialize DataFinder based on export frequency.
     * - One time: Shows time range (From-To).
     * - Periodic: Shows start time only (From).
     * @return {DataFinder}
     */
    dataFinder() {
        // export one time shows `from` and `to`
        if (this.exportOnlyOnce()) {
            return new DataFinder(this.uuid, `data-finder-card${this.uuid}`, false, false);
        }
        // else, shows `from` only
        else {
            return new DataFinder(this.uuid, `data-finder-card${this.uuid}`, false, true);
        }
    }

    /**
     * Format displayed time in the input field.
     * @returns {string} Formatted string.
     */
    datetimeRangeFormat() {
        if (!this.export_from) {
            return '';
        }
        const from = formatDateTime(this.export_from, DATE_TIME_FMT);

        // export one time shows `from` and `to`
        if (this.exportOnlyOnce()) {
            const toDate = this.export_to ? this.export_to : new Date();
            const to = formatDateTime(toDate, DATE_TIME_FMT);
            return `${from}${DATETIME_PICKER_SEPARATOR}${to}`;
        }
        // else, shows `from` only
        return from;
    }
}

const hasGraphCfgsFilterDetails = [];

class ExportConfigComponent {
    contentDivId = '';

    constructor(exportConfig, parentDiv) {
        this.uuid = makeUID();
        exportConfig.uuid = this.uuid;
        this.exportConfig = new ExportConfig(exportConfig);
        this.parentDiv = $('#export-list-content div');
        this.contentDivId = `#end-proc-val-div-${this.uuid}`;
        this.addExportConfigContent();
        initializeDateTimeRangePicker(null, true);
        initializeDateTimePicker(null, true);
        this.initDataFinderByFrequency();

        $(`#exportFrequency${this.uuid}`).on('change', () => {
            this.setGuiDataFinderAndDateTimePickerByFrequency();
        });
    }

    initDataFinderByFrequency() {
        this.dataFinder = this.exportConfig.dataFinder();
        this.dataFinder.closeCalenderModal();
    }

    addExportConfigContent() {
        this.parentDiv.last().before(this.exportConfigHtml());
        const endProcs = genProcessDropdownData(procConfigs);
        const endProcItem = addEndProcMultiSelect(
            endProcs.ids,
            endProcs.names,
            {
                showDataType: true,
                showStrColumn: true,
                isRequired: true,
            },
            true,
            this.uuid,
        );
        endProcItem();
        addAttributeToElement();
        this.handleOnClickBtn();
        this.handleOnchangeEndProc();
    }

    handleOnchangeEndProc() {
        $(`select[name=end_proc${this.exportConfig.uuid}]`).on('change', (e) => {
            const procId = e.currentTarget.value;
            condProcOnChange(procId, this.exportConfig.uuid, '').then();
        });
    }

    i18nMsg() {
        return {
            title: $('#i18nTitle').text(),
            exportFolder: $('#i18nExportFolder').text(),
            exportFrequency: $('#i18nExportFrequency').text(),
            exportFileType: $('#i18nFiletype').text(),
            exportColumnNameType: $('#i18nExportColumnNameType').text(),
            exportSystemName: $('#i18nSystemName').text(),
            exportJapaneseName: $('#i18nJapaneseName').text(),
            exportLocalName: $('#i18nLocalName').text(),
            exportFrom: $('#i18nExportFrom').text(),
            exportTo: $('#i18nExportTo').text(),
            exportConfigDetail: $('#i18nExportConfigDetail').text(),
            i18nOnlyOnce: $('#i18nOnlyOnce').text(),
            i18nOncePer3Minutes: $('#i18nOncePer3Minutes').text(),
            i18nOncePer5Minutes: $('#i18nOncePer5Minutes').text(),
            i18nOncePer10Minutes: $('#i18nOncePer10Minutes').text(),
            i18nOncePerHour: $('#i18nOncePerHour').text(),
            i18nOncePerDay: $('#i18nOncePerDay').text(),
            i18nOncePerWeek: $('#i18nOncePerWeek').text(),
            i18nFilter: $('#i18nFilter').text(),
            i18nRegister: $('#i18nRegister').text(),
        };
    }

    exportConfigHtml() {
        return `
        <div class="card graph-navi export-content export-content-main" id="export-config-${this.uuid}">
                <div class="card-body">
                    <div class="panel-group" id="accordionExportConfigDetail${this.uuid}" role="tablist" aria-multiselectable="true">
                        <div class="panel panel-default">
                            <div id="cfgSystemForm">
                               <div class="panel-heading" role="tab" id="headingExportConfigDetail${this.uuid}">
                                   <div class="form-header">
                                       <div class="row" style="padding-top: 5px;">
                                           <div class="col-7 collapse-wrapped-row">
                                               <div class="collapse-box header-left my-0">
                                                   <a
                                                       role="button"
                                                       data-toggle="collapse"
                                                       class="btn-collapse"
                                                       data-parent="#accordionExportConfigDetail${this.uuid}"
                                                       href="#collapseExportConfigDetail${this.uuid}"
                                                       aria-expanded="true"
                                                       aria-controls="collapseExportConfigDetail${this.uuid}"
                                                   >
                                                   </a>
                                               </div>
                                               <h3 class="header-left">${this.i18nMsg().exportConfigDetail}</h3>
                                           </div>
                                       </div>
                                   </div>
                               </div>
                               <div
                                   id="collapseExportConfigDetail${this.uuid}"
                                   class="panel-collapse collapse show"
                                   role="tabpanel"
                                   aria-labelledby="headingExportConfigDetail${this.uuid}"
                                   style=""
                               >
                                   <div class="export-content-detail">
                                        <div class="row export-content-detail-process-column" id="end-proc-row">
                                            <div class="w-100"></div>
                                        </div>
                                        <div class="section">
                                           <input type="hidden" id="exportConfigId${this.uuid}" value="${this.exportConfig.id}" />
                                           ${this.filterElement()}
                                           ${this.dataFinderElement()}
                                           ${this.exportFrequencyElement()}
                                           ${this.titleInputElement()}
                                           ${this.exportFolderElement()}
                                           ${this.fileTypeElement()}
                                           <button id="saveExportConfig" onclick="ExportConfigComponent.saveExportConfig('${this.uuid}')" class="btn btn-primary">
                                               <i class="far fa-save"></i> 
                                               ${this.i18nMsg().i18nRegister}
                                           </button>
                                            <button id="deleteExportConfig${this.uuid}" class="btn-danger btn ml-2" data-uuid="${this.uuid}">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                     </div>
                               </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    handleOnClickBtn() {
        $(`#deleteExportConfig${this.uuid}`).on('click', (e) => {
            ExportConfigComponent.deleteExportConfig(this.uuid).then();
        });
    }

    filterElement() {
        return `
        <div class="card graph-navi mb-2 pt-0" id=config-export-filter-${this.exportConfig.uuid}">
                <div class="card-body">
                    <div class="panel-group" id="accordionExportConfigFilter${this.exportConfig.uuid}" role="tablist" aria-multiselectable="true">
                        <div class="panel panel-default">
                             <div class="panel-heading" role="tab" id="headingExportConfigFilter${this.exportConfig.uuid}">
                                   <div class="form-header">
                                          <div class="collapse-wrapped-row">
                                               <div class="collapse-box header-left my-0">
                                                   <a
                                                       role="button"
                                                       data-toggle="collapse"
                                                       class="btn-collapse"
                                                       data-parent="#accordionExportConfigFilter${this.exportConfig.uuid}"
                                                       href="#collapseExportConfigFilter${this.exportConfig.uuid}"
                                                       aria-expanded="true"
                                                       aria-controls="collapseExportConfigFilter${this.exportConfig.uuid}"
                                                   >
                                                   </a>
                                               </div>
                                               <h5 class="header-left">${this.i18nMsg().i18nFilter}</h5>
                                           </div>
                                   </div>
                               </div>
                             <div
                                   id="collapseExportConfigFilter${this.exportConfig.uuid}"
                                   class="panel-collapse collapse show"
                                   role="tabpanel"
                                   aria-labelledby="headingExportConfigFilter${this.exportConfig.uuid}"
                                   style=""
                               >
                                 <div class="w-100 d-flex filter-condition-card filter-condition-card${this.exportConfig.uuid}">
                                     <div class="proc-line" id="cond-proc-line-div-${this.exportConfig.uuid}"></div>
                                      <div id="cond-proc-machine-div-${this.exportConfig.uuid}" style="display: none;"></div>
                                       <div id="cond-proc-partno-div-${this.exportConfig.uuid}"></div>
                                       <div id="cond-proc-others-div-${this.exportConfig.uuid}"></div>
                                 </div>
                                 
                               </div>
                        </div>
                    </div>
                </div>
            </div>
               
        `;
    }

    titleInputElement() {
        return `
             <div class="form-group">
                 <label for="title" class="section-title d-flex">
                     <h5>${this.i18nMsg().title}</h5>
                     <span style="color: yellow;">*</span>
                 </label>
                 <input type="text" name="title${this.uuid}" value="${this.exportConfig.title}" class="form-control" id="title${this.uuid}" />
             </div>
        `;
    }

    exportFolderElement() {
        return `
        <div class="form-group">
             <label for="folderPath" class="section-title d-flex">
                <h5>${this.i18nMsg().exportFolder}</h5>
                <span style="color: yellow;">*</span>
               </label>
               <input
               type="text"
               name="folderPath${this.uuid}"
               class="form-control"
               id="folderPath${this.uuid}"
               value="${this.exportConfig.folder_path}"
               placeholder="Z:\\path\\to\\folder"
               />
        </div>`;
    }

    fileTypeElement() {
        return `
                 <div class="form-group">
                    <div class='row w-100'>
                         <div class="col-md-6 d-flex no-padding">
                             <label for="csvExtension${this.uuid}" class="w-40 section-title file-type-label">
                                   <h5>${this.i18nMsg().exportFileType}</h5>
                               </label>
                             <div class="w-60 export-checkbox-content">
                                   <div class="custom-control custom-radio">
                                       <input
                                           type="radio"
                                           name="fileType${this.uuid}"
                                           class="custom-control-input"
                                           id="csvExtension${this.uuid}"
                                           value="CSV"
                                           ${this.exportConfig.file_type == 'CSV' ? 'checked' : ''}
                                       />
                                       <label class="custom-control-label" for="csvExtension${this.uuid}">
                                           <span class="sub-label">CSV</span>
                                       </label>
                                   </div>
            
                                   <div class="custom-control custom-radio">
                                       <input
                                           type="radio"
                                           name="fileType${this.uuid}"
                                           class="custom-control-input"
                                           id="tsvExtension${this.uuid}"
                                           value="TSV"
                                           ${this.exportConfig.file_type == 'TSV' ? 'checked' : ''}
                                       />
                                       <label class="custom-control-label" for="tsvExtension${this.uuid}">
                                           <span class="sub-label">TSV</span>
                                       </label>
                                   </div>
                             </div>
                        </div>
                        
                        <div class="col-md-6 d-flex ms-auto no-padding">
                            ${this.exportColumnNameTypeElement()}
                        </div>
                   
                    </div>
               </div>

        `;
    }

    exportColumnNameTypeElement() {
        return `
                <label for="exportColumnNameType${this.uuid}" class="section-title w-50 d-flex align-items-center">
                   <h5>${this.i18nMsg().exportColumnNameType}</h5>
                </label>
                <select 
                    type="select"
                    name="exportColumnNameType${this.uuid}"
                    class="form-control w-55 export-column-type-option"
                    id="exportColumnNameType${this.uuid}"
                >
                    <option value="0" ${this.exportConfig.export_column_name_type === 0 ? 'selected' : ''}>${this.i18nMsg().exportSystemName}</option>
                    <option value="1" ${this.exportConfig.export_column_name_type === 1 ? 'selected' : ''}>${this.i18nMsg().exportJapaneseName}</option>
                    <option value="2" ${this.exportConfig.export_column_name_type === 2 ? 'selected' : ''}>${this.i18nMsg().exportLocalName}</option>
                </select>`;
    }

    exportFrequencyElement() {
        return `
         <div class="form-group">
           <label for="exportFrequency${this.uuid}" class="section-title">
               <h5>${this.i18nMsg().exportFrequency}</h5>
           </label>
           <div class="w-100 d-flex">
                <select
               type="select"
               name="exportFrequency${this.uuid}"
               class="form-control  frequency-selection"
               id="exportFrequency${this.uuid}"
           >
               <option value="0" ${this.exportConfig.export_frequency === 0 ? 'selected' : ''}>${this.i18nMsg().i18nOnlyOnce}</option>
               <option value="180" ${this.exportConfig.export_frequency === 180 ? 'selected' : ''}>${this.i18nMsg().i18nOncePer3Minutes}</option>
               <option value="600" ${this.exportConfig.export_frequency === 600 ? 'selected' : ''}>${this.i18nMsg().i18nOncePer10Minutes}</option>
           </select>
            <div id="date-time-input-form${this.exportConfig.uuid}" class="ml-3 w-100">
                    ${this.exportDatetimeRangeElement()}
            </div>
         </div>
         </div>
       </div>`;
    }

    exportDatetimeRangeElement() {
        const count = this.uuid;
        const inputClass = this.exportConfig.exportOnlyOnce() ? DATETIME_RANGE_PICKER_CLASS : DATETIME_PICKER_CLASS;
        const inputName = this.exportConfig.exportOnlyOnce() ? `DATETIME-RANGE${count}` : `exportDatetime${count}`;
        const placeholder = this.exportConfig.exportOnlyOnce()
            ? `YYYY-MM-DD HH:MM${DATETIME_PICKER_SEPARATOR}YYYY-MM-DD HH:MM`
            : 'YYYY-MM-DD HH:MM';

        const inputId = `exportDatetimeRange${count}`;
        const inputValue = this.exportConfig.datetimeRangeFormat();

        return `
            <div class="form-group position-relative mb-0">
                <label for="${inputId}" class="section-title inline-section-title d-flex">
                    <h5>${this.i18nMsg().exportFrom}</h5>
                    <span style="color: yellow;">*</span>
                </label>
                <input
                    type="text"
                    name="${inputName}"
                    class="form-control ${inputClass}"
                    is-show-time-picker="True"
                    is-show-recent-dates="True"
                    data-finder-id="${count}"
                    id="${inputId}"
                    placeholder="${placeholder}"
                    value="${inputValue}"
                />
                ${this.dataFinderButton()}
            </div>
        `;
    }

    setGuiDataFinderAndDateTimePickerByFrequency() {
        // get current export_frequency
        const exportFrequency = parseInt($(`#exportFrequency${this.uuid}`).val());
        this.exportConfig.export_frequency = exportFrequency;

        // Clear old element
        $(`#date-time-input-form${this.exportConfig.uuid}`).html('');

        // Re-render new HTML
        const newHtml = this.exportDatetimeRangeElement();
        $(`#date-time-input-form${this.exportConfig.uuid}`).append(newHtml);

        initializeDateTimePicker(null, true);
        initializeDateTimeRangePicker(null, true);

        // Re-init DataFinder button
        this.initDataFinderByFrequency();

        $(`#exportDatetimeRange${this.uuid}`).trigger('change');
    }

    dataFinderButton() {
        return `
             <button
                type="button"
                id="showDataFinderBtn${this.uuid}"
                name="dataFinderBtn${this.uuid}"
                style="position: absolute; right: 2px;"
                class="btn btn-sm btn-primary"
              >
                        Data finder
              </button>
        `;
    }

    dataFinderElement() {
        return `
             <div id="data-finder-card${this.uuid}" class="data-finder-card table-bordered graph-navi mb-2" style="display: none; z-index: 9999999999"></div>
        `;
    }

    static removeExportConfigContent(uuid) {
        $(`#export-config-${uuid}`).remove();
    }

    static getExportConfigId(uuid) {
        const id = $(`#exportConfigId${uuid}`).val();
        return isNaN(id) ? null : id;
    }

    static setExportConfigId(uuid, value) {
        return $(`#exportConfigId${uuid}`).val(value);
    }

    static async deleteExportConfig(uuid) {
        const exportConfigId = ExportConfigComponent.getExportConfigId(uuid);
        if (!exportConfigId || isNaN(exportConfigId)) {
            ExportConfigComponent.removeExportConfigContent(uuid);
            return;
        }

        fetch(`/ap/api/setting/export_config/${exportConfigId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        })
            .then((response) => {
                alert('Deleted export config successfully');
                ExportConfigComponent.removeExportConfigContent(uuid);
            })
            .catch(() => {
                const response = JSON.parse(error.responseText);
                showToastrMsg(response.message, MESSAGE_LEVEL.ERROR);
            });
    }

    static getExportFromToUTC(uuid) {
        let dateTimeRange = $(`#exportDatetimeRange${uuid}`).val();
        let [exportFrom, exportTo] = dateTimeRange.split(`${DATETIME_PICKER_SEPARATOR}`);

        exportTo = exportTo && convertLocalToUTC(exportTo);
        exportFrom = exportFrom && convertLocalToUTC(exportFrom);
        return [exportFrom, exportTo];
    }

    static getFiltersDetails(uuid) {
        const filterInput = $(`.filter-condition-card${uuid} input:checked`);
        return [...filterInput]
            .map((input) => {
                return {
                    filter_detail_id: Number(input.value),
                };
            })
            .filter((val) => !isNaN(val.filter_detail_id));
    }

    static getExportDataFromContent(uuid) {
        const columnItems = getEndProcVariableSelected($(`#end-proc-val-div-${uuid}`));

        const selectedProc = $(`#end-proc-process-${uuid}`);
        const [exportFrom, exportTo] = ExportConfigComponent.getExportFromToUTC(uuid);
        const requestData = {
            process_id: parseInt(selectedProc[0].value),
            export_details: columnItems.map((item) => {
                return { process_column_id: $(`#${item}`)[0].value };
            }),
            filters: ExportConfigComponent.getFiltersDetails(uuid),
            title: $(`#title${uuid}`).val(),
            folder_path: $(`#folderPath${uuid}`).val(),
            file_type: $(`#tsvExtension${uuid}`).prop('checked') ? EXPORT_TYPE.TSV : EXPORT_TYPE.CSV,
            export_from: exportFrom,
            export_to: exportTo,
            export_frequency: $(`#exportFrequency${uuid}`).val(),
            id: ExportConfigComponent.getExportConfigId(uuid),
            export_column_name_type: $(`#exportColumnNameType${uuid}`).val(),
        };

        return new ExportConfig(requestData);
    }

    static async saveExportConfig(uuid) {
        if (!(await ExportConfigComponent.validateExportConfig(uuid))) return;
        const requestData = ExportConfigComponent.getExportDataFromContent(uuid);

        const url = `${window.location.origin}/ap/api/setting/export_config`;
        const responseData = await fetchData(url, JSON.stringify(requestData), 'POST').catch((err) => {
            showToastrMsg('Could not save the export config', MESSAGE_LEVEL.ERROR);
        });
        if (responseData) {
            const newExportConfig = JSON.parse(responseData.export_config);
            const indexItem = ExportConfigs.indexOf(
                ExportConfigs.find((exportConfig) => exportConfig.id === newExportConfig.id),
            );
            ExportConfigComponent.setExportConfigId(uuid, newExportConfig.id);
            if (indexItem === -1) {
                ExportConfigs.push(newExportConfig);
            } else {
                ExportConfigs[indexItem] = newExportConfig;
            }
            showToastrMsg('Save data successfully', MESSAGE_LEVEL.INFO);
        }
    }

    static async validateExportConfig(uuid) {
        let isValid = true;
        const exportConfig = ExportConfigComponent.getExportDataFromContent(uuid);
        if (exportConfig.title == null || exportConfig.title.trim() === '') {
            isValid = false;
            showToastrMsg('Title is required', MESSAGE_LEVEL.ERROR);
        }
        if (exportConfig.folder_path == null || exportConfig.folder_path.trim() === '') {
            isValid = false;
            showToastrMsg('Folder path is required', MESSAGE_LEVEL.ERROR);
        } else {
            const status = await checkFolderPath(exportConfig.folder_path);
            if (!status.is_valid) {
                isValid = false;
                showToastrMsg(status.message, MESSAGE_LEVEL.ERROR);
            }
        }
        if (exportConfig.export_from == null || exportConfig.export_from.trim() === '') {
            isValid = false;
            showToastrMsg('Export from is required', MESSAGE_LEVEL.ERROR);
        }
        if (exportConfig.process_id == null || isNaN(exportConfig.process_id)) {
            isValid = false;
            showToastrMsg('Process is required', MESSAGE_LEVEL.ERROR);
        }
        if (exportConfig.export_details.length === 0) {
            isValid = false;
            showToastrMsg('At least one column is required', MESSAGE_LEVEL.ERROR);
        }
        // validate export time range
        if (
            exportConfig.export_from &&
            exportConfig.export_to &&
            moment(exportConfig.export_from) >= moment(exportConfig.export_to)
        ) {
            isValid = false;
            showToastrMsg('Invalid time range', MESSAGE_LEVEL.ERROR);
        }

        return isValid;
    }
}
