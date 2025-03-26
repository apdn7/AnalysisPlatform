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

        sectionHTMLObject.__object__ = this;
    }

    /**
     * Collect all information of process configuration
     * @return {RequestProcessConfig}
     */
    collectProcessConfig = () => {
        const selector = getSelectedColumnsAsJson(true, this.processConfigTableElement.lastElementChild);
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
            columns: procColumnsData(selector, true),
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
     * Generate Process Config Section
     * @param {ProcessConfig} processConfig - a process config object
     * @param {{}[]} sampleDataRows - a list of sample data
     * @return ProcessConfigSection - a process config section object
     */
    static createProcessConfigSectionForExtend(processConfig, sampleDataRows) {
        const extendSectionDivHTML = this.#generateProcessConfigHeaderHTML(processConfig);
        /** @type {HTMLDivForSectionElement} */
        const sectionHTMLObject = htmlToElement(extendSectionDivHTML);
        return this.#createProcessConfigSection(processConfig, sampleDataRows, sectionHTMLObject, false);
    }

    /**
     * Generate Process Config Section
     * @param {ProcessConfig} processConfig - a process config object
     * @param {{}[]} sampleDataRows - a list of sample data
     * @return ProcessConfigSection - a process config section object
     */
    static createProcessConfigSectionForMain(processConfig, sampleDataRows) {
        /** @type {HTMLDivForSectionElement} */
        const sectionHTMLObject = document.getElementById('procSettingModal');
        const processConfigSectionObject = this.#createProcessConfigSection(
            processConfig,
            sampleDataRows,
            sectionHTMLObject,
            true,
        );

        processConfigSectionObject.processSystemName.set(processConfig.name_en, true);
        processConfigSectionObject.processJapaneseName.set(processConfig.name_jp, true);
        processConfigSectionObject.processLocalName.set(processConfig.name_local, true);
        processConfigSectionObject.processOriginName.set(processConfig.origin_name);

        return processConfigSectionObject;
    }

    /**
     * Generate Process Config Section
     * @private
     * @param {ProcessConfig} processConfig - a process config object
     * @param {{}[]} sampleDataRows - a list of sample data
     * @param {HTMLDivForSectionElement} sectionHTMLObject - a section HTML object
     * @param {boolean} isMainSection - true: this is for main section, otherwise: for extend section
     * @return ProcessConfigSection - a process config section object
     */
    static #createProcessConfigSection(processConfig, sampleDataRows, sectionHTMLObject, isMainSection) {
        this.#determineSerialColumns(processConfig.columns);
        const [rowProcessColumnConfigHTMLs, rowSampleDataHTMLs] = this.generateProcessConfigBodyHTML(
            processConfig.columns,
            sampleDataRows,
        );

        const idSuffix = isMainSection ? '' : `_${processConfig.id}`;
        const processColumnTableObject = sectionHTMLObject.querySelector('#processColumnsTable' + idSuffix);
        const processColumnsTableSampleDataObject = sectionHTMLObject.querySelector(
            '#processColumnsTableSampleData' + idSuffix,
        );

        processColumnTableObject.lastElementChild.innerHTML = rowProcessColumnConfigHTMLs.join('');
        processColumnsTableSampleDataObject.lastElementChild.innerHTML = rowSampleDataHTMLs.join('');
        sectionHTMLObject.__object__ = new ProcessConfigSection(sectionHTMLObject);

        return sectionHTMLObject.__object__;
    }

    /**
     * Generate HTML of section process config
     * @private
     * @param {ProcessConfig} processConfig - a process config object
     * @return {string} - a string HTML of section process config
     */
    static #generateProcessConfigHeaderHTML(processConfig) {
        return `
<div class="section extend-section" id="procSettingModal_${processConfig.id}" data-process-id="${processConfig.id}">
   <div class="config-section">
      <div class="col-xl-10 col-md-12 pl-0">
         <div class="mt-3">
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
   </div>
   <div class="preview-section position-relative" id="procPreviewSection_${processConfig.id}">
      <div class="scroll-content">
         <span id="sampleDataScrollToLeft_${processConfig.id}">
             <i class="fa fa-angle-double-left"></i>
         </span>
         <span id="sampleDataScrollToLeftOneStep_${processConfig.id}">
             <i class="fa fa-angle-left"></i>
         </span>
         <span id="sampleDataScrollToRightOneStep_${processConfig.id}">
             <i class="fa fa-angle-right"></i>
         </span>
         <span id="sampleDataScrollToRight_${processConfig.id}">
             <i class="fa fa-angle-double-right"></i>
         </span>
      </div>
      <!-- new GUI process config-->
      <div class="mt-2" id="procSettingContent_${processConfig.id}">
         <div 
            id="alertMsgProcessColumnsTable_${processConfig.id}" 
            class="alert alert-dismissible fade alert-top-fixed" 
            style="text-align: left; display:none" 
            role="alert"
            >
            <strong id="alertMsgProcessColumnsTable_${processConfig.id}-content"></strong>
            <button type="button" class="close" onclick="$(this).parent().css('display','none');" aria-label="Close">
               <span aria-hidden="true">×</span>
            </button>
         </div>
         <div
            class="table-responsive proc-config-content"
            style="max-height: calc(100vh - 370px);"
            >
            <table
               class="table table-hover table-bordered table-fixed table-hover-light"
               name="processColumnsTable"
               id="processColumnsTable_${processConfig.id}"
               >
               <thead>
                  <tr>
                     <th class="column-order">*</th>
                     <th class="column-raw-name">
                        ${i18n.columnRawName}
                     </th>
                     <th class="data-type">${i18n.dataType}</th>
                     <th class="system" title="${i18n.systemNameHoverMsg}">
                        <span class="hint-text">System</span>
                        <span style="color: yellow;">*</span>
                     </th>
                     <th class="japanese-name">
                        ${i18n.japaneseName}
                     </th>
                     <th class="local-name">
                        ${i18n.localName}
                     </th>
                     <th class="column-unit">
                        ${i18n.unit}
                     </th>
                  </tr>
               </thead>
               <tbody></tbody>
            </table>
            <table
               class="table table-hover table-bordered table-fixed table-hover-light"
               name="processColumnsTableSampleData"
               id="processColumnsTableSampleData_${processConfig.id}"
               >
               <thead>
                  <tr>
                     <th class="sample-data-column position-relative" colspan="10">
                        ${i18n.sampleData}
                     </th>
                  </tr>
               </thead>
               <tbody></tbody>
            </table>
         </div>
      </div>
   </div>
</div>
`;
    }

    /**
     * Find all columns and determine what column is main::Serial or Serial
     * @description ONLY EDGE SERVER DO THIS LOGIC
     * @param {ProcessColumnConfig[]} processColumnConfigs - a list of process column config
     */
    static #determineSerialColumns(processColumnConfigs) {
        let hasMainSerialCol = false;
        processColumnConfigs.forEach((processColumnConfig) => {
            // if v2 col_name is シリアルNo -> auto check
            const isSerial =
                /^.*シリアル|serial.*$/.test(processColumnConfig.column_name.toString().toLowerCase()) &&
                [DataTypes.STRING.name, DataTypes.INTEGER.name].includes(processColumnConfig.data_type);
            if (isSerial) {
                if (hasMainSerialCol) {
                    processColumnConfig.is_serial_no = true;
                } else {
                    processColumnConfig.is_main_serial_no = true;
                    hasMainSerialCol = true;
                }
            }
        });
    }

    /**
     * Generate Process Config Body HTML string
     * @param {ProcessColumnConfig[]} processColumnConfigs - a list of process column config
     * @param {{}[]} sampleDataRows - a list of sample data
     * @return {[string[], string[]]} - a tuple of rowSampleDataHTMLs & rowProcessColumnConfigHTMLs
     */
    static generateProcessConfigBodyHTML(processColumnConfigs, sampleDataRows) {
        const rowSampleDataHTMLs = [];
        const rowProcessColumnConfigHTMLs = [];
        processColumnConfigs.forEach((processColumnConfig, index) => {
            if (processColumnConfig.id == null) {
                // Temporary set id if it is null to can generate HTML completely
                processColumnConfig.id = -index - 1;
            }

            rowSampleDataHTMLs.push(this.#generateOneRowOfSampleDataHTML(sampleDataRows, processColumnConfig));
            rowProcessColumnConfigHTMLs.push(this.#generateOneRowOfProcessColumnConfigHTML(processColumnConfig, index));
        });

        return [rowProcessColumnConfigHTMLs, rowSampleDataHTMLs];
    }

    /**
     * Generate One Row Of Sample Data HTML string
     * @public
     * @param {{}[]} sampleDataRows - a list of sample data
     * @param {ProcessColumnConfig} processColumnConfig
     * @param {?string} extendClass
     * @return {string} - an HTML string
     */
    static generateOneRowOfSampleDataHTML(sampleDataRows, processColumnConfig, extendClass = '') {
        return this.#generateOneRowOfSampleDataHTML(sampleDataRows, processColumnConfig, extendClass);
    }

    /**
     * Generate One Row Of Sample Data HTML string
     * @private
     * @param {{}[]} sampleDataRows - a list of sample data
     * @param {ProcessColumnConfig} processColumnConfig
     * @param {?string} extendClass
     * @return {string} - an HTML string
     */
    static #generateOneRowOfSampleDataHTML(sampleDataRows, processColumnConfig, extendClass = '') {
        const tdHTMLs = [];
        const $checkboxDatetimeFormat = procModalElements.procDateTimeFormatCheckbox;
        const formatIsChecked =
            $checkboxDatetimeFormat.length > 0
                ? // In case of Process config modal in Config page, base on status of checkbox
                  $checkboxDatetimeFormat.is(':checked')
                : // In case of Register by file page, always do format
                  true;
        sampleDataRows.forEach((row) => {
            const key = processColumnConfig.column_name; //col.column_name ||
            const originValue = row[key];
            let value;
            if (formatIsChecked) {
                switch (processColumnConfig.data_type) {
                    case DataTypes.DATETIME.name:
                        value = parseDatetimeStr(row[key]);
                        break;
                    case DataTypes.DATE.name:
                        value = parseDatetimeStr(row[key], true);
                        break;
                    case DataTypes.TIME.name:
                        value = parseTimeStr(row[key]);
                        break;
                    case DataTypes.INTEGER.name:
                        value = row[key];
                        value = parseIntData(value);
                        break;
                    case DataTypes.REAL.name:
                        value = row[key];
                        value = parseFloatData(value);
                        break;
                    default:
                        value = row[key];
                }
            } else {
                value = row[key];
            }

            tdHTMLs.push(this.#generateOneColumnOfSampleDataHTML(processColumnConfig, value, originValue, extendClass));
        });

        return (
            `<tr class="${processColumnConfig.is_checked === true ? '' : 'd-none'} ${extendClass ?? ''}">` +
            tdHTMLs.join('') +
            '</tr>'
        );
    }

    /**
     * Generate Row Of Sample Data HTML
     * @public
     * @param {ProcessColumnConfig} processColumnConfig
     * @param {string} value
     * @param {string} originValue
     * @param {?string} extendClass
     * @return {string} - an HTML string of row
     */
    static #generateOneColumnOfSampleDataHTML(processColumnConfig, value, originValue, extendClass = '') {
        const isKSep = [DataTypes.REAL_SEP.name, DataTypes.EU_REAL_SEP.name].includes(processColumnConfig.data_type);
        const checkedAtr = processColumnConfig.is_checked ? 'checked=checked' : '';
        return (
            '<td' +
            ` style="${isKSep ? 'color: "orange"' : ''}"` +
            ` data-original="${originValue}"` +
            ` class="sample-data row-item show-raw-text ${extendClass ?? ''}"` +
            ` ${checkedAtr}` +
            '>' +
            `${!isEmpty(value) ? value : ''}` +
            '</td>'
        );
    }

    /**
     * Generate One Row Of Process Column Config HTML string
     * @private
     * @param {ProcessColumnConfig} processColumnConfig
     * @param {number} index - a number index of row
     * @return {string} - an HTML string
     */
    static #generateOneRowOfProcessColumnConfigHTML(processColumnConfig, index) {
        // convert column_type to attr key
        /** @type {ProcessColumnConfig & ColumnTypeInfo} */
        const col = {
            ...processColumnConfig,
            ...DataTypeDropdown_Controller.convertColumnTypeToAttrKey(processColumnConfig.column_type),
        };
        col.is_show = true;
        const checkedAttr = col.is_checked ? 'checked=checked' : '';
        const isRegisterProc = false;

        const dataTypeObject = /** @type DataTypeObject */ {
            ...col,
            value: col.data_type,
            checked: checkedAttr,
            isRegisteredCol: false,
            isRegisterProc: isRegisterProc,
        };
        let getKey = '';
        for (const attr of DataTypeAttrs) {
            if (dataTypeObject[attr]) {
                getKey = attr;
                break;
            }
        }
        const idSuffix = `_processId_${processColumnConfig.id}`;

        return this.generateOneRowOfProcessColumnConfigHTML(
            index,
            col,
            getKey,
            dataTypeObject,
            isRegisterProc,
            idSuffix,
        );
    }

    /**
     * Generate Row Of Process Column HTML
     * @public
     * @param {number} index
     * @param {ProcessColumnConfig} col
     * @param {string} getKey
     * @param {DataTypeObject} dataTypeObject
     * @param {boolean} isRegisteredProcess
     * @param {string} idSuffix
     * @return {string} - an HTML string of row
     */
    static generateOneRowOfProcessColumnConfigHTML(
        index,
        col,
        getKey,
        dataTypeObject,
        isRegisteredProcess,
        idSuffix = '',
    ) {
        const checkedAttr = col.is_checked ? 'checked=checked' : '';
        const isFixedName = fixedNameAttrs.includes(getKey);
        const isRegisteredMainDatetimeColumn =
            // ONLY FOR EDGE SERVER
            (col.column_type === DataTypeDropdown_Controller.DataGroupType.MAIN_DATE ||
                col.column_type === DataTypeDropdown_Controller.DataGroupType.MAIN_TIME ||
                col.is_get_date) &&
            isRegisteredProcess;
        const isRegisteredFilenameColumn = col.is_file_name && isRegisteredProcess;
        return `
<tr class="${!col.is_show ? 'd-none' : ''} ${col.is_generated_datetime === true ? 'is-generated-datetime' : ''}  ${col.is_dummy_datetime === true ? 'is-dummy-datetime' : ''}"
    is-master-col="${col.is_master_col ?? ''}"
>
    <td class="text-center show-raw-text row-item column-number" 
        ${checkedAttr}
        title="index" 
        data-column-id="${col.id ?? ''}" 
        data-col-idx="${index}"
    >
        ${index + 1}
    </td>
    <td class="show-raw-text column-raw-name" title="${col.column_raw_name || col.column_name}">
        <div class="custom-control custom-checkbox">
            <input type="checkbox"
                   class="check-item custom-control-input col-checkbox"
                   onchange="handleChangeProcessColumn(this, ${isRegisteredProcess})"
                   name="${procModalElements.columnName ?? ''}"
                   value="${col.column_name ?? ''}"
                   is-show="${col.is_show ?? ''}"
                   id="checkbox-${col.column_name}_${index}${idSuffix}" 
                   data-id="${col.id ?? ''}"
                   data-column_name="${col.column_name ?? ''}"
                   data-bridge_column_name="${col.bridge_column_name ?? ''}"
                   data-column_raw_name="${col.column_raw_name ?? ''}"
                   data-name="${col.name ?? ''}"
                   data-data_type="${col.data_type ?? ''}"
                   raw-data-type="${col.data_type}"
                   data-raw_data_type="${col.raw_data_type ?? ''}"
                   data-operator="${col.operator ?? ''}"
                   data-coef="${col.coef ?? ''}"
                   data-column_type="${col.column_type ?? ''}"
                   data-is_auto_increment="${col.is_auto_increment ?? false}"
                   data-is_serial_no="${col.is_serial_no ?? false}"
                   data-is_get_date="${col.is_get_date ?? false}"
                   data-is_dummy_datetime="${col.is_dummy_datetime ?? false}"
                   data-is_file_name="${col.is_file_name ?? false}"
                   data-master_type="${col.master_type ?? ''}"
                   data-isnull="${col.check_same_value ? col.check_same_value.is_null : false}"
                   data-observer="${col.is_checked}"
                   ${checkedAttr}
                   ${col.is_master_col || isRegisteredMainDatetimeColumn || isRegisteredFilenameColumn ? 'disabled' : ''}
            >
            <label class="custom-control-label row-item for-search" 
                   for="checkbox-${col.column_name}_${index}${idSuffix}" 
                   ${checkedAttr}
            ><span style="display: inline-block; text-overflow: ellipsis; overflow: hidden; max-width: 300px">${col.column_raw_name || col.column_name}</span>
            </label>
            <input id="isDummyDatetime${col.column_name}${idSuffix}" 
                   type="hidden" 
                   name="${procModalElements.isDummyDatetime}" 
                   value="${col.is_dummy_datetime ?? false}"
            >
            <input id="isFileName${col.column_name}${idSuffix}" 
                   type="hidden" 
                   name="${procModalElements.isFileName}" 
                   value="${col.is_file_name ?? false}"
            >
            <input name="${procModalElements.columnRawName}" type="hidden" value="${col.column_raw_name ?? ''}">
        </div>
    </td>
    <td class="column-date-type" title="raw_data_type">
        ${DataTypeDropdown_Controller.generateHtml(index, dataTypeObject, getKey, isRegisteredFilenameColumn || isRegisteredMainDatetimeColumn)}
    </td>
    <td class="column-system-name" title="name_en">
        <input type="text" 
               name="${procModalElements.systemName}" 
               class="form-control row-item" 
               old-value="${isFixedName ? col.old_system_name || col.name_en || col.column_name : ''}" 
               value="${col.name_en ?? ''}" 
               data-observer="${col.name_en ?? ''}" 
               data-original-value="${col.name_en || col.column_name}"
               ${checkedAttr} 
               ${isFixedName || isRegisteredMainDatetimeColumn || isRegisteredFilenameColumn ? 'disabled' : ''}
        >
    </td>
    <td class="column-japanese-name" title="name_jp">
        <input type="text" 
               name="${procModalElements.japaneseName}" 
               class="form-control row-item" 
               onchange="handleEmptySystemNameJP(this, procModalElements.systemName)" 
               old-value="${isFixedName ? col.old_name_jp || col.name_jp || '' : ''}" 
               value="${col.name_jp || (isFixedName ? fixedName[getKey].japanese : '')}" 
               data-observer="${col.name_jp ?? ''}" 
               data-original-value="${col.name_jp}"
               ${checkedAttr} 
               ${isFixedName || isRegisteredMainDatetimeColumn || isRegisteredFilenameColumn ? 'disabled' : ''}
        >
    </td>
    <td class="column-local-name" title="name_local">
        <input type="text" 
               name="${procModalElements.localName}" 
               class="form-control row-item" 
               onchange="handleEmptySystemName(this, procModalElements.systemName)" 
               value="${col.name_local || (isFixedName ? col.name_en : '')}" 
               data-observer="${col.name_local || ''}" 
               data-original-value="${col.name_local || ''}"
               ${checkedAttr}
               ${isFixedName ? 'disabled' : ''}
        >
    </td>
    <td class="column-unit" title="unit">
        <input type="text" 
               name="${procModalElements.unit}" 
               class="form-control row-item" 
               value="${col.unit || ''}" 
               data-observer="${col.unit || ''}"
               ${checkedAttr}
        >
    </td>
</tr>
`;
    }

    /**
     * Get sample data based on column ids
     * @param {number} columnId
     * @param {?jQuery<HTMLTableSectionElement>} $processColumnsTableBody
     * @param {?jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @return {string[]} - a list that contains sample data
     */
    static collectSampleData(columnId, $processColumnsTableBody = null, $processColumnsSampleDataTableBody = null) {
        const colIdx = ($processColumnsTableBody ?? procModalElements.processColumnsTableBody)
            .find(`td[title="index"][data-column-id="${columnId}"]`)
            .attr('data-col-idx');
        return this.#collectSampleData(colIdx, $processColumnsSampleDataTableBody);
    }

    /**
     * Get sample data based on column ids
     * @param {number | string} colIdx
     * @param {?jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @param {?boolean} isGetOriginal - true: get value from attribute data-original, otherwise.
     * @return {string[]} - a list that contains sample data
     * @private
     */
    static #collectSampleData(colIdx, $processColumnsSampleDataTableBody = null, isGetOriginal = false) {
        return ($processColumnsSampleDataTableBody ?? procModalElements.processColumnsSampleDataTableBody)
            .find(`tr:eq(${colIdx}) .sample-data`)
            .toArray()
            .map((el) => (isGetOriginal ? el.dataset.original.trim() : el.textContent.trim()));
    }

    /**
     * Collect Generated Datetime Sample Data
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsTableBody
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @param {string} columnName
     * @return {{}[]} - a list of sample data
     */
    static collectGeneratedDatetimeSampleData(
        $processColumnsTableBody,
        $processColumnsSampleDataTableBody,
        columnName,
    ) {
        const mainDateColId = $processColumnsTableBody
            .find('span[name=dataType][checked][is_main_date=true]')
            .closest('tr')
            .index();
        const mainDateSampleDatas = this.#collectSampleData(mainDateColId, $processColumnsSampleDataTableBody, true);

        const mainTimeColId = $processColumnsTableBody
            .find('span[name=dataType][checked][is_main_time=true]')
            .closest('tr')
            .index();
        const mainTimeSampleDatas = this.#collectSampleData(mainTimeColId, $processColumnsSampleDataTableBody, true);

        const result = [];
        mainDateSampleDatas.forEach((dateData, index) => {
            const temp = {};
            temp[columnName] = dateData + ' ' + mainTimeSampleDatas[index];
            result.push(temp);
        });

        return result;
    }

    /**
     * Generate a new Datetime Column
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsTableBody
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @param {ProcessColumnConfig} col
     * @param {string} getKey
     * @param {DataTypeObject} dataTypeObject
     * @param {boolean} isRegisterProc
     */
    static generateDatetimeColumn(
        $processColumnsTableBody,
        $processColumnsSampleDataTableBody,
        col,
        getKey,
        dataTypeObject,
        isRegisterProc,
    ) {
        // Generate a new row in process config table
        const index = $processColumnsTableBody.find('tr').length;
        const rowHtml = this.generateOneRowOfProcessColumnConfigHTML(
            index,
            col,
            getKey,
            dataTypeObject,
            isRegisterProc,
        );
        const $rowHtmlObject = $(rowHtml);
        $processColumnsTableBody.append(rowHtml);
        // Add event for data type dropdown control
        $rowHtmlObject
            .find('div.config-data-type-dropdown')
            .each((idx, dataTypeDropdownElement) => DataTypeDropdown_Controller.addEvents(dataTypeDropdownElement));

        // Generate a new row in sample data table
        const sampleDatas = this.collectGeneratedDatetimeSampleData(
            $processColumnsTableBody,
            $processColumnsSampleDataTableBody,
            col.column_name,
        );
        const columnColorClass = 'dummy_datetime_col';
        const sampleRowHTML = this.generateOneRowOfSampleDataHTML(sampleDatas, col, columnColorClass);
        $processColumnsSampleDataTableBody.append(sampleRowHTML);
    }

    /**
     * Remove generated main::Datetime column
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsTableBody
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @private
     */
    static #removeGeneratedMainDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody) {
        // remove generated datetime column
        const generatedDatetimeColRow = $processColumnsTableBody.find(`.is-generated-datetime`);
        if (generatedDatetimeColRow.length === 0) return;

        const generatedDatetimeColIndex = generatedDatetimeColRow.index();
        generatedDatetimeColRow.remove();
        $processColumnsSampleDataTableBody.find(`tr:eq(${generatedDatetimeColIndex})`).remove();
        reCalculateCheckedColumn(-1);
    }

    /**
     * Remove generated main::Datetime column
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsTableBody
     * @param {jQuery<HTMLTableSectionElement>} $processColumnsSampleDataTableBody
     * @private
     */
    static #removeDummyDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody) {
        // remove dummy datetime column
        const dummyDatetimeRow = $processColumnsTableBody.find(`.is-dummy-datetime`);
        if (dummyDatetimeRow.length === 0) return;

        const dummyDatetimeColIndex = dummyDatetimeRow.index();
        dummyDatetimeRow.remove();
        $processColumnsSampleDataTableBody.find(`tr:eq(${dummyDatetimeColIndex})`).remove();
        reCalculateCheckedColumn(-1);
    }

    /**
     * Handle main::Date column and main::Time column are select/unselect
     * @param {HTMLDivElement} dataTypeDropdownElement
     * @param {string} attrKey
     * @param {string} beforeAttrKey
     */
    static handleMainDateAndMainTime(dataTypeDropdownElement, attrKey, beforeAttrKey = '') {
        if (this.handleMainDateAndMainTime.disable) return;

        const $processColumnsTableBody = $(dataTypeDropdownElement.closest('tbody'));
        const $processColumnsSampleDataTableBody = $processColumnsTableBody
            .closest('div.proc-config-content')
            .find('table[name="processColumnsTableSampleData"] tbody');
        const isGeneratedMainDateTimeColumnExist = $processColumnsTableBody.find('.is-generated-datetime').length > 0;

        const $spanMainTime = $processColumnsTableBody.find('span[name=dataType][checked][is_main_time=true]');
        const isDummyDateTimeColumnExist = $processColumnsTableBody.find('.is-dummy-datetime').length > 0;
        const isMainTimeColumnChecked = $spanMainTime.length > 0;
        const $spanMainDate = $processColumnsTableBody.find('span[name=dataType][checked][is_main_date=true]');
        const isMainDateColumnChecked = $spanMainDate.length > 0;

        if (
            ['is_get_date'].includes(attrKey) &&
            isMainTimeColumnChecked &&
            isMainDateColumnChecked &&
            (isGeneratedMainDateTimeColumnExist || isDummyDateTimeColumnExist)
        ) {
            // In case there are generated main::Datetime, main::Date, main::Time columns and another column is
            // selected as main::Datetime -> change main::Date, main::Time column to normal type and remove generated
            // main::Datetime column
            this.#removeGeneratedMainDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);

            this.#removeDummyDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);

            try {
                this.handleMainDateAndMainTime.disable = true; // lock to avoid running this function
                [$spanMainTime, $spanMainDate].forEach((el) =>
                    DataTypeDropdown_Controller.changeToNormalDataType(el[0]),
                );
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
                this.#removeGeneratedMainDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);
            }
            // also remove dummy datetime
            this.#removeDummyDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);
            if (beforeAttrKey.length || ['is_main_date', 'is_main_time'].includes(attrKey)) {
                $(procModalElements.msgContent).text($(procModalElements.msgSelectDateAndTime).text());
                $(procModalElements.msgModal).modal('show');
            }

            // Change main::Datetime to normal Datetime data type
            const mainDatetimeCol = /** @type HTMLSpanElement */ $processColumnsTableBody.find(
                'span[name=dataType][checked][is_get_date=true]',
            );
            if (mainDatetimeCol.length > 0) {
                DataTypeDropdown_Controller.changeToNormalDataType(mainDatetimeCol[0]);
            }
        } else if (isMainTimeColumnChecked && isMainDateColumnChecked) {
            if (!isGeneratedMainDateTimeColumnExist) {
                $(procModalElements.msgContent).text($(procModalElements.msgGenDateTime).text());
                $(procModalElements.msgModal).modal('show');
            } else {
                this.#removeGeneratedMainDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);
            }
            const generatedId = -100;
            const defaultGeneratedDateTimeColName = procModalElements.generatedDateTimeColumnName;
            const generatedDateTimeColName = addSuffixDatetimeGenerated(defaultGeneratedDateTimeColName);
            const generatedDateTimeCol = {
                is_linking_column: false,
                is_int_category: false,
                data_type: DataTypes.DATETIME.name,
                is_auto_increment: null,
                order: 0,
                format: null,
                process_id: currentProcessId,
                column_raw_name: generatedDateTimeColName,
                shown_name: defaultGeneratedDateTimeColName,
                column_name: generatedDateTimeColName,
                function_details: [],
                column_type: masterDataGroup.GENERATED,
                is_get_date: true,
                is_category: false,
                // Dummy datetime means that column is not from file and not from main:Datetime + main::Time
                is_dummy_datetime: false,
                is_generated_datetime: true,
                is_serial_no: false,
                raw_data_type: DataTypes.DATETIME.name,
                name_jp: defaultGeneratedDateTimeColName,
                name_en: defaultGeneratedDateTimeColName,
                name_local: defaultGeneratedDateTimeColName,
                is_show: true,
                is_master_col: false,
                bridge_column_name: null,
                master_type: null,
                is_checked: true,
                id: generatedId,
            };
            const dataTypeObject = {
                ...generatedDateTimeCol,
                value: generatedDateTimeCol.data_type,
                checked: 'checked=checked',
                isRegisteredCol: true,
                isRegisterProc: false,
            };
            this.generateDatetimeColumn(
                $processColumnsTableBody,
                $processColumnsSampleDataTableBody,
                generatedDateTimeCol,
                'is_get_date',
                dataTypeObject,
                false,
            );
            reCalculateCheckedColumn(1);
            showProcDatetimeFormatSampleData();
        } else if (
            ['is_get_date'].includes(attrKey) &&
            (isGeneratedMainDateTimeColumnExist || isDummyDateTimeColumnExist)
        ) {
            this.#removeGeneratedMainDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);

            this.#removeDummyDatetimeColumn($processColumnsTableBody, $processColumnsSampleDataTableBody);

            // Re-index order number
            $processColumnsTableBody
                .find('td.column-number')
                .toArray()
                .forEach((ele, index) => {
                    ele.textContent = index + 1;
                });
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

const addSuffixDatetimeGenerated = () => {
    let datetimeGenerated = procModalElements.generatedDateTimeColumnName;
    let suffix = '';
    const searchName = datetimeGenerated;
    const sameColumnNames = [
        ...document.getElementById('processColumnsTable').lastElementChild.querySelectorAll(`td.column-raw-name label`),
    ]
        .filter((input) => input.textContent.trim().includes(searchName))
        .map((input) => input.textContent.trim());
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
