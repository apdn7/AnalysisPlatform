/**
 * @file Contains common functions that use for data-finder
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

class DataFinderService {
    static addZeroToNumber(number) {
        return number.toString().length < 2 ? `0${number}` : number;
    }

    static getDateObject(date, isCurrentMonth = false) {
        if (_.isString(date)) {
            date = moment(date);
        }
        return {
            date: date.format(DATE_FMT),
            dayOfMonth: date.date(),
            isCurrentMonth,
            dayOfWeeks: date.day(),
            weekNo: date.isoWeek(),
            month: date.month() + 1,
            year: date.year(),
        };
    }

    static getDefaultDateTime() {
        const today = moment();
        return {
            year: today.year(),
            month: today.month() + 1,
            dayOfMonth: today.date(),
            date: today.format(DATE_FMT),
            now: today.format('HH:MM'),
            firstDayOfMonth: `${today.year()}-${today.month() + 1}-01`,
        };
    }

    /**
     * @description Call API to get data count of specify process
     * @param processId
     * @param from
     * @param to
     * @param type
     * @param timeout
     * @return {Promise<unknown>} Data count response
     */
    static async getDataCountByType(processId, from, to, type = calenderTypes.year, timeout = null) {
        if (!processId) {
            return {};
        }
        const url = '/ap/api/common/data_count';
        const data = {
            process_id: processId,
            type,
            from,
            to,
            timezone: detectLocalTimezone(),
        };

        // In Backup & Restore Transaction Data Modal, if it is at restore tab, get record count in backup files
        const flagBKRT = /** HTMLInputElement */ document.getElementById('idFlagBKRT');
        if (flagBKRT) {
            data['count_in_file'] = flagBKRT.value === 'restoreTab';
        }

        const option = timeout ? { timeout } : {};
        const res = await fetchData(url, JSON.stringify(data), 'POST', option);
        return res;
    }

    /**
     * @description Get all date time range of process
     * @param processId
     * @return {Object} { from: '', to: '' }
     *
     */
    static async getMinMaxRangeOfData(processId = null) {
        if (!processId) {
            return {};
        }
        const api = `/ap/api/common/full_data_range/${processId}`;
        const response = await fetchData(api, {}, 'GET');
        return response;
    }

    /**
     * @description Get data count of input period or process
     * @param processId
     * @param from UTC
     * @param to UTC
     * @return { count : ''}
     */

    static async getDataCountOfRange(processId, from, to) {
        if (!processId) {
            return {};
        }

        const api = '/ap/api/common/data_count_in_range';
        const data = {
            process_id: processId,
            from: from,
            to: to,
        };

        const response = await fetchData(api, JSON.stringify(data), 'POST');
        return response;
    }

    /**
     * @description Get color to show color of data count
     * @param max
     * @param count
     * @return {string} the color
     */

    static getColor(max, count) {
        const per = (count / max) * 100;
        let newPer = per;
        if (per > 0 && per <= 15) {
            newPer = 1;
        }

        if (per > 15 && per <= 35) {
            newPer = 20;
        }

        if (per > 35 && per <= 50) {
            newPer = 40;
        }

        if (per > 50 && per <= 65) {
            newPer = 60;
        }

        if (per > 65 && per <= 80) {
            newPer = 80;
        }

        if (per > 80 && per <= 100) {
            newPer = 100;
        }

        return colorDic[newPer];
    }

    /**
     * Add cache function to reload data count for Backup&Restore Modal
     * @param {function(): void} func - get data count function
     * @param {?boolean} isTableFrom - true: is left table, false: is right table, null: only one table
     */
    static addCacheFunctionForBackupRestoreModal(func, isTableFrom = null) {
        // Cache function for Backup&Restore Modal
        const backupAndRestoreModal = /** @type{HTMLDivElement} */ document.getElementById('backupAndRestoreModal');
        if (backupAndRestoreModal) {
            if (isTableFrom == null) {
                backupAndRestoreModal.cacheFunction = func;
            } else {
                if (backupAndRestoreModal.cacheFunction == null || _.isFunction(backupAndRestoreModal.cacheFunction)) {
                    backupAndRestoreModal.cacheFunction = {};
                }

                const key = isTableFrom ? 'tableFrom' : 'tableTo';
                backupAndRestoreModal.cacheFunction[key] = func;
            }
        }
    }

    /**
     * @description Set Process Id of mainDataFinder of show graph page
     * @return {Promise<void>}
     */
    static async setProcessID() {
        const compareType = $('select[name=compareType]').val();
        const btnParent = compareType ? $(`#for-${compareType}`) : null;
        processId = getFirstSelectedProc();
        if (mainDataFinder) {
            mainDataFinder.setCalendarProcessId(processId);
            DataFinder.setDataFinderObj(mainDataFinder.id, mainDataFinder.processId);
            mainDataFinder.showDataFinderButton(processId, btnParent);
        }

        if (processId && typeof procConfigs !== 'undefined') {
            if (procConfigs[processId] && procConfigs[processId].is_use_dummy_datetime) {
                await changeDefaultIndexOrdering();
            } else {
                updateXOption(false);
            }
        }
    }
}
