class PollingFrequencyOption {
    static DEFAULT_POLLING_FREQUENCY = {
        DEFAULT: 180,
        SNOWFLAKE: 3600,
        WEB_API: 0,
    };

    static POLLING_FREQUENCY_OPTION = {
        DEFAULT: [0, 3, 5, 10, 60, 1440],
        SNOWFLAKE: [0, 60, 1440],
        WEB_API: [0],
    };

    constructor(datasourceType, defaultFrequency) {
        this.dbsType = datasourceType === 'V2' ? 'CSV' : datasourceType;
        this._name = `${this.dbsType}pollingFreq`;
        this._id = `#${this.dbsType}pollingFreq`;
        this._jqueryEl = $(this._id);
        this.defaultFrequency = this.getDefaultPollingFrequency(defaultFrequency);
        this.setDefaultPollingFrequency();
        this.setOldPollingFrequencyValue();
        this.onChange();
    }

    setDefaultPollingFrequency() {
        this._jqueryEl.val(this.defaultFrequency / 60);
    }

    setOldPollingFrequencyValue() {
        this._jqueryEl.attr('old-value', this.defaultFrequency / 60);
    }

    getOldPollingFrequencyValue() {
        return Number(this._jqueryEl.attr('old-value')) * 60;
    }

    handleClickCancelPollingFrequency() {
        $(eles.withImport).prop('checked', false);
        $(eles.changeAllFreqSameDS).prop('checked', false);
        const dbsId = $(dbElements.pollingConfirmModal).attr('data_source_id');
        if (dbsId) {
            // cancel form db source list not from modal
            const select = $(`#ds_${dbsId}`).find('select.main-polling-frequency');
            const oldVal = select.attr('old-value');
            select.val(Number(oldVal));
        }
        this.setDefaultPollingFrequency(this.getOldPollingFrequencyValue());
    }

    static async handleClickOkPollingFrequency() {
        const dbsId = $(dbElements.pollingConfirmModal).attr('data_source_id');
        if (!dbsId) return;
        try {
            const pollingValue = Number($(dbElements.pollingConfirmModal).attr('polling_frequency'));
            const data = {
                polling_frequency: pollingValue == 0 ? null : pollingValue,
                data_source_id: Number($(dbElements.pollingConfirmModal).attr('data_source_id')),
                with_import: $(eles.withImport).prop('checked'),
                change_all_freq_same_ds: $(eles.changeAllFreqSameDS).prop('checked'),
            };
            const response = await fetchData('/ap/api/setting/update_polling_freq', JSON.stringify(data), 'POST');
            const dataSourceIds = response.flask_message.data_source_ids;
            const pollingFreqValue = data.polling_frequency / 60;
            const data_src_type = response.flask_message.data_src_type;

            dataSourceIds.forEach((dsId) => {
                $(`#ds_${dsId}`)
                    .find('select.main-polling-frequency')
                    .attr('old-value', data.polling_frequency / 60);

                const rowWithId = $(`tr[data-ds-id="${dsId}`);
                PollingFrequencyOption.updateOptionsPollingFre(rowWithId, data_src_type, dsId, pollingFreqValue);
            });

            showMessage(response.flask_message.message);
        } catch (e) {
            console.log(e);
            displayRegisterMessage('#alert-msg-db', e.responseJSON.flask_message);
        }
    }

    handleChangePollingFrequency() {
        $(csvResourceElements.withImportFlag).show();
        // remove all atr of polling-frequency-confirm-modal
        $(dbElements.pollingConfirmModal).removeAttr('data_source_id');
        $(dbElements.pollingConfirmModal).removeAttr('polling_frequency');
        const $checkbox = $('#changeAllFreqSameDSFlag');
        if ($checkbox.length > 0) {
            $checkbox.remove();
        }
        $(dbElements.pollingConfirmModal).modal('show');
    }

    onChange() {
        this._jqueryEl.off('change');
        this._jqueryEl.on('change', () => {
            this.handleChangePollingFrequency();
        });
    }

    genPollingFrequencyInfo() {
        const pollingFrequency = Number(this._jqueryEl.val()) * 60;
        const importFlg = $(eles.withImport).prop('checked');
        return {
            polling_frequency: pollingFrequency == 0 ? null : pollingFrequency,
            with_import: importFlg,
        };
    }

    getDefaultPollingFrequency(defaultFrequency) {
        if (defaultFrequency !== undefined) {
            return defaultFrequency == null ? 0 : defaultFrequency;
        } else {
            return PollingFrequencyOption.getValue(this.dbsType, PollingFrequencyOption.DEFAULT_POLLING_FREQUENCY);
        }
    }

    static getValue(dbsType, option) {
        const matchedKey = Object.keys(option).find((key) => dbsType.includes(key));
        return matchedKey ? option[matchedKey] : option.DEFAULT;
    }

    static getOptionByDbsType(dbsType, polling_frequency) {
        const defaultValue = [0, null].includes(polling_frequency) ? 0 : polling_frequency;
        const options = PollingFrequencyOption.getValue(dbsType, PollingFrequencyOption.POLLING_FREQUENCY_OPTION);
        const pollingTitle = {
            0: $('#i18nOnlyOnce').text(),
            3: $('#i18nOncePer3Minutes').text(),
            5: $('#i18nOncePer5Minutes').text(),
            10: $('#i18nOncePer10Minutes').text(),
            60: $('#i18nOncePerHour').text(),
            1440: $('#i18nOncePerDay').text(),
        };
        let optionsHtml = '';
        for (const option of options) {
            optionsHtml += ` 
                <option value="${option}" ${defaultValue == option ? 'selected' : ''}>
                    ${pollingTitle[option]}
                </option>`;
        }

        return optionsHtml;
    }

    static pollingOptionHtml(dbsType, polling_frequency, disabled = true) {
        return `
        <div className="w-100">
            <select
                type="select"
                name="${dbsType}pollingFreq"
                class="form-control main-polling-frequency"
                id="${dbsType}pollingFreq"
                ${is_authorized && !disabled ? '' : 'disabled'}
            >
               ${PollingFrequencyOption.getOptionByDbsType(dbsType, polling_frequency)}
            </select>
        </div>
        `;
    }

    static handleOnChangeMainPollingFrequency() {
        const i18nChangeAllFreq = $('#i18ChangeAllFreqSameDataSourceType').text();
        const changeAllFreqCheckboxHtml = `
             <div class="custom-control custom-checkbox mb-3" id="changeAllFreqSameDSFlag">
                  <input
                     type="checkbox"
                     class="custom-control-input"
                     id="changeAllFreqSameDS"
                     name="change-all-freq-same-data-source"
                  />
                  <label class="custom-control-label modal-inform" for="changeAllFreqSameDS">
                  ${i18nChangeAllFreq}
                  </label>
             </div>`;

        $('select.main-polling-frequency').off('change');
        $('select.main-polling-frequency').on('change', (e) => {
            // get dbs id
            const _this = $(e.currentTarget);
            const dbsId = _this.parents('tr').attr('data-ds-id');
            $(dbElements.pollingConfirmModal).attr('data_source_id', dbsId);
            $(dbElements.pollingConfirmModal).attr('polling_frequency', Number(_this.val()) * 60);

            //add checkbox changeAllFreqSameDS
            const $modalBody = $(dbElements.pollingConfirmModalBody);
            if ($('#changeAllFreqSameDSFlag').length === 0) {
                $modalBody.append(changeAllFreqCheckboxHtml);
            }

            if (dbsId) {
                $(eles.withImport).prop('checked', false);
                $(eles.changeAllFreqSameDS).prop('checked', false);
                $(dbElements.pollingConfirmModal).modal('show');
            }
        });
    }

    static updateOptionsPollingFre(currentDSTR, dbsType, dbsId, selectedValue) {
        const select = currentDSTR.find('select.main-polling-frequency');
        select.attr('disabled', !is_authorized);
        select.attr('old-value', selectedValue);
        const options = PollingFrequencyOption.getOptionByDbsType(dbsType, selectedValue);
        select.html(options);
    }
}
