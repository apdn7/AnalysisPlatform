async function askWritePermission() {
    try {
        const { state } = await navigator.permissions.query({ name: 'clipboard-write' });
        return state === 'granted';
    } catch (error) {
        return false;
    }
}

// @params blob - The ClipboardItem takes an object with the MIME type as key, and the actual blob as the value.
// @return Promise<void>
const setToClipboard = (blob) => {
    writeClipboardBlob(blob)
};


const writeClipboardBlob = (blob) => {
    if (!navigator.clipboard) {
        loadingHide();
        showToastrMsg(i18nCommon.copyClipboardFailed, MESSAGE_LEVEL.ERROR);
        return;
    }

    const data = [new ClipboardItem({ [blob.type]: blob })];
    navigator.clipboard.write(data).then(function() {
        showToastrMsg(i18nCommon.copyClipboardSuccessful, MESSAGE_LEVEL.INFO);
        console.log('Write to clipboard successful!!!')
    }, function() {
        loadingHide();
        showToastrMsg(i18nCommon.copyClipboardFailed, MESSAGE_LEVEL.ERROR);
    });
};


const writeClipboardText = (text) => {
    if (!navigator.clipboard) {
        loadingHide();
        showToastrMsg(i18nCommon.copyClipboardFailed, MESSAGE_LEVEL.ERROR);
        return;
    }
    navigator.clipboard.writeText(text).then(function() {
        showToastrMsg(i18nCommon.copyClipboardSuccessful, MESSAGE_LEVEL.INFO);
        console.log('Write to clipboard successful!!!')
    }, function() {
        loadingHide();
        showToastrMsg(i18nCommon.copyClipboardFailed, MESSAGE_LEVEL.ERROR);
    });
};

