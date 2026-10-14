let isOpenNewTab = false;
document.getElementById('content').addEventListener('contextmenu', (event) => event.preventDefault());
const setOpenTab = () => (isOpenNewTab = true);
const redirectPage = (tile) => {
    // mark as call page from tile interface, do not apply user setting
    useTileInterface().set();
    const target = $(tile).find('.link-address').attr('href');
    if (target) {
        if (isOpenNewTab) {
            isOpenNewTab = false;
            openNewTab(target);
        } else {
            window.location.assign(target);
        }
    }
};
const originalHTMLMap = new WeakMap();
document.querySelectorAll('.search-target').forEach((parent) => {
    parent.querySelectorAll('h3, li, p, b').forEach((child) => {
        originalHTMLMap.set(child, child.innerHTML);
    });
});
function highlightMatchPreserve(element, searchValue) {
    if (!searchValue) {
        return;
    }
    const regex = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
        nodes.push(node);
    }
    nodes.forEach((textNode) => {
        const text = textNode.nodeValue;
        let match,
            lastIndex = 0;
        let frag = document.createDocumentFragment();
        let hasMatch = false;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            hasMatch = true;
            if (match.index > lastIndex) {
                frag.appendChild(
                    document.createTextNode(text.substring(lastIndex, match.index).replace(/ /g, '\u00A0')),
                );
            }
            const span = document.createElement('span');
            span.className = 'highlight-search';
            span.textContent = match[0];
            frag.appendChild(span);
            lastIndex = regex.lastIndex;
        }
        if (hasMatch) {
            if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.substring(lastIndex).replace(/ /g, '\u00A0')));
            }
            textNode.parentNode.replaceChild(frag, textNode);
        }
    });
}

function filterParents() {
    const searchValue = document.getElementById('usage-search').value.trim().toLowerCase();
    document.querySelectorAll('.search-target').forEach((parent) => {
        // Get all descendant h3 and li elements
        const children = parent.querySelectorAll('h3, li, p, b');
        // Check if any child contains the search text
        let hasMatch = false;
        children.forEach((child) => {
            child.innerHTML = originalHTMLMap.get(child);
            if (child.innerText.toLowerCase().includes(searchValue)) {
                hasMatch = true;
                if (child.localName !== 'h3') {
                    collapsingTiles(false);
                }
                highlightMatchPreserve(child, searchValue);
            }
        });
        // Show or hide the parent based on match
        if (searchValue === '' || hasMatch) {
            parent.style.display = '';
        } else {
            parent.style.display = 'none';
        }
    });
}
const debouncedFilterParents = debounce(filterParents, 500);
$(document).ready(() => {
    const currentPaths = window.location.pathname.split('/');
    const tileName = currentPaths[currentPaths.length - 1] || 'dn7';
    $(`a.tile-menus[data-tile="#${tileName}"]`).addClass('active');
    handleLoadSettingBtns();
    const searchUsage = document.getElementById('usage-search');
    if (searchUsage) {
        $(searchUsage).off('input').on('input', debouncedFilterParents);
    }
});
