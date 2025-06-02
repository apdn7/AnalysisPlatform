// take screenshot
const defaultHomepage = 'trace_data';
let checkShownGraphInterval = null;
const colorScalePages = ['CHM', 'ScP', 'PCP', 'PCA', 'MSP'];

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
    hideInfoContent();
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
    if (isFullPage) {
        $('#export-dropdown').removeClass('show');
    }
    isRemoveCrosshair = false;

    loadingShow();

    // clear old result
    clearOldScreenShot();

    addSettingContentInfor();

    let mainContent = document.getElementById('mainContent');
    if (!isFullPage) {
        [mainContent] = document.getElementsByClassName('plot-content');
    }

    const currentPageName = window.location.pathname;
    try {
        if (colorScalePages.includes(objTitle[currentPageName].title)) {
            modernScreenShotCapture().copy(mainContent);
        } else {
            defaultCapture().copy(mainContent);
        }
    } catch (err) {
        defaultCapture().copy(mainContent);
    }
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

    captureImage(mainContent);
};

const hideInfoContent = () => {
    console.log('clear content');
    $('#stContentTab .setting-inform-content').html('');
    $('#stContentTab').hide();
};

const showLoadingIcon = () => {
    $('.download-timeout').toggleClass('hide');
};

const defaultCapture = () => {
    const generator = async (mainContent) => {
        // create screenshot as canvas
        await html2canvas(mainContent, {
            scale: 1,
            logging: true,
            backgroundColor: '#222222',
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
    const download = () => {
        const screenshot = document.getElementById('screenshot').querySelectorAll('canvas')[0];
        const targetLink = document.createElement('a');
        if (screenshot) {
            const filename = $('#screenshotFilename').val();
            targetLink.setAttribute('download', filename);
            targetLink.href = screenshot.toDataURL();
        }
        hideInfoContent();
        return targetLink;
    };
    const copy = async (mainContent) => {
        // create screenshot as canvas
        await html2canvas(mainContent, {
            scale: 1,
            logging: true,
            backgroundColor: '#222222',
        }).then(async (canvas) => {
            canvas.id = 'tsCanvas';
            const response = await fetch(canvas.toDataURL());
            const blob = await response.blob();
            if (askWritePermission) {
                setToClipboard(blob);
            }
            loadingHide();
            hideInfoContent();
        });
    };
    return {
        generator,
        download,
        copy,
    };
};
const modernScreenShotCapture = () => {
    const generator = (mainContent) => {
        $('.select2-selection__rendered').css('margin-right', '50px');
        modernScreenshot.domToPng(mainContent).then((dataUrl) => {
            document.getElementById('screenshot').setAttribute('data-url', dataUrl);
            // generate filename
            const filename = `${generateDefaultNameExport()}.png`;
            $('#screenshotFilename').val(filename);
            $('#screenshotModal').modal('show');
            $('.select2-selection__rendered').css('margin-right', '0');

            hideInfoContent();
        });
    };
    const download = () => {
        const screenshot = document.getElementById('screenshot').getAttribute('data-url');
        const targetLink = document.createElement('a');
        if (screenshot) {
            const filename = $('#screenshotFilename').val();
            targetLink.setAttribute('download', filename);
            targetLink.href = screenshot;
        }
        hideInfoContent();
        return targetLink;
    };
    const copy = async (mainContent) => {
        $('.select2-selection__rendered').css('margin-right', '50px');
        modernScreenshot.domToPng(mainContent).then(async (dataUrl) => {
            $('.select2-selection__rendered').css('margin-right', '0');
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            if (askWritePermission) {
                setToClipboard(blob);
            }
            loadingHide();
            hideInfoContent();
        });
    };
    return {
        generator,
        download,
        copy,
    };
};

const captureImage = (mainContent) => {
    const currentPageName = window.location.pathname;
    try {
        if (colorScalePages.includes(objTitle[currentPageName].title)) {
            modernScreenShotCapture().generator(mainContent);
        } else {
            defaultCapture().generator(mainContent);
        }
    } catch (err) {
        defaultCapture().generator(mainContent);
    }
};

const downloadImage = () => {
    let targetLink;
    const currentPageName = window.location.pathname;
    try {
        if (colorScalePages.includes(objTitle[currentPageName].title)) {
            targetLink = modernScreenShotCapture().download();
        } else {
            targetLink = defaultCapture().download();
        }
        return targetLink;
    } catch (err) {
        return defaultCapture().download();
    }
};

// download image
const downloadScreenshot = async (el) => {
    isRemoveCrosshair = false;
    showLoadingIcon();
    const targetLink = downloadImage();
    addSettingContentInfor();
    setTimeout(() => {
        targetLink.click();
        $('#screenshotModal').modal('hide');
        showLoadingIcon();
        clearOldScreenShot();
    }, 3000);
};
