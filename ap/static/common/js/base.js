// eslint-disable no-undef, no-unused-vars
// term of use
validateTerms();
const GA_TRACKING_ID = 'G-9DJ9TV72B5';
const HEART_BEAT_MILLI = 2500;
const RE_HEART_BEAT_MILLI = HEART_BEAT_MILLI * 4;
let scpSelectedPoint = null;
let scpCustomData = null;
/** @type {EventSource} */
let serverSentEventCon = null;
let loadingProgressBackend = 0;
let formDataQueried = null;
let clearOnFlyFilter = false;
const serverSentEventUrl = '/ap/api/setting/listen_background_job';

let problematicData = null;
let problematicPCAData = null;

let originalUserSettingInfo;
let isGraphShown = false;
let requestStartedAt;
let handleHeartbeat;
let isDirectFromJumpFunction = false;
let isLoadingUserSetting = false;
let isAdmin = false;

const serverSentEventType = {
    ping: 'ping',
    timeout: 'timeout',
    closeOldSSE: 'close_old_sse',
    jobRun: 'JOB_RUN',
    procLink: 'PROC_LINK',
    shutDown: 'SHUT_DOWN',
    dataTypeErr: 'DATA_TYPE_ERR',
    emptyFile: 'EMPTY_FILE',
    pcaSensor: 'PCA_SENSOR',
    showGraph: 'SHOW_GRAPH',
    diskUsage: 'DISK_USAGE',
    reloadTraceConfig: 'RELOAD_TRACE_CONFIG',
    dataRegister: 'DATA_REGISTER',
    backupDataFinished: 'BACKUP_DATA_FINISHED',
    restoreDataFinished: 'RESTORE_DATA_FINISHED',
};

const KEY_CODE = {
    ENTER: 13,
};

let isShutdownListening = false;

const baseEles = {
    shutdownApp: '#shutdownApp',
    shutdownAppModal: '#shutdownAppModal',
    btnConfirmShutdownApp: '#btnConfirmShutdownApp',
    i18nJobStatusMsg: '#i18nJobStatusMsg',
    i18nJobsStopped: '#i18nJobsStopped',
    i18nCsvTemplateWarningTitle: '#i18nCsvTemplateError',
    i18nImportEmptyFileMsg: '#i18nImportEmptyFileMsg',
    i18nCopied: '#i18nCopied',
    i18nPasted: '#i18nPasted',
    i18nWarningFullDiskMsg: '#i18nWarningFullDiskMsg',
    i18nErrorFullDiskMsg: '#i18nErrorFullDiskMsg',
    i18nCommonErrorMsg: '#i18nCommonErrorMsg',
    showGraphBtn: 'button.show-graph',
    tooltipsEnableBtn: '#tooltipsEnableBtn',
};

// for master data group (column types)
const masterDataGroup = {
    DATETIME: 1,
    MAIN_SERIAL: 2,
    SERIAL: 3,
    DATETIME_KEY: 4,

    INT_CATE: 10,

    LINE_NAME: 20,
    LINE_NO: 21,
    EQ_NAME: 22,
    EQ_NO: 23,
    PART_NAME: 24,
    PART_NO: 25,
    ST_NO: 26,
    JUDGE: 76,
    GENERATED_EQUATION: 100,
};

const processOrderForFilterCheck = {
    first: '1',
    all: 'all',
};

const masterDataFilterSystem = [
    {
        id: masterDataGroup.LINE_NAME,
        propTarget: processOrderForFilterCheck.first,
    },
    {
        id: masterDataGroup.LINE_NO,
        propTarget: processOrderForFilterCheck.first,
    },
    { id: masterDataGroup.EQ_NAME, propTarget: processOrderForFilterCheck.all },
    { id: masterDataGroup.EQ_NO, propTarget: processOrderForFilterCheck.all },
    {
        id: masterDataGroup.PART_NAME,
        propTarget: processOrderForFilterCheck.first,
    },
    {
        id: masterDataGroup.PART_NO,
        propTarget: processOrderForFilterCheck.first,
    },
    { id: masterDataGroup.ST_NO, propTarget: processOrderForFilterCheck.all },
];

const GRAPH_CONST = {
    histHeight: '100%', // vw, not vh in this case, when change, plz also change ".his" class in trace_data.css
    histWidth: '100%',
    histHeightShort: 'calc(0.75 * 23vw)', // just 3/4 of the original height
    histSummaryHeight: 'auto', // ~1/4 of histogram
};

const dnJETColorScale = [
    ['0.0', 'rgb(0,0,255)'],
    ['0.1666', 'rgb(0,159,255)'],
    ['0.3333', 'rgb(0,255,255)'],
    ['0.5', 'rgb(0, 255, 0)'],
    ['0.6666', 'rgb(255,255,0)'],
    ['0.8333', 'rgb(255,127,0)'],
    ['1.0', 'rgb(255,0,0)'],
];
const reverseScale = (colorScale) => {
    const keys = colorScale.map((color) => color[0]);
    const val = [...colorScale.map((color) => color[1])].reverse();
    return keys.map((k, i) => [k, val[i]]);
};

const colorPallets = {
    BLUE: {
        isRev: false,
        scale: [
            ['0.0', 'rgb(33, 59, 77)'], // 205, 57, 30
            ['0.1666', 'rgb(47, 85, 110)'], // 204, 57, 43
            ['0.3333', 'rgb(59, 106, 138)'], // 204, 57, 54
            ['0.5', 'rgb(71, 128, 166)'], // 204, 57, 65
            ['0.6666', 'rgb(83, 150, 194)'], // 204, 57, 76
            ['0.8333', 'rgb(95, 171, 222)'], // 204, 57, 87
            ['1.0', 'rgb(107, 193, 250)'], // 204, 57, 98
        ],
    },
    BLUE_REV: {
        isRev: true,
        scale: [
            ['0.0', 'rgb(107, 193, 250)'],
            ['0.1666', 'rgb(95, 171, 222)'],
            ['0.3333', 'rgb(83, 150, 194)'],
            ['0.5', 'rgb(71, 128, 166)'],
            ['0.6666', 'rgb(59, 106, 138)'],
            ['0.8333', 'rgb(47, 85, 110)'],
            ['1.0', 'rgb(33, 59, 77)'],
        ],
    },
    JET: {
        isRev: false,
        scale: dnJETColorScale,
    },
    JET_REV: {
        isRev: true,
        scale: reverseScale(dnJETColorScale),
    },
    JET_ABS: {
        isRev: false,
        scale: null,
    },
    JET_ABS_REV: {
        isRev: true,
        scale: null,
    },
};

const channelType = {
    heartBeat: 'heart-beat',
    sseMsg: 'sse-msg',
    sseErr: 'sse-error',
};

// Broadcast channel for SSE
let bc = {
    onmessage: () => {},
    postMessage: () => {},
};

try {
    bc = new BroadcastChannel('sse');
} catch (e) {
    // Broadcast is not support safari version less than 15.4
    console.log(e);
}

function postHeartbeat() {
    // send heart beat
    if (
        serverSentEventCon &&
        serverSentEventCon.readyState === serverSentEventCon.OPEN
    ) {
        // console.log(toLocalTime(), 'post heart beat');
        bc.postMessage({ type: channelType.heartBeat });
        consoleLogDebug(`[SSE][Main] Broadcast: ${channelType.heartBeat}`);
    } else {
        consoleLogDebug(
            `[SSE] Status code: ${(serverSentEventCon ?? {}).readyState}`,
        );
        // make new SSE connection
        openServerSentEvent(true);
        // console.log(toLocalTime(), 'force request');
    }
}

// Handle SSE messages and errors
const handleSSEMessage = (event) => {
    // console.log(toLocalTime(), event.data);
    const { type, data } = event.data;
    if (type === channelType.heartBeat) {
        consoleLogDebug(`[SSE][Sub] ${type}`);
        delayPostHeartBeat(RE_HEART_BEAT_MILLI);
        if (serverSentEventCon) {
            serverSentEventCon.close();
        }
    } else {
        consoleLogDebug(`[SSE][Sub] ${type}\n${JSON.stringify(data)}`);
        // data type error
        if (type === serverSentEventType.dataTypeErr) {
            handleError(data);
        }

        // import empty file
        if (type === serverSentEventType.emptyFile) {
            handleEmptyFile(data);
        }

        // fetch pca data
        if (type === serverSentEventType.pcaSensor) {
            if (typeof appendSensors !== 'undefined') {
                appendSensors(data);
            }
        }

        // fetch show graph progress
        if (type === serverSentEventType.showGraph) {
            if (typeof showGraphProgress !== 'undefined') {
                showGraphProgress(data);
            }
        }

        // show warning/error message about disk usage
        if (type === serverSentEventType.diskUsage) {
            if (typeof checkDiskCapacity !== 'undefined') {
                checkDiskCapacity(data);
            }
        }

        if (type === serverSentEventType.jobRun) {
            if (typeof updateBackgroundJobs !== 'undefined') {
                updateBackgroundJobs(data);
            }
        }

        if (type === serverSentEventType.shutDown) {
            if (typeof shutdownApp !== 'undefined') {
                shutdownApp();
            }
        }

        if (type === serverSentEventType.procLink) {
            // calculate proc link count
            if (typeof realProcLink !== 'undefined') {
                realProcLink(false);
                setTimeout(hideAlertMessages, 3000);
            }

            if (typeof handleSourceListener !== 'undefined') {
                handleSourceListener();
            }
        }

        if (type === serverSentEventType.reloadTraceConfig) {
            if (typeof doReloadTraceConfig !== 'undefined') {
                const { procs: procs, isUpdatePosition: isUpdatePosition } =
                    data;
                doReloadTraceConfig(procs, isUpdatePosition);
            }
        }

        // for data register page
        if (type === serverSentEventType.dataRegister) {
            if (typeof updateDataRegisterStatus !== 'undefined') {
                updateDataRegisterStatus({ type, data });
            }
        }

        if (type === serverSentEventType.backupDataFinished) {
            if (typeof showBackupDataFinishedToastr !== 'undefined') {
                showBackupDataFinishedToastr();
            }
        }

        if (type === serverSentEventType.restoreDataFinished) {
            if (typeof showRestoreDataFinishedToastr !== 'undefined') {
                showRestoreDataFinishedToastr();
            }
        }
    }
};

const delayPostHeartBeat = (
    () =>
    (ms = 0, ...args) => {
        if (this.__heartBeatIntervalID__)
            clearInterval(this.__heartBeatIntervalID__);
        this.__heartBeatIntervalID__ = setInterval(
            postHeartbeat,
            ms || 0,
            ...args,
        );
    }
)();
const isDebugMode = localStorage.getItem('DEBUG')
    ? localStorage.getItem('DEBUG').trim().toLowerCase() === 'true'
    : false;

const consoleLogDebug = (msg = '') => {
    // If you want to show log, you must set DEBUG=true on localStorage first !!!
    if (!isDebugMode) return;
    console.debug(msg);
};

const openServerSentEvent = (isForce = false) => {
    if (isForce || serverSentEventCon == null) {
        consoleLogDebug(`[SSE] Make new SSE connection...`);

        let uuid = localStorage.getItem('uuid');
        if (uuid == null) {
            uuid = create_UUID();
            localStorage.setItem('uuid', uuid);
        }

        let mainTabUUID = window.name;
        if (mainTabUUID == null || mainTabUUID === '') {
            mainTabUUID = create_UUID();
            window.name = mainTabUUID;
        }

        const force = isForce ? 1 : 0;
        serverSentEventCon = new EventSource(
            `${serverSentEventUrl}/${force}/${uuid}/${mainTabUUID}`,
        );

        serverSentEventCon.onerror = (err) => {
            delayPostHeartBeat(RE_HEART_BEAT_MILLI);

            if (!bc.onmessage) {
                bc.onmessage = handleSSEMessage;
            }
            if (serverSentEventCon) {
                serverSentEventCon.close();
                consoleLogDebug(`[SSE] SSE connection closed`);
            }
        };

        serverSentEventCon.addEventListener(
            serverSentEventType.ping,
            (event) => {
                bc.postMessage({ type: channelType.heartBeat });
                consoleLogDebug(
                    `[SSE][Main] Broadcast: ${channelType.heartBeat}`,
                );

                delayPostHeartBeat(HEART_BEAT_MILLI);

                if (!bc.onmessage) {
                    bc.onmessage = handleSSEMessage;
                }
                // listenSSE();
                notifyStatusSSE();
            },
            false,
        );

        serverSentEventCon.addEventListener(
            serverSentEventType.timeout,
            (event) => {
                consoleLogDebug(`[SSE][Main] Server feedback: timeout`);
            },
            false,
        );

        serverSentEventCon.addEventListener(
            serverSentEventType.closeOldSSE,
            (event) => {
                consoleLogDebug(`[SSE][Main] Server feedback: closeOldSSE`);
                serverSentEventCon.close();
                consoleLogDebug(`[SSE] SSE connection closed`);
            },
            false,
        );
    }
};

const divideOptions = {
    var: 'var',
    category: 'category',
    cyclicTerm: 'cyclicTerm',
    directTerm: 'directTerm',
    dataNumberTerm: 'dataNumberTerm',
    cyclicCalender: 'cyclicCalender',
};

function handleError(data) {
    if (data) {
        let msg = $(baseEles.i18nJobStatusMsg).text();
        msg = msg.replace('__param__', data);

        // show toastr to notify user
        showToastrMsg(msg, MESSAGE_LEVEL.ERROR);
    }
}

function handleEmptyFile(data) {
    if (data) {
        let msg = $(baseEles.i18nImportEmptyFileMsg).text();
        msg = msg.replace('__param__', `<br>${data.join('<br>')}`);

        // show toast to notify user
        showToastrMsg(msg);
    }
}

function shutdownApp() {
    // show toastr to notify user
    showToastrMsg($(baseEles.i18nJobsStopped).text(), MESSAGE_LEVEL.INFO);

    // call API to shutdown app
    setTimeout(() => {
        fetch('/ap/api/setting/shutdown', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        })
            .then((response) => response.clone().json())
            .then(() => {
                // closeOldConnection(source);
            })
            .catch(() => {
                // closeOldConnection(source);
            });
    }, 2000); // wait 2 seconds to let app update 100% in background job page
}

function showGraphProgress(data) {
    if (data > loadingProgressBackend) {
        loadingUpdate(data);
        loadingProgressBackend = data;
    }
}

// import job data type error notification
const notifyStatusSSE = () => {
    if (!serverSentEventCon) {
        return;
    }

    // data type error
    serverSentEventCon.addEventListener(
        serverSentEventType.dataTypeErr,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.dataTypeErr}\n${event.data}`,
            );
            bc.postMessage({
                type: serverSentEventType.dataTypeErr,
                data: data,
            });
            handleError(data);
        },
        false,
    );

    // import empty file
    serverSentEventCon.addEventListener(
        serverSentEventType.emptyFile,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.emptyFile}\n${event.data}`,
            );
            bc.postMessage({ type: serverSentEventType.emptyFile, data: data });
            handleEmptyFile(data);
        },
        false,
    );

    // fetch pca data
    serverSentEventCon.addEventListener(
        serverSentEventType.pcaSensor,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.pcaSensor}\n${event.data}`,
            );
            bc.postMessage({ type: serverSentEventType.pcaSensor, data: data });
            if (typeof appendSensors !== 'undefined') {
                appendSensors(data);
            }
        },
        false,
    );

    // fetch show graph progress
    serverSentEventCon.addEventListener(
        serverSentEventType.showGraph,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.showGraph}\n${event.data}`,
            );
            bc.postMessage({ type: serverSentEventType.showGraph, data: data });
            if (typeof showGraphProgress !== 'undefined') {
                showGraphProgress(data);
            }
        },
        false,
    );

    // show warning/error message about disk usage
    serverSentEventCon.addEventListener(
        serverSentEventType.diskUsage,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.diskUsage}\n${event.data}`,
            );
            bc.postMessage({ type: serverSentEventType.diskUsage, data: data });
            if (typeof checkDiskCapacity !== 'undefined') {
                checkDiskCapacity(data);
            }
        },
        false,
    );

    serverSentEventCon.addEventListener(
        serverSentEventType.jobRun,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.jobRun}\n${event.data}`,
            );
            bc.postMessage({ type: serverSentEventType.jobRun, data: data });
            if (typeof updateBackgroundJobs !== 'undefined') {
                updateBackgroundJobs(data);
            }
        },
        false,
    );

    serverSentEventCon.addEventListener(
        serverSentEventType.shutDown,
        (event) => {
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.shutDown}\n${true}`,
            );
            bc.postMessage({ type: serverSentEventType.shutDown, data: true });
            if (typeof shutdownApp !== 'undefined') {
                shutdownApp();
            }
        },
        false,
    );

    serverSentEventCon.addEventListener(
        serverSentEventType.procLink,
        (event) => {
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.procLink}\n${true}`,
            );
            bc.postMessage({ type: serverSentEventType.procLink, data: true });
            // calculate proc link count
            if (typeof realProcLink !== 'undefined') {
                realProcLink(false);
                setTimeout(hideAlertMessages, 3000);
            }

            if (typeof handleSourceListener !== 'undefined') {
                handleSourceListener();
            }
        },
        false,
    );

    // for data register page
    serverSentEventCon.addEventListener(
        serverSentEventType.dataRegister,
        (event) => {
            const data = JSON.parse(event.data);
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.dataRegister}\n${true}`,
            );
            const postDat = {
                type: serverSentEventType.dataRegister,
                data: data,
            };
            bc.postMessage(postDat);
            if (typeof updateDataRegisterStatus !== 'undefined') {
                updateDataRegisterStatus(postDat);
            }
        },
        false,
    );
    // serverSentEventCon.addEventListener(serverSentEventType.dataRegister, (event) => {
    //     const data = JSON.parse(event.data);
    //     consoleLogDebug(`[SSE][Main] Broadcast: ${serverSentEventType.dataRegister}\n${true}`);
    //     const postDat = {type: serverSentEventType.dataRegister, data: data};
    //     bc.postMessage(postDat);
    //     if (typeof updateDataRegisterStatus !== 'undefined') {
    //         updateDataRegisterStatus(postDat);
    //     }
    // }, false);
    // serverSentEventCon.addEventListener(serverSentEventType.dataRegisterFinished, (event) => {
    //     const data = JSON.parse(event.data);
    //     consoleLogDebug(`[SSE][Main] Broadcast: ${serverSentEventType.dataRegisterFinished}\n${true}`);
    //     const postDat = {type: serverSentEventType.dataRegisterFinished, data: data};
    //     bc.postMessage(postDat);
    //     if (typeof updateDataRegisterStatus !== 'undefined') {
    //         updateDataRegisterStatus(postDat);
    //     }
    // }, false);

    serverSentEventCon.addEventListener(
        serverSentEventType.backupDataFinished,
        (event) => {
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.backupDataFinished}\n${true}`,
            );
            bc.postMessage({
                type: serverSentEventType.backupDataFinished,
                data: true,
            });
            // calculate proc link count
            if (typeof showBackupDataFinishedToastr !== 'undefined') {
                showBackupDataFinishedToastr();
            }
        },
        false,
    );

    serverSentEventCon.addEventListener(
        serverSentEventType.restoreDataFinished,
        (event) => {
            consoleLogDebug(
                `[SSE][Main] Broadcast: ${serverSentEventType.restoreDataFinished}\n${true}`,
            );
            bc.postMessage({
                type: serverSentEventType.restoreDataFinished,
                data: true,
            });
            // calculate proc link count
            if (typeof showRestoreDataFinishedToastr !== 'undefined') {
                showRestoreDataFinishedToastr();
            }
        },
        false,
    );
};

const checkDiskCapacity = (data) => {
    const edgeServerType = 'EdgeServer';

    const isMarqueeMessageDisplay = () => {
        const serverTypeList = [edgeServerType];
        for (let i = 0; i < serverTypeList.length; i++) {
            const marqueMsgElm = $(
                `#marquee-msg-${serverTypeList[i].toLowerCase()}`,
            );
            if (marqueMsgElm.text() !== '') return true;
        }

        return false;
    };

    const showMarqueeMessage = (data) => {
        let msg = '';
        let level = '';
        let title = '';
        let show_flag = 'visible';

        if (data.disk_status.toLowerCase() === 'Warning'.toLowerCase()) {
            title += `<b>${data.server_info}</b>`;
            level = MESSAGE_LEVEL.WARN;
            msg = $(baseEles.i18nWarningFullDiskMsg).text();
            msg = msg.replace('__LIMIT_PERCENT__', data.warning_limit_percent);
        } else if (data.disk_status.toLowerCase() === 'Full'.toLowerCase()) {
            title += `<b>${data.server_info}</b>`;
            level = MESSAGE_LEVEL.ERROR;
            msg = $(baseEles.i18nErrorFullDiskMsg).text();
            msg = msg.replace('__LIMIT_PERCENT__', data.error_limit_percent);
        } else {
            // In case of normal, hide marquee message
            show_flag = 'hidden';
        }

        const marqueMsgElm = $(
            `#marquee-msg-${data.server_type.toLowerCase()}`,
        );
        const sidebarElm = marqueMsgElm.parents('.sidebar-marquee');
        const marqueeElm = marqueMsgElm.parents('.marquee');

        sidebarElm.css('visibility', show_flag); // See serverSentEventType.jobRun
        marqueeElm.attr('class', 'marquee'); // Remove other class except one
        marqueeElm.addClass(level.toLowerCase()); // Add color class base on level
        marqueMsgElm.text(msg.replace('__SERVER_INFO__', data.server_info));
    };

    if (data) {
        showMarqueeMessage(data);
    } else {
        for (const [key, value] of Object.entries(disk_capacity)) {
            if (value) showMarqueeMessage(value);
        }
    }
    // Expend left sidebar when marquee message display
    if (isMarqueeMessageDisplay() && !isSidebarOpen()) {
        sidebarCollapse();
        // close sidebar after 5 seconds
        setTimeout(() => {
            closeSidebar();
        }, 5000);
    }
};

const addAttributeToElement = (parent = null, additionalOption = {}) => {
    // single select2
    setSelect2Selection(parent, additionalOption);

    // normalization
    convertTextH2Z(parent);

    // clearNoLinkDataSelection();
};

const collapseConfig = () => {
    // let config page collapse
    const toggleIcon = (e) => {
        $(e).addClass('');
        $(e.target)
            .prev('.panel-heading')
            .parent()
            .find('.more-less')
            .toggleClass('fa-window-minimize fa-window-maximize');
    };
    // unbind collapse which has been rendered before
    $('.panel-group').unbind('hidden.bs.collapse');
    $('.panel-group').unbind('shown.bs.collapse');

    // bind collapse and change icon
    $('.panel-group').on('hidden.bs.collapse', toggleIcon);
    $('.panel-group').on('shown.bs.collapse', toggleIcon);
};

const toggleToMinIcon = (collapseId) => {
    const ele = $(`#${collapseId}`)
        .parents('.card')
        .find('.collapse-box')
        .find('.more-less');
    ele.removeClass('fa-window-maximize');
    ele.addClass('fa-window-minimize');
};

const toggleToMaxIcon = (collapseId) => {
    const ele = $(`#${collapseId}`)
        .parents('.card')
        .find('.collapse-box')
        .find('.more-less');
    ele.removeClass('fa-window-minimize');
    ele.addClass('fa-window-maximize');
};

const hideContextMenu = () => {
    const menuName = '[name=contextMenu]';
    $(menuName).css({ display: 'none' });
};

const handleMouseUp = (e) => {
    // later, not just mouse down, + mouseout of menu
    hideContextMenu();
};

const getMinMaxCard = (collapseId, clickEle = null, name = false) => {
    let targetCards;
    if (name) {
        const eleName = collapseId;
        targetCards = $(clickEle).parents('.card').find(`[name=${eleName}]`);
    } else {
        targetCards = $(`#${collapseId}`);
    }
    return targetCards;
};

const baseRightClickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // show context menu when right click
    // const menu = $(procElements.contextMenuId);
    const menu = $(e.target).parents('.card').find('[name=contextMenu]');
    const menuHeight = menu.height();
    const windowHeight = $(window).height();
    const left = e.clientX;
    let top = e.clientY;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight;
    }
    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        display: 'block',
    });

    return false;
};

const setUserRule = () => {
    isAdmin = docCookies.getItem(CONST.IS_ADMIN);
    isAdmin = isAdmin ? parseInt(isAdmin) : false;
};

const showHideShutDownButton = () => {
    // const hostName = window.location.hostname;
    // if (!['localhost', '127.0.0.1'].includes(hostName)) {
    //     $(baseEles.shutdownApp).css('display', 'none');
    // }
    if (!isAdmin) {
        $(baseEles.shutdownApp).css('display', 'none');
    }
};

const sidebarCollapseHandle = () => {
    let toutEnter = null;
    let toutClick = null;

    const resetTimeoutEvent = () => {
        clearTimeout(toutEnter);
        clearTimeout(toutClick);
    };

    $(sidebarEles.sidebarCollapseId).on('click', () => {
        resetTimeoutEvent();
        toutClick = setTimeout(() => {
            clearTimeout(toutEnter);
            sidebarCollapse();
        }, 10);
    });

    // open sidebar after 2 secs
    $(sidebarEles.sid).on('mouseenter', () => {
        resetTimeoutEvent();
        toutEnter = setTimeout(() => {
            clearTimeout(toutClick);
            $(sidebarEles.dropdownToggle)
                .unbind('mouseenter')
                .on('mouseenter', (e) => {
                    if ($(e.currentTarget).attr('aria-expanded') === 'false') {
                        $(e.currentTarget).click();
                    }
                });
            if (!isSidebarOpen()) sidebarCollapse();
        }, 2000);
    });
    // close sidebar after 2 secs
    $(sidebarEles.sid).on('mouseleave', () => {
        resetTimeoutEvent();
        menuCollapse();
        toutEnter = setTimeout(() => {
            clearTimeout(toutClick);
            if (isSidebarOpen()) closeSidebar();
        }, 2000);
    });

    $(sidebarEles.dropdownToggle).on('click', function () {
        const ele = $(this);
        if ($(sidebarEles.sid).hasClass('active')) {
            sidebarCollapse(ele);
        }
    });
    $(sidebarEles.dropdownToggle).on('mouseleave', () => {
        // menuCollapse(); should be removed. no need
        // TODO when submenu is already expanded, mouse enter should not trigger toggle ....
    });
};

// mark as call page from tile interface, do not apply user setting
const useTileInterface = (storageKey = 'isLoadingFromTitleInterface') => {
    const set = () => {
        localStorage.setItem(storageKey, true);
        return true;
    };
    const get = () => {
        const isUseTitleInterface = localStorage.getItem(storageKey);
        return !!isUseTitleInterface;
    };
    const reset = () => {
        localStorage.removeItem(storageKey);
        return null;
    };
    return { set, get, reset };
};

const openNewPage = () => {
    let currentPageName = window.location.pathname;
    const exceptPage = ['config', 'job', 'about'];
    if (getSetting && exceptPage.includes(getSetting.title.toLowerCase())) {
        currentPageName = '/';
    }
    useTileInterface().set();
    window.open(currentPageName);
};

const isLoadingFromTitleInterface = useTileInterface().get();
const isUseLatestSetting = useTileInterface('useLatestSetting').get();

$(async () => {
    isDirectFromJumpFunction = !!(
        getParamFromUrl(goToFromJumpFunction) &&
        localStorage.getItem(sortedColumnsKey)
    );
    isLoadingUserSetting = !!localStorage.getItem('loadingSetting');
    // hide userBookmarkBar
    $('#userBookmarkBar').hide();

    overrideUiSortable();

    updateI18nCommon();

    checkDiskCapacity();

    SetAppEnv();
    getFiscalYearStartMonth();

    // heart beat
    // notifyStatusSSE();
    openServerSentEvent();
    // click shutdown event
    $('body').click((e) => {
        if ($(e.target).closest(baseEles.shutdownApp).length) {
            $(baseEles.shutdownAppModal).modal('show');
        }
    });

    $(baseEles.btnConfirmShutdownApp).click(() => {
        // init shutdown polling
        if (isShutdownListening === false) {
            // shutdownAppPolling();
            isShutdownListening = true;
        }

        setTimeout(() => {
            // wait for SSE connection was established

            // call API to shutdown
            fetch('/ap/api/setting/stop_job', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            })
                .then((response) => response.clone().json())
                .then(() => {})
                .catch(() => {});
        }, 1000);
    });

    // single select2
    addAttributeToElement();

    const loadingSetting = localStorage.getItem('loadingSetting') || null;
    const userSettingId = getParamFromUrl('bookmark_id');
    if (isLoadingFromTitleInterface) {
        // reset global flag after use tile interface
        useTileInterface().reset();
        setTimeout(() => {
            // save original setting info
            originalUserSettingInfo = saveOriginalSetting();
        }, 100);
    } else if (needToLoaUserSettingsFromUrl()) {
        const newUserSetting = await makeUserSettingFromParams();
        applyUserSetting(newUserSetting, null, true);
        autoClickShowGraphButton(null, 1);
    } else {
        // load user input on page load
        setTimeout(() => {
            // save original setting info
            originalUserSettingInfo = saveOriginalSetting();
            if (userSettingId) {
                useUserSetting(userSettingId);
                autoClickShowGraphButton(null, userSettingId);
            } else if (loadingSetting) {
                const loadingSettingObj = JSON.parse(loadingSetting);
                const isRedirect = loadingSettingObj.redirect;
                if (isRedirect) {
                    useUserSetting(loadingSettingObj.settingID);
                    autoClickShowGraphButton(loadingSetting);
                }
            } else if (isUseLatestSetting) {
                useTileInterface('useLatestSetting').reset();
                useUserSettingOnLoad();
            }
        }, 100);
    }

    // onChange event for datetime group
    setTimeout(() => {
        onChangeForDateTimeGroup();
    }, 1000);

    setUserRule();
    showHideShutDownButton();

    sidebarCollapseHandle();

    $('[name=pasteCard]').click((e) => {
        const divTarget = e.currentTarget.closest('.card-body');
        // console.log(divTarget);

        const sharedSetting = JSON.parse(
            localStorage.getItem(SHARED_USER_SETTING),
        );
        useUserSetting(null, sharedSetting, divTarget, false, true);

        setTimeout(() => {
            setTooltip($(e.currentTarget), $(baseEles.i18nPasted).text());
        }, 2000);
    });

    $('[name=pastePage]').click((e) => {
        const key = e?.isDirectFromJumpFunction
            ? JUMP_SHARED_USER_SETTING
            : SHARED_USER_SETTING;
        const localShareSetting = getLocalStorageShareUserSetting(key);
        const sharedSetting =
            localShareSetting?.settings?.traceDataForm || null;
        useUserSetting(null, sharedSetting, null, false, true);

        setTimeout(() => {
            setTooltip($(e.currentTarget), $(baseEles.i18nPasted).text());
            // localStorage.removeItem('srcSetting');
        }, 2000);
    });

    $('[name=copyPage]').click(function () {
        let formId = getShowFormId();
        let srcSetting = window.location.pathname;
        const currentPage = getCurrentPage();
        localStorage.setItem(
            'srcSetting',
            JSON.stringify({
                srcPath: srcSetting,
                pageName: currentPage,
                isJump: isCopyFromJumpModel,
            }),
        );
        const keyName = isCopyFromJumpModel
            ? JUMP_SHARED_USER_SETTING
            : SHARED_USER_SETTING;
        const loadFunc = saveLoadUserInput(`#${formId}`, '', '', keyName);
        loadFunc(false);
        setTooltip($(this), $(baseEles.i18nCopied).text());
    });

    if (isDirectFromJumpFunction) {
        setTimeout(() => {
            const event = $.Event('click', { isDirectFromJumpFunction: true });
            $('[name=pastePage]').trigger(event);
            autoClickShowGraphButton(null, null);
        }, 1000);
    }

    // Search table user setting
    onSearchTableContent('searchInTopTable', 'tblUserSetting');

    // show preprocessing content
    cleansingHandling();

    clipboardInit();

    initShowGraphCommon();

    // showGraph ctrl+Enter
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key == 'Enter') {
            $(baseEles.showGraphBtn).click();
            clearLoadingSetting();
        }
    });

    showBrowserSupportMsg();

    initCustomSelect();

    // update tooltips status
    // default is show tooltips on graph
    // true || null: show, false: hide
    const tooltipsStatus =
        JSON.parse(localStorage.getItem('tooltipsEnabled')) !== false;
    $(baseEles.tooltipsEnableBtn).prop('checked', tooltipsStatus).change();
});

const autoClickShowGraphButton = (loadingSetting, userSettingId) => {
    checkShownGraphInterval = setInterval(() => {
        // if show graph btn is active
        const isValid = !!$('button.show-graph.valid-show-graph').length;
        if (isValid && !isSettingLoading) {
            if (isDirectFromJumpFunction) {
                loadDataSortColumnsToModal('', true);
            }
            handleAutoClickShowGraph(loadingSetting, userSettingId);
            clearInterval(checkShownGraphInterval);
            isDirectFromJumpFunction = false;
        }
    }, 100);
};

const handleAutoClickShowGraph = (loadingSetting, userSettingId) => {
    if (loadingSetting) {
        // debug mode
        const loadingSettingObj = JSON.parse(loadingSetting);
        if (loadingSettingObj.isExportMode) {
            const input = document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', 'isExportMode');
            input.setAttribute('value', loadingSettingObj.settingID);
            // append to form element that you want .
            $(baseEles.showGraphBtn).after(input);
        }

        if (loadingSettingObj.isImportMode) {
            const input = document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', 'isImportMode');
            input.setAttribute('value', loadingSettingObj.isImportMode);
            // append to form element that you want .
            $(baseEles.showGraphBtn).after(input);
        }
    }

    if (loadingSetting || userSettingId || isDirectFromJumpFunction) {
        // before click, check params in url to modify GUI input
        modifyGUIInput();

        $(baseEles.showGraphBtn).click();
        clearLoadingSetting();
    }
};

const initTargetPeriod = () => {
    removeDateTimeInList();
    addNewDatTimeRange();
    showDateTimeRangeValue();

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(
        CYCLIC_TERM.WINDOW_LENGTH,
        CYCLIC_TERM.WINDOW_LENGTH_MIN_MAX,
    );
    validateInputByNameWithOnchange(
        CYCLIC_TERM.INTERVAL,
        CYCLIC_TERM.INTERVAL_MIN_MAX,
    );
    validateInputByNameWithOnchange(
        CYCLIC_TERM.DIV_OFFSET,
        CYCLIC_TERM.DIV_OFFSET_MIN_MAX,
    );
    validateInputByNameWithOnchange(
        CYCLIC_TERM.RECENT_INTERVAL,
        CYCLIC_TERM.TIME_UNIT,
    );

    setTimeout(() => {
        $('input[type=text]').trigger('change');
    }, 1000);
};

const onSearchTableContent = (inputID, tbID, inputElement = null) => {
    const inputEl = inputID ? $(`#${inputID}`) : inputElement;

    initCommonSearchInput(inputEl);

    inputEl.on('input', (e) => {
        const value = stringNormalization(e.currentTarget.value);
        searchTableContent(tbID, value, true);
    });

    inputEl.on('change', (e) => {
        handleInputTextZenToHanEvent(e);
        const { value } = e.currentTarget;
        searchTableContent(tbID, value, false);
    });
};

const searchTableContent = (tbID, value, isFilter = true) => {
    const newValue = makeRegexForSearchCondition(value);
    const regex = new RegExp(newValue.toLowerCase(), 'i');
    const matchedIndex = [];
    $(`#${tbID} tbody tr`).filter(function () {
        let text = '';
        $(this)
            .find('td')
            .each((i, td) => {
                const selects = $(td).find('select');
                if (selects.length > 0) {
                    text += selects.find('option:selected').text();
                }
                const input = $(td).find('input');
                if (input.length > 0) {
                    text += input.val();
                }

                const textArea = $(td).find('textarea');
                if (textArea.length > 0) {
                    text += textArea.text();
                }

                const searchClass = $(td).find('.for-search');
                if (searchClass.length > 0) {
                    text += searchClass.text();
                }

                if (
                    textArea.length === 0 &&
                    input.length === 0 &&
                    selects.length === 0 &&
                    searchClass.length === 0
                ) {
                    text += $(td).text();
                }
            });

        if (regex.test(text)) {
            matchedIndex.push($(this).index());
        }

        if (isFilter) {
            $(this).toggle(regex.test(text.toLowerCase()));
        } else {
            $(this).show();
            if (!regex.test(text)) {
                $(this).addClass('gray');
            } else {
                $(this).removeClass('gray');
            }
        }
    });

    return matchedIndex;
};

const handleChangeInterval = (e, to) => {
    let currentShower = null;
    if (e.checked) {
        if (to) {
            currentShower = $(`#for-${to}`);
        } else {
            currentShower = $(`#for-${e.value}`);
        }
        if (e.value === 'from' || e.value === 'to') {
            currentShower = $('#for-fromTo');
        }
        if (e.value === 'default') {
            $('.for-recent-cyclicCalender')
                .find('input')
                .prop('disabled', true);
            $('.for-recent-cyclicCalender').addClass('hide');
            $('.for-recent-cyclicCalender').hide();
        }
        if (e.value === 'recent') {
            $('.for-recent-cyclicCalender')
                .find('input')
                .prop('disabled', false);
            $('.for-recent-cyclicCalender').removeClass('hide');
            $('.for-recent-cyclicCalender').show();
        }

        if (currentShower) {
            currentShower.show();
            currentShower.find('input').trigger('change');
            currentShower.siblings().hide();
        }
    }
    compareSettingChange();
};

const handleChangeDivideOption = (e) => {
    const tabs = [];
    e.options.forEach((el) => {
        tabs.push(el.value);
    });
    const currentShower = $(`#for-${e.value}`);
    currentShower.removeAttr('style');
    toggleDisableAllInputOfNoneDisplayEl(currentShower, false);
    currentShower.find('input[type=text]').trigger('change');
    tabs.forEach((tab) => {
        if (tab !== e.value) {
            $(`#for-${tab}`).css({ display: 'none', visibility: 'hidden' });
            toggleDisableAllInputOfNoneDisplayEl($(`#for-${tab}`));
        }
    });
    isCyclicTermTab = e.value === CYCLIC_TERM.NAME;

    showDateTimeRangeValue();
    compareSettingChange();
    setProcessID();
};

const toggleDisableAllInputOfNoneDisplayEl = (el, active = true) => {
    el.find('input').prop('disabled', active);
    el.find('select').prop('disabled', active);
};

const removeDateTimeInList = () => {
    $('.remove-date').unbind('click');
    $('.remove-date').on('click', (e) => {
        $(e.currentTarget).parent().remove();
        // update time range
        showDateTimeRangeValue();
    });
};

const addNewDatTimeRange = () => {
    $('#termBtnAddDateTime').on('click', () => {
        const randomIndex = new Date().getTime();
        const dtId = `datetimeRangePicker${randomIndex}`;

        const newDateHtml = `
            <div class="datetimerange-group d-flex align-items-center add-new-datetime-direct-mode">
                ${dateTimeRangePickerHTML('DATETIME_RANGE_PICKER', dtId, randomIndex, 'False', 'data-gen-btn=termBtnAddDateTime')}
                <span class="ml-2 remove-date"><i class="fa fa-times fa-sm"></i></span>
            </div>
        `;

        $('#datetimeList').append(newDateHtml);
        removeDateTimeInList();
        initializeDateTimeRangePicker(dtId);
        $(`#${dtId}`).on('focus', (e) => {
            handleOnfocusEmptyDatetimeRange(e.currentTarget);
        });
    });
};

const handleOnfocusEmptyDatetimeRange = (e) => {
    const _this = $(e);
    const value = _this.val();
    if (value) return;
    const aboveSiblingValue = _this
        .parent()
        .prev()
        .find('input[name=DATETIME_RANGE_PICKER]')
        .val();
    _this.attr('old-value', aboveSiblingValue);
    _this.val(aboveSiblingValue).trigger('change');
};

const removeUnusedDate = () => {
    // remove extra date
    const dateGroups = $('.datetimerange-group').find(
        '[name=DATETIME_RANGE_PICKER]',
    );
    dateGroups.each((i, el) => {
        const val = el.value;
        if (!val) {
            $(el)
                .closest('.datetimerange-group')
                .find('.remove-date')
                .trigger('click');
        }
    });
};

const getDateTimeRangeValue = (
    tab = null,
    traceTimeName = 'varTraceTime',
    forDivision = true,
) => {
    const currentTab = tab || $('select[name=compareType]').val();
    let result = '';

    if (
        ['var', 'category', 'dataNumberTerm', 'cyclicCalender'].includes(
            currentTab,
        )
    ) {
        result = calDateTimeRangeForVar(currentTab, traceTimeName, forDivision);
        if (result.trim() === DATETIME_PICKER_SEPARATOR.trim()) {
            result = `${DEFAULT_START_DATETIME}${DATETIME_PICKER_SEPARATOR}${DEFAULT_END_DATETIME}`;
        }
    } else if (currentTab === 'cyclicTerm') {
        result = calDateTimeRangeForCyclic(currentTab);
    } else {
        result = calDateTimeRangeForDirectTerm(currentTab);
    }

    if (currentTab === 'cyclicCalender') {
        const currentTargetDiv = forDivision
            ? $(`#for-${currentTab}`)
            : $('#target-period-wrapper');
        // format by divide format
        const isLatest =
            currentTargetDiv.find(`[name*=${traceTimeName}]:checked`).val() ===
            TRACE_TIME_CONST.RECENT;
        const currentDivFormat = $(
            `input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`,
        ).val();
        if (currentDivFormat) {
            const offset = $(`input[name=${CYCLIC_TERM.DIV_OFFSET}]`).val();
            const { from, to, div } = dividedByCalendar(
                result.split(DATETIME_PICKER_SEPARATOR)[0],
                result.split(DATETIME_PICKER_SEPARATOR)[1],
                currentDivFormat,
                isLatest,
                offset,
            );
            result = `${from}${DATETIME_PICKER_SEPARATOR}${to}`;
            $('#cyclicCalenderShowDiv').text(`Div: ${div}`);
        }
    } else {
        $('#cyclicCalenderShowDiv').text('');
    }
    $('#datetimeRangeShowValue').text(result);
    $(`#${currentTab}-daterange`).text(result);
    changeFormatAndExample(
        $(`input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`),
    );
    return result;
};

const showDateTimeRangeValue = () => {
    getDateTimeRangeValue();
    $('.to-update-time-range').off('change', handleChangeUpdateTimeRange);
    $('.to-update-time-range').on('change', handleChangeUpdateTimeRange);
};

const handleChangeUpdateTimeRange = () => {
    getDateTimeRangeValue();
    compareSettingChange();
};

const calDateTimeRangeForVar = (
    currentTab,
    traceTimeName = 'varTraceTime',
    forDivision = true,
) => {
    const currentTargetDiv = forDivision
        ? $(`#for-${currentTab}`)
        : $('#target-period-wrapper');
    const traceOption = currentTargetDiv
        .find(`[name*=${traceTimeName}]:checked`)
        .val();
    const dateTimeRange = currentTargetDiv
        .find('[name=DATETIME_RANGE_PICKER]')
        .val();
    const { startDate, startTime, endDate, endTime } =
        splitDateTimeRange(dateTimeRange);
    const recentTimeInterval =
        currentTargetDiv.find('[name=recentTimeInterval]').val() || 24;
    const timeUnit = currentTargetDiv.find('[name=timeUnit]').val() || 60;

    if (traceOption === TRACE_TIME_CONST.RECENT) {
        return calcLatestDateTime(timeUnit, recentTimeInterval);
    }
    return `${startDate} ${startTime}${DATETIME_PICKER_SEPARATOR}${endDate} ${endTime}`;
};

const calDateTimeRangeForCyclic = (currentTab) => {
    const currentTargetDiv = $(`#for-${currentTab}`);

    const traceTimeOption = currentTargetDiv
        .find('[name=cyclicTermTraceTime1]:checked')
        .val();
    const divisionNum = currentTargetDiv.find('[name=cyclicTermDivNum]').val();
    const intervalNum = currentTargetDiv
        .find('[name=cyclicTermInterval]')
        .val();
    const windowsLengthNum = currentTargetDiv
        .find('[name=cyclicTermWindowLength]')
        .val();
    const datetime = currentTargetDiv.find('[name=DATETIME_PICKER]').val();
    const { date, time } = splitDateTime(datetime);

    const targetDate =
        traceTimeOption === TRACE_TIME_CONST.RECENT
            ? moment().format('YYYY-MM-DD')
            : date;
    const targetTime =
        traceTimeOption === TRACE_TIME_CONST.RECENT
            ? moment().format('HH:mm')
            : time;

    const [startTimeRange, endTimeRange] =
        traceTimeOption === TRACE_TIME_CONST.FROM
            ? getEndTimeRange(
                  targetDate,
                  targetTime,
                  divisionNum,
                  intervalNum,
                  windowsLengthNum,
              )
            : getStartTimeRange(
                  traceTimeOption,
                  targetDate,
                  targetTime,
                  divisionNum,
                  intervalNum,
                  windowsLengthNum,
              );

    return `${startTimeRange[0]} ${startTimeRange[1]}${DATETIME_PICKER_SEPARATOR}${endTimeRange[0]} ${endTimeRange[1]}`;
};

const getEndTimeRange = (
    targetDate,
    targetTime,
    divisionNum,
    intervalNum,
    windowsLengthNum,
) => {
    const MILSEC = 60 * 60 * 1000;
    const startDateTimeMil = moment(`${targetDate} ${targetTime}`).valueOf();
    const endDateTimeMil =
        startDateTimeMil +
        (divisionNum - 1) * intervalNum * MILSEC +
        windowsLengthNum * MILSEC;

    return [
        [targetDate, targetTime],
        [
            moment(endDateTimeMil).format(DATE_FORMAT),
            moment(endDateTimeMil).format(TIME_FORMAT),
        ],
    ];
};
const getStartTimeRange = (
    traceTimeOpt,
    targetDate,
    targetTime,
    divisionNum,
    intervalNum,
    windowsLengthNum,
) => {
    const MILSEC = 60 * 60 * 1000;
    const endDateTimeMil = moment(`${targetDate} ${targetTime}`).valueOf();
    const startDateTimeMil =
        endDateTimeMil -
        (divisionNum - 1) * intervalNum * MILSEC -
        windowsLengthNum * MILSEC;

    // default as RECENT type
    let endTimeRange = [
        moment().format(DATE_FORMAT),
        moment().format(TIME_FORMAT),
    ];
    if (traceTimeOpt === TRACE_TIME_CONST.TO) {
        endTimeRange = [targetDate, targetTime];
    }
    return [
        [
            moment(startDateTimeMil).format(DATE_FORMAT),
            moment(startDateTimeMil).format(TIME_FORMAT),
        ],
        endTimeRange,
    ];
};

const calDateTimeRangeForDirectTerm = (currentTab) => {
    const currentTargetDiv = $(`#for-${currentTab}`);
    const starts = [];
    const ends = [];
    currentTargetDiv.find('[name=DATETIME_RANGE_PICKER]').each((i, dt) => {
        const [start, end] = dt.value.split(DATETIME_PICKER_SEPARATOR);
        if (start) {
            starts.push(new Date(start));
        }
        if (end) {
            ends.push(new Date(end));
        }
    });

    const [minOfStart] = findMinMax(starts);
    const [, maxOfEnd] = findMinMax(ends);
    const minDate = minOfStart
        ? moment(Math.min(...starts)).format(DATETIME_PICKER_FORMAT)
        : '';
    const maxDate = maxOfEnd
        ? moment(Math.max(...ends)).format(DATETIME_PICKER_FORMAT)
        : '';

    return `${minDate}${DATETIME_PICKER_SEPARATOR}${maxDate}`;
};

const SetAppEnv = () => {
    const env = localStorage.getItem('env');
    if (env) return;
    $.get('/ap/api/setting/get_env', { _: $.now() }, (resp) => {
        localStorage.setItem('env', resp.env);
    });
};

const setRequestTimeOut = (timeout = 600000) => {
    // default 10m
    const env = localStorage.getItem('env');
    return env === 'prod' ? timeout : 60000000;
};

const removeHoverInfo = () => {
    // remove old hover info
    $('.scp-hover-info').remove();
};

const showCustomContextMenu = (plotDOM, positivePointOnly = false) => {
    let plotViewData;
    plotDOM.on('plotly_click', function (data) {
        if (data.event.button === 2) {
            const sampleNo = data.points[0].x;
            if (positivePointOnly && sampleNo < 0) {
                return;
            }
            plotViewData = data;
        }
    });
    // show context menu
    plotDOM.removeEventListener('contextmenu', () => {});
    plotDOM.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        hideContextMenu();
        if (!plotViewData) {
            return;
        }
        setTimeout(() => {
            var pts = '';
            for (var i = 0; i < plotViewData.points.length; i++) {
                pts =
                    'x = ' +
                    plotViewData.points[i].x +
                    '\ny = ' +
                    plotViewData.points[i].y.toPrecision(4) +
                    '\n\n';
            }
            scpSelectedPoint = {
                point_index: plotViewData.points[0].pointNumber,
                proc_id_x: plotViewData.points[0].data.customdata
                    ? plotViewData.points[0].data.customdata.proc_id_x
                    : scpCustomData.proc_id_x,
                sensor_id_x: plotViewData.points[0].data.customdata
                    ? plotViewData.points[0].data.customdata.sensor_id_x
                    : scpCustomData.sensor_id_x,
            };
            // customdata
            const hasCycleIds = Object.keys(
                plotViewData.points[0].data,
            ).includes('customdata')
                ? Object.keys(plotViewData.points[0].data.customdata).includes(
                      'cycle_ids',
                  )
                : false;
            if (hasCycleIds) {
                scpSelectedPoint.cycle_ids =
                    plotViewData.points[0].data.customdata.cycle_ids;
            }
            const isFromMarkers = plotViewData.points.length
                ? plotViewData.points[0].data.type === 'scatter'
                : false;
            if (isFromMarkers) {
                rightClickHandler(plotViewData.event, '#contextMenuTimeSeries');
            }
        }, 500);
        e.stopPropagation();
    });
    // hide context menu
    plotDOM.removeEventListener('mousemove', () => {});
    plotDOM.addEventListener('mousemove', function (e) {
        hideContextMenu();
        removeHoverInfo();
    });
};

const goToGraphConfigPage = (url) => {
    if (!scpSelectedPoint) return;

    const procId = scpSelectedPoint.proc_id_x;
    goToOtherPage(`${url}?proc_id=${procId}`, false);
};

const genQueryStringFromFormData = (formDat = null) => {
    const traceForm = $(formElements.formID);

    let formData = formDat || new FormData(traceForm[0]);
    formData.append('TBLS', $(formElements.endProcItems).length);
    // append client timezone
    formData.set('client_timezone', detectLocalTimezone());

    const query = new URLSearchParams(formData);
    const queryString = query.toString();

    query.forEach((value, key) => {
        if (isEmpty(value)) {
            query.delete(key);
        }
    });
    return queryString;
};

const handleSelectedPlotView = () => {
    const currentTraceData = graphStore.getTraceData();
    let xTime;
    if (scpSelectedPoint) {
        const cycleId = scpSelectedPoint.cycle_ids
            ? scpSelectedPoint.cycle_ids[scpSelectedPoint.point_index]
            : currentTraceData.cycle_ids[scpSelectedPoint.point_index];
        const sensorDat = currentTraceData.array_plotdata.filter(
            (i) =>
                i.end_col_id == scpSelectedPoint.sensor_id_x &&
                i.end_proc_id == scpSelectedPoint.proc_id_x,
        );
        if ('array_x' in sensorDat[0]) {
            xTime = sensorDat[0].array_x[scpSelectedPoint.point_index];
        } else {
            xTime = currentTraceData.datetime[scpSelectedPoint.point_index];
        }
        const timeKeys = [
            CONST.STARTDATE,
            CONST.STARTTIME,
            CONST.ENDDATE,
            CONST.ENDTIME,
        ];
        // pca use testing time only
        timeKeys.forEach((timeKey) => {
            const values = formDataQueried.getAll(timeKey);
            if (values.length > 1) {
                formDataQueried.set(timeKey, values[values.length - 1]);
            }
        });
        let queryString = genQueryStringFromFormData(formDataQueried);
        // queryString = queryString.concat(`&time=${moment(xTime).toISOString()}`);
        queryString = queryString.concat(`&time=${xTime}`);
        queryString = queryString.concat(`&cycle_id=${cycleId}`);
        const sensorId = scpSelectedPoint.sensor_id_x;
        queryString = queryString.concat(`&sensor_id=${sensorId}`);
        showPlotView(queryString);
    }
    hideContextMenu();
};

const showPlotView = (queryString) => {
    // open new tab
    window.open(`/ap/api/common/plot_view?${queryString}`, '_blank');
    return false;
};

const initCommonSearchInput = (inputElement, className = '') => {
    // common-search-input
    if (inputElement.closest('.deleteicon').length) return;

    inputElement
        .wrap(`<span class="deleteicon ${className}"></span>`)
        .after($('<span class="remove-search">x</span>'));

    $('.remove-search').off('click');
    $('.remove-search').on('click', function () {
        const e = $.Event('input');
        e.which = KEY_CODE.ENTER;
        e.keyCode = KEY_CODE.ENTER;
        $(this).prev('input').val('').trigger('input').focus().trigger(e);
    });
};

const keepValueEachDivision = () => {
    let dateRange;
    let traceOption;
    let autoUpdate;
    let oldDivision = $('select[name=compareType]').val();

    $('select[name=compareType]').on('change', function (e) {
        // get value of oldDivision
        const oldParentEl = $(`#for-${oldDivision}`);
        dateRange = $(`#${oldDivision}-daterange`).text();
        traceOption = oldParentEl
            .find('input[name*=raceTime]:is(:checked)')
            .val();
        autoUpdate = oldParentEl
            .find('input[name=autoUpdateInterval]')
            .is(':checked');

        // assign new value to current division
        const division = $(e.currentTarget).val();
        const isCyclicTerm = division.includes('cyclicTerm');
        const isDirectTerm = division.includes('directTerm');
        const parentEl = $(`#for-${division}`);

        if (isCyclicTerm) {
            if (traceOption !== TRACE_TIME_CONST.RECENT) {
                traceOption = TRACE_TIME_CONST.FROM;
            }

            const startDate = dateRange.split(DATETIME_PICKER_SEPARATOR)[0];
            parentEl
                .find('input[name=DATETIME_PICKER]')
                .val(startDate)
                .trigger('change');
        } else if (isDirectTerm) {
            traceOption = TRACE_TIME_CONST.DEFAULT;
            $(parentEl.find('input[name=DATETIME_RANGE_PICKER]')[0])
                .val(dateRange)
                .trigger('change');
        } else {
            if (traceOption !== TRACE_TIME_CONST.RECENT) {
                traceOption = TRACE_TIME_CONST.DEFAULT;
                parentEl
                    .find('input[name=DATETIME_RANGE_PICKER]')
                    .val(dateRange)
                    .trigger('change');
            }
        }

        parentEl
            .find(`input[name*=raceTime][value=${traceOption}]`)
            .prop('checked', true)
            .trigger('change');
        parentEl
            .find('input[name=autoUpdateInterval]')
            .prop('checked', autoUpdate);

        oldDivision = division;
    });
};

const updateCleansing = (inputEle) => {
    const selectedLabel = $('#cleansing-selected');
    const cleansingValues = uniq(
        [
            ...$('#cleansing-content').find(
                'input[type=checkbox]:is(:checked)',
            ),
        ].map((el) => $(el).attr('show-value')),
    );
    let dupValue = $('#cleansing-content')
        .find('select option:selected')
        .map((i, el) => $(el).attr('show-value'));
    const removeOutlierType = dupValue[0];
    dupValue = dupValue.splice(1);
    if (cleansingValues.includes('O')) {
        const indexOfO = cleansingValues.indexOf('O');
        cleansingValues[indexOfO] = 'O' + removeOutlierType;
    }
    if (dupValue) {
        cleansingValues.push(...dupValue);
    }
    const selectedValues =
        cleansingValues.length > 0 ? `[${cleansingValues.join('')}]` : '';
    selectedLabel.text(selectedValues);
    $('input[name=cleansing]').val(selectedValues);
};

const cleansingHandling = () => {
    const openEvent = new Event('open', { bubbles: true });
    $('.custom-selection')
        .off('click')
        .on('click', (e) => {
            const contentDOM = $(e.target)
                .closest('.custom-selection-section')
                .find('.custom-selection-content');
            const contentIsShowed = contentDOM.is(':visible');
            const selectContent = document.getElementById(
                'cyclicCalender-content',
            );
            if (contentIsShowed) {
                contentDOM.hide();
            } else {
                contentDOM.show();
                if (selectContent) {
                    selectContent.dispatchEvent(openEvent);
                }
            }
        });
    window.addEventListener('click', function (e) {
        const orderingContentDOM = document.getElementById('ordering-content');
        const orderingSelectiontDOM =
            document.getElementById('ordering-selection');
        const inOrderingContent = orderingContentDOM
            ? orderingContentDOM.contains(e.target)
            : false;
        const inOrderingSelection = orderingSelectiontDOM
            ? orderingSelectiontDOM.contains(e.target)
            : false;
        if (!inOrderingContent && !inOrderingSelection) {
            $('#ordering-content').hide();
        }

        if (!e.target.closest('.dn-custom-select')) {
            $('.dn-custom-select--select--list').addClass('select-hide');
        }

        if (
            !e.target.closest('.custom-selection-content') &&
            !e.target.closest('.custom-selection')
        ) {
            $('.custom-selection-content').hide();
        }

        // hide single calendar
        if (
            !e.target.closest('.single-calendar') &&
            !e.target.closest('.showSingleCalendar')
        ) {
            $('.single-calendar').hide();
        }

        // hide single calendar
        if (
            !e.target.closest('.config-data-type-dropdown') &&
            !e.target.closest('.config-data-type-dropdown button')
        ) {
            $('.data-type-selection').hide();
        }
    });
};

const getUserSettingData = () => {
    let formId = getShowFormId();
    const getFormSettings = saveLoadUserInput(`#${formId}`);
    const settingDat = getFormSettings(false, false);
    return settingDat;
};

const setOutlierCount = (outliers) => {
    // removing outliers: outliers = [0, >0]
    // non-removing outliers: outliers = null
    if (outliers !== null) {
        $('#outlierCount').attr('title', `Removed: ${outliers}`);
        $('#outlierCount').text(outliers);
    } else {
        $('#outlierCount').text('');
    }
};

const showGraphCallApi = async (
    url,
    formData,
    timeOut,
    callback,
    additionalOption = {},
) => {
    if (!requestStartedAt) {
        requestStartedAt = performance.now();
    }

    if (exportMode()) {
        // set isExportMode to fromData
        formData.set('isExportMode', 1);
    } else {
        formData.delete('isExportMode');
    }

    // set req_id and filter on-demand value if there is option_id in URL params
    const { req_id, bookmark_id, option_id, loadGUIFromURL, func, latest } =
        getRequestParamsForShowGraph();

    if (req_id) {
        formData.set('req_id', req_id);
        // collect user setting in GUI
        if (loadGUIFromURL) {
            // loadGUIFromURL mean the request from /dn7 external API. We will save info of page and setting to create a bookmark from API
            const settingData = getUserSettingData();
            if (latest) {
                const position = settingData
                    .map((object) => object.id)
                    .indexOf('datetimeRangePicker');
                const startDatetime = `${formatDateTime(`${formData.get(CONST.STARTDATE)} ${formData.get(CONST.STARTTIME)}`, DATE_TIME_FMT)}`;
                const endDatetime = `${formatDateTime(`${formData.get(CONST.ENDDATE)} ${formData.get(CONST.ENDTIME)}`, DATE_TIME_FMT)}`;
                settingData[position].value =
                    `${startDatetime}${DATETIME_PICKER_SEPARATOR}${endDatetime}`;
            }
            const params = {
                settings: {
                    traceDataForm: settingData,
                },
                function: func,
            };

            formData.set('params', JSON.stringify(params));
        }
    }

    if (bookmark_id) {
        formData.set('bookmark_id', bookmark_id);
    }

    if (option_id) {
        // get option from db
        const option = await fetchData(
            `/ap/api/v1/option?option_id=${option_id}`,
            {},
            'GET',
        );
        if (option) {
            const { od_filter } = JSON.parse(option.option);
            if (od_filter) {
                formData.set('dic_cat_filters', JSON.stringify(od_filter));
            }
        }
    }

    const option = {
        url,
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        cache: false,
        timeout: timeOut,
        ...additionalOption,
    };

    // send GA mode "Auto update mode" or "Normal mode"
    const GAMode = isSSEListening ? 'AutoUpdate' : 'Normal';
    let showGraphMethod = '';
    if (isLoadingUserSetting) {
        showGraphMethod = 'Bookmark';
    } else if (isDirectFromJumpFunction) {
        showGraphMethod = 'Jump';
    } else {
        showGraphMethod = 'Normal';
    }
    gtag('event', 'apdn7_events_tracking', {
        dn_app_version: app_version,
        dn_app_source: app_source,
        dn_app_group: user_group,
        dn_app_show_graph_mode: GAMode,
        dn_app_show_graph_method: showGraphMethod,
    });

    $.ajax({
        ...option,
        beforeSend: (jqXHR) => {
            formData = handleBeforeSendRequestToShowGraph(jqXHR, formData);
        },
        success: async (res) => {
            try {
                const responsedAt = performance.now();
                // if (!res.array_plotdata || isEmpty(res.array_plotdata)) {
                //     showToastrAnomalGraph();
                //     return false;
                // }
                if (!isSSEListening) {
                    loadingShow(true);
                    await removeAbortButton(res);
                }

                if (clearOnFlyFilter) {
                    clearGlobalDict();
                    initGlobalDict(res.filter_on_demand);
                    initDicChecked(getDicChecked());
                    initUniquePairList(res.dic_filter);
                    jumpKey = formData.get('thread_id');
                }

                await callback(res);

                // load saved graph setting area
                loadGraphSettings(clearOnFlyFilter);
                clearOnFlyFilter = false;

                isGraphShown = true;

                // hide loading inside ajax
                setTimeout(
                    loadingHide,
                    loadingHideDelayTime(res.actual_record_number),
                );

                // move invalid filter
                setColorAndSortHtmlEle(
                    res.matched_filter_ids,
                    res.unmatched_filter_ids,
                    res.not_exact_match_filter_ids,
                );

                // export mode
                handleZipExport(res);

                const finishedAt = performance.now();
                // show processing time at bottom
                drawProcessingTime(
                    responsedAt,
                    finishedAt,
                    res.backend_time,
                    res.actual_record_number,
                    res.unique_serial,
                );

                // show removed outliers count
                setOutlierCount(res.outliers);
            } catch (e) {
                console.error(e);
                loadingHide();
                if (!isGraphShown) {
                    showToastrAnomalGraph();
                }
            }
        },
        error: (res) => {
            loadingHide();
            clearOnFlyFilter = false;
            // export mode
            handleZipExport(res);

            if (additionalOption.page === 'pca') {
                if (additionalOption.clickOnChart) {
                    hideLoading(eleQCont);
                    hideLoading(eleT2Cont);
                    hideLoading(eleBiplot);
                    hideLoading(eleRecordInfoTbl);
                } else {
                    // loading.toggleClass('hide');
                    loadingHide();
                }

                if (res.responseJSON) {
                    const resJson = res.responseJSON || {};

                    if (!additionalOption.reselect) {
                        // click show graph
                        problematicPCAData = {
                            train_data: {
                                null_percent:
                                    resJson.json_errors.train_data
                                        .null_percent || {},
                                zero_variance:
                                    resJson.json_errors.train_data
                                        .zero_variance || {},
                                selected_vars:
                                    resJson.json_errors.train_data
                                        .selected_vars,
                            },
                            target_data: {
                                null_percent:
                                    resJson.json_errors.target_data
                                        .null_percent || {},
                                zero_variance:
                                    resJson.json_errors.target_data
                                        .zero_variance || [],
                                selected_vars:
                                    resJson.json_errors.target_data
                                        .selected_vars,
                            },
                        };
                        reselectCallback = reselectPCAData;
                    }

                    const trainDataErrors =
                        resJson.json_errors.train_data.errors || [];
                    const targetDataErrors =
                        resJson.json_errors.target_data.errors || [];

                    showToastr(resJson.json_errors);
                    if (
                        problematicPCAData &&
                        (trainDataErrors.length || targetDataErrors.length)
                    ) {
                        showRemoveProblematicColsMdl(problematicPCAData, true);
                    }
                    return;
                }
            }

            errorHandling(res);
        },
    }).then(() => {
        afterRequestAction();
        isSSEListening = false;
        disableGUIFormElement();
    });
};

const generateCalenderExample = () => {
    const datetimeRange = $('#datetimeRangeShowValue').text();
    if (!datetimeRange) return;
    const targetDateTimeStr = datetimeRange.split(DATETIME_PICKER_SEPARATOR)[0];

    const calenderCyclicItems = $('.cyclic-calender-option-item');
    if (!calenderCyclicItems || !calenderCyclicItems.length) return;
    for (let i = 0; i < calenderCyclicItems.length; i += 1) {
        const calenderCyclicItem = $(calenderCyclicItems[i]);
        let format = calenderCyclicItem
            .find(`input[name=${CYCLIC_TERM.DIV_CALENDER}]`)
            .val();
        if (!format) continue;

        const example = getExampleFormatOfDate(targetDateTimeStr, format);

        calenderCyclicItem
            .find(`input[name=${CYCLIC_TERM.DIV_CALENDER}]`)
            .attr('data-example', example);
        calenderCyclicItem
            .find('.cyclic-calender-option-example')
            .text(example);
    }
};

const getExampleFormatOfDate = (targetDate, format) => {
    if (!targetDate) {
        const datetimeRange = $('#datetimeRangeShowValue').text();
        if (!datetimeRange) return;
        targetDate = datetimeRange.split(DATETIME_PICKER_SEPARATOR)[0];
    }
    const isFYFormat = getIsFYFormat(format);
    let fmt = '';
    let example = '';
    if (isFYFormat) {
        example = getSpecialFYFormat(targetDate, format);
    } else {
        [fmt, hasW] = transformFormat(format);
        example = moment(targetDate).format(fmt);
        if (hasW) {
            example = example.replace(WEEK_FORMAT, 'W');
        }
    }

    return example;
};

const changeFormatAndExample = (formatEl) => {
    // offset is show only in mode latest and unit != hour
    const currentTarget = $(formatEl);
    if (!currentTarget.prop('checked')) return;
    const formatValue = currentTarget.val();

    const example = getExampleFormatOfDate(null, formatValue);
    $('#cyclicCalender').text(`${formatValue} ${example}`);

    // hide offset input when hour is selected
    const unit = currentTarget.attr('data-unit');
    const offsetIsDisabled = $(`input[name=${CYCLIC_TERM.DIV_OFFSET}]`)
        .parent()
        .hasClass('hide');
    if (!offsetIsDisabled) {
        if (unit === DivideFormatUnit.Hour) {
            $('.for-recent-cyclicCalender').hide();
        } else {
            $('.for-recent-cyclicCalender').show();
        }
    }
};

const handleTimeUnitOnchange = (e) => {
    const _this = $(e);
    const selectedOption = _this
        .find(`option[value=${_this.val()}]`)
        .attr('data-key');
    // set default value of time unit by selected option
    const selectedTimeUnit = TIME_UNIT[selectedOption];
    const timeInput = $(`[name=${CYCLIC_TERM.RECENT_INTERVAL}]`);
    if (!timeInput.val()) {
        timeInput.val(selectedTimeUnit.DEFAULT).trigger('change');
    }
    CYCLIC_TERM.TIME_UNIT = selectedTimeUnit;
    validateInputByNameWithOnchange(
        CYCLIC_TERM.RECENT_INTERVAL,
        selectedTimeUnit,
    );
    showDateTimeRangeValue();
};

const collapsingTiles = (collapsing = true) => {
    const toggle = collapsing ? 'hide' : 'show';
    $('.section-content').collapse(toggle);
};

const showBrowserSupportMsg = () => {
    if (isBrowserInvalidVersion && isBrowserInvalidVersion == '1') {
        const msg = $('#i18nBrowserInvalidVersion')
            .text()
            .replace('BREAK_LINE', '<br>');
        showToastrMsg(msg);
    }
};

const getParamFromUrl = (paramKey) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(paramKey);
};

const getRequestParamsForShowGraph = () => {
    const reqId = getParamFromUrl('req_id');
    const bookmarkId = getParamFromUrl('bookmark_id');
    let startDateTime = getParamFromUrl('start_datetime');
    let endDateTime = getParamFromUrl('end_datetime');
    const optionId = getParamFromUrl('option_id');
    let columns = getParamFromUrl('columns');
    const objective = getParamFromUrl('objective');
    const func = getParamFromUrl('function');
    let procs = getParamFromUrl('end_procs');
    const loadGUIFromURL = !!getParamFromUrl('load_gui_from_url');
    const latest = getParamFromUrl('latest');
    let facet = getParamFromUrl('facet');
    let filter = getParamFromUrl('filter');
    const div = getParamFromUrl('div');
    const page = getParamFromUrl('page');

    columns = columns ? columns.split(',') : [];
    facet = facet ? facet.split(',') : [];
    filter = filter ? filter.split(',') : [];
    procs = procs ? JSON.parse(procs) : [];

    let datetimeRange = '';
    if (startDateTime && endDateTime) {
        const formattedStartDt = formatDateTime(startDateTime, DATE_FORMAT);
        const formattedEndDt = formatDateTime(endDateTime, DATE_FORMAT);
        if ((page && page === PAGE_NAME.chm) || page === PAGE_NAME.fpp) {
            if (formattedStartDt === formattedEndDt) {
                endDateTime = moment(endDateTime).add(1, 'days');
            }
        }
        datetimeRange = `${formatDateTime(startDateTime, DATE_TIME_FMT)}${DATETIME_PICKER_SEPARATOR}${formatDateTime(endDateTime, DATE_TIME_FMT)}`;
    }

    return {
        req_id: reqId,
        bookmark_id: bookmarkId,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        option_id: optionId,
        columns: columns,
        func: func,
        objective: objective,
        datetimeRange: datetimeRange,
        endProcs: procs,
        loadGUIFromURL: loadGUIFromURL,
        latest: latest,
        facet: facet,
        filter: filter,
        div: div,
    };
};

const modifyGUIInput = () => {
    let { start_datetime, end_datetime, bookmark_id, datetimeRange, latest } =
        getRequestParamsForShowGraph();
    if (start_datetime && end_datetime && bookmark_id) {
        const dateTimeRangeInput = $(
            'input[name=DATETIME_RANGE_PICKER]:not(:disabled)',
        );
        const dateTimeInput = $('input[name=DATETIME_PICKER]:not(:disabled)');

        if (dateTimeRangeInput.length) {
            dateTimeRangeInput.val(datetimeRange);
        } else if (datetimeRange.length) {
            dateTimeInput.val(formatDateTime(start_datetime, DATE_TIME_FMT));
        }
    }

    if (latest) {
        $('input[name=traceTime][value=recent]')
            .prop('checked', true)
            .trigger('change');
        $('input[name=cyclicTermTraceTime1][value=recent]')
            .prop('checked', true)
            .trigger('change');
        $('input[name=varTraceTime1][value=recent]')
            .prop('checked', true)
            .trigger('change');
        $('input[name=varTraceTime2][value=recent]')
            .prop('checked', true)
            .trigger('change');
        $('input[name=autoUpdateInterval]').prop('checked', true);
        $('select[name=timeUnit]').val('60').trigger('change');
        $('input[name=recentTimeInterval]').val(latest);
    }
};

const makeUserSettingFromParams = async () => {
    let {
        datetimeRange,
        objective,
        columns,
        endProcs,
        start_datetime,
        latest,
        facet,
        filter,
        div,
    } = getRequestParamsForShowGraph();
    const settings = [];
    const divideOption = $('select[name=compareType]');
    if (divideOption.length) {
        if (div) {
            settings.push({
                id: 'divideOption',
                name: 'compareType',
                type: 'select-one',
                value: 'category',
            });
            if (start_datetime) {
                settings.push({
                    id: 'datetimeRangePicker',
                    name: 'DATETIME_RANGE_PICKER',
                    type: 'text',
                    value: datetimeRange,
                });
            }
        } else {
            settings.push({
                id: 'divideOption',
                name: 'compareType',
                type: 'select-one',
                value: 'cyclicTerm',
            });
            if (start_datetime) {
                settings.push({
                    id: 'cyclicTermDatetimePicker',
                    name: 'DATETIME_PICKER',
                    type: 'text',
                    value: formatDateTime(start_datetime, DATE_TIME_FMT),
                });
            }
        }
    }
    if (datetimeRange && !divideOption.length) {
        settings.push({
            id: 'radioDefaultInterval',
            name: 'traceTime',
            value: 'traceTime',
            type: 'radio',
            checked: 'true',
        });
        settings.push({
            id: 'datetimeRangePicker',
            name: 'DATETIME_RANGE_PICKER',
            type: 'text',
            value: datetimeRange,
        });
    }

    for (const idx in endProcs) {
        const endProc = endProcs[idx];
        const cfgProcess = procConfigs[endProc];
        const index = Number(idx) + 1;
        settings.push({
            id: `end-proc-process-${index}`,
            name: `end_proc${index}`,
            value: endProc.toString(),
            type: 'select-one',
            genBtnId: 'btn-add-end-proc',
        });
        await cfgProcess.updateColumns();

        for (const colId of columns) {
            const column = cfgProcess.getColumnById(colId);
            if (!column) continue;
            settings.push({
                id: `checkbox-${colId}end-proc-val-div-${index}`,
                value: colId.toString(),
                name: `GET02_VALS_SELECT${index}`,
                type: 'checkbox',
                checked: true,
            });
        }

        if (facet) {
            for (let facetCol of facet) {
                const column = cfgProcess.getColumnById(facetCol);
                if (!column) continue;
                settings.push({
                    id: `catExpItem-${facetCol}`,
                    name: 'catExpBox',
                    value: String(facet.indexOf(facetCol) + 1),
                    type: 'select-one',
                    level: 2,
                });
            }
        }

        if (div) {
            const column = cfgProcess.getColumnById(div);
            if (column) {
                settings.push({
                    id: `catExpItem-${div}`,
                    name: 'catExpBox',
                    value: 3,
                    type: 'select',
                });
            }
        }

        if (filter) {
            for (let filterCol of filter) {
                const column = cfgProcess.getColumnById(filterCol);
                if (!column) continue;
                settings.push({
                    id: `categoryLabel-${filterCol}`,
                    checked: true,
                    name: `GET02_CATE_SELECT${index}`,
                    value: `${filterCol}`,
                    type: 'checkbox',
                });
            }
        }
    }

    if (latest) {
        settings.push({
            id: 'radioDefaultInterval',
            name: 'traceTime',
            value: 'recent',
            type: 'radio',
            checked: 'true',
        });
        settings.push({
            id: 'cyclicRecentInterval',
            name: 'cyclicTermTraceTime1',
            checked: true,
            value: 'recent',
            type: 'radio',
        });

        settings.push({
            id: 'CyclicAutoUpdateInterval',
            name: 'autoUpdateInterval',
            checked: true,
            value: '1',
            type: 'checkbox',
        });

        settings.push({
            id: 'timeUnit',
            name: 'timeUnit',
            type: 'select-one',
            value: '60',
        });

        settings.push({
            id: 'recentTimeInterval',
            name: 'recentTimeInterval',
            value: latest,
            type: 'text',
        });
    }

    if (objective) {
        settings.push({
            id: `objectiveVar-${objective}`,
            name: 'objectiveVar',
            value: objective,
            type: 'radio',
            checked: true,
        });
    }

    return {
        settings: {
            traceDataForm: settings,
        },
    };
};

const needToLoaUserSettingsFromUrl = () => {
    const { loadGUIFromURL } = getRequestParamsForShowGraph();
    return loadGUIFromURL;
};

const showNominalScaleModal = () => {
    $('#nominalScaleModal').modal('show');
    loadNominalSensors(graphStore.getTraceData());
};

const loadNominalSensors = (resData) => {
    let trs = '';
    let index = 1;
    for (const sensor of resData.category_cols) {
        trs += `
            <tr>
                <td style="padding: 2px 5px 2px 5px; text-align: center">${index}</td>
                <td style="padding: 2px 5px 2px 0.75rem;">${sensor.proc_shown_name || sensor.proc_en_name}</td>
                <td style="padding: 2px 5px 2px 0.75rem;">${sensor.col_shown_name || sensor.col_en_name}</td>
                <td style="padding: 2px 5px 2px 0.75rem;">${dataTypeShort(sensor)}</td>
                <td style="padding: 2px 5px 2px 0.75rem;">
                    <div class="custom-control custom-checkbox custom-control-inline">
                         <input type="checkbox" id="nominalScaleGraph${index}" name="graph_nominal_scale" 
                            class="custom-control-input" ${sensor.is_checked ? 'checked' : ''}
                            onchange="checkAsNominalScale()" value="${sensor.col_id}">
                         <label class="custom-control-label" title="" for="nominalScaleGraph${index}"></label>
                    </div>
                </td>
            </tr>
        `;

        index++;
    }
    $('#nominalScaleTable tbody').html(trs);
    onSearchNominalScale();
    checkAsNominalScale();
};

const onSearchNominalScale = () => {
    onSearchTableContent('searchNominalScaleInput', 'nominalScaleTable');

    $('#setNominalScaleInput').off('click');
    $('#setNominalScaleInput').on('click', (e) => {
        e.preventDefault();
        const matchedEls = $('#nominalScaleTable tbody tr:not(.gray)');
        matchedEls
            .find('input[name=graph_nominal_scale]')
            .prop('checked', true)
            .trigger('change');
    });

    $('#resetNominalScaleInput').off('click');
    $('#resetNominalScaleInput').on('click', (e) => {
        e.preventDefault();
        const matchedEls = $('#nominalScaleTable tbody tr:not(.gray)');
        matchedEls
            .find('input[name=graph_nominal_scale]')
            .prop('checked', false)
            .trigger('change');
    });
};
const checkAllAsNominalScale = (e) => {
    const isCheckAll = $(e).is(':checked');
    $('input[name=graph_nominal_scale]').prop('checked', isCheckAll);
};

const checkAsNominalScale = () => {
    const nomialScaleItems = $(
        'input[name=graph_nominal_scale]:checked',
    ).length;
    const allItems = $('input[name=graph_nominal_scale]').length;
    const checkAll = nomialScaleItems == allItems;
    $('input[name=nominal_scale_all]').prop('checked', checkAll);
};
