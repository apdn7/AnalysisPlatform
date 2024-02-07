const JUMP_API = '/ap/api/common/jump_cfg'

const PAGES = ['fpp', 'stp', 'rlp', 'msp', 'chm', 'scp', 'agp', 'skd', 'pcp', 'gl', 'pca']

const MAX_JUMP_SENSOR_NUMBER = 20;
const jumpEls = {
    jumpModal: '#jumpModal',
    recommendedId: '#recommendedList',
    allList: '#jumpAllList',
    jumpOkButton: '#jumpOKButton',
    pageItem: '.jump-page-list .tile-item',
    jumpTblID: '#jumpSensorTbl',
    jumpTblBody: '#jumpSensorTbl tbody',
    jumpVariableSetting: '#jumpVariableSetting',
    jumpByEmdDf: '#jumpByEmd',
    GUIForm: '.GUIForm',
    jumpErrEle: '#jumpAlertMsg',
    jumpWithoutTargetPage: '#i18nJumpWithoutTargetPageMsg',
    jumpWithDfMode: '#i18nJumpWithDfModeMsg',
};

const goToFromJumpFunction = 'from_jump_func';
const sortedColumnsKey = 'sortedColumnsKey';
let divideOption = '';
let dumpedUserSetting = [];
let jumpKey = '';

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
        default: 'var'
    },
    rlp: {
        all: ['category', 'cyclicTerm', 'directTerm'],
        default: 'cyclicTerm',
    },
    scp: {
        all: ['category', 'cyclicTerm', 'directTerm', 'dataNumberTerm'],
        default: 'category'
    },
    agp: {
        all: ['category', 'cyclicTerm', 'directTerm', 'dataNumberTerm', 'cyclicCalender'],
        default: 'cyclicCalender'
    }
}
const showJumpModal = async () => {
    // reset jump err message
    resetJumpErrMsg();
    const page = getCurrentPage();
    const isSkDPage = page === 'skd';
    bindVariableOrderingToModal(isSkDPage, !isSkDPage);
    $(jumpEls.jumpModal).modal('show');
    showOptionalCheckbox(page);
    const res = await getJumpPages(page);
    loadJumpPages(res);

    $(jumpEls.jumpByEmdDf).prop('checked', true);
};


const showOptionalCheckbox = (page) => {
    $('.jump-check-box-option').find('input').prop('disabled', true);
    $('.jump-check-box-option').hide();
    $(`.jump-check-box-option[data-for=${page}]`).find('input').prop('disabled', false);
    $(`.jump-check-box-option[data-for=${page}]`).show();
}

const getJumpPages = async (page) => {
    if (!page) return {};
    const res = await fetchData(`${JUMP_API}/${page}`, {}, 'GET');
    return res;
};

const resetJumpErrMsg = () => {
    // reset error message if existing
    $(jumpEls.jumpErrEle).find('button').click();
}
const getCurrentPage = () => {
    const path = window.location.pathname;
    for (const page of PAGES) {
        if (path.includes(page))
            return page;
    }

    return null;
};

const generatePageItem = (page, pageObj, parentDivId = null) => {
    const {hover, link_address, png_path, title} = pageObj;
    const shownHover = hover.replaceAll('\"', '&quot;')
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
    const {all, master, recommended, unavailable} = res;

    $(jumpEls.recommendedId).empty();
    $(jumpEls.allList).empty();

    for (const page of recommended) {
        const pageObj = master[page];
        generatePageItem(page, pageObj, jumpEls.recommendedId);
    }

    for (const page of all) {
        if (unavailable.includes(page)) {
            continue
        }
        const pageObj = master[page];
        generatePageItem(page, pageObj, jumpEls.allList);
    }

    $(jumpEls.pageItem).off('click', handleOnClickPage);
    $(jumpEls.pageItem).on('click', handleOnClickPage);

    $(jumpEls.jumpOkButton).off('click', handleClickOKJumpButton);
    $(jumpEls.jumpOkButton).on('click', handleClickOKJumpButton);
};

const handleOnClickPage = (e) => {
    e.preventDefault();
    const _this = $(e.currentTarget);
    $('.jump-page-list .tile-item').removeClass('active');
    _this.addClass('active');
    updateOverItemsColor(jumpEls.jumpTblID);
    resetJumpErrMsg();
}

const updateOverItemsColor = (tableID) => {
    const maxJumpSensorNumber = MAX_SENSOR_NUMBER[getTargetPage()[0]] || MAX_JUMP_SENSOR_NUMBER
    $(`${tableID} tbody tr`).each((rowIdx, row) => {
        $(row).removeClass('over-lim-item');
        if (rowIdx + 1 > maxJumpSensorNumber) {
            $(row).addClass('over-lim-item');
        }
    });
};
const bindChangeVariableOrderingSKD = (e) => {
    const changeStatus = $(e).prop('checked');
    bindVariableOrderingToModal(changeStatus);
};
const genColTypeForJumpTbl = (variable) => {
    let colType = DataTypes[variable.type].short;
    if (variable.name.includes(COMMON_CONSTANT.NG_RATE_NAME) ||
        variable.name.includes(COMMON_CONSTANT.EMD_DRIFT_NAME) ||
        variable.name.includes(COMMON_CONSTANT.EMD_DIFF_NAME)) {
        colType = DataTypes.REAL.short;
    }
    return colType;
};
const buildJumpTbl = (varOrdering, dfMode=true) => {
    // update checkbox status
    if (varOrdering.ordering.length) {
        $(jumpEls.jumpTblBody).html('');
        let tblContent = '';
        varOrdering.ordering.forEach((variable, i) => {
            tblContent += `<tr data-proc-id="${variable.proc_id}"
                data-col-id="${variable.id}" data-type="${DataTypes[variable.type].short}"
                data-org-col-id="${variable.org_id || variable.id}">
                <td>${i + 1}</td>
                <td style="text-align: left">${variable.proc_name}</td>
                <td style="text-align: left">${variable.name}</td>
                <td>${genColTypeForJumpTbl(variable)}</td>
            </tr>`
        });
        $(jumpEls.jumpTblBody).html(tblContent);
        updateOverItemsColor(jumpEls.jumpTblID);
        $(jumpEls.jumpTblBody).sortable({
            helper: dragDropRowInTable.fixHelper, update: () => {
                updatePriority(jumpEls.jumpTblID);
                updateOverItemsColor(jumpEls.jumpTblID);
            },
        });
    }
};
const bindVariableOrderingToModal = (useFeatureImportance = true, loadByOrderIDs = false) => {
    let currentTraceDat = graphStore.getTraceData();
    const endProc = {};
    const currenPage = getCurrentPage();
    let varOrdering = undefined;
    if (latestSortColIds || (currentTraceDat.ARRAY_FORMVAL.length && procConfigs)) {
        if (latestSortColIds) {
            latestSortColIds.forEach(async val => {
                const [procId, colId] = val.split('-');
                endProc[Number(colId)] = Number(procId);
                graphStore.updateEndProc(endProc);
                await procConfigs[Number(procId)].updateColumns();
            })
        } else if (currentTraceDat.ARRAY_FORMVAL.length) {
            currentTraceDat.ARRAY_FORMVAL.forEach(async endProc => {
                await procConfigs[Number(endProc.end_proc)].updateColumns();
            });
        }

        if (currenPage === 'skd') {
            varOrdering = graphStore.getVariableOrdering(procConfigs, useFeatureImportance, loadByOrderIDs);
        } else {
            varOrdering = graphStore.getVariableOrdering(procConfigs, false, loadByOrderIDs);
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

const showErrorMsg = () => {
    const errMsg = $('#i18nJumpWithoutTargetPageMsg').text();
    displayRegisterMessage('#jumpAlertMsg', {
        message: errMsg,
        is_error: true
    });
};
const handleClickOKJumpButton = (e) => {
    e.preventDefault();
    // get selected target page
    const [targetPage, targetUrl] = getTargetPage();
    if (!targetPage) {
        showErrorMsg();
        return;
    }

    const isJumpByEmd = $(`${jumpEls.jumpByEmdDf}:not(:disabled)`).prop('checked');

    let jumpKeyParams = '';
    if (isJumpByEmd) {
        jumpKeyParams = `&jump_key=${jumpKey}`;
    } else {
        jumpKey = getParamFromUrl('jump_key');
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
    const targetPageHasDivideOption = Object.keys(ALL_DIVISION).includes(targetPage);
    const rootPageHasDivideOption = Object.keys(ALL_DIVISION).includes(page);

    // objectiveVar-39
    const allColumnsTr = $(`${jumpEls.jumpTblBody} tr`);
    const validTrEl = [...allColumnsTr].splice(0, limitTargetSensor);
    const excludeTrEl = allColumnsTr.length > limitTargetSensor ? [...allColumnsTr].splice(limitTargetSensor - allColumnsTr.length) : [];
    excludeSensors = excludeTrEl.map(el => $(el).attr('data-col-id'));
    jumpCheckedAllSensors = [...allColumnsTr].map(el => $(el).attr('data-col-id'));

    let originColID = $(allColumnsTr[0]).attr('data-org-col-id');
    const originColDataType = $(allColumnsTr[0]).attr('data-type');

    if (isJumpByEmd) {
        if (originColDataType === DataTypes.STRING.short) {
            originColID = $([...allColumnsTr].filter(el => $(el).attr('data-type') !== DataTypes.STRING.short)[0]).attr('data-org-col-id');
        }

        if (!jumpCheckedAllSensors.includes(originColID)) {
            jumpCheckedAllSensors.push(originColID);
        }
    }
    const objectiveColId = $(allColumnsTr[0]).attr('data-col-id');
    objectiveId = targetPageHasObjective ? `objectiveVar-${originColID}` : null;

    if (isJumpByEmd && targetPageHasObjective && objectiveColId) {
        jumpKeyParams += `&objective_var=${objectiveColId}`;
    }

    if (isJumpByEmd && excludeSensors.length > 0) {
        jumpKeyParams += `&excluded_columns=${excludeSensors.join(',')}`;
    }

    const setDefaultDivision = (targetPage) => {
        divideOption = ALL_DIVISION[targetPage].default;
    }

    if (!rootPageHasDivideOption && targetPageHasDivideOption) {
        setDefaultDivision(targetPage);
    }

    if (rootPageHasDivideOption && targetPageHasDivideOption) {
        // check current of root division has in target division all option
        const currentRootDivision =  graphStore.getTraceData().COMMON.compareType;

        const isTargetPageHasCurrentRootDivision = ALL_DIVISION[targetPage].all.includes(currentRootDivision);
        if (!isTargetPageHasCurrentRootDivision) {
            setDefaultDivision(targetPage)

            if (divideOption && divideOption === divideOptions.cyclicTerm) {
                dumpedUserSetting.push({
                    id: 'cyclicTermDatetimePicker',
                    name: 'DATETIME_PICKER',
                    type: 'text',
                    value: $('#datetimeRangeShowValue').text().split(DATETIME_PICKER_SEPARATOR)[0],
                });
            }
        }
    }

    if (objectiveId && targetPageHasObjective && !rootPageHasObjective) {
        dumpedUserSetting.push({
            name: 'objectiveVar',
            id: objectiveId,
            checked: true,
            type: 'radio',
            value: originColID,
        })
    }

    if (rootPageHasDivideOption && !targetPageHasDivideOption) {
        dumpedUserSetting.push({
            id: 'datetimeRangePicker',
            name: 'DATETIME_RANGE_PICKER',
            value: $('#datetimeRangeShowValue').text(),
            type: 'text'
        })
    }

    // get sorted columns
    let sortedColumnIds = validTrEl.map(el => `${$(el).attr('data-proc-id')}-${$(el).attr('data-col-id')}`);
    let currentTraceDat = graphStore.getTraceData();
    const isUseDfMode = $(jumpEls.jumpByEmdDf).is(':checked');
    if (currentTraceDat.ng_rates && isUseDfMode) {
        let ngRateCols = currentTraceDat.ng_rates
            .map(ngRateCol => `${ngRateCol.end_proc_id}-${(Number(ngRateCol.end_col_id) * RLP_DUMMY_ID)}`);
        ngRateCols = ngRateCols.filter(col => !sortedColumnIds.includes(col));
        sortedColumnIds = [...sortedColumnIds, ...ngRateCols];
    }
    localStorage.setItem(sortedColumnsKey, JSON.stringify(sortedColumnIds));

    $('button[name="copyPage"]').trigger('click');
    goToOtherPage(`${targetUrl}?from_jump_func=1${jumpKeyParams}`, false, true);
};

const resetCommonJumpObj = () => {
    excludeSensors = [];
    jumpCheckedAllSensors = [];
    objectiveId = null;
    divideOption = null;
    dumpedUserSetting = [];
};

const disableGUIFormElement = () => {
    const useEMD = getParamFromUrl('jump_key');
    const GuiFrom = $(jumpEls.GUIForm);
    if (useEMD) {
        GuiFrom.css({
            position: 'relative',
        })
        const jumpWithDfModeMsg = $(jumpEls.jumpWithDfMode).text();
        const overlayEL = `<div class="gui-overlay position-absolute">${jumpWithDfModeMsg}</div>`;
        GuiFrom.append(overlayEL)
    } else {
        enableGUIFormElement();
    }
};

const enableGUIFormElement = () => {
    $('.gui-overlay').remove();
};

const jumpWithEMDAndNGCols = (e) => {
    const isJumpWithEMDChecked = $(e).is(':checked');
    const targetVars = graphStore.getTargetVariables(isJumpWithEMDChecked);
    buildJumpTbl({ordering: targetVars}, isJumpWithEMDChecked);
};