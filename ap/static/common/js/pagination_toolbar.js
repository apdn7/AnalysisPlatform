/**
 * Render controls only; each caller retains ownership of its paging engine and data.
 */
const renderProcessPagination = (
    container,
    { page, pageSize, total, onPageChange, compact = false, pageSizeControl },
) => {
    const labels = document.getElementById('i18nPagination').dataset;
    const totalPages = Math.ceil(total / pageSize);
    const fragment = document.createDocumentFragment();
    container.classList.add('app-pagination');
    container.classList.toggle('app-pagination--compact', compact);

    const range = document.createElement('span');
    range.className = 'app-pagination__range';
    const start = total ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, total);
    if (compact) {
        for (const value of [start, end]) {
            const line = document.createElement('span');
            line.textContent = String(value);
            range.append(line);
        }
        range.style.minWidth = `${Math.max(5, String(total).length)}ch`;
        range.title = `${start}-${end} / ${total}`;
    } else {
        range.textContent = `${start}-${end} / ${total}`;
    }
    range.setAttribute('aria-live', 'polite');
    fragment.append(range);
    if (pageSizeControl) {
        pageSizeControl.classList.add('app-pagination__page-size');
        fragment.append(pageSizeControl);
    }

    const pages = document.createElement('nav');
    pages.className = 'app-pagination__pages';
    pages.setAttribute('aria-label', labels.pagination);
    const changePage = (nextPage) => {
        if (Number.isInteger(nextPage) && nextPage >= 1 && nextPage <= totalPages && nextPage !== page) {
            onPageChange(nextPage);
        }
    };
    const addButton = (text, target, disabled, label, iconClass) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'app-pagination__button';
        if (iconClass) {
            const icon = document.createElement('i');
            icon.className = `fa ${iconClass}`;
            icon.setAttribute('aria-hidden', 'true');
            button.append(icon);
        } else {
            button.textContent = text;
        }
        button.disabled = disabled;
        if (label) button.setAttribute('aria-label', label);
        else if (target === page) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }
        if (compact && !label) button.style.width = `${Math.max(5, String(totalPages).length)}ch`;
        button.onclick = () => changePage(target);
        pages.append(button);
    };
    addButton('', 1, !totalPages || page <= 1, labels.first, 'fa-step-backward');
    addButton('<', page - 1, !totalPages || page <= 1, labels.previous);
    const visible = new Set(compact ? [] : [1, totalPages]);
    if (compact) {
        const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
        for (let value = firstPage; value <= Math.min(firstPage + 4, totalPages); value++) {
            visible.add(value);
        }
    } else {
        for (let value = page - 1; value <= page + 1; value++) {
            if (value >= 1 && value <= totalPages) visible.add(value);
        }
    }
    let previous = 0;
    for (const value of [...visible].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b)) {
        if (previous && value - previous > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'app-pagination__ellipsis';
            ellipsis.textContent = '...';
            pages.append(ellipsis);
        }
        addButton(String(value), value, false);
        previous = value;
    }
    addButton('>', page + 1, !totalPages || page >= totalPages, labels.next);
    addButton('', totalPages, !totalPages || page >= totalPages, labels.last, 'fa-step-forward');
    fragment.append(pages);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'app-pagination__jump form-control';
    input.min = '1';
    input.max = String(Math.max(1, totalPages));
    input.step = '1';
    input.value = String(totalPages ? page : 1);
    input.disabled = !totalPages;
    input.setAttribute('aria-label', labels.page);
    const jump = () => {
        const target = Number(input.value);
        if (compact && !input.disabled && Number.isInteger(target) && target > totalPages) {
            input.value = String(totalPages);
        }
        if (!input.disabled && input.value !== '' && input.reportValidity()) {
            changePage(Number(input.value));
        }
    };
    input.onkeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            jump();
        }
    };
    if (compact) input.onblur = jump;
    fragment.append(input);
    if (compact) {
        const totalLabel = document.createElement('span');
        totalLabel.className = 'app-pagination__total-pages';
        totalLabel.textContent = `/${totalPages}`;
        fragment.append(totalLabel);
    } else {
        const jumpButton = document.createElement('button');
        jumpButton.type = 'button';
        jumpButton.className = 'app-pagination__jump-button btn simple-btn';
        jumpButton.textContent = labels.jump;
        jumpButton.disabled = !totalPages;
        jumpButton.onclick = jump;
        fragment.append(jumpButton);
    }
    container.replaceChildren(fragment);
};
