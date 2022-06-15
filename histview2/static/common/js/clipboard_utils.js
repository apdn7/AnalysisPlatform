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
const setToClipboard = async (blob) => {
    const data = [new ClipboardItem({ [blob.type]: blob })];
    await navigator.clipboard.write(data);
};

// Can we copy a text or an image ?
// const canWriteToClipboard = await askWritePermission()
// Copy a PNG image to clipboard
// if (canWriteToClipboard) {
// const response = await fetch('/image/my-beautiful-image.png')
// const blob = await response.blob()
// await setToClipboard(blob)
// }
//
// // Copy a text to clipboard
// if (canWriteToClipboard) {
//     const blob = new Blob(['Hello World'], {type: 'text/plain'})
//     await setToClipboard(blob)
// }
//
