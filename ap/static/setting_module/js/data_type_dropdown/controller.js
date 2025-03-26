/**
 * @file Manages the configuration settings for data type dropdown list.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

class DataTypeDropdown_Controller extends DataTypeDropdown_Core {
    /**
     * Inject all Events for dropdowns and options
     * @param {HTMLDivElement | HTMLDivElement[] | NodeListOf<HTMLDivElement>} dataTypeDropdownElement - an HTML object of dropdown or a list of one
     */
    static injectEvent(dataTypeDropdownElement) {
        let dropdownElements = [];
        if (['Array', 'NodeList'].includes(dataTypeDropdownElement.constructor.name)) {
            dropdownElements = dataTypeDropdownElement;
        } else {
            dropdownElements.push(dataTypeDropdownElement);
        }

        dropdownElements.forEach((dropdownElement) => {
            this.addEvents(dropdownElement);
            this.setValueForItems(dropdownElement);
        });
    }
}
