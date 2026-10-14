/**
 * @file Owns Quick Plot file selection, upload, and transient upload association.
 */

/**
 * Create the page-scoped Quick Plot module without adding mutable globals beyond its bridge.
 * @return {void}
 */
(function initializeQuickPlotModule() {
    'use strict';

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const SUPPORTED_EXTENSION_PATTERN = /\.(csv|tsv|ssv|zip|7z)$/i;
    const UPLOAD_URL = '/ap/api/setting/quick_plot/upload';
    const EVENT_NAMESPACE = '.quickPlot';
    const FILE_NAME_ELLIPSIS = '...';
    const fileNameMeasureCanvas = document.createElement('canvas');

    const state = {
        activeUploadId: null,
        activeOriginalFilename: null,
        activeServerPath: null,
        currentXhr: null,
        pendingFile: null,
        requestVersion: 0,
        selectedFileName: '',
    };

    let elements;
    let fileNameResizeObserver;
    let messages;

    /**
     * Read localized text from a template hook.
     * @param {string} selector - Selector for the hidden localized text element.
     * @return {string} Localized text.
     */
    function readMessage(selector) {
        return $(selector).text().trim();
    }

    /**
     * Measure text with the filename element's rendered font.
     * @param {string} text - Candidate filename text.
     * @return {number} Rendered text width in pixels.
     */
    function measureFileName(text) {
        const context = fileNameMeasureCanvas.getContext('2d');
        const computedStyle = window.getComputedStyle(elements.fileName[0]);

        // Canvas measurement matches proportional and multilingual glyph widths without exposing filename HTML.
        context.font = computedStyle.font;
        return context.measureText(text).width;
    }

    /**
     * Split a supported filename so truncation can retain its final extension.
     * @param {string} fileName - Full browser-provided filename.
     * @return {{baseName: string, extension: string}} Name before and after the final period.
     */
    function splitFileName(fileName) {
        const extensionSeparatorIndex = fileName.lastIndexOf('.');
        if (extensionSeparatorIndex <= 0 || extensionSeparatorIndex === fileName.length - 1) {
            return { baseName: fileName, extension: '' };
        }
        return {
            baseName: fileName.slice(0, extensionSeparatorIndex),
            extension: fileName.slice(extensionSeparatorIndex + 1),
        };
    }

    /**
     * Fit the current filename to the Quick Plot width while preserving its extension.
     * @return {void}
     */
    function fitDisplayedFileName() {
        const fileName = state.selectedFileName;
        const availableWidth = elements.fileName[0].clientWidth;
        if (!fileName) {
            return;
        }
        if (!availableWidth || measureFileName(fileName) <= availableWidth) {
            elements.fileName.text(fileName);
            return;
        }

        // The literal separator also replaces the extension period, producing "prefix...csv".
        const { baseName, extension } = splitFileName(fileName);
        const suffix = `${FILE_NAME_ELLIPSIS}${extension}`;
        const baseCharacters = Array.from(baseName);
        let lowerBound = 0;
        let upperBound = baseCharacters.length;

        // Binary search keeps the longest Unicode-safe prefix that fits the current rendered width.
        while (lowerBound < upperBound) {
            const candidateLength = Math.ceil((lowerBound + upperBound) / 2);
            const candidate = `${baseCharacters.slice(0, candidateLength).join('')}${suffix}`;
            if (measureFileName(candidate) <= availableWidth) {
                lowerBound = candidateLength;
            } else {
                upperBound = candidateLength - 1;
            }
        }
        elements.fileName.text(`${baseCharacters.slice(0, lowerBound).join('')}${suffix}`);
    }

    /**
     * Set the selected filename and retain its full value for tooltip and assistive technology.
     * @param {string} fileName - Untrusted local filename to display.
     * @return {void}
     */
    function displayFileName(fileName) {
        state.selectedFileName = fileName;

        // Attribute and text APIs preserve the untrusted filename as plain text.
        elements.fileName.attr({
            'title': fileName,
            'aria-label': fileName,
        });
        fitDisplayedFileName();
    }

    /**
     * Update the accessible upload progress indicator.
     * @param {number} percent - Upload completion from zero through one hundred.
     * @return {void}
     */
    function displayProgress(percent) {
        const boundedPercent = Math.max(0, Math.min(100, Math.round(percent)));

        // Keep visual width and assistive progress metadata synchronized.
        elements.progress.attr('aria-valuenow', boundedPercent);
        elements.progressBar.css('width', `${boundedPercent}%`);
        elements.progress.toggleClass('d-none', !state.currentXhr && boundedPercent === 0);
    }

    /**
     * Display upload status without interpreting server or filename content as HTML.
     * @param {string} status - Localized non-error status.
     * @param {string} error - Localized or server-provided error detail.
     * @return {void}
     */
    function displayStatus(status, error) {
        elements.status.text(status || '');
        elements.error.text(error || '');
    }

    /**
     * Reset the native chooser so selecting the same file again emits change.
     * @return {void}
     */
    function resetFileInput() {
        elements.fileInput.val('');
    }

    /**
     * Abort an obsolete request and invalidate every callback owned by it.
     * @return {void}
     */
    function abortCurrentUpload() {
        // Increment first so synchronous abort callbacks are already stale.
        state.requestVersion += 1;
        if (state.currentXhr) {
            state.currentXhr.abort();
            state.currentXhr = null;
        }
    }

    /**
     * Remove upload ownership while leaving the user's Path and preview untouched.
     * @return {void}
     */
    function clearAssociation() {
        state.activeUploadId = null;
        state.activeOriginalFilename = null;
        state.activeServerPath = null;
    }

    /**
     * Restore Quick Plot to its initial state after the registration form completes successfully.
     * @return {void}
     */
    function reset() {
        // Invalidate active callbacks and ownership so an old upload cannot repopulate the reset form.
        abortCurrentUpload();
        clearAssociation();
        state.pendingFile = null;
        state.selectedFileName = '';

        // Close an obsolete replacement prompt and remove any transient drag styling.
        if (elements.replaceModal.hasClass('show')) {
            elements.replaceModal.modal('hide');
        }
        elements.dropArea.removeClass('is-dragover');

        // Restore every user-visible upload control to the same state as initial page load.
        resetFileInput();
        elements.fileName.add(elements.status).add(elements.error).addClass('d-none');
        elements.fileName.text(messages.noFileSelected).removeAttr('title').attr('aria-label', messages.noFileSelected);
        displayStatus('', '');
        displayProgress(0);
    }

    /**
     * Return the upload identifier only when it still owns the supplied Path.
     * @param {string} path - Current Path field value.
     * @return {?string} Active upload identifier, or null for ordinary paths.
     */
    function getActiveUploadIdForPath(path) {
        const normalizedPath = String(path || '').trim();
        return normalizedPath && normalizedPath === state.activeServerPath ? state.activeUploadId : null;
    }

    /**
     * Reconcile upload ownership when the existing Path listener receives input.
     * @param {string} path - Current Path field value.
     * @param {?Object} context - Optional native event detail emitted after upload.
     * @return {void}
     */
    function handlePathInput(path, context) {
        const normalizedPath = String(path || '').trim();
        const isOwnQuickPlotEvent =
            context &&
            context.source === 'quick-plot' &&
            context.uploadId === state.activeUploadId &&
            context.serverPath === state.activeServerPath &&
            normalizedPath === state.activeServerPath;

        // The success event establishes the new Path and must retain its own association.
        if (isOwnQuickPlotEvent) {
            return;
        }

        // Manual edits to another Path invalidate ownership and any upload that could overwrite the edit.
        if (normalizedPath !== state.activeServerPath) {
            clearAssociation();
            if (state.currentXhr) {
                abortCurrentUpload();
                displayStatus('', '');
                displayProgress(0);
            }
        }
    }

    /**
     * Extract an actionable error message from an unsuccessful upload response.
     * @param {XMLHttpRequest} xhr - Completed upload request.
     * @return {string} Safe text for the error display.
     */
    function getUploadError(xhr) {
        // Prefer a structured backend message while tolerating empty and non-JSON responses.
        try {
            const response = JSON.parse(xhr.responseText);
            if (response && typeof response.detail === 'string' && response.detail.trim()) {
                return response.detail;
            }
            if (response && typeof response.message === 'string' && response.message.trim()) {
                return response.message;
            }
        } catch (error) {
            // A generic localized message is safer than exposing an unstructured response body.
        }
        return messages.uploadFailed;
    }

    /**
     * Normalize the successful endpoint response into its required identifiers.
     * @param {Object} response - Parsed upload endpoint response.
     * @return {?{uploadId: string, originalFilename: string, serverPath: string}} Validated upload result.
     */
    function normalizeUploadResponse(response) {
        // Accept the standard direct response and the project's common data envelope.
        const payload = response && response.data ? response.data : response;
        if (
            !payload ||
            typeof payload.upload_id !== 'string' ||
            !payload.upload_id ||
            typeof payload.original_filename !== 'string' ||
            !payload.original_filename ||
            typeof payload.server_path !== 'string' ||
            !payload.server_path
        ) {
            return null;
        }
        return {
            uploadId: payload.upload_id,
            originalFilename: payload.original_filename,
            serverPath: payload.server_path,
        };
    }

    /**
     * Apply a successful upload and explicitly enter the existing Path input flow.
     * @param {{uploadId: string, originalFilename: string, serverPath: string}} upload - Validated server upload result.
     * @return {void}
     */
    function applyUpload(upload) {
        // Store ownership before dispatch so the Path listener recognizes this event as current.
        state.activeUploadId = upload.uploadId;
        state.activeOriginalFilename = upload.originalFilename;
        state.activeServerPath = upload.serverPath;
        displayProgress(100);
        displayStatus(messages.fileSelected, '');

        // Use a native input event with explicit context instead of calling preview or plot APIs.
        const folderInput = document.getElementById('folderUrl');
        folderInput.value = upload.serverPath;
        folderInput.dispatchEvent(
            new CustomEvent('input', {
                bubbles: true,
                detail: {
                    source: 'quick-plot',
                    uploadId: upload.uploadId,
                    originalFilename: upload.originalFilename,
                    serverPath: upload.serverPath,
                },
            }),
        );
    }

    /**
     * Handle upload progress for the currently active request.
     * @param {ProgressEvent} event - Browser upload progress event.
     * @param {number} requestVersion - Request identity used to reject stale callbacks.
     * @return {void}
     */
    function handleUploadProgress(event, requestVersion) {
        // Ignore stale and non-computable progress rather than displaying misleading values.
        if (requestVersion !== state.requestVersion || !event.lengthComputable) {
            return;
        }
        const percent = (event.loaded / event.total) * 100;
        displayProgress(percent);
        displayStatus(`${messages.uploading} ${Math.round(percent)}%`, '');
    }

    /**
     * Handle completion while preventing an older upload from replacing newer state.
     * @param {XMLHttpRequest} xhr - Completed upload request.
     * @param {number} requestVersion - Request identity used to reject stale callbacks.
     * @return {void}
     */
    function handleUploadComplete(xhr, requestVersion) {
        // Completion from upload A must not mutate UI or Path after upload B starts.
        if (requestVersion !== state.requestVersion || xhr.readyState !== XMLHttpRequest.DONE) {
            return;
        }
        state.currentXhr = null;
        resetFileInput();

        // Surface HTTP and response-contract failures through the dedicated error hook.
        if (xhr.status < 200 || xhr.status >= 300) {
            displayProgress(0);
            displayStatus('', getUploadError(xhr));
            return;
        }

        try {
            const upload = normalizeUploadResponse(JSON.parse(xhr.responseText));
            if (!upload) {
                displayProgress(0);
                displayStatus('', messages.uploadFailed);
                return;
            }
            applyUpload(upload);
        } catch (error) {
            displayProgress(0);
            displayStatus('', messages.uploadFailed);
        }
    }

    /**
     * Upload one validated file as multipart form data.
     * @param {File} file - Browser-selected file.
     * @return {void}
     */
    function uploadFile(file) {
        // A newly confirmed upload replaces only the previous in-flight request.
        abortCurrentUpload();
        const requestVersion = state.requestVersion;
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file, file.name);
        state.currentXhr = xhr;

        displayFileName(file.name);
        displayProgress(0);
        displayStatus(`${messages.uploading} 0%`, '');

        xhr.open('POST', UPLOAD_URL, true);

        /**
         * Forward browser progress with the request identity captured at upload start.
         * @param {ProgressEvent} event - Browser upload progress event.
         * @return {void}
         */
        xhr.upload.onprogress = function onQuickPlotUploadProgress(event) {
            handleUploadProgress(event, requestVersion);
        };

        /**
         * Forward completion with the request identity captured at upload start.
         * @return {void}
         */
        xhr.onreadystatechange = function onQuickPlotReadyStateChange() {
            handleUploadComplete(xhr, requestVersion);
        };
        xhr.send(formData);
    }

    /**
     * Validate a candidate immediately before any confirmation or network activity.
     * @param {File} file - First selected or dropped file.
     * @return {boolean} Whether the file can be uploaded.
     */
    function validateFile(file) {
        // Reject unsupported dropped files because the input accept filter does not govern drag and drop.
        if (!SUPPORTED_EXTENSION_PATTERN.test(file.name)) {
            displayStatus('', messages.invalidFileType);
            resetFileInput();
            return false;
        }

        // Enforce the approved client limit before opening a modal or allocating request state.
        if (file.size > MAX_FILE_SIZE) {
            displayStatus('', messages.fileTooLarge);
            resetFileInput();
            return false;
        }
        return true;
    }

    /**
     * Route a candidate through optional Path replacement confirmation.
     * @param {File} file - Validated first selected or dropped file.
     * @return {void}
     */
    function prepareFile(file) {
        if (!file) {
            return;
        }
        elements.fileName.add(elements.status).add(elements.error).removeClass('d-none');
        if (!validateFile(file)) {
            return;
        }

        // Do not alter current upload or display state until Path replacement is confirmed.
        if (String(registerFromFileEles.folderUrl.val() || '').trim()) {
            state.pendingFile = file;
            elements.replaceModal.modal('show');
            return;
        }
        uploadFile(file);
    }

    /**
     * Handle chooser selection, which is constrained to one file by the input.
     * @param {Event} event - Native file input change event.
     * @return {void}
     */
    function handleFileInputChange(event) {
        prepareFile(event.currentTarget.files[0]);
    }

    /**
     * Mark the drop area while a file is dragged over it.
     * @param {DragEvent} event - Native drag event.
     * @return {void}
     */
    function handleDragOver(event) {
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = 'copy';
        elements.dropArea.addClass('is-dragover');
    }

    /**
     * Remove drag emphasis when the pointer leaves the drop area.
     * @param {DragEvent} event - Native drag event.
     * @return {void}
     */
    function handleDragLeave(event) {
        event.preventDefault();
        elements.dropArea.removeClass('is-dragover');
    }

    /**
     * Upload only the first file from a potentially multi-file drop.
     * @param {DragEvent} event - Native drop event.
     * @return {void}
     */
    function handleDrop(event) {
        event.preventDefault();
        elements.dropArea.removeClass('is-dragover');
        prepareFile(event.originalEvent.dataTransfer.files[0]);
    }

    /**
     * Open the chooser when the drop area is activated from the keyboard.
     * @param {KeyboardEvent} event - Native keydown event.
     * @return {void}
     */
    function handleDropAreaKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            elements.fileInput.trigger('click');
        }
    }

    /**
     * Open the chooser when empty drop-area chrome, rather than a child control, is clicked.
     * @param {MouseEvent} event - Native click event.
     * @return {void}
     */
    function handleDropAreaClick(event) {
        // Let native controls act normally while making the remaining drop-area content clickable.
        if ($(event.target).closest('label, input, button').length === 0) {
            elements.fileInput.trigger('click');
        }
    }

    /**
     * Start the pending upload after explicit replacement confirmation.
     * @return {void}
     */
    function handleReplaceConfirm() {
        const file = state.pendingFile;
        state.pendingFile = null;
        elements.replaceModal.modal('hide');
        if (file) {
            uploadFile(file);
        }
    }

    /**
     * Discard an unconfirmed candidate without changing current upload or Path state.
     * @return {void}
     */
    function handleReplaceModalHidden() {
        state.pendingFile = null;
        resetFileInput();
    }

    /**
     * Return the browser filename only while it owns the current server Path.
     * @param {string} path - Current Path field value.
     * @return {?string} Original filename, or null for ordinary paths.
     */
    function getOriginalFilenameForPath(path) {
        const normalizedPath = String(path || '').trim();
        return normalizedPath && normalizedPath === state.activeServerPath ? state.activeOriginalFilename : null;
    }

    /**
     * Cache DOM hooks, expose the bridge, and bind handlers idempotently.
     * @return {void}
     */
    function initialize() {
        elements = {
            dropArea: $('#quickPlotDropArea'),
            fileInput: $('#quickPlotFileInput'),
            fileName: $('#quickPlotFileName'),
            progress: $('#quickPlotProgress'),
            progressBar: $('#quickPlotProgressBar'),
            status: $('#quickPlotStatus'),
            error: $('#quickPlotError'),
            replaceModal: $('#quickPlotReplaceModal'),
            replaceConfirm: $('#quickPlotReplaceConfirm'),
        };
        messages = {
            uploading: readMessage('#i18nQuickPlotUploading'),
            uploadFailed: readMessage('#i18nQuickPlotUploadFailed'),
            invalidFileType: readMessage('#i18nQuickPlotInvalidFileType'),
            fileTooLarge: readMessage('#i18nQuickPlotFileTooLarge'),
            fileSelected: readMessage('#i18nFileIsSelected'),
            noFileSelected: elements.fileName.text().trim(),
        };

        // Normalize the template placeholder to the same value reset() restores, so the
        // initial-load text is byte-identical to the post-reset text regardless of how the
        // Jinja template wraps/indents this node. This keeps reset idempotent with first load.
        elements.fileName.text(messages.noFileSelected).attr('aria-label', messages.noFileSelected);

        // Publish only the state operations required by the existing registration workflow.
        window.quickPlot = {
            getActiveUploadIdForPath,
            getOriginalFilenameForPath,
            handlePathInput,
            reset,
        };

        // Namespace every binding so repeated initialization cannot duplicate uploads.
        elements.fileInput.off(EVENT_NAMESPACE).on(`change${EVENT_NAMESPACE}`, handleFileInputChange);
        elements.dropArea
            .off(EVENT_NAMESPACE)
            .on(`dragover${EVENT_NAMESPACE}`, handleDragOver)
            .on(`dragleave${EVENT_NAMESPACE}`, handleDragLeave)
            .on(`drop${EVENT_NAMESPACE}`, handleDrop)
            .on(`keydown${EVENT_NAMESPACE}`, handleDropAreaKeydown)
            .on(`click${EVENT_NAMESPACE}`, handleDropAreaClick);
        elements.replaceConfirm.off(EVENT_NAMESPACE).on(`click${EVENT_NAMESPACE}`, handleReplaceConfirm);
        elements.replaceModal
            .off(`hidden.bs.modal${EVENT_NAMESPACE}`)
            .on(`hidden.bs.modal${EVENT_NAMESPACE}`, handleReplaceModalHidden);

        // Re-observe the bounded label so responsive grid changes always recalculate the visible prefix.
        if (fileNameResizeObserver) {
            fileNameResizeObserver.disconnect();
        }
        fileNameResizeObserver = new ResizeObserver(fitDisplayedFileName);
        fileNameResizeObserver.observe(elements.fileName[0]);
    }

    $(initialize);
})();
