const TRACE_PROCESS_STATE = 'trace_process_state';
let processesTree = null;

const orderProcessInTreeCheckBox = (orderedList) => {
    const flattenProcesses = orderedList.flat();

    // tag treeOrder to list process
    let index = 0;
    // resetOrder
    for (const proc of Object.values(processes)) {
        proc.treeOrder = flattenProcesses.length + 1;
    }

    for (const id of flattenProcesses) {
        processes[id].treeOrder = index;
        index += 1;
    }

    const sortProcessList = Object.values(processes);
    sortProcessList.sort((a, b) => {
        return a.treeOrder - b.treeOrder;
    });
    processesTree = groupProcessesByPath(Object.values(sortProcessList));
    generateTreeCheckBoxs(processesTree);
};

const collectCheckedProcessesForAutoLink = () => {
    // get selected v2 data sources
    const selectedProcessIds = $(`.tree input[name=process]:checked`)
        .map((procId, e) => e.value)
        .toArray();
    return selectedProcessIds;
};

/***
 *
 * @param processList: list id of process [1, 2, 3, 4, 5]
 */
const linkProcesses = (processList) => {
    const linkProcs = [];
    const trace = {
        from: 0,
        to: 0,
        arrows: 'to',
        target_proc: 0,
        target_col: [],
        target_orig_col: [],
        target_substr: [[]],
        self_proc: 0,
        self_col: [],
        back_orig_col: [],
        self_substr: [[]],
        id: '',
    };

    // filter serial and remove edge of this proc
    for (const id of processList) {
        const proc = processes[id];
        const serial_column_id = proc.serial_column_id;
        if (serial_column_id == null) {
            continue;
        }

        removeLinkedEdge(proc.id);

        linkProcs.push(proc);
    }

    // link processes
    for (let i = 0; i < linkProcs.length - 1; i += 1) {
        const fromProc = linkProcs[i];
        const toProc = linkProcs[i + 1];
        const edgeData = {
            ...trace,
            from: fromProc.id,
            to: toProc.id,
            target_proc: toProc.id,
            self_proc: fromProc.id,
            self_col: [fromProc.serial_column_id],
            back_orig_col: [fromProc.serial_column_id],
            target_col: [toProc.serial_column_id],
            target_orig_col: [toProc.serial_column_id],
            id: create_UUID(),
        };
        mapIdFromIdTo2Edge[`${edgeData.from}-${edgeData.to}`] = edgeData;
        edges.update(edgeData);
    }
};

const removeLinkedEdge = (procId) => {
    for (const edge of Object.values(mapIdFromIdTo2Edge)) {
        if (Number(edge.from) === procId || Number(edge.to) === procId) {
            edges.remove(edge);
            delete mapIdFromIdTo2Edge[`${edge.from}-${edge.to}`];
        }
    }
};

const handleAutolinkGroups = async () => {
    const selectedProcessIds = collectCheckedProcessesForAutoLink();
    if (!selectedProcessIds.length) return;

    loading.show();
    const groupsOrderedProcesses = await getAutolinkGroups(selectedProcessIds);
    loading.hide();

    // update order of process on tree list
    orderProcessInTreeCheckBox(groupsOrderedProcesses);

    // link process
    const goodGroups = groupsOrderedProcesses.filter((group) => group.length >= 1);
    for (const group of goodGroups) {
        linkProcesses(group);
    }
};

const handleOpenTraceConfigMenu = (e) => {
    const traceMenu = $(e).parent().parent();
    const isActive = traceMenu.hasClass('active');
    if (isActive) {
        traceMenu.removeClass('active');
    } else {
        traceMenu.addClass('active');
    }
};

const treeCheckboxJs = () => {
    $(document).off('click', '.tree-plus', handleToggleTreeCheckbox);
    $(document).on('click', '.tree-plus', handleToggleTreeCheckbox);

    $(document).off('change', '.tree input[type=checkbox]', handleCheckTreeCheckbox);
    $(document).on('change', '.tree input[type=checkbox]', handleCheckTreeCheckbox);

    processesTree = groupProcessesByPath(Object.values(processes));
    generateTreeCheckBoxs(processesTree);
};

const handleToggleTreeCheckbox = (e) => {
    const _this = $(e.currentTarget);
    _this.siblings('ul').fadeToggle();
    _this.toggleClass('expanded');
    e.stopPropagation();
};

const handleCheckTreeCheckbox = (e) => {
    const _this = $(e.currentTarget);
    const checked = _this.prop('checked');
    _this.siblings('ul').find("input[type='checkbox']").prop('checked', checked);
    _this.parentsUntil('.tree').children("input[type='checkbox']").prop('checked', checked);
    e.stopPropagation();
};

/**
 *
 * @param processObj {
 *     path: processesList[{id: 1, name: '', isChecked: true|false}]
 * }
 */
const generateTreeCheckBoxs = (processObj) => {
    let groupHtml = '';
    // for all selection
    groupHtml += `<li class="custom-control custom-checkbox ">
           <span class="tree-plus expanded"></span>
           <input type="checkbox" id="checkAll" class="custom-control-input" onchange="handleSelectAllNodes(this);">
           <label class="custom-control-label move no-tree" for="checkAll">${i18nCommon.allSelection || 'All'}</label>
       </li>`;

    for (const path of Object.keys(processObj)) {
        let child = '';
        let hasChild = false;
        const procs = processObj[path];
        if (procs.length > 1) {
            hasChild = true;
            child += `
                    <ul class="tree-ui-sortable">
                `;
            for (const i in procs) {
                const proc = procs[i];
                child += `
                   <li class="custom-control custom-checkbox">
                        <input type="checkbox" data-path="${path}" id="${path}-${proc.name_en}" ${proc.isChecked ? 'checked' : ''} name="process" class="custom-control-input" value="${proc.id}">
                        <label for="${path}-${proc.name_en}" class="custom-control-label">${proc.shown_name}</label>
                   </li>
                `;
            }

            child += '</ul>';
        }

        // multi tree
        groupHtml += `
               <li class="custom-control custom-checkbox ${hasChild ? 'has' : ''}">
                   <span class="tree-plus expanded"></span>
                   <input type="checkbox" 
                        data-path="${path}" 
                        name="${hasChild ? 'dbSource' : 'process'}" 
                        ${!hasChild && procs[0].isChecked ? 'checked' : ''} 
                        id="${path}" value="${hasChild ? path : procs[0].id}" 
                        class="custom-control-input ${hasChild ? 'group-input' : ''}">
                   <label class="custom-control-label move ${!hasChild ? 'no-tree' : ''}" for="${path}">${hasChild ? '' : procs[0].shown_name}</label>
                   ${child}
               </li>
         `;
    }

    $('#tree-checkbox-list').html(groupHtml);
    // bind uncheck and checked node to show and hide nodes
    $('#tree-checkbox-list input[type=checkbox]').off('change', handleOnChangeProcess);
    $('#tree-checkbox-list input[type=checkbox]').on('change', handleOnChangeProcess);
    $('#tree-checkbox-list input[name=process]').change();
    $('#tree-checkbox-list').sortable({
        containment: 'parent',
        handle: '.move',
        items: '> li',
        tolerance: 'pointer',
        connectWith: '#tree-checkbox-list',
    });

    $(`.tree-ui-sortable`).sortable({
        containment: 'document',
        items: '> li',
        connectWith: '.tree-ui-sortable',
    });
};

const handleOnChangeProcess = (e) => {
    setTimeout(() => {
        handleHideNodes();
    }, 200);

    // modify process tree list and save localStore;
    const _this = $(e.currentTarget);
    const id = Number(_this.val());
    const path = _this.attr('data-path');
    const processState = getProcessState();

    if (_this.attr('id') === 'checkAll') {
        const isChecked = _this.prop('checked');
        for (const path of Object.keys(processesTree)) {
            for (const proc of processesTree[path]) {
                processState[proc.name] = isChecked;
                proc.isChecked = isChecked;
            }
        }
    }

    if (path) {
        // if click to id = Str -> get all subCheckbox and modify;
        for (const proc of processesTree[path]) {
            const isChecked = _this.prop('checked');
            if (!_.isNaN(id)) {
                if (proc.id === id) {
                    processState[proc.name] = isChecked;
                    proc.isChecked = isChecked;
                    break;
                }
            } else {
                processState[proc.name] = isChecked;
                proc.isChecked = isChecked;
            }
        }
    }

    saveProcessState(processState);

    // allCheck input handling
    handleAllCheckInput(_this);
};

const getProcessState = () => {
    const data = localStorage.getItem(TRACE_PROCESS_STATE);
    return data ? JSON.parse(data) : {};
};

const saveProcessState = (processObj) => {
    localStorage.setItem(TRACE_PROCESS_STATE, JSON.stringify(processObj));
};

const groupProcessesByPath = (processes) => {
    // if is linked -> isChecked = true;
    const processObj = {};
    const processState = getProcessState();
    for (const proc of processes) {
        let key = proc.datalink_tree_directory;
        const processName = proc.name;
        proc.isChecked = processState[processName] !== undefined ? processState[processName] : true;
        proc.treeOder = 0;
        if (key in processObj) {
            processObj[key].push(proc);
        } else {
            processObj[key] = [proc];
        }
    }

    return processObj;
};

const handleHideNodes = () => {
    const hiddenIds = [];
    const checkEls = [...$('.tree input[name=process]')];

    // hide uncheck nodes and show checked nodes
    for (const el of checkEls) {
        const id = Number($(el).val());
        const isHiddenNode = $(el).prop('checked') ? false : true;
        const node = nodes.get(id);
        nodes.update({
            ...node,
            hidden: isHiddenNode,
        });
        if (isHiddenNode) {
            hiddenIds.push(id);
        }
    }

    // show all edges
    for (const edgeId of edges.getIds()) {
        const edgeData = edges.get(edgeId);
        edges.update({
            ...edgeData,
            hidden: false,
        });
    }

    // hide edge of hidden nodes
    for (const id of hiddenIds) {
        for (const edgeId of edges.getIds()) {
            const edgeData = edges.get(edgeId);
            const { from, to } = edgeData;
            if (Number(from) === id || Number(to) === id) {
                edges.update({
                    ...edgeData,
                    hidden: true,
                });
            }
        }
    }
};

const collectCheckedProcess = () => {
    return [...$('.tree input[name=process]:checked')].map((el) => Number($(el).val()));
};

const handleResetCheckedEdge = () => {
    const checkedProcess = collectCheckedProcess();
    for (const procId of checkedProcess) {
        removeLinkedEdge(procId);
    }
};

const handleAddCheckedEdge = () => {
    const checkedProcess = collectCheckedProcess();
    linkProcesses(checkedProcess);
};

const handleSelectAllNodes = (checkAllInput) => {
    const allNodes = $('#tree-checkbox-list').find('input[type=checkbox]').not('#checkAll');
    const currentStatus = $(checkAllInput).is(':checked');
    allNodes.prop('checked', currentStatus);
};

const handleAllCheckInput = (input) => {
    const allNodes = $('#tree-checkbox-list').find('input[type=checkbox]').not('#checkAll').not('.group-input');
    const checkAllInput = $('#tree-checkbox-list input#checkAll');
    const currentStatus = input.is(':checked');
    if (!currentStatus) {
        checkAllInput.prop('checked', currentStatus);
    } else {
        const checkedNodes = $('#tree-checkbox-list')
            .find('input[type=checkbox]:checked')
            .not('#checkAll')
            .not('.group-input');
        if (checkedNodes.length == allNodes.length) {
            checkAllInput.prop('checked', currentStatus);
        }
    }
};
