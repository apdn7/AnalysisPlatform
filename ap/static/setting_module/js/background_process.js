let isFirstTimeRunPaging = true;
let pagingParams = null;
const RELOAD_INTERVAL = 3 * 60 * 1000; // reload job page after 3 minutes
const i18n = {
    jobId: $('#i18nJobId').text(),
    database: $('#i18nDatabase').text(),
    started: $('#i18nStarted').text(),
    duration: $('#i18nDuration').text(),
    progress: $('#i18nProgress').text(),
    status: $('#i18nStatus').text(),
    statusDone: $('#i18nStatusDone').text(),
    statusImporting: $('#i18nStatusImporting').text(),
    statusFailed: $('#i18nStatusFailed').text(),
    statusPending: $('#i18nStatusPending').text(),
    process: $('#i18nProcess').text(),
    detail: $('#i18nDetail').text(),
    failedJobPageTitle: $('#i18nFailedJobList').text(),
    CSV_IMPORT: $('#i18nCSV_IMPORT').text(),
    FACTORY_IMPORT: $('#i18nFACTORY_IMPORT').text(),
    GEN_GLOBAL: $('#i18nGEN_GLOBAL').text(),
    CLEAN_DATA: $('#i18nCLEAN_DATA').text(),
    FACTORY_PAST_IMPORT: $('#i18nFACTORY_PAST_IMPORT').text(),
};

let jobDetailInformation = {};

const ids = {
    jobTable: '#jobTable',
    selectLanguage: '#select-language',
};

const pageTitleElement = $('.page-title h2');

const isFailedJobPage = () => {
    return pageTitleElement.text() === i18n.failedJobPageTitle;
};

const JOB_STATUS = {
    DONE: {
        'title': i18n.statusDone,
        'class': 'check green',
        'class-progress-bar': 'bg-success',
        'text': 'Done',
        'db_text': 'DONE',
    },
    FAILED: {
        'title': i18n.statusFailed,
        'class': 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
        'text': 'Error',
        'db_text': 'ERROR',
    },
    KILLED: {
        'title': i18n.statusFailed,
        'class': 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
        'text': 'Killed',
        'db_text': 'KILLED',
    },
    PROCESSING: {
        'title': i18n.statusImporting,
        'class': 'spinner fa-spin',
        'class-progress-bar': 'progress-bar-animated',
        'text': 'Processing',
        'db_text': 'PROCESSING',
    },
    PENDING: {
        'title': i18n.statusPending,
        'class': 'spinner fa-spin',
        'class-progress-bar': 'progress-bar-animated',
        'text': 'Pending',
        'db_text': 'PENDING',
    },
    FATAL: {
        'title': i18n.statusFailed,
        'class': 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
        'text': 'Fatal',
        'db_text': 'FATAL',
    },
};

const NON_FAILED_JOB_STATUS = [
    JOB_STATUS.PROCESSING.db_text,
    JOB_STATUS.DONE.db_text,
    JOB_STATUS.PENDING.db_text,
    JOB_STATUS.KILLED.db_text,
];

const convertJobName = (jobName) => {
    const defaultJobNames = ['CSV_IMPORT', 'FACTORY_IMPORT', 'GEN_GLOBAL', 'CLEAN_DATA', 'FACTORY_PAST_IMPORT'];
    if (defaultJobNames.includes(jobName)) {
        return i18n[jobName];
    }
    return jobName;
};

const genDicTrJobs = () => {
    const dicTableRows = {};
    const rows = $('#jobDataTable table tbody tr');
    for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const jobId = $(tr).find('td.job-id').text();
        dicTableRows[jobId] = tr;
    }
    return dicTableRows;
};
let isExtended = false;
const toggleJobTableWidth = (event) => {
    if (event) {
        event.stopPropagation();
    }
    isExtended = !isExtended;
    const btn = $('#btn-extend-toggle-job');
    const detailCols = $('.detail-col, .job-detail');
    const headerDetailCol = $('#jobTable thead .detail-col');
    if (isExtended) {
        btn.html('&#x27FD;');
        detailCols.addClass('hidden');
        headerDetailCol.addClass('hidden');
    } else {
        btn.html('&#x27FE;');
        detailCols.removeClass('hidden');
        headerDetailCol.removeClass('hidden');
    }
};

const updateBackgroundJobs = (json, isFirstTime = false) => {
    const tableBody = $('#jobDataTable table tbody');
    const dicTableRows = genDicTrJobs();
    let rows = json;
    if (!isFirstTime) {
        rows = Object.values(json);
    } else {
        // reset job info when 1st load
        jobDetailInformation = {};
    }
    if (pagingParams && (pagingParams.data?.statuses || pagingParams.data?.job_types)) {
        if (pagingParams.data.statuses) {
            const statuses = pagingParams.data.statuses.split(',');
            rows = rows.filter((row) => statuses.includes(row.job_status_category));
        }
        if (pagingParams.data.job_types) {
            const jobTypes = pagingParams.data.job_types.split(',');
            rows = rows.filter((row) => jobTypes.includes(row.job_type_category));
        }
    }

    const pageOptions = getPageOptionsFromGUI();
    const ignoreJobs = [];
    const ignoreStatus = [];
    if (!pageOptions.showPastImportJob) {
        ignoreJobs.push('FACTORY_PAST_IMPORT');
    }
    if (pageOptions.errorPage) {
        ignoreStatus.push(...NON_FAILED_JOB_STATUS);
    }
    rows.forEach((row) => {
        const statusProgressBar =
            JOB_STATUS[row.status]['class-progress-bar'] || JOB_STATUS.FAILED['class-progress-bar'];
        // const rowHtml = tableBody.find(`#job-${row.job_id}`);
        let rowHtml = dicTableRows[row.job_id];
        const updatedStatus = JOB_STATUS[row.status].text;
        const progress = `
        <div class="progress">
            <div class="progress-bar progress-bar-striped ${statusProgressBar}"
                role="progressbar" style="width: ${row.done_percent}%" aria-valuenow="${row.done_percent}"
                aria-valuemin="0" aria-valuemax="100">${row.done_percent}%</div>
        </div>`;
        let jobDetailHTML = '';
        if (row.summary && row.details) {
            jobDetailInformation[row.job_id] = {
                ...jobDetailInformation[row.job_id],
                details: row.details && row.details.length ? JSON.stringify(row.details, null, 2) : '',
                summary: row.summary || '',
            };
            jobDetailHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; overflow: hidden;">
                <span style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${row.summary || ''}</span>
            </div>`;
        }
        if (row.status === 'FAILED') {
            const errorMsg = row.error_info && row.error_info.length ? JSON.stringify(row.error_info, null, 2) : '';
            jobDetailInformation[row.job_id] = {
                ...jobDetailInformation[row.job_id],
                errorInfo: errorMsg,
            };
            jobDetailHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; overflow: hidden;">
                <span style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${errorMsg || ''}</span>
            </div>`;
        }
        if (rowHtml) {
            rowHtml = $(rowHtml);
            if (isFirstTime) {
                rowHtml.find('.job-name').html(`<span>${convertJobName(row.job_name) || ' '}</span>`);
                rowHtml.find('.job-start-time').text(moment(row.start_tm).format(DATE_FORMAT_WITHOUT_TZ));
            }
            rowHtml.find('.job-duration').text(row.duration);
            rowHtml.find('.job-progress').html(progress);
            if (rowHtml.find('.job-status').attr('data-status') !== row.status) {
                rowHtml.find('.job-status').html(updatedStatus);
            }
            rowHtml.find('.job-detail').html(jobDetailHTML);
            if (isExtended) {
                rowHtml.find('.job-detail').addClass('hidden');
            } else {
                rowHtml.find('.job-detail').removeClass('hidden');
            }
            rowHtml.find('.job-status').attr('data-status', row.status);
        } else {
            if (
                pageOptions &&
                pageOptions.pageNumber === 1 &&
                !ignoreJobs.includes(row.job_name) &&
                !ignoreStatus.includes(row.status)
            ) {
                tableBody.prepend(`
                <tr id="job-${row.job_id}">
                <td class="job-id job-id-col">${row.job_id}</td>
                <td class="job-name job-name-col"><span title="${convertJobName(row.job_name) || ' '}">${convertJobName(row.job_name) || ' '}</span></td>
                <td class="job-db-name db-name-col"><span>${row.db_master_name || ''}</span></td>
                <td class="job-process-name proc-name-col"><span>${row.process_master_name || ''}</span></td>
                <td class="job-start-time duration-col">${moment(row.start_tm).format(DATE_FORMAT_WITHOUT_TZ)}</td>
                <td class="job-duration duration-col">${row.duration}</td>
                <td class="job-progress job-progress-col">${progress}</td>
                <td class="job-status job-status-col" data-status="${row.status}">${updatedStatus}</td>
                <td class="job-detail detail-col ${isExtended ? 'hidden' : ''}">${jobDetailHTML}</td>
                </tr>`);
            }
        }
    });
    $('.loading').hide();
};

function copyToClipboard() {
    const table = $('#jobDetailTable');
    let tobeCopiedText = '{';
    table.find('tr').each(function fscan() {
        const $tds = $(this).find('td');
        const key = $tds.eq(0).text();
        const value = $tds.eq(1).text();
        if (value) {
            tobeCopiedText += `"job-detail-${key}": ${value},\n`;
        }
    });
    tobeCopiedText += '}';
    const textField = document.createElement('textarea');
    textField.innerText = tobeCopiedText;
    document.body.appendChild(textField);
    textField.select();
    textField.focus();
    document.execCommand('copy');
    textField.remove();
}

const getPageOptionsFromGUI = () => {
    let showPastImportJob = false;
    const jobDataTbl = $(ids.jobTable);
    const pageOptions = jobDataTbl.bootstrapTable('getOptions');
    const errorPage = isFailedJobPage();
    if (isFailedJobPage()) {
        showPastImportJob = true;
    }
    const jobPageOptions = {
        pageSize: pageOptions.pageSize,
        pageNumber: pageOptions.pageNumber,
        showPastImportJob: showPastImportJob,
        errorPage: errorPage,
    };
    return jobPageOptions;
};

const getPageFilterOptions = () => {
    const filterOptions = {
        job_types: [],
        statuses: [],
    };
    const jobFilters = document.querySelectorAll('input[name="jobFilter"]:checked');
    const statusFilters = document.querySelectorAll('input[name="statusFilter"]:checked');
    jobFilters.forEach((cb) => filterOptions.job_types.push(cb.value));
    statusFilters.forEach((cb) => filterOptions.statuses.push(cb.value));
    return filterOptions;
};

const setJobPageConfig = (jobPageOptions) => {
    // save jobPage option to keep settings after reload
    if (jobPageOptions) {
        localStorage.setItem('jobPageOptions', JSON.stringify(jobPageOptions));
    }
};

const isFirstPage = () => {
    const jobDataTbl = $(ids.jobTable);
    const pageOptions = jobDataTbl.bootstrapTable('getOptions');
    return pageOptions.pageNumber === 1;
};

const loadPage = () => {
    // window.location.reload()
    if (pagingParams) {
        ajaxRequest(pagingParams);
    }
};
const reloadPageAfterInterval = () => {
    setInterval(function () {
        if (isFirstPage() && pagingParams) {
            ajaxRequest(pagingParams);
        }
    }, RELOAD_INTERVAL);
};

// custom formatShowingRows
(function ($) {
    // origin title: 全${totalRows}件から、${pageFrom}から${pageTo}件目まで表示しています
    $.fn.bootstrapTable.locales['ja-JP'] = {
        ...$.fn.bootstrapTable.locales['ja-JP'],
        ...{
            formatShowingRows(pageFrom, pageTo, totalRows) {
                return `全${totalRows}件のうち、${pageFrom}から${pageTo}件まで表示しています。`;
            },
        },
    };
    $.fn.bootstrapTable.locales['en-US'] = {
        ...$.fn.bootstrapTable.locales['en-US'],
        ...{
            formatShowingRows(pageFrom, pageTo, totalRows) {
                return `Showing ${pageFrom} to ${pageTo} of all ${totalRows} rows.`;
            },
        },
    };
    $.extend($.fn.bootstrapTable.defaults, $.fn.bootstrapTable.locales['en-US']);
})(jQuery);

$(() => {
    // init job table with bootstrap
    // load filter options

    const jobTable = $(ids.jobTable);
    jobTable.bootstrapTable({
        pagination: true,
        paginationVAlign: 'both',
        pageSize: 20, // set default page size to 20
        pageList: [10, 20, 50, 100],
        locale: $('option:selected', $(ids.selectLanguage)).attr('bootstrap-locale'),
        errorPage: isFailedJobPage(),
        undefinedText: '', // for null or undefined value, replace to EMPTY_STRING
        // formatShowingRows() {
        //     return sprintf('');
        // },
        columns: [
            { field: 'job_id' }, // Do not remove the column definitions here to ensure the table renders properly.
            { field: 'job_name', formatter: jobFormatter },
            { field: 'db_master_name', formatter: jobFormatter },
            { field: 'process_master_name', formatter: jobFormatter },
            { field: 'start_tm' },
            { field: 'duration' },
            { field: 'progress' },
            { field: 'status' },
            { field: 'detail' },
        ],
    });

    $('#btnCopyToClipboard').on('click', () => copyToClipboard());

    // Setup filter event listeners
    setUpFilterEvents();

    // Search content of table
    onSearchTableContent('searchJobList', 'jobTable');
    sortableTable('jobTable', [0, 1, 2, 3, 4, 5, 6, 7, 8], null, false, false);
    const jobTableEl = $(ids.jobTable);
    jobTableEl.find('thead input.filterCol').each((_, input) => {
        initCommonSearchInput($(input), 'w-100');
    });

    // show load settings menu
    handleLoadSettingBtns();
    reloadPageAfterInterval();

    // bind search event when click td in job table
    bindSearchByClickJobInfo();

    bindJobInfoHoverEvent();

    handleCopyJobInfo();
});

const handleCopyJobInfo = () => {
    const clipboard = new ClipboardJS('#btnCopyAllJobInfo', {
        text: () => {
            const summary = $('#jobSummaryContent').text();
            const detail = $('#jobDetailContent').text();
            if (!summary && !detail) return '';
            return `Summary:\n${summary}\n\nDetail:\n${detail}`;
        },
    });

    clipboard.on('success', (e) => {
        setTooltip(e.trigger, 'Copied!');
    });

    clipboard.on('error', (e) => {
        setTooltip(e.trigger, 'Failed!');
    });
};

const clearSidePanelJobDetail = () => {
    $('#jobSummaryContent').empty();
    $('#jobDetailContent').empty();
};

const updateSidePanelJobDetail = (summary, details) => {
    const summaryContent = $('#jobSummaryContent');
    const detailContent = $('#jobDetailContent');
    summaryContent.html(summary);
    detailContent.html(`<pre class="job-side-details">${details}</pre>`);
};

const showJobDetailInfo = (jobId, isFailed) => {
    const detailInfo = jobDetailInformation[jobId]?.details ?? '';
    const summary = jobDetailInformation[jobId]?.summary ?? '';
    if (isFailed) {
        const error = jobDetailInformation[jobId]?.errorInfo ?? '';
        updateSidePanelJobDetail(`<div>${summary}</div>`, error);
    } else {
        updateSidePanelJobDetail(`<div>${summary}</div>`, detailInfo);
    }
};

const displayJobDetail = (jobId, isFailed) => {
    if (jobDetailInformation[jobId]) {
        showJobDetailInfo(jobId, isFailed);
    } else {
        clearSidePanelJobDetail();
    }
};

const bindJobInfoHoverEvent = () => {
    $(document).on('mouseenter', '#backgroundJobsTbl tr', async function () {
        const jobId = $(this).find('td.job-id').text();
        if (!jobId) return;

        $('#backgroundJobsTbl tr').removeClass('selected-row');
        $(this).addClass('selected-row');

        const isFailed = $(this).find('.job-status').attr('data-status') === 'FAILED';
        displayJobDetail(jobId, isFailed);
    });
};

const getPageOptionsFromLocalStorage = () => {
    let pageOptions = localStorage.getItem('jobPageOptions');
    if (pageOptions === 'undefined') {
        return null;
    }

    if (pageOptions) {
        pageOptions = JSON.parse(pageOptions);
    }

    return pageOptions;
};

function ajaxRequest(params) {
    const url = '/ap/api/setting/get_jobs';
    let pageOptions;
    if (isFirstTimeRunPaging) {
        pageOptions = getPageOptionsFromLocalStorage();
    } else {
        pageOptions = getPageOptionsFromGUI();
    }

    const pageFilterOptions = getPageFilterOptions();

    Object.keys(pageFilterOptions).forEach((key) => {
        if (pageFilterOptions[key].length) {
            params.data[key] = pageFilterOptions[key].join(',');
        } else {
            delete params.data[key];
        }
    });

    isFirstTimeRunPaging = false;
    pagingParams = params;
    if (pageOptions) {
        params.data.limit = pageOptions.pageSize;
        // params.data.offset = (pageOptions.pageNumber - 1) * params.data.limit;
        params.data.show_past_import_job = pageOptions.showPastImportJob;
        if (isFailedJobPage()) {
            params.data.error_page = pageOptions.errorPage;
        }
    }
    const json = fetch(url + '?' + $.param(params.data), {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then((response) => response.json())
        .then((res) => {
            params.success(res);
            updateBackgroundJobs(res.rows, true);
            $('.loading').hide();

            // save latest options
            pageOptions = getPageOptionsFromGUI();
            setJobPageConfig(pageOptions);
        });
    return json;
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

const setUpFilterEvents = () => {
    // Event listeners for job filter checkboxes
    document.querySelectorAll('input[name="jobFilter"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            debounce(loadPage(), 300);
        });
    });

    // Event listeners for status filter checkboxes
    document.querySelectorAll('input[name="statusFilter"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            debounce(loadPage(), 300);
        });
    });
};

// Format column content for Bootstrap Table
const jobFormatter = (value) => {
    return `<span>${value || ''}</span>`;
};

const bindSearchByClickJobInfo = () => {
    // when click on table td, send this content into filter field
    $('#jobTable')
        .off('click')
        .on('click', 'td>span', function () {
            const value = $(this).text();
            const td = $(this).closest('td');
            const columnIndex = td.index();

            // find filter inputs
            const $filter = $('#filters th').eq(columnIndex);
            $filter.find('input').val(value).change();
        });
};
