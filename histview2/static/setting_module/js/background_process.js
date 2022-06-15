/* eslint-disable no-cond-assign */
/* eslint-disable func-names */
/* eslint-disable no-extend-native */
/* eslint-disable no-undef */
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

const JOB_STATUS = {
    DONE: {
        title: i18n.statusDone,
        class: 'check green',
        'class-progress-bar': 'bg-success',
    },
    FAILED: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
    },
    KILLED: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
    },
    PROCESSING: {
        title: i18n.statusImporting,
        class: 'spinner fa-spin',
        'class-progress-bar': 'progress-bar-animated',
    },
    PENDING: {
        title: i18n.statusPending,
        class: 'spinner fa-spin',
        'class-progress-bar': 'progress-bar-animated',
    },
    FATAL: {
        title: i18n.statusFailed,
        class: 'exclamation-triangle yellow',
        'class-progress-bar': 'bg-warning',
    },
};
const convertJobName = (jobName) => {
    const defaultJobNames = [
        'DEL_PROCESS',
        'CSV_IMPORT',
        'FACTORY_IMPORT',
        'GEN_GLOBAL',
        'CLEAN_DATA',
        'FACTORY_PAST_IMPORT'];
    if (defaultJobNames.includes(jobName)) {
        return i18n[jobName];
    }
    return jobName;
};
const updateBackgroundJobs = (json) => {
    const tableBody = $('#jobDataTable table tbody');
    Object.values(json).forEach((row) => {
        const statusClass = JOB_STATUS[row.status].class || JOB_STATUS.FAILED.class;
        const statusTooltip = JOB_STATUS[row.status].title || JOB_STATUS.FAILED.title;
        // eslint-disable-next-line max-len
        const statusProgressBar = JOB_STATUS[row.status]['class-progress-bar'] || JOB_STATUS.FAILED['class-progress-bar'];
        const rowHtml = tableBody.find(`#job-${row.job_id}`);
        const updatedStatus = `<div class="align-middle text-center" data-st="${statusClass}">
            <div class="" data-toggle="tooltip" data-placement="top" title="${statusTooltip}">
                <i class="fas fa-${statusClass} status-i"></i>
            </div>
        </div>`;
        const progress = `
        <div class="progress">
            <div class="progress-bar progress-bar-striped ${statusProgressBar}"
                role="progressbar" style="width: ${row.done_percent}%" aria-valuenow="${row.done_percent}"
                aria-valuemin="0" aria-valuemax="100">${row.done_percent}%</div>
        </div>`;
        let jobDetailHTML = `${row.detail}`;
        if (row.status === 'FAILED') {
            jobDetailHTML = `<button id="" class="btn btn-warning btn-right" onclick="showJobErrorDetail(${row.job_id})"><i class="fas fa-info-circle"></i></button>`;
        }
        if (rowHtml.length > 0) {
            rowHtml.find('.job-duration').text(row.duration);
            rowHtml.find('.job-progress').html(progress);
            if (rowHtml.find('.job-status').attr('data-status') !== row.status) {
                rowHtml.find('.job-status').html(updatedStatus);
            }
            rowHtml.find('.job-detail').html(jobDetailHTML);
        } else {
            tableBody.prepend(`
            <tr id="job-${row.job_id}">
                <td class="job-id">${row.job_id}</td>
                <td class="job-name">${convertJobName(row.job_name) || ' '}</td>
                <td class="job-db-name">${row.db_master_name}</td>
                <td class="job-process-name">${row.process_master_name}</td>
                <td class="job-start-time">${moment(row.start_tm).format(DATE_FORMAT_WITHOUT_TZ)}</td>
                <td class="job-duration">${row.duration}</td>
                <td class="job-progress">${progress}</td>
                <td class="job-status" data-status="${row.status}">${updatedStatus}</td>
                <td class="job-detail">${jobDetailHTML}</td>
            </tr>`);
        }
        rowHtml.find('.job-status').attr('data-status', row.status);
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

    const url = new URL(`/histview2/api/setting/job_detail/${jobId}`, window.location.href).href;
    const json = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
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

// eslint-disable-next-line no-unused-vars
const updateFilterJobs = (jobType) => {
    const filterFlag = $(`#${jobType}`).is(':checked');
    const filterVal = $(`#${jobType}`).val();
    const filterJSON = localStorage.getItem('filterBackgroundJobs');
    const filters = filterJSON ? JSON.parse(filterJSON) : [];
    Array.prototype.remove = function () {
        let what;
        const a = arguments;
        let L = a.length;
        let ax;
        while (L && this.length) {
            what = a[--L];
            while ((ax = this.indexOf(what)) !== -1) {
                this.splice(ax, 1);
            }
        }
        return this;
    };
    if (filterFlag) {
        filters.push(filterVal);
    } else {
        filters.remove(filterVal);
    }
    localStorage.setItem('filterBackgroundJobs', JSON.stringify(filters));
};

const filterJobFromLocal = (jobs) => {
    const filterTypeConst = ['GEN_GLOBAL', 'FACTORY_PAST_IMPORT'];
    const defaultFilter = ['GEN_GLOBAL'];
    const showJobs = {};
    // load filter background jobs
    const userFilterJSON = localStorage.getItem('filterBackgroundJobs');
    const userFilterJobs = userFilterJSON ? JSON.parse(userFilterJSON) : [];

    let filterJobs;
    if (userFilterJSON == null) {
        filterJobs = defaultFilter;
        localStorage.setItem('filterBackgroundJobs', JSON.stringify(defaultFilter));
    } else {
        filterJobs = userFilterJobs;
    }
    filterJobs.forEach((e) => {
        $(`input[value="${e}"]`).prop('checked', true);
    });
    Object.values(jobs).forEach((jobDetail, k) => {
        if (filterTypeConst.includes(jobDetail.job_type) && filterJobs.includes(jobDetail.job_type)) {
            showJobs[k] = jobDetail;
        } else if (!filterTypeConst.includes(jobDetail.job_type)) {
            // apply for general jobs
            showJobs[k] = jobDetail;
        }
    });
    // get jobs from db
    updateBackgroundJobs(showJobs);
};

// custom formatShowingRows
(function ($) {
    $.fn.bootstrapTable.locales['ja-JP'] = {
        formatShowingRows(pageFrom, pageTo, totalRows) {
            return `全${totalRows}件のうち、${pageFrom}から${pageTo}件まで表示しています。`;
        },
    };
    $.fn.bootstrapTable.locales['en-US'] = {
        formatShowingRows(pageFrom, pageTo, totalRows) {
            return `Showing ${pageFrom} to ${pageTo} of all ${totalRows} rows.`;
        },
    };

    $.extend($.fn.bootstrapTable.defaults, $.fn.bootstrapTable.locales['en-US-custom']);
}(jQuery));

$(() => {
    filterJobFromLocal(bgrdJobs);

    // init job table with bootstrap
    const jobTable = $(ids.jobTable);
    jobTable.bootstrapTable({
        pagination: true,
        paginationVAlign: 'both',
        pageSize: 50,
        locale: $('option:selected', $(ids.selectLanguage)).attr('bootstrap-locale'),
        formatShowingRows() {
            return sprintf('');
        },
    });

    const source = openServerSentEvent();
    source.addEventListener(serverSentEventType.jobRun, (event) => {
        const msg = JSON.parse(event.data);
        console.log(msg);
        if (!_.isEmpty(msg)) {
            filterJobFromLocal(msg);
        }
    }, false);

    $('#btnCopyToClipboard').on('click', () => copyToClipboard());

    // Search content of table
    onSearchTableContent('searchJobList', 'jobTable');
});
