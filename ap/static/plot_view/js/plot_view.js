$(() => {
    $('.clipboard').tooltip({
        trigger: 'click',
        placement: 'bottom',
    });

    const clipboard = new ClipboardJS('.clipboard');

    clipboard.on('success', (e) => {
        setTooltip(e.trigger, 'Copied!');
    });

    clipboard.on('error', (e) => {
        setTooltip(e.trigger, 'Failed!');
    });
});
