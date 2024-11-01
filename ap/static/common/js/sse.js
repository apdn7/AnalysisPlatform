// eslint-disable no-undef, no-unused-vars

/** @type {EventSource} */
let serverSentEventCon = null;
const serverSentEventUrl = '/ap/api/setting/listen_background_job';
const serverSentEventType = {
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

/**
 * Enum to control whether we should populate event between tabs.
 * @readonly
 * @enum {string}
 */
const ShouldBroadcast = Object.freeze({
    DEFAULT: 'DEFAULT', // Only leader can send broadcast
    YES: 'YES', // Force broadcast
    NO: 'NO', // Do not broadcast
});

// Use broadcast channel from <https://github.com/pubkey/broadcast-channel>
const broadcastChannel = new BroadcastChannel2('sse');
const broadcastChannelElector = createLeaderElection(broadcastChannel, {
    fallbackInterval: 2000, // optional configuration for how often will renegotiation for leader occur
    responseTime: 1000, // optional configuration for how long will instances have to respond
});

/**
 * See more <https://github.com/pubkey/broadcast-channel/tree/master?tab=readme-ov-file#using-the-leaderelection>
 */
broadcastChannelElector.awaitLeadership().then(() => {
    let uuid = localStorage.getItem('uuid');
    if (uuid == null) {
        uuid = create_UUID();
        localStorage.setItem('uuid', uuid);
    }

    // open connection to backend
    serverSentEventCon = new EventSource(`${serverSentEventUrl}/${uuid}`);

    // Register event
    for (const [eventType, eventName] of Object.entries(serverSentEventType)) {
        serverSentEventCon.addEventListener(
            eventName,
            (event) => {
                const data = JSON.parse(event.data);
                handleSSEMessage({
                    type: eventName,
                    data,
                    broadcastType: ShouldBroadcast.DEFAULT,
                });
            },
            false,
        );
    }
});

/**
 * Handle duplicated leaders
 * See more <https://github.com/pubkey/broadcast-channel/tree/master?tab=readme-ov-file#handle-duplicate-leaders>
 */
broadcastChannelElector.onduplicate = () => {
    // Abort everything
    // FIXME: this might not be a correct solution
    broadcastChannelElector.die().then(() => {});
    if (serverSentEventCon) {
        serverSentEventCon.close();
        serverSentEventCon = null;
    }
};

/**
 * Handle sse message by default.
 * @param {Object} event
 * @param {String} event.type - event type
 * @param {String | Object} event.data - event data
 * @param {ShouldBroadcast} event.broadcastType - control how we broadcast
 */
broadcastChannel.onmessage = (event) => {
    handleSSEMessage(event);
};

/**
 * Handle SSE messages and errors. Must use destructing here to pass data between channels.
 * @param {Object} event
 * @param {String} event.type - event type
 * @param {String | Object} event.data - event data
 * @param {ShouldBroadcast} event.broadcastType - control how we broadcast
 */
const handleSSEMessage = ({
    type,
    data,
    broadcastType = ShouldBroadcast.DEFAULT,
}) => {
    // Should we broadcast to other tabs ?
    // If broadcast type is default, and we are leader, just broadcast it.
    // Otherwise, we can force broadcast if broadcastType is YES
    const shouldBroadcast =
        (broadcastType === ShouldBroadcast.DEFAULT &&
            broadcastChannelElector.isLeader) ||
        broadcastType === ShouldBroadcast.YES;
    const tabType = broadcastChannelElector.isLeader ? 'Master' : 'Sub';
    // Logging.
    if (shouldBroadcast) {
        consoleLogDebug(`[SSE][${tabType}] Broadcast: ${type}`, data);
    } else {
        consoleLogDebug(`[SSE][${tabType}] ${type}`, data);
    }

    // data type error
    if (type === serverSentEventType.dataTypeErr) {
        handleError(data);
    }

    // import empty file
    else if (type === serverSentEventType.emptyFile) {
        handleEmptyFile(data);
    }

    // fetch pca data
    else if (type === serverSentEventType.pcaSensor) {
        if (typeof appendSensors !== 'undefined') {
            appendSensors(data);
        }
    }

    // fetch show graph progress
    else if (type === serverSentEventType.showGraph) {
        if (typeof showGraphProgress !== 'undefined') {
            showGraphProgress(data);
        }
    }

    // show warning/error message about disk usage
    else if (type === serverSentEventType.diskUsage) {
        if (typeof checkDiskCapacity !== 'undefined') {
            checkDiskCapacity(data);
        }
    }

    // update background jobs in job pages
    else if (type === serverSentEventType.jobRun) {
        if (typeof updateBackgroundJobs !== 'undefined') {
            updateBackgroundJobs(data);
        }
    }

    // shutdown app
    else if (type === serverSentEventType.shutDown) {
        if (typeof shutdownApp !== 'undefined') {
            shutdownApp();
        }
    }

    // update calculated proclink
    else if (type === serverSentEventType.procLink) {
        // calculate proc link count
        if (typeof realProcLink !== 'undefined') {
            realProcLink(false);
            setTimeout(hideAlertMessages, 3000);
        }

        if (typeof handleSourceListener !== 'undefined') {
            handleSourceListener();
        }
    }

    // for reload trace config
    else if (type === serverSentEventType.reloadTraceConfig) {
        if (typeof doReloadTraceConfig !== 'undefined') {
            const { procs: procs, isUpdatePosition: isUpdatePosition } = data;
            doReloadTraceConfig(procs, isUpdatePosition);
        }
    }

    // for data register page
    else if (type === serverSentEventType.dataRegister) {
        if (typeof updateDataRegisterStatus !== 'undefined') {
            updateDataRegisterStatus({ type, data });
        }
    }

    // for backup data
    else if (type === serverSentEventType.backupDataFinished) {
        if (typeof showBackupDataFinishedToastr !== 'undefined') {
            showBackupDataFinishedToastr();
        }
    }

    // for restore data
    else if (type === serverSentEventType.restoreDataFinished) {
        if (typeof showRestoreDataFinishedToastr !== 'undefined') {
            showRestoreDataFinishedToastr();
        }
    }

    // unhandled event
    else {
        consoleLogDebug(`Unhandled event ${type}`, data);
    }

    if (shouldBroadcast) {
        // set broadcastType is NO to avoid looping
        broadcastChannel.postMessage({
            type,
            data,
            broadcastType: ShouldBroadcast.NO,
        });
    }
};
