/**
 * @file Manages showing data of columns that cannot be converted to other data type.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 */

/**
 * A class to manage show information of Error cast data type
 */
class FailedCastDataModal {
    /**
     * @type object
     * A dictionary that contains all function event of all elements
     */
    #Events;

    /**
     * A dictionary contains all element id of modal
     * @type {{columnsBox: string, btnOk: string, modal: string, alertFailedCaseDataErrorDiv: string, alertFailedCaseDataErrorMsg: string}}
     */
    static ElementIds = {
        modal: 'failedCastDataModal',
        btnOk: 'btnOKFailedCastDataModal',
        columnsBox: 'columnsBox',
        alertFailedCaseDataErrorDiv: 'alertFailedCaseDataErrorDiv',
        alertFailedCaseDataErrorMsg: 'alertFailedCaseDataErrorMsg',
    };

    constructor() {
        this.Elements = {};
        for (const [key, id] of Object.entries(FailedCastDataModal.ElementIds)) {
            Object.defineProperty(this.Elements, key, {
                get: function () {
                    return document.getElementById(id);
                },
            });
        }

        this.#Events = {
            btnOk: function (event) {
                $(event.currentTarget).closest(`#${FailedCastDataModal.ElementIds.modal}`).modal('hide');
            },
        };
    }

    /**
     * Initialize modal and generate full layout of it
     * @param {object} data - a dictionary contains all columns & un-converted data
     * @param errorMessage - a string with error content
     */
    init(data, errorMessage = '') {
        this.Elements.alertFailedCaseDataErrorMsg.textContent = errorMessage;
        this.Elements.alertFailedCaseDataErrorDiv.style.display = errorMessage ? 'block' : 'none';

        this.Elements.columnsBox.innerHTML = this.#generateHTML(data);
        this.#injectEvents();
    }

    /**
     * Show modal
     */
    show() {
        $(this.Elements.modal).modal('show');
    }

    /**
     * Generate a HTML that contains all columns & un-converted data
     * @param {object} data
     * @return {string} a string HTML that contains all columns & un-converted data
     */
    #generateHTML(data) {
        let html = '';
        for (const [column_id, dataDict] of Object.entries(data)) {
            const column = dataDict.detail;
            const dataList = dataDict.data;
            html += `<div class="d-flex flex-column filter-data">
\t<div class="column-name">
\t\t<span class="d-inline-block" title="${column.shown_name}">${column.shown_name}</span>
\t</div>
\t<div id="div_failed_cast_value_${column_id}" class="column-datas active">`;

            let valuesHTML = '';
            dataList.forEach((value) => (valuesHTML += this.#generateValueHTML(value)));

            html += valuesHTML;
            html += `\t</div>
</div>`;
        }

        return html;
    }

    /**
     * Generate html that contain input value
     * @param {string} value - A string value
     * @return {string} a string HTML
     */
    #generateValueHTML(value) {
        return `\t\t<div class="p-1 list-group-item">
\t\t\t<span class="custom-control-label">${value}</span>
\t\t</div>`;
    }

    /**
     * Add event to related elements on modal
     */
    #injectEvents() {
        this.Elements.btnOk.removeEventListener('click', this.#Events.btnOk, false);
        this.Elements.btnOk.addEventListener('click', this.#Events.btnOk);
    }
}
