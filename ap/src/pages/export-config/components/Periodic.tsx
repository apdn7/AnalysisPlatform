import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ExportPeriodic } from '@/pages/export-config/components/ExportConfig.tsx';
import { exportConfigService } from '@/services/exportConfig.ts';
import Input from '@/shared/components/ui/Input.tsx';
import Select from '@/shared/components/ui/Select.tsx';
import { debounce, useDebounce } from '@/shared/hooks/useDebounce.ts';
import { EXPORT_CONFIG_ERROR_MESSAGES } from '@/shared/utils/errors.ts';
import { convertUtcToLocal, triggerNativeChange } from '@/shared/utils/helpers.ts';
import type { ValidateExportConfig, ValidationResult } from '@/shared/utils/validation.ts';

import './ExportConfig.scss';

const PERIOD_OPTION = [
    {
        value: 'day',
        text: 'PeriodicDay',
    },
    {
        value: 'hour',
        text: 'PeriodicHour',
    },
    {
        value: 'minute',
        text: 'PeriodicMin',
    },
];

const DEFAULT_SCHEDULER_ERROR = {
    internal_value: { isValid: true, message: undefined },
    trigger_min: { isValid: true, message: undefined },
    trigger_hour: { isValid: true, message: undefined },
};

export default function Periodic({
    formValue,
    setFormValue,
    daterangeRef,
    runTimeList,
    errors,
    setErrors,
    setRunTimeList,
    periodicStartDateInputRef,
}) {
    const { t } = useTranslation();
    const handleOnChangeType = (e: ChangeEvent<HTMLSelectElement>) => {
        const updatedPeriodic = {
            ...formValue.export_periodic,
            interval_unit: e.target.value,
        };
        setFormValue((prev) => ({
            ...prev,
            export_periodic: updatedPeriodic,
        }));
        updatedPeriodic['client_timezone'] = formValue.export_config.client_timezone;
        debounce(getPreviewScheduler(updatedPeriodic), 1000);
    };

    const onChangeIntervalValue = async (key, e) => {
        let value = e.target.value;
        value = value ? Number(value) : value;
        const updatedPeriodic = {
            ...formValue.export_periodic,
            interval_value: value,
        };
        setFormValue((prev) => ({
            ...prev,
            export_periodic: updatedPeriodic,
        }));

        if (!value) {
            setErrors((prev: ValidateExportConfig<ValidationResult>) => ({
                ...(prev || {}),
                [key]: { isValid: false, message: EXPORT_CONFIG_ERROR_MESSAGES.REQUIRED_FIELD },
            }));
        } else {
            if (Object.keys(errors).includes(key) && value) {
                setErrors((prev: ValidateExportConfig<ValidationResult>) => ({
                    ...(prev || {}),
                    [key]: { isValid: true, message: undefined },
                }));
            }
            updatedPeriodic['client_timezone'] = formValue.export_config.client_timezone;
            debounce(getPreviewScheduler(updatedPeriodic), 1000);
        }
    };

    useEffect(() => {
        initializeDateTimePicker();
        mainDataFinder?.onClickDataFinderButton();
    }, []);

    const getPreviewScheduler = async (exportPeriodic: ExportPeriodic) => {
        try {
            const res = await exportConfigService.previewScheduler(exportPeriodic);
            const runTimeListLocal = res.data.map((time: string) => convertUtcToLocal(time, 'YYYY-MM-DD HH:mm'));
            setRunTimeList(runTimeListLocal);
            setErrors((prev) => ({
                ...prev,
                ...DEFAULT_SCHEDULER_ERROR,
            }));
        } catch (e) {
            const err = Object.fromEntries(
                e.errors.map((key: string) => [key, { isValid: false, message: undefined }]),
            );
            setRunTimeList([]);
            setErrors((prev) => ({
                ...prev,
                ...DEFAULT_SCHEDULER_ERROR,
                ...err,
            }));
        }
    };

    useEffect(() => {
        if (formValue.export_config.type !== 'periodic') return;
        if (!daterangeRef.current) return;
        const $el = $(daterangeRef.current);

        // get (read only) picker from jQuery (necessary evil): okay
        const picker = $el.data('daterangepicker');
        if (picker && formValue.export_config.export_from) {
            triggerNativeChange(daterangeRef.current, formValue.export_config.export_from);
        }
    }, [formValue.export_config.export_from]);

    useEffect(() => {
        if (!periodicStartDateInputRef.current) return;
        const $el = $(periodicStartDateInputRef.current);

        // get (read only) picker from jQuery (necessary evil): okay
        const picker = $el.data('daterangepicker');
        if (picker && formValue.export_periodic.start_time) {
            triggerNativeChange(periodicStartDateInputRef.current, formValue.export_periodic.start_time);
            const periodic = { ...formValue.export_periodic };
            periodic['client_timezone'] = formValue.export_config.client_timezone;
            void getPreviewScheduler(periodic);
        }
    }, [formValue.export_periodic.start_time]);

    useEffect(() => {
        if (!daterangeRef.current) return;
        const $el = $(daterangeRef.current);
        const handler = (event, newValue: string) => {
            if (formValue.export_config.export_from !== newValue) {
                setFormValue((prev) => {
                    return {
                        ...prev,
                        export_config: {
                            ...prev.export_config,
                            export_from: newValue,
                            export_to: '',
                        },
                    };
                });
            }
        };

        $el.on('reactdaterangepicker', handler);
        return () => {
            $el.off('reactdaterangepicker', handler);
            $el.data('daterangepicker')?.remove();
        };
    }, []);

    useEffect(() => {
        if (!periodicStartDateInputRef.current) return;
        const $el = $(periodicStartDateInputRef.current);
        const handler = (event, newValue: string) => {
            if (formValue.export_periodic.start_time !== newValue) {
                setFormValue((prev) => {
                    return {
                        ...prev,
                        export_periodic: {
                            ...prev.export_periodic,
                            start_time: newValue,
                        },
                    };
                });
            }
        };

        $el.on('reactdaterangepicker', handler);
        return () => {
            $el.off('reactdaterangepicker', handler);
            $el.data('daterangepicker')?.remove();
        };
    }, []);

    return (
        <div>
            <div className="periodic-section d-flex align-items-center">
                <label className="mr-1 periodic-label" htmlFor="onceEvery">
                    {t('Once every')}
                </label>
                <Input
                    type="number"
                    min="1"
                    className="mr-2"
                    id="onceEvery"
                    value={formValue.export_periodic.interval_value}
                    onChange={(e) => onChangeIntervalValue('interval_value', e)}
                    name="interval_unit"
                    isInvalid={!errors?.interval_value?.isValid}
                    style={{ width: '80px' }}
                />
                <Select
                    onChange={(e) => handleOnChangeType(e)}
                    value={formValue.export_periodic.interval_unit}
                    options={PERIOD_OPTION}
                    className="mr-2"
                    id="intervalUnit"
                    style={{ width: '80px' }}
                />

                <label className="mr-1 periodic-label" htmlFor="datetimePickerStartPeriod" style={{ minWidth: '60px' }}>
                    {t('Begin From')}
                </label>
                <input
                    id="datetimePickerStartPeriod"
                    name="DATETIME_PICKER"
                    type="text"
                    ref={periodicStartDateInputRef}
                    defaultValue={formValue.export_periodic.start_time}
                    className="DATETIME_PICKER datetimepicker form-control mr-2 form-group datetime-picker-start-period"
                    is-show-time-picker="True"
                    is-set-default-value="True"
                    is-show-recent-dates="True"
                    is-static="True"
                    autoComplete="off"
                />
            </div>
            <div className="align-items-center d-flex export-data-from">
                <label
                    className="mr-2 col-sm-5 pl-0"
                    htmlFor="datetimePickerPeriod"
                    style={{ whiteSpace: 'pre', marginBottom: 0 }}
                >
                    {t('Export past data since')}
                </label>
                <div className="position-relative">
                    <input
                        id="datetimePickerPeriod"
                        name="DATETIME_PICKER"
                        type="text"
                        ref={daterangeRef}
                        defaultValue={formValue.export_config.export_from}
                        className="DATETIME_PICKER datetimepicker form-control"
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
                        data-from-only="true"
                        className="btn btn-sm btn-primary"
                    >
                        Data finder
                    </button>
                </div>
            </div>
            {runTimeList && runTimeList.length > 0 && (
                <div className="d-flex">
                    <div className="col-sm-5 pl-0">
                        <div className="row">
                            <div className="col-sm text-nowrap">{t('Schedule Preview')}</div>
                        </div>
                        <div className="row">
                            <div className="col-sm text-nowrap">({t('Next 3 runs')})</div>
                        </div>
                    </div>
                    <div className="col-sm" id="nextRunsPreview">
                        {runTimeList.map((item, index) => (
                            <div className="row" key={index}>
                                <div className="col-sm next-run-item">{item}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
