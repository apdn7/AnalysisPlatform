// take screenshot
const defaultHomepage = 'trace_data';

const clearOldScreenShot = () => {
    const oldCanvas = document.getElementById('screenshot').querySelectorAll('canvas')[0];
    if (oldCanvas) {
        const context = oldCanvas.getContext('2d');
        context.clearRect(0, 0, oldCanvas.width, oldCanvas.height);
        context.beginPath();
    }
    $('#screenshot').empty();

    const el = $('#download');
    el.attr('href', null);
    el.attr('download', null);

    // clear old setting information
    $('#stContentTab .setting-inform-content').empty();
};

const addSettingContentInfor = () => {
    const stDOM = document.getElementById('settingHoverContent');

    if (stDOM) {
        const childDOM = stDOM.children[1];
        const stContent = childDOM.cloneNode(true);
        $('#stContentTab .setting-inform-content').append(stContent);
        $('#stContentTab .setting-inform-content').show();
        $('#stContentTab .setting-inform-content').css('position', 'inherit');
        $('#stContentTab').show();
    }
};

const copyImageToClipboard = async () => {
    isRemoveCrosshair = false;

    loadingShow();

    // clear old result
    clearOldScreenShot();

    addSettingContentInfor();
    // create screenshot as canvas
    // setTimeout(async () => {
    await html2canvas(document.getElementById('mainContent'), {
        scale: 1, logging: true, backgroundColor: '#222222',
    },).then(async (canvas) => {
        canvas.id = 'tsCanvas';
        const response = await fetch(canvas.toDataURL());
        const blob = await response.blob();
        if (askWritePermission) {
            await setToClipboard(blob);
        }
        // showLoadingIcon();
        loadingHide();
    });
    // }, 3000);
};

const takeScreenShot = async () => {
    isRemoveCrosshair = false;

    // clear old result
    clearOldScreenShot();

    addSettingContentInfor();

    // create screenshot as canvas
    await html2canvas(document.getElementById('mainContent'), {
        scale: 1, logging: true, backgroundColor: '#222222',
    },).then((canvas) => {
        canvas.id = 'tsCanvas';
        document.getElementById('screenshot').appendChild(canvas);
    });

    // generate filename
    const urlParts = window.location.href.split('/');
    let filename = 'screenshot.png';
    if (urlParts.length) {
        const pageName = urlParts[urlParts.length - 1] || defaultHomepage;
        filename = `${pageName}_${moment().format('YYYYMMDD_HHMMSS')}.png`;
    }
    $('#screenshotFilename').val(filename);
    $('#screenshotModal').modal('show');

    $('#stContentTab .setting-inform-content').html('');
    $('#stContentTab').hide();
};

const showLoadingIcon = () => {
    $('.download-timeout').toggleClass('hide');
};
// download image
const downloadScreenshot = async (el) => {
    isRemoveCrosshair = false;
    showLoadingIcon();
    const screenshot = document.getElementById('screenshot').querySelectorAll('canvas')[0];
    const targetLink = document.createElement('a');
    if (screenshot) {
        const filename = $('#screenshotFilename').val();
        targetLink.setAttribute('download', filename);
        targetLink.href = screenshot.toDataURL();
        // const response = await fetch(targetLink.href);
        // const blob = await response.blob();
        // if (askWritePermission) {
        //     await setToClipboard(blob);
        // }
    }
    setTimeout(() => {
        targetLink.click();
        $('#screenshotModal').modal('hide');
        showLoadingIcon();
        clearOldScreenShot();
    }, 3000);
};
