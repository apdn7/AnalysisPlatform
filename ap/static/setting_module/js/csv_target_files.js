class CsvTargetFilesPreview {
    constructor({ source, filters, list, status, fetchFiles, showPanel }) {
        this.source = source;
        this.filters = filters;
        this.list = list;
        this.status = status;
        this.fetchFiles = fetchFiles;
        this.showPanel = showPanel;
        this.generation = 0;
        this.timer = null;
        this.controller = null;
    }

    reset() {
        this.generation += 1;
        clearTimeout(this.timer);
        this.timer = null;
        this.controller?.abort();
        this.controller = null;
        this.list.textContent = '';
        this.list.scrollTop = 0;
        this.list.scrollLeft = 0;
        this.status.textContent = '';
        this.status.classList.remove('text-danger');
        this.list.setAttribute('aria-busy', 'false');
    }

    showStatus(key, isError = false) {
        this.status.textContent = this.status.dataset[key];
        this.status.classList.toggle('text-danger', isError);
    }

    schedule() {
        this.reset();
        if (!this.source.value.trim()) return;
        this.showStatus('loading');
        this.list.setAttribute('aria-busy', 'true');
        this.timer = setTimeout(() => {
            this.timer = null;
            this.refresh();
        }, 500);
    }

    async refresh() {
        this.reset();
        const url = this.source.value.trim();
        if (!url) return;
        const generation = this.generation;
        this.controller = new AbortController();
        this.showStatus('loading');
        this.list.setAttribute('aria-busy', 'true');
        const payload = { url };
        for (const [name, input] of Object.entries(this.filters)) {
            payload[name] = input.value || null;
        }
        try {
            const result = await this.fetchFiles(payload, this.controller.signal, () => {
                if (generation === this.generation) this.showPanel();
            });
            if (generation !== this.generation) return;
            if (
                !Array.isArray(result.files) ||
                result.files.length > 100 ||
                !result.files.every((file) => typeof file === 'string') ||
                typeof result.truncated !== 'boolean'
            ) {
                throw new Error('Invalid target files response');
            }
            // Filenames are untrusted text, never HTML.
            this.list.textContent = result.files.join('\n');
            if (!result.files.length) {
                this.showStatus('empty');
            } else if (result.truncated) {
                this.showStatus('truncated');
            } else {
                this.status.textContent = '';
            }
        } catch (error) {
            if (generation !== this.generation || error.name === 'AbortError') return;
            console.error('Failed to list CSV target files', error);
            this.showStatus('error', true);
        } finally {
            if (generation === this.generation) {
                this.controller = null;
                this.list.setAttribute('aria-busy', 'false');
            }
        }
    }
}

let csvTargetFilesPreview = null;

const initializeCsvTargetFiles = () => {
    const modal = $('#modal-db-csv');
    const list = document.getElementById('csvTargetFiles');
    if (!modal.length || !list) return;
    const showTargetFilesPanel = (showTargets) => {
        document.getElementById('csvLoadHistoryPanel').hidden = showTargets;
        document.getElementById('csvTargetFilesPanel').hidden = !showTargets;
    };
    csvTargetFilesPreview?.reset();
    csvTargetFilesPreview = new CsvTargetFilesPreview({
        source: document.getElementById('folderUrl'),
        filters: {
            file_name_include: document.getElementById('fileNameInclude'),
            file_name_exclude: document.getElementById('fileNameExclude'),
            subfolder_include: document.getElementById('subfolderInclude'),
            subfolder_exclude: document.getElementById('subfolderExclude'),
        },
        list,
        status: document.getElementById('csvTargetFilesStatus'),
        showPanel: () => showTargetFilesPanel(true),
        fetchFiles: async (payload, signal, onResponse) => {
            payload.file_type = $(csvResourceElements.delimiter).val() || 'Auto';
            payload.etl_func = $(csvResourceElements.optionalFunction).val() || null;
            payload.custom_extension = getCsvCustomExtension();
            const response = await fetch('/ap/api/setting/csv_target_files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal,
            });
            onResponse();
            if (!response.ok) throw new Error(`Target files request failed (${response.status})`);
            return response.json();
        },
    });
    modal
        .off('.csvTargetFiles')
        .on('input.csvTargetFiles', '#folderUrl, .file-select-condition-input, #csvCustomExtension', () => {
            csvTargetFilesPreview.schedule();
        })
        .on('change.csvTargetFiles', '#optionalFunction, input[name="fileType"], #fileTypeOther', () => {
            csvTargetFilesPreview.schedule();
        })
        .on('mouseenter.csvTargetFiles', '.csv-load-history-log tbody tr', () => showTargetFilesPanel(false))
        .on('shown.bs.modal.csvTargetFiles', () => csvTargetFilesPreview.refresh())
        .on('hide.bs.modal.csvTargetFiles', () => csvTargetFilesPreview.reset());
    if (modal[0].getClientRects().length) csvTargetFilesPreview.refresh();
};

$(() => initializeCsvTargetFiles());
