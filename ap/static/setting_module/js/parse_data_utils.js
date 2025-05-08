/**
 * @file Contains all functions relate to parsing data.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Parse to Integer data
 * @param {number|string} v
 * @return {number|string} - a parsed value or empty in case cannot be parsed
 */
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

/**
 * Parse to Float data
 * @param {number|string} v
 * @return {string} - a parsed value or empty in case cannot be parsed
 */
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

/**
 * Parse to boolean data
 * @param {number|boolean|string} v
 * @return {string} - a parsed value or empty in case cannot be parsed
 */
const parseBooleanData = (v) => {
    let val = trimBoth(String(v));
    if (['1', 'true'].includes(val)) {
        val = 'true';
    } else if (['0', 'false'].includes(val)) {
        val = 'false';
    } else {
        val = '';
    }
    return val;
};

/**
 * Parse to boolean data
 * @param {number|boolean|string} v
 * @return {string} - a parsed value or empty in case cannot be parsed
 */
const parseJudgeData = (v) => {
    let val = trimBoth(String(v));
    if (val === '1' || val === 1) {
        val = 'OK';
    } else if (val === '0' || val === 0) {
        val = 'NG';
    } else {
        val = '';
    }
    return val;
};

/**
 * Parse Data Type for sample data in row
 * @param {SpreadSheetProcessConfig} spreadsheet - spreadsheet
 * @param {dataType} ele - dataType
 * @param {number|string?} idx - index of row in table's body
 * @param {string} columnType - column type of row in table's body
 * @param {HTMLDivElement?} dataTypeDropdownElement - a div HTML object of datatype dropdown menu
 */
const parseDataTypeProc = (spreadsheet, dataType, idx, columnType, dataTypeDropdownElement = null) => {
    // change background color
    // changeBackgroundColor(ele);

    const vals = [...$(`#${spreadsheet.table.table.el.id}`).find(`tr:eq(${Number(idx) + 1}) .sample-data`)].map((el) =>
        $(el),
    );
    const getParamsForFormatDatetime = () => {
        return {
            dataType: dataType,
            rowIdx: idx,
            isGeneratedMainDatetimeColumn: false, // TODO: Check isGeneratedMainDatetimeColumn
        };
    };
    const attrName = DATA_ORIGINAL_ATTR;

    switch (dataType) {
        case DataTypes.INTEGER.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                const isBigInt = !!+e.attr('is-big-int');
                if (!isBigInt) {
                    val = parseIntData(val);
                }
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
        case DataTypes.EU_INTEGER_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = val.replaceAll('.', '');
                val = val.replaceAll(',', '.');
                val = parseIntData(val);
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
        case DataTypes.REAL_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                val = val.replaceAll(',', '');
                val = parseFloatData(val);
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
        case DataTypes.DATETIME.name:
            showProcDatetimeFormatSampleData(spreadsheet, getParamsForFormatDatetime());
            break;
        case DataTypes.DATE.name:
            showProcDatetimeFormatSampleData(spreadsheet, getParamsForFormatDatetime());
            break;
        case DataTypes.TIME.name:
            showProcDatetimeFormatSampleData(spreadsheet, getParamsForFormatDatetime());
            break;
        case DataTypes.BOOLEAN.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                if (columnType === masterDataGroup.JUDGE) {
                    val = parseJudgeData(val);
                } else {
                    val = parseBooleanData(val);
                }
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

const parseProcDatetimeFormatSampleData = async (dataType, values) => {
    const condition = displayDatetimeFormatCondition();
    const inputFormat = procModalElements.procDateTimeFormatInput.val().trim();
    if (condition.showRawData) {
        return values;
    } else {
        return await parseProcDatetimeInputFormat(inputFormat, dataType, values);
    }
};

const parseProcDatetimeInputFormat = async (inputFormat, dataType, values, isGeneratedMainDatetimeColumn = false) => {
    const clientTimezone = detectLocalTimezone();
    const formattedData = await fetch('/ap/api/setting/datetime_format', {
        method: 'POST',
        body: JSON.stringify({
            data: values,
            format: inputFormat,
            dataType: dataType,
            clientTimezone: clientTimezone,
            isGeneratedDatetime: isGeneratedMainDatetimeColumn,
        }),
    })
        .then((response) => response.json())
        .catch((res) => {
            console.log('Can not apply format');
        });
    return formattedData;
};
