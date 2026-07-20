import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';

import ExportSchedules from '@/pages/export-config/components/ExportSchedule.tsx';
import ExportSettings from '@/pages/export-config/components/ExportSetting.tsx';
import { exportConfigService } from '@/services/exportConfig';
import ConfirmModal from '@/shared/components/ui/ConfirmModal.tsx';
import { useToast } from '@/shared/hooks/useToast';
import { EXPORT_CONFIG_ERROR_MESSAGES } from '@/shared/utils/errors.ts';
import { eventBus } from '@/shared/utils/eventBus';
import {
    type ValidateExportConfig,
    type ValidationResult,
    validateFolderPath,
    validateRequiredField,
} from '@/shared/utils/validation.ts';

import './ExportConfig.scss';

interface ExportDetail {
    process_id: number;
    process_column_id: number;
    order: number;
}

interface ExportFilterDetail {
    process_id: number;
    filter_detail_id: number;
}

export type ExportConfigData = {
    id?: number | null;
    type: 'once' | 'periodic';
    export_from: string;
    export_to: string;
    created_by?: string;
    updated_at?: string;
    next_run?: string;
    last_run?: string;
    last_export_data?: string;
    description?: string;
    sub_folder?: string;
    file_format: string;
    filename_identifier: string;
    filename_format: string;
    split_file_by: number;
    periodic_id?: number | null;
    main_process_id: number | null;
    title: string;
    folder_path: string;
    client_timezone: string;
    remove_outlier: string;
    remove_exception: boolean;
    remove_abnormal_count: boolean;
    duplicated_check_type: 'all' | 'first' | 'last';
    duplicated_check: 'auto' | 'check' | 'skip';
    export_column_name_type: number;
    export_details: ExportDetail[] | any;
    filters?: ExportFilterDetail[] | any;
    run_now: boolean;
};
export type ExportConfigRecords = ExportConfigData[];

export type ExportPeriodic = {
    interval_unit: 'day' | 'hour' | 'min';
    interval_value: number;
    start_time: string;
};

export interface FormValue {
    export_config: ExportConfigData;
    export_periodic?: ExportPeriodic | null;
}

export interface ExportAPIResponse<T> {
    export_config: T;
    flask_message: string;
}

export interface ExportAPIFetchResponse<T> {
    export_configs: T;
    flask_message: string;
}

const defaultFormValue: FormValue = {
    export_config: {
        id: null,
        type: 'once',
        export_from: '',
        export_to: '',
        created_by: '',
        description: '',
        sub_folder: '',
        file_format: 'csv',
        filename_identifier: 'dat',
        filename_format: '{identifier}',
        split_file_by: 100000, // default value is 100k
        periodic_id: null,
        main_process_id: null,
        title: '',
        folder_path: '',
        client_timezone: detectLocalTimezone(),
        remove_outlier: '',
        remove_exception: false,
        remove_abnormal_count: false,
        duplicated_check_type: 'all',
        duplicated_check: 'auto',
        export_column_name_type: 0,
        export_details: [],
        filters: [],
        run_now: false,
    },
    export_periodic: {
        interval_unit: 'day',
        interval_value: 1,
        start_time: dayjs().format('YYYY-MM-DD HH:mm'),
    },
};

const defaultError = {
    title: { isValid: true, message: undefined },
    folder_path: { isValid: true, message: undefined },
    filename_format: { isValid: true, message: undefined },
    interval_value: { isValid: true, message: undefined },
    trigger_hour: { isValid: true, message: undefined },
    trigger_min: { isValid: true, message: undefined },
    main_process: { isValid: true, message: undefined },
    filename_preview: { isValid: true, message: undefined },
};

const EXPORT_DATA_FORM_ID = '#exportDataForm';

export default function ExportConfig() {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [runTimeList, setRunTimeList] = useState<string[]>([]);
    const [formValue, setFormValue] = useState<FormValue>(defaultFormValue);

    const [errors, setErrors] = useState<ValidateExportConfig<ValidationResult>>(defaultError);

    const datetimeRangeInputRef = useRef<HTMLInputElement | null>(null);

    const dateRangeInputRef = useRef<HTMLInputElement | null>(null);

    const periodicStartDateInputRef = useRef<HTMLInputElement | null>(null);

    const { success, error, closeAllToast } = useToast();

    useEffect(() => {
        eventBus.on('DELETE_EXPORT_CONFIG', () => {
            handleResetExportGUI();
        });
    }, []);

    useEffect(() => {
        const node = document.getElementById('register-button-portal');
        if (node) {
            setPortalNode(node);
        }

        eventBus.on('EXPORT_CONFIG_ROW_CLICKED', (exportConfigData) => {
            if (!exportConfigData.export_periodic) {
                exportConfigData.export_periodic = {
                    ...defaultFormValue.export_periodic,
                };
            }
            setErrors(defaultError);
            setFormValue(exportConfigData);
        });
    }, []);

    // Remove error warnings when the user makes changes.
    useEffect(() => {
        const handleChange = () => {
            setErrors((prev) => ({
                ...prev,
                main_process: { isValid: true, message: '' },
            }));
            setMainProcessError(false, '');
        };
        const endProcSelector = '#end-proc-process-1';
        $(endProcSelector).on('change', handleChange);
        return () => $(endProcSelector).off('change', handleChange);
    }, []);

    useEffect(() => {
        setFormValue((prev) => ({
            ...prev,
            export_config: {
                ...prev.export_config,
                run_now: false,
            },
        }));
    }, [isModalOpen]);

    const setMainProcessError = (isInvalid: boolean, message?: string) => {
        const endProcCard = document.querySelector<HTMLElement>('[id^="end-proc-process-div-"][id$="-parent"]');
        if (!endProcCard) return;

        endProcCard.style.border = isInvalid ? '1px solid red' : '';

        const existingError = endProcCard.querySelector('.main-process-error');
        if (isInvalid) {
            if (!existingError) {
                const errorEl = document.createElement('small');
                errorEl.className = 'text-danger error-text main-process-error';
                errorEl.textContent = t(message) ?? '';
                endProcCard.appendChild(errorEl);
            }
        } else {
            existingError?.remove();
        }
    };

    const validateForm = async () => {
        const isValidMainProcess = checkValidations({ max: MAX_NUMBER_OF_SENSOR }, EXPORT_DATA_FORM_ID);
        const folderPathValidation = await validateFolderPath(formValue.export_config.folder_path);
        const newErrors = {
            title: validateRequiredField(formValue.export_config.title),
            folder_path: { ...validateRequiredField(formValue.export_config.folder_path), ...folderPathValidation },
            filename_format: validateRequiredField(formValue.export_config.filename_format),
            main_process: {
                isValid: isValidMainProcess,
                message: isValidMainProcess ? undefined : EXPORT_CONFIG_ERROR_MESSAGES.REQUIRED_FIELD,
            },
        };
        setErrors((prev) => ({
            ...prev,
            ...newErrors,
        }));

        setMainProcessError(!isValidMainProcess, newErrors.main_process?.message);

        const allErrors = { ...errors, ...newErrors };
        return !Object.values(allErrors).some((error) => error?.isValid === false);
    };

    const handleShowExportConfigModal = async () => {
        syncFormValue();
        const isValidForm = await validateForm();
        if (isValidForm) {
            setIsModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleResetExportGUI = () => {
        setErrors(defaultError);
        setFormValue(defaultFormValue);
        document.getElementById('alertNoLinkConfig').hidden = true;
        eventBus.emit('EXPORT_CONFIG_RESETTING', defaultFormValue);
    };

    const syncFormValue = () => {
        // get formValue
        let updateFormValue = { ...formValue };
        const datetimeRangeValue = datetimeRangeInputRef.current?.value;
        const importPastDateFrom = dateRangeInputRef.current?.value;
        if (formValue.export_config.type === 'once') {
            const [startDatetime, endDatetime] = datetimeRangeValue.split(DATETIME_PICKER_SEPARATOR);
            updateFormValue = {
                ...updateFormValue,
                export_config: {
                    ...updateFormValue.export_config,
                    export_from: startDatetime,
                    export_to: endDatetime,
                },
            };
        } else {
            updateFormValue = {
                ...updateFormValue,
                export_config: {
                    ...updateFormValue.export_config,
                    export_from: importPastDateFrom,
                    export_to: undefined,
                },
                export_periodic: {
                    ...updateFormValue.export_periodic,
                },
            };
        }

        const cleansingOptions: any = getCleansingOption();

        updateFormValue = {
            ...updateFormValue,
            export_config: {
                ...updateFormValue.export_config,
                export_details: getExportDetails(),
                filters: getExportFilterDetails(),
                ...cleansingOptions,
                main_process_id: Number(getStartProcId()),
            },
        };
        setFormValue(updateFormValue);
    };

    const handleConfirmModal = async () => {
        if (isLoading) return;
        setIsModalOpen(false);
        syncFormValue();

        try {
            const response = await exportConfigService.saveConfig(formValue);
            success(t('Export config saved successfully'));
            closeAllToast();

            eventBus.emit('EXPORT_CONFIG_UPDATING', response?.export_config);
            setFormValue((prev) => ({
                ...prev,
                export_config: {
                    ...prev.export_config,
                    id: response?.export_config.id,
                },
            }));
        } catch (err) {
            error(t('Failed to save export configuration'));
            closeAllToast();
            console.error('Failed to save export configuration', err);
        } finally {
            setIsLoading(false);
        }
    };

    const modalConfirmBody = (
        <div>
            {formValue.export_config.type === 'once' ? (
                <p>
                    {t('Export data')} from {formValue.export_config.export_from} to {formValue.export_config.export_to}
                </p>
            ) : runTimeList.length > 0 ? (
                <div>
                    <p>
                        The export settings will be registered. <br />
                        Once registered, data will be exported according to the following schedule.
                    </p>
                    Export Schedule: <br />
                    (After registration): Import past data since {formValue.export_config.export_from}
                    <ol>
                        {runTimeList.map((item, index) => (
                            <li key={index}>{item}</li>
                        ))}
                    </ol>
                    <div className="custom-control custom-checkbox mx-1">
                        <input
                            type="checkbox"
                            className="custom-control-input"
                            id="exportRunNow"
                            checked={formValue.export_config.run_now}
                            onChange={(e) => {
                                const target = e.target.checked;
                                setFormValue((prev) => ({
                                    ...prev,
                                    export_config: {
                                        ...prev.export_config,
                                        run_now: target,
                                    },
                                }));
                            }}
                        />
                        <label className="custom-control-label text-nowrap" htmlFor="exportRunNow">
                            {t('Run now')}
                        </label>
                    </div>
                </div>
            ) : (
                <span></span>
            )}
        </div>
    );
    return (
        <div>
            <ExportSchedules
                formValue={formValue}
                setFormValue={setFormValue}
                errors={errors}
                setErrors={setErrors}
                datetimeRangeRef={datetimeRangeInputRef}
                dateRangeRef={dateRangeInputRef}
                runTimeList={runTimeList}
                setRunTimeList={setRunTimeList}
                periodicStartDateInputRef={periodicStartDateInputRef}
            />
            <ExportSettings formValue={formValue} setFormValue={setFormValue} errors={errors} setErrors={setErrors} />
            <div>
                {portalNode ? (
                    createPortal(
                        <div>
                            <Button
                                className="btn-success ml-3"
                                id="registerButton"
                                onClick={handleShowExportConfigModal}
                            >
                                <i className="fa fa-save"></i>
                                {t('Register')}
                            </Button>
                            <Button className="btn-reset ml-3" id="resetButton" onClick={handleResetExportGUI}>
                                {t('New')}
                            </Button>
                        </div>,
                        portalNode,
                    )
                ) : (
                    <Button className="btn-success ml-3" onClick={handleShowExportConfigModal}>
                        <i className="fa fa-save"></i>
                        {t('Register')}
                    </Button>
                )}
            </div>
            <ConfirmModal
                isOpen={isModalOpen}
                title={t('Confirm export registration')}
                body={modalConfirmBody}
                onClose={handleCloseModal}
                onConfirm={handleConfirmModal}
            />
        </div>
    );
}
