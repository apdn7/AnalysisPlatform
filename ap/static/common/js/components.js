/* eslint-disable no-unused-vars,no-use-before-define,no-trailing-spaces,prefer-arrow-callback */
/* eslint-disable no-loop-func */
/* eslint-disable no-undef */
let i18nCommon = {};
const MAX_DYNAMIC_CARD = 50;


// use this config for select2
const select2ConfigI18n = {
    language: {
        errorLoading() {
            return 'ERROR_LOADING';
        },
        inputTooLong(args) {
            return 'INPUT_TOO_LONG';
        },
        inputTooShort(args) {
            return 'INPUT_TOO_SHORT';
        },
        loadingMore() {
            return 'LOADING_MORE';
        },
        maximumSelected(args) {
            return 'MAX_SELECTED';
        },
        noResults() {
            return '';
        },
        searching() {
            return 'SEARCHING';
        },
    },
};
const countUp = (cnt, minNumber = 1, maxNumber = MAX_DYNAMIC_CARD) => (cnt >= maxNumber ? minNumber : cnt + 1);
const extractNumberAtTheEnd = (inputStr) => {
    const matches = inputStr.match(/\d+$/);

    if (matches) {
        return Number(matches[0]);
    }

    return null;
};

const checkExistDataGenBtn = (btnId, count, parentFormId = '', maxNumber = MAX_DYNAMIC_CARD) => {
    const DYNAMIC_ELE_ATTR = 'data-gen-btn';
    if (parentFormId && parentFormId[0] !== '#') {
        parentFormId = `#${parentFormId}`;
    }

    const eles = $(`${parentFormId} [${DYNAMIC_ELE_ATTR}=${btnId}]`);
    if (eles.length >= maxNumber) {
        throw 'MAX COMPONENT!';
    }
    for (let i = 0; i < eles.length; i++) {
        if (count === extractNumberAtTheEnd(eles[i].id)) {
            return true;
        }
    }

    return false;
};

const updateI18nCommon = async () => {
    i18nCommon = {
        // summary tables
        total: $('#i18nTotal').text(),
        average: $('#i18nAverage').text(),
        ucl: $('#i18nUCL').text(),
        lcl: $('#i18nLCL').text(),
        pnProc: $('#i18PnProc').text(),
        pProc: $('#i18PProc').text(),
        maxValue: $('#i18MaxValue').text(),
        minValue: $('#i18MinValue').text(),
        median: $('#i18nMedian').text(),
        smedian: $('#i18nMedian').text(),
        none: $('#i18None').text(),
        summary: $('#i18Summary').text(),
        sCount: $('#i18Count').text(),
        basicStatistics: $('#i18BasicStatistics').text(),
        nonParametric: $('#i18NonParametric').text(),
        qualityOfData: $('#i18QualityOfData').text(),
        outControlLine: $('#i18OutControlLine').text(),
        outActionLine: $('#i18OutActionLine').text(),
        overflowPlus: $('#i18OverflowUpper').text(),
        overflowMinus: $('#i18OverflowLower').text(),

        // summary hovers
        hoverNTotal: $('#i18nHoverNTotal').text(),
        numberDataNotLinked: $('#i18nNumberDataNotLinked').text(),
        hoverOutCL: $('#i18nHoverOutCL').text(),
        hoverOutAL: $('#i18nHoverOutAL').text(),
        hoverPNA: $('#i18nHoverPNA').text(),
        hoverPNaN: $('#i18nHoverPNaN').text(),
        hoverPInfPlus: $('#i18nHoverPInfPlus').text(),
        hoverPInfMinus: $('#i18nHoverPInfMinus').text(),
        hoverPTotal: $('#i18nHoverPTotal').text(),
        hoverN: $('#i18nHoverN').text(),
        hoverMedian: $('#i18nHoverMedian').text(),
        hoverP95: $('#i18nHoverP95').text(),
        hoverP75Q3: $('#i18nHoverP75Q3').text(),
        hoverP25Q1: $('#i18nHoverP25Q1').text(),
        hoverP5: $('#i18nHoverP5').text(),
        hoverIQR: $('#i18nHoverIQR').text(),
        hoverNIQR: $('#i18nHoverNIQR').text(),
        hoverMode: $('#i18nHoverMode').text(),
        hoverNoLinked: $('#i18nHoverNoLinked').text(),
        hoverDuplicate: $('#i18nHoverDuplicate').text(),

        search: $('#i18nSearching').text(),
        process: $('#i18nProcessNameWithoutName').text(),
        allSelection: $('#i18nAll').text(),
        noFilter: $('#i18nNoFilter').text(),
        colsDuplicated: $('#i18nColsDuplicated').text(),

        settingScale: $('#i18nSettingScale').text(),
        commonScale: $('#i18nCommonScale').text(),
        thresholdLine: $('#i18nThresholdLine').text(),
        autoScale: $('#i18nAutoScale').text(),
        autoRange: $('#i18nAutoRange').text(),
        fullRange: $('#i18nFullRange').text(),
        graphVerticalRange: $('#i18nGraphVerticalRange').text(),

        startPoint: $('#i18nStartPoint').text(),
        filter: $('#i18nFilter').text(),
        dateRange: $('#i18nDateRange').text(),
        line: $('#i18nLine').text(),
        mach: $('#i18nMachineNo').text(),
        partNo: $('#i18nPartNo').text(),

        use: $('#i18nUse').text(),
        load: $('#i18nLoad').text(),
        edit: $('#i18nEdit').text(),
        delete: $('#i18nDelete').text(),
        autoUpdate: $('#i18nAutoUpdate').text(),
        exceptionEstimation: $('#i18nExceptionEstimation').text(),
        div: $('#i18nDiv').text(),
        colorExplanation: $('#i18nColorExplanation').text(),
        changedToMaxValue: $('#i18nChangedDivisionNumberToMax').text(),
        limitDisplayedGraphs: $('#i18nLimitDisplayedGraphs').text(),
        limitDisplayedGraphsInOneTab: $('#i18nLimitDisplayedGraphsInOneTab').text(),
        availableSelectMinMaxSensor: $('#i18nAvailableSelectMinMaxSensor').text(),
        availableSelectMaxSensor: $('#i18nAvailableSelectMaxSensor').text(),
        saveSetting: $('#i18nSaveSetting').text(),
        notApplicable: $('#i18nNotApplicable').text(),
        copyClipboardSuccessful: $('#i18nCopyClipboardSuccessful').text(),
        copyClipboardFailed: $('#i18nCopyClipboardFailed').text(),
        saveUserSettingConfirm: $('#i18nSaveUserSettingConfirm').text(),
        editUserSettingConfirm: $('#i18nEditUserSettingConfirm').text(),
        changeDivConfirmText: $('#i18nChangeDivConfirmText').text(),
        changeDivideOptionConfirmText: $('#i18nChangeDivideOptionConfirm').text(),
        first: $('#i18nFirst').text(),
        last: $('#i18nLast').text(),
        all: $('#i18nAll2').text(),
        duplicatedSerial: $('#i18nDuplicatedSerial').text(),
        duplicatedSerialHoverMsg: $('#i18nDuplicatedHoverMessage').text(),
    };
};

setTimeout(() => {
    updateI18nCommon().then(() => {
        if (!i18nCommon.total) {
            setTimeout(updateI18nCommon, 1000);
        }
    });
}, 500);

const objectiveInputEventHandle = () => {
    $('input[name="objectiveVar"]').on('change', (e) => {
        const isChecked = e.currentTarget.checked;
        const parentRow = $(e.target).closest('li.list-group-item.form-check');
        isChecked && parentRow.find('input[type=checkbox]').prop('checked', true);
    });
};

const inputCheckInlineEvents = (parentId) => {
    $(`#${parentId} li.list-group-item`).on('click', (e) => {
        const firstInputIsChecked = $(e.currentTarget).find('input:eq(0)')[0].checked;
        const childInputElems = $(e.target).find('input');

        if ($(e.target).is('select')) {
            return;
        }

        const [childInput] = childInputElems.length ? childInputElems : $(e.target).parent().find('input');
        // check if this input is CL
        const isSecondaryCheckbox = ['thresholdBox', 'catExpBox', 'objectiveVar', 'colorVar'].includes(childInput.name)
            || childInput.name.includes('GET02_CATE_SELECT');

        if (isSecondaryCheckbox) {
            $(e.target).find('input').each((idx, item) => {
                let inputStatus = true;
                if (item.type === 'checkbox' || item.name == 'colorVar') {
                    inputStatus = !childInput.checked;
                }
                $(item).prop('checked',inputStatus ).trigger('change');
            });
            return;
        }
        if (childInputElems.length || !isSecondaryCheckbox) {
            // if (childInputElems.length) {
            $(e.currentTarget).find('input').each((idx, item) => {
                // fpp label column
                if ($(item).attr('data-autoselect') === 'false' || $(item).prop('disabled')) {
                    return;
                }
                if (item.type === 'radio' && item.name !== 'colorVar') {
                    item.checked = true;
                } else if (item.type === 'checkbox') {
                    item.checked = !firstInputIsChecked;
                }
                $(item).trigger('change');
            });
        } else {
            // to check CL input
            $(e.target).parent().find('input').each((idx, item) => {
                if (item.type === 'radio') {
                    item.checked = true;
                } else if (item.type === 'checkbox') {
                    item.checked = !childInput.checked;
                }
                $(item).trigger('change');
            });
        }
    });
};

const genColDOM = (isShow, label, description, textCenter = false) => {
    // todo: check nofilter option
    if (isShow) {
        return `<div class="col px-1 fit-item title-col">
            <h6 title="${description}" class="${textCenter ? 'text-center' : ''}" style="text-decoration: underline">${label}</h6>
        </div>`;
    }
    return '';
};

let limitedCheckedList = [];

const addGroupListCheckboxWithSearch = (parentId, id, label, itemIds, itemVals,
    checkedIds = null, name = null, noFilter = false,
    itemNames = null, thresholdBoxes = null, itemDataTypes = null,
    isRadio = null, showCatExp = null, isRequired = false,
    getDateColID = null, showObjectiveInput = false, objectiveID = null,
    showLabel = false, catLabels = [], groupIDx = null, showColor = false,
    hasDiv = false, hideStrVariable = false) => {
    const mainChkBoxClass = 'main-checkbox';
    const indexDic = {
        dataType: 2,
        label: 3,
        color: 4,
        catExp: 5,
        objective: 6,
    };
    const genDetailItem = (chkBox, shownName = null, thresholdBox = null,
        dataType = null, catExpBox = null, isGetDate = false,
        objectiveSelectionDOM = null, categoryLabelDOM = null, colorDOM = null) => {
        if (!chkBox) {
            return '';
        }
        const checkboxClass = 'custom-control custom-checkbox';
        const radioClass = 'custom-control custom-radio';
        const masterNameClass = 'column-master-name';
        let commonClass = checkboxClass;
        if (isRadio) {
            commonClass = radioClass;
        }

        const col = thresholdBox ? '10' : '12';

        let html = `<div class="col-md-${col} col-xs-${col} ${commonClass}">
                    ${chkBox}
                    </div>`;

        if (shownName) {
            const originalTotalCol = [chkBox, shownName, itemDataTypes, showLabel, showColor, showCatExp, showObjectiveInput];
            html = `
                <div class="col-sm-4 col-xs-4 ${commonClass} shorten-name pr-1 search-col" title="${shownName}">
                    ${chkBox}
                </div>
                <div class="col-sm-4 col-xs-4 ${masterNameClass} shorten-name pr-1 search-col" title="${shownName}">
                    ${dataType === DataTypes.DATETIME.name ? (isGetDate ? '' : shownName) : shownName}
                </div>
            `;
            for (let i = 2; i < originalTotalCol.length; i++) {
                if (originalTotalCol[i]) {
                    if (i === indexDic.dataType) {
                        // data type;
                        const title = $(`#${DataTypes[dataType].exp}`).text();
                        const text = DataTypes[dataType].short;
                        const hiddenValue = DataTypes[dataType].short === DataTypes.DATETIME.short ? DataTypes.STRING.short : DataTypes[dataType].short;
                        const hiddenDataTypeInput = `<input id="dataType-${$(chkBox).val()}" value="${hiddenValue}" hidden disabled>`;
                        html += `<div class="col data-type fit-item px-1 search-col" title="${title}">
                                      ${text}${hiddenDataTypeInput}
                                 </div>`;
                    }
                    if (i === indexDic.label) {
                        // label
                        const title = 'Label';
                        html += `<div class="col ${checkboxClass} fit-item text-center pr-1 d-flex" title="${title}">
                                    ${categoryLabelDOM || ''}
                                 </div>`;
                    }
                    if (i === indexDic.color) {
                        // color
                        html += `
                            <div class="col fit-item text-center px-1 flex-row-center justify-content-center" title="">
                                  ${colorDOM}
                             </div>
                        `;
                    }
                    if (i === indexDic.catExp) {
                        // cat exp box
                        const title = 'Cat Expansion'; // TODO: i18n
                        html += `<div class="col-sm-2 col-xs-2 ${checkboxClass} fit-item px-1 flex-row-center justify-content-center" title="${title}">
                                    ${catExpBox}
                                 </div>`;
                    }
                    if (i === indexDic.objective) {
                        // objective
                        html += `<div class="col-sm-2 col-xs-2 fit-item">
                                    <div class="custom-control custom-radio">${objectiveSelectionDOM}</div>
                                </div>`;
                    }
                }
            }
        }

        if (thresholdBox) {
            html += `<div class="col-sm-1 col-xs-2 ${checkboxClass} plc-38">
                           ${thresholdBox}
                       </div>`;
        }

        const output = `<li class="list-group-item form-check">
                            <div class="row" style="padding-left: 5px">
                               ${html}
                            </div>
                        </li> `;

        return output;
    };

    if (itemIds == null) {
        return;
    }
    let inputType = 'checkbox';
    if (isRadio) {
        inputType = 'radio';
    }

    const i18nHoverText = {
        threshold: $('#i18nSetThreshold').text(),
        sensorExp: $('#i18nSensorTypeExplain').text(),
        catExp: $('#i18nCatExpExplain').text(),
        catExpLabel: $('#i18nCatExp').text(),
        objectiveLabel: $('#i18nObjective').text(),
        objectiveExpl: $('#i18nObjectiveExplain').text(),
        labelExplain: $('#i18nLabelVariableDescription').text(),
    };

    // items
    let isChecked;
    const isExpand = itemIds.length > 4;
    const itemList = [];
    for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];
        const itemVal = itemVals[i];
        let itemName = null;
        let threshold = null;
        if (itemNames) {
            itemName = itemNames[i];
        }
        const chkBoxId = `${inputType}-${itemId + parentId}`;
        let thresholdChkBoxId = null;
        if (thresholdBoxes) {
            threshold = thresholdBoxes[i];
            if (threshold) {
                thresholdChkBoxId = `threshold-${chkBoxId}`;
                threshold = `<input title="${i18nHoverText.threshold}" type="checkbox" name="thresholdBox"
                            class="custom-control-input check-item" value="${itemId}" id="${thresholdChkBoxId}">
                            <label title="${i18nHoverText.threshold}" class="custom-control-label" for="${thresholdChkBoxId}"></label>`;
            }
        }

        // data types and cat expansion
        let colDataType = null;
        let catExpBox = ''; // don't set null , it will show null on screen
        let catExpChkBoxId = null;
        if (itemDataTypes) {
            colDataType = DataTypes[itemDataTypes[i]].org_type;
            catExpChkBoxId = `catExp-${chkBoxId}`;
            if (showCatExp && [DataTypes.INTEGER.name, DataTypes.STRING.name, DataTypes.TEXT.name].includes(colDataType)) {
                catExpBox = `<select name="catExpBox" id="catExpItem-${itemId}" onchange="changeFacetLevel(this);"
                                data-load-level="2" class="form-control level-select">
                    <option value="">---</option>
                    <option value="1">Lv1</option>
                    <option value="2">Lv2</option>
                    ${hasDiv ? '<option value="3">Div</option>' : ''}
                </select>`;
            }
        }

        const isRequiredInput = isRequired ? 'required-input' : '';
        let objectiveSelectionDOM = '';
        if (showObjectiveInput) {
            const objectiveChkBoxId = `objectiveVar-${itemId}`;
            objectiveSelectionDOM = `<input title="" type="radio" name="objectiveVar" onchange="compareSettingChange()"
                class="custom-control-input ${isRequiredInput}" value="${itemId}"
                id="${objectiveChkBoxId}" data-autoselect="false">
                <label title="" class="custom-control-label" for="${objectiveChkBoxId}"></label>`;
        }

        let categoryLabelDOM = null;
        if (showLabel) {
            const clChkBoxId = `categoryLabel-${itemId}`;
            let clSelection = '';
            // todo: check category item
            if (catLabels.length && catLabels.includes(itemId)) {
                clSelection = 'selected="selected"';
            }
            const categoryGroupId = groupIDx || 1;
            if ([DataTypes.INTEGER.name, DataTypes.STRING.name, DataTypes.TEXT.name].includes(colDataType)) {
                categoryLabelDOM = `<input title="" onchange="compareSettingChange()" type="checkbox" name="GET02_CATE_SELECT${categoryGroupId}"
                    class="custom-control-input check-item" value="${itemId}"
                    id="${clChkBoxId}"${clSelection} data-autoselect="false">
                    <label title="" class="custom-control-label single-check-box" for="${clChkBoxId}"></label>`;
            }
        }

        let colorDOM = null;
        if (showColor) {
            const radioButtonColorId = `scp-color-${itemId}`;
            colorDOM = `<div class="custom-control custom-radio d-flex pl-0">
                            <input type="radio" name="colorVar" onchange="compareSettingChange()"
                                  class="custom-control-input" value="${itemId}"
                                  id="${radioButtonColorId}">
                            <label title="" class="custom-control-label uncheck-when-click single-check-box" for="${radioButtonColorId}"></label>
                        </div>`;
        }

        isChecked = (checkedIds && checkedIds.includes(itemId)) ? 'checked' : '';
        const isHideCheckInput = hideStrVariable && colDataType === DataTypes.STRING.name;
        const hideClass = isHideCheckInput ? ' hidden-input' : '';

        const inputEl = !isHideCheckInput ? `<input type="${inputType}" name="${name}" ${showColor ? 'data-order=2' : ''}
            class="custom-control-input check-item ${mainChkBoxClass} ${isRequiredInput}"  value="${itemId}"
            id="${chkBoxId}" ${isChecked}>` : '';

        const option = `
            ${inputEl}
           <label class="custom-control-label${hideClass}" for="" title="${itemVal}">${itemVal}</label>`;

        const isGetDate = (itemId === getDateColID);
        itemList.push(
            genDetailItem(option, itemName, threshold, colDataType, catExpBox,
                isGetDate, objectiveSelectionDOM, categoryLabelDOM, colorDOM),
        );
    }

    const sensorListId = `list-${id}`;
    let noFilterOption = null;
    let allOption = null;
    const isShowThreshold = noFilter ? false : thresholdBoxes;

    const thresholdBoxDOM = genColDOM(isShowThreshold, 'CL', i18nHoverText.threshold);
    const typeColDOM = genColDOM(itemDataTypes, 'Type', i18nHoverText.sensorExp);
    const objColDOM = genColDOM(showObjectiveInput, i18nHoverText.objectiveLabel, i18nHoverText.objectiveExpl);
    const categoryLabelColDOM = genColDOM(showLabel, 'Label', i18nHoverText.labelExplain);
    const catExpDOM = genColDOM(showCatExp, i18nHoverText.catExpLabel, i18nHoverText.catExp);
    const colorTile = genColDOM(showColor, 'Color', i18nCommon.colorExplanation, true);
    // const defaultColSize = '';
    if (!isRadio) {
        if (noFilter) {
            isChecked = (checkedIds && itemIds.some(e => checkedIds.includes(e))) ? '' : 'checked';
            noFilterOption = `<div class="row">
                <div class="col-sm-10">
                    <input type="${inputType}" name="${name}"
                        class="custom-control-input checkbox-no-filter"
                        id="checkbox-no-filter-${id + parentId}"
                        value="NO_FILTER" ${isChecked}>
                    <label class="custom-control-label" for="checkbox-no-filter-${id + parentId}">
                        ${i18nCommon.noFilter}</label>
                </div>
                <div class="col-sm-1 pl-1"><h6 title="${i18nHoverText.threshold}"
                    style="text-decoration: underline; min-width: 35px">CL</h6></div>
            </div>`;
        } else {
            isChecked = (checkedIds && !isEmpty(itemIds)
                && itemIds.every(e => checkedIds.includes(e))) ? 'checked' : '';
        }
        const requiredClass = isRequired ? 'required-input' : '';
        allOption = `<div class="row">
            <div class="col-sm-8 col-xs-8 pr-1 search-col">
                 <input type="${inputType}" name="${name}"
                    class="custom-control-input checkbox-all ${requiredClass}"
                     id="checkbox-all-${id + parentId}" value="All" ${!noFilter && isChecked} ${showColor ? 'hidden disabled' : ''}>
                <label class="custom-control-label ${showColor ? 'd-none' : ''}"
                    for="checkbox-all-${id + parentId}">${i18nCommon.allSelection}</label>
            </div>
            ${typeColDOM}
            ${thresholdBoxDOM}
            ${categoryLabelColDOM}
            ${colorTile}
            ${catExpDOM}
            ${objColDOM}
        </div>`;
    }

    const labelClass = label ? 'flex-grow-1 border-gray-curve' : '';
    const groupLabelClass = label ? '' : 'border-gray-curve';
    const expandClass = isExpand ? 'expand-arrow' : '';
    const expandArrow = isExpand ? `<span class="arrow ${sensorListId}"></span>` : '';
    const labelContent = label ? `<div class="d-flex">
        <div class="p-2" style="flex-basis:80px;">${label}</div>` : '';
    const groupList = `<div class="form-group list-item mb-0 ${groupLabelClass}" id="${id}"
        style="border-radius: 3px">
            ${labelContent}
            <div class="floating-dropdown-parent ${labelClass}${expandClass}">
                ${expandArrow}
                ${searchItems(id)}
                <ul class="list-group grouplist-checkbox-with-search" id="${sensorListId}" >
                    ${genDetailItem(noFilterOption)}
                    ${genDetailItem(allOption)}
                    ${itemList.join(' ')}
                </ul>
            </div>
            ${label ? '</div>' : ''}
        </div>`;
    $(`#${parentId}`).append(groupList);

    // show sensors as a floating list when hover for 1s
    // eslint-disable-next-line no-use-before-define
    showSensorAsFloatingList(sensorListId);

    // ADD EVENTS
    // check all event
    $(`#checkbox-all-${id + parentId}`).change(function f() {
        $(`#${this.closest('.list-group').id} .checkbox-no-filter`).prop('checked', !$(this).prop('checked'));
        $(`#${this.closest('.list-group').id} .${mainChkBoxClass}`).prop('checked', $(this).prop('checked'));
        compareSettingChange();
    });
    // check to mark no filter
    $(`#checkbox-no-filter-${id + parentId}`).change(function f() {
        $(`#${this.closest('.list-group').id} .checkbox-all`).prop('checked', !$(this).prop('checked'));
        $(`#${this.closest('.list-group').id} .${mainChkBoxClass}`).prop('checked', !$(this).prop('checked'));
        compareSettingChange();
    });

    // check event
    $(`#${id} .check-item`).on('change', function f() {
        const checkboxNoFilter = $(`#${this.closest('.list-group').id} .checkbox-no-filter`);
        const thresholdBox = $(`#threshold-${this.id}`);
        const isCheckLimit = MAX_END_PROC && /VALS_SELECT/.test($(this).attr('name'));

        if ($(this).is(':checked') === false) {
            $(`#${this.closest('.list-group').id} .checkbox-all`).prop('checked', $(this).prop('checked'));
            const parentRow = $(this.closest('li.list-group-item.form-check'));
            parentRow.find('[name=objectiveVar]').prop('checked', false);
            thresholdBox.prop('checked', false);
            if (isCheckLimit) {
                limitedCheckedList = limitedCheckedList.filter(el => el.val() !== $(this).val());
                if (showColor) {
                    $(this).removeAttr('data-sensor');
                    $(this.closest('.list-group-item')).find('[name=catExpBox]').prop('disabled', false);
                }
            }
        } else {
            thresholdBox.prop('checked', true);
            if (isCheckLimit) {
                limitedCheckedList.push($(this));
                if (showColor) {
                    $(this.closest('.list-group-item')).find('[name=catExpBox]').val('').trigger('change');
                    $(this.closest('.list-group-item')).find('[name=catExpBox]').prop('disabled', true);
                }
            }
        }
        if (checkboxNoFilter.is(':checked')) {
            checkboxNoFilter.prop('checked', false);
        }

        // Modify checkbox of ALL when all checkbox is checked
        // apply for card != filter condition
        if ($(`#${id} .${mainChkBoxClass}:not([name="thresholdBox"]):checked`).length === itemIds.length) {
            if (!this.closest('.filter-condition-card')) {
                $(`#${this.closest('.list-group').id} .checkbox-all`).prop('checked', true);
            }
        } else {
            $(`#${this.closest('.list-group').id} .checkbox-all`).prop('checked', false);
        }

        // check no filter when uncheck all items
        if ($(`#${id} .check-item:not([name="thresholdBox"]):not(:checked)`).length === itemIds.length) {
            $(`#${this.closest('.list-group').id} .checkbox-no-filter`).prop('checked', true);
        }

        // only allow selected 2 items in list
        if (isCheckLimit && limitedCheckedList.length > MAX_END_PROC) {
            limitedCheckedList[0].prop('checked', false);

            if (showColor) {
                $(limitedCheckedList[0].closest('.list-group-item')).find('[name=catExpBox]').prop('disabled', false);
                // remove data-sensor attr
                limitedCheckedList[0].removeAttr('data-sensor');
            }
            limitedCheckedList.shift();
        }

        // in case of either x or y data type is string, color variable will be changed belong with string sensor.
        if (showColor && limitedCheckedList.length > 0) {
            const xSensor = limitedCheckedList[0];
            const xSensorType = xSensor ? $(`#dataType-${xSensor.val()}`).val() : '';
            const ySensor = limitedCheckedList[1];
            const ySensorType = ySensor ? $(`#dataType-${ySensor.val()}`).val() : '';
            if (xSensor && xSensorType === DataTypes.STRING.short) {
                $(`#scp-color-${xSensor.val()}`).prop('checked', true);
            } else if (ySensor && ySensorType === DataTypes.STRING.short) {
                $(`#scp-color-${ySensor.val()}`).prop('checked', true);
            }

            // set x, y flag
            limitedCheckedList[0] && limitedCheckedList[0].attr('data-sensor', 'x');
            limitedCheckedList[1] && limitedCheckedList[1].attr('data-sensor', 'y');

            compareSettingChange();
        }
    });


    // remove check color radio button when click selected again
    $('.uncheck-when-click').on('click', (e) => {
        const currentEl = $(e.currentTarget).parent().find('input');
        const check = currentEl.prop('checked');
        if (check) {
            setTimeout(() => {
                currentEl.prop('checked', false).trigger('change');
            }, 100);
        }
    });

    handleSearchItems(id);

    // objectiveVar only choose one
    $(`#${parentId} input:checkbox[name=objectiveVar]`).on('change', function () {
        // in the handler, 'this' refers to the box clicked on
        const $box = $(this);
        if ($box.is(':checked')) {
            // the name of the box is retrieved using the .attr() method
            // as it is assumed and expected to be immutable
            const group = `input:checkbox[name='${$box.attr('name')}']`;
            // the checked state of the group/box on the other hand will change
            // and the current value is retrieved using .prop() method
            $(group).prop('checked', false);
            $box.prop('checked', true);
        } else {
            $box.prop('checked', false);
        }
    });

    addAttributeToElement();
    if (parentId.includes('cond-proc-others')) {
        // in case of other filters, use another box id
        inputCheckInlineEvents(id);
    } else {
        inputCheckInlineEvents(parentId);
    }
    onchangeRequiredInput();
    objectiveInputEventHandle();
};

// Render search with set and reset button
const searchItems = (id) => {
    const htmlSource = `
        <div class="d-flex">
            <input class="form-control" id="search-${id}" placeholder="${i18nCommon.search}..">
            <button type="button" id="setBtnSearch-${id}" class="btn simple-btn btn-setting">Set</button>
            <button type="button" id="resetBtnSearch-${id}" class="btn simple-btn btn-setting">Reset</button>
        </div>`;

    return htmlSource;
};

const handleSearchItems = (id) => {
    initCommonSearchInput($(`#search-${id}`), 'flex-grow-1');
    const parent = $(`#search-${id}`).closest('.form-group');
    const currentParentDivId = parent.length > 0 ? parent[0].id : null;
    if (!currentParentDivId) return;

    const originalCheckBoxs = $(`#${currentParentDivId} li`);
    let selectedEls = originalCheckBoxs;
    const sensorListID = `#list-${id}`;

    // multi select search with input immediately
    $(`#search-${id}`).off('keyup input');
    $(`#search-${id}`).on('keyup input', (event) => {
        const searchEle = event.currentTarget;
        let value = stringNormalization(searchEle.value.toLowerCase());
        // event.target.value = value;

        value = makeRegexForSearchCondition(value);

        const regex = new RegExp(value, 'i');

        selectedEls = $(`#${searchEle.closest('.form-group').id} li .search-col`).filter(function () {
            const val = $(this).text().toLowerCase();

            $(this).show();
            if (!regex.test(val)) {
                $(this).addClass('gray');
            } else {
                $(this).removeClass('gray');
            }

            return regex.test(val);
        });


        if (event.keyCode === 13) {
            $(`#${searchEle.closest('.form-group').id} li`).filter(function f() {
                $(this).toggle(regex.test($(this).find('.search-col').text().toLowerCase()));
            });
        }
    });

    // handle on click set selected items button
    $(`#setBtnSearch-${id}`).on('click', function () {
        selectedEls.find('input[type=checkbox]').prop('checked', true).trigger('change');
        sortCheckItems();
    });

    // handle on click reset selected items button
    $(`#resetBtnSearch-${id}`).on('click', function () {
        selectedEls.find('input[type=checkbox]').prop('checked', false).trigger('change');
        sortCheckItems();
    });

    const sortCheckItems = () => {
        const isChanged = sortHtmlElements($(sensorListID));
        if (isChanged) {
            $(sensorListID).scrollTop(0);
        }
    };
};

const showSensorAsFloatingList = (sensorListId) => {
    let timerOpen;
    const dropDown = $(`#${sensorListId}`);
    const arrow = $(`.expand-arrow .arrow.${sensorListId}`);
    let isExpand = false;
    arrow.click(() => {
        const parent = dropDown.parent();
        const parentHeight = parent.height(); // get height in fist time load list
        const that = dropDown[0];
        const dropDownFullHeight = that.scrollHeight;
        timerOpen = setTimeout(() => {
            $(that).addClass('floating-dropdown');
            $(that).addClass('disable-max-height');

            // find max width of column
            const dropDownWidthMin = $(window).width() - $(that).offset().left - 40;
            const colWidths = $(that).find('li label').map((i, item) => $(item).width());
            const maxWidth = (Math.max(...colWidths)) * 2 + 380 || 0;
            const selectBoxWidth = $(that).parent().width();
            const dropDownWidth = maxWidth > selectBoxWidth ? maxWidth : selectBoxWidth;
            const dropDownHeight = dropDownFullHeight + 2;
            const leftHeightFromCurrentPosition = $(window).height() - $(that).get(0).getBoundingClientRect().top - 12;
            const windowWidth = $(window).width() - 100;

            if (dropDownWidth > dropDownWidthMin) {
                $(that).css({ transform: `translateX(-${dropDownWidth - dropDownWidthMin}px)` });
            }
            $(that).css({ width: `${dropDownWidth}px` });
            $(that).css({ maxWidth: `${windowWidth}px` });
            if (dropDownHeight > leftHeightFromCurrentPosition) {
                $(that).css({ height: `${leftHeightFromCurrentPosition}px` });
            } else {
                $(that).css({ height: `${dropDownHeight}px` });
            }

            parent.css({ height: `${parentHeight + 15}px` });
            isExpand = true;
        }, 50);
    });
    // dropDown.mouseleave(e => sortHtmlElements(e.target));
    dropDown.closest('.floating-dropdown-parent.expand-arrow').off('mouseleave');
    dropDown.closest('.floating-dropdown-parent.expand-arrow').on('mouseleave', (e) => {
        if (!isExpand) {
            // move selected options to top
            const isChanged = sortHtmlElements(dropDown);
            if (isChanged) {
                $(dropDown).scrollTop(0);
            }

            return;
        }

        timerOpen = setTimeout(() => {
            collapseFloatingList(dropDown);
            isExpand = false;
        }, 2000);
    });

    dropDown.mouseout(() => {
        clearTimeout(timerOpen);
    });

    const checkAndCollapseFloatingList = (e) => {
        const clickedInList = $(e.target).closest('.floating-dropdown-parent').length;
        if (!clickedInList) {
            collapseFloatingLists();
            clearTimeout(timerOpen);
        }
    };

    // click to collapse floating dropdown
    $(document).on('click', checkAndCollapseFloatingList);
};


const updateSelectedItems = (isCategoryItem = false, selectParent = $(formElements.endProcSelectedItem)) => {
    let selectedItems = [];
    let allSelected;
    if (isCategoryItem) {
        selectedItems = getSelectedItems(isCategoryItem);
        allSelected = $(formElements.endProcCateSelectedItem).get();
    } else {
        selectedItems = getSelectedItems(false, selectParent);
        allSelected = selectParent.get();
    }

    Array.prototype.forEach.call(allSelected, (selected) => {
        $(selected).find('option').removeAttr('disabled');
        const currentCardSelector = $(selected).val();
        if ($(selected).attr('name') !== 'catExpBox') {
            $.each($(selected).find('option'), (key, option) => {
                const optionVal = $(option).val();
                if (selectedItems.includes(optionVal) && currentCardSelector !== optionVal) {
                    $(option).attr('disabled', 'disabled');
                } else if (!selectedItems.includes(optionVal)) {
                    $(option).removeAttr('disabled');
                }
            });
        }
    });
};

const cardRemovalByClick = (parentId = '', callbackFunc = null, dicParams = null) => {
    $(`${parentId} .close-icon`).last().on('click', (e) => {
        const card = $(e.currentTarget).closest('.card');
        if (!card.parent().parent().length) return;
        const cardId = `${card.parent().parent().get(0).id}`;

        if (cardId.endsWith('end-proc-row')) {
            if (card && card.parent().parent().find('.card').length > 1) {
                card.fadeOut();
                setTimeout(() => {
                    card.parent().remove();
                    updateSelectedItems();
                }, 100);
            }
        } else if (cardId.endsWith('end-proc-cate-row') || cardId.endsWith('category-cond-proc-row')) {
            if (card && card.parent().parent().find('.card').length > 1) {
                card.fadeOut();
                setTimeout(() => {
                    card.parent().remove();
                    updateSelectedItems(isCategoryItem = true);
                }, 100);
            }
        } else if (card && (cardId.endsWith('cond-proc-row')
            || cardId.startsWith('end-proc-paracords'))) {
            if (card && card.parent().parent().find('.card').length > 0) {
                card.fadeOut();
                setTimeout(() => {
                    card.parent().remove();
                }, 100);
            }
        }
        if (callbackFunc) {
            setTimeout(() => {
                if (dicParams) {
                    callbackFunc(dicParams);
                } else {
                    callbackFunc();
                }
            }, 200);
        }

        setProcessID();
    });
};

// get filter by type
const getFilterByTypes = (process, filterType) => {
    const procFilters = process.getFiltersByType(filterType);
    const filterIDs = [];
    const filterVals = [];
    if (filterType !== filterTypes.OTHER) {
        procFilters.forEach((filter) => {
            filter.filter_details.forEach((filterItem) => {
                filterIDs.push(filterItem.id);
                filterVals.push(filterItem.name);
            });
        });
        return [filterIDs, filterVals];
    }
    return procFilters.map(filter => ({
        id: filter.id,
        title: filter.name,
        name: filter.name,
        ids: filter.filter_details.map(fd => fd.id),
        vals: filter.filter_details.map(fd => fd.name),
    }));
};

// Condition Line change event
const condLineOnChange = async (selectedLines, count, prefix = '', parentFormId = '') => {
    const selectedProc = $(`#${prefix}cond-proc-process-${count}`).val();
    if (selectedLines.length === 0) {
        $(`#${prefix}cond-proc-machine-div-${count}`).css('display', 'none');
        $(`#${prefix}cond-proc-machine-${count}`).remove();
    } else {
        $(`#${prefix}cond-proc-machine-div-${count}`).css('display', 'block');

        const procInfo = procConfigs[selectedProc];

        const machineIds = [];
        const machineVals = [];
        const checkedIds = [];
        const parentId = `${prefix}cond-proc-machine-div-${count}`;

        if (!isEmpty(procInfo)) {
            await procInfo.updateFilters();
            const machineFilter = procInfo.getOneFilterByType(filterTypes.MACHINE);
            if (machineFilter) {
                const filterDetails = machineFilter.filter_details || [];
                if (selectedLines.includes(filterOptions.ALL.toLowerCase()) || selectedLines.includes(formElements.NO_FILTER.toLowerCase())) {
                    filterDetails.forEach((filterDetail) => {
                        machineIds.push(filterDetail.id);
                        machineVals.push(filterDetail.name);
                    });
                } else {
                    filterDetails.forEach((filterDetail) => {
                        selectedLines.forEach((line, i) => {
                            if (`${line}` === `${filterDetail.parent_detail_id}`) {
                                machineIds.push(filterDetail.id);
                                machineVals.push(filterDetail.name);
                            }
                        });
                    });
                }
            }
        }

        // remove old elements
        $(`#${prefix}cond-proc-machine-${count}`).remove();

        // load machine multi checkbox to Condition Proc.
        if (machineIds) {
            const machineLabel = i18nCommon.mach || '';
            const thresholdBoxes = [];
            machineIds.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));
            addGroupListCheckboxWithSearch(`${parentId}`, `${prefix}cond-proc-machine-${count}`,
                machineLabel, machineIds, machineVals, checkedIds, `machine_id_multi${count}`,
                true, null, thresholdBoxes);
        }
    }
};

// add condition Process children components ( line, machine , partno)
const condProcOnChange = async (count, prefix = '', parentFormId = '') => {
    // remove old elements
    // TODO: make re-use function
    $(`#${prefix}cond-proc-line-${count}`).remove();
    $(`#${prefix}cond-proc-machine-${count}`).remove();
    $(`#${prefix}cond-proc-partno-${count}`).remove();
    $(`#${prefix}cond-proc-others-div-${count}`).empty();

    // selected process
    const selectedProc = $(`#${prefix}cond-proc-process-${count}`).val();
    if (isEmpty(selectedProc)) {
        return;
    }

    const procInfo = procConfigs[selectedProc];

    // update proc filters
    await procInfo.updateFilters();

    const [lineIds, lineVals] = getFilterByTypes(procInfo, filterTypes.LINE);

    // clear old elements from filter box
    $(`#${prefix}cond-proc-others-div-${count}`).html('');

    const condProcMachineLineId = `${prefix}cond-proc-line-${count}`;

    if (lineIds) {
        const thresholdBoxes = [];
        lineIds.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));
        addGroupListCheckboxWithSearch(`${prefix}cond-proc-line-div-${count}`, condProcMachineLineId, i18nCommon.line, lineIds, lineVals, null, `filter-line-machine-id${count}`, true, null, thresholdBoxes);

        const lineInputs = $(document.getElementsByName(`filter-line-machine-id${count}`));
        let selectedLines = [];
        lineInputs.change(() => {
            selectedLines = [];
            for (let i = 0; i < lineInputs.length; i++) {
                if (lineInputs[i].checked) selectedLines.push(lineInputs[i].value.toLowerCase());
            }
            condLineOnChange(selectedLines, count, prefix);
        });

        // default show all machine
        condLineOnChange(['all'], count, prefix);
    }

    const [partnoIds, partnoVals] = getFilterByTypes(procInfo, filterTypes.PART_NO);
    let parentId = `${prefix}cond-proc-partno-div-${count}`;

    if (partnoIds) {
        const thresholdBoxes = [];
        partnoIds.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));

        // load partno multi checkbox to Condition Proc.
        addGroupListCheckboxWithSearch(parentId,
            `${prefix}cond-proc-partno-${count}`,
            i18n.partNo, partnoIds, partnoVals,
            null, `filter-partno${count}`, true, null, thresholdBoxes);
    }


    const filterOthers = getFilterByTypes(procInfo, filterTypes.OTHER);
    parentId = `${prefix}cond-proc-others-div-${count}`;
    if (filterOthers.length) {
        filterOthers.forEach((filter, k) => {
            if (filter.title) {
                const thresholdBoxes = [];
                filter.ids.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));
                addGroupListCheckboxWithSearch(parentId,
                    `${prefix}cond-proc-filterother-${filter.id}-${count}`,
                    filter.title, filter.ids, filter.vals,
                    null,
                    `filter-other-${filter.id}-${count}`,
                    true, null, thresholdBoxes);
            }
        });
    }
    compareSettingChange();
    bindFilterChangeEvents(selectedProc);
    // clearNoLinkDataSelection();
};

// add condition proc
const addCondProc = (procIds, procVals, prefix = '', parentFormId = '', dataGenBtn = 'btn-add-cond-proc') => {
    let count = 1;
    const innerFunc = () => {
        const itemList = [];
        for (let i = 0; i < procIds.length; i++) {
            const itemId = procIds[i];
            const itemVal = procVals[i].name;
            const itemEnVal = procVals[i].en_name;
            itemList.push(`<option value="${itemId}" title="${itemEnVal}">${itemVal}</option>`);
        }

        while (checkExistDataGenBtn(dataGenBtn, count, parentFormId)) {
            count = countUp(count);
        }

        const proc = `<div class="col-12 col-xl-6 col-lg-12 col-md-12 col-sm-12 p-1">
                    <div class="card cond-proc table-bordered py-sm-3 filter-condition-card">
                        <span class="pull-right clickable close-icon" data-effect="fadeOut">
                            <i class="fa fa-times"></i>
                        </span>
                        <div class="d-flex align-items-center" id="${prefix}cond-proc-process-div-${count}">
                            <span class="mr-2">${i18nCommon.process}</span>
                            <div class="w-auto flex-grow-1">
                                <select name="cond_proc${count}" class="form-control select2-selection--single select-n-columns" id="${prefix}cond-proc-process-${count}"
                                    data-gen-btn="${dataGenBtn}" onchange=condProcOnChange(${count},'${prefix}','${parentFormId}')>
                                    ${itemList.join(' ')}
                                </select>
                            </div>
                        </div>
                        <div class="proc-line" id="${prefix}cond-proc-line-div-${count}">
                        </div>
                        <div id="${prefix}cond-proc-machine-div-${count}" style="display: none;">
                        </div>
                        <div id="${prefix}cond-proc-partno-div-${count}">
                        </div>
                        <div id="${prefix}cond-proc-others-div-${count}">
                        </div>
                     </div>
                   </div>`;
        $(`#${prefix}cond-proc-row div`).last().before(proc);
        bindFilterRemoveEvents(`#${prefix}cond-proc-row div`);
        cardRemovalByClick(`#${prefix}cond-proc-row div`, bindRemoveFilterCondByCards);
        addAttributeToElement();
    };
    return innerFunc;
};


const onChangeForDateTimeGroup = (parentEle = null) => {
    const targetClass = '.datetime-group-with-radio-btn';
    let targetEle;
    if (parentEle) {
        targetEle = $(parentEle).find(targetClass);
    } else {
        targetEle = $(targetClass);
    }

    targetEle.each((i, e) => {
        $(e).find('input,select').not('input:radio').on('change', (event) => {
            const ele = event.currentTarget;
            $(ele).parents('.datetime-group-with-radio-btn').find('input:radio').prop('checked', true);
        });
    });
};

const genTotalAndNonLinkedHTML = (summaryOption, generalInfo) => {
    const linkedTotal = summaryOption.ntotal - summaryOption.countUnlinked;
    const nTotalHTML = isEmpty(summaryOption.ntotal) ? '-' : `${applySignificantDigit(linkedTotal)} (${applySignificantDigit(summaryOption.linkedPct)}%)`;

    let noLinkedHTML = '';
    if (`${generalInfo.endProcName}` !== `${generalInfo.startProc}`) {
        noLinkedHTML = `<tr>
            <td><span class="hint-text" title="${i18nCommon.hoverNoLinked}">P<sub>NoLinked</sub></span></td>
            <td>${applySignificantDigit(summaryOption.countUnlinked)} (${applySignificantDigit(summaryOption.noLinkedPct)}%)</td>
        </tr>`;
    }
    return [nTotalHTML, noLinkedHTML];
};

const changeFacetLevel = (e) => {
    let currentLevelSet = $(e).val();
    if (currentLevelSet === null) {
        currentLevelSet = '';
        $(e).val('');
    }
    const currentSelectedID = $(e).attr('id');
    const formID = $(e).closest('form').attr('id');
    const currentTabID = '';
    // if (formID.endsWith('CategoricalPlotForm')) {
    //     [currentTabID] = $(e).closest('form').attr('id').split('CategoricalPlotForm');
    //     currentTabID += '-';
    // } else if (formID.endsWith('categoricalPlotForm')) {
    //     // stp
    //     currentTabID = 'var-';
    // } else if (formID.startsWith('RLPForm')) {
    //     // rlp
    //     currentTabID = 'category-';
    // }
    const findSameLevelSet = $(`#${currentTabID}end-proc-row select[name=catExpBox][id!=${currentSelectedID}]`);
    if (currentLevelSet === facetLevels.LV_1) {
        $(findSameLevelSet).each((_, sel) => {
            if ($(sel).val() === facetLevels.LV_1) {
                // find level 2
                const level2Selected = findSameLevelSet.find(`option:selected[value=${facetLevels.LV_2}]`);
                if (level2Selected.length) {
                    $(sel).val(facetLevels.UNSET);
                } else {
                    $(sel).val(facetLevels.LV_2);
                }
            }
        });
    } else if (currentLevelSet === facetLevels.LV_2) {
        $(findSameLevelSet).each((_, sel) => {
            if ($(sel).val() === facetLevels.LV_2) {
                // find level 1
                const level1Selected = findSameLevelSet.find(`option:selected[value=${facetLevels.LV_1}]`);
                if (level1Selected.length) {
                    $(sel).val(facetLevels.UNSET);
                } else {
                    $(sel).val(facetLevels.LV_1);
                }
            }
        });
    } else if (currentLevelSet === facetLevels.DIV) {
        $(findSameLevelSet).each((_, sel) => {
            if ($(sel).val() === facetLevels.DIV) {
                $(sel).val(facetLevels.UNSET);
            }
        });
    }

    // uncheck target variable for STP
    if (formID.endsWith('categoricalPlotForm')) {
        const targetVarDOM = $(e).closest('.row').find('input[name^=GET02_VALS_SELECT]');
        const targetVarSelected = targetVarDOM.is(':checked');
        if (currentLevelSet && targetVarSelected) {
            targetVarDOM.prop('checked', false);
        }
    }
    compareSettingChange();
    bindFacetChangeEvents();
    updateStyleButtonByCheckingValid();
};


const dateTimeRangePickerHTML = (dtName, dtId, prefix, isSetDefaultValue = 'False', props = '') => (
    `<input id="${dtId}" name="${dtName}" type="text" class="datetimepicker form-control to-update-time-range"
                is-show-time-picker="True" is-set-default-value="${isSetDefaultValue}" ${props}
                is-show-recent-dates="True" autocomplete="off">
    <input id="${prefix}startDate" class="datepicker hasdatepicker form-control category-plot-time"
                data-date-format="yyyy-mm-dd" name="START_DATE" type="text" hidden>
    <input name="START_TIME" class="form-control" id="${prefix}startTime" type="text" hidden>
    <input id="${prefix}endDate" class="datepicker hasdatepicker form-control category-plot-time"
                data-date-format="yyyy-mm-dd" name="END_DATE" type="text" hidden>
    <input name="END_TIME" class="form-control" id="${prefix}endTime" type="text" hidden>`
);

/**
 *
 * @param parentID
 * @description Resize select2 max height to bottom
 */
const resizeListOptionSelect2 = (select2El) => {
    select2El.off('select2:open');
    select2El.on('select2:open', (e) => {
        const selects = $('.select2-container.select2-container--default.select2-container--open');
        const targetSelect = $(selects[selects.length - 1]);
        const top = targetSelect.css('top');
        const left = targetSelect.css('left');
        const ul = targetSelect.find('.select2-results__options');
        const selectDropdown = $('.select2-dropdown');
        selectDropdown.css({
            maxWidth: `calc(100vw - ${left} - 38px)`,
        });
        ul.css({
            maxHeight: `calc(100vh - ${top} + ${window.scrollY - 48}px)`,
        });
    });
};

const resetSummaryOption = (name) => {
    $(`input[name=${name}][value='none']`).prop('checked', true).trigger('change');
    $(`input[name=${name}]`).removeAttr('data-checked');
};

const checkSummaryOption = (name) => {
    $(`input[name=${name}]:checked`).prop('checked', false).prop('checked', true).trigger('change');
};

const buildSummaryChartTitle = (catExpValue, catExpBoxCols, facetName, isShowDate, timeCond, isShowFilterModal = false) => {
    const facets = checkTrue(catExpValue) ? catExpValue.toString().split(' | ') : [];
    const hasFacet = catExpBoxCols.length > 0 && facetName.length > 0 && facets.length > 0; // fpp co NA
    const hasLevel2 = hasFacet && facets.length === 2;
    const isShowTitle = hasFacet || isShowDate;
    const hasLevel12OnRightBox = isShowDate && hasLevel2;

    const startLocalDt = moment.utc(timeCond.start_dt).local();
    const endLocalDt = moment.utc(timeCond.end_dt).local();
    const startDate = startLocalDt.format(DATE_FORMAT);
    const startTime = startLocalDt.format(TIME_FORMAT);
    const endDate = endLocalDt.format(DATE_FORMAT);
    const endTime = endLocalDt.format(TIME_FORMAT);

    const showFitlerClass = isShowFilterModal ? 'show-detail cat-exp-box' : '';
    
    const timeText = `<span title="${startDate} ${startTime} - ${endDate} ${endTime}">
        ${startDate} ${startTime} -<br>${endDate} ${endTime}
    </span>`;
    const facetLevel1Text = hasFacet ? `<span class="${hasLevel12OnRightBox ? 'mr-2' : ''}">
        <span title="${facetName[0]}">${facetName[0]}</span>
        <span class="${showFitlerClass}"  title="${facets[0]}">${facets[0]}</span>
    </span>` : '';
    const facetLevel2Text = hasLevel2 ? `<span>
        <span title="${facetName[1]}">${facetName[1]}</span>
        <span class="${showFitlerClass}" title="${facets[1]}">${facets[1]}</span>
    </span>` : '';
    const isShowBoxRight = isShowDate && hasFacet || !isShowDate && hasLevel2;

    let rightBoxDOM = '';
    if (isShowBoxRight) {
        rightBoxDOM = `<div class="summary-card-title-content content-r ${hasLevel12OnRightBox ? 'd-flex' : ''}">
              ${isShowDate ? facetLevel1Text + facetLevel2Text : facetLevel2Text}
         </div>`;
    }
    const cardTitle = `
         <div class="summary-card-title">
              <div class="summary-card-title-content content-l">
                     ${isShowDate ? timeText : facetLevel1Text}
              </div>
              ${rightBoxDOM}
         </div>`;

    return isShowTitle ? cardTitle : '';
};

const getColorFromScale = (pointValue, maxCorr = 1) => {
    // CHM blue colorscale
    // 0.0: HSV 210°, 68%, 30%
    // 1.0: HSV 210°, 68%, 100%
    // from 0 to maxCorr
    // max = 0.5 -> 1
    // min = 0 -> 0

    const offsetPer = maxCorr ? (1 / maxCorr) : 1;
    const vValue = 0.3 + ((pointValue * offsetPer) * 0.7);
    if (Number.isNaN(vValue)) return null;

    const color = hsv2rgb({
        h: 210,
        s: 0.68,
        v: vValue,
    });
    return color;
};

const getAllGroupOfSensor = (sensorData) => {
    const ranks = {};
    let rankIDs = [];
    sensorData.forEach((sensorDat, i) => {
        if (sensorDat.before_rank_values && sensorDat.before_rank_values.length) {
            if (sensorDat.before_rank_values[0].length
                && sensorDat.before_rank_values[1].length) {
                sensorDat.before_rank_values[0].forEach((rank, k) => {
                    if (!rankIDs.includes(rank)) {
                        ranks[rank] = sensorDat.before_rank_values[1][k];
                        rankIDs.push(rank);
                    }
                });
            }
        }
    });
    const rankValues = [];
    rankIDs = rankIDs.sort().reverse();
    rankIDs.forEach((r) => {
        rankValues.push(ranks[r]);
    });
    return {
        id: rankIDs,
        value: rankValues,
    };
};
const genFullCategoryData = (categoryIds, stepChartDat, allGroupNames) => {
    // allGroupNames: {id: [3,2,1], value: ["C", "B", "A"]}
    // categoryIds: [3,1]
    // stepChartDat: [19, 3]
    // output: [19, 0, 3]
    if (!categoryIds.length) return [];
    return allGroupNames.id.map((group) => {
        let countVal = null;
        if (categoryIds.includes(group)) {
            const idx = categoryIds.indexOf(group);
            countVal = stepChartDat[idx];
        }
        return countVal;
    });
};

