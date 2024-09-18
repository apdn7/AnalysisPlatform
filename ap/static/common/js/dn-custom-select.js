const initCustomSelect = () => {
    // dn-custom-select
    // dn-custom-select--select
    // dn-custom-select--select--list
    // select-hide
    const customSelects = $('.dn-custom-select');
    customSelects.each((i, el) => {
        const customSelect = $(el);
        const select = customSelect.find('select');
        const selectClass = $(select[0]).attr('class');
        const selectOption = select.find('option');
        const selectedOption = select.find('option:selected');
        const selectedVal = select.val();

        const selectedDiv = `
            <div class="dn-custom-select--select ${selectClass}">${selectedOption.text()}</div>
        `;
        let options = '';
        selectOption.each((i, op) => {
            const option = $(op);
            const value = option.val();
            const text = option.text();
            const title = option.attr('title');
            options += `
                <div class="dn-custom-select--select--list--item" data-value="${value}">
                    <span class="${title ? 'underline-item' : ''}" ${title ? `title="${title}"` : ''}>${text}</span>
                </div>
            `;
        });

        const selectList = `
            <div class="dn-custom-select--select--list select-hide">
                ${options}
            </div>
        `;

        customSelect.append(selectedDiv);
        customSelect.append(selectList);
        // add selected-item in item
        $('.dn-custom-select--select--list--item').each((i, el) => {
            if ($(el).attr('data-value') === selectedVal) {
                $(el).addClass('selected-item');
            }
        });
        customSelect.find('.dn-custom-select--select').off('click');
        customSelect.find('.dn-custom-select--select').on('click', (e) => {
            if (
                customSelect
                    .find('.dn-custom-select--select--list')
                    .hasClass('select-hide')
            ) {
                customSelect
                    .find('.dn-custom-select--select--list')
                    .removeClass('select-hide');
            } else {
                customSelect
                    .find('.dn-custom-select--select--list')
                    .addClass('select-hide');
            }
        });
        customSelect.find('.dn-custom-select--select--list').off('click');
        customSelect
            .find('.dn-custom-select--select--list')
            .on('click', (e) => {
                let item = e.target.closest(
                    '.dn-custom-select--select--list--item',
                );
                $('.dn-custom-select--select--list--item').removeClass(
                    'selected-item',
                );
                if (!item) return;
                item = $(item);
                const value = item.attr('data-value');
                select.val(value).trigger('change');
                item.addClass('selected-item');
                customSelect
                    .find('.dn-custom-select--select')
                    .text(item.text());

                // hide
                customSelect
                    .find('.dn-custom-select--select--list')
                    .addClass('select-hide');
            });

        select.off('change');
        select.on('change', (e) => {
            resetCustomSelect($(e.currentTarget));
        });
    });
};

const resetCustomSelect = (selectEL) => {
    const customSelect = selectEL.parent();
    const value = selectEL.val();
    const selectedOption = selectEL.find('option:selected');
    customSelect
        .find('.dn-custom-select--select--list--item')
        .removeClass('selected-item');
    customSelect.find('.dn-custom-select--select--list--item').each((i, el) => {
        if ($(el).attr('data-value') === value) {
            $(el).addClass('selected-item');
        }
    });
    customSelect.find('.dn-custom-select--select').text(selectedOption.text());
};
