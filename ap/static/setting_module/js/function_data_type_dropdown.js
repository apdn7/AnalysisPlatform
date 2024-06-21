/* eslint-disable no-unused-vars, no-undef */

/**
 * @file Contain all common functions to serve handling functions that relate to page.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 */

/**
 * @classdesc A class manage all activities of function data type dropdown
 * @class
 */
class FunctionDataTypeDropdown {
    /**
     * Data type of function column
     * @type {{
     *    mainDatetime: {name: string, value: number},
     *    equipName: {name: string, value: number},
     *    lineNo: {name: string, value: number},
     *    null: {name: string, value: null},
     *    stNo: {name: string, value: number},
     *    datetimeKey: {name: string, value: number},
     *    serial: {name: string, value: number},
     *    lineName: {name: string, value: number},
     *    equipNo: {name: string, value: number},
     *    partName: {name: string, value: number},
     *    partNo: {name: string, value: number},
     * }}
     */
    static DataTypes = {
        null: {value: null, name: ''},  // Empty item
        mainDatetime: {
            value: 1,
            name: $(procModali18n.i18nMainDatetime).text().replace('main::', ''),
        },
        datetimeKey: {
            value: 2,
            name: $(procModali18n.i18nDatetimeKey).text(),
        },
        serial: {
            value: 3,
            name: $(procModali18n.i18nSerialInt).text().replace(':Int', ''),
        },
        lineName: {
            value: masterDataGroup.LINE_NAME,
            name: $(procModali18n.i18nLineNameStr).text().replace(':Str', ''),
        },
        lineNo: {
            value: masterDataGroup.LINE_NO,
            name: $(procModali18n.i18nLineNoInt).text().replace(':Int', ''),
        },
        equipName: {
            value: masterDataGroup.EQUIP_NAME,
            name: $(procModali18n.i18nEqNameStr).text().replace(':Str', ''),
        },
        equipNo: {
            value: masterDataGroup.EQUIP_NO,
            name: $(procModali18n.i18nEqNoInt).text().replace(':Int', ''),
        },
        partName: {
            value: masterDataGroup.PART_NAME,
            name: $(procModali18n.i18nPartNameStr).text().replace(':Str', ''),
        },
        partNo: {
            value: masterDataGroup.PART_NO,
            name: $(procModali18n.i18nPartNoInt).text().replace(':Int', ''),
        },
        stNo: {
            value: masterDataGroup.STATION_NO,
            name: $(procModali18n.i18nStNoInt).text().replace(':Int', ''),
        },
    };

    /**
     * Constructor
     * @param {string} dataType - data type
     */
    constructor(dataType) {
        this.dataType = dataType;
    }

    /**
     * Generate HTML control of a dropdown
     * @param {string} index - index of dropdown
     * @param {?number} datatype - a value of selected DataType
     * @return {string} - HTML string of dropdown
     */
    static generateHTML(index, datatype = null) {
        const selectedDataType =
            Object.values(this.DataTypes).filter(d => d.value === datatype)[0];
        return `
<div class="multi-level-dropdown config-data-type-dropdown config-data-type-dropdown_${index}" data-index="${index}">
    <button class="btn btn-default dropdown-toggle" type="button">
        <span class="csv-datatype-selection row-item for-search" 
         name="${procModalElements.dataType}"
         id="dataTypeShowValue_${index}"
         data-value="${selectedDataType.value ?? ''}">${selectedDataType.name}</span>
    </button>
    <div class="data-type-selection" style="display: none;">
        <div class="data-type-selection-content data-type-selection-left">
            <div class="data-type-selection-box">
                <span class="data-type-selection-title">${$(procModali18n.i18nSpecial).text()}</span>
                <ul>
                    <li class="dataTypeSelection ${this.DataTypes.mainDatetime.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.mainDatetime.value}">${this.DataTypes.mainDatetime.name}</li>
                    <!--
                    <li class="dataTypeSelection ${this.DataTypes.datetimeKey.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.datetimeKey.value}">${this.DataTypes.datetimeKey.name}</li>
                    -->
                    <li class="dataTypeSelection ${this.DataTypes.serial.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.serial.value}">${this.DataTypes.serial.name}</li>
                </ul>
            </div>
            <div class="data-type-selection-box">
                <span class="data-type-selection-title">${$(procModali18n.i18nFilterSystem).text()}</span>
                <ul>
                    <li class="dataTypeSelection ${this.DataTypes.lineName.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.lineName.value}">${this.DataTypes.lineName.name}</li>
                    <li class="dataTypeSelection ${this.DataTypes.lineNo.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.lineNo.value}">${this.DataTypes.lineNo.name}</li>
                    <li class="dataTypeSelection ${this.DataTypes.equipName.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.equipName.value}">${this.DataTypes.equipName.name}</li>
                    <li class="dataTypeSelection ${this.DataTypes.equipNo.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.equipNo.value}">${this.DataTypes.equipNo.name}</li>
                    <li class="dataTypeSelection ${this.DataTypes.partName.value === selectedDataType ? 'active' : ''}" 
                     value="${this.DataTypes.partName.value}">${this.DataTypes.partName.name}</li>
                    <li class="dataTypeSelection ${this.DataTypes.partNo.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.partNo.value}">${this.DataTypes.partNo.name}</li>
                    <li class="dataTypeSelection ${this.DataTypes.stNo.value === selectedDataType ? 'active' : ''}"
                     value="${this.DataTypes.stNo.value}">${this.DataTypes.stNo.name}</li>
                </ul>
            </div>
        </div>
    </div>
</div>
        `;
    }

    /**
     * Disable dropdown list control
     * @param {HTMLDivElement} dropdownDiv - a div HTML object
     */
    static disable(dropdownDiv) {
        /** @type {HTMLButtonElement} */
        const button = dropdownDiv.firstElementChild;
        /** @type {HTMLSpanElement} */
        const span = button.firstElementChild;
        span.dataset.value = FunctionDataTypeDropdown.DataTypes.null.value;
        span.textContent = FunctionDataTypeDropdown.DataTypes.null.name;
        button.disabled = true;
    }

    /**
     * Enable dropdown list control
     * @param {HTMLDivElement} dropdownDiv - a div HTML object
     */
    static enable(dropdownDiv) {
        const button = dropdownDiv.firstElementChild;
        button.disabled = false;
    }

    /**
     * Get selected data type
     * @param {HTMLDivElement} dropdownDiv - a div HTML object
     */
    static getSelectedDatatype(dropdownDiv) {
        const spanElement = dropdownDiv.firstElementChild.firstElementChild;
        const selectedValue = spanElement.dataset.value;
        return {
            value: selectedValue === '' ? null : parseInt(selectedValue, 10),
            name: spanElement.textContent.trim(),
        };
    }

    /**
     * Handle li click event to select function data type
     * @param {Event} event - a click event
     */
    static #selectFunctionDataTypeEvent(event) {
        /** @type {HTMLLIElement} */
        const li = event.currentTarget;
        const selectedDatatype = li.value;

        if (li.getAttribute('disabled') === 'disabled') {
            return; // do nothing
        }

        /** @type {HTMLSpanElement} */
        const span = li.closest('.config-data-type-dropdown').firstElementChild.firstElementChild;
        span.dataset.value = String(selectedDatatype);
        span.textContent = li.textContent;

        /** @type {HTMLLIElement} */
        const previousSelectedLi = li.closest('.data-type-selection-content').querySelector('li.active');
        if (previousSelectedLi != null) {
            previousSelectedLi.classList.remove('active');
        }
        li.classList.add('active');

        DataTypeSelection.hideDropdownMenu();
    }

    /**
     * Handle button click event to show dropdown
     * @param {Event} event - a click event
     */
    static #showDropdownEvent(event) {
        // hide other dropdowns if it is showing
        DataTypeSelection.hideDropdownMenu();

        /** @type {HTMLButtonElement} */
        const button = event.currentTarget;
        const rowElement = button.closest('tr');
        const functionInfo = FunctionInfo.collectFunctionInfoByRow(rowElement);
        if (functionInfo.output === 'r') {
            return; // not show dropdown when this data type is real
        }

        // filter selected items
        const otherDropdowns = button
            .closest('tbody')
            .querySelectorAll(
                `tr:not([data-index="${functionInfo.index}"]) td.column-data-type .config-data-type-dropdown`
            );
        const otherSelectedValues = [...new Set([
            // function columns
            ...[...otherDropdowns].map(dropdownDiv => FunctionDataTypeDropdown.getSelectedDatatype(dropdownDiv).value),
            // normal columns
            ...currentProcDataCols.map(col => col.column_type),
        ])];
        const liItems = button.nextElementSibling.querySelectorAll('li.dataTypeSelection');
        liItems.forEach(li => {
            // disable item of it belongs to other function column, otherwise.
            if (otherSelectedValues.includes(li.value)) {
                li.setAttribute('disabled', 'disabled');
            } else {
                li.removeAttribute('disabled');
            }

            // set active for selected li
            if (li.value === functionInfo.dataType) {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
        });

        /** @type {jQuery<HTMLDivElement>} */
        const $dropdown = $(button.nextElementSibling);
        const dropdownHeight = $dropdown.height();
        const windowHeight = $(window).height() - 50;
        const left = event.clientX;
        let top = event.clientY;
        if (top + dropdownHeight > windowHeight) {
            top -= (top + dropdownHeight - windowHeight);
        }

        $dropdown.css({
            position: 'fixed',
            top,
            left,
            display: 'flex',
            zIndex: '999',
        });
    }

    /**
     * Inject events for dropdown
     * @param {HTMLDivElement} dropdownDiv - a div HTML object
     */
    static injectEvent(dropdownDiv) {
        dropdownDiv
            .firstElementChild
            .addEventListener('click', FunctionDataTypeDropdown.#showDropdownEvent);

        dropdownDiv
            .lastElementChild
            .querySelectorAll('ul li.dataTypeSelection:not([disabled="disabled"])')
            .forEach(li => {
                li.addEventListener('click', FunctionDataTypeDropdown.#selectFunctionDataTypeEvent);
            });
    }

    /**
     * Remove events for dropdown
     * @param {HTMLDivElement} dropdownDiv - a div HTML object
     */
    static removeEvent(dropdownDiv) {
        dropdownDiv
            .firstElementChild
            .removeEventListener('click', FunctionDataTypeDropdown.#showDropdownEvent);

        dropdownDiv
            .lastElementChild
            .querySelectorAll('ul li.dataTypeSelection:not([disabled="disabled"])')
            .forEach(li => {
                li.removeEventListener('click', FunctionDataTypeDropdown.#selectFunctionDataTypeEvent);
            });
    }
}