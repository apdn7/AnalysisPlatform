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
        agPColorExplanation: $('#i18nAgPColorExplanation').text(),
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

const endProcSortable = () => {
    $('.grouplist-checkbox-with-search').sortable({
        update: function (event, ui) {
            const targetItem = $(ui.item);
            const isChecked = targetItem.find('input[name^=GET02_VALS_SELECT]').prop('checked');
            if (!isChecked) return;
            // add order number
            targetItem.parent().find('input[name^=GET02_VALS_SELECT]').removeAttr('order');
            const checked = targetItem.parent().find('input[name^=GET02_VALS_SELECT]:checked');
            checked.each((i, el) => {
                $(el).attr('order', i);
            })
        }
    });
};
const objectiveInputEventHandle = () => {
    $('input[name="objectiveVar"]').on('change', (e) => {
        const isChecked = e.currentTarget.checked;
        const parentRow = $(e.target).closest('li.list-group-item.form-check');
        isChecked && parentRow.find('input[type=checkbox][name^=GET02_VALS_SELECT]').prop('checked', true);
    });
};

const inputCheckInlineEvents = (parentId) => {
    $(`#${parentId} li.list-group-item`).on('click', (e) => {
        const firstInputIsChecked = $(e.currentTarget).find('input:eq(0)')[0].checked;
        const childInputElems = $(e.target).find('input');

        const isLabelInput = $(e.target).closest(".fit-item").find("input[type=checkbox]").hasClass("checkbox-all-labels");
        if (isLabelInput) {
            return;
        }
        if ($(e.target).is('select') || $(e.target).hasClass('select2-selection__rendered')) {
            return;
        }

        const [childInput] = childInputElems.length ? childInputElems : $(e.target).parent().find('input');
        // check if this input is CL
        const isSecondaryCheckbox = ['thresholdBox', 'catExpBox', 'objectiveVar', 'colorVar'].includes(childInput.name)
            || childInput.name.includes('GET02_CATE_SELECT');

        if (isSecondaryCheckbox) {
            $(e.target).find('input:visible').each((idx, item) => {
                let inputStatus = true;
                if (item.type === 'checkbox' || item.name == 'colorVar') {
                    inputStatus = !childInput.checked;
                }
                $(item).prop('checked', inputStatus).trigger('change');
            });
            return;
        }
        if (childInputElems.length || !isSecondaryCheckbox) {
            // if (childInputElems.length) {
            $(e.currentTarget).find('input:visible').each((idx, item) => {
                if ($(item).hasClass('checkbox-all-labels')) {
                    return;
                }
                // fpp label column
                if ($(item).attr('data-autoselect') === 'false' || $(item).prop('disabled')) {
                    return;
                }
                if (item.type === 'radio' && !['colorVar', 'judgeVar'].includes(item.name)) {
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

const genColDOM = (isShow, label, description, textCenter = false, withCheckBox = false, id = '', className = '') => {
    // todo: check nofilter option
    const filterClasses = (id !== '') ?
        'col custom-control custom-checkbox fit-item text-center pr-1 d-flex ' :
        'col px-1 fit-item title-col';
    if (isShow) {
        if (withCheckBox) {
            return `<div class="${filterClasses} ${className}">
                <input type="checkbox" class="custom-control-input checkbox-all-labels" id="checkbox-all-label${id}">
                    <label class="custom-control-label checkbox-all-label" for="checkbox-all-label${id}">
                        <h6 title="${description}" class="${textCenter ? 'text-center' : ''}" style="text-decoration: underline">${label}</h6>
                    </label>
            </div>`;
        }
        return `<div class="${filterClasses} ${className}">
            <h6 title="${description}" class="${textCenter ? 'text-center' : ''}" style="text-decoration: underline">${label}</h6>
        </div>`;
    }
    return '';
};

let limitedCheckedList = [];

const addGroupListCheckboxWithSearch = (parentId, id, label, itemIds, itemVals, props) => {
    const mainChkBoxClass = 'main-checkbox';
    const indexDic = {
        dataType: 2,
        label: 3,
        color: 4,
        catExp: 5,
        objective: 6,
        judge: 7,
        filter: 8,
    };
    const isShowColorCheckBox = props ? (props.showColor && !props.colorAsDropdown) : false;
    const genDetailItem = (isHeader = false, chkBox, shownName = null, thresholdBox = null,
        dataType = null, colDataTypeShowName = null, catExpBox = null, isGetDate = false,
        objectiveSelectionDOM = null, categoryLabelDOM = null, colorDOM = null, judgeDOM = null) => {
        if (!chkBox) {
            return '';
        }
        const checkboxClass = 'custom-control custom-checkbox';
        const radioClass = 'custom-control custom-radio';
        const masterNameClass = 'column-master-name';
        let commonClass = checkboxClass;
        if (props.isRadio) {
            commonClass = radioClass;
        }

        const col = thresholdBox ? '10' : '12';


        const rowClass = [props.showLabel, props.showColor, props.showCatExp, props.showObjectiveInput, props.judge].filter(col => col).length > 1 ? '' : 'less-col';

        let html = `<div class="col-md-${col} search-col col-xs-${col} ${commonClass}">
                   ${chkBox}
                 </div>`;

        if (isHeader) {
            html = chkBox;
        }

        if (shownName) {
            const isStrCol = dataType === DataTypes.STRING.name ? ' is-string-col' : '';
            const originalTotalCol = [chkBox, shownName, props.itemDataTypes, props.showLabel, props.showColor, props.showCatExp, props.showObjectiveInput, props.judge, props.showFilter];
            html = `
                <div class="col-sm-4 col-xs-4 show-name-col ${commonClass} shorten-name pr-1 search-col${isStrCol}" title="${shownName}">
                    ${chkBox}
                </div>
                <div class="col-sm-4 col-xs-4 show-name-col ${masterNameClass} shorten-name pr-1 search-col" title="${shownName}">
                    ${dataType === DataTypes.DATETIME.name ? (isGetDate ? '' : shownName) : shownName}
                </div>
            `;
            for (let i = 2; i < originalTotalCol.length; i++) {
                if (originalTotalCol[i]) {
                    if (i === indexDic.dataType) {
                        // data type;
                        const title = $(`#${DataTypes[dataType].exp}`).text();
                        const hiddenValue = DataTypes[dataType].short === DataTypes.DATETIME.short ? DataTypes.STRING.short : DataTypes[dataType].short;
                        const hiddenDataTypeInput = `<input id="dataType-${$(chkBox).val()}" value="${hiddenValue}" hidden disabled>`;
                        html += `<div class="col data-type fit-item type-item px-1 search-col" title="${title}">
                                      ${colDataTypeShowName}${hiddenDataTypeInput}
                                 </div>`;
                    }
                    if (i === indexDic.label || i === indexDic.filter) {
                        // label or Filter
                        html += `<div class="col ${checkboxClass} fit-item text-center small-col pr-1 d-flex pl-5" title="${props.showFilter ? 'Filter' : 'Label'}">
                                    ${categoryLabelDOM || ''}
                                 </div>`;
                    }
                    if (i === indexDic.color) {
                        // color
                        html += `
                            <div class="col fit-item text-center px-1 flex-row-center" title="">
                                  ${colorDOM}
                             </div>
                        `;
                    }
                    if (i === indexDic.catExp) {
                        // cat exp box
                        const title = 'Cat Expansion'; // TODO: i18n
                        html += `<div class="col-sm-2 col-xs-2 ${checkboxClass} fit-item px-1 flex-row-center" title="${title}">
                                    ${catExpBox}
                                 </div>`;
                    }
                    if (i === indexDic.objective) {
                        // objective
                        html += `<div class="col-sm-2 col-xs-2 fit-item objective-item">
                                    <div class="custom-control custom-radio">${objectiveSelectionDOM}</div>
                                </div>`;
                    }

                    if (i === indexDic.judge) {
                        // objective
                        html += `<div class="col-sm-2 col-xs-2 fit-item">
                                    ${judgeDOM}
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

        const headerClass = isHeader ? 'keep-header' : '';

        const output = `<li class="list-group-item form-check ${headerClass}">
                            <div class="row ${rowClass}" style="padding-left: 5px">
                               ${html}
                            </div>
                        </li> `;

        return output;
    };

    if (itemIds == null) {
        return;
    }
    let inputType = 'checkbox';
    if (props.isRadio) {
        inputType = 'radio';
    }

    const i18nHoverText = {
        threshold: $('#i18nSetThreshold').text(),
        sensorExp: $('#i18nSensorTypeExplain').text(),
        catExp: $('#i18nCatExpExplain').text(),
        catExpLabel: $('#i18nCatExp').text(),
        objectiveLabel: $('#i18nObjective').text(),
        objectiveExpl: props.objectiveHoverMsg || $('#i18nObjectiveExplain').text(),
        labelExplain: $('#i18nLabelVariableDescription').text(),
        filterLabelExplain: $('#i18nFilterLabelExplain').text(),
        judgeHoverMsg: $('#i18nJudgeHoverMsg').text(),
        judgeLabel: $('#i18nJudgeLabel').text() || 'Judge',
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
        if (props.itemNames) {
            itemName = props.itemNames[i];
        }
        const chkBoxId = `${inputType}-${itemId + parentId}`;
        let thresholdChkBoxId = null;
        if (props.thresholdBoxes) {
            threshold = props.thresholdBoxes[i];
            if (threshold) {
                thresholdChkBoxId = `threshold-${chkBoxId}`;
                threshold = `<input title="${i18nHoverText.threshold}" type="checkbox" name="thresholdBox"
                            class="custom-control-input check-item" value="${itemId}" id="${thresholdChkBoxId}">
                            <label title="${i18nHoverText.threshold}" class="custom-control-label" for="${thresholdChkBoxId}"></label>`;
            }
        }

        // data types and cat expansion
        let colDataType = '';
        let colDataTypeShowName = '';
        let catExpBox = ''; // don't set null , it will show null on screen
        let catExpChkBoxId = null;
        if (props.itemDataTypes) {
            colDataType = DataTypes[props.itemDataTypes[i]].org_type;
            colDataTypeShowName = props.itemDataTypeShownNames[i];
            catExpChkBoxId = `catExp-${chkBoxId}`;
            if (props.showCatExp && [DataTypes.INTEGER.name, DataTypes.STRING.name, DataTypes.TEXT.name].includes(colDataType)) {
                catExpBox = `<select name="catExpBox" id="catExpItem-${itemId}" onchange="changeFacetLevel(this);"
                                data-load-level="2" class="form-control level-select">
                    <option value="">---</option>
                    <option value="1">Lv1</option>
                    <option value="2">Lv2</option>
                    ${props.hasDiv ? '<option value="3">Div</option>' : ''}
                </select>`;
            }
        }

        const isRequiredInput = props.isRequired ? 'required-input' : '';
        let objectiveSelectionDOM = '';
        const isCategoryVar = [DataTypes.DATETIME.name, DataTypes.STRING.name, DataTypes.TEXT.name].includes(colDataType);
        const showObjInput = !props.allowObjectiveForRealOnly || (props.allowObjectiveForRealOnly && !isCategoryVar) && !(props.disableSerialAsObjective && colDataTypeShowName === DataTypes.SERIAL.short);
        if (props.showObjectiveInput && showObjInput) {
            const objectiveChkBoxId = `objectiveVar-${itemId}`;
            const uncheckRadio = props.optionalObjective ? ' uncheck-when-click' : '';
            objectiveSelectionDOM = `<input title="" type="radio" name="objectiveVar" onchange="changeObjectiveVarEvent()"
                class="custom-control-input ${isRequiredInput}" value="${itemId}"
                id="${objectiveChkBoxId}" data-autoselect="false" 
                data-is-target="${props.shouldObjectiveIsTarget || false}">
                <label title="" class="custom-control-label${uncheckRadio}" for="${objectiveChkBoxId}"></label>`;
        }

        let categoryLabelDOM = null;
        if (props.showLabel || props.showFilter) {
            const clChkBoxId = `categoryLabel-${itemId}`;
            let clSelection = '';
            // todo: check category item
            if (props.catLabels && props.catLabels.length && props.catLabels.includes(itemId)) {
                clSelection = 'selected="selected"';
            }
            const categoryGroupId = props.groupIDx || 1;
            if ([DataTypes.INTEGER.name, DataTypes.STRING.name, DataTypes.TEXT.name].includes(colDataType)) {
                categoryLabelDOM = `<input title="" onchange="onChangeFilterCheckBox(this)" type="checkbox" name="GET02_CATE_SELECT${categoryGroupId}"
                    class="custom-control-input not-autocheck as-label-input" value="${itemId}"
                    id="${clChkBoxId}"${clSelection} data-autoselect="false">
                    <label title="" class="custom-control-label" for="${clChkBoxId}"></label>`;
            }
        }


        let colorDOM = null;
        if (props.showColor) {
            if (props.colorAsDropdown) {
                const dropdownColorId = `agp-color-${itemId}`;
                colorDOM = `<select name="colorVar" id="${dropdownColorId}" onchange="" 
                    data-load-level="2" class="form-control level-select select2-selection--single select-n-columns"
                    data-target-var-id="${itemId}">
                    <option value="">---</option>`;
                if (props.availableColorVars && props.availableColorVars.length) {
                    props.availableColorVars.forEach(col => {
                        colorDOM += `<option value="${col.id}" title="${col.name_en}">${col.shown_name}</option>`;
                    });
                }
                colorDOM += `</select>`;
            } else {
                const radioButtonColorId = `scp-color-${itemId}`;
                colorDOM = `<div class="custom-control custom-radio d-flex pl-0">
                                <input type="radio" name="colorVar" onchange="compareSettingChange()"
                                      class="custom-control-input" value="${itemId}"
                                      id="${radioButtonColorId}">
                                <label title="" class="custom-control-label uncheck-when-click single-check-box" for="${radioButtonColorId}"></label>
                            </div>`;
            }
        }

        let judgeDOM = null;
        if (props.judge) {
            const judgeId = `judge-var${itemId}`;
            judgeDOM = `<div class="custom-control custom-radio d-flex pl-0">
                                <input type="radio" name="judgeVar" data-type="${colDataType}" onchange="onchangeJudge(this)"
                                      class="custom-control-input" value="${itemId}"
                                      id="${judgeId}">
                                <label title="" class="custom-control-label uncheck-when-click single-check-box" for="${judgeId}"></label>
                            </div>`;
        }

        isChecked = (props.checkedIds && props.checkedIds.includes(itemId)) ? 'checked' : '';
        const isHideCheckInput = (props.hideStrVariable && colDataType === DataTypes.STRING.name) || (props.disableSerialAsObjective && colDataTypeShowName === DataTypes.SERIAL.short) || (props.hideRealVariable && [DataTypes.REAL.short, DataTypes.DATETIME.short].includes(colDataTypeShowName));
        const hideClass = isHideCheckInput ? ' hidden-input' : '';

        const inputEl = !isHideCheckInput ? `<input type="${inputType}" name="${props.name}" ${isShowColorCheckBox ? 'data-order=2' : ''}
            class="custom-control-input check-item ${mainChkBoxClass} ${isRequiredInput}"  value="${itemId}"
            id="${chkBoxId}" ${isChecked} data-proc-id="${props.procId || ''}" data-type-shown-name="${colDataTypeShowName}">` : '';

        const option = `
            ${inputEl}
           <label class="custom-control-label${hideClass}" for="" title="${itemVal}">${itemVal}</label>`;

        const isGetDate = (itemId === props.getDateColID);
        itemList.push(
            genDetailItem(false, option, itemName, threshold, colDataType, colDataTypeShowName, catExpBox,
                isGetDate, objectiveSelectionDOM, categoryLabelDOM, colorDOM, judgeDOM),
        );
    }

    const sensorListId = `list-${id}`;
    let noFilterOption = null;
    let allOption = null;
    const isShowThreshold = props.noFilter ? false : props.thresholdBoxes;

    const thresholdBoxDOM = genColDOM(isShowThreshold, 'CL', i18nHoverText.threshold);
    const typeColDOM = genColDOM(props.itemDataTypes, 'Type', i18nHoverText.sensorExp, false, false, '', 'type-item');
    const objColDOM = genColDOM(props.showObjectiveInput, i18nHoverText.objectiveLabel, i18nHoverText.objectiveExpl, false, false, '', 'objective-item');
    const judgeTitle = genColDOM(props.judge, i18nHoverText.judgeLabel, i18nHoverText.judgeHoverMsg);
    // change Title on On-demand filter
    $('#categoriesBoxTitle').text(!props.showFilter ? 'Label' : 'Filter');
    const categoryLabelColDOM = genColDOM(props.showLabel, 'Label', i18nHoverText.labelExplain, true, false, '', 'small-col');
    const filterColDOM = genColDOM(props.showFilter, 'Filter', i18nHoverText.filterLabelExplain, true, false, '', 'small-col');
    const catExpDOM = genColDOM(props.showCatExp, i18nHoverText.catExpLabel, i18nHoverText.catExp);
    const colorTile = genColDOM(props.showColor, 'Color', props.colorAsDropdown ? i18nCommon.agPColorExplanation : i18nCommon.colorExplanation, false);
    // const defaultColSize = '';
    if (!props.isRadio) {
        if (props.noFilter) {
            isChecked = (props.checkedIds && itemIds.some(e => props.checkedIds.includes(e))) ? '' : 'checked';
            noFilterOption = `
                <div class="col-sm-10 custom-control custom-checkbox shorten-name pr-1">
                    <input type="${inputType}" name="${props.name}"
                        class="custom-control-input checkbox-no-filter"
                        id="checkbox-no-filter-${id + parentId}"
                        value="NO_FILTER" ${isChecked}>
                    <label class="custom-control-label" for="checkbox-no-filter-${id + parentId}">
                        ${i18nCommon.noFilter}</label>
                </div>
                <div class="col-sm-1 pl-1"><h6 title="${i18nHoverText.threshold}"
                    style="text-decoration: underline; min-width: 35px">CL</h6></div>`;
        } else {
            isChecked = (props.checkedIds && !isEmpty(itemIds)
                && itemIds.every(e => props.checkedIds.includes(e))) ? 'checked' : '';
        }

        const requiredClass = props.isRequired ? 'required-input' : '';
        allOption = `
            <div class="col-sm-8 col-xs-8 show-name-col-header pr-1 custom-control custom-checkbox shorten-name">
                 <input type="${inputType}" name="${props.name}"
                    class="custom-control-input checkbox-all ${requiredClass}"
                     id="checkbox-all-${id + parentId}" value="All" ${!props.noFilter && isChecked} ${isShowColorCheckBox ? 'hidden disabled' : ''}>
                <label class="custom-control-label ${isShowColorCheckBox ? 'd-none' : ''}"
                    for="checkbox-all-${id + parentId}">${i18nCommon.allSelection}</label>
            </div>
            ${typeColDOM}
            ${thresholdBoxDOM}
            ${categoryLabelColDOM}
            ${colorTile}
            ${catExpDOM}
            ${objColDOM}
            ${judgeTitle}
            ${filterColDOM}`;
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
                    ${genDetailItem(true, noFilterOption)}
                    ${genDetailItem(true, allOption)}
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
    $(`#checkbox-all-${id + parentId}`).change(function f(e) {
        $(`#${this.closest('.list-group').id} .checkbox-no-filter`).prop('checked', !$(this).prop('checked'));
        $(`#${this.closest('.list-group').id} .${mainChkBoxClass}`).prop('checked', $(this).prop('checked'));
        if ($(this).is(':checked') === false) {
            // reset objective
            const objectiveEle = $(this.closest('ul.list-group')).find('input[name=objectiveVar]:checked');
            if (objectiveEle.data('is-target')) {
                objectiveEle.prop('checked', false);
            }
        }
        limitedCheckedList = [];
        // find all check items
        $(`#${parentId}`)
            .parents()
            .find('input[name^=GET02_VALS_SELECT]:checked')
            .not('.checkbox-all')
            .each((_, item) => limitedCheckedList.push(item));
        countVariables(parentId, props.groupIDx);
        compareSettingChange();
        createOrUpdateSensorOrdering(e, true);
    });
    // check all labels and filters
    $(`.checkbox-all-labels`).change(function f() {
        $(`#${this.closest('.list-group').id} .as-label-input`).prop('checked', $(this).prop('checked'));
        return;
    });
    // check to mark no filter
    $(`#checkbox-no-filter-${id + parentId}`).change(function f() {
        $(`#${this.closest('.list-group').id} .checkbox-all`).prop('checked', !$(this).prop('checked'));
        $(`#${this.closest('.list-group').id} .${mainChkBoxClass}`).prop('checked', !$(this).prop('checked'));
        compareSettingChange();
    });

    // check event
    $(`#${id} .check-item`).on('change', function f(e) {
        const checkboxNoFilter = $(`#${this.closest('.list-group').id} .checkbox-no-filter`);
        const thresholdBox = $(`#threshold-${this.id}`);
        const isCheckLimit = MAX_NUMBER_OF_SENSOR && /VALS_SELECT/.test($(this).attr('name'));

        if ($(this).is(':checked') === false) {
            $(`#${this.closest('.list-group').id} .checkbox-all`).prop('checked', $(this).prop('checked'));
            const parentRow = $(this.closest('li.list-group-item.form-check'));
            parentRow.find('[name=objectiveVar]').prop('checked', false);
            thresholdBox.prop('checked', false);
            if (isCheckLimit) {
                limitedCheckedList = limitedCheckedList.filter((el) => $(el).attr('id') !== $(this).attr('id'));
                if (isShowColorCheckBox) {
                    $(this).removeAttr('data-sensor');
                    $(this.closest('.list-group-item')).find('[name=catExpBox]').prop('disabled', false);
                }
            }
        } else {
            thresholdBox.prop('checked', true);
            if (isCheckLimit) {
                limitedCheckedList.push($(this));
                if (isShowColorCheckBox) {
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
        if (isCheckLimit && limitedCheckedList.length > MAX_NUMBER_OF_SENSOR && $(this).is(':checked')) {
            // shift first item from list if $(this) is checked
            // to avoid shift/uncheck 2 items at same time
            // we should also remove count total variables from process which had a checkbox removed
            const idStart = 'end-proc-val-div-';
            let removedItemParentId = limitedCheckedList[0].closest(`div[id^=${idStart}`).attr('id');
            let removedItemGroupIdx = removedItemParentId.replace(idStart, '');
            $(limitedCheckedList[0]).prop('checked', false);
            countVariables(removedItemParentId, removedItemGroupIdx);

            if (isShowColorCheckBox) {
                $(limitedCheckedList[0].closest('.list-group-item')).find('[name=catExpBox]').prop('disabled', false);
                // remove data-sensor attr
                limitedCheckedList[0].removeAttr('data-sensor');
            }
            limitedCheckedList.shift();
        }

        // in case of either x or y data type is string, color variable will be changed belong with string sensor.
        if (isShowColorCheckBox && limitedCheckedList.length > 0) {
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

        countVariables(parentId, props.groupIDx);
        createOrUpdateSensorOrdering(e);
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
    // endProcSortable();
};

const countVariables = (parentId, groupId) => {
    const selectedVariablesCount = $(`#${parentId}`)
        .find('input[name^=GET02_VALS_SELECT]:checked')
        .not('.checkbox-all').length;
    $(`#count-variables-${groupId}`).text(selectedVariablesCount);
    countTotalVariables();
};

const countTotalVariables = () => {
    let selectedVars = $('span[id^=count-variables-]').map((idx, ele) => parseInt($(ele).text()));
    selectedVars = Array.from(selectedVars);
    let countVars = 0;
    if (selectedVars.length) {
        countVars = selectedVars.reduce((a, b) => a + b);
    }
    $('#count-total-variables').text(countVars);
    $('#max-variables').text(MAX_NUMBER_OF_SENSOR);
    $('#variables-count').show();

    // check validate
    if (countVars > MAX_NUMBER_OF_SENSOR || (MIN_NUMBER_OF_SENSOR > 0 && countVars > 0 && countVars < MIN_NUMBER_OF_SENSOR)) {
        $('#variables-count').css({
            color: 'red',
        })
    } else {
        $('#variables-count').removeAttr('style');
    }
};

const onChangeFilterCheckBox = (e) => {
    const parentDiv = $(e).closest('li.list-group-item.form-check').parent();
    const selector = 'input[name^=GET02_CATE_SELECT]';
    const allCheckBoxLen = parentDiv.find(selector).length;
    const checkedCheckBoxLen = parentDiv.find(selector + ':checked').length;

    if (checkedCheckBoxLen === allCheckBoxLen) {
        // check All Label
        parentDiv.find('.checkbox-all-labels').prop('checked', true);
    } else {
        // uncheck All Label
        parentDiv.find('.checkbox-all-labels').prop('checked', false);
    }

    compareSettingChange();
};

const onchangeJudge = (e) => {
    const _this = $(e);
    const parentRow = _this.parents('li');
    const facetEl = parentRow.find('[name=catExpBox]');
    const isChecked = _this.prop('checked');
    const judgeConditionCard = $('#judgeConditionCard');
    const NGCondition = $('#NGCondition');
    const NGConditionValue = $('#NGConditionValue');

    if (isChecked) {
        const dataType = _this.attr('data-type');
        judgeConditionCard.show();
        judgeConditionCard.find('input, select').prop('disabled', false);

        // show only =, != if type == str
        if (dataType === DataTypes.STRING.name) {
            NGCondition.find('option[show-for=real]').attr('hidden', true);
            // off change, input event
            NGConditionValue.off('input');
            NGConditionValue.off('change');
        } else {
            NGCondition.find('option[show-for=real]').attr('hidden', false);
            // validate type = Int, and real input
            validateNumericInput(NGConditionValue);
            if (!Number(NGConditionValue.val())) {
                NGConditionValue.val(0)
            }
        }

        // reset facet in row
        facetEl.val('')
    } else {
        judgeConditionCard.hide();
        judgeConditionCard.find('input, select').prop('disabled', true);

    }

    compareSettingChange();

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
    let selectedEls = [];
    const sensorListID = `#list-${id}`;

    // multi select search with input immediately
    $(`#search-${id}`).off('keypress input');
    $(`#search-${id}`).on('keypress input', (event) => {
        const searchEle = event.currentTarget;
        let value = stringNormalization(searchEle.value.toLowerCase());
        // event.target.value = value;

        value = makeRegexForSearchCondition(value);

        const regex = new RegExp(value, 'i');
        selectedEls = $(`#${searchEle.closest('.form-group').id} li`).filter(function f(index) {
            const searchEls = $(this).find('.search-col');
            searchEls.removeClass('gray');
            const val = searchEls.text().toLowerCase();
            // keep to show first (header) row as index = 0
            if (index) {
                $(this).toggle(regex.test(val));

                return regex.test(val);
            }
            return false;
        });

        if (event.keyCode === KEY_CODE.ENTER) {
            $(`#${searchEle.closest('.form-group').id} li`).filter(function () {
                const searchEls = $(this).find('.search-col');
                const val = searchEls.text().toLowerCase();
                $(this).show();
                searchEls.each((i, el) => {
                    if (!regex.test($(el).text().toLowerCase())) {
                        $(el).addClass('gray');
                    } else {
                        $(el).removeClass('gray');
                    }
                })
                if (!value) return false;

                return regex.test(val);
            });
        }
    });

    // handle on click set selected items button
    $(`#setBtnSearch-${id}`).on('click', function () {
        selectedEls.find('input.main-checkbox').prop('checked', true).trigger('change');
        sortCheckItems();
    });

    // handle on click reset selected items button
    $(`#resetBtnSearch-${id}`).on('click', function () {
        const checkBoxNoFilter = originalCheckBoxs.find('input.checkbox-no-filter');
        if (checkBoxNoFilter.length && !selectedEls.length) {
            // reset in filter component
            originalCheckBoxs.parent().find('input[name=thresholdBox]').prop('checked', false).trigger('change');
            checkBoxNoFilter.prop('checked', true).trigger('change');
        }
        if (selectedEls.length) {
            // reset only searched element
            selectedEls.find('input.main-checkbox').prop('checked', false).trigger('change');
        }
        if (!selectedEls.length && !checkBoxNoFilter.length) {
            // reset all input, select
            originalCheckBoxs.parent().find('input[type=checkbox]').prop('checked', false).trigger('change');
            originalCheckBoxs.parent().find('input[type=radio]').prop('checked', false).trigger('change');
            originalCheckBoxs.parent().find('select').val('').trigger('change');
        }

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
                $(that).css({transform: `translateX(-${dropDownWidth - dropDownWidthMin}px)`});
            }
            $(that).css({width: `${dropDownWidth}px`});
            $(that).css({maxWidth: `${windowWidth}px`});
            if (dropDownHeight > leftHeightFromCurrentPosition) {
                $(that).css({height: `${leftHeightFromCurrentPosition}px`});
            } else {
                $(that).css({height: `${dropDownHeight}px`});
            }

            parent.css({height: `${parentHeight + 15}px`});
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
        if (!['catExpBox', 'colorVar'].includes($(selected).attr('name'))) {
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
                    countTotalVariables();
                    updateSelectedItems();
                    checkIfProcessesAreLinked();
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
                    updateSelectedItems(false, $(formElements.condProcSelectedItem));
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
const condLineOnChange = async (selectedLines, count, prefix = '', isNew = false) => {
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
        const elName = `machine_id_multi${count}`;
        const elId = `${prefix}cond-proc-machine-${count}`;

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

        // if new load all machine
        if (isNew) {
            // remove old elements
            $(`#${prefix}cond-proc-machine-${count}`).remove();

            // load machine multi checkbox to Condition Proc.
            if (machineIds) {
                const machineLabel = i18nCommon.mach || '';
                const thresholdBoxes = [];
                machineIds.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));
                addGroupListCheckboxWithSearch(
                    parentId,
                    elId,
                    machineLabel,
                    machineIds,
                    machineVals, {
                        checkedIds,
                        name: elName,
                        noFilter: true,
                        thresholdBoxes
                    });
            }
        } else {
            // hide and disabled show filter, not generate from scratch
            if (machineIds) {
                // hide all machine elements
                const allInput = $(`input[name=${elName}]`).not(`[value=${CONST.NO_FILTER}],[value=All]`);
                allInput.attr('disabled', true);
                allInput.closest('li').hide();
                for (const machineId of machineIds) {
                    $(`input[name=${elName}][value=${machineId}]`).removeAttr('disabled');
                    $(`input[name=${elName}][value=${machineId}]`).closest('li').show();
                }
            }
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
        addGroupListCheckboxWithSearch(
            `${prefix}cond-proc-line-div-${count}`,
            condProcMachineLineId,
            i18nCommon.line,
            lineIds,
            lineVals,
            {
                name: `filter-line-machine-id${count}`,
                noFilter: true,
                thresholdBoxes
            });

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
        condLineOnChange(['all'], count, prefix, true);
    }

    const [partnoIds, partnoVals] = getFilterByTypes(procInfo, filterTypes.PART_NO);
    let parentId = `${prefix}cond-proc-partno-div-${count}`;

    if (partnoIds) {
        const thresholdBoxes = [];
        partnoIds.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));

        // load partno multi checkbox to Condition Proc.
        addGroupListCheckboxWithSearch(
            parentId,
            `${prefix}cond-proc-partno-${count}`,
            i18nCommon.partNo,
            partnoIds,
            partnoVals,
            {
                name: `filter-partno${count}`,
                noFilter: true,
                thresholdBoxes
            }
        );
    }


    const filterOthers = getFilterByTypes(procInfo, filterTypes.OTHER);
    parentId = `${prefix}cond-proc-others-div-${count}`;
    if (filterOthers.length) {
        filterOthers.forEach((filter, k) => {
            if (filter.title) {
                const thresholdBoxes = [];
                filter.ids.forEach(e => thresholdBoxes.push(hasGraphCfgsFilterDetails.includes(e)));
                addGroupListCheckboxWithSearch(
                    parentId,
                    `${prefix}cond-proc-filterother-${filter.id}-${count}`,
                    filter.title,
                    filter.ids,
                    filter.vals,
                    {
                        name: `filter-other-${filter.id}-${count}`,
                        noFilter: true,
                        thresholdBoxes
                    }
                );
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
            const itemVal = procVals[i].shown_name;
            const itemEnVal = procVals[i].name_en;
            itemList.push(`<option value="${itemId}" title="${itemEnVal}">${itemVal}</option>`);
        }

        while (checkExistDataGenBtn(dataGenBtn, count, parentFormId)) {
            count = countUp(count);
        }

        const proc = `<div class="col-12 col-xl-6 col-lg-12 col-md-12 col-sm-12 p-1">
                    <div class="card cond-proc dynamic-element table-bordered py-sm-3 filter-condition-card">
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
        updateSelectedItems(false, $(formElements.condProcSelectedItem));
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
    if (isSettingLoading) return;
    let currentLevelSet = $(e).val();
    if (currentLevelSet === null) {
        currentLevelSet = '';
        $(e).val('');
    }
    const currentSelectedID = $(e).attr('id');
    const formID = $(e).closest('form').attr('id');
    const currentTabID = '';
    const judgeEl = $(e).parents('li').find('[name=judgeVar]:checked');

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

    if (currentLevelSet) {
        judgeEl.prop('checked', false).trigger('change');
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

const changeObjectiveVarEvent = () => {
    const hasObjectiveCol = $('input[name=objectiveVar]:checked').length;
    if (!hasObjectiveCol) {
        // reset all Str cols which are already checked
        $('.is-string-col input').removeClass('show-ele');
        $('.is-string-col label').removeClass('show-ele');
    } else {
        $('.is-string-col input').addClass('show-ele');
        $('.is-string-col label').addClass('show-ele');
    }
    compareSettingChange();
};

const isLinkedWithStartProcess = async (end_proc_id, start_proc_id) => {
    const url = `/ap/api/setting/proc_config/${end_proc_id}/traces_with/${start_proc_id}`
    const res = await fetchData(url, {}, 'GET');
    return res.data;
}

const setColorRelativeStartEndProc = () => {

    const startProc = $('select[name=start_proc]');
    const startProcVal = startProc.val();
    const endProcs = $('select[name^=end_proc]');
    if (startProcVal === '0') {
        // no data link -> start proc blue -> all end proc black
        startProc.addClass('blue-color');
        endProcs.removeClass('blue-color');

    }

    if (startProcVal === '') {
        // start proc not set, default if first end proc is black end others is blue.
        startProc.removeClass('blue-color');
        endProcs.addClass('blue-color');
        $(endProcs[0]).removeClass('blue-color');
    }

    if (startProcVal && startProcVal !== '0') {
        // end proc is start proc is black and others is blue.
        startProc.removeClass('blue-color');
        endProcs.each((i, el) => {
            if ($(el).val() === startProcVal) {
                $(el).removeClass('blue-color');
            } else if ($(el).val()) {
                $(el).addClass('blue-color');
            }
        })
    }
};

const checkIfProcessesAreLinked = async () => {
    if(isSettingLoading){
        return
    }
    const startProc = $('select[name=start_proc]');
    const startProcVal = startProc.val();
    const endProcs = $('select[name^=end_proc]');
    const warningSigns = $('svg[id^=no-link-with-start-proc]')
    warningSigns.css({display: 'none'});
    hideAlertMessages();

    if (startProcVal === '') {
        const startProcId = $(endProcs[0]).val()
        let displayAlert = false;
        for (const el of endProcs) {
            if(($(el).val() === startProcId) || !$(el).val()){
                continue
            }
            const warningSign = $(el).siblings('svg[id^=no-link-with-start-proc]')
            const hasLink = await isLinkedWithStartProcess($(el).val(), startProcId)
            if (hasLink) {
                warningSign.css({display: 'none'});
            } else {
                warningSign.css({display: 'block'});
                displayAlert = true;
            }
        }
        if (displayAlert) {
            displayRegisterMessage("#alertNoLinkConfig", {
                is_error: true,
                message: $("#i18nNoLinkConfig").text(),
            })
        } else hideAlertMessages();
    }

    if (startProcVal && startProcVal !== '0') {
        let displayAlert = false;
        for (const el of endProcs) {
            if(!$(el).val()){
                continue
            }
            const warningSign = $(el).siblings('svg[id^=no-link-with-start-proc]');
            const hasLink = await isLinkedWithStartProcess($(el).val(), startProcVal);
            if (hasLink) {
                warningSign.css({display: 'none'});
            } else {
                warningSign.css({display: 'block'});
                displayAlert = true;
            }
        }
        if (displayAlert) {
            displayRegisterMessage("#alertNoLinkConfig", {
                is_error: true,
                message: $("#i18nNoLinkConfig").text(),
            })
        } else hideAlertMessages()
    }
}