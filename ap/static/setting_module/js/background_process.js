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
    DEL_PROCESS: $('#i18nDEL_PROCESS').text(),
    CSV_IMPORT: $('#i18nCSV_IMPORT').text(),
    FACTORY_IMPORT: $('#i18nFACTORY_IMPORT').text(),
    GEN_GLOBAL: $('#i18nGEN_GLOBAL').text(),
    CLEAN_DATA: $('#i18nCLEAN_DATA').text(),
    FACTORY_PAST_IMPORT: $('#i18nFACTORY_PAST_IMPORT').text(),
};

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
        title: i18n.statusDone,
        class: 'check green',
        'class-progress-bar': 'bg-success',
        text: 'Done',
        db_text: 'DONE',
    },
    FAILED: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
        text: 'Error',
        db_text: 'ERROR',
    },
    KILLED: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
        text: 'Killed',
        db_text: 'KILLED',
    },
    PROCESSING: {
        title: i18n.statusImporting,
        class: 'spinner fa-spin',
        'class-progress-bar': 'progress-bar-animated',
        text: 'Processing',
        db_text: 'PROCESSING',
    },
    PENDING: {
        title: i18n.statusPending,
        class: 'spinner fa-spin',
        'class-progress-bar': 'progress-bar-animated',
        text: 'Pending',
        db_text: 'PENDING',
    },
    FATAL: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
        text: 'Fatal',
        db_text: 'FATAL',
    },
};

const NON_FAILED_JOB_STATUS = [
    JOB_STATUS.PROCESSING.db_text,
    JOB_STATUS.DONE.db_text,
    JOB_STATUS.PENDING.db_text,
    JOB_STATUS.KILLED.db_text,
];

const convertJobName = (jobName) => {
    const defaultJobNames = [
        'DEL_PROCESS',
        'CSV_IMPORT',
        'FACTORY_IMPORT',
        'GEN_GLOBAL',
        'CLEAN_DATA',
        'FACTORY_PAST_IMPORT',
    ];
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
const updateBackgroundJobs = (json, isFirstTime = false) => {
    const tableBody = $('#jobDataTable table tbody');
    const dicTableRows = genDicTrJobs();
    let rows = json;
    if (!isFirstTime) {
        rows = Object.values(json);
    }

    const pageOptions = getPageOptionsFromGUI();
    const ignoreJobs = [];
    const ignoreStatus = [];
    if (!pageOptions.showProcLinkJob) {
        ignoreJobs.push('GEN_GLOBAL');
    }
    if (!pageOptions.showPastImportJob) {
        ignoreJobs.push('FACTORY_PAST_IMPORT');
    }
    if (pageOptions.errorPage) {
        ignoreStatus.push(...NON_FAILED_JOB_STATUS);
    }
    rows.forEach((row) => {
        const statusClass =
            JOB_STATUS[row.status].class || JOB_STATUS.FAILED.class;
        const statusTooltip =
            JOB_STATUS[row.status].title || JOB_STATUS.FAILED.title;

        const statusProgressBar =
            JOB_STATUS[row.status]['class-progress-bar'] ||
            JOB_STATUS.FAILED['class-progress-bar'];
        // const rowHtml = tableBody.find(`#job-${row.job_id}`);
        let rowHtml = dicTableRows[row.job_id];
        const updatedStatus = JOB_STATUS[row.status].text;
        const progress = `
        <div class="progress">
            <div class="progress-bar progress-bar-striped ${statusProgressBar}"
                role="progressbar" style="width: ${row.done_percent}%" aria-valuenow="${row.done_percent}"
                aria-valuemin="0" aria-valuemax="100">${row.done_percent}%</div>
        </div>`;
        let jobDetailHTML = `${row.detail}`;
        if (row.status === 'FAILED') {
            jobDetailHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; overflow: hidden;">
                <span style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${row.error_msg || ''}</span>
                <button id="" class="btn btn-warning btn-right" onclick="showJobErrorDetail(${row.job_id})">
                <i class="fas fa-info-circle"></i>
                </button>
            </div>`;
        }
        if (rowHtml) {
            rowHtml = $(rowHtml);
            if (isFirstTime) {
                rowHtml
                    .find('.job-name')
                    .text(convertJobName(row.job_name) || ' ');
                rowHtml
                    .find('.job-start-time')
                    .text(moment(row.start_tm).format(DATE_FORMAT_WITHOUT_TZ));
            }
            rowHtml.find('.job-duration').text(row.duration);
            rowHtml.find('.job-progress').html(progress);
            if (
                rowHtml.find('.job-status').attr('data-status') !== row.status
            ) {
                rowHtml.find('.job-status').html(updatedStatus);
            }
            rowHtml.find('.job-detail').html(jobDetailHTML);
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
                <td class="job-name job-name-col">${convertJobName(row.job_name) || ' '}</td>
                <td class="job-db-name db-name-col">${row.db_master_name}</td>
                <td class="job-process-name proc-name-col">${row.process_master_name}</td>
                <td class="job-start-time duration-col">${moment(row.start_tm).format(DATE_FORMAT_WITHOUT_TZ)}</td>
                <td class="job-duration duration-col">${row.duration}</td>
                <td class="job-progress job-progress-col">${progress}</td>
                <td class="job-status job-status-col" data-status="${row.status}">${updatedStatus}</td>
                <td class="job-detail detail-col">${jobDetailHTML}</td>
                </tr>`);
            }
        }
    });
    $('.loading').hide();
};

function copyToClipboard() {
    const table = $('#jobErrorDetailTable');
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

const getJobDetail = async (jobId) => {
    if (jobId === null || jobId === undefined) return;

    const url = new URL(
        `/ap/api/setting/job_detail/${jobId}`,
        window.location.href,
    ).href;
    const json = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then((response) => response.clone().json())
        .catch(() => {
            //
        });

    return json;
};

const showErrorDetailToModal = (json) => {
    const tableBody = $('#jobErrorDetailTable tbody');
    tableBody.empty();
    Object.values(json).forEach((jobDetail) => {
        const rowHTML = `
        <tr>
            <td>${jobDetail.id}</td>
            <td><pre rows="4">${JSON.stringify(jobDetail, null, '    ')}</pre></td>
        </tr>
        `;

        tableBody.append(rowHTML);
    });
};

const showJobErrorDetail = async (jobId) => {
    // call ajax to get error detail here
    const json = await getJobDetail(jobId);

    // clear + append error detail to table
    showErrorDetailToModal(json);

    // show modal
    $('#modalJobDetail').modal('show');
};

const updateFilterJobs = () => {
    const showPastImportJob = $('#factoryPassImport').is(':checked');
    const showProcLinkJob = $('#genGlobalID').is(':checked');
    const dicFilterJobs = {
        factoryPassImport: showPastImportJob,
        genGlobalID: showProcLinkJob,
    };
    localStorage.setItem('filterBackgroundJobs', JSON.stringify(dicFilterJobs));
};

// const filterJobFromLocal = (jobs) => {
//     const filterTypeConst = ['GEN_GLOBAL', 'FACTORY_PAST_IMPORT'];
//     const defaultFilter = ['GEN_GLOBAL'];
//     const showJobs = {};
//     // load filter background jobs
//     const userFilterJSON = localStorage.getItem('filterBackgroundJobs');
//     const userFilterJobs = userFilterJSON ? JSON.parse(userFilterJSON) : [];
//
//     let filterJobs;
//     if (userFilterJSON == null) {
//         filterJobs = defaultFilter;
//         localStorage.setItem('filterBackgroundJobs', JSON.stringify(defaultFilter));
//     } else {
//         filterJobs = userFilterJobs;
//     }
//     filterJobs.forEach((e) => {
//         $(`input[value="${e}"]`).prop('checked', true);
//     });
//     Object.values(jobs).forEach((jobDetail, k) => {
//         if (filterTypeConst.includes(jobDetail.job_type) && filterJobs.includes(jobDetail.job_type)) {
//             showJobs[k] = jobDetail;
//         } else if (!filterTypeConst.includes(jobDetail.job_type)) {
//             // apply for general jobs
//             showJobs[k] = jobDetail;
//         }
//     });
//     // get jobs from db
//     updateBackgroundJobs(showJobs);
// };

const getPageOptionsFromGUI = () => {
    let showPastImportJob = $('#factoryPassImport').is(':checked');
    let showProcLinkJob = $('#genGlobalID').is(':checked');
    const jobDataTbl = $(ids.jobTable);
    const pageOptions = jobDataTbl.bootstrapTable('getOptions');
    const errorPage = isFailedJobPage();
    if (isFailedJobPage()) {
        showPastImportJob = true;
        showProcLinkJob = true;
    }
    const jobPageOptions = {
        pageSize: pageOptions.pageSize,
        pageNumber: pageOptions.pageNumber,
        showProcLinkJob: showProcLinkJob,
        showPastImportJob: showPastImportJob,
        errorPage: errorPage,
    };
    return jobPageOptions;
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
    updateFilterJobs();
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
    $.extend(
        $.fn.bootstrapTable.defaults,
        $.fn.bootstrapTable.locales['en-US'],
    );
})(jQuery);

$(() => {
    // init job table with bootstrap
    // load filter options
    loadFilterOptions();

    const jobTable = $(ids.jobTable);
    const pageOptions = getPageOptionsFromLocalStorage();
    jobTable.bootstrapTable({
        pagination: true,
        paginationVAlign: 'both',
        pageSize: pageOptions ? pageOptions.pageSize : 50,
        locale: $('option:selected', $(ids.selectLanguage)).attr(
            'bootstrap-locale',
        ),
        errorPage: isFailedJobPage(),
        // formatShowingRows() {
        //     return sprintf('');
        // },
    });

    $('#btnCopyToClipboard').on('click', () => copyToClipboard());
    $('#factoryPassImport').on('change', () => loadPage());
    $('#genGlobalID').on('change', () => loadPage());

    // Search content of table
    onSearchTableContent('searchJobList', 'jobTable');
    sortableTable('jobTable', [0, 1, 2, 3, 4, 5, 6, 7, 8], null, false, false);

    // show load settings menu
    handleLoadSettingBtns();
    reloadPageAfterInterval();
});

const loadFilterOptions = () => {
    const filterOptions = getFilterOptions();
    const filterItems = $('input[name=filterJobs]');
    filterItems.each((_, ele) => {
        const val = filterOptions[ele.id];
        $(ele).prop('checked', val);
    });
};
const getFilterOptions = () => {
    // load filter background jobs
    const filterJSON = localStorage.getItem('filterBackgroundJobs');
    const filterJobs = filterJSON ? JSON.parse(filterJSON) : [];
    return filterJobs;
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

    isFirstTimeRunPaging = false;
    pagingParams = params;
    if (pageOptions) {
        params.data.limit = pageOptions.pageSize;
        // params.data.offset = (pageOptions.pageNumber - 1) * params.data.limit;
        params.data.show_proc_link_job = pageOptions.showProcLinkJob;
        params.data.show_past_import_job = pageOptions.showPastImportJob;
        if (isFailedJobPage()) {
            params.data.error_page = pageOptions.errorPage;
        }
    }
    const json = fetch(url + '?' + $.param(params.data), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
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
