// TODO use class

// global variable to store data of processes
let processes = {};
const getConfigOption = () =>
    JSON.parse(localStorage.getItem('network-config')) || {};

const configOption = getConfigOption();
let hierarchicalDirection = configOption.direction || 'LR';
let nodesPosition = configOption.nodesPosition || {};
const moveToOptions = configOption.moveto || {};
// global variable to store data of processes as Vis nodes
const nodes = new vis.DataSet();
const edges = new vis.DataSet();

// currently visjs doesn't allow us to save many information to edge -> use a global map
const mapIdFromIdTo2Edge = {};

let currentEditEdge = {};

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

const DEFAULT_DELTA_TIME_DATA_LINK = 0; // minute
const DEFAULT_CUTOFF_DATA_LINK = 60; // minute

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
    linkWithTime: $('#i18nLinkWithTime').text(),
    i18nCutOff: $('#i18nCutOff').text(),
    linkWithTimeHoverMsg: $('#i18nLinkWithTimeHoverMsg').text(),
    cutOffHoverMsg: $('#i18nCutOffHoverMsg').text(),
};
const locale =
    docCookies.getItem('locale') === 'ja' ? 'jp' : docCookies.getItem('locale');
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
    edgeSelects: $('#trace_link_procs select'),
    alertProcLink: '#alert-register-proc-link',
    edgeConfigDatetime: '.trace-config-datetime',
    edgeConfigSerial: '.trace-config-serial',
    deltaDatetime: '#delta-datetime',
    deltaDatetimeVisible: '#delta-datetime:visible',
    inputDeltaDatetime: '.deltaDatetime',
    inputCutOff: '.cutOff',
    datetimeReprClassName: 'datetimeRepr',
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
    const result = $(item)
        .find(`input[name*="${tracingElements.subStrOpt}"]:checked`)
        .map((i, e) => {
            const itemId = $(e).attr('id').split('-')[1];
            // if ($(`#checkbox-${itemId}`).prop('checked')) {
            if ($(e).val() === '0') {
                return [];
            }
            const fromDigit = $(
                `select[name="${tracingElements.fromDigits}-${itemId}"]`,
            ).val();
            const toDigits = $(
                `select[name="${tracingElements.toDigits}-${itemId}"]`,
            ).val();
            return [Number(fromDigit), Number(toDigits)];
            // }
        })
        .toArray();
    return result;
};

// TODO refactor i18n
const validateSubStr = (selfSubstr, targetSubstr) => {
    // selfSubstr, targetSubstr [[1,3], [2,4]]
    const invalidOpts = (self) => self.filter(([s, e]) => s > e);
    // Check valid options
    if (
        invalidOpts(selfSubstr).length > 0 ||
        invalidOpts(targetSubstr).length > 0 ||
        selfSubstr.length !== targetSubstr.length
    ) {
        return {
            is_valid: false,
            message: $('#i18nInvalidDigit').text(),
        };
    }

    // Check self digits same as target digits
    const invalidDigits = targetSubstr.filter((e, i) => {
        if (
            selfSubstr[i] !== undefined &&
            selfSubstr[i].length > 0 &&
            e.length > 0
        ) {
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

let targetProc = null;
let targetColCandidates = [];
let targetColCandidateMasters = [];
let selectedTargetCols = [];
let targetSubStrOpt = [];
let targetColNames = [];
let targetDataTypes = [];

let selfProc = null;
let selfSubStrOpt = [];
let selectedSelfCols = [];
let selfColCandidates = [];
let selfColCandidateMasters = [];
let selfColNames = [];
let selfDataTypes = [];
let deltaTimes = [];
let cutOffs = [];

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

    network.on('dragEnd', () => {
        getNodePositionAndSaveLocal();
    });

    if (hierarchicalDirection) {
        $('#traceNetworkLayout').val(hierarchicalDirection);
        $(`#traceNetworkLayout option[value=${hierarchicalDirection}]`).prop(
            'disabled',
            true,
        );
    }
    $('#traceNetworkLayout')
        .off('change')
        .on('change', (e) => {
            if (e.currentTarget.value) {
                hierarchicalDirection = e.currentTarget.value;
            }
            drawVisNetwork();
            setTimeout(() => {
                getNodePositionAndSaveLocal();
                // disable current layout to avoid to re-select from dropdown menu
                if (hierarchicalDirection) {
                    $('#traceNetworkLayout option').prop('disabled', false);
                    $(
                        `#traceNetworkLayout option[value=${hierarchicalDirection}]`,
                    ).prop('disabled', true);
                }
            }, 500);
        });

    // add reset layout button events
    $('#resetLayout')
        .off('click')
        .on('click', (e) => {
            const layoutSelected = $('#traceNetworkLayout').val();
            $('#traceNetworkLayout').val(layoutSelected).change();
        });
    container.addEventListener('mouseleave', () => {
        moveToOptions.scale = network.getScale();
        moveToOptions.position = network.getViewPosition();
        saveLocalStorage();
    });
};

const getNodePosition = () => {
    nodesPosition = {};
    _.forEach(nodes.getIds(), (id) => {
        nodesPosition = Object.assign(nodesPosition, network.getPositions(id));
    });
};

const getNodePositionAndSaveLocal = () => {
    getNodePosition();
    saveLocalStorage();
};

const saveLocalStorage = () => {
    localStorage.setItem(
        'network-config',
        JSON.stringify({
            moveto: moveToOptions,
            direction: hierarchicalDirection,
            nodesPosition,
        }),
    );
};

const handleEditEdge = (edgeData, callback) => {
    // Clear Message
    $('#alertMsgCheckSubStr').hide();
    // get data from external dict
    currentEditEdge = edgeData;
    const edgeDataFull =
        mapIdFromIdTo2Edge[`${edgeData.from.id}-${edgeData.to.id}`];
    if (edgeDataFull) {
        edgeData.target_proc = edgeDataFull.target_proc;
        edgeData.target_col = edgeDataFull.target_col;
        edgeData.self_proc = edgeDataFull.self_proc;
        edgeData.self_col = edgeDataFull.self_col;
        edgeData.self_substr = edgeDataFull.self_substr;
        edgeData.target_substr = edgeDataFull.target_substr;
        edgeData.delta_time = edgeDataFull.delta_time;
        edgeData.cut_off = edgeDataFull.cut_off;
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

    if (selfProc.toString() === targetProc.toString()) {
        tracingElements.edgeForwardProc.select2().val('');
        edgeData.target_proc = '';
    }

    getInforToGenerateColumns(selfProc, targetProc, edgeData);
    addTraceKey();

    // tracingElements.btnAddTraceKey.attr('disabled', false);

    $('#modal-edge-popup').modal('show');

    onChangeProcs(edgeData);
};

const onChangeProcs = (edgeData) => {
    // updateSelectedItems(false, tracingElements.edgeSelects);
    updateSelectedItems(false, tracingElements.edgeSelects);
    tracingElements.edgeBackProc.off('change');
    tracingElements.edgeBackProc.on('change', (e) => {
        try {
            setTimeout(() => {
                let from = '';
                let to = '';
                if (typeof edgeData.to === 'object')
                    edgeData.to = edgeData.to.id;
                if (typeof edgeData.from === 'object')
                    edgeData.from = edgeData.from.id;
                edgeData.from = e.currentTarget.value;
                from = edgeData.from.toString();
                to = edgeData.to.toString();

                if (from === to) {
                    to = '';
                    tracingElements.edgeForwardProc.val('');
                    addAttributeToElement();
                }

                if (from && to) {
                    getInforToGenerateColumns(from, to, edgeData);
                    $('#traceInfoModal').empty();
                    addTraceKey(true);
                }

                updateSelectedItems(false, tracingElements.edgeSelects);
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
                if (typeof edgeData.to === 'object')
                    edgeData.to = edgeData.to.id;
                if (typeof edgeData.from === 'object')
                    edgeData.from = edgeData.from.id;
                edgeData.to = e.currentTarget.value;
                from = edgeData.from.toString();
                to = edgeData.to.toString();

                if (from === to) {
                    from = '';
                    tracingElements.edgeBackProc.val('');
                    addAttributeToElement();
                }

                if (from && to) {
                    getInforToGenerateColumns(from, to, edgeData);
                    $('#traceInfoModal').empty();
                    addTraceKey(true);
                }
                updateSelectedItems(false, tracingElements.edgeSelects);
            });
        } catch (error) {
            console.log(error);
        }
    });
};
const masterInnerOrder = [
    masterDataGroup.LINE_NAME,
    masterDataGroup.LINE_NO,
    masterDataGroup.EQ_NAME,
    masterDataGroup.EQ_NO,
    masterDataGroup.PART_NAME,
    masterDataGroup.PART_NO,
    masterDataGroup.ST_NO,
];

const reOrderLinkCols = (linkingCols) => {
    let serialCols = [];
    let getDateCols = [];
    let dateTimeCols = [];
    let mainDateCols = [];
    let dateCols = [];
    let mainTimeCols = [];
    let timeCols = [];
    let masterCols = [];
    let catCols = [];
    let stringCols = [];
    let intCols = [];
    for (const linkingCol of linkingCols) {
        if (linkingCol.is_serial_no) {
            serialCols.push(linkingCol);
        } else if (linkingCol.is_get_date) {
            getDateCols.push(linkingCol);
        } else if (linkingCol.data_type === DataTypes.DATETIME.name) {
            dateTimeCols.push(linkingCol);
        } else if (linkingCol.data_type === DataTypes.DATE.name) {
            mainDateCols.push(linkingCol);
        } else if (linkingCol.data_type === DataTypes.TIME.name) {
            mainTimeCols.push(linkingCol);
        } else if (masterInnerOrder.includes(linkingCol.column_type)) {
            masterCols.push(linkingCol);
        } else if (
            linkingCol.is_int_category &&
            linkingCol.data_type === DataTypes.INTEGER.name
        ) {
            catCols.push(linkingCol);
        } else if (linkingCol.data_type === DataTypes.STRING.name) {
            stringCols.push(linkingCol);
        } else if (linkingCol.data_type === DataTypes.INTEGER.name) {
            intCols.push(linkingCol);
        }
    }
    getDateCols.sort((a, b) => a.order - b.order);
    dateTimeCols.sort((a, b) => a.order - b.order);
    mainDateCols.sort((a, b) => a.order - b.order);
    dateCols.sort((a, b) => a.order - b.order);
    mainTimeCols.sort((a, b) => a.order - b.order);
    timeCols.sort((a, b) => a.order - b.order);
    masterCols.sort((a, b) => a.column_type - b.column_type);
    catCols.sort((a, b) => a.order - b.order);
    stringCols.sort((a, b) => a.order - b.order);
    intCols.sort((a, b) => a.order - b.order);
    // push serial at top of dropdown in linking modal
    return [
        ...serialCols,
        ...getDateCols,
        ...dateTimeCols,
        ...mainDateCols,
        ...dateCols,
        ...mainTimeCols,
        ...timeCols,
        ...masterCols,
        ...catCols,
        ...stringCols,
        ...intCols,
    ];
};

const getInforToGenerateColumns = (selfProcId, targetProcId, edgeData) => {
    if (typeof edgeData.self_col !== 'object') {
        selectedSelfCols = [edgeData.self_col];
    } else {
        selectedSelfCols = [...edgeData.self_col];
    }

    const selfSerialColumns = reOrderLinkCols(
        processes[selfProcId].columns.filter((e) => e.is_linking_column),
    );
    selfColCandidates = selfSerialColumns.map((e) => e.id);
    selfColCandidateMasters = selfSerialColumns.map((e) => e.shown_name);
    selfColNames = selfSerialColumns.map((e) => e.name_en);
    selfDataTypes = selfSerialColumns.map((e) => e.data_type);

    if (typeof edgeData.target_col !== 'object') {
        selectedTargetCols = [edgeData.target_col];
    } else {
        selectedTargetCols = [...edgeData.target_col];
    }

    const targetSerialColumns = reOrderLinkCols(
        processes[targetProcId].columns.filter((e) => e.is_linking_column),
    );
    targetColCandidates = targetSerialColumns.map((e) => e.id);
    targetColCandidateMasters = targetSerialColumns.map((e) => e.shown_name);
    targetColNames = targetSerialColumns.map((e) => e.name_en);
    targetDataTypes = targetSerialColumns.map((e) => e.data_type);
    targetChosenTraceKeys = [];
    selfChosenTraceKeys = [];

    // substring option selected
    targetSubStrOpt = edgeData.target_substr;
    selfSubStrOpt = edgeData.self_substr;
    deltaTimes = edgeData.delta_time;
    cutOffs = edgeData.cut_off;
};

const initVisData = (processesArray) => {
    // clear vis data
    edges.clear();
    nodes.clear();
    for (const key in mapIdFromIdTo2Edge) delete mapIdFromIdTo2Edge[key];

    // update processes from global const
    // create Vis nodes from processes data
    let procTraces = [];
    processes = {};
    const temp_processes = {}; // wait for get all processes while trace_config_api is running
    for (const key in processesArray) {
        const procCopy = { ...processesArray[key] };
        procCopy.master = procCopy.shown_name;
        procCopy.font = { multi: 'html' };
        procCopy.label = `${procCopy.shown_name}`;
        nodes.add(procCopy);

        const trace = procCopy.traces;
        if (!isEmpty(trace)) {
            procTraces = [...procTraces, ...trace];
        }
        temp_processes[procCopy.id] = procCopy;
    }
    processes = { ...temp_processes };

    // create Vis edge from processes trace data
    // use trace forward to create edges
    procTraces.forEach((trace) => {
        const edge = {
            from: trace.self_process_id,
            to: trace.target_process_id,
            arrows: 'to',
            font: {
                multi: 'html',
                strokeColor: COLOR.background,
                align: 'top',
            },
            self_proc: trace.self_process_id,
            target_proc: trace.target_process_id,
            self_col: trace.trace_keys.map((key) => key.self_column_id),
            target_col: trace.trace_keys.map((key) => key.target_column_id),
            self_substr: trace.trace_keys.map((key) => [
                key.self_column_substr_from,
                key.self_column_substr_to,
            ]),
            target_substr: trace.trace_keys.map((key) => [
                key.target_column_substr_from,
                key.target_column_substr_to,
            ]),
            delta_time: trace.trace_keys.map((key) => key.delta_time),
            cut_off: trace.trace_keys.map((key) => key.cut_off),
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
const digitOptions = (position) =>
    [...Array(100).keys()].map((x) => {
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
            $(
                $(this).closest('.partial-option').find('.partial-radio')[0],
            ).prop('checked', 1);
        });
    });
};

const addGroupListSelection = (
    parentId,
    id,
    itemName,
    itemVals,
    itemOrgCols = null,
    itemAliases = null,
    checkedVals = null,
    itemDisplayNames = [],
    subStrOpt = [],
    forwardCol = null,
    clearOption = true,
    columnNames = [],
    dataTypes = [],
    chosenOption = [],
) => {
    if (clearOption) $(`#${parentId}`).empty();

    if (checkedVals.length == 0) {
        checkedVals.push(undefined);
    }

    const isNullOption = chosenOption.length === itemAliases.length;

    // items
    const itemList = [];
    checkedVals.forEach((selector, i) => {
        const itemId = i + generateRandomString(6);
        const itemOrgCol = itemOrgCols[i];
        let defaultSelected = '';
        let subSelected = '';
        let starDigit = 1;
        let endDigit = 1;
        if (subStrOpt.length > 0 && subStrOpt[i] !== undefined) {
            // Update Edge
            if (!subStrOpt[i].length || subStrOpt[i].some((digit) => !digit)) {
                // all substring digits >= 1
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
        let options = itemAliases
            .map(
                (v, k) => {
                    const selected =
                        `${v}` === `${selector}` ? ' selected="selected"' : '';
                    return `<option value="${v}"${selected} alias="${itemAliases[k]}" data-type="${dataTypes[k]}"
                   original="${itemOrgCols[k]}" title="${columnNames[k]}">${itemDisplayNames[k]}</option>`;
                },
                selector,
                itemDisplayNames,
            )
            .join('');

        if (isNullOption) {
            options = '';
        }
        itemList.push(`
        <div class="col-sm-6 ${forwardCol ? 'pl-4' : 'pr-4'}" id="${id}">
            <div class="form-group" id="list-${id}${i}">
                <div class="">
                    <select class="form-control select2-selection--single select-n-columns" name="${itemName}"
                            id="checkbox-${itemId}"
                            original="${itemOrgCol}"
                            onChange="updateSelectedColumns()">
                        ${options}
                    </select>
                </div>
                <div id="trace-config-serial-${id}" class="trace-config-serial">
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
                                <select class="form-control select2-selection--single partial-digit"
                                        name="fromDigit-${itemId}">${fromOptions}</select>
                            </div>
                            <div class="col-auto">
                                <h5>${COMMON_CONSTANT.EN_DASH}</h5>
                            </div>
                            <div class="col-auto">
                                <select class="form-control select2-selection--single partial-digit"
                                        name="toDigit-${itemId}">${toOptions}</select>
                            </div>
                            <div class="col-auto">
                                <label for="select-">${i18nNames.thCharacter}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `);
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
            if (
                element.value &&
                selectedCols.includes(element.value) === false
            ) {
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
    const allChosenTargetCols = getSelectedColumns(
        allSelectedTargetColElements,
    );
    const allSelectedTargetCols = allSelectedTargetColElements.get();
    targetChosenTraceKeys = allChosenTargetCols;
    let targetColIndex = 0;
    Array.prototype.forEach.call(allSelectedTargetCols, (selected) => {
        const currentCardSelector = $(selected).val();
        $.each($(selected).find('option'), (key, option) => {
            const optionVal = $(option).val();
            if (
                allChosenTargetCols.includes(optionVal) &&
                currentCardSelector !== optionVal
            ) {
                $(option).attr('disabled', 'disabled');
            } else if (!allChosenTargetCols.includes(optionVal)) {
                $(option).removeAttr('disabled');
            }
        });
        updateTraceConfig(selected, targetColIndex);
        targetColIndex++;
    });

    const allSelectedSelfColElements = $('select[name=backCol]');
    const allChosenSelfCols = getSelectedColumns(allSelectedSelfColElements);
    const allSelectedSelfCols = allSelectedSelfColElements.get();
    selfChosenTraceKeys = allChosenSelfCols;
    let selfColIndex = 0;
    Array.prototype.forEach.call(allSelectedSelfCols, (selected) => {
        const currentCardSelector = $(selected).val();
        $.each($(selected).find('option'), (key, option) => {
            const optionVal = $(option).val();
            if (
                allChosenSelfCols.includes(optionVal) &&
                currentCardSelector !== optionVal
            ) {
                $(option).attr('disabled', 'disabled');
            } else if (!allChosenSelfCols.includes(optionVal)) {
                $(option).removeAttr('disabled');
            }
        });
        updateTraceConfig(selected, selfColIndex);
        selfColIndex++;
    });

    // disable ADD button if all columns are selected
    // if (allChosenSelfCols.length >= selfColCandidates.length
    //     || allChosenTargetCols.length >= targetColCandidates.length) {
    // tracingElements.btnAddTraceKey.attr('disabled', true);
    // } else {
    // tracingElements.btnAddTraceKey.attr('disabled', false);
    // if there is no trace content then add automatically
    // if ($('#traceInfoModal').children().length <= 0 && !isForce) {
    //     tracingElements.btnAddTraceKey.trigger('click');
    // }
    // }
};

const addTraceKey = (isNew = false) => {
    let unusedTargetCols = [];
    let unusedSelfCols = [];
    if (isNew) {
        unusedTargetCols = targetColCandidates.filter(
            (chosen) =>
                !targetChosenTraceKeys.find(
                    (remain) => `${remain}` === `${chosen}`,
                ),
        );
        unusedSelfCols = selfColCandidates.filter(
            (chosen) =>
                !selfChosenTraceKeys.find(
                    (remain) => `${remain}` === `${chosen}`,
                ),
        );
    }
    const selectedColumns = [];
    const idPostfix = `-${generateRandomString(5)}`;

    const fwdColumns = addGroupListSelection(
        'edgeForwardColParent',
        `edgeForwardCol${idPostfix}`,
        'forwardCol',
        targetColCandidates,
        (itemOrgCols = targetColCandidates),
        (itemAliases = targetColCandidates),
        (checkedVals = isNew ? [unusedTargetCols[0]] : selectedTargetCols),
        (itemDisplayNames = targetColCandidateMasters),
        (subStrOpt = isNew ? [] : targetSubStrOpt),
        (forwardCol = true),
        (clearOption = !isNew),
        (columnNames = targetColNames),
        (columnDataTypes = targetDataTypes),
        targetChosenTraceKeys,
    );

    const bwdColumns = addGroupListSelection(
        'edgeBackColParent',
        `edgeBackCol${idPostfix}`,
        'backCol',
        selfColCandidates,
        (itemOrgs = selfColCandidates),
        (itemAliases = selfColCandidates),
        (checkedVals = isNew ? [unusedSelfCols[0]] : selectedSelfCols),
        (itemDisplayNames = selfColCandidateMasters),
        (subStrOpt = isNew ? [] : selfSubStrOpt),
        (forwardCol = false),
        (clearOption = !isNew),
        (columnNames = selfColNames),
        (columnDataTypes = selfDataTypes),
        selfChosenTraceKeys,
    );

    for (let i = 0; i < fwdColumns.length; i++) {
        if (bwdColumns[i] && fwdColumns[i]) {
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
    if (!isNew && deltaTimes !== undefined) {
        updateDeltaTime();
    }

    addAttributeToElement();
};

// TODO use util
const informLinkingJobStarted = () => {
    const { jobList } = i18nNames;
    const msgContent = `<p>${i18nNames.startLink}.
    <br>${i18nNames.checkProgress}.
    <p><a style="float:right;" href="/ap/config/job" target="_blank">${jobList}</a></p>`;
    showToastrMsg(msgContent, MESSAGE_LEVEL.INFO);
};

// call backend API to save
const saveTraceConfigs = (edgesCfg) => {
    fetch('api/setting/trace_config', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(edgesCfg),
    })
        .then((response) => response.clone().json())
        .then((json) => {})
        .catch((json) => {});
};

const saveTraceConfigToDB = () => {
    // get current edges
    const edgesCfg = Object.values(mapIdFromIdTo2Edge);

    // send edges to db
    saveTraceConfigs(edgesCfg);

    displayRegisterMessage(tracingElements.alertProcLink);

    // show msg
    informLinkingJobStarted();
};

const getAutolinkGroups = async (data) => {
    const res = await fetchData(
        'api/setting/get_autolink_groups',
        JSON.stringify(data),
        'POST',
    );
    return res.groups;
};

const syncVisData = (procs = []) => {
    initVisData(procs);
    drawVisNetwork();
};

const updateProcessEditModal = (procs = []) => {
    tracingElements.edgeBackProc.empty();
    procs.map((proc) => {
        const option = new Option(proc.shown_name, proc.id, false, false);
        if (proc.name_en) {
            option.setAttribute('title', proc.name_en);
        }
        tracingElements.edgeBackProc.append(option).trigger('change');
    });

    tracingElements.edgeForwardProc.empty();
    procs.map((proc) => {
        const option = new Option(proc.shown_name, proc.id, false, false);
        if (proc.name_en) {
            option.setAttribute('title', proc.name_en);
        }
        tracingElements.edgeForwardProc.append(option).trigger('change');
    });
};

const reloadTraceConfigFromDB = (isUpdatePosition = true) => {
    fetch('api/setting/trace_config', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then((response) => response.clone().json())
        .then((json) => {
            // update new data
            const { procs } = JSON.parse(json.trace_config);

            // broadcast to another tabs to update process information
            handleSSEMessage({
                type: serverSentEventType.reloadTraceConfig,
                data: { procs, isUpdatePosition },
                broadcastType: ShouldBroadcast.YES,
            });
        })
        .catch((e) => {
            console.log(e);
        });
};

/**
 * Do reload trace configuration and process nodes
 * @param {object} procs - dictionary that contains process information
 * @param {boolean} isUpdatePosition - is do update position of processes
 */
function doReloadTraceConfig(procs, isUpdatePosition) {
    // redraw vis network
    syncVisData(procs);

    // update process list in modal edit
    updateProcessEditModal(procs);

    // calculate proc link count
    setTimeout(() => {
        realProcLink(isUpdatePosition);
    }, 500);
    treeCheckboxJs();
}

const removeRelation = (colId) => {
    $(`#${colId}`).remove();
    updateSelectedColumns(true);
};

$(() => {
    // simulation
    $('#btnTraceSimulation').click(() => {
        const edgesCfg = Object.values(mapIdFromIdTo2Edge);
        simulateProcLink(edgesCfg);
    });

    // show register modal
    $('#btn-trace-config-register').click(() => {
        $('#regenerate-confirm-modal').modal('show');
    });

    // show reload confirm modal
    $('#btn-trace-config-sync').click(() => {
        $(tracingElements.confirmReloadModal).modal('show');
    });

    // reload trace config when click reload button
    $(tracingElements.confirmReloadBtn).click(() => {
        getNodePositionAndSaveLocal();
        reloadTraceConfigFromDB(true);
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

const updatePredictionNetwork = (
    networkContent,
    predictive,
    isUpdatePosition,
) => {
    // update prediction to network
    updateNodeInfo(networkContent.nodes, predictive, isUpdatePosition);
    updateEdgeInfo(networkContent.edges, predictive);
};

// call backend API to save
const calcProcLink = async (
    url,
    currentEdges,
    isPredictive = false,
    isUpdatePosition = true,
) => {
    let bodyData = null;
    if (currentEdges) {
        bodyData = JSON.stringify(currentEdges);
    }
    const res = await fetchData(url, bodyData, 'POST');
    updatePredictionNetwork(res, isPredictive, isUpdatePosition);
};

// simulate proc link
const simulateProcLink = (currentEdges) => {
    calcProcLink(
        'api/setting/simulate_proc_link',
        currentEdges,
        true,
        false,
    ).then();
};

// calc real proc link'
const realProcLink = (isUpdatePosition) => {
    calcProcLink(
        'api/setting/count_proc_link',
        false,
        false,
        isUpdatePosition,
    ).then();
};

const getProcNameFromLabel = (procId) => {
    try {
        const currentNodeLabel = nodes.get(procId).label || '';
        return currentNodeLabel.trim().split(SEP_LABEL)[0];
    } catch (e) {
        return procId;
    }
};

const updateNodeInfo = (
    predictionNodes,
    isPredictive = false,
    isUpdatePosition = true,
) => {
    const nodesPos = getConfigOption().nodesPosition;
    for (const procId in predictionNodes) {
        const totalCount = applySignificantDigit(predictionNodes[procId]);
        const currentProcName = getProcNameFromLabel(procId);
        const color = isPredictive ? COLOR.prediction : COLOR.real;
        const totalTitle = isPredictive
            ? i18nNames.nodeLinkTitlePred
            : i18nNames.nodeLinkTitleReal;
        const title = `${totalCount} : ${totalTitle}`;
        const xPostion =
            nodesPos && nodesPos[procId] ? nodesPos[procId].x : null;
        const yPostion =
            nodesPos && nodesPos[procId] ? nodesPos[procId].y : null;
        const nodePosition =
            xPostion !== null && yPostion !== null
                ? { x: xPostion, y: yPostion }
                : {};
        const position =
            nodesPos &&
            Object.keys(nodesPos).length > 0 &&
            hierarchicalDirection !== NORMAL_TYPE &&
            isUpdatePosition
                ? nodePosition
                : {};

        nodes.update({
            id: procId,
            label: `${SEP_LABEL}${currentProcName}${SEP_LABEL}<b>${totalCount}</b>`,
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
        const linkCount = applySignificantDigit(predictionEdges[edge]);
        const procs = edge.split(SEP_PROC);
        const procStart = procs[0];
        const procEnd = procs[1];
        if (isEmpty(procStart) || isEmpty(procEnd)) {
            continue;
        }
        const color = isPredictive ? COLOR.prediction : COLOR.real;
        const linkTitle = isPredictive
            ? i18nNames.edgeLinkTitlePred
            : i18nNames.edgeLinkTitleReal;
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
    network.on(
        'oncontext',
        (params) => {
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
                left: `${left}px`,
                top: `${top}px`,
                display: 'block',
            });
        },
        false,
    );
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
    $('#traceInfoModal').empty();
    addTraceKey(true);
    // tracingElements.btnAddTraceKey.attr('disabled', false);

    // show modal
    $('#modal-edge-popup').modal('show');

    onChangeProcs(edgeData);
};
const addEdgesFromNode = (e) => {
    $('#contextMenuTraceCfg').hide();
    const nodeId = $('#contextMenuTraceCfg li').attr('data-node-id');
    const nodeList = Object.keys(processes);
    const indexFromNode = nodeList.indexOf(nodeId);
    const indexToNode =
        indexFromNode === nodeList.length - 1 ? 0 : indexFromNode + 1;
    const toNodeId = nodeList[indexToNode];

    // trigger to add edge to self node
    if (nodeId) {
        // add self trace as default
        handleAddEdge({ from: nodeId, to: processes[toNodeId].id }, () => {});
    }
};

const editSelectedEdge = (e) => {
    $('#contextMenuTraceCfg').hide();
    const edgeId = $('#contextMenuTraceCfg li').attr('data-edge-id');
    const edgeData = edges.get(edgeId);
    handleEditEdge(edgeData, () => {});
};

const removeSelectedEdge = (e) => {
    $('#contextMenuTraceCfg').hide();
    const edgeId = $('#contextMenuTraceCfg li').attr('data-edge-id');
    const edgeData = edges.get(edgeId);
    edges.remove(edgeData);
    delete mapIdFromIdTo2Edge[`${edgeData.from}-${edgeData.to}`];
};

const getEdgeFromUI = () => {
    const edgeData = currentEditEdge;
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
    $('div[id^="edgeForwardCol-"]')
        .find('.form-group')
        .each(function f(idx) {
            const isOptionDateTime = $(this).find(
                tracingElements.edgeConfigDatetime,
            ).length;
            const colElement = $(this).find('select[name=forwardCol]');
            const colAlias = $('option:selected', colElement).attr('alias');
            const colOrg = $('option:selected', colElement).attr('original');
            if (!isEmpty(colAlias)) targetCols.push(colAlias);
            if (!isEmpty(colOrg)) targetOrgCols.push(colOrg);

            if (isOptionDateTime === 0) {
                targetSubStrs.push(getMatchingDigits($(this)));
                return;
            }
            targetSubStrs.push([]);
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
    const deltaTimes = [];
    const cutOffs = [];
    $('div[id^="edgeBackCol-"]')
        .find('.form-group')
        .each(function f(idx) {
            const isOptionDateTime = $(this).find(
                tracingElements.edgeConfigDatetime,
            ).length;
            const colElement = $(this).find('select[name=backCol]');
            const colAlias = $('option:selected', colElement).attr('alias');
            const colOrg = $('option:selected', colElement).attr('original');
            const columnType = $('option:selected', colElement).attr(
                'column-type',
            );
            if (!isEmpty(colAlias)) selfCols.push(colAlias);
            if (!isEmpty(colOrg)) selfOrgCols.push(colOrg);
            if (!isEmpty(columnType)) selfColumnTypes.push(columnType);

            if (isOptionDateTime === 0) {
                selfSubStrs.push(getMatchingDigits($(this)));
                deltaTimes.push(null);
                cutOffs.push(null);
            } else {
                selfSubStrs.push([]);
                const deltaTime = $(this)
                    .parent()
                    .parent()
                    .find('input[name="deltaDatetime"]')
                    .first()
                    .val()
                    .trim();
                deltaTimes.push(deltaTime);
                const cutOff = $(this)
                    .parent()
                    .parent()
                    .find('input[name="cutOff"]')
                    .first()
                    .val()
                    .trim();
                cutOffs.push(cutOff);
            }
        });
    edgeData.self_col = selfCols;
    edgeData.back_orig_col = selfOrgCols;
    edgeData.self_substr = selfSubStrs;
    edgeData.delta_time = deltaTimes;
    edgeData.cut_off = cutOffs;
    return edgeData;
};

const saveEditEdge = () => {
    const edgeData = getEdgeFromUI();
    const selfCols = edgeData.self_col;
    const targetCols = edgeData.target_col;
    const deltaDatetimes = edgeData.delta_time;
    const cutOffs = edgeData.cut_off;
    // validate: choose at least 1 column to trace
    if (selfCols.length === 0 || targetCols.length === 0) {
        displayRegisterMessage('#alertMsgCheckSubStr', {
            message: i18nNames.i18nNoColumn,
            is_error: true,
        });
        return;
    }

    const validEdge = validateSubStr(
        edgeData.self_substr,
        edgeData.target_substr,
    );
    if (!validEdge.is_valid) {
        displayRegisterMessage('#alertMsgCheckSubStr', {
            message: validEdge.message,
            is_error: true,
        });
        return;
    }

    // validate delta time and cut off
    const isValidDeltaTimes = deltaDatetimes
        .filter((v) => v !== null)
        .every(isValidDatetimeInputValue);
    const isValidCutOffs = cutOffs
        .filter((v) => v !== null)
        .every(isValidDatetimeInputValue);
    if (!isValidDeltaTimes || !isValidCutOffs) {
        displayRegisterMessage('#alertMsgCheckSubStr', {
            message: $('#i18nInvalidDeltaTime').text(),
            is_error: true,
        });
        return;
    }

    // save data to external/global dict
    drawEdgeToGUI(edgeData);

    $('#modal-edge-popup').modal('hide');
};

const drawEdgeToGUI = (edgeData) => {
    // save data to external/global dict
    mapIdFromIdTo2Edge[`${edgeData.from}-${edgeData.to}`] = edgeData;

    if (_.isEmpty(currentEditEdge)) {
        edges.add(edgeData);
    } else {
        edges.update(edgeData);
    }
    currentEditEdge = {};
};

const cancelEditEdge = () => false;

const handleSwitchTraceConfig = (e) => {
    const edgeData = getEdgeFromUI();
    const keys = Object.keys(edgeData);
    const values = Object.values(edgeData);
    const replacedKeys = keys.map((k) => {
        let key = k;
        if (key === 'from') {
            key = 'to';
            return key;
        }

        if (key === 'to') {
            key = 'from';
            return key;
        }

        if (key.includes('self')) {
            key = key.replace('self', 'target');
            return key;
        }

        if (key.includes('target')) {
            key = key.replace('target', 'self');
            return key;
        }

        if (key.includes('back')) {
            key = key.replace('back', 'target');
            return key;
        }

        return key;
    });

    const newEdgeData = {};
    replacedKeys.forEach((item, index) => {
        newEdgeData[item] = values[index];
    });
    handleEditEdge(newEdgeData, () => {});
};

const updateTraceConfig = (element, index) => {
    const optionSelected = $(element).find(':selected');
    if (!optionSelected.length) {
        return;
    }
    const dataType = optionSelected.attr('data-type');
    const targetColParent = optionSelected.parents().eq(2);
    const elementParent = targetColParent.parents().eq(1);

    if (dataType === DataTypes.DATETIME.name) {
        const inputElement = `<div id="trace-config-datetime" class="trace-config-datetime mt-2 d-none">
                        <span class="deleteicon d-block"><input id="tracingConfigDatetime" class="form-control" placeholder="Datetime..."><span class="remove-config-datetime">x</span></span>
                   </div>`;

        if (
            targetColParent.find(tracingElements.edgeConfigDatetime).length ===
            0
        ) {
            targetColParent.append(inputElement);
        }

        targetColParent.find(tracingElements.edgeConfigSerial).hide();

        if (
            $(elementParent).find(tracingElements.edgeConfigDatetime).length >=
            2
        ) {
            if ($(elementParent).find(`.trace-config-delta-time`).length >= 1) {
                return;
            }
            const innerHTML = `
            <div id="delta-datetime" class="container trace-config-delta-time pb-2" name="trace-config-delta-time-${index}">
                <div class="form-group">
                    <div class="row form-group col-md-8 mx-auto align-items-center">
                        <div class="col-6 text-right">
                            <span class="hint-text" title="${i18nNames.linkWithTimeHoverMsg}">${i18nNames.linkWithTime}</span>
                        </div>
                        <input name="deltaDatetime" class="form-control col-3" onchange="updateDatetimeReprValue(this)">
                        <span class="col-3" name="${tracingElements.datetimeReprClassName}">00:00:00</span>
                    </div>
                    <div class="row form-group col-md-8 mx-auto align-items-center">
                        <div class="col-6 text-right">
                            <span class="hint-text" title="${i18nNames.cutOffHoverMsg}">${i18nNames.i18nCutOff}</span>
                        </div>
                        <input name="cutOff" class="form-control col-3" onchange="updateDatetimeReprValue(this)">
                        <span class="col-3" name="${tracingElements.datetimeReprClassName}">00:00:00</span>
                    </div>
                </div>
            </div>
            `;
            $(elementParent).append(innerHTML);
            updateDeltaTimeElement(
                index,
                DEFAULT_DELTA_TIME_DATA_LINK,
                DEFAULT_CUTOFF_DATA_LINK,
            );
        }
        return;
    }

    if (dataType !== DataTypes.DATETIME.name) {
        targetColParent.find(tracingElements.edgeConfigDatetime).remove();
        targetColParent
            .parents()
            .eq(1)
            .find(tracingElements.deltaDatetime)
            .remove();
        targetColParent.find(tracingElements.edgeConfigSerial).show();
    }
};

const updateDeltaTime = () => {
    deltaTimes?.forEach(function (deltaTime, index) {
        updateDeltaTimeElement(index + 1, deltaTime, cutOffs[index]);
    });
};

/**
 *
 * @param {number} index
 * @param {number} deltaTime
 * @param {number} cutOff
 */
const updateDeltaTimeElement = (index, deltaTime, cutOff) => {
    const traceDeltaTimeEle = $('#traceInfoModal').find(
        `div[name="trace-config-delta-time-${index}"]`,
    );
    if (traceDeltaTimeEle.length) {
        traceDeltaTimeEle
            .find('input[name="deltaDatetime"]')
            .first()
            .val(deltaTime)
            .trigger('change');
        traceDeltaTimeEle
            .find('input[name="cutOff"]')
            .first()
            .val(cutOff)
            .trigger('change');
    }
};

/**
 *
 * @param {object} e
 */
const updateDatetimeReprValue = (e) => {
    const elem = $(e);

    const reprElem = elem
        .siblings(`span[name="${tracingElements.datetimeReprClassName}"]`)
        .first();

    const { valid, value } = parseDateTimeByMinute(e.value);
    if (!valid) {
        elem.addClass(BORDER_RED_CLASS);
    } else {
        elem.removeClass(BORDER_RED_CLASS);
    }

    reprElem.text(value);
};

/**
 *
 * @param {string} s
 * @return {boolean}
 */
const isValidDatetimeInputValue = (s) => {
    return s.trim().length !== 0 && !Number.isNaN(Number(s));
};

/**
 *
 * @param {string} minuteString
 * @return {{valid: boolean, value: string}}
 */
const parseDateTimeByMinute = (minuteString) => {
    const isValid = isValidDatetimeInputValue(minuteString);

    const minuteNumber = Number(minuteString);
    const hours = Math.floor(minuteNumber / 60);
    const minutes = Math.floor(minuteNumber - hours * 60);
    const seconds = Math.floor(minuteNumber * 60 - minutes * 60 - hours * 3600);

    const padNumber = (e) => String(e).padStart(2, '0');

    const parsedValue = isValid
        ? `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(seconds)}`
        : '--:--:--';

    return {
        valid: isValid,
        value: parsedValue,
    };
};
