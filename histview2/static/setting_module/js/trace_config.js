/* eslint-disable consistent-return,prefer-destructuring */
/* eslint-disable array-callback-return */
/* eslint-disable no-use-before-define */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

// TODO use class

// global variable to store data of processes
const processes = [];

const configOption = JSON.parse(localStorage.getItem('network-config')) || {};
let hierarchicalDirection = configOption.direction || 'LR';
let nodesPosition = configOption.nodesPosition || {};
const moveToOptions = configOption.moveto || {};
// global variable to store data of processes as Vis nodes
const nodes = new vis.DataSet();
const edges = new vis.DataSet();

// currently visjs doesn't allow us to save many information to edge -> use a global map
const mapIdFromIdTo2Edge = {};

const NORMAL_TYPE = 'Star';

const data = {
    nodes,
    edges,
};
let network = null;
let container = null;
const COLOR = {
    node: 'rgba(137, 179, 104, 1)',
    nodeBorder: '#658f44',
    nodeHighlight: '#32afd7',
    font: '#ebebeb',
    edge: '#658f44',
    edgeHighlight: '#32afd7',
    prediction: '#375a7f',
    real: 'seagreen',
    realStartProc: '#ffffff',
    background: 'rgba(0, 0, 0, 0)',
};

const SEED = 2;
const SEP_LABEL = '\n';
const SEP_PROC = '-';
const SEP_TITLE = '<br>';

// define custom locales
const i18nNames = {
    allDigits: $('#i18nAllDigits').text(),
    partialMatch: $('#i18nPartialMatch').text(),
    thCharacter: $('#i18nThCharacter').text(),
    jobList: $('#i18nJobList').text(),
    startLink: $('#i18nStartLink').text(),
    checkProgress: $('#i18nCheckProgress').text(),
    i18nNoColumn: $('#i18nNoColumn').text(),
    edgeLinkTitlePred: $('#i18nEdgeLinkTitlePred').text(),
    edgeLinkTitleReal: $('#i18nEdgeLinkTitleReal').text(),
    nodeLinkTitlePred: $('#i18nNodeLinkTitlePred').text(),
    nodeLinkTitleReal: $('#i18nNodeLinkTitleReal').text(),
};
const locale = docCookies.getItem('locale') === 'ja' ? 'jp' : docCookies.getItem('locale');
const locales = {};
locales[locale] = {
    edit: $('#i18nEdit').text(),
    del: $('#i18nDelete').text(),
    back: $('#i18nBack').text(),
    addNode: $('#i18nAddNode').text(),
    addEdge: $('#i18nAddEdge').text(),
    editNode: $('#i18nEditNode').text(),
    editEdge: $('#i18nEditEdge').text(),
    addDescription: $('#i18nAddDesc').text(),
    edgeDescription: $('#i18nEdgeDesc').text(),
    editEdgeDescription: $('#i18nEditEdgeDesc').text(),
    createEdgeError: $('#i18nCreateEdgeErr').text(),
    deleteClusterError: $('#i18nDeleteClusterErr').text(),
    editClusterError: $('#i18nEditClusterErr').text(),
};

const tracingElements = {
    edgeBackColParent: '#edgeBackColParent',
    edgeFwColParent: '#edgeForwardColParent',
    subStrOpt: 'subStrOpt',
    fromDigits: 'fromDigit',
    toDigits: 'toDigit',
    btnAddTraceKey: $('#btnAddNewTraceKey'),
    confirmReloadBtn: '#confirmReloadBtn',
    confirmReloadModal: '#confirmReloadModal',
    edgeBackProc: $('#edgeBackProc'),
    edgeForwardProc: $('#edgeForwardProc'),
};

const destroy = () => {
    if (network !== null) {
        network.destroy();
        network = null;
    }
};

const cancelEdgeEdit = (callback) => {
    callback(null);
};

const isStarType = () => hierarchicalDirection === 'Star';

const getMatchingDigits = (item) => {
    const result = $(item).find(`input[name*="${tracingElements.subStrOpt}"]:checked`)
        .map((i, e) => {
            const itemId = $(e).attr('id').split('-')[1];
            // if ($(`#checkbox-${itemId}`).prop('checked')) {
            if ($(e).val() === '0') {
                return [];
            }
            const fromDigit = $(`select[name="${tracingElements.fromDigits}-${itemId}"]`).val();
            const toDigits = $(`select[name="${tracingElements.toDigits}-${itemId}"]`).val();
            return [Number(fromDigit), Number(toDigits)];
            // }
        })
        .toArray();
    return result;
};

// TODO refactor i18n
const validateSubStr = (selfSubstr, targetSubstr) => {
    // selfSubstr, targetSubstr [[1,3], [2,4]]
    const invalidOpts = self => self.filter(([s, e]) => s > e);
    // Check valid options
    if (invalidOpts(selfSubstr).length > 0
        || invalidOpts(targetSubstr).length > 0
        || selfSubstr.length !== targetSubstr.length) {
        return {
            is_valid: false,
            message: $('#i18nInvalidDigit').text(),
        };
    }

    // Check self digits same as target digits
    const invalidDigits = targetSubstr.filter((e, i) => {
        if (selfSubstr[i] !== undefined && selfSubstr[i].length > 0 && e.length > 0) {
            return e[1] - e[0] !== selfSubstr[i][1] - selfSubstr[i][0];
        }
    }, selfSubstr);
    if (invalidDigits.length > 0) {
        return {
            is_valid: false,
            message: $('#i18nCharacterLengthDiff').text(),
        };
    }
    return {
        is_valid: true,
        message: $('#i18nInvalidDigit').text(),
    };
};

const saveEdgeDataToGlobal = (edgeData, callback) => {
    if (typeof edgeData.to === 'object') edgeData.to = edgeData.to.id;
    if (typeof edgeData.from === 'object') edgeData.from = edgeData.from.id;
    edgeData.arrows = 'to';

    // get Trace Target Data from modal
    const targetProcId = $('select[name="edgeForwardProc"]').val();
    edgeData.target_proc = targetProcId;
    const targetCols = [];
    const targetOrgCols = [];
    const targetSubStrs = [];
    $('div[id^="edgeForwardCol-"]').find('.form-group').each(function f(idx) {
        const colElement = $(this).find('select[name=forwardCol]');
        targetSubStrs.push(getMatchingDigits($(this)));
        const colAlias = $('option:selected', colElement).attr('alias');
        const colOrg = $('option:selected', colElement).attr('original');
        if (!isEmpty(colAlias)) targetCols.push(colAlias);
        if (!isEmpty(colOrg)) targetOrgCols.push(colOrg);
    });
    edgeData.target_col = targetCols;
    edgeData.target_orig_col = targetOrgCols;
    edgeData.target_substr = targetSubStrs;


    // get Trace Self Data from modal
    const selfProcId = $('select[name="edgeBackProc"]').val();
    edgeData.self_proc = selfProcId;
    const selfCols = [];
    const selfOrgCols = [];
    const selfSubStrs = [];
    $('div[id^="edgeBackCol-"]').find('.form-group').each(function f(idx) {
        const colElement = $(this).find('select[name=backCol]');
        selfSubStrs.push(getMatchingDigits($(this)));
        const colAlias = $('option:selected', colElement).attr('alias');
        const colOrg = $('option:selected', colElement).attr('original');
        if (!isEmpty(colAlias)) selfCols.push(colAlias);
        if (!isEmpty(colOrg)) selfOrgCols.push(colOrg);
    });
    edgeData.self_col = selfCols;
    edgeData.back_orig_col = selfOrgCols;
    edgeData.self_substr = selfSubStrs;

    // validate: choose at least 1 column to trace
    if (selfCols.length === 0 || targetCols.length === 0) {
        displayRegisterMessage(
            '#alertMsgCheckSubStr', {
                message: i18nNames.i18nNoColumn,
                is_error: true,
            },
        );
        return;
    }

    validEdge = validateSubStr(edgeData.self_substr, edgeData.target_substr);
    if (!validEdge.is_valid) {
        displayRegisterMessage(
            '#alertMsgCheckSubStr', {
                message: validEdge.message,
                is_error: true,
            },
        );
        return;
    }

    // save data to external/global dict
    mapIdFromIdTo2Edge[`${edgeData.from}-${edgeData.to}`] = edgeData;

    callback(edgeData);
    $('#modal-edge-popup').modal('hide');
    return edgeData;
};

const objectToArray = obj => Object.keys(obj).map((key) => {
    obj[key].id = key;
    return obj[key];
});

const resizeExportArea = () => {
    exportArea.style.height = `${1 + exportArea.scrollHeight}px`;
};

// get alias of a column
const getAliasFromField = (col) => {
    const splits = col.split(' as ');
    if (splits.length > 0) {
        const lastEl = splits[splits.length - 1];
        return lastEl.replace(/"| |'/g, '');
    }
    return col;
};

// get original column name of a column
const getOrigColumnFromField = (col) => {
    const splits = col.split(' as ');
    if (splits.length > 0) {
        const lastEl = splits[0];
        return lastEl.replace(/"| |'/g, '');
    }
    return col;
};

let targetProc = null;
let targetColCandidates = [];
let targetColCandidateMasters = [];
let selectedTargetCols = [];
let targetSubStrOpt = [];
let targetColNames = [];

let selfProc = null;
let selfSubStrOpt = [];
let selectedSelfCols = [];
let selfColCandidates = [];
let selfColCandidateMasters = [];
let selfColNames = [];

const layoutOption = () => {
    if (hierarchicalDirection !== NORMAL_TYPE) {
        return {
            physics: {
                enabled: false,
            },
            layout: {
                randomSeed: SEED,
                hierarchical: {
                    enabled: true,
                    edgeMinimization: false,
                    direction: hierarchicalDirection,
                    nodeSpacing: 150,
                    sortMethod: 'directed',
                },
            },
        };
    }

    return {};
};

const drawVisNetwork = (layout = layoutOption()) => {
    destroy();

    // create a network
    container = document.getElementById('trace-network');
    const options = {
        interaction: {
            navigationButtons: true,
            keyboard: false,
        },
        nodes: {
            shape: 'dot',
            size: 15,
            labelHighlightBold: true,
            color: {
                border: COLOR.nodeBorder,
                background: COLOR.node,
                highlight: {
                    border: COLOR.nodeHighlight,
                    background: COLOR.nodeHighlight,
                },
                hover: {
                    border: COLOR.nodeHighlight,
                    background: COLOR.nodeHighlight,
                },
            },
            font: {
                color: COLOR.font,
                bold: {},
            },
            borderWidth: 2,
            shadow: true,
        },
        edges: {
            color: {
                color: COLOR.edge,
                highlight: COLOR.edgeHighlight,
                hover: COLOR.edgeHighlight,
            },
            width: 2,
            shadow: true,
            font: {},
        },
        ...layout,
        locale,
        locales,
        manipulation: {
            addNode: false,
            deleteNode: false,
            addEdge(edgeData, callback) {
                handleAddEdge(edgeData, callback);
            },
            editEdge: {
                editWithoutDrag(edgeData, callback) {
                    handleEditEdge(edgeData, callback);
                },
            },
            deleteEdge(edgeData, callback) {
                const edgeId = edgeData.edges[0];
                const edge = network.body.edges[edgeId];
                const selfProcId = edge.fromId;
                const targetProcId = edge.toId;


                // delete from graph
                callback(edgeData);

                // remove from global map
                delete mapIdFromIdTo2Edge[`${selfProcId}-${targetProcId}`];
            },
        },
    };

    network = new vis.Network(container, data, options);

    network.moveTo(moveToOptions);
    container.addEventListener('contextmenu', networkRightClickHandler);
    container.addEventListener('click', unbindNodes);
    network.on('doubleClick', (params) => {
        if (params.nodes.length > 0) {
            network.addEdgeMode();
        }
    });

    network.on('dragEnd', () => {
        getNodePositionAndSaveLocal();
    });

    $('#traceNetworkLayout').val(hierarchicalDirection);
    $('#traceNetworkLayout').off('change').on('change', (e) => {
        hierarchicalDirection = e.currentTarget.value;
        drawVisNetwork();
        saveLocalStorage();
    });

    container.addEventListener('mouseleave', () => {
        moveToOptions.scale = network.getScale();
        moveToOptions.position = network.getViewPosition();
        saveLocalStorage();
    });
};

const getNodePositionAndSaveLocal = () => {
    nodesPosition = {};
    _.forEach(nodes.getIds(), (id) => {
        nodesPosition = Object.assign(nodesPosition, network.getPositions(id));
    });
    saveLocalStorage();
};

const saveLocalStorage = () => {
    localStorage.setItem('network-config', JSON.stringify({
        moveto: moveToOptions,
        direction: hierarchicalDirection,
        nodesPosition,
    }));
};

const handleEditEdge = (edgeData, callback) => {
    // Clear Message
    $('#alertMsgCheckSubStr').hide();
    // get data from external dict
    const edgeDataFull = mapIdFromIdTo2Edge[`${edgeData.from.id}-${edgeData.to.id}`];
    if (edgeDataFull) {
        edgeData.target_proc = edgeDataFull.target_proc;
        edgeData.target_col = edgeDataFull.target_col;
        edgeData.self_proc = edgeDataFull.self_proc;
        edgeData.self_col = edgeDataFull.self_col;
        edgeData.self_substr = edgeDataFull.self_substr;
        edgeData.target_substr = edgeDataFull.target_substr;
    }

    // save edited edge
    // document.getElementById('btnSaveEditEdge')
    //     .onclick = saveEdgeDataToGlobal.bind(this, edgeData, callback);
    //
    // // cancel edit edge
    // document.getElementById('btnCancelEditEdge').onclick = cancelEdgeEdit.bind(this, callback);
    // $('#modal-edge-popup').on('hidden.bs.modal', () => {
    //     document.getElementById('btnCancelEditEdge').onclick();
    // });

    // set target proc name
    targetProc = edgeData.target_proc;
    tracingElements.edgeForwardProc.select2().val(targetProc);

    // set self proc name
    selfProc = edgeData.self_proc;
    const currentVal = tracingElements.edgeBackProc.val();
    if (currentVal !== selfProc) {
        tracingElements.edgeBackProc.select2().val(selfProc);
    }

    getInforToGenerateColumns(selfProc, targetProc, edgeData);
    addTraceKey();

    tracingElements.btnAddTraceKey.attr('disabled', false);

    $('#modal-edge-popup').modal('show');

    onChangeProcs(edgeData);
};

const onChangeProcs = (edgeData) => {
    tracingElements.edgeBackProc.off('change');
    tracingElements.edgeBackProc.on('change', (e) => {
        try {
            setTimeout(() => {
                let from = '';
                let to = '';
                if (typeof edgeData.to === 'object') edgeData.to = edgeData.to.id;
                if (typeof edgeData.from === 'object') edgeData.from = edgeData.from.id;
                edgeData.from = e.currentTarget.value;
                from = edgeData.from;
                to = edgeData.to;
                if (from && to) {
                    getInforToGenerateColumns(from, to, edgeData);
                    addTraceKey();
                }
            });
        } catch (error) {
            console.log(error);
        }
    });

    tracingElements.edgeForwardProc.off('change');
    tracingElements.edgeForwardProc.on('change', (e) => {
        try {
            setTimeout(() => {
                let from = '';
                let to = '';
                if (typeof edgeData.to === 'object') edgeData.to = edgeData.to.id;
                if (typeof edgeData.from === 'object') edgeData.from = edgeData.from.id;
                edgeData.to = e.currentTarget.value;
                from = edgeData.from;
                to = edgeData.to;
                console.log(edgeData);

                if (from && to) {
                    getInforToGenerateColumns(from, to, edgeData);
                    addTraceKey();
                }
            });
        } catch (error) {
            console.log(error);
        }
    });
};

const getInforToGenerateColumns = (selfProcId, targetProcId, edgeData) => {
    if (typeof edgeData.self_col !== 'object') {
        selectedSelfCols = [edgeData.self_col];
    } else {
        selectedSelfCols = [...edgeData.self_col];
    }

    const selfSerialColumns = processes[selfProcId].columns.filter(e => e.is_serial_no);
    selfColCandidates = selfSerialColumns.map(e => e.id);
    selfColCandidateMasters = selfSerialColumns.map(e => e.name);
    selfColNames = selfSerialColumns.map(e => e.column_name);

    if (typeof edgeData.target_col !== 'object') {
        selectedTargetCols = [edgeData.target_col];
    } else {
        selectedTargetCols = [...edgeData.target_col];
    }

    const targetSerialColumns = processes[targetProcId].columns.filter(e => e.is_serial_no);
    targetColCandidates = targetSerialColumns.map(e => e.id);
    targetColCandidateMasters = targetSerialColumns.map(e => e.name);
    targetColNames = targetSerialColumns.map(e => e.column_name);

    // substring option selected
    targetSubStrOpt = edgeData.target_substr;
    selfSubStrOpt = edgeData.self_substr;
};


const initVisData = (processesArray) => {
    // clear vis data
    edges.clear();
    nodes.clear();
    for (const key in mapIdFromIdTo2Edge) delete mapIdFromIdTo2Edge[key];

    // update processes from global const
    // create Vis nodes from processes data
    let procTraces = [];
    for (const key in processesArray) {
        const procCopy = { ...processesArray[key] };
        procCopy.master = procCopy.name;
        procCopy.font = { multi: 'html' };
        procCopy.label = `${procCopy.name}`;
        nodes.add(procCopy);

        const trace = procCopy.traces;
        if (!isEmpty(trace)) {
            procTraces = [...procTraces, ...trace];
        }
        processes[procCopy.id] = procCopy;
    }


    // create Vis edge from processes trace data
    // use trace forward to create edges
    procTraces.forEach((trace) => {
        const edge = {
            from: trace.self_process_id,
            to: trace.target_process_id,
            arrows: 'to',
            font: { multi: 'html', strokeColor: COLOR.background, align: 'top' },
            self_proc: trace.self_process_id,
            target_proc: trace.target_process_id,
            self_col: trace.trace_keys.map(key => key.self_column_id),
            target_col: trace.trace_keys.map(key => key.target_column_id),
            self_substr: trace.trace_keys.map(key => [key.self_column_substr_from, key.self_column_substr_to]),
            target_substr: trace.trace_keys.map(key => [key.target_column_substr_from, key.target_column_substr_to]),
        };
        const edgeKey = `${trace.self_process_id}-${trace.target_process_id}`;
        mapIdFromIdTo2Edge[edgeKey] = edge;
    });

    data.nodes = nodes;
    data.edges.add(Object.values(mapIdFromIdTo2Edge));
};

const init = () => {
    // get trace config data after loading page
    reloadTraceConfigFromDB();
};


// Generate Sub string options
const digitOptions = position => [...Array(100).keys()].map((x) => {
    let digitChecked = '';
    if (position === x + 1) {
        digitChecked = 'selected="selected"';
    } else {
        digitChecked = '';
    }
    return `<option value="${x + 1}" ${digitChecked}>${x + 1}</option>`;
}, position);


const addAutoCheckPartialMatch = () => {
    // auto select partial-radio
    $('.partial-digit').each(function f() {
        $(this).on('change', function autoSelectSubstr() {
            $($(this).closest('.partial-option').find('.partial-radio')[0]).prop('checked', 1);
        });
    });
};

const addGroupListSelection = (parentId, id, itemName, itemVals, itemOrgCols = null, itemAliases = null,
    checkedVals = null, itemDisplayNames = [], subStrOpt = [], forwardCol = null, clearOption = true,
    columnNames = []) => {
    if (clearOption) $(`#${parentId}`).empty();

    // items
    const itemList = [];
    checkedVals.forEach((selector, i) => {
        if (selector) {
            const itemId = i + generateRandomString(6);
            const itemOrgCol = itemOrgCols[i];
            let defaultSelected = '';
            let subSelected = '';
            let starDigit = 1;
            let endDigit = 1;
            if (subStrOpt.length > 0 && subStrOpt[i] !== undefined) {
                // Update Edge
                if (!subStrOpt[i].length || subStrOpt[i].some(digit => !digit)) { // all substring digits >= 1
                    defaultSelected = 'checked="checked"';
                } else {
                    subSelected = 'checked="checked"';
                    [starDigit, endDigit] = subStrOpt[i];
                }
            } else {
                // Add new edge
                defaultSelected = 'checked="checked"';
            }

            const fromOptions = digitOptions(starDigit).join('');
            const toOptions = digitOptions(endDigit).join('');
            const options = itemAliases.map((v, k) => {
                const selected = `${v}` === `${selector}` ? ' selected="selected"' : '';
                return `<option value="${v}"${selected} alias="${itemAliases[k]}"
                    original="${itemOrgCols[k]}" title="${columnNames[k]}">${itemDisplayNames[k]}</option>`;
            },
            selector,
            itemDisplayNames).join('');
            itemList.push(`<div class="col-sm-6" id="${id}">
                    <div class="form-group" id="list-${id}${i}">
                    <div class="">
                        <select class="form-control select2-selection--single select-n-columns" name="${itemName}"
                            id="checkbox-${itemId}"
                            original="${itemOrgCol}"
                            onChange="updateSelectedColumns()">
                            ${options}
                        </select>
                    </div>
                    <div class="form-check" style="margin-top: 10px;">
                        <div class="custom-control custom-radio custom-control">
                            <input type="radio" id="subStrOpt-${itemId}"
                                name="subStrOpt-${itemId}"
                                class="custom-control-input" value="0" ${defaultSelected}>
                            <label class="custom-control-label" for="subStrOpt-${itemId}">
                                ${i18nNames.allDigits}
                            </label>
                        </div>
                    </div>
                    <div class="form-check" style="margin-top: 10px;">
                        <div class="custom-control custom-radio custom-control-inline partial-option">
                            <input type="radio" id="subStrOpt2-${itemId}"
                                name="subStrOpt-${itemId}"
                                class="custom-control-input partial-radio" value="1" ${subSelected}>
                            <label class="custom-control-label" for="subStrOpt2-${itemId}">
                                ${i18nNames.partialMatch}
                            </label>
                            <div class="col-auto">
                                <select class="form-control select2-selection--single partial-digit" name="fromDigit-${itemId}">${fromOptions}</select>
                            </div>
                            <div class="col-auto">
                                <h5>${COMMON_CONSTANT.EN_DASH}</h5>
                            </div>
                            <div class="col-auto">
                                <select class="form-control select2-selection--single partial-digit" name="toDigit-${itemId}">${toOptions}</select>
                            </div>
                            <div class="col-auto">
                                <label for="select-">${i18nNames.thCharacter}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`);
        }
    });
    // const groupList = itemList.join(' ');

    // $(`#${parentId}`).append(groupList);
    return itemList;
};

const getSelectedColumns = (allSelectedColElements) => {
    const selectedCols = [];
    // const allSelectedElements = $(formElements.endProcSelectedItem);

    if (allSelectedColElements.length > 0) {
        Array.prototype.forEach.call(allSelectedColElements, (element) => {
            if (element.value && selectedCols.includes(element.value) === false) {
                selectedCols.push(element.value);
            }
        });
    }
    return selectedCols;
};

let targetChosenTraceKeys = [];
let selfChosenTraceKeys = [];

// TODO check validation
const updateSelectedColumns = (isForce = false) => {
    const allSelectedTargetColElements = $('select[name=forwardCol]');
    const allChosenTargetCols = getSelectedColumns(allSelectedTargetColElements);
    const allSelectedTargetCols = allSelectedTargetColElements.get();
    targetChosenTraceKeys = allChosenTargetCols;

    Array.prototype.forEach.call(allSelectedTargetCols, (selected) => {
        const currentCardSelector = $(selected).val();
        $.each($(selected).find('option'), (key, option) => {
            const optionVal = $(option).val();
            if (allChosenTargetCols.includes(optionVal) && currentCardSelector !== optionVal) {
                $(option).attr('disabled', 'disabled');
            } else if (!allChosenTargetCols.includes(optionVal)) {
                $(option).removeAttr('disabled');
            }
        });
    });


    const allSelectedSelfColElements = $('select[name=backCol]');
    const allChosenSelfCols = getSelectedColumns(allSelectedSelfColElements);
    const allSelectedSelfCols = allSelectedSelfColElements.get();
    selfChosenTraceKeys = allChosenSelfCols;

    Array.prototype.forEach.call(allSelectedSelfCols, (selected) => {
        const currentCardSelector = $(selected).val();
        $.each($(selected).find('option'), (key, option) => {
            const optionVal = $(option).val();
            if (allChosenSelfCols.includes(optionVal) && currentCardSelector !== optionVal) {
                $(option).attr('disabled', 'disabled');
            } else if (!allChosenSelfCols.includes(optionVal)) {
                $(option).removeAttr('disabled');
            }
        });
    });

    // disable ADD button if all columns are selected
    if (allChosenSelfCols.length >= selfColCandidates.length
        || allChosenTargetCols.length >= targetColCandidates.length) {
        tracingElements.btnAddTraceKey.attr('disabled', true);
    } else {
        tracingElements.btnAddTraceKey.attr('disabled', false);
        // if there is no trace content then add automatically
        if ($('#traceInfoModal').children().length <= 0 && !isForce) {
            tracingElements.btnAddTraceKey.trigger('click');
        }
    }
};


const addTraceKey = (isNew = false) => {
    let unusedTargetCols = [];
    let unusedSelfCols = [];
    if (isNew) {
        unusedTargetCols = targetColCandidates.filter(
            chosen => !targetChosenTraceKeys.find(remain => `${remain}` === `${chosen}`),
        );
        unusedSelfCols = selfColCandidates.filter(
            chosen => !selfChosenTraceKeys.find(remain => `${remain}` === `${chosen}`),
        );
    }
    const selectedColumns = [];
    const idPostfix = `-${generateRandomString(5)}`;

    const fwdColumns = addGroupListSelection('edgeForwardColParent', `edgeForwardCol${idPostfix}`, 'forwardCol',
        targetColCandidates,
        itemOrgCols = targetColCandidates,
        itemAliases = targetColCandidates,
        checkedVals = isNew ? [unusedTargetCols[0]] : selectedTargetCols,
        itemDisplayNames = targetColCandidateMasters,
        subStrOpt = isNew ? [] : targetSubStrOpt,
        forwardCol = true,
        clearOption = !isNew,
        columnNames = targetColNames);

    const bwdColumns = addGroupListSelection('edgeBackColParent', `edgeBackCol${idPostfix}`, 'backCol',
        selfColCandidates,
        itemOrgs = selfColCandidates,
        itemAliases = selfColCandidates,
        checkedVals = isNew ? [unusedSelfCols[0]] : selectedSelfCols,
        itemDisplayNames = selfColCandidateMasters,
        subStrOpt = isNew ? [] : selfSubStrOpt,
        forwardCol = false,
        clearOption = !isNew,
        columnNames = selfColNames);

    if (fwdColumns.length === bwdColumns.length) {
        for (let i = 0; i < fwdColumns.length; i++) {
            selectedColumns.push([bwdColumns[i], fwdColumns[i]].join(''));
        }
    }

    if (!isNew) {
        $('#traceInfoModal').empty();
    }

    selectedColumns.forEach((i) => {
        const eleId = generateRandomString(6);
        const innerHTML = `<div class="form-row trc-row" id="${eleId}">
            ${i}
            <button type="button" class="close trc-remove" onclick="removeRelation('${eleId}');">
                <span>×</span>
            </button></div>`;
        $('#traceInfoModal').append(innerHTML);
    });

    // add auto check partial match option event when choose partial digits
    addAutoCheckPartialMatch();

    // update selected columns to disable selected columns
    updateSelectedColumns();

    addAttributeToElement();
};

// TODO use util
const informLinkingJobStarted = () => {
    const msgTitle = '';
    const { jobList } = i18nNames;
    const msgContent = `<p>${i18nNames.startLink}.
    <br>${i18nNames.checkProgress}.
    <p><a style="float:right;" href="/histview2/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.INFO);
};

// call backend API to save
const saveTraceConfigs = (edges) => {
    fetch('api/setting/trace_config', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(edges),
    })
        .then(response => response.clone().json())
        .then((json) => {
        })
        .catch((json) => {
        });
};

const saveTraceConfigToDB = () => {
    // get current edges
    const edges = Object.values(mapIdFromIdTo2Edge);

    // send edges to db
    saveTraceConfigs(edges);

    // show msg
    informLinkingJobStarted();
};

const syncVisData = (procs = []) => {
    initVisData(procs);
    drawVisNetwork();
};

const reloadTraceConfigFromDB = () => {
    fetch('api/setting/trace_config', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
        .then((json) => {
            // update new data
            const { procs } = JSON.parse(json.trace_config);

            // redraw vis network
            syncVisData(procs);

            // calculate proc link count
            setTimeout(realProcLink, 500);
        })
        .catch(() => {
        });
};

const removeRelation = (colId) => {
    $(`#${colId}`).remove();
    updateSelectedColumns(true);
};

$(() => {
    // simulation
    $('#btnTraceSimulation').click(() => {
        const edges = Object.values(mapIdFromIdTo2Edge);
        simulateProcLink(edges);
    });

    // show register modal
    $('#btn-trace-config-register').click(() => {
        $('#regenerate-confirm-modal').modal('show');

        // SSEの通信を待つこと。
        // const source = new EventSource('/histview2/api/setting/listen_background_job');
        const source = openServerSentEvent();
        source.addEventListener(serverSentEventType.procLink, (event) => {
            // calculate proc link count
            realProcLink();
        }, false);
    });

    // show reload confirm modal
    $('#btn-trace-config-sync').click(() => {
        $(tracingElements.confirmReloadModal).modal('show');
    });

    // reload trace config when click reload button
    $(tracingElements.confirmReloadBtn).click(() => {
        reloadTraceConfigFromDB();
        $(tracingElements.confirmReloadModal).modal('hide');
    });

    // confirm to save trace config to db
    $('#btn-proceed').click(() => {
        saveTraceConfigToDB();
    });

    // add new edge
    tracingElements.btnAddTraceKey.on('click', (e) => {
        e.preventDefault();
        addTraceKey(true);
        updateSelectedColumns();
        addAttributeToElement();
    });
});

// call backend API to save
const calcProcLink = (url, currentEdges, isPredictive = false) => {
    let bodyData = null;
    if (currentEdges) {
        bodyData = JSON.stringify(currentEdges);
    }
    fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: bodyData,
    })
        .then(response => response.clone().json())
        .then((json) => {
            // update prediction to network
            updateNodeInfo(json.nodes, isPredictive);
            updateEdgeInfo(json.edges, isPredictive);
        })
        .catch((json) => {
        });
};

// simulate proc link
const simulateProcLink = (currentEdges) => {
    calcProcLink('api/setting/simulate_proc_link', currentEdges, true);
};

// calc real proc link
const realProcLink = () => {
    calcProcLink('api/setting/count_proc_link');
};

const getProcNameFromLabel = (procId) => {
    try {
        const currentNodeLabel = nodes.get(procId).label || '';
        return currentNodeLabel.trim().split(SEP_LABEL)[0];
    } catch (e) {
        return procId;
    }
};

const updateNodeInfo = (predictionNodes, isPredictive = false) => {
    const nodesPos = configOption.nodesPosition;
    for (const procId in predictionNodes) {
        const linkCount = formatNumberWithCommas(predictionNodes[procId][0]);
        const totalCount = formatNumberWithCommas(predictionNodes[procId][1]);
        const currentProcName = getProcNameFromLabel(procId);
        const color = isPredictive ? COLOR.prediction : COLOR.real;
        const linkTitle = isPredictive ? i18nNames.edgeLinkTitlePred : i18nNames.edgeLinkTitleReal;
        const totalTitle = isPredictive ? i18nNames.nodeLinkTitlePred : i18nNames.nodeLinkTitleReal;
        const title = `${linkCount}/${totalCount} : ${linkTitle}/${totalTitle}`;
        const position = Object.keys(nodesPos).length > 0 && hierarchicalDirection !== NORMAL_TYPE ? { x: nodesPos[procId].x, y: nodesPos[procId].y } : {};

        nodes.update({
            id: procId,
            label: `${SEP_LABEL}${currentProcName}${SEP_LABEL}<b>${linkCount}/${totalCount}</b>`,
            font: {
                multi: 'html',
                bold: {
                    color,
                },
            },
            title,
            ...position,
            allowedToMoveX: true,
            allowedToMoveY: true,
        });
    }
};

const updateEdgeInfo = (predictionEdges, isPredictive = false) => {
    for (const edge in predictionEdges) {
        const linkCount = formatNumberWithCommas(predictionEdges[edge]);
        const procs = edge.split(SEP_PROC);
        const procStart = procs[0];
        const procEnd = procs[1];
        if (isEmpty(procStart) || isEmpty(procEnd)) {
            continue;
        }
        const color = isPredictive ? COLOR.prediction : COLOR.real;
        const linkTitle = isPredictive ? i18nNames.edgeLinkTitlePred : i18nNames.edgeLinkTitleReal;
        const title = `${linkCount} : ${linkTitle}`;
        for (const edgeId of edges.getIds()) {
            const edgeData = edges.get(edgeId);
            const { from, to } = edgeData;
            if (`${from}` === `${procStart}` && `${to}` === `${procEnd}`) {
                edges.update({
                    id: edgeId,
                    font: {
                        multi: 'html',
                        color,
                        align: 'top',
                        strokeWidth: 0,
                    },
                    label: `<b>${linkCount}</b>`,
                    from: procStart,
                    to: procEnd,
                    title,
                });
            }
        }
    }
};

function networkRightClickHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    // trigger nodes
    network.off('oncontext');
    network.on('oncontext', (params) => {
        const nodeID = network.getNodeAt(params.pointer.DOM);
        const edgeId = network.getEdgeAt(params.pointer.DOM);
        const selectedNode = nodeID || params.nodes[0];
        const selectedEdge = edgeId || params.edges[0];
        if (!selectedEdge && !selectedNode) return;

        const menu = $('#contextMenuTraceCfg');
        if (selectedNode) {
            // hide edge items
            $('.edge-item').hide();
            $(menu).find('li').attr('data-node-id', selectedNode);
            network.selectNodes([selectedNode]);
        }

        if (selectedEdge) {
            $('.edge-item').show();
            $(menu).find('li').attr('data-edge-id', selectedEdge);
            network.selectEdges([selectedEdge]);
        }

        // show context menu when right click timeseries
        const menuHeight = menu.height();
        const windowHeight = $(window).height();
        const left = params.event.clientX;
        let top = params.event.clientY;
        if (windowHeight - top < menuHeight) {
            top -= menuHeight;
        }
        menu.css({
            left: `${left}px`, top: `${top}px`, display: 'block',
        });
    }, false);
    return false;
}

const unbindNodes = () => {
    // network.unselectAll();
    hideContextMenu();
};
const handleAddEdge = (edgeData, callback) => {
    // Clear Message
    $('#alertMsgCheckSubStr').hide();
    // do nothing when adding self edge
    // if (edgeData.from === edgeData.to) {
    //     callback(null);
    //     return;
    // }

    // bind saving edited edge function
    // document.getElementById('btnSaveEditEdge')
    //     .onclick = saveEdgeDataToGlobal.bind(this, edgeData, callback);

    // bind cancelling edit edge function
    // document.getElementById('btnCancelEditEdge').onclick = cancelEdgeEdit.bind(this, callback);
    // $('#modal-edge-popup').on('hidden.bs.modal', () => {
    //     document.getElementById('btnCancelEditEdge').onclick();
    // });

    // set target proc name
    targetProc = edgeData.to;
    tracingElements.edgeForwardProc.select2().val(targetProc);

    // set back proc name
    selfProc = edgeData.from;
    tracingElements.edgeBackProc.select2().val(selfProc);
    getInforToGenerateColumns(selfProc, targetProc, edgeData);
    addTraceKey();
    tracingElements.btnAddTraceKey.attr('disabled', false);

    // show modal
    $('#modal-edge-popup').modal('show');

    onChangeProcs(edgeData);
};
const addEdgesFromNode = (e) => {
    $('#contextMenuTraceCfg').hide();
    const nodeId = $('#contextMenuTraceCfg li').attr('data-node-id');
    // trigger to add edge to self node
    if (nodeId) {
        // add self trace as default
        handleAddEdge({ from: nodeId, to: nodeId }, () => {
        });
    }
};

const editSelectedEdge = (e) => {
    $('#contextMenuTraceCfg').hide();
    const edgeId = $('#contextMenuTraceCfg li').attr('data-edge-id');
    const edgeData = edges.get(edgeId);
    handleEditEdge(edgeData, () => {
    });
};

const removeSelectedEdge = (e) => {
    $('#contextMenuTraceCfg').hide();
    const edgeId = $('#contextMenuTraceCfg li').attr('data-edge-id');
    const edgeData = edges.get(edgeId);
    edges.remove(edgeData);
    delete mapIdFromIdTo2Edge[`${edgeData.from}-${edgeData.to}`];
};

const saveEditEdge = () => {
    const edgeData = {};
    const startProc = tracingElements.edgeBackProc.val();
    const endProc = tracingElements.edgeForwardProc.val();
    edgeData.from = startProc;
    edgeData.to = endProc;
    edgeData.arrows = 'to';

    // get Trace Target Data from modal
    const targetProcId = $('select[name="edgeForwardProc"]').val();
    edgeData.target_proc = targetProcId;
    const targetCols = [];
    const targetOrgCols = [];
    const targetSubStrs = [];
    $('div[id^="edgeForwardCol-"]').find('.form-group').each(function f(idx) {
        const colElement = $(this).find('select[name=forwardCol]');
        targetSubStrs.push(getMatchingDigits($(this)));
        const colAlias = $('option:selected', colElement).attr('alias');
        const colOrg = $('option:selected', colElement).attr('original');
        if (!isEmpty(colAlias)) targetCols.push(colAlias);
        if (!isEmpty(colOrg)) targetOrgCols.push(colOrg);
    });
    edgeData.target_col = targetCols;
    edgeData.target_orig_col = targetOrgCols;
    edgeData.target_substr = targetSubStrs;


    // get Trace Self Data from modal
    const selfProcId = $('select[name="edgeBackProc"]').val();
    edgeData.self_proc = selfProcId;
    const selfCols = [];
    const selfOrgCols = [];
    const selfSubStrs = [];
    $('div[id^="edgeBackCol-"]').find('.form-group').each(function f(idx) {
        const colElement = $(this).find('select[name=backCol]');
        selfSubStrs.push(getMatchingDigits($(this)));
        const colAlias = $('option:selected', colElement).attr('alias');
        const colOrg = $('option:selected', colElement).attr('original');
        if (!isEmpty(colAlias)) selfCols.push(colAlias);
        if (!isEmpty(colOrg)) selfOrgCols.push(colOrg);
    });
    edgeData.self_col = selfCols;
    edgeData.back_orig_col = selfOrgCols;
    edgeData.self_substr = selfSubStrs;

    // validate: choose at least 1 column to trace
    if (selfCols.length === 0 || targetCols.length === 0) {
        displayRegisterMessage(
            '#alertMsgCheckSubStr', {
                message: i18nNames.i18nNoColumn,
                is_error: true,
            },
        );
        return;
    }

    validEdge = validateSubStr(edgeData.self_substr, edgeData.target_substr);
    if (!validEdge.is_valid) {
        displayRegisterMessage(
            '#alertMsgCheckSubStr', {
                message: validEdge.message,
                is_error: true,
            },
        );
        return;
    }

    // save data to external/global dict
    mapIdFromIdTo2Edge[`${edgeData.from}-${edgeData.to}`] = edgeData;

    edges.add(edgeData);
    $('#modal-edge-popup').modal('hide');
};

const cancelEditEdge = () => false;
