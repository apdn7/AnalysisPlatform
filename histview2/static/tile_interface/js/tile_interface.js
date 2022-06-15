// eslint-disable-next-line no-unused-vars
let isOpenNewTab = false;
document.addEventListener('contextmenu', event => event.preventDefault());
const setOpenTab = () => isOpenNewTab = true;
const redirectPage = (tile) => {
    // mark as call page from tile interface, do not apply user setting
    useTileInterface().set();
    const target = $(tile).find('.link-address').attr('href');
    if (target) {
        if (isOpenNewTab) {
            isOpenNewTab = false;
            window.open(target);
        } else {
            window.location.replace(target);
        }
    }
};

$(document).ready(() => {
    const currentPaths = window.location.pathname.split('/');
    const tileName = currentPaths[currentPaths.length - 1] || 'dn7';
    $(`a.tile-menus[data-tile="#${tileName}"]`).addClass('active');

    // show only load button and hide bookmark button
    $('.load-setting-tile-page').show();
    $('.load-setting-common').hide();
});
