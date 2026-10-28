const CSV_LOAD_HISTORY_LIMIT = 20;

class CsvLoadHistory {
    constructor({ log, fetchJobs, statusLabels, onSelect = () => {} }) {
        this.log = log;
        this.body = log.querySelector('tbody');
        this.status = log.querySelector('[role="status"]');
        this.fetchJobs = fetchJobs;
        this.statusLabels = statusLabels;
        this.onSelect = onSelect;
        this.generation = 0;
        this.controller = null;
        this.reset();
    }

    reset() {
        this.generation += 1;
        this.controller?.abort();
        this.controller = null;
        this.jobs = [];
        this.fetchedJobIds = new Set();
        this.selectedHistoryId = null;
        this.pendingPreviewTokens = new Set();
        this.latestPreview = null;
        this.previewSequence = 0;
        this.showJobs = true;
        this.dataSourceId = null;
        this.body.replaceChildren();
        this.onSelect(null);
        this.showStatus();
        this.log.scrollTop = 0;
        this.log.setAttribute('aria-busy', 'false');
    }

    showStatus(key, isError = false) {
        this.status.textContent = key ? this.status.dataset[key] : '';
        this.status.parentElement.hidden = !key;
        this.status.classList.toggle('text-danger', isError);
    }

    render() {
        const startTime = (job) => (job.start_tm ? moment(job.start_tm).valueOf() : 0);
        this.jobs.sort(
            (left, right) =>
                startTime(right) - startTime(left) ||
                (Number.isSafeInteger(left.job_id) && Number.isSafeInteger(right.job_id)
                    ? right.job_id - left.job_id
                    : 0),
        );
        const fragment = document.createDocumentFragment();
        for (const job of this.jobs) {
            const row = document.createElement('tr');
            row.dataset.historyId = this.getHistoryId(job);
            if (job.job_id !== null) row.dataset.jobId = String(job.job_id);
            row.tabIndex = 0;
            row.setAttribute('aria-selected', String(this.getHistoryId(job) === this.selectedHistoryId));
            const values = [
                job.process_master_name ?? '',
                job.start_tm ? moment(job.start_tm).format(DATE_FORMAT_WITHOUT_TZ) : '',
                job.duration ?? '',
                this.statusLabels[job.status] ?? job.status,
            ];
            values.forEach((value, index) => {
                const cell = document.createElement('td');
                cell.textContent = value;
                cell.title = String(value);
                if (index === 0) cell.className = 'csv-load-history-process-name';
                row.append(cell);
            });
            fragment.append(row);
        }
        this.body.replaceChildren(fragment);
    }

    getHistoryId(job) {
        return job.historyId ?? String(job.job_id);
    }

    getPendingTokens() {
        return [...this.pendingPreviewTokens];
    }

    getSaveTokens() {
        return this.latestPreview ? [this.latestPreview.token] : [];
    }

    select(historyId) {
        const job = this.jobs.find((entry) => this.getHistoryId(entry) === String(historyId));
        if (!job) return;
        this.selectedHistoryId = this.getHistoryId(job);
        for (const row of this.body.querySelectorAll('tr')) {
            row.setAttribute('aria-selected', String(row.dataset.historyId === this.selectedHistoryId));
        }
        this.onSelect(job);
    }

    appendError(response, generation) {
        return this.appendPreview(response, generation);
    }

    appendPreview(response, generation) {
        if (generation !== this.generation) return;
        const job = response.load_history;
        const error = response.error;
        const isPending =
            (response.preview_persisted === false || response.error_persisted === false) &&
            typeof response.preview_token === 'string' &&
            response.preview_token.length > 0 &&
            job?.job_id === null &&
            (!error || error.id === null);
        const isSuccess = job?.status === 'DONE' && !error;
        const isFailure =
            job?.status === 'FAILED' && error?.id === job.job_id && typeof error?.details_text === 'string';
        if (
            !job ||
            (!isPending && (!Number.isSafeInteger(job.job_id) || job.job_id <= 0)) ||
            (job.db_code !== null && job.db_code !== this.dataSourceId) ||
            (!isSuccess && !isFailure)
        ) {
            console.error('Invalid CSV preview response');
            this.showStatus('error', true);
            return false;
        }
        if (isPending && this.pendingPreviewTokens.has(response.preview_token)) return true;
        const entry = { ...job, error };
        if (isPending) {
            this.pendingPreviewTokens.add(response.preview_token);
            if (!this.latestPreview || job.start_tm >= this.latestPreview.startTime) {
                this.latestPreview = {
                    token: response.preview_token,
                    status: job.status,
                    startTime: job.start_tm,
                };
            }
            entry.historyId = `preview:${++this.previewSequence}`;
            if (this.dataSourceId === null) entry.process_master_name = '';
        }
        // Keep preview tokens for saving even when history is hidden by the filters.
        if (!this.showJobs) return true;
        let livePreviewCount = 0;
        this.jobs = [
            entry,
            ...this.jobs.filter((existing) => this.getHistoryId(existing) !== this.getHistoryId(entry)),
        ].filter((existing) => this.fetchedJobIds.has(existing.job_id) || ++livePreviewCount <= CSV_LOAD_HISTORY_LIMIT);
        this.render();
        this.showStatus();
        this.log.scrollTop = 0;
        this.select(this.getHistoryId(entry));
        return true;
    }

    async load(dataSourceId, showJobs = true) {
        this.reset();
        const id = Number(dataSourceId);
        this.dataSourceId = Number.isSafeInteger(id) && id > 0 ? id : null;
        await this.refresh(showJobs);
    }

    async refresh(showJobs = this.showJobs) {
        this.showJobs = showJobs;
        this.controller?.abort();
        this.controller = null;
        if (!showJobs || this.dataSourceId === null) {
            this.jobs = this.jobs.filter((job) => job.job_id === null);
            this.fetchedJobIds.clear();
            this.render();
            if (!this.jobs.some((job) => this.getHistoryId(job) === this.selectedHistoryId)) {
                this.selectedHistoryId = null;
                this.onSelect(null);
            }
            this.showStatus(this.jobs.length ? null : 'empty');
            this.log.setAttribute('aria-busy', 'false');
            return;
        }
        const generation = this.generation;
        const controller = new AbortController();
        this.controller = controller;
        const jobsAtStart = new Map(this.jobs.map((job) => [this.getHistoryId(job), job]));
        this.showStatus('loading');
        this.log.setAttribute('aria-busy', 'true');
        try {
            const result = await this.fetchJobs(this.dataSourceId, controller.signal);
            if (generation !== this.generation || controller !== this.controller) return;
            if (
                !Array.isArray(result.rows) ||
                !Number.isSafeInteger(result.total) ||
                result.total < 0 ||
                result.rows.length > result.total ||
                (result.total > 0 && result.rows.length === 0) ||
                new Set(result.rows.map((job) => job.job_id)).size !== result.rows.length ||
                result.rows.some(
                    (job) =>
                        job.db_code !== this.dataSourceId ||
                        !Number.isSafeInteger(job.job_id) ||
                        job.job_id <= 0 ||
                        (job.job_type !== undefined && !['CSV_IMPORT', 'CSV_PREVIEW'].includes(job.job_type)),
                )
            ) {
                throw new Error('Invalid CSV load history response');
            }
            // Keep unsaved previews and outcomes received while this request was in flight.
            const liveJobs = this.jobs.filter(
                (job) => job.job_id === null || jobsAtStart.get(this.getHistoryId(job)) !== job,
            );
            const liveIds = new Set(liveJobs.map((job) => job.job_id));
            this.fetchedJobIds = new Set(result.rows.map((job) => job.job_id));
            this.jobs = [...liveJobs, ...result.rows.filter((job) => !liveIds.has(job.job_id))];
            this.render();
            if (this.selectedHistoryId !== null) {
                if (this.jobs.some((job) => this.getHistoryId(job) === this.selectedHistoryId)) {
                    this.select(this.selectedHistoryId);
                } else {
                    this.selectedHistoryId = null;
                    this.onSelect(null);
                }
            }
            if (this.selectedHistoryId === null && this.jobs.length) {
                this.select(this.getHistoryId(this.jobs[0]));
            }
            this.showStatus(this.jobs.length ? null : 'empty');
        } catch (error) {
            if (generation !== this.generation || controller !== this.controller || error.name === 'AbortError') return;
            console.error('Failed to load CSV job history', error);
            this.showStatus('error', true);
        } finally {
            if (generation === this.generation && controller === this.controller) {
                this.controller = null;
                this.log.setAttribute('aria-busy', 'false');
            }
        }
    }
}

let csvLoadHistory = null;

const formatCsvLoadHistoryTrace = (error) => {
    const trace = error?.details_text ?? '';
    const timeHeader = /^(Location[ \t]*:[^\r\n]*\r?\nTime[ \t]*:[ \t]*)[^\r\n]*/;
    if (!timeHeader.test(trace) || error.occurred_at == null) return trace;

    const timestamp = error.occurred_at;
    if (typeof timestamp !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) {
        console.error('Invalid CSV error occurrence timestamp', timestamp);
        return trace;
    }
    const occurredAt = moment(timestamp, moment.ISO_8601, true);
    if (!occurredAt.isValid()) {
        console.error('Invalid CSV error occurrence timestamp', timestamp);
        return trace;
    }
    return trace.replace(timeHeader, (_, header) => `${header}${occurredAt.local().format(DATE_FORMAT_WITHOUT_TZ)}`);
};

const showCsvLoadHistoryDetails = (job) => {
    const panel = document.getElementById('csvLoadHistoryPanel');
    const fields = panel.querySelectorAll('[data-history-field]');
    const error = job?.error;
    const values = {
        process: job?.process_master_name ?? '',
        time: job?.start_tm ? moment(job.start_tm).format(DATE_FORMAT_WITHOUT_TZ) : '',
        status: job ? (csvLoadHistory?.statusLabels[job.status] ?? job.status) : '',
        details:
            error?.message ?? (job?.status === 'DONE' ? job.summary : null) ?? (job?.previewed_files ?? []).join('\n'),
        group: error?.hint?.group ?? '',
        name: error?.hint?.name ?? '',
        cause: error?.hint?.cause ?? '',
        hint: error?.hint?.hint ?? '',
    };
    for (const field of fields) {
        field.textContent = values[field.dataset.historyField];
        field.title = field.textContent;
    }
    const trace = formatCsvLoadHistoryTrace(error);
    panel.querySelector('.csv-load-history-trace').textContent = trace;
    panel.querySelector('.csv-load-history-details').hidden = !job;
    panel.querySelector('.csv-load-history-error').hidden = !error;
    panel.querySelector('#csvLoadHistoryTraceTrigger').hidden = !trace;
    document.getElementById('csvLoadHistoryEmpty').hidden = Boolean(job);
    document.getElementById('btnCopyCsvLoadHistory').disabled = !trace;
    if (job) {
        panel.hidden = false;
        document.getElementById('csvTargetFilesPanel').hidden = true;
    }
};

const initializeCsvLoadHistory = () => {
    const modal = $('#modal-db-csv');
    const log = modal.find('.csv-load-history-log');
    if (!modal.length || !log.length) return;
    csvLoadHistory?.reset();
    csvLoadHistory = new CsvLoadHistory({
        log: log[0],
        onSelect: showCsvLoadHistoryDetails,
        statusLabels: {
            DONE: $('label[for="csvLoadHistoryNormalEnd"]').text().trim(),
            PROCESSING: $('#i18nStatusImporting').text(),
            PENDING: $('#i18nStatusPending').text(),
            FAILED: $('label[for="csvLoadHistoryError"]').text().trim(),
            KILLED: $('#i18nStatusFailed').text(),
            FATAL: $('#i18nStatusFailed').text(),
        },
        fetchJobs: async (dataSourceId, signal) => {
            const params = new URLSearchParams({
                db_code: dataSourceId,
                sort: 'start_tm',
                order: 'desc',
                offset: 0,
                limit: CSV_LOAD_HISTORY_LIMIT,
                show_past_import_job: true,
                job_types: 'CSV_IMPORT,CSV_PREVIEW',
            });
            const statuses = [];
            if (modal.find('#csvLoadHistoryNormalEnd').prop('checked')) statuses.push('DONE');
            if (modal.find('#csvLoadHistoryError').prop('checked')) statuses.push('ERROR');
            if (statuses.length) params.set('statuses', statuses.join(','));
            const response = await fetch(`/ap/api/setting/get_jobs?${params}`, {
                signal,
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (!response.ok) throw new Error(`CSV load history request failed (${response.status})`);
            return response.json();
        },
    });
    const load = () =>
        csvLoadHistory.load(
            modal.find('#showResources').attr('data-ds-id'),
            modal.find('#csvLoadHistoryNormalEnd, #csvLoadHistoryError').is(':checked'),
        );
    modal
        .off('.csvLoadHistory')
        .on('shown.bs.modal.csvLoadHistory', load)
        .on('change.csvLoadHistory', '#csvLoadHistoryNormalEnd, #csvLoadHistoryError', () =>
            csvLoadHistory.refresh(modal.find('#csvLoadHistoryNormalEnd, #csvLoadHistoryError').is(':checked')),
        )
        .on('hide.bs.modal.csvLoadHistory', () => {
            modal.find('#csvLoadHistoryNormalEnd, #csvLoadHistoryError').prop('checked', true);
            csvLoadHistory.reset();
        })
        .on(
            'mouseenter.csvLoadHistory focusin.csvLoadHistory click.csvLoadHistory',
            '.csv-load-history-log tbody tr',
            (event) => csvLoadHistory.select(event.currentTarget.dataset.historyId),
        );
    if (modal[0].getClientRects().length) load();
};

$(() => initializeCsvLoadHistory());
