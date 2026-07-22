import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';

import Periodic from '@/pages/export-config/components/Periodic.tsx';
import { triggerNativeChange } from '@/shared/utils/helpers.ts';

export default function ExportSchedules({
    formValue,
    setFormValue,
    errors,
    setErrors,
    datetimeRangeRef,
    dateRangeRef,
    runTimeList,
    setRunTimeList,
    periodicStartDateInputRef,
}) {
    const { t } = useTranslation();
    const showDefault = formValue.export_config.type === 'once';
    useEffect(() => {
        initializeDateTimePicker();
        initializeDateTimeRangePicker();
        mainDataFinder?.onClickDataFinderButton();
    }, []);

    useEffect(() => {
        if (formValue.export_config.type !== 'once') return;
        if (!datetimeRangeRef.current) return;
        const { export_from, export_to } = formValue.export_config;
        if (!export_from) return;

        const newValue = export_to ? `${export_from}${DATETIME_PICKER_SEPARATOR}${export_to}` : export_from;

        // trigger change to update datetime range in GUI
        triggerNativeChange(datetimeRangeRef.current, newValue);
    }, [formValue.export_config.export_from, formValue.export_config.export_to]);

    const handleOnChangeRadio = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newType = e.target.value;
        setFormValue((prev) => ({
            ...prev,
            export_config: {
                ...prev.export_config,
                type: newType,
            },
            ...(newType === 'periodic' &&
                !prev.export_periodic?.start_time && {
                    export_periodic: {
                        interval_unit: 'day',
                        interval_value: 1,
                        start_time: dayjs().format('YYYY-MM-DD HH:mm'),
                    },
                }),
        }));
    };

    return (
        <div className="card-body table-bordered graph-navi" id="srtPrc">
            <div className="row">
                <div className="col-xl-2 col-3">
                    <div className="d-flex justify-content-between">
                        <label className="col-form-label label-left">
                            <span className="hint-text section-label">{t('Export Schedule')}</span>
                        </label>
                    </div>
                </div>
                <div className="col-xl-10 col-9">
                    <div className="col-12 col-xl-6 col-lg-12 col-md-12 col-sm-12 p-1">
                        <div className="export-schedules">
                            <div className="d-flex">
                                <div className="custom-control custom-radio grp-height-align mr-lg-5 mr-3">
                                    <input
                                        type="radio"
                                        name="traceTime"
                                        onChange={handleOnChangeRadio}
                                        className="custom-control-input commonClass"
                                        id={`radioDefaultInterval`}
                                        value="once"
                                        checked={showDefault}
                                    />
                                    <label
                                        className="custom-control-label label-left text-nowrap"
                                        htmlFor={`radioDefaultInterval`}
                                    >
                                        <span className="sub-label">{t('Single')}</span>
                                    </label>
                                </div>
                                <div className="custom-control custom-radio grp-height-align mr-lg-5 mr-3">
                                    <input
                                        type="radio"
                                        name="traceTime"
                                        onChange={handleOnChangeRadio}
                                        className="custom-control-input"
                                        id={`radioPeriodic`}
                                        value="periodic"
                                        checked={!showDefault}
                                    />
                                    <label
                                        className="custom-control-label label-left text-nowrap"
                                        htmlFor={`radioPeriodic`}
                                    >
                                        <span className="sub-label">{t('Periodic')}</span>
                                    </label>
                                </div>
                                <div
                                    className="position-relative flex-grow-1"
                                    style={{ display: showDefault ? 'block' : 'none' }}
                                >
                                    <div className="position-relative">
                                        <input
                                            id="datetimeRangePickerOnce"
                                            name="DATETIME_RANGE_PICKER"
                                            type="text"
                                            ref={datetimeRangeRef}
                                            className="DATETIME_RANGE_PICKER datetimepicker form-control"
                                            is-show-time-picker="True"
                                            is-set-default-value="True"
                                            is-show-recent-dates="True"
                                            autoComplete="off"
                                        />
                                        <button
                                            type="button"
                                            name="dataFinderBtn"
                                            style={{
                                                position: 'absolute',
                                                top: '3px',
                                                right: '3px',
                                                display: 'none',
                                            }}
                                            className="btn btn-sm btn-primary"
                                        >
                                            Data finder
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: showDefault ? 'none' : 'block' }}>
                                    <Periodic
                                        formValue={formValue}
                                        setFormValue={setFormValue}
                                        errors={errors}
                                        setErrors={setErrors}
                                        daterangeRef={dateRangeRef}
                                        runTimeList={runTimeList}
                                        setRunTimeList={setRunTimeList}
                                        periodicStartDateInputRef={periodicStartDateInputRef}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
