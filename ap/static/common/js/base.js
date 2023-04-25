/* eslint-disable arrow-parens,camelcase */
// eslint-disable no-undef, no-unused-vars

// term of use
validateTerms();
let scpSelectedPoint = null;
let scpCustomData = null;
let serverSentEventCon = null;
let loadingProgressBackend = 0;
let formDataQueried = null;
const serverSentEventUrl = '/ap/api/setting/listen_background_job';

let originalUserSettingInfo;
let isGraphShown = false;
let requestStartedAt;

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
    i18nCsvTemplateWarningTitle: '#i18nCsvTemplateError',
    i18nImportEmptyFileMsg: '#i18nImportEmptyFileMsg',
    i18nCopied: '#i18nCopied',
    i18nPasted: '#i18nPasted',
    i18nWarningFullDiskMsg: '#i18nWarningFullDiskMsg',
    i18nErrorFullDiskMsg: '#i18nErrorFullDiskMsg',
    i18nCommonErrorMsg: '#i18nCommonErrorMsg',
};

const GRAPH_CONST = {
    histHeight: '100%', // vw, not vh in this case, when change, plz also change ".his" class in trace_data.css
    histWidth: '100%',
    histHeightShort: 'calc(0.75 * 23vw)', // just 3/4 of the original height
    histSummaryHeight: 'auto', // ~1/4 of histogram
};

const divideOptions = {
    var: 'var',
    category: 'category',
    cyclicTerm: 'cyclicTerm',
    directTerm: 'directTerm',
    dataNumberTerm: 'dataNumberTerm',
    cyclicCalender: 'cyclicCalender',
}

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
	        showToastrMsg(msg, MESSAGE_LEVEL.ERROR);
        }
    }, false);

    // import empty file
    source.addEventListener(serverSentEventType.emptyFile, (event) => {
        const data = JSON.parse(event.data);
        if (data) {
            let msg = $(baseEles.i18nImportEmptyFileMsg).text();
            msg = msg.replace('__param__', `<br>${data.join('<br>')}`);

            // show toast to notify user
            showToastrMsg(msg);
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
            fetch('/ap/api/setting/stop_job', {
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
        useUserSetting(null, sharedSetting, divTarget, false, true);

        setTimeout(() => {
            setTooltip($(e.currentTarget), $(baseEles.i18nPasted).text());
        }, 2000);
    });

    $('[name=pastePage]').click((e) => {
        const sharedSetting = JSON.parse(localStorage.getItem(SHARED_USER_SETTING));
        useUserSetting(null, sharedSetting, null, false, true);

        setTimeout(() => {
            setTooltip($(e.currentTarget), $(baseEles.i18nPasted).text());
            // localStorage.removeItem('srcSetting');
        }, 2000);
    });

    $('[name=copyPage]').click(function () {
        let formId = getShowFormId();
        let srcSetting = window.location.pathname;
        localStorage.setItem('srcSetting', srcSetting);
        const loadFunc = saveLoadUserInput(`#${formId}`, '', '', SHARED_USER_SETTING);
        loadFunc(false);
        setTooltip($(this), $(baseEles.i18nCopied).text());
    });

    // Search table user setting
    onSearchTableContent('searchInTopTable', 'tblUserSetting');

    // show preprocessing content
    cleansingHandling();
});

const initTargetPeriod = () => {
    removeDateTimeInList();
    addNewDatTimeRange();
    showDateTimeRangeValue();

     // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.WINDOW_LENGTH, CYCLIC_TERM.WINDOW_LENGTH_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.INTERVAL, CYCLIC_TERM.INTERVAL_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.DIV_OFFSET, CYCLIC_TERM.DIV_OFFSET_MIN_MAX);

    setTimeout(() => {
        $('input[type=text]').trigger('change');
    }, 1000);
};

const onSearchTableContent = (inputID, tbID, inputElement = null) => {

    const inputEl = inputID ? $(`#${inputID}`) : inputElement;

    initCommonSearchInput(inputEl);

    inputEl.on('input', (e) => {
        const value = stringNormalization(e.currentTarget.value);
        searchTableContent(tbID, value, false);
    });

    inputEl.on('change', (e) => {
        handleInputTextZenToHanEvent(e);
        const {value} = e.currentTarget;
        searchTableContent(tbID, value, true);
    });
};

const searchTableContent = (tbID, value, isFilter = true) => {
    const newValue = makeRegexForSearchCondition(value);
    const regex = new RegExp(newValue.toLowerCase(), 'i');
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
        if (e.value === 'default') {
            $('.for-recent-cyclicCalender').find('input').prop('disabled', true);
            $('.for-recent-cyclicCalender').hide();

        }
        if (e.value === 'recent') {
            $('.for-recent-cyclicCalender').find('input').prop('disabled', false);
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
    e.options.forEach(el => {
        tabs.push(el.value);
    });
    const currentShower = $(`#for-${e.value}`);
    currentShower.removeAttr('style');
    toggleDisableAllInputOfNoneDisplayEl(currentShower, false);
    currentShower.find('input[type=text]').trigger('change');
    tabs.forEach(tab => {
        if (tab !== e.value) {
            $(`#for-${tab}`).css({ display: 'none', visibility: 'hidden' });
            toggleDisableAllInputOfNoneDisplayEl($(`#for-${tab}`));
        }
    });

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

const getDateTimeRangeValue = (tab = null, traceTimeName = 'varTraceTime', forDivision = true) => {
    const currentTab = tab || $('select[name=compareType]').val();
    let result = '';

    if (['var', 'category', 'dataNumberTerm', 'cyclicCalender'].includes(currentTab)) {
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
        const currentTargetDiv = forDivision ? $(`#for-${currentTab}`) : $('#target-period-wrapper');
        // format by divide format
        const isLatest = currentTargetDiv.find(`[name*=${traceTimeName}]:checked`).val() === TRACE_TIME_CONST.RECENT;
        const currentDivFormat = $(`input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`).val();
        if (currentDivFormat) {
            const offset = $(`input[name=${CYCLIC_TERM.DIV_OFFSET}]`).val();
            const { from, to, div } = dividedByCalendar(result.split(DATETIME_PICKER_SEPARATOR)[0], result.split(DATETIME_PICKER_SEPARATOR)[1], currentDivFormat, isLatest, offset);
            result = `${from}${DATETIME_PICKER_SEPARATOR}${to}`;
            $('#cyclicCalenderShowDiv').text(`Div=${div}`);
        }
    } else {
        $('#cyclicCalenderShowDiv').text('');
    }
    $('#datetimeRangeShowValue').text(result);
    $(`#${currentTab}-daterange`).text(result);
    generateCalenderExample(result.split(DATETIME_PICKER_SEPARATOR)[0])
    return result;
};

const showDateTimeRangeValue = () => {
    getDateTimeRangeValue();

    $('.to-update-time-range').on('change', (e) => {
        getDateTimeRangeValue();
        compareSettingChange();
    });
};

const calDateTimeRangeForVar = (currentTab, traceTimeName = 'varTraceTime', forDivision = true) => {
    const currentTargetDiv = forDivision ? $(`#for-${currentTab}`) : $('#target-period-wrapper');
    const traceOption = currentTargetDiv.find(`[name*=${traceTimeName}]:checked`).val();
    const dateTimeRange = currentTargetDiv.find('[name=DATETIME_RANGE_PICKER]').val();
    const { startDate, startTime, endDate, endTime } = splitDateTimeRange(dateTimeRange)
    const recentTimeInterval = currentTargetDiv.find('[name=recentTimeInterval]').val() || 24;
    const timeUnit = currentTargetDiv.find('[name=timeUnit]').val() || 60;

    if (traceOption === TRACE_TIME_CONST.RECENT) {
        let timeDiffMinute, newStartDate, newEndDate, newStartTime, newEndTime;

        if (['months', 'years'].includes(timeUnit)) {
            newStartDate = moment().subtract(recentTimeInterval, timeUnit).format(DATE_FORMAT);
            newStartTime = moment().subtract(recentTimeInterval, timeUnit).format(TIME_FORMAT);
        } else {
            timeDiffMinute = Number(recentTimeInterval) * Number(timeUnit);
            newStartDate = moment().add(-timeDiffMinute, 'minute').format(DATE_FORMAT);
            newStartTime = moment().add(-timeDiffMinute, 'minute').format(TIME_FORMAT);

        }
        newEndDate = moment().format(DATE_FORMAT);
        newEndTime = moment().format(TIME_FORMAT);

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
    const datetime = currentTargetDiv.find('[name=DATETIME_PICKER]').val();
    const { date, time } = splitDateTime(datetime)

    const targetDate = traceTimeOption === TRACE_TIME_CONST.RECENT
        ? moment().format('YYYY-MM-DD') : date;
    const targetTime = traceTimeOption === TRACE_TIME_CONST.RECENT
        ? moment().format('HH:mm') : time;


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
    $.get('/ap/api/setting/get_env', { "_": $.now() }, (resp) => {
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

const showCustomContextMenu = (plotDOM, positivePointOnly=false) => {
    let plotViewData;
    plotDOM.on('plotly_click', function(data){
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
    plotDOM.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        hideContextMenu();
        if (!plotViewData) {
            return;
        }
        setTimeout(() => {
            var pts = '';
            for(var i=0; i < plotViewData.points.length; i++){
                pts = 'x = '+plotViewData.points[i].x +'\ny = '+
                    plotViewData.points[i].y.toPrecision(4) + '\n\n';
            }
            scpSelectedPoint = {
                point_index: plotViewData.points[0].pointNumber,
                proc_id_x: plotViewData.points[0].data.customdata ?
                    plotViewData.points[0].data.customdata.proc_id_x : scpCustomData.proc_id_x,
                sensor_id_x: plotViewData.points[0].data.customdata ?
                    plotViewData.points[0].data.customdata.sensor_id_x : scpCustomData.sensor_id_x,
            };
            // customdata
            const hasCycleIds = Object.keys(plotViewData.points[0].data).includes('customdata') ?
                Object.keys(plotViewData.points[0].data.customdata).includes('cycle_ids') : false;
            if (hasCycleIds) {
                scpSelectedPoint.cycle_ids = plotViewData.points[0].data.customdata.cycle_ids;
            }
            const isFromMarkers = plotViewData.points.length ? plotViewData.points[0].data.type === 'scatter' : false;
            if (isFromMarkers) {
                rightClickHandler(plotViewData.event, '#contextMenuTimeSeries');
            }
        }, 500);
        e.stopPropagation();
    });
    // hide context menu
    plotDOM.removeEventListener('mousemove', () => {});
    plotDOM.addEventListener('mousemove', function(e) {
        hideContextMenu();
        removeHoverInfo();
    });
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
        const cycleId = scpSelectedPoint.cycle_ids ? scpSelectedPoint.cycle_ids[scpSelectedPoint.point_index] :
            currentTraceData.cycle_ids[scpSelectedPoint.point_index];
        const sensorDat = currentTraceData.array_plotdata.filter(i =>
            i.end_col_id == scpSelectedPoint.sensor_id_x &&
            i.end_proc_id == scpSelectedPoint.proc_id_x
        );
        if ('array_x' in sensorDat[0]) {
            xTime = sensorDat[0].array_x[scpSelectedPoint.point_index];
        } else {
            xTime = currentTraceData.datetime[scpSelectedPoint.point_index];
        }
        const timeKeys = [CONST.STARTDATE, CONST.STARTTIME, CONST.ENDDATE, CONST.ENDTIME];
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
    return (false);
};

const initCommonSearchInput = (inputElement, className = '') => {
    // common-search-input
    if (inputElement.closest('.deleteicon').length) return;

    inputElement.wrap(`<span class="deleteicon ${className}"></span>`).after($('<span class="remove-search">x</span>'));

    $('.remove-search').off('click');
    $('.remove-search').on('click', function () {
        $(this).prev('input').val('').trigger('input').focus();
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
        traceOption = oldParentEl.find('input[name*=raceTime]:is(:checked)').val();
        autoUpdate = oldParentEl.find('input[name=autoUpdateInterval]').is(':checked');

        // assign new value to current division
        const division = $(e.currentTarget).val();
        const isCyclicTerm = division.toLowerCase().includes('cyclic');
        const isDirectTerm = division.toLowerCase().includes('direct');
        const parentEl = $(`#for-${division}`);

        if (isCyclicTerm) {
            if (traceOption !== TRACE_TIME_CONST.RECENT) {
                traceOption = TRACE_TIME_CONST.FROM;
            }

            const startDate = dateRange.split(DATETIME_PICKER_SEPARATOR)[0];
            parentEl.find('input[name=DATETIME_PICKER]').val(startDate).trigger('change');
        } else if (isDirectTerm) {
            traceOption = TRACE_TIME_CONST.DEFAULT;
            $(parentEl.find('input[name=DATETIME_RANGE_PICKER]')[0]).val(dateRange).trigger('change');
        } else {
            if (traceOption !== TRACE_TIME_CONST.RECENT) {
                traceOption = TRACE_TIME_CONST.DEFAULT;
                parentEl.find('input[name=DATETIME_RANGE_PICKER]').val(dateRange).trigger('change');
            }
        }

        parentEl.find(`input[name*=raceTime][value=${traceOption}]`).prop('checked', true).trigger('change');
        parentEl.find('input[name=autoUpdateInterval]').prop('checked', autoUpdate);

        oldDivision = division;
    });
};

const updateCleansing = (inputEle) => {
    const selectedLabel = $('#cleansing-selected');
    const cleansingValues = uniq([...$('#cleansing-content').find('input[type=checkbox]:is(:checked)')].map(el => $(el).attr('show-value')));
    const dupValue = $('#cleansing-content').find('select option:selected').map((i, el) => $(el).attr('show-value'));
    if (dupValue) {
        cleansingValues.push(...dupValue);
    }
    const selectedValues = cleansingValues.length > 0 ? `[${cleansingValues.join('')}]` : '';
    selectedLabel.text(selectedValues);
    $('input[name=cleansing]').val(selectedValues);
};

const cleansingHandling = () => {
    $('.custom-selection').off('click').on('click', (e) => {
        const contentDOM = $(e.target).closest('.custom-selection-section').find('.custom-selection-content');
        const contentIsShowed = contentDOM.is(':visible');
        if (contentIsShowed) {
            contentDOM.hide();
        } else {
            contentDOM.show();
        }
    });
    window.addEventListener('click', function (e) {
        const orderingContentDOM = document.getElementById('ordering-content');
        const orderingSelectiontDOM = document.getElementById('ordering-selection');
        const inOrderingContent = orderingContentDOM ? orderingContentDOM.contains(e.target) : false;
        const inOrderingSelection = orderingSelectiontDOM ? orderingSelectiontDOM.contains(e.target) : false;
        if (!inOrderingContent && !inOrderingSelection) {
            $('#ordering-content').hide();
        }

        if (!e.target.closest('.dn-custom-select')) {
            $('.dn-custom-select--select--list').addClass('select-hide')
        }

        if (!e.target.closest('.custom-selection-content') && !e.target.closest('.custom-selection')) {
            $('.custom-selection-content').hide();
        }
    });
};

const showGraphCallApi = (url, formData, timeOut, callback, additionalOption = {}) => {
    if (!requestStartedAt) {
        requestStartedAt = performance.now();
    }

    if (exportMode()) {
        // set isExportMode to fromData
        formData.set('isExportMode', 1);
    } else {
        formData.delete('isExportMode')
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

    $.ajax({
        ...option,
        beforeSend: (jqXHR) => {
            formData = handleBeforeSendRequestToShowGraph(jqXHR, formData);
        },
        success: async (res) => {
            try {
                const responsedAt = performance.now();
                loadingShow(true);

                await removeAbortButton(res);

                await callback(res);

                isGraphShown = true;

                // hide loading inside ajax
                setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));

                // move invalid filter
                setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);

                // export mode
                handleZipExport(res);

                const finishedAt = performance.now();
                // show processing time at bottom
                drawProcessingTime(responsedAt, finishedAt, res.backend_time, res.actual_record_number, res.unique_serial);
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
                    const resJson = JSON.parse(res.responseJSON) || {};
                    showToastr(resJson.json_errors);
                    return;
                }
            }

            errorHandling(res);
        },
    }).then(() => {
        afterRequestAction();
    });
};


const generateCalenderExample = (targetDateTimeStr = moment().format(DATE_TIME_FMT)) => {
    const calenderCyclicItems = $('.cyclic-calender-option-item');
    for (let i = 0; i < calenderCyclicItems.length; i += 1) {
       const calenderCyclicItem = $(calenderCyclicItems[i]);
       let format = calenderCyclicItem.find(`input[name=${CYCLIC_TERM.DIV_CALENDER}]`).val();
       if (!format) continue;
       const [fmt, hasW] = transformFormat(format);
       let example = moment(targetDateTimeStr).format(fmt);
       if (hasW) {
           example = 'W'+example;
       }
       calenderCyclicItem.find(`input[name=${CYCLIC_TERM.DIV_CALENDER}]`).attr('data-example', example);
       calenderCyclicItem.find('.cyclic-calender-option-example').text(example);
    }
    changeFormatAndExample($(`input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`));
};

const changeFormatAndExample = (formatEl) => {
    const currentTarget = $(formatEl);
    if (!currentTarget.prop('checked')) return;
    const formatValue = currentTarget.val();
    const example = currentTarget.attr('data-example');
    $('#cyclicCalender').text(`${formatValue} ${example}`);
};