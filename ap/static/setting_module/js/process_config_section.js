/**
 * @file Manages the configuration settings for rendering and controlling V2 process configs.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 */

/**
 * A process column config object.
 * @typedef {{
 *    id: number,
 *    data_type: string,
 *    raw_data_type: string,
 *    name_local: string | null,
 *    format: string | null,
 *    is_auto_increment: boolean | null,
 *    name_en: string,
 *    column_raw_name: string,
 *    column_name: string,
 *    process_id: number,
 *    bridge_column_name: string,
 *    order: number | null,
 *    function_details: *[],
 *    unit: string | null,
 *    name_jp: string,
 *    column_type: number,
 *    is_get_date: boolean,
 *    is_dummy_datetime: boolean,
 *    is_file_name: boolean?,
 *    is_serial_no: boolean,
 *    is_show: boolean,
 *    is_master_col: boolean,
 *    is_checked: boolean?,
 *    old_name_jp: string?,
 *    old_system_name: string?,
 *    is_generated_datetime: boolean?,
 * }} ProcessColumnConfig
 */

/**
 * A datasource config object.
 * @typedef {{
 *    name: string,
 *    type: string,
 *    master_type: string,  // 'V2' or 'OTHER'
 *    csv_detail: {
 *        directory: string,
 *        delimiter: string,
 *        csv_columns: ProcessColumnConfig[],
 *        is_file_path: boolean?,
 *    },
 * }} DatasourceConfig
 */

/**
 * A process config object.
 * @typedef {{
 *    columns: ProcessColumnConfig[],
 *    id: number,
 *    shown_name: string,
 *    datetime_format: string | null,
 *    name_local: string,
 *    table_name: string,
 *    name_en: string,
 *    comment: string | null,
 *    order: number | null,
 *    is_show_file_name: boolean | null,
 *    name_jp: string,
 *    name: string,
 *    data_source: string | null,
 *    is_csv: boolean | null,
 *    origin_name: string?,  // This field serve for V2 processes
 * }} ProcessConfig
 */

/**
 * An object of process response data.
 * @typedef {{
 *    col: {
 *        data_type: string,
 *        is_auto_increment: boolean | null,
 *        is_get_date: boolean | null,
 *        name: string,
 *        romaji: string,
 *    }[],
 *    rows: {}[],  // sample data
 *    cols_duplicated: boolean,
 *    col_id_in_funcs: [],
 *    data: ProcessConfig,  // a process config object
 *    status: number,
 *    tables: string[],
 * }} ProcessData
 */

/**
 * An object of OTHER process data.
 * @typedef {{
 *    cols: {}[],
 *    rows: {}[],
 *    cols_duplicated: boolean,
 *    fail_limit: string,
 *    has_ct_col: boolean,
 *    dummy_datetime_idx: string,
 *    data_group_type: {},
 *    is_rdb: boolean,
 * }} OtherProcessData
 */

/**
 * An object of response Latest Record process data.
 * @typedef {{
 *    processConfigs: (ProcessData | OtherProcessData)[],
 *    datasourceConfig: DatasourceConfig,
 * }} LatestRecordOfProcess
 */

/**
 * An object of process config for calling API
 * @typedef {{
 *    name_local: string,
 *    columns: ProcessColumnConfig[],
 *    name: string,
 *    name_jp: string,
 *    comment: null,
 *    id: number,
 *    name_en: string,
 * }} RequestProcessConfig
 */

/**
 * An object of process config (used & unused) for calling API
 * @typedef {{
 *    proc_config: RequestProcessConfig,
 *    unused_columns: RequestProcessConfig,
 * }} RequestProcessData
 */

/**
 * An HTML object of section for process config
 * @typedef {HTMLDivElement & {__object__: ProcessConfigSection}} HTMLDivForSectionElement
 */

/**
 * Convert string HTML to element instance of HTML
 * @param {string} html - a string HTML of element
 * @return {*|HTMLElement} an element HTML
 */
function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

/**
 * Class of Process Config Section
 */
class ProcessConfigSection {
    /**
     * Constructor
     * @param {HTMLDivForSectionElement} sectionHTMLObject - a div contains a process config information
     */
    constructor(sectionHTMLObject) {
        /**
         * Section html object of target process config
         * @type {HTMLDivElement}
         */
        this.sectionHTMLObject = sectionHTMLObject;

        /**
         * Process identify number
         * @type {number} - process id
         */
        this.processId = !(sectionHTMLObject.dataset.processId == null || sectionHTMLObject.dataset.processId === '')
            ? parseInt(sectionHTMLObject.dataset.processId, 10)
            : null;

        /**
         * Only exist for main section process config.
         *
         * Note: for extend section process config, there is not datasource name
         * @type {HTMLInputElement}
         */
        this.datasourceNameElement = sectionHTMLObject.querySelector(`#databaseName`);

        /**
         * Is Main Section
         * @type {boolean} - true: this object is main section, otherwise: extend section
         */
        this.isMainSection = this.datasourceNameElement != null;

        /**
         * An id suffix string that used to query to find elements in section HTML
         * @type {string}
         */
        this.idSuffix = !this.isMainSection ? '_' + this.processId : '';

        /**
         * Table of process config
         * @type {HTMLTableElement}
         */
        this.processConfigTableElement = sectionHTMLObject.querySelector(`#processColumnsTable${this.idSuffix}`);

        /**
         * Table of sample data process config
         * @type {HTMLTableElement}
         */
        this.processConfigSampleDataTableElement = sectionHTMLObject.querySelector(
            `#processColumnsTableSampleData${this.idSuffix}`,
        );

        /**
         * Input HTML of process System Name
         * @type {HTMLInputElement}
         */
        this.processSystemNameElement = sectionHTMLObject.querySelector(`#processName${this.idSuffix}`);

        /**
         * Input HTML of process Japanese Name
         * @type {HTMLInputElement}
         */
        this.processJapaneseNameElement = sectionHTMLObject.querySelector(`#processJapaneseName${this.idSuffix}`);

        /**
         * Input HTML of process Local Name
         * @type {HTMLInputElement}
         */
        this.processLocalNameElement = sectionHTMLObject.querySelector(`#processLocalName${this.idSuffix}`);

        /**
         * Input HTML of process Origin Name
         *
         * This hidden input field serve for V2 processes
         * @type {HTMLInputElement}
         */
        this.processOriginNameElement = sectionHTMLObject.querySelector(`#processOriginName${this.idSuffix}`);

        /**
         * Get/Set process system name
         * @type {{
         *    set: (function(string, boolean): void),
         *    get: (function(): string),
         *    getOriginalValue: (function(): string),
         * }}
         */
        this.processSystemName = {
            get: () => this.processSystemNameElement.value,
            getOriginalValue: () => this.processSystemNameElement.dataset.originalValue,
            set: (name, isAlsoSetOriginalData) => {
                this.processSystemNameElement.value = name ?? '';
                if (isAlsoSetOriginalData) {
                    this.processSystemNameElement.dataset.originalValue = name;
                }
            },
        };

        /**
         * Get/Set process japanese name
         * @type {{
         *    set: (function(string, boolean): void),
         *    get: (function(): string),
         *    getOriginalValue: (function(): string),
         * }}
         */
        this.processJapaneseName = {
            get: () => this.processJapaneseNameElement.value,
            getOriginalValue: () => this.processJapaneseNameElement.dataset.originalValue,
            set: (name, isAlsoSetOriginalData) => {
                this.processJapaneseNameElement.value = name ?? '';
                if (isAlsoSetOriginalData) {
                    this.processJapaneseNameElement.dataset.originalValue = name;
                }
            },
        };

        /**
         * Get/Set process local name
         * @type {{
         *    set: (function(string, boolean): void),
         *    get: (function(): string),
         *    getOriginalValue: (function(): string),
         * }}
         */
        this.processLocalName = {
            get: () => this.processLocalNameElement.value,
            getOriginalValue: () => this.processLocalNameElement.dataset.originalValue,
            set: (name, isAlsoSetOriginalData) => {
                this.processLocalNameElement.value = name ?? '';
                if (isAlsoSetOriginalData) {
                    this.processLocalNameElement.dataset.originalValue = name;
                }
            },
        };

        /**
         * Get/Set process origin name
         * @type {{
         *    set: (function(string): void),
         *    get: (function(): string),
         * }}
         */
        this.processOriginName = {
            get: () => this.processOriginNameElement.value,
            set: (name) => (this.processOriginNameElement.value = name ?? ''),
        };

        /**
         * Get/Set data source name
         * @type {{
         *    set: (function(string, boolean): void),
         *    get: (function(): string),
         *    getOriginalValue: (function(): string),
         * }}
         */
        this.datasourceName = {
            get: () => this.datasourceNameElement?.value,
            getOriginalValue: () => this.datasourceNameElement.dataset.originalValue,
            set: (name, isAlsoSetOriginalData) => {
                if (this.datasourceNameElement) {
                    this.datasourceNameElement.value = name ?? '';
                    if (isAlsoSetOriginalData) {
                        this.datasourceNameElement.dataset.originalValue = name;
                    }
                }
            },
        };

        this.dummyDatetimeColumnAndData = null;
        sectionHTMLObject.__object__ = this;
    }

    /**
     * Collect all information of process configuration
     * @return {RequestProcessConfig}
     */
    collectProcessConfig = (tableId) => {
        const tableEle = document.getElementById(tableId);
        const procDateTimeFormatCheckboxEle = getDatetimeFormatCheckboxFromElement(tableEle);
        const procDateTimeFormatInput = getDatetimeFormatInputFromElement(tableEle);
        const isCheckedDatetimeFormat = procDateTimeFormatCheckboxEle[0].checked;

        const datetimeFormat = isCheckedDatetimeFormat ? procDateTimeFormatInput.val().trim() : null;
        const result = {
            id: this.processId,
            name: this.processSystemName.get(),
            name_en: this.processSystemName.get(),
            name_jp: this.processJapaneseName.get(),
            name_local: this.processLocalName.get(),
            origin_name_en: this.processSystemName.getOriginalValue(),
            origin_name_jp: this.processJapaneseName.getOriginalValue(),
            origin_name_local: this.processLocalName.getOriginalValue(),
            origin_name: this.processOriginName.get(),
            comment: null,
            columns: procColumnsData(tableId, true),
            datetime_format: datetimeFormat,
        };

        // No need fields in this time
        delete result['origin_name_jp'];
        delete result['origin_name_local'];
        delete result['origin_name_en'];

        return result;
    };

    /**
     * Split process config to 2 below paths:
     * - process config with used columns (checked columns)
     * - process config with unused columns (uncheck columns)
     * @param {RequestProcessConfig} processConfig - a process config object for calling api
     * @return {RequestProcessData} - an object contains process columns infos
     */
    static splitUsedColumnAndUnusedColumn(processConfig) {
        const usedProcessConfig = { ...processConfig };
        const unusedProcessConfig = { ...processConfig };

        usedProcessConfig.columns = processConfig.columns.filter((columnConfig) => columnConfig.is_checked);
        unusedProcessConfig.columns = processConfig.columns.filter((columnConfig) => !columnConfig.is_checked);

        return {
            proc_config: usedProcessConfig,
            unused_columns: unusedProcessConfig,
        };
    }

    /**
     * Render element to UI (append to DOM object)
     */
    render() {
        const procSettingModal = document.getElementById('procSettingModal');
        const wrapperDiv = procSettingModal.closest('div.section').parentElement;
        wrapperDiv.append(this.sectionHTMLObject);
    }

    /**
     * Add event listeners for all controls such as input, button, etc.
     */
    injectEvents() {
        // Add events for data type dropdown list
        const dataTypeDropdownElement = this.sectionHTMLObject.querySelectorAll('div.config-data-type-dropdown');
        DataTypeDropdown_Controller.injectEvent(dataTypeDropdownElement);

        // Add events for scroll buttons
        handleScrollSampleDataTableCore(
            $(this.processConfigSampleDataTableElement.lastElementChild),
            $(this.sectionHTMLObject.querySelector(`#sampleDataScrollToLeft${this.idSuffix}`)),
            $(this.sectionHTMLObject.querySelector(`#sampleDataScrollToLeftOneStep${this.idSuffix}`)),
            $(this.sectionHTMLObject.querySelector(`#sampleDataScrollToRight${this.idSuffix}`)),
            $(this.sectionHTMLObject.querySelector(`#sampleDataScrollToRightOneStep${this.idSuffix}`)),
            $(this.sectionHTMLObject.querySelector('.proc-config-content')),
        );

        // Add event hover for table rows
        handleHoverProcessColumnsTableRow(
            this.processConfigTableElement.lastElementChild,
            this.processConfigSampleDataTableElement.lastElementChild,
        );

        // Add event to convert Half-width to Full-width inputs
        convertTextH2Z(this.processConfigTableElement); // column system|japanese|local|format inputs
        convertTextH2Z(this.sectionHTMLObject.querySelector('div[id^="processGeneralInfo"]'));

        // Add event to remove Not alphabet characters for system name inputs
        handleEnglishNameChange($(this.processSystemNameElement));
        handleEnglishNameChange($(this.processConfigTableElement.querySelectorAll('input[name="systemName"]')));
    }

    /**
     * @param {number} processId
     * @return {string}
     */
    static processColumnsTableId(processId) {
        return `${procModalElements.procConfigTableName}_${processId}`;
    }

    /**
     * Generate Process Config Section
     * @param {ProcessConfig} processConfig - a process config object
     * @param {{}[]} sampleDataRows - a list of sample data
     * @return ProcessConfigSection - a process config section object
     */
    static async createProcessConfigSectionForExtend(
        processConfig,
        sampleDataRows,
        uniqueDataCategory,
        uniqueDataReal,
        uniqueDataInt,
        uniqueDataIntCat,
    ) {
        const mainEle = document.getElementById('procPreviewSection');

        const extendSectionDivHTML = this.#generateProcessConfigHeaderHTML(processConfig);
        /** @type {HTMLDivForSectionElement} */
        const sectionHTMLObject = htmlToElement(extendSectionDivHTML);
        sectionHTMLObject.__object__ = new ProcessConfigSection(sectionHTMLObject);

        // append section html.
        mainEle.appendChild(sectionHTMLObject);

        // generate table
        const tableId = this.processColumnsTableId(processConfig.id);

        // set all columns to negative.
        const columns = processConfig.columns.map((column, index) => {
            const colId = column.id != null ? column.id : -index - 1;
            return {
                ...column,
                id: colId,
            };
        });

        await generateProcessList(
            tableId,
            columns,
            sampleDataRows,
            uniqueDataCategory,
            uniqueDataReal,
            uniqueDataInt,
            uniqueDataIntCat,
            {
                fromRegenerate: true,
                autoCheckSerial: true,
                registerByFile: true,
            },
        );
        preventSelectAll(renderedCols);

        // update select all check box after update column checkboxes
        updateSelectAllCheckbox(tableId);

        // bind select columns with context menu
        bindSelectColumnsHandler();
        $(`#autoSelect_${processConfig.id}`).prop('checked', true).change();
        // Default uncheck file name
        $(`#isShowFileName_${processConfig.id}`).prop('checked', false).trigger('change');

        handleEnglishNameChange($(`#processName_${processConfig.id}`));
        addEventInToolsBar(tableId, true);
    }

    /**
     * Generate HTML of section process config
     * @private
     * @param {ProcessConfig} processConfig - a process config object
     * @param {string} tableId - id of table
     * @return {string} - a string HTML of section process config
     */
    static #generateProcessConfigHeaderHTML(processConfig) {
        return `
<div class="extend-section" id="procSettingModalBody_${processConfig.id}" data-process-id="${processConfig.id}">
   <div class="config-section">
      <div class="col-xl-10 col-md-12 pl-0">
        <form id="procCfgForm_${processConfig.id}" onsubmit="return false;">
           <div id="processGeneralInfo_${processConfig.id}" name="processGeneralInfo">
              <div class="row">
                 <div class="col-sm-12">
                    <div class="form-group row">
                       <label for="" class="col-sm-2 col-form-label label-right">
                          <h5>${i18n.processName}</h5>
                       </label>
                       <div class="col-sm-10 process-name-group">
                          <div class="form-group d-flex align-items-center">
                             <label class="mr-2 mb-0" for="processName_${processConfig.id}" title="${i18n.systemNameHoverMsg}">
                                 <span class="hint-text">System</span>
                                 <span style="color: yellow;">*</span>
                             </label>
                             <input
                                type="text"
                                name="processName"
                                class="form-control"
                                style="flex: 1"
                                value="${processConfig.name_en ?? ''}"
                                data-original-value="${processConfig.name_en ?? ''}"
                                id="processName_${processConfig.id}"
                                />
                             <input
                                type="hidden"
                                name="processOriginName"
                                value="${processConfig.origin_name ?? ''}"
                                id="processOriginName_${processConfig.id}"
                                />
                          </div>
                          <div class="form-group d-flex align-items-center">
                             <label class="mr-2 mb-0" for="processJapaneseName_${processConfig.id}">${i18n.japaneseName}</label>
                             <input
                                type="text"
                                name="processJapaneseName"
                                onchange="handleEmptySystemNameJP(this, procModalElements.procsMasterName)"
                                class="form-control"
                                style="flex: 1"
                                value="${processConfig.name_jp ?? ''}"
                                data-original-value="${processConfig.name_jp ?? ''}"
                                id="processJapaneseName_${processConfig.id}"
                                />
                          </div>
                          <div class="form-group d-flex align-items-center">
                             <label class="mr-2 mb-0" for="processLocalName_${processConfig.id}">${i18n.localName}</label>
                             <input
                                type="text"
                                name="processLocalName"
                                onchange="handleEmptySystemName(this, procModalElements.procsMasterName)"
                                class="form-control"
                                style="flex: 1"
                                value="${processConfig.name_local ?? ''}"
                                data-original-value="${processConfig.name_local ?? ''}"
                                id="processLocalName_${processConfig.id}"
                                />
                          </div>
                          <span
                             id="processName-error-msg_${processConfig.id}"
                             class="error text-danger"
                             style="display: none; text-align: left; font-size: smaller;"
                             >
                             ${i18n.alreadyRegistered}
                          </span>
                       </div>
                    </div>
                    <input type="hidden" name="processID" value="" class="already-convert-hankaku">
                    <input type="hidden" name="processDsID" value="" class="already-convert-hankaku">
                 </div>
              </div>
           </div>
        </form>
      </div>
   </div>
   <div class="preview-section position-relative" id="procSettingModal_${processConfig.id}">
       <div class="row mx-2 d-flex justify-content-between align-items-center mt-2 position-relative">
                    <div class="d-flex justify-content-between align-items-center">
                        <div id="selectAllColumn_${processConfig.id}" class="custom-control custom-checkbox mr-3" style="">
                            <input
                                type="checkbox"
                                class="custom-control-input"
                                id="selectAllSensor_${processConfig.id}"
                                onchange="handleCheckAutoAndAllSelect(this, false)"
                            />
                            <label class="custom-control-label" for="selectAllSensor_${processConfig.id}">${i18n.selectAll}</label>
                        </div>
                        <div id="autoSelectAllColumn_${processConfig.id}" class="custom-control custom-checkbox" style="">
                            <input
                                type="checkbox"
                                class="custom-control-input"
                                id="autoSelect_${processConfig.id}"
                                onchange="handleCheckAutoAndAllSelect(this, true)"
                            />
                            <label class="custom-control-label" for="autoSelect_${processConfig.id}">${i18n.autoSelect}</label>
                        </div>
                        <div class="process-column-checked ml-3">
                            <div class="total-checked-columns">
                                <span id="totalCheckedColumn_${processConfig.id}">0</span>
                                <span>/</span>
                                <span id="totalColumns_${processConfig.id}">0</span>
                            </div>
                        </div>
                        <div class="d-flex ml-3">
                            <input
                                class="form-control"
                                id="processConfigModalSearchInput_${processConfig.id}"
                                placeholder="${i18n.search}.."
                            />
                            <button type="button" id="processConfigModalSetBtn_${processConfig.id}" class="btn simple-btn btn-setting">
                                Set
                            </button>
                            <button type="button" id="processConfigModalResetBtn_${processConfig.id}" class="btn simple-btn btn-setting">
                                Reset
                            </button>
                        </div>
                        <div id="showFileNameCol_${processConfig.id}" class="custom-control custom-checkbox ml-2">
                            <input
                                type="checkbox"
                                class="custom-control-input"
                                name="isShowFileName"
                                id="isShowFileName_${processConfig.id}"
                            />
                            <label
                                class="custom-control-label hint-text"
                                for="isShowFileName_${processConfig.id}"
                                title="${i18n.fileNameHoverMsg}"
                                >${i18n.fileName}</label
                            >
                        </div>
                        <div id="procDateTimeFormatCheckbox_${processConfig.id}" class="custom-control custom-checkbox ml-5">
                            <input
                                type="checkbox"
                                class="custom-control-input"
                                name="toggleProcDatetimeFormat"
                                id="toggleProcDatetimeFormat_${processConfig.id}"
                                onchange="handleProcDatetimeFormatCheckbox(this)"
                                data-observer=""
                            />
                            <label
                                class="custom-control-label hint-text"
                                for="toggleProcDatetimeFormat_${processConfig.id}"
                                title="${i18n.procDatetimeFormatHoverMsg}"
                                >${i18n.procDatetimeFormat}:</label
                            >
                        </div>
                        <div id="procDateTimeFormatInput_${processConfig.id}" class="d-flex ml-1">
                            <input
                                class="form-control"
                                name="procDatetimeFormat"
                                id="procDatetimeFormat_${processConfig.id}"
                                aria-label="procDatetimeFormat"
                                data-observer=""
                                onchange="handleProcDatetimeFormatInput(this)"
                            />
                        </div>
                        <div class="ml-3">
                            <label
                                class="mb-0 mr-2"
                                title="{{ _('It is possible to choose between displaying the values of each record or the unique values of each column in the sample data') }}"
                            >
                                <span class="hint-text">${i18n.sampleDataLabel}</span>
                            </label>
                            <div class="custom-control custom-radio custom-control-inline">
                                <input
                                    type="radio"
                                    class="custom-control-input"
                                    id="sampleDataRecords"
                                    name="sampleDataDisplayMode"
                                    value="records"
                                    data-observer
                                    onchange="changeSampleDataDisplayMode(this)"
                                    checked="checked"
                                />
                                <label class="custom-control-label" for="sampleDataRecords">${i18n.recordsDisplayModeLabel}</label>
                            </div>
                            <div class="custom-control custom-radio custom-control-inline">
                                <input
                                    type="radio"
                                    class="custom-control-input"
                                    id="sampleDataUnique"
                                    name="sampleDataDisplayMode"
                                    value="unique"
                                    data-observer
                                    onchange="changeSampleDataDisplayMode(this)"
                                />
                                <label class="custom-control-label" for="sampleDataUnique"
                                    >${i18n.uniqueDisplayModeLabel}</label
                                >
                            </div>
                        </div>
                    </div>
                    <div id="refactorProcSetting">
                        <div class="scroll-content">
                            <span id="sampleDataScrollToLeft"><i class="fa fa-angle-double-left"></i></span>
                            <span id="sampleDataScrollToLeftOneStep"><i class="fa fa-angle-left"></i></span>
                            <span id="sampleDataScrollToRightOneStep"><i class="fa fa-angle-right"></i></span>
                            <span id="sampleDataScrollToRight"><i class="fa fa-angle-double-right"></i></span>
                        </div>
                        <button
                            name="downloadProcessConfig"
                            type="button"
                            class="btn p-0 top-index"
                            data-toggle="tooltip"
                            id="procSettingModalDownloadAllBtn_${processConfig.id}"
                            data-placement="top"
                            title=${i18n.downloadAllHoverMsg}
                        >
                            <i class="fa fa-download"></i>
                        </button>
                        <button
                            name="copyProcessConfig"
                            type="button"
                            class="btn p-0 ml-1 top-index"
                            data-toggle="tooltip"
                            id="procSettingModalCopyAllBtn_${processConfig.id}"
                            data-placement="top"
                            title=${i18n.copyAllHoverMsg}
                        >
                            <i class="fa fa-copy"></i>
                        </button>
                        <button
                            name="pasteProcessConfig"
                            type="button"
                            class="btn p-0 ml-1 top-index"
                            data-toggle="tooltip"
                            id="procSettingModalPasteAllBtn_${processConfig.id}"
                            data-placement="top"
                            title=${i18n.pasteAllHoverMsg}
                        >
                            <i class="fa fa-file-import"></i>
                        </button>
                    </div>
                </div>
      <!-- new GUI process config-->
      <div class="mt-2" id="${this.processColumnsTableId(processConfig.id)}">
   </div>
</div>
`;
    }

    /**
     * Generate a new Datetime Column
     * @param {JspreadSheetTable} table
     * @param {} mainDateData
     * @param {} mainTimeData
     * @param {} mainTimeData
     * @param {number} generateIndex
     */
    static generateDatetimeColumn(table, mainDateData, mainTimeData, generateIndex) {
        const generatedId = -100000;
        const generatedDateTimeColName = addSuffixDatetimeGenerated(table);
        const mainDateSampleData = Object.entries(mainDateData)
            .filter(([key]) => key.startsWith(SAMPLE_DATA_KEY))
            .map(([key, value]) => value);
        const mainTimeSampleData = Object.entries(mainTimeData)
            .filter(([key]) => key.startsWith(SAMPLE_DATA_KEY))
            .map(([key, value]) => value);
        const sampleDataRows = _.zip(mainDateSampleData, mainTimeSampleData).map(
            ([dateData, timeData]) => dateData + ' ' + timeData,
        );
        const generatedDateTimeCol = {
            id: generatedId,
            column_name: generatedDateTimeColName,
            is_checked: true,
            column_raw_name: generatedDateTimeColName,
            shown_data_type: $(procModali18n.i18nMainDatetime).text(),
            raw_data_type: DataTypes.DATETIME.name,
            column_type: masterDataGroup.MAIN_DATETIME,
            name_en: fixedName[masterDataGroup.MAIN_DATETIME].system,
            name_jp: fixedName[masterDataGroup.MAIN_DATETIME].japanese,
            name_local: fixedName[masterDataGroup.MAIN_DATETIME].system,
            unit: null,
            data_type: DataTypes.DATETIME.name,
            is_serial_no: false,
            is_get_date: true,
            is_file_name: false,
            is_auto_increment: false,
            is_generated_datetime: true,
            is_dummy_datetime: false,
            is_null: sampleDataRows.every((element) => element === ' ') || false,
            process_id: null,
            sample_data_1: sampleDataRows[0],
            sample_data_2: sampleDataRows[1],
            sample_data_3: sampleDataRows[2],
            sample_data_4: sampleDataRows[3],
            sample_data_5: sampleDataRows[4],
            sample_data_6: sampleDataRows[5],
            sample_data_7: sampleDataRows[6],
            sample_data_8: sampleDataRows[7],
            sample_data_9: sampleDataRows[8],
            sample_data_10: sampleDataRows[9],
        };

        table.addNewRow(generatedDateTimeCol);
        // disable cell
        [
            PROCESS_COLUMNS.shown_data_type,
            PROCESS_COLUMNS.name_en,
            PROCESS_COLUMNS.name_jp,
            PROCESS_COLUMNS.name_local,
        ].forEach((name) => {
            const columnIndex = table.getIndexHeaderByName(name);
            const disableCell = table.getCellFromCoords(columnIndex, generateIndex);
            disableCell.classList.add(READONLY_CLASS, 'disabled');
        });
        // move row to first row
        table.moveRow(generateIndex, 0);
        // remove dummy column dummy datetime
        this.removeDummyDatetimeColumn(table);
    }

    /**
     * Remove generated main::Datetime column
     * @param {JspreadSheetTable} table
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @private
     */
    static #removeGeneratedMainDatetimeColumn(table, rowIndex = null) {
        // remove generated datetime column
        table.removeRowById(rowIndex);
        reCalculateCheckedColumn(table, -1);
    }

    /**
     * Remove dummy datetime main::Datetime column
     * @param {JspreadSheetTable} table
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @private
     */
    static removeDummyDatetimeColumn(table) {
        const tableDataRows = table.collectDataTable();
        const dummyDatetimeData = tableDataRows.find((rowData) => rowData.is_dummy_datetime);
        if (dummyDatetimeData) {
            const dummyDatetimeRowIndex = tableDataRows.findIndex((rowData) => rowData === dummyDatetimeData);
            this.dummyDatetimeColumnAndData = dummyDatetimeData;
            table.removeRowById(dummyDatetimeRowIndex);
            reCalculateCheckedColumn(table, -1);
        }
    }

    /**
     * @param {JspreadSheetTable} table
     */
    static #addDummyDatetimeColumn(table) {
        if (!this.dummyDatetimeColumnAndData) {
            return;
        }
        this.dummyDatetimeColumnAndData.is_dummy_datetime = true;
        this.dummyDatetimeColumnAndData.is_get_date = true;
        this.dummyDatetimeColumnAndData.column_type = masterDataGroup.MAIN_DATETIME;
        this.dummyDatetimeColumnAndData.shown_data_type = $(procModali18n.i18nMainDatetime).text();

        table.addNewRow(this.dummyDatetimeColumnAndData);
        const dataLen = table.collectDataTable().length;
        // move to first row
        table.moveRow(dataLen - 1, 0);
        [
            PROCESS_COLUMNS.shown_data_type,
            PROCESS_COLUMNS.name_en,
            PROCESS_COLUMNS.name_jp,
            PROCESS_COLUMNS.name_local,
        ].forEach((name) => {
            const columnIndex = table.getIndexHeaderByName(name);
            const disableCell = table.getCellFromCoords(columnIndex, 0);
            disableCell.classList.add('readonly', 'disabled');
        });
        reCalculateCheckedColumn(table, 1);
    }

    /**
     * Handle main::Date column and main::Time column are select/unselect
     * @param {SpreadSheetProcessConfig} - spreadsheet
     * @param {string} dataType
     * @param {number} columnType
     */
    static handleMainDateAndMainTime(spreadsheet, dataType, columnType, beforeColumnType = '') {
        if (this.handleMainDateAndMainTime.disable) return;
        const table = spreadsheet.table;
        const tableDataRows = table.collectDataTable();
        const generatedDateTimeRow = tableDataRows.find((dataRow) => dataRow.is_generated_datetime);
        let mainDateTimeRow = tableDataRows.find((dataRow) => dataRow.column_type === masterDataGroup.MAIN_DATETIME);
        const mainDateRow = tableDataRows.find((dataRow) => dataRow.column_type === masterDataGroup.MAIN_DATE);
        const mainTimeRow = tableDataRows.find((dataRow) => dataRow.column_type === masterDataGroup.MAIN_TIME);
        const isMainDateColumnChecked = mainDateRow?.is_checked || false;
        const isMainTimeColumnChecked = mainTimeRow?.is_checked || false;
        const mainDateTimeRowIndex = tableDataRows.findIndex(function (rowData) {
            return rowData === mainDateTimeRow;
        });
        const isGeneratedMainDateTimeColumnExist = generatedDateTimeRow?.is_generated_datetime || false;
        const generatedDateTimeRowIndex = tableDataRows.findIndex(function (rowData) {
            return rowData === generatedDateTimeRow;
        });
        let generateIndex = tableDataRows.length;

        if (
            columnType === masterDataGroup.MAIN_DATETIME &&
            // isMainTimeColumnChecked &&
            // isMainDateColumnChecked &&
            isGeneratedMainDateTimeColumnExist
        ) {
            // In case there are generated main::Datetime, main::Date, main::Time columns and another column is
            // selected as main::Datetime -> change main::Date, main::Time column to normal type and remove generated
            // main::Datetime column
            this.#removeGeneratedMainDatetimeColumn(table, generatedDateTimeRowIndex);
            // TODO: Remove dummy datetime if select others column is main::Datetime, main::Date, main::Time
            try {
                this.handleMainDateAndMainTime.disable = true; // lock to avoid running this function
                const mainDateRowIndex = mainDateRow
                    ? tableDataRows.findIndex((rowData) => rowData === mainDateRow)
                    : null;
                const mainTimeRowIndex = mainTimeRow
                    ? tableDataRows.findIndex((rowData) => rowData === mainTimeRow)
                    : null;
                [mainDateRowIndex, mainTimeRowIndex].forEach((rowIndex) => {
                    if (!rowIndex) return;
                    DataTypeDropdown_Controller.changeToNormalDataType(table, rowIndex);
                });
            } finally {
                this.handleMainDateAndMainTime.disable = undefined; // release lock
            }
        } else if (
            (isMainTimeColumnChecked && !isMainDateColumnChecked) ||
            (!isMainTimeColumnChecked && isMainDateColumnChecked)
        ) {
            // In case there is only main::Date or main::Time column
            // when there is datetime column already generated, remove it
            if (isGeneratedMainDateTimeColumnExist) {
                this.#removeGeneratedMainDatetimeColumn(table, generatedDateTimeRowIndex);
                this.#addDummyDatetimeColumn(table);
                mainDateTimeRow = null;
            }
            // if (beforeAttrKey.length || [masterDataGroup.MAIN_DATE, masterDataGroup.MAIN_TIME].includes(columnType)) { // TODO: check before attr key
            if (
                [masterDataGroup.MAIN_DATE, masterDataGroup.MAIN_TIME].includes(beforeColumnType) ||
                [masterDataGroup.MAIN_DATE, masterDataGroup.MAIN_TIME].includes(columnType)
            ) {
                $(procModalElements.msgContent).text($(procModalElements.msgSelectDateAndTime).text());
                $(procModalElements.msgModal).modal('show');
            }

            // Change main::Datetime to normal Datetime data type
            if (mainDateTimeRow && !mainDateTimeRow.is_dummy_datetime) {
                DataTypeDropdown_Controller.changeToNormalDataType(table, mainDateTimeRowIndex);
            }
        } else if (isMainTimeColumnChecked && isMainDateColumnChecked) {
            if (!isGeneratedMainDateTimeColumnExist) {
                $(procModalElements.msgContent).text($(procModalElements.msgGenDateTime).text());
                $(procModalElements.msgModal).modal('show');
            } else {
                this.#removeGeneratedMainDatetimeColumn(table, generatedDateTimeRowIndex);
                generateIndex -= 1;
            }
            this.generateDatetimeColumn(table, mainDateRow, mainTimeRow, generateIndex);
            reCalculateCheckedColumn(spreadsheet.table, 1);
            showProcDatetimeFormatSampleData(spreadsheet);
        }
    }

    /**
     * Sort columns in Process Config
     *
     * Order of columns:
     * 1. main::Date
     * 2. main::Time
     * 3. main::Datetime
     * 4. another columns
     *
     * @param {jQuery<HTMLTableSectionElement>} $processConfigTableBody
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     */
    static sortProcessColumns($processConfigTableBody, $processColumnsSampleDataTableBody) {
        const ColumnTypeAttribute = {
            MainDatetime: 'is_get_date',
            MainDate: 'is_main_date',
            MainTime: 'is_main_time',
        };
        const inner = function (columnTypeAttribute) {
            const targetRow = $processConfigTableBody
                .find(`td.column-date-type div.config-data-type-dropdown button span[${columnTypeAttribute}="true"]`)
                .closest('tr');
            if (targetRow.length > 0) {
                const targetSampleDataRow = $processColumnsSampleDataTableBody.find(`tr:eq(${targetRow.index()})`);

                // Move row to top of table
                $processConfigTableBody.prepend(targetRow);
                $processColumnsSampleDataTableBody.prepend(targetSampleDataRow);

                // Re-index order number
                $processConfigTableBody
                    .find('td.column-number')
                    .toArray()
                    .forEach((ele, index) => {
                        ele.textContent = index + 1;
                    });
            }
        };

        inner(ColumnTypeAttribute.MainDatetime);
        inner(ColumnTypeAttribute.MainTime);
        inner(ColumnTypeAttribute.MainDate);
    }
}

/**
 * Add suffix for generated datetime
 * @param {JspreadSheetTable} table
 * @returns {"DatetimeGenerated"}
 */

const addSuffixDatetimeGenerated = (table) => {
    let datetimeGenerated = procModalElements.generatedDateTimeColumnName;
    let suffix = '';
    const searchName = datetimeGenerated;
    const columnRawNames = table.getColumnDataByHeaderName(PROCESS_COLUMNS.column_raw_name);
    const sameColumnNames = columnRawNames.filter((columnRawName) => columnRawName === searchName);
    const prefix = `${searchName}_`;
    const validSameColumnNames = sameColumnNames
        .filter((name) => name.includes(prefix) && name.replace(prefix, '').match(/^\d{2}$/) != null)
        .sort((a, b) => a.localeCompare(b));
    if (validSameColumnNames.length > 0) {
        const lastName = validSameColumnNames[validSameColumnNames.length - 1];
        suffix = parseInt(lastName.substring(lastName.length - 2, lastName.length), 10) + 1;
        suffix = `_${String(suffix).padStart(2, '0')}`;
    } else if (sameColumnNames.length > 0) {
        suffix = `_01`;
    }
    return `${datetimeGenerated}${suffix}`;
};
