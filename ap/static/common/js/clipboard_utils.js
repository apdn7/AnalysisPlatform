async function askWritePermission() {
    try {
        const { state } = await navigator.permissions.query({
            name: 'clipboard-write',
        });
        return state === 'granted';
    } catch (error) {
        return false;
    }
}

const NoPermissionMessage = Object.freeze('There is not have permissions to access clipboard.');

// @params blob - The ClipboardItem takes an object with the MIME type as key, and the actual blob as the value.
// @return Promise<void>
const setToClipboard = (blob) => {
    writeClipboardBlob(blob);
};

const writeClipboardBlob = (blob) => {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        loadingHide();
        showToastCopyToClipboardFailed(NoPermissionMessage);
        return;
    }

    const data = [new ClipboardItem({ [blob.type]: blob })];
    navigator.clipboard.write(data).then(showToastCopyToClipboardSuccessful, showToastCopyToClipboardFailed);
};

const writeClipboardText = (text) => {
    if (!navigator.clipboard) {
        loadingHide();
        showToastCopyToClipboardFailed(NoPermissionMessage);
        return;
    }
    navigator.clipboard.writeText(text).then(showToastCopyToClipboardSuccessful, showToastCopyToClipboardFailed);
};

/**
 * Show toast message in case Copy To Clipboard Successful
 */
function showToastCopyToClipboardSuccessful() {
    console.log('Write to clipboard successful!!!');
    showToastrMsg(i18nCommon.copyClipboardSuccessful, MESSAGE_LEVEL.INFO);
}

/**
 * Show toast message in case Paste From Clipboard Successful
 */
function showToastPasteFromClipboardSuccessful() {
    console.log('Paste from clipboard successful!!!');
    showToastrMsg(i18nCommon.pasteFromClipboardSuccessful, MESSAGE_LEVEL.INFO);
}

/**
 * Show toast message in case No Permission Copy To Clipboard
 * @param {Error | string?} error - an error message
 */
function showToastCopyToClipboardFailed(error) {
    console.error(error);
    showToastrMsg(i18nCommon.copyClipboardFailed, MESSAGE_LEVEL.ERROR);
}

/**
 * Show toast message in case No Permission Read Clipboard
 * @param {Error | string?} error - an error message
 */
function showToastPasteFromClipboardFailed(error) {
    console.error(error);
    showToastrMsg(i18nCommon.pasteFromClipboardFailed, MESSAGE_LEVEL.ERROR);
}

/**
 * Unsecured paste text from clipboard
 * @summary this function ONLY work on DEVELOPER TOOLS
 * @return {Promise<unknown>}
 * @deprecated
 */
function unsecuredPasteFromClipboard() {
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        // document.body.appendChild(textarea);
        document.body.prepend(textarea);

        textarea.focus();
        let value = null;

        try {
            document.execCommand('paste');
            value = textarea.value;
        } catch (error) {
            reject(error);
        } finally {
            textarea.remove();
        }

        resolve(value);
    });
}

/**
 * Unsecured copy text to clipboard
 * @summary this function ONLY work on DEVELOPER TOOLS
 * @param {string} text
 * @return {Promise<void>}
 * @deprecated
 */
function unsecuredCopyToClipboard(text) {
    return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        // document.body.appendChild(textArea);
        document.body.prepend(textArea);
        // textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (error) {
            reject(error);
        } finally {
            document.body.removeChild(textArea);
        }

        resolve();
    });
}

/**
 * Wrapper to show message inform in case cannot access to clipboard
 */
function handleAccessingClipboardInUnsecuredContext() {
    if (navigator.clipboard == null) {
        const throwError = () =>
            new Promise((resolve, reject) => {
                reject(new Error(NoPermissionMessage));
            });

        navigator.clipboard = {
            writeText: throwError,
            readText: throwError,
            write: throwError,
        };
    }
}

$(() => handleAccessingClipboardInUnsecuredContext());
