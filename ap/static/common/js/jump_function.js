const JUMP_API = '/ap/api/common/jump_cfg';

const PAGES = [
    'fpp',
    'stp',
    'rlp',
    'msp',
    'chm',
    'scp',
    'agp',
    'skd',
    'pcp',
    'gl',
    'pca',
    'hmp',
];

const PAGE_NAME = {
    fpp: 'fpp',
    stp: 'stp',
    rlp: 'rlp',
    msp: 'msp',
    chm: 'chm',
    scp: 'scp',
    agp: 'agp',
    skd: 'skd',
    pcp: 'pcp',
    gl: 'gl',
    pca: 'pca',
    hmp: 'hmp',
};

const MAX_JUMP_SENSOR_NUMBER = 20;
const jumpEls = {
    jumpModal: '#jumpModal',
    recommendedId: '#recommendedList',
    allList: '#jumpAllList',
    jumpOkButton: '#jumpOKButton',
    pageItem: '.jump-page-list .tile-item',
    jumpTblID: '#jumpSensorTbl',
    jumpTblBody: '#jumpSensorTbl tbody',
    jumpTblBodyTr: '#jumpSensorTbl tbody tr',
    jumpVariableSetting: '#jumpVariableSetting',
    jumpByEmdDf: '#jumpByEmd',
    GUIForm: '.GUIForm',
    jumpErrEle: '#jumpAlertMsg',
    jumpWithoutTargetPage: '#i18nJumpWithoutTargetPageMsg',
    jumpWithDfMode: '#i18nJumpWithDfModeMsg',
    jumpObjectiveEls:
        '#jumpSensorTbl tbody tr input[type=radio][name=objective_var]',
    jumpVariableEls: '#jumpSensorTbl tbody tr input[type=checkbox]',
    jumpSelectAllCheckbox: '#jumpSelectAllSensor',
    autoSelectedColumn: '#jumpAutoSelectedItems',
    searchInput: '#jumpSearchInput',
    searchSetBtn: '#jumpSetBtn',
    searchResetBtn: '#jumpResetBtn',
    totalCheckedColumn: '#jumpTotalCheckedColumn',
    totalColumns: '#jumpTotalColumns',
    tdOrders: '#jumpSensorTbl tbody tr td.jump-order',
    checkboxOdfSetting: '#useOdfSettingCheckbox',
};

const goToFromJumpFunction = 'from_jump_func';
const sortedColumnsKey = 'sortedColumnsKey';
let divideOption = '';
let dumpedUserSetting = [];
let jumpKey = '';
let noneObjective = false;
let isCopyFromJumpModel = false;

const MAX_SENSOR_NUMBER = {
    fpp: 20,
    stp: 8,
    rlp: 20,
    agp: 18,
    pca: 60,
    gl: 60,
    skd: 512,
    chm: 18,
    msp: 64,
    pcp: 60,
    scp: 2,
};

const HAS_OBJECTIVE_PAGE = ['skd', 'pcp', 'gl'];

const ALL_DIVISION = {
    stp: {
        all: ['var', 'cyclicTerm', 'directTerm'],
        default: 'var',
    },
    rlp: {
        all: ['category', 'cyclicTerm', 'directTerm'],
        default: 'cyclicTerm',
    },
    scp: {
        all: ['category', 'cyclicTerm', 'directTerm', 'dataNumberTerm'],
        default: 'category',
    },
    agp: {
        all: [
            'category',
            'cyclicTerm',
            'directTerm',
            'dataNumberTerm',
            'cyclicCalender',
        ],
        default: 'cyclicCalender',
    },
    hmp: {
        all: ['category', 'cyclicTerm', 'directTerm', 'dataNumberTerm'],
        default: 'category',
    },
};

const TRANSFORM_AGG_TO_FILTER = {
    page: ['hmp'],
    agg_name: ['function_real', 'function_cate'],
};

$(() => {
    initCommonSearchInput($(jumpEls.searchInput));
    // Handler set search input button
    $(jumpEls.searchSetBtn).on('click', function () {
        const variableInput = $(jumpEls.jumpTblBody).find(
            'tr:not(.gray) input[type=checkbox]:visible:not(:checked)',
        );
        updateLatestSortColByRowElems(
            variableInput.closest('tr').toArray(),
            [],
        );
        variableInput.prop('checked', true);
        handleSortVariableNameByCheckbox();
        updatePriority(jumpEls.jumpTblID);
        updateOverItemsColor(jumpEls.jumpTblID);
        updateJumpStatus();
    });
    $(jumpEls.searchResetBtn).on('click', function () {
        const variableInput = $(jumpEls.jumpTblBody).find(
            'tr:not(.gray) input[type=checkbox]:visible',
        );
        const objectiveInput = $(jumpEls.jumpTblBody).find(
            'tr:not(.gray) input[type=radio]:visible',
        );
        updateLatestSortColByRowElems(
            [],
            variableInput.closest('tr').toArray(),
        );
        variableInput.prop('checked', false);
        objectiveInput.prop('checked', false);
        validateJumpSkdObjective();
        handleSortVariableNameByCheckbox();
        updatePriority(jumpEls.jumpTblID);
        updateOverItemsColor(jumpEls.jumpTblID);
        updateJumpStatus();
    });
});

const showJumpModal = async () => {
    // reset jump err message
    resetJumpErrMsg();
    const page = getCurrentPage();
    const isSkDPage = page === 'skd';
    const isSkDSelectChecked = $(jumpEls.jumpVariableSetting).prop('checked');
    bindVariableOrderingToModal(isSkDPage && isSkDSelectChecked, !isSkDPage);
    $(jumpEls.jumpModal).modal('show');
    showOptionalCheckbox(page);
    const res = await getJumpPages(page);
    loadJumpPages(res);

    $(jumpEls.jumpByEmdDf).prop('checked', true);
    $(`${jumpEls.pageItem}:first`).trigger('click'); // Auto select to first graph
};

const showOptionalCheckbox = (page) => {
    $('.jump-check-box-option').find('input').prop('disabled', true);
    $('.jump-check-box-option').hide();
    $(`.jump-check-box-option[data-for=${page}]`)
        .find('input')
        .prop('disabled', false);
    $(`.jump-check-box-option[data-for=${page}]`).show();
};

const getJumpPages = async (page) => {
    if (!page) return {};
    const res = await fetchData(`${JUMP_API}/${page}`, {}, 'GET');
    return res;
};

const resetJumpErrMsg = () => {
    // reset error message if existing
    $(jumpEls.jumpErrEle).find('button').click();
};
const getCurrentPage = () => {
    const path = window.location.pathname;
    for (const page of PAGES) {
        if (path.includes(page)) return page;
    }

    return null;
};

const generatePageItem = (page, pageObj, parentDivId = null) => {
    const { hover, link_address, png_path, title } = pageObj;
    const shownHover = hover.replaceAll('"', '&quot;');
    const html = `
        <div data-target-page="${page}" data-url="${link_address}" class="tile-item">
            <div class="tile-content" title="${shownHover}">
                <div class="tile-thumb"><img src="/ap/tile_interface/resources/${png_path}"></div>
                <div class="tile-title">
                    <h5><a class="link-address" href="${link_address}">${title}</a></h5>
                </div>
            </div>
        </div>
    `;

    if (parentDivId) {
        $(parentDivId).append(html);
    }
};

const loadJumpPages = (res) => {
    const { all, master, recommended, unavailable } = res;

    $(jumpEls.recommendedId).empty();
    $(jumpEls.allList).empty();

    for (const page of recommended) {
        const pageObj = master[page];
        generatePageItem(page, pageObj, jumpEls.recommendedId);
    }

    for (const page of all) {
        if (unavailable.includes(page)) {
            continue;
        }
        const pageObj = master[page];
        generatePageItem(page, pageObj, jumpEls.allList);
    }

    $(jumpEls.pageItem).off('click', handleOnClickPage);
    $(jumpEls.pageItem).on('click', handleOnClickPage);

    $(jumpEls.jumpOkButton).off('click', handleClickOKJumpButton);
    $(jumpEls.jumpOkButton).on('click', handleClickOKJumpButton);
    $(jumpEls.searchInput).on('keypress input', searchJumpInputHandler);
};

const handleOnClickPage = (e) => {
    e.preventDefault();
    const _this = $(e.currentTarget);
    const objectiveIdVal = $(jumpEls.jumpTblBody)
        .find('input[name=objective_var]:checked')
        .attr('id');
    $('.jump-page-list .tile-item').removeClass('active');
    _this.addClass('active');
    $(jumpEls.autoSelectedColumn).prop('checked', true);
    noneObjective = false;
    updateVariableStatusJumpPage();
    updateObjectiveForTargetJumpPage();
    updateOverItemsColor(jumpEls.jumpTblID);
    resetJumpErrMsg();
    validateJumpSkdObjective();
};

const validateJumpSkdObjective = () => {
    const targetPage = $(`${jumpEls.pageItem}.active`).attr('data-target-page');
    const targetPageHasObjective = HAS_OBJECTIVE_PAGE.includes(targetPage);
    const objectiveVal = $(`${jumpEls.jumpObjectiveEls}:checked`).val();
    if (targetPageHasObjective && !objectiveVal) {
        const text = $('#i18nJumpWithoutObjectiveVariableMsg').text();
        showErrorMsg(text);
    } else {
        resetJumpErrMsg();
    }
    $(jumpEls.jumpOkButton).prop(
        'disabled',
        targetPageHasObjective && !objectiveVal,
    );
};

const addEventChangeVariableOrObjective = () => {
    $(`${jumpEls.jumpObjectiveEls}, ${jumpEls.jumpVariableEls}`)
        .off('click', validateJumpSkdObjective)
        .on('click', validateJumpSkdObjective);
};

const updateOverItemsColor = (tableID) => {
    const maxJumpSensorNumber =
        MAX_SENSOR_NUMBER[getTargetPage()[0]] || MAX_JUMP_SENSOR_NUMBER;
    $(`${tableID} tbody tr`).each((rowIdx, row) => {
        $(row).removeClass('over-lim-item');
        if (rowIdx + 1 > maxJumpSensorNumber) {
            $(row).addClass('over-lim-item');
        }
    });
};

const updateObjectiveForTargetJumpPage = () => {
    const targetPage = getTargetPage()[0];
    const targetPageHasObjective = HAS_OBJECTIVE_PAGE.includes(targetPage);
    const objectiveElem = $(
        `${jumpEls.jumpTblBody} tr input[type=radio][name=objective_var]`,
    );
    if (targetPageHasObjective) {
        enableJumpObjective(objectiveElem);
    } else {
        disableJumpObjective(objectiveElem);
    }
};

const disableJumpObjective = (objectiveElem) => {
    objectiveElem.prop('checked', '');
    objectiveElem.prop('disabled', true);
};

const enableJumpObjective = (objectiveElem) => {
    objectiveElem.prop({ checked: '', disabled: false });
    const currentTraceDat = graphStore.getTraceData();
    const objectiveVal = currentTraceDat.COMMON.objectiveVar
        ? Number(currentTraceDat.COMMON.objectiveVar[0])
        : undefined;
    const currentPageObjectiveVal = $(
        `${formElements.endProcItems} input[name=objectiveVar]:checked`,
    );
    const isPageJumpToHasObjective = HAS_OBJECTIVE_PAGE.includes(
        getTargetPage()[0],
    );
    const elemObjectiveVal = jumpEls.jumpObjectiveEls;
    if (isPageJumpToHasObjective && !noneObjective) {
        if (objectiveVal && currentPageObjectiveVal.length) {
            $(`${elemObjectiveVal}[value=${objectiveVal}]`).prop(
                'checked',
                true,
            );
        }
    } else {
        if (objectiveVal && currentPageObjectiveVal.length) {
            $(`${elemObjectiveVal}[value=${objectiveVal}]`).prop(
                'checked',
                true,
            );
        } else {
            if (!noneObjective) {
                $(`${elemObjectiveVal}:first`).prop('checked', true);
            }
            $(`${elemObjectiveVal}[value=${objectiveVal}]`).prop(
                'checked',
                true,
            );
        }
    }
};

const bindChangeVariableOrderingSKD = (e) => {
    const changeStatus = $(e).prop('checked');
    bindVariableOrderingToModal(changeStatus);
};
const genColTypeForJumpTbl = (variable) => {
    let colType = dataTypeShort(variable);
    if (
        variable.name.includes(COMMON_CONSTANT.NG_RATE_NAME) ||
        variable.name.includes(COMMON_CONSTANT.EMD_DRIFT_NAME) ||
        variable.name.includes(COMMON_CONSTANT.EMD_DIFF_NAME)
    ) {
        colType = DataTypes.REAL.short;
    }
    return colType;
};
const buildJumpTbl = (varOrdering, dfMode = true) => {
    // update checkbox status
    if (varOrdering.ordering.length) {
        $(jumpEls.jumpTblBody).html('');
        let tblContent = '';
        varOrdering.ordering.forEach((variable, i) => {
            const objectiveChecked = checkedDefaultJumpObjective(
                i,
                variable.id,
            );
            const variableChecked = checkedJumpVariableByLatestSortCol(
                variable.id,
                varOrdering.orderingID,
            );
            tblContent += `<tr data-proc-id="${variable.proc_id}"
                data-col-id="${variable.id}" data-type="${DataTypes[variable.type].short}"
                data-org-col-id="${variable.org_id || variable.id}">
                <td style="width: 30px">
                    <div class="custom-control custom-checkbox">
                        <input type="checkbox" class="custom-control-input" id="variable_${variable.id}"
                            ${variableChecked}>
                        <label class="custom-control-label" for="variable_${variable.id}"></label>
                    </div>
                </td>
                <td style="width: 30px">
                    <div class="custom-control custom-radio">
                        <input type="radio" id="objective_${variable.id}" name="objective_var" 
                            class="custom-control-input" value="${variable.id}"
                            ${objectiveChecked}>
                        <label class="custom-control-label" for="objective_${variable.id}"></label>
                    </div>
                </td>
                <td class="jump-order">${i + 1}</td>
                <td style="text-align: left">${variable.proc_name}</td>
                <td style="text-align: left">${variable.name}</td>
                <td>${genColTypeForJumpTbl(variable)}</td>
            </tr>`;
        });
        $(jumpEls.jumpTblBody).html(tblContent);
        updateEventChangeVariableNameJump(varOrdering);
        updateOverItemsColor(jumpEls.jumpTblID);
        validateJumpSkdObjective();
        addEventChangeVariableOrObjective();
        updateObjectiveForTargetJumpPage();
        updateJumpStatus();
        $(jumpEls.jumpTblBody).sortable({
            helper: dragDropRowInTable.fixHelper,
            update: () => {
                updatePriority(jumpEls.jumpTblID);
                updateOverItemsColor(jumpEls.jumpTblID);
            },
        });
    }
};

const checkedDefaultJumpObjective = (rowIndex, variableId) => {
    const currentPage = getCurrentPage();
    const targetPage = getTargetPage()[0];
    const isJumpToSkd = targetPage === PAGE_NAME.skd;
    const currentTrace = graphStore.traceDataResult;
    const objectiveVariable = currentTrace.COMMON.objectiveVar
        ? Number(currentTrace.COMMON.objectiveVar[0])
        : undefined;
    const currentPageHasObjective = HAS_OBJECTIVE_PAGE.includes(currentPage);
    const currentPageObjectiveVal = $(
        `${formElements.endProcItems} input[name=objectiveVar]:checked`,
    );
    if (
        !isJumpToSkd &&
        (!currentPageHasObjective || !currentPageObjectiveVal.length)
    ) {
        return !rowIndex ? ' checked=checked' : '';
    }
    if (objectiveVariable && currentPageObjectiveVal.length) {
        return objectiveVariable === variableId ? ' checked=checked' : '';
    }
    return '';
};

const checkedJumpVariableByLatestSortCol = (variableId, ordering) => {
    if (ordering.find((colId) => colId === variableId)) {
        return ' checked=checked';
    }
    return '';
};

const updateVariableStatusJumpPage = () => {
    const targetPage = getTargetPage()[0];
    const currentPage = getCurrentPage();
    const elemsVariableCheckBox = $(
        `${jumpEls.jumpTblBody} tr input[type=checkbox]`,
    );
    // Check all checkboxes by default when jumping to SkD
    if (targetPage === PAGE_NAME.skd) {
        elemsVariableCheckBox.prop('checked', true);
        updateJumpStatus();
    } else {
        let ordering = getVariableOrderingFromPage(currentPage);
        elemsVariableCheckBox.prop('checked', false);
        ordering.orderingID.forEach(function (orderingId) {
            $(
                `${jumpEls.jumpTblBody} tr[data-col-id=${orderingId}] input[type=checkbox]`,
            ).prop('checked', true);
        });
        latestSortColIdsJumpPage = [...latestSortColIds];
        buildJumpTbl(ordering);
    }
    const elemTrVariableChecked = $(`${jumpEls.jumpVariableEls}:checked`)
        .closest('tr')
        .toArray();
    latestSortColIdsJumpPage = elemTrVariableChecked.map(
        (el) => `${$(el).attr('data-proc-id')}-${$(el).attr('data-col-id')}`,
    );
};

const getVariableOrderingFromPage = (page) => {
    const isSkDPage = page === PAGE_NAME.skd;
    const isSkDSelectChecked = $(jumpEls.jumpVariableSetting).prop('checked');
    let orderings = {};
    switch (page) {
        case PAGE_NAME.skd:
            orderings = graphStore.getVariableOrdering(
                procConfigs,
                isSkDPage && isSkDSelectChecked,
                !isSkDPage,
            );
            break;
        case PAGE_NAME.rlp: {
            const targetVars = graphStore.getTargetVariables(true);
            orderings = {
                ordering: targetVars,
                orderingID: targetVars.map((col) => col.id),
            };
            break;
        }
        case PAGE_NAME.pca:
            orderings = graphStore.getVariableOrdering(
                procConfigs,
                false,
                false,
                true,
            );
            break;
        default:
            orderings = graphStore.getVariableOrdering(
                procConfigs,
                false,
                !isSkDPage,
            );
    }
    return orderings;
};

const bindVariableOrderingToModal = (
    useFeatureImportance = true,
    loadByOrderIDs = false,
) => {
    let currentTraceDat = graphStore.getTraceData();
    const endProc = {};
    const currenPage = getCurrentPage();
    let varOrdering = undefined;
    if (
        latestSortColIds ||
        (currentTraceDat.ARRAY_FORMVAL.length && procConfigs)
    ) {
        latestSortColIdsJumpPage = [...latestSortColIds];
        if (latestSortColIds) {
            latestSortColIds.forEach(async (val) => {
                const [procId, colId] = val.split('-');
                endProc[Number(colId)] = Number(procId);
                graphStore.updateEndProc(endProc);
                await procConfigs[Number(procId)].updateColumns();
            });
        } else if (currentTraceDat.ARRAY_FORMVAL.length) {
            currentTraceDat.ARRAY_FORMVAL.forEach(async (endProc) => {
                await procConfigs[Number(endProc.end_proc)].updateColumns();
            });
        }
        if (currenPage === 'pca') {
            varOrdering = graphStore.getVariableOrdering(
                procConfigs,
                false,
                false,
                true,
            );
        }
        if (currenPage === 'skd') {
            varOrdering = graphStore.getVariableOrdering(
                procConfigs,
                useFeatureImportance,
                loadByOrderIDs,
            );
        } else if (currenPage === 'rlp') {
            const ordering = graphStore.getTargetVariables(true);
            varOrdering = {
                ordering: ordering,
                orderingID: ordering.map((col) => col.id),
            };
        } else {
            varOrdering = graphStore.getVariableOrdering(
                procConfigs,
                false,
                loadByOrderIDs,
            );
        }
        // Check all variable when jump target page is Skd
        if (
            currenPage === PAGE_NAME.skd &&
            getTargetPage()[0] === PAGE_NAME.skd
        ) {
            varOrdering.orderingID = varOrdering.ordering.map((col) => col.id);
            latestSortColIdsJumpPage = [
                ...varOrdering.ordering.map(
                    (col) => `${col.proc_id}-${col.id}`,
                ),
            ];
        }
        if (varOrdering) {
            buildJumpTbl(varOrdering);
        }
    }
};

const getTargetPage = () => {
    const targetPageEl = $(`${jumpEls.pageItem}.active`);
    const targetPage = targetPageEl.attr('data-target-page');
    const targetUrl = targetPageEl.attr('data-url');
    return [targetPage, targetUrl];
};

const showErrorMsg = (errMsg) => {
    // const errMsg = $('#i18nJumpWithoutTargetPageMsg').text();
    displayRegisterMessage('#jumpAlertMsg', {
        message: errMsg,
        is_error: true,
    });
};

const getColorVar = () => {
    const colorVar = $('input[name=colorVar]:checked');
    if (colorVar.length) {
        let groupName = colorVar
            .parents('ul')
            .find('input[type=checkbox]')[0].name;
        if (groupName) {
            groupName = groupName.replace('VALS', 'CATE');
        }
        const colorID = colorVar[0].value;

        return { groupName, colorID };
    }
    return undefined;
};

const handleClickOKJumpButton = (e) => {
    e.preventDefault();
    // get selected target page
    const [targetPage, targetUrl] = getTargetPage();
    if (!targetPage) {
        const errMsg = $('#i18nJumpWithoutTargetPageMsg').text();
        showErrorMsg(errMsg);
        return;
    }

    const isJumpByEmd = $(`${jumpEls.jumpByEmdDf}:not(:disabled)`).prop(
        'checked',
    );

    let jumpKeyParams = '';
    if (isJumpByEmd) {
        jumpKeyParams = `&jump_key=${jumpKey}`;
    } else {
        const jumpKey = getParamFromUrl('jump_key');
        if (jumpKey) {
            jumpKeyParams = `&jump_key=${jumpKey}`;
        }
    }

    // Show graph with normal copy and paste user setting

    // get limit sensor of target page
    const page = getCurrentPage();
    const limitTargetSensor = MAX_SENSOR_NUMBER[targetPage];
    const targetPageHasObjective = HAS_OBJECTIVE_PAGE.includes(targetPage);
    const rootPageHasObjective = HAS_OBJECTIVE_PAGE.includes(page);
    const targetPageHasDivideOption =
        Object.keys(ALL_DIVISION).includes(targetPage);
    const rootPageHasDivideOption = Object.keys(ALL_DIVISION).includes(page);

    // objectiveVar-39
    const allColumnsTr = $(`${jumpEls.jumpTblBody} tr`);

    // const validTrEl = [...allColumnsTr].splice(0, limitTargetSensor);
    // const excludeTrEl = allColumnsTr.length > limitTargetSensor ? [...allColumnsTr].splice(limitTargetSensor - allColumnsTr.length) : [];
    const validTrEl = $(
        `${jumpEls.jumpTblBody} tr:not(.over-lim-item) input[type=checkbox]:checked`,
    )
        .closest('tr')
        .toArray();
    const excludeTrEl = $(`${jumpEls.jumpTblBody}`)
        .find(
            'tr.over-lim-item input[type=checkbox]:checked,tr input[type=checkbox]:not(:checked)',
        )
        .closest('tr')
        .toArray();
    excludeSensors = excludeTrEl.map((el) => $(el).attr('data-col-id'));
    jumpCheckedAllSensors = [...validTrEl].map((el) =>
        $(el).attr('data-col-id'),
    );

    // let originColID = $(allColumnsTr[0]).attr('data-org-col-id');
    // const originColDataType = $(allColumnsTr[0]).attr('data-type');
    const rowObjective = $(
        `${jumpEls.jumpTblBody} tr input[type=radio]:checked`,
    ).closest('tr');
    let originColID = rowObjective.attr('data-org-col-id');
    const originColDataType = rowObjective.attr('data-type');

    const canNotCheckObjectDataType = [
        DataTypes.STRING.short,
        DataTypes.DATETIME.short,
    ];

    if (isJumpByEmd) {
        if (canNotCheckObjectDataType.includes(originColDataType)) {
            originColID = $(
                [...allColumnsTr].filter(
                    (el) =>
                        !canNotCheckObjectDataType.includes(
                            $(el).attr('data-type'),
                        ),
                )[0],
            ).attr('data-org-col-id');
        }

        if (!jumpCheckedAllSensors.includes(originColID)) {
            jumpCheckedAllSensors.push(originColID);
        }
    }
    const objectiveColId = rowObjective.attr('data-col-id');
    objectiveId = targetPageHasObjective ? `objectiveVar-${originColID}` : null;

    if (isJumpByEmd && targetPageHasObjective && objectiveColId) {
        jumpKeyParams += `&objective_var=${objectiveColId}`;
    }

    if (isJumpByEmd && excludeSensors.length > 0) {
        jumpKeyParams += `&excluded_columns=${excludeSensors.join(',')}`;
    }

    // IGNORE CHECK ALL
    excludeSensors.push('All');

    const setDefaultDivision = (targetPage) => {
        divideOption = ALL_DIVISION[targetPage].default;
    };

    if (!rootPageHasDivideOption && targetPageHasDivideOption) {
        setDefaultDivision(targetPage);
    }

    if (rootPageHasDivideOption && targetPageHasDivideOption) {
        // check current of root division has in target division all option
        const datetimeRange = $('#datetimeRangeShowValue').text();
        const currentRootDivision =
            graphStore.getTraceData().COMMON.compareType;
        const isTargetPageHasCurrentRootDivision =
            ALL_DIVISION[targetPage].all.includes(currentRootDivision);
        if (!isTargetPageHasCurrentRootDivision) {
            setDefaultDivision(targetPage);

            if (divideOption && divideOption === divideOptions.cyclicTerm) {
                dumpedUserSetting.push({
                    id: 'cyclicTermDatetimePicker',
                    name: 'DATETIME_PICKER',
                    type: 'text',
                    value: datetimeRange.split(DATETIME_PICKER_SEPARATOR)[0],
                });
            }
        }
        if (ALL_DIVISION[page].default === divideOptions.cyclicTerm) {
            dumpedUserSetting.push({
                id: DEFAULT_DATETIME_RANGE,
                name: DEFAULT_DATETIME_RANGE,
                type: 'text',
                value: datetimeRange,
            });
        }
    }

    if (objectiveId && targetPageHasObjective && !rootPageHasObjective) {
        dumpedUserSetting.push({
            name: 'objectiveVar',
            id: objectiveId,
            checked: true,
            type: 'radio',
            value: originColID,
        });
    }

    if (rootPageHasDivideOption && !targetPageHasDivideOption) {
        dumpedUserSetting.push({
            id: 'datetimeRangePicker',
            name: 'DATETIME_RANGE_PICKER',
            value: $('#datetimeRangeShowValue').text(),
            type: 'text',
        });
    }

    // check to transform color variable to filter in target page
    const needToTransformFilter = TRANSFORM_AGG_TO_FILTER.page.includes(page);
    if (needToTransformFilter) {
        const colorVar = getColorVar();
        if (colorVar) {
            // add filter column in target setting
            dumpedUserSetting.push({
                checked: true,
                id: `categoryFilter-${colorVar.colorID}`,
                name: colorVar.groupName,
                type: 'checkbox',
                value: colorVar.colorID,
            });
        }
    }

    // get sorted columns
    let sortedColumnIds = validTrEl.map(
        (el) => `${$(el).attr('data-proc-id')}-${$(el).attr('data-col-id')}`,
    );
    let currentTraceDat = graphStore.getTraceData();
    const isUseDfMode = $(jumpEls.jumpByEmdDf).is(':checked');
    if (currentTraceDat.ng_rates && isUseDfMode) {
        let ngRateCols = currentTraceDat.ng_rates.map(
            (ngRateCol) =>
                `${ngRateCol.end_proc_id}-${Number(ngRateCol.end_col_id) * RLP_DUMMY_ID}`,
        );
        ngRateCols = ngRateCols.filter((col) => !sortedColumnIds.includes(col));
        sortedColumnIds = [...sortedColumnIds, ...ngRateCols];
    }
    localStorage.setItem(sortedColumnsKey, JSON.stringify(sortedColumnIds));

    isCopyFromJumpModel = true;
    $('button[name="copyPage"]').trigger('click');
    goToOtherPage(`${targetUrl}?from_jump_func=1${jumpKeyParams}`, false, true);
    $(jumpEls.jumpModal).modal('hide');
};

const resetCommonJumpObj = () => {
    excludeSensors = [];
    jumpCheckedAllSensors = [];
    objectiveId = null;
    divideOption = null;
    dumpedUserSetting = [];
    isCopyFromJumpModel = false;
};

const disableGUIFormElement = () => {
    const useEMD = getParamFromUrl('jump_key');
    const GuiFrom = $(jumpEls.GUIForm);
    if (useEMD) {
        GuiFrom.css({
            position: 'relative',
        });
        const jumpWithDfModeMsg = $(jumpEls.jumpWithDfMode).text();
        const overlayEL = `<div class="gui-overlay position-absolute">${jumpWithDfModeMsg}</div>`;
        GuiFrom.append(overlayEL);
    } else {
        enableGUIFormElement();
    }
};

const enableGUIFormElement = () => {
    $('.gui-overlay').remove();
};

const jumpWithEMDAndNGCols = (e) => {
    const isJumpWithEMDChecked = $(e).is(':checked');
    let ordering = {};
    if (isJumpWithEMDChecked) {
        const targetVars = graphStore.getTargetVariables(isJumpWithEMDChecked);
        ordering = {
            ordering: targetVars,
            orderingID: targetVars.map((col) => col.id),
        };
    } else {
        ordering = graphStore.getVariableOrdering(procConfigs, false);
    }
    // Check all variable when jump target page is Skd
    if (getTargetPage()[0] === PAGE_NAME.skd) {
        ordering.orderingID = ordering.ordering.map((col) => col.id);
        latestSortColIdsJumpPage = [
            ...ordering.ordering.map((col) => `${col.proc_id}-${col.id}`),
        ];
    }
    buildJumpTbl(ordering, isJumpWithEMDChecked);
    validateJumpSkdObjective();
};

const updateEventChangeVariableNameJump = (varOrdering) => {
    if (varOrdering.ordering.length) {
        varOrdering.ordering.forEach((variable, i) => {
            const procId = variable.proc_id;
            const procColId = variable.id;
            $(jumpEls.jumpTblBody)
                .find(
                    `tr[data-proc-id="${procId}"][data-col-id="${procColId}"]`,
                )
                .find(`input[type="checkbox"]`)
                .on('change', (e) => {
                    const targetObjectiveId = $(e.target)
                        .closest('tr')
                        .find('input[type="radio"]')
                        .attr('id');
                    const objectiveIdVal = $(jumpEls.jumpTblBody)
                        .find('input[name=objective_var]:checked')
                        .attr('id');
                    updateOrderingJumpPage(varOrdering, e);
                    updateObjectiveForTargetPage(
                        objectiveIdVal,
                        targetObjectiveId,
                    );
                    handleSortVariableNameByCheckbox(e);
                    validateJumpSkdObjective();
                    updatePriority(jumpEls.jumpTblID);
                    updateOverItemsColor(jumpEls.jumpTblID);
                    updateJumpStatus();
                });
            $(jumpEls.jumpTblBody)
                .find(
                    `tr[data-proc-id="${procId}"][data-col-id="${procColId}"]`,
                )
                .find(`input[type="radio"]`)
                .on('change', (e) => {
                    noneObjective = false;
                    validateJumpSkdObjective();
                    sortVariableByObjective(varOrdering, e);
                    updatePriority(jumpEls.jumpTblID);
                    updateOverItemsColor(jumpEls.jumpTblID);
                    updateJumpStatus();
                });
        });
    }
    if (noneObjective) {
        $(jumpEls.jumpTblBody)
            .find('input[type="radio"]')
            .each(function () {
                $(this).prop('checked', false);
            });
    }
};

const handleSortVariableNameByCheckbox = (e) => {
    const rowVariableName = $(jumpEls.jumpTblBodyTr);
    rowVariableName.sort(function (a, b) {
        const aChecked = $(a).find('input[type="checkbox"]').is(':checked');
        const bChecked = $(b).find('input[type="checkbox"]').is(':checked');
        // Rows with checked checkboxes come bellow list checked
        return aChecked === bChecked ? 0 : aChecked ? -1 : 1;
    });
    $.each(rowVariableName, function (index, row) {
        $(jumpEls.jumpTblBody).append(row);
    });
};

const updateOrderingJumpPage = (varOrdering, e) => {
    const elementRow = $(e.target).closest('tr');
    const procId = elementRow.attr('data-proc-id');
    const colId = elementRow.attr('data-col-id');
    if (e.target.checked) {
        if (!latestSortColIdsJumpPage.includes(`${procId}-${colId}`)) {
            latestSortColIdsJumpPage.push(`${procId}-${colId}`);
        }
    } else {
        const isObjective = elementRow
            .find('input[name="objective_var"]')
            .is(':checked');
        if (isObjective) {
            $(jumpEls.jumpTblBody)
                .find(`input[name="objective_var"]:checked`)
                .prop('checked', false);
            noneObjective = true;
        }
        latestSortColIdsJumpPage = latestSortColIdsJumpPage.filter(
            (e) => e !== `${procId}-${colId}`,
        );
    }

    const newVarOrdering = {
        ordering: varOrdering.ordering,
        orderingID: latestSortColIdsJumpPage.map((val) =>
            Number(val.split('-')[1]),
        ),
    };
    buildJumpTbl(newVarOrdering);
};

const sortVariableByObjective = (varOrdering, e) => {
    const elementRow = $(e.target).closest('tr');
    const procId = elementRow.attr('data-proc-id');
    const colId = elementRow.attr('data-col-id');

    if (e.target.checked) {
        const checkboxIsChecked = elementRow
            .find('input[type="checkbox"]')
            .is(':checked');
        if (!checkboxIsChecked) {
            elementRow.find('input[type="checkbox"]').prop('checked', true);
        }
        if (!latestSortColIdsJumpPage.includes(`${procId}-${colId}`)) {
            latestSortColIdsJumpPage.push(`${procId}-${colId}`);
        }
        $(jumpEls.jumpTblBody).prepend(elementRow);
    } else {
        elementRow.find('input[type="checkbox"]').prop('checked', false);
        latestSortColIdsJumpPage = latestSortColIdsJumpPage.filter(
            (e) => e !== `${procId}-${colId}`,
        );

        const newVarOrdering = {
            ordering: varOrdering.ordering,
            orderingID: latestSortColIdsJumpPage.map((val) =>
                Number(val.split('-')[1]),
            ),
        };
        buildJumpTbl(newVarOrdering);
    }
};

const updateObjectiveForTargetPage = (objectiveIdVal, targetObjectiveId) => {
    const objectiveElem = $(
        `${jumpEls.jumpTblBody} tr input[type=radio][name=objective_var]`,
    );
    const isPageJumpToHasObjective = HAS_OBJECTIVE_PAGE.includes(
        getTargetPage()[0],
    );
    if (isPageJumpToHasObjective) {
        if (
            objectiveIdVal &&
            objectiveIdVal === targetObjectiveId &&
            !noneObjective
        ) {
            noneObjective = true;
            $(`#${objectiveIdVal}`).prop('checked', false);
        } else if (objectiveIdVal && !noneObjective) {
            moveObjectiveRowToTop(objectiveIdVal);
        } else {
            objectiveElem.prop('checked', '');
        }
    } else {
        disableJumpObjective(objectiveElem);
    }
};

const moveObjectiveRowToTop = (objectiveIdVal) => {
    const elementRow = $(`#${objectiveIdVal}`)
        .prop('checked', true)
        .parents()
        .eq(2);
    $(jumpEls.jumpTblBody).prepend(elementRow);
};

const handleJumpChangeSelectAll = (elem) => {
    const isChecked = elem.checked;
    $(jumpEls.jumpVariableEls).prop('checked', isChecked);
    if (isChecked) {
        latestSortColIdsJumpPage = $(jumpEls.jumpTblBodyTr)
            .toArray()
            .map(
                (elem) =>
                    `${$(elem).attr('data-proc-id')}-${$(elem).attr('data-col-id')}`,
            );
    } else {
        $(jumpEls.jumpObjectiveEls).prop('checked', false);
        latestSortColIdsJumpPage = [];
    }
    updateJumpStatus();
};

const handleJumpSelectedItems = (elem) => {
    const isChecked = elem.checked;
    if (isChecked) {
        $(`${jumpEls.pageItem}.active`).trigger('click');
    } else {
        const currentPage = getCurrentPage();
        const orgOrdering = getVariableOrderingFromPage(currentPage);
        orgOrdering.orderingID.map((valID) => {
            const orgValElem = $(`#variable_${valID}`);
            orgValElem.prop('checked', isChecked).trigger('change');
        });
    }
};

// Update [select all] , [selected item], [total checked]
const updateJumpStatus = () => {
    const targetPage = getTargetPage()[0];
    const countVariable = $(jumpEls.jumpVariableEls).length;
    const countVariableUnChecked = $(
        `${jumpEls.jumpVariableEls}:not(:checked)`,
    ).length;
    const countVariableChecked = countVariable - countVariableUnChecked;
    $(jumpEls.totalCheckedColumn).text(countVariableChecked);
    $(jumpEls.totalColumns).text(MAX_SENSOR_NUMBER[targetPage]);
    $(jumpEls.jumpSelectAllCheckbox).prop(
        'checked',
        countVariable !== 0 && countVariableUnChecked === 0,
    );
    if ($(`${jumpEls.jumpTblBodyTr}.gray`).length === 0) {
        $(jumpEls.searchInput).trigger($.Event('keypress'), { keycode: 13 });
    }
};

function searchJumpInputHandler(event) {
    // Ignore enter event
    if (event.keyCode !== 13) {
        /** @type HTMLTableRowElement[] */
        const rows = [...$(jumpEls.jumpTblBodyTr)];
        searchByValueOfTable(event, rows);
    }
}

const updateLatestSortColByRowElems = (rowElemsAdd, rowElemsRemove) => {
    const variableChecked = rowElemsAdd.map(
        (elem) =>
            `${$(elem).attr('data-proc-id')}-${$(elem).attr('data-col-id')}`,
    );
    const variableUnchecked = rowElemsRemove.map(
        (elem) =>
            `${$(elem).attr('data-proc-id')}-${$(elem).attr('data-col-id')}`,
    );
    latestSortColIdsJumpPage.filter(
        (item) => !variableUnchecked.includes(item),
    );
    latestSortColIdsJumpPage.push(...variableChecked);
    latestSortColIdsJumpPage = latestSortColIdsJumpPage
        .filter((item) => !variableUnchecked.includes(item))
        .filter((value, index, array) => array.indexOf(value) === index);
};
