/* eslint-disable arrow-parens,camelcase */
// eslint-disable no-undef, no-unused-vars

// term of use
validateTerms();

let serverSentEventCon = null;
let loadingProgressBackend = 0;
const serverSentEventUrl = '/histview2/api/setting/listen_background_job';

let originalUserSettingInfo;

const serverSentEventType = {
    jobRun: 'JOB_RUN',
    procLink: 'PROC_LINK',
    shutDown: 'SHUT_DOWN',
    dataTypeErr: 'DATA_TYPE_ERR',
    emptyFile: 'EMPTY_FILE',
    pcaSensor: 'PCA_SENSOR',
    showGraph: 'SHOW_GRAPH',
    diskUsage: 'DISK_USAGE',
};

let isShutdownListening = false;

const baseEles = {
    shutdownApp: '#shutdownApp',
    shutdownAppModal: '#shutdownAppModal',
    btnConfirmShutdownApp: '#btnConfirmShutdownApp',
    i18nJobStatusMsg: '#i18nJobStatusMsg',
    i18nJobsStopped: '#i18nJobsStopped',
    i18nWarningTitle: '#i18nWarningTitle',
    i18nCsvTemplateWarningTitle: '#i18nCsvTemplateError',
    i18nImportEmptyFileMsg: '#i18nImportEmptyFileMsg',
    i18nCopied: '#i18nCopied',
    i18nPasted: '#i18nPasted',
    i18nWarningFullDiskMsg: '#i18nWarningFullDiskMsg',
    i18nErrorFullDiskMsg: '#i18nErrorFullDiskMsg',
};

const GRAPH_CONST = {
    histHeight: '100%', // vw, not vh in this case, when change, plz also change ".his" class in trace_data.css
    histWidth: '100%',
    histHeightShort: 'calc(0.75 * 23vw)', // just 3/4 of the original height
    histSummaryHeight: 'auto', // ~1/4 of histogram
};

const openServerSentEvent = () => {
    if (serverSentEventCon === undefined || serverSentEventCon === null) {
        serverSentEventCon = new EventSource(serverSentEventUrl);
    }

    return serverSentEventCon;
};

const closeOldConnection = (eventSource) => {
    if (eventSource !== undefined && eventSource !== null) {
        eventSource.close();
        eventSource = null;
    }
};

// shutdown app code - SSE
const shutdownAppPolling = () => {
    const source = openServerSentEvent();
    source.addEventListener(serverSentEventType.shutDown, (event) => {
        const msg = JSON.parse(event.data);
        if (msg) {
            // show toastr to notify user
            showToastrMsg($(baseEles.i18nJobsStopped).text(), $(baseEles.i18nWarningTitle).text());

            // call API to shutdown app
            setTimeout(() => {
                fetch('/histview2/api/setting/shutdown', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}),
                })
                    .then(response => response.clone().json())
                    .then(() => {
                        // closeOldConnection(source);
                    })
                    .catch(() => {
                        // closeOldConnection(source);
                    });
            }, 2000); // wait 2 seconds to let app update 100% in background job page
        }
    }, false);
};

// import job data type error notification
const notifyStatusSSE = () => {
    const source = openServerSentEvent();

    // data type error
    source.addEventListener(serverSentEventType.dataTypeErr, (event) => {
        const data = JSON.parse(event.data);
        if (data) {
            let msg = $(baseEles.i18nJobStatusMsg).text();
            msg = msg.replace('__param__', data);

            // show toastr to notify user
            showToastrMsg(msg, $(baseEles.i18nWarningTitle).text());
        }
    }, false);

    // import empty file
    source.addEventListener(serverSentEventType.emptyFile, (event) => {
        const data = JSON.parse(event.data);
        if (data) {
            let msg = $(baseEles.i18nImportEmptyFileMsg).text();
            msg = msg.replace('__param__', `<br>${data.join('<br>')}`);

            // show toast to notify user
            showToastrMsg(msg, $(baseEles.i18nWarningTitle).text());
        }
    }, false);

    // fetch pca data
    source.addEventListener(serverSentEventType.pcaSensor, (event) => {
        const data = JSON.parse(event.data);
        try {
            appendSensors(data);
        } catch (e) {
            //
        }
    }, false);

    // fetch pca data
    source.addEventListener(serverSentEventType.showGraph, (event) => {
        const data = JSON.parse(event.data);
        try {
            if (data > loadingProgressBackend) {
                loadingUpdate(data);
                loadingProgressBackend = data;
            }
        } catch (e) {
            //
        }
    }, false);

    // show warning/error message about disk usage
    source.addEventListener(serverSentEventType.diskUsage, (event) => {
        const data = JSON.parse(event.data);
        checkDiskCapacity(data);
    }, false);
};

const checkDiskCapacity = (data) => {
    const edgeServerType = 'EdgeServer';

    const isMarqueeMessageDisplay = () => {
        const serverTypeList = [edgeServerType];
        for (let i = 0; i < serverTypeList.length; i++) {
            const marqueMsgElm = $(`#marquee-msg-${serverTypeList[i].toLowerCase()}`);
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
        } else { // In case of normal, hide marquee message
            show_flag = 'hidden';
        }

        const marqueMsgElm = $(`#marquee-msg-${data.server_type.toLowerCase()}`);
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
    if (isMarqueeMessageDisplay() && !isSidebarOpen()) sidebarCollapse();
};

const addAttributeToElement = (parent = null) => {
    // single select2
    setSelect2Selection(parent);

    // normalization
    convertTextH2Z(parent);
};

// eslint-disable-next-line no-unused-vars
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
    const ele = $(`#${collapseId}`).parents('.card')
        .find('.collapse-box')
        .find('.more-less');
    ele.removeClass('fa-window-maximize');
    ele.addClass('fa-window-minimize');
};

const toggleToMaxIcon = (collapseId) => {
    const ele = $(`#${collapseId}`).parents('.card')
        .find('.collapse-box')
        .find('.more-less');
    ele.removeClass('fa-window-minimize');
    ele.addClass('fa-window-maximize');
};

const hideContextMenu = () => {
    const menuName = '[name=contextMenu]';
    $(menuName).css({ display: 'none' });
};

const handleMouseUp = (e) => { // later, not just mouse down, + mouseout of menu
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

const maximizeCard = (collapseId, clickEle = null, name = false) => {
    const targetCards = getMinMaxCard(collapseId, clickEle, name);
    targetCards.addClass('show');
    targetCards.each((_, e) => {
        toggleToMinIcon(e.id);
    });
};

const minimizeCard = (collapseId, clickEle = null, name = false) => {
    const targetCards = getMinMaxCard(collapseId, clickEle, name);
    targetCards.removeClass('show');
    targetCards.each((_, e) => {
        toggleToMaxIcon(e.id);
    });
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

const showHideShutDownButton = () => {
    const hostName = window.location.hostname;
    if (!['localhost', '127.0.0.1'].includes(hostName)) {
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
            $(sidebarEles.dropdownToggle).unbind('mouseenter')
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

const autoCheckboxInListItem = () => {
    $('.list-group-item').on('click', () => {
        console.log('click checkbox');
    });
};

// mark as call page from tile interface, do not apply user setting
const useTileInterface = () => {
    const set = () => {
        localStorage.setItem('isLoadingFromTitleInterface', true);
        return true;
    };
    const get = () => {
        const isUseTitleInterface = localStorage.getItem('isLoadingFromTitleInterface');
        return !!isUseTitleInterface;
    };
    const reset = () => {
        localStorage.removeItem('isLoadingFromTitleInterface');
        return null;
    };
    return { set, get, reset };
};


const isLoadingFromTitleInterface = useTileInterface().get();

$(() => {
    // hide userBookmarkBar
    $('#userBookmarkBar').hide();

    overrideUiSortable();

    updateI18nCommon();

    // init fatal error polling
    notifyStatusSSE();

    checkDiskCapacity();

    SetAppEnv();

    // click shutdown event
    $('body').click((e) => {
        if ($(e.target).closest(baseEles.shutdownApp).length) {
            $(baseEles.shutdownAppModal).modal('show');
        }
    });

    $(baseEles.btnConfirmShutdownApp).click(() => {
        // init shutdown polling
        if (isShutdownListening === false) {
            shutdownAppPolling();
            isShutdownListening = true;
        }

        setTimeout(() => {
            // wait for SSE connection was established

            // call API to shutdown
            fetch('/histview2/api/setting/stop_job', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            })
                .then(response => response.clone().json())
                .then(() => {
                })
                .catch(() => {
                });
        }, 1000);
    });

    // single select2
    addAttributeToElement();

    const loadingSetting = localStorage.getItem('loadingSetting') || null;
    if (isLoadingFromTitleInterface) {
        // reset global flag after use tile interface
        useTileInterface().reset();
        setTimeout(() => {
            // save original setting info
            originalUserSettingInfo = saveOriginalSetting();
        }, 100);
    } else {
        // load user input on page load
        setTimeout(() => {
            // save original setting info
            originalUserSettingInfo = saveOriginalSetting();
            if (loadingSetting) {
                const loadingSettingObj = JSON.parse(loadingSetting);
                const isRedirect = loadingSettingObj.redirect;
                if (isRedirect) {
                    useUserSetting(loadingSettingObj.settingID);
                }
            } else {
                useUserSettingOnLoad();
            }

            // const allTabs = getAllTabs();
            // allTabs.each((_, tab) => setTriggerInvalidFilter(tab));
        }, 100);
    }


    // onChange event for datetime group
    setTimeout(() => {
        onChangeForDateTimeGroup();
    }, 1000);

    showHideShutDownButton();

    autoCheckboxInListItem();

    sidebarCollapseHandle();

    // trigger auto click show graph
    setTimeout(() => {
        if (loadingSetting) {
            const showGraphBtn = $('button.show-graph');
            // if (showGraphBtn.data('with-tab')) {
            //     const activeTab = showGraphBtn.closest('.tab-pane.active');
            //     if (activeTab) {
            //         showGraphBtn = $(activeTab).find('.show-graph');
            //     }
            // }
            // console.log(showGraphBtn);
            //
            // debug mode
            const loadingSettingObj = JSON.parse(loadingSetting);
            if (loadingSettingObj.isExportMode) {
                const input = document.createElement('input');
                input.setAttribute('type', 'hidden');
                input.setAttribute('name', 'isExportMode');
                input.setAttribute('value', loadingSettingObj.settingID);
                // append to form element that you want .
                $(showGraphBtn).after(input);
            }

            if (loadingSettingObj.isImportMode) {
                const input = document.createElement('input');
                input.setAttribute('type', 'hidden');
                input.setAttribute('name', 'isImportMode');
                input.setAttribute('value', loadingSettingObj.isImportMode);
                // append to form element that you want .
                $(showGraphBtn).after(input);
            }

            $(showGraphBtn).click();
            clearLoadingSetting();
        }
    }, 4000);

    $('[name=pasteCard]').click((e) => {
        const divTarget = e.currentTarget.closest('.card-body');
        // console.log(divTarget);

        const sharedSetting = JSON.parse(localStorage.getItem(SHARED_USER_SETTING));
        useUserSetting(null, sharedSetting, divTarget);

        setTimeout(() => {
            setTooltip($(e.currentTarget), $(baseEles.i18nPasted).text());
        }, 2000);
    });

    $('[name=pastePage]').click((e) => {
        const sharedSetting = JSON.parse(localStorage.getItem(SHARED_USER_SETTING));
        useUserSetting(null, sharedSetting);

        setTimeout(() => {
            setTooltip($(e.currentTarget), $(baseEles.i18nPasted).text());
        }, 2000);
    });

    $('[name=copyPage]').click(function () {
        let formId = getShowFormId();
        const loadFunc = saveLoadUserInput(`#${formId}`, '', '', SHARED_USER_SETTING);
        loadFunc(false);
        setTooltip($(this), $(baseEles.i18nCopied).text());
    });

    // Search table user setting
    onSearchTableContent('searchInTopTable', 'tblUserSetting');
});

const initTargetPeriod = () => {
    removeDateTimeInList();
    addNewDatTimeRange();
    showDateTimeRangeValue();

    setTimeout(() => {
        $('input[type=text]').trigger('change');
    }, 1000);
};

const onSearchTableContent = (inputID, tbID) => {
    $(`#${inputID}`).on('input', (e) => {
        const { value } = e.currentTarget;
        searchTableContent(tbID, value, false);
    });

    $(`#${inputID}`).on('change', (e) => {
        const { value } = e.currentTarget;
        searchTableContent(tbID, value, true);
    });
};

const searchTableContent = (tbID, value, isFilter = true) => {
    const regex = new RegExp(value.toLowerCase(), 'i');
    $(`#${tbID} tbody tr`).filter(function () {
        let text = '';
        $(this).find('td').each((i, td) => {
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

            if (textArea.length === 0 && input.length === 0 && selects.length === 0) {
                text += $(td).text();
            }
        });

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

        if (currentShower) {
            currentShower.show();
            currentShower.find('input').trigger('change');
            currentShower.siblings().hide();
        }
    }
};

const handleChangeDivideOption = (e) => {
    const tabs = [];
    e.options.forEach(el => {
        tabs.push(el.value);
    });
    const currentShower = $(`#for-${e.value}`);
    currentShower.removeAttr('style');
    toggleDisableAllInputOfNoneDisplayEl(currentShower, false);
    tabs.forEach(tab => {
        if (tab !== e.value) {
            $(`#for-${tab}`).css({ display: 'none', visibility: 'hidden' });
            toggleDisableAllInputOfNoneDisplayEl($(`#for-${tab}`));
        }
    });

    showDateTimeRangeValue();
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
            <div class="datetimerange-group d-flex align-items-center">
                ${dateTimeRangePickerHTML('DATETIME_RANGE_PICKER', dtId, randomIndex, 'False', 'data-gen-btn=termBtnAddDateTime')}
                <span class="ml-2 remove-date"><i class="fa fa-times fa-sm"></i></span>
            </div>
        `;

        $('#datetimeList').append(newDateHtml);
        removeDateTimeInList();
        initializeDateTimeRangePicker(dtId);
    });
};

const removeUnusedDate = () => {
    // remove extra date
    const dateGroups = $('.datetimerange-group').find('[name=DATETIME_RANGE_PICKER]');
    dateGroups.each((i, el) => {
        const val = el.value;
        if (!val) {
            $(el).closest('.datetimerange-group').find('.remove-date').trigger('click');
        }
    });
};

const getDateTimeRangeValue = () => {
    const currentTab = $('select[name=compareType]').val();
    let result = '';

    if (currentTab === 'var' || currentTab === 'category' || currentTab === 'dataNumberTerm') {
        result = calDateTimeRangeForVar(currentTab);
        if (result.trim() === DATETIME_PICKER_SEPARATOR.trim()) {
            result = `${DEFAULT_START_DATETIME}${DATETIME_PICKER_SEPARATOR}${DEFAULT_END_DATETIME}`;
        }
    } else if (currentTab === 'cyclicTerm') {
        result = calDateTimeRangeForCyclic(currentTab);
    } else {
        result = calDateTimeRangeForDirectTerm(currentTab);
    }

    $('#datetimeRangeShowValue').text(result);
};

const showDateTimeRangeValue = () => {
    getDateTimeRangeValue();
    $('.to-update-time-range').on('change', (e) => {
        getDateTimeRangeValue();
    });
};

const calDateTimeRangeForVar = (currentTab) => {
    const currentTargetDiv = $(`#for-${currentTab}`);
    const traceOption = currentTargetDiv.find('[name*=varTraceTime]:checked').val();
    const startDate = currentTargetDiv.find('[name=START_DATE]').val();
    const endDate = currentTargetDiv.find('[name=END_DATE]').val();
    const startTime = currentTargetDiv.find('[name=START_TIME]').val();
    const endTime = currentTargetDiv.find('[name=END_TIME]').val();
    const recentTimeInterval = currentTargetDiv.find('[name=recentTimeInterval]').val() || 24;
    const timeUnit = currentTargetDiv.find('[name=timeUnit]').val() || 60;

    if (traceOption === TRACE_TIME_CONST.RECENT) {
        const timeDiffMinute = Number(recentTimeInterval) * Number(timeUnit);
        const newStartDate = moment().add(-timeDiffMinute, 'minute').format(DATE_FORMAT);
        const newStartTime = moment().add(-timeDiffMinute, 'minute').format(TIME_FORMAT);
        const newEndDate = moment().format(DATE_FORMAT);
        const newEndTime = moment().format(TIME_FORMAT);
        return `${newStartDate} ${newStartTime}${DATETIME_PICKER_SEPARATOR}${newEndDate} ${newEndTime}`;
    }
    return `${startDate} ${startTime}${DATETIME_PICKER_SEPARATOR}${endDate} ${endTime}`;
};

const calDateTimeRangeForCyclic = (currentTab) => {
    const currentTargetDiv = $(`#for-${currentTab}`);

    const traceTimeOption = currentTargetDiv.find('[name=cyclicTermTraceTime1]:checked').val();
    const divisionNum = currentTargetDiv.find('[name=cyclicTermDivNum]').val();
    const intervalNum = currentTargetDiv.find('[name=cyclicTermInterval]').val();
    const windowsLengthNum = currentTargetDiv.find('[name=cyclicTermWindowLength]').val();


    const targetDate = traceTimeOption === TRACE_TIME_CONST.RECENT
        ? moment().format('YYYY-MM-DD') : currentTargetDiv.find('[name=START_DATE]').val();
    const targetTime = traceTimeOption === TRACE_TIME_CONST.RECENT
        ? moment().format('HH:mm') : currentTargetDiv.find('[name=START_TIME]').val();


    const [startTimeRange, endTimeRange] = traceTimeOption === TRACE_TIME_CONST.FROM ? getEndTimeRange(
        targetDate, targetTime, divisionNum, intervalNum, windowsLengthNum,
    ) : getStartTimeRange(
        traceTimeOption, targetDate, targetTime, divisionNum, intervalNum, windowsLengthNum,
    );

    return `${startTimeRange[0]} ${startTimeRange[1]}${DATETIME_PICKER_SEPARATOR}${endTimeRange[0]} ${endTimeRange[1]}`;
};

const getEndTimeRange = (targetDate, targetTime, divisionNum, intervalNum, windowsLengthNum) => {
    const MILSEC = 60 * 60 * 1000;
    const startDateTimeMil = moment(`${targetDate} ${targetTime}`).valueOf();
    const endDateTimeMil = startDateTimeMil + ((divisionNum - 1) * intervalNum * MILSEC) + (windowsLengthNum * MILSEC);

    return [
        [
            targetDate,
            targetTime,
        ],
        [
            moment(endDateTimeMil).format(DATE_FORMAT),
            moment(endDateTimeMil).format(TIME_FORMAT),
        ],
    ];
};
const getStartTimeRange = (traceTimeOpt, targetDate, targetTime, divisionNum, intervalNum, windowsLengthNum) => {
    const MILSEC = 60 * 60 * 1000;
    const endDateTimeMil = moment(`${targetDate} ${targetTime}`).valueOf();
    const startDateTimeMil = endDateTimeMil - ((divisionNum - 1) * intervalNum * MILSEC) - (windowsLengthNum * MILSEC);

    // default as RECENT type
    let endTimeRange = [
        moment().format(DATE_FORMAT),
        moment().format(TIME_FORMAT),
    ];
    if (traceTimeOpt === TRACE_TIME_CONST.TO) {
        endTimeRange = [
            targetDate,
            targetTime,
        ];
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
    const minDate = minOfStart ? moment(Math.min(...starts)).format(DATETIME_PICKER_FORMAT) : '';
    const maxDate = maxOfEnd ? moment(Math.max(...ends)).format(DATETIME_PICKER_FORMAT) : '';

    return `${minDate}${DATETIME_PICKER_SEPARATOR}${maxDate}`;
};

const SetAppEnv = () => {
    const env = localStorage.getItem('env');
    if (env) return;
    $.get('/histview2/api/setting/get_env', (resp) => {
        localStorage.setItem('env', resp.env);
    });
};

const setRequestTimeOut = (timeout = 60000) => {
    const env = localStorage.getItem('env');
    return env === 'prod' ? timeout : 60000000;
};
