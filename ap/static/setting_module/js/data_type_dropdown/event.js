/**
 * @file Contains core functions that serve for data type dropdown.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Class manages all events of data type dropdown menu control
 */
class DataTypeDropdown_Event extends DataTypeDropdown_Helper {
    /**
     * addEvents
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static addEvents(dataTypeDropdownElement) {
        this.onClickEventShowDataTypeModal(dataTypeDropdownElement);
        this.onClickEventShowSubMenu(dataTypeDropdownElement);
        this.onClickEventHandleSelectItem(dataTypeDropdownElement);
        this.onFocusEventHandleHoverItem(dataTypeDropdownElement);
        this.onClickEventHandleCopyToAllBelow(dataTypeDropdownElement);
        this.onClickEventHandleCopyToFilteredItem(dataTypeDropdownElement);
    }

    /**
     * onClick Event Handle Select Item
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static onClickEventHandleSelectItem(dataTypeDropdownElement) {
        const enableLiElements =
            /** @type NodeListOf<HTMLLIElement> */
            dataTypeDropdownElement.querySelectorAll('ul li.dataTypeSelection');
        $(enableLiElements)
            .off('click')
            .on(
                'click',
                DataTypeDropdown_Controller.eventWrapper((e) => {
                    DataTypeDropdown_Controller.onClickDataType(e);
                    DataTypeDropdown_Controller.hideAllDropdownMenu();
                }),
            );
    }

    /**
     * onFocus Event Handle Hover Item
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static onFocusEventHandleHoverItem(dataTypeDropdownElement) {
        const enableLiElements =
            /** @type NodeListOf<HTMLLIElement> */
            dataTypeDropdownElement.querySelectorAll('ul li.dataTypeSelection');
        $(enableLiElements)
            .off('focus')
            .on(
                'focus',
                DataTypeDropdown_Controller.eventWrapper((e) => {
                    DataTypeDropdown_Controller.onFocusDataType(e);
                    DataTypeDropdown_Controller.hideAllDropdownMenu();
                }),
            );
    }

    /**
     * onClick Event Handle button CopyToAllBelow
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static onClickEventHandleCopyToAllBelow(dataTypeDropdownElement) {
        const copyToAllBelowLiElements =
            /** @type NodeListOf<HTMLLIElement> */
            dataTypeDropdownElement.querySelector('ul li.copyToAllBelow');
        $(copyToAllBelowLiElements)
            .off('click')
            .on(
                'click',
                DataTypeDropdown_Controller.eventWrapper((e) => {
                    DataTypeDropdown_Controller.handleCopyToAllBelow(e);
                    DataTypeDropdown_Controller.hideAllDropdownMenu();
                }),
            );
    }

    /**
     * onClick Event Handle button CopyToFilteredItem
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static onClickEventHandleCopyToFilteredItem(dataTypeDropdownElement) {
        const copyToFilteredItemElements =
            /** @type NodeListOf<HTMLLIElement> */
            dataTypeDropdownElement.querySelector('ul li.copyToFiltered');
        $(copyToFilteredItemElements)
            .off('click')
            .on(
                'click',
                DataTypeDropdown_Controller.eventWrapper((e) => {
                    DataTypeDropdown_Controller.handleCopyToFiltered(e);
                    DataTypeDropdown_Controller.hideAllDropdownMenu();
                }),
            );
    }

    /**
     * Show Data Type Modal
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static onClickEventShowDataTypeModal(dataTypeDropdownElement) {
        const buttonElement = dataTypeDropdownElement.querySelector('button');
        $(buttonElement)
            .off('click')
            .on(
                'click',
                DataTypeDropdown_Controller.eventWrapper(function (e) {
                    const dataTypeDropdownElement = /** @type HTMLDivElement */ e.currentTarget.closest(
                        'div.config-data-type-dropdown',
                    );
                    DataTypeDropdown_Controller.init(dataTypeDropdownElement);
                    DataTypeDropdown_Controller.hideAllDropdownMenu();

                    // Calculate position to show dropdown menu
                    const dropdown = $(e.currentTarget).siblings('.data-type-selection');
                    const dropdownHeight = dropdown.height() / 2;
                    const windowHeight = $(window).height() - 50;
                    const left = e.clientX;
                    let top = e.clientY;
                    if (top + dropdownHeight > windowHeight) {
                        top -= top + dropdownHeight - windowHeight;
                    }
                    dropdown.css({
                        position: 'fixed',
                        top: top,
                        left: left,
                        display: 'flex',
                        zIndex: '99999',
                    });
                }),
            );
    }

    /**
     * onClick Event Show Sub Menu
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static onClickEventShowSubMenu(dataTypeDropdownElement) {
        const liElements =
            /** @type NodeListOf<HTMLLIElement> */
            dataTypeDropdownElement.querySelectorAll('li.dropdown-submenu');
        $(liElements)
            .off()
            .on('mouseenter', DataTypeDropdown_Controller.eventWrapper(DataTypeDropdown_Controller.toggleSubMenu))
            .on('mouseleave', DataTypeDropdown_Controller.eventWrapper(DataTypeDropdown_Controller.toggleSubMenu));
    }

    /**
     * Toggle Sub Menu
     * @param {Event} event
     */
    static toggleSubMenu(event) {
        $(event.currentTarget).find('>ul').toggle();
        event.stopPropagation();
        event.preventDefault();
    }

    /**
     * item Click
     * @param {Event} event
     */
    static itemClick(event) {
        const liElement = /** @type HTMLLIElement */ event.currentTarget;
        const selectValue = liElement.getAttribute('raw-data-type');
        const selectText = liElement.textContent;
        const dataTypeDropdownElement =
            /** @type HTMLDivElement */
            liElement.closest('div.config-data-type-dropdown');

        this.enableDisableFormatText(dataTypeDropdownElement, selectValue);
        this.parseDataType(dataTypeDropdownElement, event.currentTarget);
        this.setValueToShowValueElement(dataTypeDropdownElement, selectValue, selectText, '');
        this.hideAllDropdownMenu();
    }
}
