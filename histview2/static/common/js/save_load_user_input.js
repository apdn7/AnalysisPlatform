/* eslint-disable guard-for-in,indent,no-tabs,linebreak-style */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */

let isExportMode = false;
let UserSettingExportInfo = null;
let isUserSwitchedTab = true;
let previousSettingInfor = null;
let mainFormSettings = null;
let currentLoadSetting = null;
const INVALID_FILTER_DETAIL_IDS = 'invalid_filter_detail_ids';
const SHARED_USER_SETTING = 'shared_user_setting';

const settingModals = {
    common: '#saveUserSettingModal',
    confirmation: '#saveSettingConfirmModal',
    confirmBtn: '#saveSettingConfirmed',
    mainSettingForm: '#mainContent form',
    userSetting: '#userSetting',
    saveSettingBtn: '#saveSettingBtn',
    loadSettingModal: '#loadUserSettingModal',
    overwriteSaveSettingBtn: '#overwriteSaveSettingBtn',
    currentLoadSettingLbl: '#currentLoadSettingLbl',
    overwriteConfirmation: '#overwriteSaveSettingConfirmModal',
    overwriteConfirmBtn: '#overwriteSaveSettingConfirmed',
    alertUserSettingErrorMsg: '#alertUserSettingErrorMsg',
    saveSettingConfirmBtn: '#saveSettingConfirmBtn',
    bookmarkBtn: '#bookmark-title',
    menuExport: '#contextMenuExport',
    menuImport: '#contextMenuImport',
    showGraphNow: '[name=showGraphNow]',
    loadUserSettingLabel: '#loadUserSettingLabel',
};

const i18nEles = {
    shared: '#i18nShared',
    private: '#i18nPrivate',
    open: '#i18nOpen',
};

const saveSettingExceptionPages = {
    TI: 'tile_interface',
    CFG: 'config',
    ABOUT: 'about',
};

const getAllTabs = (includeEle = null) => {
    const tabs = $('[name=inputTab] .tab-pane');
    if (!tabs.length) {
        return $(document);
    }

    if (includeEle) {
        for (const tab of tabs) {
            if ($(tab).find(includeEle).length) {
                return tab;
            }
        }
    }

    return tabs;
};

const getShowTab = () => {
    const showTab = $('[name=inputTab] .tab-pane.show.active');
    if (showTab.length) {
        return showTab;
    }

    return $(document);
};

const getShowFormId = () => {
    let showForm = $('[name=inputTab] .tab-pane.show.active form');
    if (showForm.length) {
        return showForm[0].id;
    }

    showForm = $('form').not('#userSetting');
    if (showForm.length) {
        return showForm[0].id;
    }

    return null;



};

const genInvalidFilterName = (procId, startDate, startTime, endDate, endTime) => [INVALID_FILTER_DETAIL_IDS, procId, startDate, startTime, endDate, endTime].join('_');

const getConditionGroups = (parentDiv) => {
    const searchGroups = $(parentDiv).find('[id*=cond-proc].grouplist-checkbox-with-search');
    return searchGroups;
};

const getNonConditionGroups = (parentDiv) => {
    const searchGroups = $(parentDiv).find('.grouplist-checkbox-with-search').not('[id*=cond-proc]');
    return searchGroups;
};

const getCheckedFilters = (parentDiv) => {
    const filterEles = $(parentDiv).find('[id$=cond-proc-row] input:checkbox:checked');
    const filterDetailIds = [];
    for (el of filterEles) {
        const val = Number(el.value);
        if (val) {
            filterDetailIds.push(val);
        }
    }
    return filterDetailIds;
};

const getFilterKeys = (parentDiv) => {
    let proc = $(parentDiv).find('select[name=start_proc] :selected').first();
    if (!proc.length) {
        proc = $(parentDiv).find('select[name^=end_proc] :selected').first();
    }

    if (!proc.length) {
        return null;
    }

    const timeRadio = $(parentDiv).find('input[type=radio][name*=raceTime]:checked');
    if (!timeRadio.length) {
        return null;
    }

    const startDates = $(parentDiv).find('input[name*=START_DATE]');
    const startTimes = $(parentDiv).find('input[name*=START_TIME]');
    const endDates = $(parentDiv).find('input[name*=END_DATE]');
    const endTimes = $(parentDiv).find('input[name*=END_TIME]');

    if (!startDates.length) {
        return null;
    }

    const keys = [];
    for (let i = 0; i < startDates.length; i++) {
        let startTime = '';
        if (startTimes && startTimes[i]) {
            startTime = startTimes[i].value;
        }

        let endDate = '';
        if (endDates && endDates[i]) {
            endDate = endDates[i].value;
        }

        let endTime = '';
        if (endTimes && endTimes[i]) {
            endTime = endTimes[i].value;
        }

        const key = genInvalidFilterName(proc.val(), startDates[i].value, startTime, endDate, endTime);
        keys.push(key);
    }

    return keys;
};

const controlInvalidFilterLifeCycle = (key) => {
    const invalidFilterKeys = JSON.parse(localStorage.getItem(INVALID_FILTER_DETAIL_IDS)) || [];
    const pos = invalidFilterKeys.indexOf(key);
    if (pos >= 0) {
        invalidFilterKeys.splice(pos, 1);
    }
    invalidFilterKeys.push(key);

    // to make sure we only hold 1000 records for all pages ( avoid full localstorage )
    const deletePos = invalidFilterKeys.length - 1000;
    for (let i = 0; i < deletePos; i++) {
        localStorage.removeItem(invalidFilterKeys[i]);
        invalidFilterKeys.splice(i, 1);
    }

    localStorage.setItem(INVALID_FILTER_DETAIL_IDS, JSON.stringify(invalidFilterKeys));
};

const saveInvalidFilters = (key, invalidFilterDetailIds) => {
    if (!invalidFilterDetailIds.length) {
        return false;
    }

    let targets = invalidFilterDetailIds;
    const ids = JSON.parse(localStorage.getItem(key)) || [];
    targets.concat(ids);
    targets = uniq(targets);
    localStorage.setItem(key, JSON.stringify(targets));
    controlInvalidFilterLifeCycle(key);
    return true;
};

const removeInvalidFilters = (key, invalidFilterDetailIds) => {
    if (!invalidFilterDetailIds.length) {
        return false;
    }

    const ids = JSON.parse(localStorage.getItem(key)) || [];
    for (let j = 0; j < invalidFilterDetailIds.length; j++) {
        const pos = ids.indexOf(invalidFilterDetailIds[j]);
        if (pos >= 0) {
            ids.splice(pos, 1);
        }
    }
    localStorage.setItem(key, JSON.stringify(ids));
    controlInvalidFilterLifeCycle(key);
    return true;
};


const getInvalidFilters = (key) => {
    const data = JSON.parse(localStorage.getItem(key)) || [];
    return data;
};

const getSortKeys = (targetEle, isSimple = null) => {
    const lastPosNumber = 9999;
    const keys = [];
    const liGrey = $(targetEle).hasClass('li-grey');
    const liBlue = $(targetEle).hasClass('li-blue');
    const columnName = $(targetEle).find('.column-master-name');
    const cycleTimeCol = $(targetEle).find('.data-type');
    const facetSelect = $(targetEle).find('select');
    const facetLevel = facetSelect.length > 0 && facetSelect.val() !== '' ? Number(facetSelect.val()) : lastPosNumber;
    const checkboxs = $(targetEle).find('input:checkbox,input:radio');
    const val = checkboxs.length === 0 ? lastPosNumber : checkboxs[0].value;
    const sensorOrder = checkboxs.length > 0 ? Number($(checkboxs[0]).attr('data-order')) : null;
    const isChecked = !!(checkboxs.length > 0 && checkboxs[0].checked);
    const isColumnNameBlank = !!(columnName.length > 0 && columnName.text() === '');
    // order by sensor x, y
    const sensor = checkboxs.length > 0 ? $(checkboxs[0]).attr('data-sensor') : null;

    if (val === 'NO_FILTER') {
        keys.push(0);
    } else if (val === 'All') {
        keys.push(1);
    } else {
        keys.push(2);
    }

    if (isSimple) {
        keys.push(isChecked === null ? lastPosNumber : (isChecked ? 0 : 1));
        return keys;
    }

    let cycleTimeVal = lastPosNumber;
    if (cycleTimeCol.length > 0) {
        if (cycleTimeCol.text() === 'CT') {
            if (isChecked) {
                cycleTimeVal = isColumnNameBlank ? 0 : 1;
            }
        }
    }
    keys.push(cycleTimeVal);
    if (sensorOrder) {
        if (sensor && sensor === 'x') {
            keys.push(0);
        } else if (sensor && sensor === 'y') {
            keys.push(0.1);
        } else {
            keys.push(isChecked === null ? lastPosNumber : (isChecked ? 0 : 1));
        }
        keys.push(facetLevel);
    } else {
        keys.push(facetLevel);
        keys.push(isChecked === null ? lastPosNumber : (isChecked ? 0 : 1));
    }
    keys.push(liGrey ? 2 : (liBlue ? 1 : 0));
    keys.push(checkboxs.length >= 2 ? (checkboxs[1].checked ? 0 : 1) : 2);
    keys.push(cycleTimeVal);
    // keys.push(Number(val));

    return keys;
};

const sortHtmlElements = (parentEle, isSimple = null) => {
    let isChanged = false;
    const ul = $(parentEle);
    const items = ul.find('.list-group-item').get();
    items.sort((a, b) => {
        const aKeys = getSortKeys(a, isSimple);
        const bKeys = getSortKeys(b, isSimple);

        for (let i = 0; i < aKeys.length; i++) {
            const keyA = aKeys[i];
            const keyB = bKeys[i];
            if (keyA < keyB) {
                isChanged = true;
                return -1;
            }
            if (keyA > keyB) return 1;
        }
        return 0;
    });

    $.each(items, (i, li) => {
        ul.append(li);
    });
    return isChanged;
};

const moveFilter = (searchGroup, invalidFilterDetailIds, onlyCheckedFilter = true) => {
    const items = $(searchGroup).find('.list-group-item');
    for (e of items) {
        const ele = $(e);
        if (!ele) {
            continue;
        }

        let filterEle;
        if (onlyCheckedFilter) {
            filterEle = ele.find('input:checkbox:checked');
        } else {
            filterEle = ele.find('input:checkbox');
        }

        if (filterEle.length) {
            if (invalidFilterDetailIds.indexOf(Number(filterEle[0].value)) >= 0) {
                if (!ele.hasClass('li-grey')) {
                    ele.addClass('li-grey');
                }
            } else if (ele.hasClass('li-grey')) {
                ele.removeClass('li-grey');
            }
        }
    }

    sortHtmlElements(searchGroup);
};

const loadAllInvalidFilterCaller = (parentDiv, isTab = true) => {
    const conditionGroups = getConditionGroups(parentDiv);
    const currentTab = isTab ? parentDiv : getAllTabs(parentDiv);
    const keys = getFilterKeys(currentTab) || [];
    for (const invalidKey of keys) {
        const invalidFilters = getInvalidFilters(invalidKey);
        conditionGroups.each((i, e) => moveFilter(e, invalidFilters, false));
    }
};

const setColorAndSortHtmlEle = (matchedIds, unmatchedIds, otherIds) => {
    const showTab = getShowTab();
    const searchGroups = getConditionGroups(showTab);

    for (const searchGroup of searchGroups) {
        const items = $(searchGroup).find('.list-group-item');
        for (e of items) {
            const ele = $(e);
            if (!ele) {
                continue;
            }

            const filterEle = ele.find('input:checkbox');

            if (!filterEle.length) {
                continue;
            }

            const filterDetailId = Number(filterEle[0].value);
            if (matchedIds.includes(filterDetailId)) {
                ele.removeClass('li-grey');
            } else if (unmatchedIds.includes(filterDetailId)) {
                ele.addClass('li-grey');
            } else if (otherIds.includes(filterDetailId)) {
                ele.addClass('li-blue');
            }
        }

        sortHtmlElements(searchGroup);
    }

    // sort element
    const otherGroups = getNonConditionGroups(showTab);
    for (const otherGroup of otherGroups) {
        sortHtmlElements(otherGroup);
    }
};
const saveInvalidFilterCaller = (isRemove = false) => {
    const showTab = getShowTab();
    const searchGroups = getConditionGroups(showTab);
    const keys = getFilterKeys(showTab) || [];
    const invalidFilters = getCheckedFilters(showTab);

    if (isRemove) {
        for (const invalidKey of keys) {
            removeInvalidFilters(invalidKey, invalidFilters);
            searchGroups.each((i, e) => moveFilter(e, []));
        }
    } else {
        for (const invalidKey of keys) {
            saveInvalidFilters(invalidKey, invalidFilters);
            searchGroups.each((i, e) => moveFilter(e, invalidFilters));
        }
    }

    // sort element
    const otherGroups = getNonConditionGroups(showTab);
    for (const otherGroup of otherGroups) {
        sortHtmlElements(otherGroup);
    }
};

const setTriggerInvalidFilter = (parentDiv) => {
    let proc = $(parentDiv).find('select[name=start_proc]').first();
    if (!proc.length) {
        proc = $(parentDiv).find('select[name^=end_proc]').first();
    }

    const timeRadio = $(parentDiv).find('input[type=radio][name*=raceTime]:checked');
    const startDates = $(parentDiv).find('input[name*=START_DATE]');
    const startTimes = $(parentDiv).find('input[name*=START_TIME]');
    const endDates = $(parentDiv).find('input[name*=END_DATE]');
    const endTimes = $(parentDiv).find('input[name*=END_TIME]');

    for (const ele of [proc, timeRadio, startDates, startTimes, endDates, endTimes]) {
        ele.on('change', (_) => {
            const showTab = getShowTab();
            loadAllInvalidFilterCaller(showTab);
        });
    }
};

const checkResultExist = (res) => {
    if (res.times !== undefined) {
        if (res.times.length > 0) {
            return true;
        }
        return false;
    }

    const plotDatas = res.array_plotdata || {};
    for (const plot of Object.values(plotDatas)) {
        if (plot.array_y && plot.array_y.length > 0) {
            return true;
        }
    }

    return false;
};

// ////////////////////////////////////////
const saveLoadUserInput = (selector, localStorageKeyPrefix = '', parent = '', localStorageKey = null) => {
    const DYNAMIC_ELE_ATTR = 'data-gen-btn';

    const buildEleSelector = (name, value = null, id = null) => {
        let output = '';
        if (parent) {
            output += `#${parent} `;
        }

        if (id) {
            output += `#${id}`;
        }

        if (name) {
            output += `[name=${name}]`;
        }
        if (value) {
            output += `[value=${value}]`;
        }

        return output;
    };

    let formId;
    let form;
    if (typeof (selector) === 'string') {
        form = document.querySelector(selector);
        // form does not exist
        if (!form) {
            // find a form in document ( maybe GUI changed )
            form = $('form').not('#userSetting');
            if (!form) {
               return;
            }
            form = form[0];
        }
        formId = form.getAttribute('id');
    } else {
        form = selector;
        formId = selector.id || '';
    }

    if (formId === 'userSetting') {
        return;
    }

    let key;
    if (localStorageKey) {
        key = localStorageKey;
    } else {
        key = `${localStorageKeyPrefix}_${formId}_saveUserInput`;
    }
    const elements = form.querySelectorAll('input, textarea, select');
    const tabPanes = document.querySelectorAll('.tab-pane');

    const checkActiveTab = (el) => {
        return el.classList.contains('tab-pane') && el.classList.contains('active') && el.classList.contains('show');

    };


    const serializeArray = () => {
        const serializeData = [];

        elements.forEach((el) => {
            const data = {
                id: el.id, name: el.name, value: el.value || $(el).val(), type: el.type,
            };
            // load level
            const loadLevel = $(el).data('load-level');
            if (loadLevel) {
                data.level = loadLevel;
            }

            // only match
            if (el.type === 'radio' || el.type === 'checkbox') {
                data.checked = el.checked;
            } else if (el.getAttribute(DYNAMIC_ELE_ATTR)) {
                // dynamic generate div
                data.genBtnId = el.getAttribute(DYNAMIC_ELE_ATTR);
            }

            serializeData.push(data);
        });

        tabPanes.forEach((el) => {
            const data = {
                id: el.id, name: el.name, value: el.value, type: el.type, isActiveTab: checkActiveTab(el),
            };
            serializeData.push(data);
        });

        return serializeData;
    };

    const saveUserInput = () => {
        const formData = JSON.stringify(serializeArray());
        localStorage.setItem(key, formData);
    };

    // call all event of element
    const callAllEvent = (ele, events = ['change']) => {
        // const events = window.getEventListeners(ele);
        // for (eventName in events) {
        //     events[eventName].forEach(e => e.listener.call());
        // }

        for (const eventName of events) {
            try {
                $(ele).trigger(eventName);
            } catch (error) {
                continue;
            }
        }
    };

    // check current eles count
    const getShownEles = (id=null,name=null) => {
        let shownEles =[];
        for (let keyword of [id,name]) {
            if (keyword) {
                shownEles = form.querySelectorAll(`[${DYNAMIC_ELE_ATTR}="${id}"]`);
                if (shownEles.length) {
                    return shownEles
                }
            }
        }
        return shownEles;
    };
    const findGenBtn = (btn) =>{
        let genBtn = form.querySelectorAll(`#${btn}`);
        if (genBtn.length > 0) {
            return genBtn[0];
        }
        genBtn = form.querySelectorAll(`[name="${btn}"]`);
        if (genBtn.length > 0) {
            return genBtn[0];
        }
        return null;
    }

    const checkEleExistOnScreen = (btn, ele) => {
        const genBtn = findGenBtn(btn);
        if (!genBtn) {
            return null;
        }

        const dataGenBtnId = genBtn.id;
        const dataGenBtnName = genBtn.name;

        const shownEles = getShownEles(dataGenBtnId,dataGenBtnName);
        // const shownEleNumbers = [];
        for (const shownEle of shownEles) {
            if (ele.name === shownEle.name) {
                return null;
            }
            // shownEleNumbers.push(getLastNumberInString(shownEle.name));
        }
        // const eleNumber = getLastNumberInString(ele.name);
        // if (eleNumber && shownEleNumbers.length) {
        //     if (eleNumber < Math.max(...shownEleNumbers)) {
        //         return null;
        //     }
        // }

        return genBtn;
    };

    const genNewEle = (btn, ele) => {
        // 200 loop
        for (let i = 0; i < MAX_DYNAMIC_CARD; i++) {
            // console.log(`genNewEle: ${i}, ${ele.name}`);
            const btnAddNew = checkEleExistOnScreen(btn, ele);
            if (btnAddNew) {
                callAllEvent(btnAddNew, events = ['click']);
            } else {
                break;
            }
        }
    };

    const removeUnusedEle = (btn, usedEleNames) => {
        const genBtn = findGenBtn(btn);
        if (!genBtn){
            return;
        }
        const dataGenBtnId = genBtn.id;
        const dataGenBtnName = genBtn.name;
        const shownEles = getShownEles(dataGenBtnId,dataGenBtnName);
        for (const shownEle of shownEles) {
            if (!usedEleNames.includes(shownEle.name)) {
                const target = form.querySelectorAll(`[name="${shownEle.name}"]`);
                $(target).closest('.card').find('.close-icon').trigger('click');
            }
        }
    };

    // count element need to generate:
    const genDynamicEle = (eles) => {
        const dicBtn = {};
        for (let i = 0; i < eles.length; i++) {
            const el = eles[i];
            if (el.genBtnId) {
                if (dicBtn[el.genBtnId]) {
                    dicBtn[el.genBtnId].push(i);
                } else {
                    dicBtn[el.genBtnId] = [i];
                }
            }
        }

        for (let btn in dicBtn) {
            btn = btn.replaceAll('"', '');
            const eleNames = [];
            for (const idx of dicBtn[btn]) {
                const ele = eles[idx];
                eleNames.push(ele.name);
                // check if process is exists then render HTML elements
                if (procConfigs[ele.value] && (!['TermSerialProcess', 'serialProcess'].includes(ele.name))) {
                    genNewEle(btn, ele);
                }

                if (ele.name === DATETIME_RANGE_PICKER_CLASS) {
                    callAllEvent($(`#${btn}`), ['click']);
                    // APPLY VALUE TO RENDERED DATE TIME PICKER
                    const dates = $('.datetimerange-group').find(`[name=${DATETIME_RANGE_PICKER_CLASS}]`);
                    const renderedInput = dates[dates.length - 1];
                    $(renderedInput).val(ele.value).trigger('change');

                    setTimeout(() => {
                        removeUnusedDate();
                    }, 200);
                }
            }
            removeUnusedEle(btn, eleNames);
        }
        return eles;
    };

    const loadActiveTab = (data) => {
        for (const v of data) {
            const el = $(`#${v.id}`)[0];
            if (el && !checkActiveTab(el)) {
                isUserSwitchedTab = false;
                callAllEvent(`a[href="#${v.id}"]`, ['click']);
            }
        }
    };

    const isDateTimePickerEl = (name) => {
        if ([DATETIME_RANGE_PICKER_CLASS,
            DATE_RANGE_PICKER_CLASS,
            DATETIME_PICKER_CLASS,
            DATE_PICKER_CLASS].includes(name)) {
            return true;
        }
        return false;
    };

    // todo: check 09/16 endtime
    const loadNonRadioCheckEle = (data) => {
        const remainEles = [];
        // load value
        for (const v of data) {
            if (!v.name) {
                continue;
            }

            let input = null;

            if (isDateTimePickerEl(v.name) && v.value.trim().length > 16) {
                const temp = v.value;
                v.value = temp.substr(0, 16) + DATETIME_PICKER_SEPARATOR + temp.substr(19);
            }
            try {
                let eleSelector = buildEleSelector(v.name, null, v.id);
                input = form.querySelector(eleSelector);
                if (input === null || input === undefined) {
                    if (!isDateTimePickerEl(v.name)) {
                        eleSelector = buildEleSelector(v.name);
                        input = form.querySelector(eleSelector);
                        if (input === null || input === undefined) {
                            remainEles.push(v);
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            } catch (error) {
                remainEles.push(v);
                continue;
            }

            input.value = v.value;
            if (v.type !== 'text') {
                callAllEvent(input);
            } else if (isDateTimePickerEl(v.name)) {
                $(input).trigger('change');
            }
        }
        return remainEles;
    };

    const loadRadioCheckboxEle = (data) => {
        const remainEles = [];
        // load value
        for (const v of data) {
            if (!v.name) {
                continue;
            }
            let input = null;
            const eleSelector = buildEleSelector(v.name);
            try {
                input = form.querySelectorAll(eleSelector);
                if (input === null || input === undefined) {
                    remainEles.push(v);
                    continue;
                }
            } catch (error) {
                remainEles.push(v);
                continue;
            }

            for (const el of input) {
                if (el.value === v.value) {
                    if (v.type === 'radio') {
                        $(el).attr('checked', v.checked);
                        $(el).trigger('change');
                    }
                    const oldCheck = el.checked;
                    el.checked = v.checked;
                    if (oldCheck !== el.checked) {
                        callAllEvent(el);
                    }
                }
            }
        }
        return remainEles;
    };

    const divideElementGroup = (data) => {
        const xIndexNames = ['serialProcess', 'serialColumn', 'serialOrder'];
        const activeTabs = [];
        const radioChecks = [];
        const others1 = [];
        const others2 = [];
        const indexVals = [];
        for (v of data) {
            if (v.type === 'radio' || v.type === 'checkbox') {
                radioChecks.push(v);
            } else if (v.isActiveTab) {
                activeTabs.push(v);
            } else if (Number(v.level) === 2) {
                others2.push(v);
            } else {
                others1.push(v);
            }
            if (xIndexNames.includes(v.name)) {
                indexVals.push(v);
            }
        }

        return [activeTabs, radioChecks, others1, others2, indexVals];
    };

    const loadIndex = (data) => {
        const procs = [];
        const cols = [];
        const orders = [];
        if (!data.length) return;
        $('#serialTable tbody').html('');
        for (const ele of data) {
            if (ele.name === 'serialProcess') {
                procs.push(ele);
            } else if (ele.name === 'serialColumn') {
                cols.push(ele);
            } else {
                orders.push(ele);
            }
        }

        setTimeout(() => {
            procs.forEach((process, i) => {
                const column = cols[i];
                const order = orders[i];
                $(`#${process.genBtnId}`).trigger('click');
                setTimeout(() => {
                    $($(`select[name=${process.name}]`)[i]).val(process.value).trigger('change');
                }, 100);
                setTimeout(() => {
                    $($(`select[name=${column.name}]`)[i]).val(column.value).trigger('change');
                    $($(`select[name=${order.name}]`)[i]).val(order.value).trigger('change');
                }, 200);
            });
        }, 1000);
    };

    const innerFunc = (isLoad = true, isSaveToLocalStorage = true, savedData = null) => {
        if (isLoad) {
            let data;
            if (isSaveToLocalStorage) {
                data = JSON.parse(localStorage.getItem(key));
            } else {
                data = savedData;
            }

            if (!data) {
                return;
            }

            // gen dynamic eles
            genDynamicEle(data);

            const [activeTabs, radioChecks, others1, others2, indexVals] = divideElementGroup(data);

            if (isSaveToLocalStorage) {
                loadActiveTab(activeTabs);
            }
            const remainOthers1 = loadNonRadioCheckEle(others1);

            setTimeout(() => {
                loadNonRadioCheckEle(remainOthers1);
            }, 200);

            setTimeout(() => {
                const remainOthers2 = loadNonRadioCheckEle(others2);

                setTimeout(() => {
                    loadNonRadioCheckEle(remainOthers2);
                    loadIndex(indexVals);
                }, 200);

                setTimeout(() => {
                    const remainRadioChecks = loadRadioCheckboxEle(radioChecks);

                    setTimeout(() => {
                        loadRadioCheckboxEle(remainRadioChecks);
                    }, 200);

                    // load invalid
                    const allTabs = getAllTabs();
                    allTabs.each((i, tab) => {
                        // sort element
                        const searchGroups = getConditionGroups(tab);
                        for (const searchGroup of searchGroups) {
                            sortHtmlElements(searchGroup);
                        }

                        // sort element
                        const otherGroups = getNonConditionGroups(tab);
                        for (const otherGroup of otherGroups) {
                            sortHtmlElements(otherGroup);
                        }
                    });
                }, 500);
            }, 1000);
        } else if (isSaveToLocalStorage) {
            saveUserInput();
        } else {
            return serializeArray();
        }
    };

    return innerFunc;
};

const isLocalStorage = (localStorageKeyPrefix = '', formId = '') => {
    formId = formId.replace('#', '');
    const key = `${localStorageKeyPrefix}_${formId}_saveUserInput`;
    return localStorage.getItem(key) !== null;
};

const renameUserSavedData = (fromTab, toTab, items) => {
    const oldStr = dicTabs[fromTab];
    const newStr = dicTabs[toTab];
    for (const item of items) {
        item.id = item.id.replaceAll(oldStr, newStr);
        if (item.genBtnId) {
            item.genBtnId = item.genBtnId.replaceAll(oldStr, newStr);
        }
    }
};

const saveUserSetting = (hiddenTab, shownTab, targetId) => {
    const userInputForSave = saveLoadUserInput(`${targetId}`, '');
    const data = userInputForSave(false, false);

    // replace string
    renameUserSavedData(hiddenTab, shownTab, data);

    return data;
};

// get userName from localStorage
const getOrSetUserName = (createdBy = '') => {
    const lSKey = 'settingCommonUserName';
    if (createdBy) {
        localStorage.setItem(lSKey, createdBy);
        return createdBy;
    }
    return localStorage.getItem(lSKey);
};

// set userName to setting common modal
const updateUserNameForSettingModal = () => {
    const userName = getOrSetUserName();
    if (userName) {
        $('#userNameLabel').text(userName);
        const createdBy = $('#userSetting').find('input[name="created_by"]')[0];
        if (createdBy) {
            $(createdBy).val(userName);
        }
    }
};

// set id to None (create new)
const clearSettingID = () => {
    const settingId = $(`${settingModals.userSetting} input[name=id]`)[0];
    if (settingId) {
        $(settingId).val('');
    }
};


const updateSettingPriority = (elem, userSettingId) => {
    const settingPriority = $(elem).val();
    if (settingPriority) {
        $.get(`/histview2/api/setting/user_setting/${userSettingId}`, (res) => {
            if (res.status === 200) {
                const settingDat = {
                    id: userSettingId,
                    priority: settingPriority,
                    created_by: res.data.created_by,
                    description: res.data.description,
                    key: res.data.key,
                    page: res.data.page,
                    settings: res.data.settings,
                    share_info: res.data.share_info,
                    title: res.data.title,
                    use_current_time: res.data.use_current_time,
                };
                createOrUpdateSetting(settingDat);
            }
        });
    }
};

const createHTMLRow = (setting) => {
    // TODO i18n: Shared, Private, btns
    const priorities = [5, 4, 3, 2, 1];
    let prioritySelection = '';
    priorities.forEach((val) => {
        const selected = setting.priority == val ? ' selected="selected"' : '';
        let label = `${val}`;
        if (val === 5) {
            label = '5 (High)';
        } else if (val === 1) {
            label = '1 (Low)';
        }
        prioritySelection += `<option value="${val}"${selected}>${label}</option>`;
    });
    const objTitlePage = objTitle ? objTitle[setting.page] : '';
    const pageTitle = objTitlePage ? objTitlePage.title : '';
    const htmlRow = pageTitle ? `<tr data-setting-id="${setting.id}">
        <td>${setting.share_info ? $(i18nEles.shared).text() : $(i18nEles.private).text()}</td>
        <td>
        	<select class="form-control" onchange="updateSettingPriority(this, ${setting.id})">
        		${prioritySelection}
			</select>
			<span class="hide">${setting.priority}</span>
		</td>
        <td class="col-3">${setting.title || ''}</td>
        <td class="text-center">${setting.created_by || ''}</td>
        <td class="col-date">${moment(setting.updated_at).format(DATE_FORMAT_WITHOUT_TZ) || ''}</td>
        <td class="action col-with-button">
        	<button name="showGraphNow" class="btn-success btn" onclick="goToSettingPage(${setting.id}, '${setting.page}')">${pageTitle}</button>
        	<span class="hide">${pageTitle}</span>
		</td>
        <td class="action col-with-button"><button class="btn-primary btn"
        	onclick="useUserSetting(${setting.id})"><i class="fas fa-file-import"></i></button></td>
        <td class="action col-with-button"><button class="btn-orange btn"
        	onclick="editSettings(${setting.id})"><i class="far fa-edit"></i></button></td>
        <td class="action col-with-button">
        	<button class="btn-danger btn"
        	onclick="bindDeleteUserSetting(this, ${setting.id})"><i class="fas fa-trash"></i></button></td>
        <td class="col-3">${setting.description || ''}</td>
    </tr>` : '';
    return htmlRow;
};

const settingDataTableInit = () => {
    $('#tblUserSetting').DataTable({
        retrieve: false,
        orderCellsTop: true,
        fixedHeader: true,
        paging: false,
        searching: false,
        info: false,
        initComplete() {
            $('.filterCol').on('keyup change clear search', function () {
                const colIdx = $(this).data('col-idx');
                const value = $(this).val();
                $('#tblUserSetting tbody tr').filter(function f() {
                    const cellDOM = $(this).find(`td:eq(${colIdx})`);
                    const selection = $(cellDOM).find('select')[0];
                    const colVal = selection ? $(selection).val() : $(cellDOM).text();
                    $(this).toggle(colVal.toLowerCase().indexOf(value) > -1);
                });
            });
        },
    });
};

const showUserSettingsToModal = (userSettings) => {
    const userSettingsTblBody = $('#tblUserSetting tbody'); // TODO add to a eles const
    userSettingsTblBody.empty();

    const rowHTMLs = [];
    const currentUser = localStorage.getItem('settingCommonUserName');
    for (const setting of userSettings) {
        if (setting.created_by === currentUser || setting.share_info) {
            const rowHTML = createHTMLRow(setting);
            rowHTMLs.push(rowHTML);
        }
    }
    userSettingsTblBody.append(rowHTMLs);

    settingDataTableInit();

    // right click for button
    $(settingModals.showGraphNow).on('contextmenu', (e) => {
        rightClickHandler(e, settingModals.menuExport);
        UserSettingExportInfo = e.currentTarget;
    });

    // right click for button
    $(settingModals.menuExport).on('mouseleave', (e) => {
        $(settingModals.menuExport).hide();
    });

    // right click for button
    $(settingModals.loadUserSettingLabel).on('contextmenu', (e) => {
        rightClickHandler(e, settingModals.menuImport);
    });

    // right click for button
    $(settingModals.menuImport).on('mouseleave', (e) => {
        $(settingModals.menuImport).hide();
    });
};

const bindDeleteUserSetting = (e, userSettingId) => {
    $('#delSettingConfirmed').attr('data-item-id', userSettingId);
    $('#deleteSettingConfirmModal').modal('show');
};

// eslint-disable-next-line no-unused-vars
const deleteUserSetting = (e) => {
    const userSettingId = $(e).attr('data-item-id');
    const settingRow = $('#tblUserSetting').find(`tr[data-setting-id=${userSettingId}]`)[0];
    fetch(`/histview2/api/setting/user_setting/${userSettingId}`, {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })
        .then((response) => {
        })
        .then(() => {
        })
        .catch(() => {
        });

    if (settingRow) {
        $('#tblUserSetting').DataTable().row(settingRow).remove();
    }
    $('#tblUserSetting').find(`tr[data-setting-id=${userSettingId}]`).remove();

    // reset state of bookmark
    if ($('#tblUserSetting>tbody').children().length === 0) {
        saveStateAndShowLabelSetting(null);
    }
};

const clearLoadingSetting = () => {
    localStorage.removeItem('loadingSetting');
};

const setExportMode = isExport => isExportMode = isExport;

const goToSettingPage = (userSettingId, settingPage, isImportMode = false) => {
    localStorage.setItem('loadingSetting', JSON.stringify({
        redirect: true,
        settingID: userSettingId,
        isExportMode,
        isImportMode,
    }));

    // reset debug mode
    setExportMode(false);

    if (settingPage) {
        window.location.replace(settingPage);
    }
};
const useUserSetting = (userSettingId = null, sharedSetting = null, onlyLoad = null) => {
    const reqHeaders = new Headers();
    reqHeaders.append('Content-Type', 'application/json');

    fetch('/histview2/api/setting/load_user_setting', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
            setting_id: userSettingId,
            dic_original_setting: originalUserSettingInfo,
            active_form: getShowFormId(),
            shared_user_setting: sharedSetting,
        }),
    })
        .then(response => response.json())
        .then((json) => {
            const userSetting = json.data;
            applyUserSetting(userSetting, onlyLoad);
        })
        .catch(error => console.log('error', error));
};

const useUserSettingOnLoad = () => {
    const reqHeaders = new Headers();
    reqHeaders.append('Content-Type', 'application/json');

    const page = window.location.pathname;
    fetch(`/histview2/api/setting/user_setting_page_top?page=${page}`, {
        method: 'GET',
        headers: reqHeaders,
    })
        .then(response => response.json())
        .then((json) => {
            const userSetting = json.data;
            applyUserSetting(userSetting);
        })
        .catch(error => console.log('error', error));
};

const showIndexInforBox = () => {
    const $xOptions = $('select[name=xOption]');
    if ($xOptions.val() === 'INDEX') {
        $('.index-inform-modal').addClass('show');
        // updateIndexInforTable();
    } else {
        $('.index-inform-modal').removeClass('show');
    }
};

const applyUserSetting = (userSetting, onlyLoad = null) => {
    // hide modal when click load button
    $(settingModals.loadSettingModal).modal('hide');

    if (isEmpty(userSetting)) return;

    let userInputs;
    if (typeof (userSetting.settings) === 'string') {
        userInputs = JSON.parse(userSetting.settings || '{}');
    } else {
        userInputs = userSetting.settings || {};
    }

    // load user setting to gui
    let loadFunc;
    for (const formId in userInputs) {
        if (onlyLoad) {
            loadFunc = saveLoadUserInput(onlyLoad);
        } else if (typeof (formId) === 'string') {
            loadFunc = saveLoadUserInput(`#${formId}`);
        }

        const settingData = userInputs[formId];
        // console.log(settingData);
        if (loadFunc && settingData) {
            loadFunc(true, false, settingData);
            break;
        }
    }

    try {
        showIndexInforBox();
    } catch (e) {
        console.log(e);
    }

    // show current loading setting label
    saveStateAndShowLabelSetting(userSetting);
};

// save current user setting on global variable, beside that it will show title & "Overwrite save" button on UI
const saveStateAndShowLabelSetting = (userSetting) => {
    currentLoadSetting = userSetting;
    let userSettingText = '';

    // show "overwrite save" button in case load config
    // show bookmark when setting label is empty. Otherwise
    if (currentLoadSetting) {
        if (userSetting.title) {
            userSettingText = `${$('#i18nLabelSetting').text()}: ${userSetting.title}`;
            // set current loading setting label
            $(settingModals.currentLoadSettingLbl).text(userSettingText);
            $(settingModals.currentLoadSettingLbl).attr('title', userSettingText);
            $(settingModals.overwriteSaveSettingBtn).show();
            $(settingModals.bookmarkBtn).hide();
        }
    } else {
        $(settingModals.overwriteSaveSettingBtn).hide();
        $(settingModals.bookmarkBtn).show();
    }
};

// eslint-disable-next-line no-unused-vars
const loadAllUserSetting = () => {
    // destroy existing datatable and not retrieve old data when user click to load settings
    if ($.fn.dataTable.isDataTable('#tblUserSetting')) {
        $('#tblUserSetting').DataTable().destroy();
    }

    const reqHeaders = new Headers();
    reqHeaders.append('Content-Type', 'application/json');

    fetch('/histview2/api/setting/user_settings', {
        method: 'GET',
        headers: reqHeaders,
    })
        .then(response => response.json())
        .then((json) => {
            const userSettings = json.data;
            showUserSettingsToModal(userSettings);
        })
        .catch(error => console.log('error', error));
};

const showSettingModal = (userSetting) => {
    // get all keys in setting modal
    const settingModalKeys = [];
    $.each($(settingModals.userSetting)[0].elements, (index, elem) => {
        $(elem).val();
        settingModalKeys.push($(elem).attr('name'));
    });

    Object.keys(userSetting).forEach((settingKey) => {
        const setting = userSetting[settingKey];
        if (settingModalKeys.includes(settingKey) && setting) {
            const settingInput = $(settingModals.userSetting)
                .find(`input[name="${settingKey}"], select[name="${settingKey}"]`);
            switch (settingInput.attr('type')) {
                case 'checkbox':
                    settingInput.prop('checked', true);
                    break;
                case 'select':
                    settingInput.prop('selected', true);
                    break;
                default:
                    settingInput.val(setting);
            }
        }
    });

    // assign setting
    previousSettingInfor = userSetting.settings || null;
    $(settingModals.loadSettingModal).modal('hide');
    $(settingModals.common).modal('show');
};

const editSettings = (userSettingId) => {
    $.get(`/histview2/api/setting/user_setting/${userSettingId}`, (res) => {
        if (res.status === 200) {
            showSettingModal(res.data);
        }
    });
};

const autoFillUserSetting = () => {
    const defaultTitle = `${document.title}_${moment().format('YYYYMMDD_HH:mm')}`;
    $('input[name=title]').val(defaultTitle);
    $('select[name=priority]').val(1);
};

const showOverwriteConfirmModel = () => {
    $(settingModals.overwriteConfirmation).modal('show');
};

const createOrUpdateSetting = (settingDat) => {
    $.ajax({
        url: '/histview2/api/setting/user_setting',
        data: JSON.stringify(settingDat),
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        success: (res) => {
            $(settingModals.confirmation).modal('hide');
            $(settingModals.common).modal('hide');
            saveStateAndShowLabelSetting(res.data);
        },
    });
};
const setModalOverlay = () => {
    $(document).on({
        'show.bs.modal': function () {
            const zIndex = 1040 + (10 * $('.modal:visible').length);
            $(this).css('z-index', zIndex);
            setTimeout(() => {
                $('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
            }, 0);
        },
        'hidden.bs.modal': function () {
            if ($('.modal:visible').length > 0) {
                // restore the modal-open class to the body element, so that scrolling works
                // properly after de-stacking a modal.
                setTimeout(() => {
                    $(document.body).addClass('modal-open');
                }, 0);
            }
        },
    }, '.modal');
    // $(document).on('show.bs.modal', '.modal', function (event) {
    // 	var zIndex = 1040 + (10 * $('.modal:visible').length);
    // 	$(this).css('z-index', zIndex);
    // 	setTimeout(function() {
    // 		$('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
    // 	}, 0);
    // });
};

const saveOriginalSetting = () => {
    const inputForms = $('form');
    const dicOutput = {};
    inputForms.each((i, form) => {
        const formId = form.getAttribute('id');
        const userInput = saveLoadUserInput(`#${formId}`);
        if (userInput) {
            dicOutput[formId] = userInput(false, false);
        }
    });

    return dicOutput;
};

const getSettingCommonInfo = () => {
    // retrieve data from setting forms
    const formSettingDat = {};
    mainFormSettings.each((i, form) => {
        const getFormSettings = saveLoadUserInput(`#${form.id}`);
        const settingDat = getFormSettings(false, false);
        formSettingDat[form.id] = settingDat;
    });

    // retrieve common information for setting
    const settingCommonArray = $(settingModals.userSetting).serializeArray();
    const settingCommonInfo = {};
    $.each(settingCommonArray, (i, input) => {
        settingCommonInfo[input.name] = input.value;
    });

    // remove id attribute if empty
    if (!settingCommonInfo.id) {
        delete settingCommonInfo.id;
    }

    if (!settingCommonInfo.page) {
        settingCommonInfo.page = window.location.pathname;
    }

    if (window.location.pathname === settingCommonInfo.page) {
        // assign settings and send to DB
        settingCommonInfo.settings = JSON.stringify(formSettingDat);
    } else {
        settingCommonInfo.settings = previousSettingInfor;
    }

    return settingCommonInfo;
};

const checkExistTitleSetting = (title) => {
    loadingShow(true);
    $.ajax({
        url: '/histview2/api/setting/check_exist_title_setting',
        data: JSON.stringify({ title }),
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        success: (data) => {
            if (data.is_exist) {
                displayRegisterMessage(settingModals.alertUserSettingErrorMsg, {
                    message: $('#i18nErrorSameTitleSetting').text(),
                    is_error: true,
                });
                return false;
            }
            $(settingModals.confirmation).modal('show');
        },
        error: (_res) => {
            loadingHide();
        },
    }).then(() => {
        loadingHide();
    });
};

$(document).ready(() => {
    // save user input
    const inputForms = $('form');
    const saveUserBtn = $('#saveUserBtn');
    const loadUserBtn = $('#loadUserBtn');
    if (inputForms.length > 0) {
        $(saveUserBtn).show();
        $(loadUserBtn).show();
    } else {
        $(saveUserBtn).hide();
        $(loadUserBtn).hide();
    }
    $(saveUserBtn).click(() => {
        inputForms.each((i, form) => {
            const userInput = saveLoadUserInput(`#${form.id}`, window.location.pathname);
            userInput(false);
        });
    });

    $(loadUserBtn).click(() => {
        inputForms.each((i, form) => {
            const userInput = saveLoadUserInput(`#${form.id}`, window.location.pathname);
            userInput();
        });
    });


    // save user setting to DB
    mainFormSettings = $(settingModals.mainSettingForm);

    // trigger to validate data input before saving user setting
    $(settingModals.saveSettingConfirmBtn).on('click', () => {
        // clear error message
        $(settingModals.alertUserSettingErrorMsg).css('display', 'none');
        checkExistTitleSetting($('input[name=title]').val());
        return false;
    });

    // trigger to save user setting
    $(settingModals.confirmBtn).on('click', () => {
        let invalidPage = false;
        Object.keys(saveSettingExceptionPages).forEach((k) => {
            if (window.location.pathname.includes(saveSettingExceptionPages[k])) {
                invalidPage = true;
            }
        });

        // return if invalidPage
        if (invalidPage) {
            return false;
        }

        // retrieve data from setting forms
        const settingCommonInfo = getSettingCommonInfo();

        // set userName in localStorage at first time
        getOrSetUserName(settingCommonInfo.created_by);
        createOrUpdateSetting(settingCommonInfo);
    });

    // trigger to overwrite save user setting
    $(settingModals.overwriteConfirmBtn).on('click', () => {
        // retrieve data from setting forms
        const settingCommonInfo = currentLoadSetting;
        const settingInfo = getSettingCommonInfo();
        settingCommonInfo.settings = settingInfo.settings;

        // set userName in localStorage at first time
        getOrSetUserName(settingCommonInfo.created_by);
        createOrUpdateSetting(settingCommonInfo);
    });

    // set userName for setting common modal
    $(settingModals.saveSettingBtn).on('click', () => {
        // clear error message
        $(settingModals.alertUserSettingErrorMsg).css('display', 'none');
        clearSettingID();
        updateUserNameForSettingModal();
    });

    setModalOverlay();

    const dragAreaCls = '.import-drag-area';
    const selectFileBtnId = '#importSelectFileBtn';
    const selectFileInputId = '#importSelectFileInput';
    genTriggerFileSetting(dragAreaCls, selectFileBtnId, selectFileInputId);
});

const showGraphWithDebugInfo = () => {
    // reset debug mode
    setExportMode(true);
    if (UserSettingExportInfo !== null) {
        $(UserSettingExportInfo).trigger('click');
    }
};

const openImportDialog = () => {
    $('#importForDebug').modal('show');
};
