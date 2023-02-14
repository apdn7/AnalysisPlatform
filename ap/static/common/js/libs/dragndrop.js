const prepareFileSetting = (file, dragAreaCls) => {
    if (file) {
        const fileSize = file.size / 1024 / 1024; // size: MB
        if (fileSize > 10) {
            const fileSizeLimitationMsg = $('#i18nFileSizeMsg').text();
            showToastrMsg(fileSizeLimitationMsg, MESSAGE_LEVEL.ERROR);
            return;
        }
        // eslint-disable-next-line no-undef
        settingFile = file;
        // $('input#fileUrl').val(file.name);
        $(`${dragAreaCls} .box__input`).hide();
        $(`${dragAreaCls} .box__success span`).text(file.name);
        $(`${dragAreaCls} .box__success`).show();
    }
};

const genTriggerFileSetting = (dragAreaCls, selectFileBtnId, selectFileInputId) => {
    const $advancedForm = $(dragAreaCls);
    const $selectFileBtn = $(selectFileBtnId);
    const $selectFileInput = $(selectFileInputId);
    $advancedForm.on('drag dragstart dragend dragover dragenter dragleave drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }).on('dragover dragenter', () => {
        $advancedForm.addClass('is-dragover');
    }).on('dragleave dragend drop', () => {
        $advancedForm.removeClass('is-dragover');
    }).on('drop', (e) => {
        const droppedFiles = e.originalEvent.dataTransfer.files[0];
        prepareFileSetting(droppedFiles, dragAreaCls);
    });

    $selectFileBtn.on('click', () => {
        $selectFileInput.click();
    });

    $selectFileInput.on('change', function () {
        const file = this.files[0];
        prepareFileSetting(file, dragAreaCls);
    });
};
