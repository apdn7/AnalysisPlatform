let isOpenNewTab = false;
document
    .getElementById('content')
    .addEventListener('contextmenu', (event) => event.preventDefault());
const setOpenTab = () => (isOpenNewTab = true);
const redirectPage = (tile) => {
    // mark as call page from tile interface, do not apply user setting
    useTileInterface().set();
    const target = $(tile).find('.link-address').attr('href');
    if (target) {
        if (isOpenNewTab) {
            isOpenNewTab = false;
            window.open(target);
        } else {
            window.location.assign(target);
        }
    }
};

$(document).ready(() => {
    const currentPaths = window.location.pathname.split('/');
    const tileName = currentPaths[currentPaths.length - 1] || 'dn7';
    $(`a.tile-menus[data-tile="#${tileName}"]`).addClass('active');

    handleLoadSettingBtns();
});
