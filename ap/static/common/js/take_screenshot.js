// take screenshot
const defaultHomepage = 'trace_data';
let checkShownGraphInterval = null;

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

const copyImageToClipboard = async (isFullPage = false) => {
    isRemoveCrosshair = false;

    loadingShow();

    // clear old result
    clearOldScreenShot();

    addSettingContentInfor();

    let mainContent = document.getElementById('mainContent');
    if (!isFullPage) {
        [mainContent] = document.getElementsByClassName('plot-content');
    }

    // create screenshot as canvas
    await html2canvas(mainContent, {
        scale: 1, logging: true, backgroundColor: '#222222',
    }).then(async (canvas) => {
        canvas.id = 'tsCanvas';
        const response = await fetch(canvas.toDataURL());
        const blob = await response.blob();
        if (askWritePermission) {
            setToClipboard(blob);
        }
        loadingHide();
    });

    hideInfoContent();
};

const handleTakeScreenShot = () => {
    const exportFrom = getExportDataSrc();
    const isFullPage = exportFrom === 'all';
    // check co graph hay khong
    if (isGraphShown) {
        takeScreenShot(isFullPage);
    } else {
        // click show graph button
        $(currentFormID).find('button.show-graph').trigger('click');
        checkShownGraphInterval = setInterval(() => {
            if (isGraphShown) {
                takeScreenShot(isFullPage);
                clearInterval(checkShownGraphInterval);
            }
        }, 500);
    }
};

const handleCopyImageToClipboard = () => {
    const exportFrom = getExportDataSrc();
    const isFullPage = exportFrom === 'all';
    if (isGraphShown) {
        copyImageToClipboard(isFullPage);
    } else {
        // click show graph button
        $(currentFormID).find('button.show-graph').trigger('click');
        checkShownGraphInterval = setInterval(() => {
            if (isGraphShown) {
                copyImageToClipboard(isFullPage);
                clearInterval(checkShownGraphInterval);
            }
        }, 500);
    }
};

const takeScreenShot = async (isFullPage = true) => {
    if (isFullPage) {
        $('#export-dropdown').removeClass('show');
    }
    isRemoveCrosshair = false;

    // clear old result
    clearOldScreenShot();

    addSettingContentInfor();

    let mainContent = document.getElementById('mainContent');
    if (!isFullPage) {
        [mainContent] = document.getElementsByClassName('plot-content');
    }
    // create screenshot as canvas
    await html2canvas(mainContent, {
        scale: 1, logging: true, backgroundColor: '#222222',
    }).then((canvas) => {
        canvas.id = 'tsCanvas';
        document.getElementById('screenshot').appendChild(canvas);
    });

    // generate filename
    const filename = `${generateDefaultNameExport()}.png`;
    $('#screenshotFilename').val(filename);
    $('#screenshotModal').modal('show');

    hideInfoContent();
};

const hideInfoContent = () => {
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
