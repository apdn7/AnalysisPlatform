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
            from: parseInt(fromProc.id),
            to: parseInt(toProc.id),
            target_proc: parseInt(toProc.id),
            self_proc: parseInt(fromProc.id),
            self_col: [parseInt(fromProc.serial_column_id)],
            back_orig_col: [parseInt(fromProc.serial_column_id)],
            target_col: [parseInt(toProc.serial_column_id)],
            target_orig_col: [parseInt(toProc.serial_column_id)],
            id: create_UUID(),
            font: {
                multi: false,
                strokeColor: COLOR.background,
                align: 'top',
            },
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

    try {
        const loadingObj = loadingHandler();
        loadingObj.show();
        const groupsOrderedProcesses = await getAutolinkGroups(selectedProcessIds);
        loadingObj.hide();

        // update order of process on tree list
        orderProcessInTreeCheckBox(groupsOrderedProcesses);

        // link process
        const goodGroups = groupsOrderedProcesses.filter((group) => group.length >= 1);
        for (const group of goodGroups) {
            linkProcesses(group);
        }
    } catch (e) {
        console.error(e);
        loading.hide();
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
    handleAllCheckInput(_this);
};

/**
 * @description Generate check box of all processes inside of network visualization.
 * @param processObj {
 *     path: processesList[{id: 1, name: '', isChecked: true|false}]
 * }
 */
const generateTreeCheckBoxs = (processObj) => {
    let groupHtml = '';

    let itemCount = 0;
    let checkedItemCount = 0;

    for (const path of Object.keys(processObj)) {
        let child = '';
        let hasChild = false;
        const procs = processObj[path];
        let checkedItemInGroupCount = 0;
        if (procs.length > 1) {
            hasChild = true;
            child += `
                    <ul class="tree-ui-sortable">
                `;

            for (const i in procs) {
                const proc = procs[i];
                // do not show checkbox when hidden
                if (proc.hidden) continue;
                itemCount++;
                if (proc.isChecked) {
                    checkedItemInGroupCount++;
                    checkedItemCount++;
                }
                child += `
                   <li class="custom-control custom-checkbox">
                        <input type="checkbox" data-path="${path}" id="${path}-${proc.name_en}" ${proc.isChecked ? 'checked' : ''} name="process" class="custom-control-input" value="${proc.id}">
                        <label for="${path}-${proc.name_en}" class="custom-control-label">${proc.shown_name}</label>
                   </li>
                `;
            }

            child += '</ul>';
        } else {
            // do not show checkbox when hidden
            if (procs[0].hidden) continue;
            itemCount++;
            if (procs[0].isChecked) {
                checkedItemCount++;
            }
        }

        // multi tree
        const isTreeChecked = hasChild && checkedItemInGroupCount == procs.length;
        groupHtml += `
               <li class="custom-control custom-checkbox ${hasChild ? 'has' : ''}">
                   <span class="tree-plus expanded"></span>
                   <input type="checkbox" 
                        data-path="${path}" 
                        name="${hasChild ? 'dbSource' : 'process'}" 
                        ${!hasChild && procs[0].isChecked ? 'checked' : isTreeChecked ? 'checked' : ''} 
                        id="${path}" value="${hasChild ? path : procs[0].id}" 
                        class="custom-control-input ${hasChild ? 'group-input' : ''}">
                   <label class="custom-control-label move ${!hasChild ? 'no-tree' : ''}" for="${path}">${hasChild ? '' : procs[0].shown_name}</label>
                   ${child}
               </li>
         `;
    }

    const isAllChecked = itemCount == checkedItemCount;

    // for all selection
    const allCheckBoxHtml = `<li class="custom-control custom-checkbox ">
               <span class="tree-plus expanded"></span>
               <input type="checkbox" id="checkAll" name="checkAll" class="custom-control-input" onchange="handleSelectAllNodes(this);" ${isAllChecked ? 'checked' : ''}>
               <label class="custom-control-label move no-tree" for="checkAll">${i18nCommon.allSelection || 'All'}</label>
      </li>`;

    keepNodeStatus(processObj);

    $('#tree-checkbox-list').html(allCheckBoxHtml + groupHtml);
    // bind uncheck and checked node to show and hide nodes
    $('#tree-checkbox-list input[type=checkbox]').off('change', handleOnChangeProcess);
    $('#tree-checkbox-list input[type=checkbox]').on('change', handleOnChangeProcess);

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

/**
 * @description Keep the status shown | hidden or process when reload. The process state be save in localstorage.
 * @param processObj
 */
const keepNodeStatus = (processObj) => {
    for (const path of Object.keys(processObj)) {
        const procs = processObj[path];
        if (procs.length > 1) {
            for (const i in procs) {
                const proc = procs[i];
                const isHidden = proc.hidden || !proc.isChecked;
                updateProcessState(proc.id, proc.datalink_tree_directory, proc.isChecked, proc.id);
                toggleNodeById(proc.id, isHidden);
            }
        } else {
            const proc = procs[0];
            const isHidden = proc.hidden || !proc.isChecked;
            updateProcessState(proc.id, proc.datalink_tree_directory, proc.isChecked, proc.id);
            toggleNodeById(proc.id, isHidden);
        }
    }
};

/**
 * @description Update process state when click check box.
 * @param procId
 * @param path
 * @param isChecked
 * @param elementId
 */

const updateProcessState = (procId, path, isChecked, elementId) => {
    const processState = getProcessState();
    if (elementId === 'checkAll') {
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
            if (!_.isNaN(procId)) {
                if (proc.id === procId) {
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
};

const handleOnChangeProcess = (e) => {
    // modify process tree list and save localStore;
    const _this = $(e.currentTarget);
    const id = Number(_this.val());
    const name = _this.attr('name');
    const path = _this.attr('data-path');
    const eleId = _this.attr('id');
    const isChecked = _this.prop('checked');

    updateProcessState(id, path, isChecked, eleId);

    if (['checkAll', 'dbSource'].includes(name)) {
        toggleNodes(name, path, !isChecked);
    } else {
        toggleNodeById(id, !isChecked);
    }

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

/**
 * @description Toggle show or hide the node by nodeId (processId) and show or hide the edge of this node.
 * @param nodeId
 * @param isHidden
 */

const toggleNodeById = (nodeId, isHidden) => {
    const node = nodes.get(nodeId);
    nodes.update({
        ...node,
        hidden: isHidden,
    });

    // hide id of hidden node
    for (const edgeId of edges.getIds()) {
        const edgeData = edges.get(edgeId);
        const { from, to } = edgeData;
        if (isHidden) {
            if (Number(from) === nodeId || Number(to) === nodeId) {
                edges.update({
                    ...edgeData,
                    hidden: true,
                });
            }
        } else {
            // show edge if from and to node is shown
            const fromNode = nodes.get(Number(from));
            const toNode = nodes.get(Number(to));
            if (fromNode && !fromNode.hidden && toNode && !toNode.hidden) {
                edges.update({
                    ...edgeData,
                    hidden: false,
                });
            }
        }
    }
};

/**
 * @description: show or hide all processes when check all check or the group of tree checkbox
 * @param group checkAll | dbSource
 * @param dbSourceId
 */
const toggleNodes = (group = '', dbSourceId, isHidden) => {
    let checkEls = [];
    if (group == 'checkAll') {
        // toggle all nodes
        checkEls = [...$('.tree input[name=process]')];
    }

    if (group == 'dbSource') {
        // toggle group of this dbSource
        checkEls = [...$(`.tree input[name=process][data-path=${dbSourceId}]`)];
    }

    for (const el of checkEls) {
        const id = Number($(el).val());
        toggleNodeById(id, isHidden);
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
