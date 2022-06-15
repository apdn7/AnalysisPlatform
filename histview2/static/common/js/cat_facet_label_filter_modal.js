/* eslint-disable arrow-body-style */
/* eslint-disable
no-unused-vars,
camelcase,
arrow-parens,
object-curly-newline,
no-use-before-define,
prefer-arrow-callback,
no-restricted-syntax */

let catFilter = {};
let globalTypingCount = 0;
const summaries = {};
let isSort = 0; // 0:no sort; 1: asc; 2: desc ,3: checked asc, 4: checked desc
let preparedCatBox = [];
let preparedCategories = [];
let dicCheckboxes = {};
let dicChecked = {};
let dicConfirmed = {};
let dicEnter = {};
let currentRegexVal = '';

const modalEls = {
    okBtn: $('#catFilterSubmit'),
    modal: $('#catFilterModal'),
    search: $('#catFilterSearch'),
    setBtn: $('#catFilterSet'),
    resetBtn: $('#catFilterReset'),
    cancelBtn: $('#catFilterCancel'),
    catExpBox: $('#catExpBox'),
    catExpBoxTitle: $('#catExpBoxTitle'),
    categoriesBox: $('#categoriesBox'),
    categoriesBoxTitle: $('#categoriesBoxTitle'),
    divBox: $('#divBox'),
    divBoxTitle: $('#divTitle'),
    colorBox: $('#colorBox'),
    colorBoxTitle: $('#colorTitle'),
    sortBtn: $('#filterSortBtn'),
};

function fillDataToFilterModal(catExpBox, categories, div, color, callback) {
    let catHtml = renderFilterHtml(catExpBox);
    let categoryHtml = renderFilterHtml(categories);
    const divHtml = renderFilterHtml(div);
    const colorHtml = renderFilterHtml(color);
    init();

    modalEls.okBtn.unbind('click');
    modalEls.okBtn.on('click', () => {
        modalEls.modal.modal('toggle');
        dicConfirmed = copyDict(dicChecked);
        callback();
    });

    modalEls.search.unbind('keypress input');
    modalEls.search.on('keypress input', function (event) {
        globalTypingCount++;
        const currentTypingCount = globalTypingCount;

        if (event.keyCode === 13) {
            setTimeout(() => {
                regexEnter(currentTypingCount);
                event.preventDefault();
            }, 500);
            event.preventDefault();
        } else {
            setTimeout(() => {
                currentRegexVal = this.value;
                searchRegEx(currentRegexVal, currentTypingCount);
            }, 500);
        }
    });

    modalEls.setBtn.unbind('click');
    modalEls.setBtn.click(() => {
        setAndResetFilter(true);
    });

    modalEls.resetBtn.unbind('click');
    modalEls.resetBtn.click(() => {
        setAndResetFilter(false);
    });

    $('.show-detail').unbind('click');
    $('.show-detail').click(function () {
        const selectedColumnID = $(this).attr('data-id');
        modalEls.modal.modal('toggle');
        prepareDuplicateColumnID(selectedColumnID);
        filterPaging(dicCheckboxes);

        setTimeout(() => {
            showCheckStatus(dicConfirmed);
            sortCheckboxes();
            checkboxOnChange();
            onChangeAllOption();
        }, 500);
    });


    // mouseover 2 seconds
    let timeoutId = null;
    $('.show-detail').hover(function () {
        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                timeoutId = null;
                const selectedColumnID = $(this).attr('data-id');
                modalEls.modal.modal('toggle');
                prepareDuplicateColumnID(selectedColumnID);
                filterPaging(dicCheckboxes);

                setTimeout(() => {
                    showCheckStatus(dicConfirmed);
                    sortCheckboxes();
                    checkboxOnChange();
                    onChangeAllOption();
                }, 500);
            }, 2000);
        }
    }, function () {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
    });

    // reset temporary checked
    modalEls.cancelBtn.unbind('click');
    modalEls.cancelBtn.click(() => {
        modalEls.search.val('');
        dicChecked = copyDict(dicConfirmed);
    });

    // Sort
    modalEls.sortBtn.unbind('click');
    modalEls.sortBtn.click(() => {
        const dicTarget = Object.keys(dicEnter).length === 0 ? dicCheckboxes : dicEnter;
        let dicCheckboxesSorted;
        isSort = (isSort + 1) % 5;
        if (isSort) {
            dicCheckboxesSorted = sortCate(dicTarget, isSort);
        } else {
            dicCheckboxesSorted = dicTarget;
        }
        filterPaging(dicCheckboxesSorted);
        setTimeout(() => {
            showCheckStatus(dicChecked);
            sortCheckboxes();
            checkboxOnChange();
            onChangeAllOption();
        }, 500);
    });

    function init() {
        showTitle(catExpBox, categories, div, color);
        modalEls.catExpBox.html(catHtml);
        modalEls.categoriesBox.html(categoryHtml);
        modalEls.divBox.html(divHtml);
        modalEls.colorBox.html(colorHtml);
        moveCheckedLabelsToTop();

        initSortCard();
    }

    function initSortCard() {
        modalEls.catExpBox.sortable({
            axis: 'x',
        });

        modalEls.categoriesBox.sortable({
            axis: 'x',
        });
    }

    function addHighLightToSelectedColumn(selectedColumnID) {
        if (selectedColumnID) {
            if (selectedColumnID === 'color') {
                modalEls.colorBox.find('.filter-data .column-datas').addClass('active');
            } else if (selectedColumnID === 'x') {
                modalEls.categoriesBox.find('.filter-data .column-datas')[0].classList.add('active');
            } else if (selectedColumnID === 'y') {
                modalEls.categoriesBox.find('.filter-data .column-datas')[1].classList.add('active');
            } else {
                modalEls.categoriesBox.find(`.filter-data .column-datas[data-id=${selectedColumnID}]`).addClass('active');
            }
        } else {
            modalEls.catExpBox.find('.filter-data .column-datas').addClass('active');
        }
    }

    function prepareDuplicateColumnID(selectedColumnID) {
        preparedCatBox = _.cloneDeep(catExpBox);
        preparedCategories = _.cloneDeep(categories);
        if (selectedColumnID) {
            preparedCatBox.forEach((cat, i) => {
                if (Number(selectedColumnID) === cat.column_id) {
                    preparedCatBox[i].unique_categories = [];
                    preparedCatBox[i].isDisabled = true;
                } else {
                    preparedCategories.forEach((cat2, i2) => {
                        if (cat.column_id !== Number(selectedColumnID) && cat.column_id === cat2.column_id) {
                            preparedCategories[i2].unique_categories = [];
                            preparedCategories[i2].isDisabled = true;
                        }
                    });
                }
            });
        } else {
            preparedCatBox.forEach((cat) => {
                preparedCategories.forEach((cat2, i) => {
                    if (cat.column_id === cat2.column_id) {
                        preparedCategories[i].unique_categories = [];
                        preparedCategories[i].isDisabled = true;
                    }
                });
            });
        }

        catHtml = renderFilterHtml(preparedCatBox);
        categoryHtml = renderFilterHtml(preparedCategories);
        init();
        addHighLightToSelectedColumn(selectedColumnID);
    }
}

function moveCheckedLabelsToTop() {
    $('.column-datas').mouseleave(function () {
        const ischanged = sortHtmlElements($(this), true);
        if (ischanged) {
            $(this).scrollTop(0);
        }
    });
}

function getSortedCatExpAndCategories() {
    const catExp = [];
    let categories = null;
    const cal = {};
    modalEls.catExpBox.find('.column-datas').each((i, el) => {
        catExp.push(Number($(el).attr('data-id')));
    });
    modalEls.categoriesBox.find('.column-datas').each((i, el) => {
        const procId = $(el).attr('data-proc-id');
        const columnId = $(el).attr('data-id');
        if (!cal[procId]) {
            cal[procId] = [columnId];
        } else {
            cal[procId].push(columnId);
        }
    });

    categories = Object.keys(cal).map(key => {
        return {
            end_proc_cate: key, GET02_CATE_SELECT: cal[key],
        };
    });
    return [catExp, categories];
}

function setAndResetFilter(isSet = true) {
    // ON SCREEN
    const targets = getHtmlCheckboxes();
    const regex = new RegExp(currentRegexVal, 'i');
    targets.filter(function () {
        const val = $(this).val();
        if (regex.test(val)) {
            $(this).prop('checked', isSet);
        }
    });

    // ON ALL VALUES
    if (isSet) {
        for (const key of Object.keys(dicCheckboxes)) {
            const vals = searchRegexOnList(currentRegexVal, dicCheckboxes[key]);
            dicChecked[key] = [...new Set([...dicChecked[key], ...vals])];
        }
    } else {
        for (const key of Object.keys(dicChecked)) {
            dicChecked[key] = searchRegexOnList(currentRegexVal, dicChecked[key], true);
        }
    }
}

function showTitle(catExpBox, categories, div, color) {
    if (catExpBox.length === 0) {
        modalEls.catExpBoxTitle.parent().hide();
    } else {
        modalEls.catExpBoxTitle.parent().show();
    }

    if (categories.length === 0) {
        modalEls.categoriesBoxTitle.parent().hide();
    } else {
        modalEls.categoriesBoxTitle.parent().show();
    }

    if (div.length === 0) {
        modalEls.divBoxTitle.parent().hide();
    } else {
        modalEls.divBoxTitle.parent().show();
    }

    if (color.length === 0) {
        modalEls.colorBoxTitle.parent().hide();
    } else {
        modalEls.colorBoxTitle.parent().show();
    }
}

function resetCheckedCats() {
    catFilter = {};
}

function renderFilterHtml(filterData) {
    return filterData.map(cat => {
        const { unique_categories, column_id, column_name, proc_master_name, isDisabled, proc_name } = cat;
        let divColId = '';
        let divPagingId = '';
        if (!isDisabled) {
            summaries[column_id] = {
                total: unique_categories.length,
            };
            divColId = `id="div_cat_filter_${column_id}"`;
            divPagingId = `<div id="paging${column_id}" style="padding-top: 10px"></div>`;
        }
        divColId = `<div ${divColId} class="column-datas" data-id="${column_id}" data-proc-id="${proc_name}"> </div>`;

        return `<div class="d-flex flex-column filter-data">
                <div class="column-name">
                    <span class="d-inline-block" title="${proc_master_name}">${proc_master_name}</span>
                    <span class="d-inline-block" title="${column_name}">${column_name}</span>
                </div>
                ${divColId}
                ${divPagingId}
            </div>`;
    });
}

function transformCatFilterParams(formData) {
    const [catExp, categories] = getSortedCatExpAndCategories();
    formData.set('dic_cat_filters', JSON.stringify(dicConfirmed));
    formData.set('temp_cat_exp', JSON.stringify(catExp));
    formData.set('temp_cat_procs', JSON.stringify(categories));
    formData.delete('cat_filter');

    return formData;
}

function unCheckAll(id) {
    $(`#cat-filter-${id}`).prop('checked', false);
}

function checkAllWhenAllLabelIsChecked(id) {
    if (summaries[id].total !== 0) {
        if ($(`.cat-filter-${id}:checked`).length === summaries[id].total) {
            $(`#cat-filter-${id}:not(.ignore)`).prop('checked', true);
        } else {
            $(`#cat-filter-${id}:not(.ignore)`).prop('checked', false);
        }
    }
}

function searchRegEx(regexVal, typingCount = null, parentEle = null) {
    if (typingCount !== null && typingCount < globalTypingCount) {
        return;
    }
    const targets = getHtmlCheckboxes(parentEle);
    const regex = new RegExp(regexVal, 'i');
    targets.filter(function () {
        const val = $(this).val();
        if (regex.test(val)) {
            $(this).removeClass('gray');
        } else {
            $(this).addClass('gray');
        }
    });
}

const genCheckBox = (columnId, value) => {
    const id = `cat-filter-${columnId}-${value}`;
    return `<div class="p-1 list-group-item">
             <div class="custom-control custom-checkbox custom-control-inline mr-0">
                <input type="checkbox" name="cat_filter" value="${value}" data-column="${columnId}"
                    class="custom-control-input already-convert-hankaku cat-filter-${columnId} ${value}" id="${id}">
                <label class="custom-control-label" for="${id}"> ${value} </label>
                </div>
            </div>`;
};

const pagination = (columnId, dataSource) => {
    const dataContainIdPrefix = 'div_cat_filter_';
    const pagingIdPrefix = 'paging';
    const container = $(`#${pagingIdPrefix}${columnId}`);
    const dataContainerId = `#${dataContainIdPrefix}${columnId}`;
    const dataContainer = $(dataContainerId);
    const allCheckbox = `<div class="p-1">
                            <div class="custom-control custom-checkbox custom-control-inline mr-0">
                                <input type="checkbox" name="cat_filter_all" value="all" data-column="${columnId}"
                                    class="custom-control-input already-convert-hankaku" id="cat-filter-${columnId}">
                                    <label class="custom-control-label" for="cat-filter-${columnId}"> All </label>
                            </div>
                         </div>`;
    const pageSize = 20;
    container.pagination({
        dataSource,
        pageSize,
        showNavigator: true,
        showPageNumbers: false,
        callback(data, _) {
            const html = data.map(value => genCheckBox(columnId, value));
            dataContainer.html(allCheckbox + html.join(' '));
        },
        afterPaging() {
            searchRegEx(currentRegexVal, null, dataContainerId);
            showCheckStatus(dicChecked, dataContainerId);
            sortCheckboxes();
            checkboxOnChange();
            onChangeAllOption();
        },
    });
};

const filterPaging = (dicBoxWithOrder) => {
    setTimeout(() => {
        for (const [key, vals] of Object.entries(dicBoxWithOrder)) {
            pagination(key, vals);
        }
    }, 200);
};

const searchRegexOnList = (searchVal, targets, isGetUnmatched = false) => {
    // use when Set and Reset
    const matchedVals = [];
    const regex = new RegExp(searchVal, 'i');
    for (const val of targets) {
        const isMatched = regex.test(val);
        if (isGetUnmatched) {
            if (!isMatched) {
                matchedVals.push(val);
            }
        } else if (isMatched) {
            matchedVals.push(val);
        }
    }
    return matchedVals;
};

const copyDict = (dicTarget) => {
    const dicVals = {};
    for (const [key, vals] of Object.entries(dicTarget)) {
        dicVals[key] = [...vals];
    }

    return dicVals;
};

const showCheckStatus = (dicTarget, parentEle = null) => {
    const targets = getHtmlCheckboxes(parentEle);

    targets.filter(function () {
        // const val = !isNaN(Number($(this).val())) ? Number($(this).val()) : $(this).val();
        const val = $(this).val();
        const columnId = Number($(this).attr('data-column'));
        if (dicTarget[columnId].includes(val)) {
            $(this).prop('checked', true);
        }
    });
};

const regexEnter = (typingCount) => {
    if (typingCount !== null && typingCount < globalTypingCount) {
        return;
    }

    for (const key of Object.keys(dicCheckboxes)) {
        const vals = searchRegexOnList(currentRegexVal, dicCheckboxes[key]);
        dicEnter[key] = vals;
    }
    filterPaging(dicEnter);

    setTimeout(() => {
        showCheckStatus(dicChecked);
        sortCheckboxes();
        checkboxOnChange();
        onChangeAllOption();
    }, 500);
};

const sortCheckedAsc = (a, b, checkedVals) => (checkedVals.indexOf(a) < checkedVals.indexOf(b) ? 1 : -1);
const sortCheckedDesc = (a, b, checkedVals) => (checkedVals.indexOf(a) > checkedVals.indexOf(b) ? 1 : -1);

const sortCate = (dicTarget, sortType) => {
    const dicOutput = {};
    for (const [key, vals] of Object.entries(dicTarget)) {
        let sortedVals = [];
        if (sortType === 1) {
            sortedVals = [...vals].sort();
        } else if (sortType === 2) {
            sortedVals = [...vals].sort().reverse();
        } else if (sortType === 3) {
            const checkedVals = dicChecked[key];
            sortedVals = [...vals].sort((a, b) => sortCheckedAsc(a, b, checkedVals));
        } else if (sortType === 4) {
            const checkedVals = dicChecked[key];
            sortedVals = [...vals].sort((a, b) => sortCheckedDesc(a, b, checkedVals));
        }
        dicOutput[key] = sortedVals;
    }
    return dicOutput;
};

const clearGlobalDict = () => {
    dicCheckboxes = {};
    dicChecked = {};
    dicConfirmed = {};
    dicEnter = {};
};

const initGlobalDict = (filterData) => {
    for (const cat of filterData) {
        const columnId = cat.column_id;
        dicCheckboxes[columnId] = cat.unique_categories;
        dicChecked[columnId] = [];
        dicConfirmed[columnId] = [];
    }
};

const sortCheckboxes = () => {
    $('.column-datas').each((i, el) => {
        sortHtmlElements($(el), true);
    });
};

const addValToDicChecked = (columnId, val, isChecked) => {
    if (val) {
        if (isChecked) {
            if (!dicChecked[columnId].includes(val)) {
                dicChecked[columnId].push(val);
            }
        } else {
            const idx = dicChecked[columnId].indexOf(val);
            if (idx >= 0) {
                dicChecked[columnId].splice(idx, 1);
            }
        }
    }
};

const onChangeAllOption = () => {
    const allSelectBoxes = $('[name="cat_filter_all"]');
    const dataContainIdPrefix = 'div_cat_filter_';
    allSelectBoxes.on('change', function () {
        const columnId = Number($(this).attr('data-column'));
        const dataContainerId = `#${dataContainIdPrefix}${columnId}`;
        const selectBoxes = getHtmlCheckboxes(dataContainerId);
        selectBoxes.prop('checked', this.checked);
        for (const ele of selectBoxes) {
            const val = $(ele).val();
            // const val = !isNaN(Number($(ele).val())) ? Number($(ele).val()) : $(ele).val();
            const isChecked = $(ele).is(':checked');
            addValToDicChecked(columnId, val, isChecked);
        }
    });
};


const checkboxOnChange = (parentEle = null) => {
    const targets = getHtmlCheckboxes(parentEle);
    targets.on('change', function () {
        // const val = !isNaN(Number($(this).val())) ? Number($(this).val()) : $(this).val();
        const val = $(this).val();
        const columnId = Number($(this).attr('data-column'));
        const isChecked = $(this).is(':checked');
        addValToDicChecked(columnId, val, isChecked);
        unCheckAll(columnId);
        checkAllWhenAllLabelIsChecked(columnId);
    });
};

const getHtmlCheckboxes = (parentEle = null) => {
    let targets = null;
    if (parentEle === null) {
        targets = $('[name="cat_filter"]');
    } else {
        targets = $(`${parentEle} [name="cat_filter"]`);
    }

    return targets;
};
