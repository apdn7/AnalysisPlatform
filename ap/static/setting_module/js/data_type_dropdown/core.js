/**
 * @file Contains core functions that serve for data type dropdown.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Class contains core function of dropdown menu
 */
class DataTypeDropdown_Core extends DataTypeDropdown_Event {
    /**
     * generate data type dropdown list Html
     * @param {number} idx
     * @param {DataTypeObject} defaultValue
     * @param {string} getKey
     * @param {?boolean} disableDropDownToggle
     * @return {string} - string HTML of dropdown
     */
    static generateHtml(idx = 0, defaultValue = this.DataTypeDefaultObject, getKey, disableDropDownToggle = false) {
        const text = defaultValue.text;
        const attrKey =
            getKey != null && getKey !== ''
                ? `${getKey}="true" column_type=${this.DataGroupType[mappingDataGroupType[getKey]]} data-attr-key=${getKey}`
                : '';

        return `
<div
    class="multi-level-dropdown config-data-type-dropdown config-data-type-dropdown_${idx}"
>
    <button 
        class="btn btn-default dropdown-toggle" 
        type="button"
        ${defaultValue.is_master_col || disableDropDownToggle ? 'disabled' : ''}
    >
        <span 
            class="csv-datatype-selection row-item for-search"
            name="${procModalElements.dataType}"
            id="dataTypeShowValue_${idx}"
            value="${defaultValue.value}"
            is-registered-col="${defaultValue.isRegisteredCol}"
            is_get_date="${defaultValue.is_get_date ?? ''}"
            data-observer="${text}"
            ${attrKey}
            ${defaultValue.checked}
        >${text}</span>
    </button>
    <div class="data-type-selection">
        <div class="data-type-selection-content data-type-selection-left">
            <div class="data-type-selection-box">
                <span class="data-type-selection-title">${$(procModali18n.i18nSpecial).text()}</span>
                <ul>
                    <li 
                        class="dataTypeSelection" 
                        ${defaultValue.isRegisterProc ? 'disabled=disabled' : ''} 
                        is_get_date value="${DataTypes.DATETIME.name}" 
                        data-type="${DataTypes.DATETIME.name}"
                        title="${$(procModali18n.i18nDataTypeMainDatetimeHover).text()}"
                    >${$(procModali18n.i18nMainDatetime).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_main_date 
                        value="${DataTypes.DATE.name}" 
                        data-type="${DataTypes.DATE.name}"
                        title="${$(procModali18n.i18nDatatypeMainDateHover).text()}"
                    >${$(procModali18n.i18nMainDate).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_main_time 
                        value="${DataTypes.TIME.name}" 
                        data-type="${DataTypes.TIME.name}"
                        title="${$(procModali18n.i18nDataTypeMainTimeHover).text()}"
                    >${$(procModali18n.i18nMainTime).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_main_serial_no 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${$(procModali18n.i18nDataTypeMainSerialIntHover).text()}"
                    >${$(procModali18n.i18nMainSerialInt).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_main_serial_no 
                        value="${DataTypes.TEXT.name}" 
                        data-type="${DataTypes.TEXT.name}"
                        title="${$(procModali18n.i18nDataTypeMainSerialStringHover).text()}"
                    >${$(procModali18n.i18nMainSerialStr).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_auto_increment 
                        value="${DataTypes.DATETIME.name}" 
                        data-type="${DataTypes.DATETIME.name}"
                        title="${$(procModali18n.i18nDataTypeDatetimeKeyHover).text()}"
                    >${$(procModali18n.i18nDatetimeKey).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_serial_no 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${$(procModali18n.i18nDataTypeSerialIntHover).text()}"
                    >${$(procModali18n.i18nSerialInt).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_serial_no 
                        value="${DataTypes.TEXT.name}" 
                        data-type="${DataTypes.TEXT.name}"
                        title="${$(procModali18n.i18nDataTypeSerialStringHover).text()}"
                    >${$(procModali18n.i18nSerialStr).text()}</li>
                </ul>
            </div>
            <div class="data-type-selection-box">
                <span class="data-type-selection-title">${$(procModali18n.i18nFilterSystem).text()}</span>
                <ul>
                    <li 
                        class="dataTypeSelection" 
                        is_part_name 
                        value="${DataTypes.TEXT.name}" 
                        data-type="${DataTypes.TEXT.name}"
                        title="${$(procModali18n.i18nDataTypePartNameStrHover).text()}"
                    >${$(procModali18n.i18nPartNameStr).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_part_no 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${$(procModali18n.i18nDataTypePartNoIntHover).text()}"
                    >${$(procModali18n.i18nPartNoInt).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_line_name 
                        value="${DataTypes.TEXT.name}" 
                        data-type="${DataTypes.TEXT.name}"
                        title="${$(procModali18n.i18nDataTypeLineNameStrHover).text()}"
                    >${$(procModali18n.i18nLineNameStr).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_line_no 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${$(procModali18n.i18nDataTypeLineNoIntHover).text()}"
                    >${$(procModali18n.i18nLineNoInt).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_eq_name 
                        value="${DataTypes.TEXT.name}" 
                        data-type="${DataTypes.TEXT.name}"
                        title="${$(procModali18n.i18nDataTypeEqNameStrHover).text()}"
                    >${$(procModali18n.i18nEqNameStr).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_eq_no 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${$(procModali18n.i18nDataTypeEqNoIntHover).text()}"
                    >${$(procModali18n.i18nEqNoInt).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_st_no 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${$(procModali18n.i18nDataTypeStNoIntHover).text()}"
                    >${$(procModali18n.i18nStNoInt).text()}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_judge 
                        value="${DataTypes.BOOLEAN.name}" 
                        data-type="${DataTypes.BOOLEAN.name}"
                        title="${$(procModali18n.i18nDataTypeJudgeHover).text()}"
                    >${$(procModali18n.i18nJudgeNo).text()}</li>
                </ul>
            </div>
        </div>
        <div class="data-type-selection-content data-type-selection-right">
            <div class="data-type-selection-box">
                <span class="data-type-selection-title">${$(procModali18n.i18nDatatype).text()}</span>
                <ul>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.REAL.name}" 
                        data-type="${DataTypes.REAL.name}"
                        title="${DataTypes.REAL.selectionBoxDisplay}"
                    >${DataTypes.REAL.selectionBoxDisplay}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${DataTypes.INTEGER.selectionBoxDisplay}"
                    >${DataTypes.INTEGER.selectionBoxDisplay}</li>
                    <li 
                        class="dataTypeSelection" 
                        is_int_cat 
                        value="${DataTypes.INTEGER.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${DataTypes.INTEGER_CAT.selectionBoxDisplay}"
                    >${DataTypes.INTEGER_CAT.selectionBoxDisplay}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.TEXT.name}" 
                        data-type="${DataTypes.TEXT.name}"
                        title="${DataTypes.STRING.selectionBoxDisplay}"
                    >${DataTypes.STRING.selectionBoxDisplay}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.BOOLEAN.name}" 
                        data-type="${DataTypes.BOOLEAN.name}"
                        title="${DataTypes.BOOLEAN.selectionBoxDisplay}"
                    >${DataTypes.BOOLEAN.selectionBoxDisplay}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.DATETIME.name}" 
                        data-type="${DataTypes.DATETIME.name}"
                        title="${DataTypes.DATETIME.selectionBoxDisplay}"
                    >${DataTypes.DATETIME.selectionBoxDisplay}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.REAL_SEP.name}" 
                        data-type="${DataTypes.REAL.name}"
                        title="${procModali18n.i18nRealSep}"
                    >${procModali18n.i18nRealSep}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.INTEGER_SEP.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${procModali18n.i18nIntSep}"
                    >${procModali18n.i18nIntSep}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.EU_REAL_SEP.name}" 
                        data-type="${DataTypes.REAL.name}"
                        title="${procModali18n.i18nEuRealSep}"
                    >${procModali18n.i18nEuRealSep}</li>
                    <li 
                        class="dataTypeSelection" 
                        only-datatype 
                        value="${DataTypes.EU_INTEGER_SEP.name}" 
                        data-type="${DataTypes.INTEGER.name}"
                        title="${procModali18n.i18nEuIntSep}"
                    >${procModali18n.i18nEuIntSep}</li>
                </ul>
            </div>
            <!--
            <div class="data-type-selection-box">
                <span class="data-type-selection-title">${$(procModali18n.i18nMultiset).text()}</span>
                <ul>
                    <li class="copyToAllBelow copy-item">${$(procModali18n.copyToAllBelow).text()}</li>
                    <li class="copyToFiltered copy-item">${$(procModali18n.i18nCopyToFiltered).text()}</li>
                </ul>
            </div>
            -->
        </div>
    </div>
</div>
`;
    }
}
