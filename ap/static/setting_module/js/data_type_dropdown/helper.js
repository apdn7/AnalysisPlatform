/**
 * @file Contains helper functions that serve for data type dropdown.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Class contains all helper functions that serves for data type dropdown menu control
 */
class DataTypeDropdown_Helper extends DataTypeDropdown_Constant {
    /**
     * Initialize
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param options - Option for dropdown initialization
     * @param {boolean} options.resetDefaultInput - Whether to reset inputs (nameEn, nameJp, etc.) to theirs default values
     */
    static init(dataTypeDropdownElement, options = { resetDefaultInput: true }) {
        const $dataTypeDropdownElement = $(dataTypeDropdownElement);
        $dataTypeDropdownElement.find('ul li').removeClass('active');

        const showValueOption = this.getShowValueElement(dataTypeDropdownElement);
        const rawDataType = showValueOption.getAttribute('value');
        let attrKey = showValueOption.dataset.attrKey;
        const isRegisteredCol = showValueOption.getAttribute('is-registered-col') === 'true';
        const isBigInt = showValueOption.getAttribute('is-big-int') === 'true';
        const selectOption = this.getOptionByAttrKey(dataTypeDropdownElement, rawDataType, attrKey);
        selectOption.addClass('active');

        this.setValueToShowValueElement(dataTypeDropdownElement, rawDataType, selectOption.text(), attrKey);

        if (options.resetDefaultInput) {
            this.setDefaultNameAndDisableInput(dataTypeDropdownElement, attrKey);
        }

        this.disableOtherDataType(dataTypeDropdownElement, isRegisteredCol || isBigInt, rawDataType, attrKey);

        // disable copy function if allow select one item
        this.disableCopyItem(dataTypeDropdownElement, attrKey);
        if (currentProcess?.is_show_file_name != null) {
            // data of process imported
            this.disableDatetimeMainItem(dataTypeDropdownElement);
        }
    }

    /**
     * Only trigger event when element is not disabled
     * @param {function(Event): void} func
     * @return {inner}
     */
    static eventWrapper(func) {
        function inner(event) {
            const htmlElement = /** @type HTMLElement */ event.currentTarget || event;
            if (htmlElement.getAttribute('disabled')) return;
            func.call(this, event);
        }
        return inner;
    }

    /**
     * Check data type is allow to edit format or not
     * @param {string} dataType - a data type string
     * @return {boolean} - true: allow format, false: not allow to edit format
     */
    static isDataTypeAllowFormat = (dataType) => {
        return this.AllowFormatingDataType.includes(dataType);
    };

    /**
     * Hide all data type dropdown on UI
     */
    static hideAllDropdownMenu() {
        $('.data-type-selection').hide();
    }

    /**
     * Get Show Value Element
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @return {HTMLElement}
     */
    static getShowValueElement(dataTypeDropdownElement) {
        return dataTypeDropdownElement.querySelector(`span[name="${this.ElementNames.dataType}"]`);
    }

    /**
     * Get Option By Attribute Key
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} value - value of option
     * @param {string} attrKey - attrKey of option
     * @return {jQuery}
     */
    static getOptionByAttrKey(dataTypeDropdownElement, value, attrKey) {
        return $(dataTypeDropdownElement)
            .find(`ul li[value=${value}]${attrKey ? `[${attrKey}]` : '[only-datatype]'}`)
            .first();
    }

    /**
     * Set Value To Show Value Element
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} value - value of option
     * @param {string} text - text want to set
     * @param {string} attrKey - attrKey of option
     */
    static setValueToShowValueElement(dataTypeDropdownElement, value, text, attrKey) {
        const showValueEl = this.getShowValueElement(dataTypeDropdownElement);

        if (text) {
            showValueEl.textContent = text;
        }
        for (const attr of DataTypeAttrs) {
            showValueEl.removeAttribute(attr);
        }
        showValueEl.removeAttribute('column_type');
        showValueEl.removeAttribute('data-attr-key');

        if (attrKey) {
            showValueEl.setAttribute(attrKey, 'true');
            showValueEl.setAttribute('data-attr-key', attrKey);
            showValueEl.setAttribute(
                'column_type',
                DataTypeDropdown_Controller.DataGroupType[mappingDataGroupType[attrKey]], // ONLY FOR EDGE SERVER
            );
        }
        showValueEl.setAttribute('value', value);
        showValueEl.setAttribute('data-raw-data-type', value); // For Bridge Station
    }

    /**
     * Set Default Name And Disable Input
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} attrKey - attrKey of option
     */
    static setDefaultNameAndDisableInput(dataTypeDropdownElement, attrKey = '') {
        const $tr = $(dataTypeDropdownElement.closest('tr'));
        const $systemInput = /** @type jQuery */ $tr.find(`input[name=${this.ElementNames.systemName}]`);
        const $japaneseNameInput = /** @type jQuery */ $tr.find(`input[name=${this.ElementNames.japaneseName}]`);
        const $localNameInput = /** @type jQuery */ $tr.find(`input[name=${this.ElementNames.localName}]`);
        const oldValSystem = $systemInput.attr('old-value');
        const oldValJa = $japaneseNameInput.attr('old-value');
        const originalSystem = $systemInput.data('original-value');
        const originalLocalName = $localNameInput.data('original-value');
        if (fixedNameAttrs.includes(attrKey)) {
            // set default value to system and input
            if (!oldValSystem || !oldValJa) {
                $systemInput.attr('old-value', $systemInput.val());
                $japaneseNameInput.attr('old-value', $japaneseNameInput.val());
            }
            $systemInput.val(fixedName[attrKey].system).prop('disabled', true);
            $japaneseNameInput.val(fixedName[attrKey].japanese).prop('disabled', true);
            $localNameInput.val(fixedName[attrKey].system).prop('disabled', true);
        } else {
            // revert to original name
            if (oldValSystem && oldValJa) {
                $systemInput.val(originalSystem);
                $japaneseNameInput.val(originalSystem);
                $localNameInput.val(originalLocalName);
            }

            $systemInput.prop('disabled', false);
            $japaneseNameInput.prop('disabled', false);
            $localNameInput.prop('disabled', false);
        }
    }

    /**
     * Disable Other DataType
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {boolean} isRegisteredCol - isRegisteredCol
     * @param {string} dataType - data type want to disable
     * @param {string} attrKey - attrKey of option
     */
    static disableOtherDataType(dataTypeDropdownElement, isRegisteredCol = false, dataType, attrKey) {
        if (!isRegisteredCol) return;
        if (this.UnableToReselectAttrs.includes(attrKey)) {
            // disable all option
            $(dataTypeDropdownElement).find(`ul li.dataTypeSelection:not([${attrKey}])`).attr('disabled', true);
        } else {
            // select all other data type option -> add disabled
            let dataTypeAllows = [dataType];
            const indexOrder = this.DataTypeOrder.indexOf(dataType);
            if (indexOrder !== -1) {
                for (let i = indexOrder; i < this.DataTypeOrder.length; i++) {
                    dataTypeAllows.push(this.DataTypeOrder[i]);
                }
            }

            $(dataTypeDropdownElement)
                .find(`ul li.dataTypeSelection`)
                .each((index, liElement) => {
                    const $liElement = $(liElement);
                    let dataType = $liElement.attr('data-type');
                    if (!dataTypeAllows.includes(dataType)) {
                        $liElement.attr('disabled', String(true));
                    }
                });
        }
    }

    /**
     * Disable Copy Item
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} attrKey
     */
    static disableCopyItem(dataTypeDropdownElement, attrKey) {
        // disable copy function if allow select one item
        if (this.AllowSelectOneAttrs.includes(attrKey)) {
            $(dataTypeDropdownElement).find(`ul li.copy-item`).attr('disabled', true);
        } else {
            $(dataTypeDropdownElement).find(`ul li.copy-item`).attr('disabled', false);
        }
    }

    /**
     * Check raw_data to enable or disable judge
     * @param {HTMLElement} ele
     */
    static disableOrEnableJudge(ele) {
        const index = $(ele).closest('tr').index();
        const vals = [...procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${index}) .sample-data`)].map(
            (el) => $(el),
        );
        const attrName = 'data-original';
        let countIllegal = 0;
        for (const e of vals) {
            let val = e.attr(attrName);
            if (!this.isBooleanValue(val)) {
                countIllegal++;
            }
        }
        const optionSelectJudge = $(ele).closest('tr').find('.data-type-selection').find(`li[is_judge]`);
        if (countIllegal > 0) {
            optionSelectJudge.attr('disabled', true);
        } else {
            optionSelectJudge.attr('disabled', false);
        }
    }

    /**
     * Check is boolean
     * @param {HTMLElement} val
     */
    static isBooleanValue(val) {
        return (
            typeof val === 'boolean' ||
            (typeof val === 'string' && ['0', '1', 'true', 'false'].includes(val.toLowerCase())) ||
            (typeof val === 'number' && [0, 1].includes(val))
        );
    }

    /**
     * Disable Datetime Main Item
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static disableDatetimeMainItem(dataTypeDropdownElement) {
        // disable copy function if allow select one item
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_get_date]`).attr('disabled', true);
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_main_date]`).attr('disabled', true);
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_main_time]`).attr('disabled', true);
    }

    /**
     * onClick Data Type
     * @param {Event|HTMLLIElement} event
     */
    static onClickDataType(event) {
        const currentTarget = /** @type HTMLLIElement */ event.currentTarget || event;
        const dataTypeDropdownElement = /** @type HTMLDivElement */ currentTarget.closest(
            'div.config-data-type-dropdown',
        );
        const attrKey = DataTypeDropdown_Helper.getAttrOfDataTypeItem(currentTarget);
        const value = currentTarget.getAttribute('value');

        DataTypeDropdown_Helper.changeDataType(
            dataTypeDropdownElement,
            value,
            currentTarget.textContent,
            attrKey,
            currentTarget,
        );
    }

    /**
     * Get Attribute Key Of DataType Item
     * @param column
     * @return {string|string}
     */
    static getAttrKeyOfDataTypeItem(column) {
        for (const attr of this.ColumnTypeAttrs) {
            if (column[attr]) return attr;
        }

        return '';
    }

    /**
     * Get Attribute Of DataType Item
     * @param {HTMLElement | Event} event
     * @return {string|string}
     */
    static getAttrOfDataTypeItem(event) {
        const target = /** @type HTMLElement */ event.currentTarget || event;
        const attrs = target.getAttributeNames().filter((v) => this.ColumnTypeAttrs.includes(v));
        return attrs.length ? attrs[0] : '';
    }

    /**
     * Change DataType
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} value
     * @param {string} text
     * @param {string} attrKey
     * @param {HTMLElement} el
     */
    static changeDataType(dataTypeDropdownElement, value, text, attrKey, el = null) {
        if (attrKey === 'is_main_serial_no' && typeof FunctionInfo !== 'undefined') {
            // check create or editing function column
            const isMainSerialChecked = functionConfigElements.isMainSerialCheckboxElement.checked;
            // check function column has column main serial.
            const functionColumnInfos = FunctionInfo.collectAllFunctionRows();
            const mainSerialFunctionCol = functionColumnInfos.find((functionCol) => functionCol.isMainSerialNo);
            if (isMainSerialChecked || mainSerialFunctionCol) {
                const columnIdx = dataTypeDropdownElement
                    .closest('tr')
                    .querySelector('td.column-number')
                    .getAttribute('data-col-idx');
                functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.setAttribute('change-value', value);
                functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.setAttribute('change-text', text);
                functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.setAttribute(
                    'change-column-index',
                    columnIdx,
                );
                $(functionConfigElements.confirmUncheckMainSerialFunctionColumnModal).modal('show');
                return;
            }
        }
        this.setValueToShowValueElement(dataTypeDropdownElement, value, text, attrKey);
        this.setDefaultNameAndDisableInput(dataTypeDropdownElement, attrKey);

        // get current datatype
        const beforeDataTypeEle = dataTypeDropdownElement.querySelector(`ul li.active`);
        const beforeAttrKey = beforeDataTypeEle ? this.getAttrOfDataTypeItem(beforeDataTypeEle) : '';

        $(dataTypeDropdownElement).find(`ul li`).removeClass('active');

        this.getOptionByAttrKey(dataTypeDropdownElement, value, attrKey).addClass('active');

        if (this.AllowSelectOneAttrs.includes(attrKey)) {
            // remove attr of others
            this.resetOtherMainAttrKey(dataTypeDropdownElement, attrKey);
        }

        // disable data type column not input format
        // this.enableDisableFormatText(dataTypeDropdownElement, value); // ES not use

        // disable copy function if allow select one item
        this.disableCopyItem(dataTypeDropdownElement, attrKey);

        if (el) {
            this.parseDataType(dataTypeDropdownElement, el);
        }

        this.setColumnTypeForMainDateMainTime(dataTypeDropdownElement, attrKey);

        ProcessConfigSection.handleMainDateAndMainTime(dataTypeDropdownElement, attrKey, beforeAttrKey);
    }

    /**
     * Change to normal data type for the another columns have same data type with main attribute key
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} attrKey - main attribute key
     */
    static resetOtherMainAttrKey(dataTypeDropdownElement, attrKey) {
        // Find same data type element from another columns
        const sameDataTypeElements = /** @type HTMLSpanElement[] */ [];
        [...dataTypeDropdownElement.closest('tbody').querySelectorAll('div.config-data-type-dropdown')].forEach(
            (dropdownElement) => {
                const sameDataTypeElement = dropdownElement.querySelector(`[name=dataType][${attrKey}]`);
                if (dropdownElement !== dataTypeDropdownElement && sameDataTypeElement != null) {
                    sameDataTypeElements.push(sameDataTypeElement);
                }
            },
        );

        if (!sameDataTypeElements.length) return;

        // Change to normal data type for another columns have same data type with main attribute key
        sameDataTypeElements.forEach((el) => this.changeToNormalDataType(el));
    }

    /**
     * Change to normal data type for another columns have same data type with main attribute key
     * @param {HTMLSpanElement} el
     */
    static changeToNormalDataType(el) {
        const anotherDataTypeDropdownElement = el.closest('div.config-data-type-dropdown');
        let dataType = el.getAttribute('value'); // EDGESERVER ONLY
        // add Boolean for judge
        if ([DataTypes.DATE.name, DataTypes.TIME.name].includes(dataType)) {
            dataType = DataTypes.STRING.name;
        }
        this.init(anotherDataTypeDropdownElement);
        $(anotherDataTypeDropdownElement)
            .find(`li[value=${dataType}][only-datatype]`) // EDGESERVER ONLY
            .trigger('click');
    }

    /**
     * Enable Disable Format Text
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} rawDataType - raw data type
     */
    static enableDisableFormatText(dataTypeDropdownElement, rawDataType = '') {
        const $tr = $(dataTypeDropdownElement).closest('tr');
        const isAllowFormat = this.isDataTypeAllowFormat(rawDataType);
        const $inputFormat = $tr.find(`input[name=${procModalElements.format}]`);
        const inputFormatValue = $inputFormat.val();
        if (isAllowFormat) {
            if (inputFormatValue == null || inputFormatValue === '') {
                $inputFormat.val($inputFormat[0]?.previousValue ?? '');
            }
        } else {
            if (!(inputFormatValue == null || inputFormatValue === '')) {
                $inputFormat.previousValue = inputFormatValue;
            }
            $inputFormat.val('');
        }
        $inputFormat.prop('disabled', !isAllowFormat);
    }

    /**
     * Set Column Type For Main Date Main Time
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} attrKey
     */
    static setColumnTypeForMainDateMainTime(dataTypeDropdownElement, attrKey) {
        const isMainDate = 'is_main_date' === attrKey;
        const isMainTime = 'is_main_time' === attrKey;
        const targetRow = dataTypeDropdownElement.closest('tr');
        const checkboxColumn = targetRow.querySelector('td.column-raw-name input[type="checkbox"]:first-child');

        if (!isMainDate && !isMainTime) {
            const originColumnType = checkboxColumn.getAttribute('origin-column-type');
            if (originColumnType != null && originColumnType !== '') {
                checkboxColumn.dataset['column_type'] = checkboxColumn.getAttribute('origin-column-type');
            } else {
                // do nothing
            }
        } else {
            checkboxColumn.setAttribute('origin-column-type', checkboxColumn.dataset['column_type'] ?? '');
            checkboxColumn.dataset['column_type'] = isMainDate
                ? DataTypeDropdown_Controller.DataGroupType.MAIN_DATE // ONLY FOR EDGE SERVER
                : DataTypeDropdown_Controller.DataGroupType.MAIN_TIME; // ONLY FOR EDGE SERVER
        }
    }

    /**
     * Parse DataType
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {HTMLElement} ele
     */
    static parseDataType(dataTypeDropdownElement, ele) {
        const index = $(ele).closest('tr').index();
        parseDataTypeProc(ele, index, dataTypeDropdownElement);
    }

    /**
     * onFocus DataType
     * @param {Event} e
     */
    static onFocusDataType(e) {
        const element = /** @type HTMLLIElement */ e.currentTarget;
        element.previousValue = element.value;
    }

    /**
     * Handle Copy To All Below
     * @param {Event} event
     */
    static handleCopyToAllBelow(event) {
        const currentTarget = /** @type HTMLLIElement */ event.currentTarget || event;
        const dataTypeDropdownElement = /** @type HTMLDivElement */ currentTarget.closest(
            'div.config-data-type-dropdown',
        );
        const [value, attrKey, showValueEl] = this.getDataOfSelectedOption(dataTypeDropdownElement);
        const optionEl = this.getOptionByAttrKey(dataTypeDropdownElement, value, attrKey);
        const nextRows = [...$(showValueEl.closest('tr')).nextAll()];
        nextRows.forEach((row) => {
            const isMasterCol = row.getAttribute('is-master-col') === 'true';
            if (isMasterCol) {
                return;
            }

            const dataTypeDropdownElement =
                /** @type HTMLDivElement */
                row.querySelector('div.config-data-type-dropdown');
            this.changeDataType(
                dataTypeDropdownElement,
                value,
                optionEl.text(),
                attrKey,
                this.getOptionByAttrKey(dataTypeDropdownElement, value, attrKey)[0],
            );
        });
    }

    /**
     * Get Data Of Selected Option
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @return {(string|string|string|HTMLElement)[]}
     */
    static getDataOfSelectedOption(dataTypeDropdownElement) {
        const showValueEl = this.getShowValueElement(dataTypeDropdownElement);
        const attrKey = this.getAttrOfDataTypeItem(showValueEl);
        const dataType = showValueEl.dataset.rawDataType;
        return [dataType, attrKey, showValueEl];
    }

    /**
     * Handle Copy To Filtered
     * @param {Event} event
     */
    static handleCopyToFiltered(event) {
        const currentTarget = /** @type HTMLLIElement */ event.currentTarget || event;
        const dataTypeDropdownElement = /** @type HTMLDivElement */ currentTarget.closest(
            'div.config-data-type-dropdown',
        );
        const [value, attrKey] = this.getDataOfSelectedOption(dataTypeDropdownElement);
        const optionEl = this.getOptionByAttrKey(dataTypeDropdownElement, value, attrKey);
        const filterRows = [...$(dataTypeDropdownElement).closest('table').find('tbody tr:not(.gray):visible')];
        filterRows.forEach((row) => {
            const isMasterCol = row.getAttribute('is-master-col') === 'true';
            if (isMasterCol) {
                return;
            }
            const dataTypeDropdownElement =
                /** @type HTMLDivElement */
                row.querySelector('div.config-data-type-dropdown');
            this.changeDataType(
                dataTypeDropdownElement,
                value,
                optionEl.text(),
                attrKey,
                this.getOptionByAttrKey(dataTypeDropdownElement, value, attrKey)[0],
            );
        });
    }

    /**
     * Set Value For Items
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static setValueForItems(dataTypeDropdownElement) {
        const aElements =
            /** @type NodeListOf<HTMLSpanElement> */
            dataTypeDropdownElement.querySelectorAll('button > span');
        aElements.forEach((aElement) => {
            aElement.value = aElement.dataset.value;
            aElement.previousValue = aElement.value;
        });
    }

    /**
     * Translate Datatype Name
     * @param {Readonly<DataTypeObject> | DataTypeObject} defaultValue
     * @param {string} getKey
     * @return {string} - a name of data type
     */
    static translateDatatypeName(defaultValue = this.DataTypeDefaultObject, getKey) {
        let text = '';
        const englishDataTypes = [
            DataTypes.REAL.name,
            DataTypes.INTEGER.name,
            DataTypes.INTEGER_CAT.name,
            DataTypes.STRING.name,
            DataTypes.DATETIME.name,
            DataTypes.TEXT.name,
            DataTypes.BOOLEAN.name,
        ];
        if (getKey) {
            text = datatypeI18nText[getKey];
            if (_.isObject(text)) {
                text = text[defaultValue.value];
            }
        } else if (englishDataTypes.includes(defaultValue.value)) {
            text = DataTypes[defaultValue.value].selectionBoxDisplay;
        } else {
            text = $('#' + DataTypes[defaultValue.value].i18nLabelID).text();
        }
        return text;
    }

    /**
     * Convert Column Type To Attr Key
     * @public
     * @param {number} columnType - column type
     * @return {ColumnTypeInfo} - column attribute dict
     */
    static convertColumnTypeToAttrKey(columnType = 99) {
        const col = {};
        switch (columnType) {
            case this.DataGroupType['MAIN_SERIAL']:
                col.is_serial_no = false;
                col.is_main_serial_no = true;
                return col;
            case this.DataGroupType['SERIAL']:
                col.is_serial_no = true;
                col.is_main_serial_no = false;
                return col;
            case this.DataGroupType['LINE_NAME']:
                col.is_line_name = true;
                return col;
            case this.DataGroupType['LINE_NO']:
                col.is_line_no = true;
                return col;
            case this.DataGroupType['EQ_NAME']:
                col.is_eq_name = true;
                return col;
            case this.DataGroupType['EQ_NO']:
                col.is_eq_no = true;
                return col;
            case this.DataGroupType['PART_NAME']:
                col.is_part_name = true;
                return col;
            case this.DataGroupType['PART_NO']:
                col.is_part_no = true;
                return col;
            case this.DataGroupType['ST_NO']:
                col.is_st_no = true;
                return col;
            case this.DataGroupType['JUDGE']:
                col.is_judge = true;
                return col;
            case this.DataGroupType['INT_CATE']:
                col.is_int_cat = true;
                return col;
            case this.DataGroupType['MAIN_DATE']:
                col.is_main_date = true;
                return col;
            case this.DataGroupType['MAIN_TIME']:
                col.is_main_time = true;
                return col;
            default:
                return col;
        }
    }
}
