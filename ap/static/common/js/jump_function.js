const JUMP_API = '/ap/api/common/jump_cfg'

const MAX_JUMP_SENSOR_NUMBER = 20;
const jumpEls = {
    jumpModal: '#jumpModal',
    recommendedId: '#recommendedList',
    allList: '#jumpAllList',
    jumpOkButton: '#jumpOKButton',
    pageItem: '.jump-page-list .tile-item',
    jumpTblID: '#jumpSensorTbl',
    jumpTblBody: '#jumpSensorTbl tbody',
    jumpVariableSetting: '#jumpVariableSetting'
};

const goToFromJumpFunction = 'from_jump_func';
const sortedColumnsKey = 'sortedColumnsKey';
let divideOption = '';

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

const DIVIDE_BY_TERM_PAGE = ['rlp', 'agp', 'scp']

const DIVIDE_BY_CATEGORY_PAGE = ['stp']

const showJumpModal = async () => {
    bindVariableOrderingToModal();
    $(jumpEls.jumpModal).modal('show');
    const res = await getJumpPages();
    loadJumpPages(res);
};

const getJumpPages = async (page = 'skd') => {
    const res = await fetchData(`${JUMP_API}/${page}`, {}, 'GET');
    return JSON.parse(res);
};

const generatePageItem = (page, pageObj, parentDivId = null) => {
    const { hover, link_address, png_path, title } = pageObj;
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
    const { all, master, recommended, unavailable } = res;

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
const bindChangeVariableOrdering = (e) => {
    const changeStatus = $(e).prop('checked');
    bindVariableOrderingToModal(changeStatus);
};
const bindVariableOrderingToModal = (useFeatureImportance=true) => {
    let isCheckSensorByImportance = useFeatureImportance;
    const currentTraceDat = graphStore.getTraceData();
    if (currentTraceDat.ARRAY_FORMVAL.length && procConfigs) {
        currentTraceDat.ARRAY_FORMVAL.forEach(async endProc => {
             await procConfigs[Number(endProc.end_proc)].updateColumns();
        });

        const varOrdering = graphStore.getVariableOrdering(procConfigs, useFeatureImportance);
        // update checkbox status
        isCheckSensorByImportance = varOrdering.use_feature_importance;
        if (varOrdering.ordering.length) {
            $(jumpEls.jumpTblBody).html('');

            let tblContent = '';
            varOrdering.ordering.forEach((variable, i) => {
               tblContent += `<tr data-proc-id="${variable.proc_id}" data-col-id="${variable.id}">
                    <td>${i + 1}</td>
                    <td style="text-align: left">${variable.proc_name}</td>
                    <td style="text-align: left">${variable.name}</td>
                    <td>${DataTypes[variable.type].short}</td>
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
    }
};

const getTargetPage = () => {
    const targetPageEl = $(`${jumpEls.pageItem}.active`);
    const targetPage = targetPageEl.attr('data-target-page');
    const targetUrl = targetPageEl.attr('data-url');
    return [targetPage, targetUrl];
};

const handleClickOKJumpButton = (e) => {
    e.preventDefault();
    // get selected target page
    const [targetPage, targetUrl] = getTargetPage();
    if (!targetPage) return;

    // get limit sensor of target page
    const limitTargetSensor = MAX_SENSOR_NUMBER[targetPage];
    const hasObjective = HAS_OBJECTIVE_PAGE.includes(targetPage);

    // objectiveVar-39
    const allColumnsTr = $(`${jumpEls.jumpTblBody} tr`);
    const validTrEl = [...allColumnsTr].splice(0, limitTargetSensor);
    const excludeTrEl = allColumnsTr.length > limitTargetSensor ? [...allColumnsTr].splice(limitTargetSensor - allColumnsTr.length) : [];
    excludeSensors = excludeTrEl.map(el => $(el).attr('data-col-id'));
    jumpCheckedAllSensors = [...allColumnsTr].map(el => $(el).attr('data-col-id'));
    objectiveId = hasObjective ? `objectiveVar-${$(allColumnsTr[0]).attr('data-col-id')}` : null;

    if (DIVIDE_BY_TERM_PAGE.includes(targetPage)) {
        divideOption = divideOptions.cyclicTerm;
    }

    if (DIVIDE_BY_CATEGORY_PAGE.includes(targetPage)) {
        divideOption = divideOptions.category;
    }

    // get sorted columns
    const sortedColumnIds = validTrEl.map(el => `${$(el).attr('data-proc-id')}-${$(el).attr('data-col-id')}`);
    localStorage.setItem(sortedColumnsKey, JSON.stringify(sortedColumnIds));

    $('button[name="copyPage"]').trigger('click');
    goToOtherPage(`${targetUrl}?from_jump_func=1`, false, true);
};

const resetCommonJumpObj = () => {
    excludeSensors = [];
    jumpCheckedAllSensors = [];
    objectiveId = null;
    divideOption = null;
};