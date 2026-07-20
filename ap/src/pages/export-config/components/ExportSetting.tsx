import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';

import DragAndDropInput, { type DragDropItem } from '@/shared/components/ui/DragAndDropInput.tsx';
import Input from '@/shared/components/ui/Input';
import Select from '@/shared/components/ui/Select.tsx';
import { EXPORT_CONFIG_ERROR_MESSAGES } from '@/shared/utils/errors.ts';
import { sanitizeFolderName, sanitizeString } from '@/shared/utils/helpers.ts';
import type { ValidateExportConfig, ValidationResult } from '@/shared/utils/validation.ts';

import './ExportConfig.scss';

// 🔵 source list
const SOURCE_ITEMS: DragDropItem[] = [
    { id: 'identifier', label: 'ExportFileNameDragdropItemLabel' },
    { id: 'from', label: 'Period from' },
    { id: 'to', label: 'Period to' },
    { id: 'process', label: 'Process name' },
];

const FILE_EXTENSION_OPTION = [
    {
        value: 'csv',
        text: 'CSV',
    },
    { value: 'tsv', text: 'TSV' },
];

const ROW_SPLIT_OPTION = [
    { value: '10000', text: '10k rows' },
    { value: '100000', text: '100k rows' },
    { value: '1000000', text: '1M rows' },
];

const COLUMN_TYPE_NAME_OPTION = [
    { value: '0', text: 'System Name' },
    { value: '1', text: 'Japanese Name' },
    { value: '2', text: 'Local Name' },
];

const SUB_FOLDER_OPTION = [
    { value: '-', text: '---' },
    { value: 'daily', text: 'Daily' },
    { value: 'weekly', text: 'Weekly' },
    { value: 'monthly', text: 'Monthly' },
];

export const UNDERSCORE = '_';
export const EMPTYSTRING = '';

export default function ExportSettings({ formValue, setFormValue, errors, setErrors }) {
    const { t } = useTranslation();
    const [processName, setProcessName] = useState<string>('');

    useEffect(() => {
        const startSelect = document.getElementById('start_proc') as HTMLSelectElement | null;
        const endSelect = document.querySelector<HTMLSelectElement>('select[id^="end-proc-process-"]');

        const updateProcessName = () => {
            const newProcessName = startSelect?.value
                ? startSelect?.selectedOptions[0]?.text
                : endSelect?.value
                  ? endSelect?.selectedOptions[0]?.text
                  : '';

            setProcessName(newProcessName);
        };

        const timer = setTimeout(() => {
            updateProcessName();
            $(endSelect).on('change', updateProcessName);
            $(startSelect).on('change', updateProcessName);
        }, 200);

        return () => {
            clearTimeout(timer);
            $(endSelect).off('change', updateProcessName);
            $(startSelect).off('change', updateProcessName);
        };
    }, [formValue.export_config.filename_format]);

    const selectedItems = useMemo(() => {
        const ids = formValue.export_config.filename_format.split('_').map((i) => i.replace(/[{}]/g, ''));

        return ids.map((id) => SOURCE_ITEMS.find((item) => item.id === id)).filter(Boolean) as DragDropItem[];
    }, [formValue.export_config.filename_format]);

    const fileNamePreview = useMemo(() => {
        const tokenMap: Record<string, string> = {
            identifier: formValue.export_config.filename_identifier,
            from: dayjs().subtract(30, 'day').format('YYYYMMDDHHmmss'),
            to: dayjs().format('YYYYMMDDHHmmss'),
            process: processName.replace(new RegExp(UNDERSCORE, 'g'), EMPTYSTRING),
        };

        const preview = selectedItems
            .map((item) => tokenMap[item.id] || '')
            .filter((value) => value !== null && value !== '')
            .join('_');

        return preview
            ? `${preview}.${formValue.export_config.file_format}`
            : `.${formValue.export_config.file_format}`;
    }, [formValue.export_config.filename_identifier, formValue.export_config.file_format, processName, selectedItems]);

    useEffect(() => {
        const hasPreview = !fileNamePreview.startsWith('.');
        setErrors((prev: ValidateExportConfig<ValidationResult>) => ({
            ...prev,
            filename_preview: {
                isValid: hasPreview,
                message: hasPreview ? undefined : EXPORT_CONFIG_ERROR_MESSAGES.FILENAME_PREVIEW_EMPTY,
            },
        }));
    }, [fileNamePreview]);

    const handleOnChangeFrom = (key: string, value: string) => {
        if (['filename_identifier', 'title'].includes(key)) {
            value = sanitizeString(value);
        }
        setFormValue((prev) => ({
            ...prev,
            export_config: {
                ...prev.export_config,
                [key]: value,
            },
        }));
        if (Object.keys(errors).includes(key) && value) {
            setErrors((prev) => ({
                ...(prev || {}),
                [key]: { isValid: true, message: undefined },
            }));
        }
    };

    const onChangeDragDropItems = (items) => {
        const filenameFormat = items.map((item) => `{${item.id}}`).join('_');
        setFormValue((prev) => ({
            ...prev,
            export_config: {
                ...prev.export_config,
                filename_format: filenameFormat,
            },
        }));

        if (errors.filename_format && filenameFormat) {
            setErrors((prev) => ({
                ...(prev || {}),
                filename_format: { isValid: true, message: undefined },
            }));
        }
    };

    return (
        <div className="card-body table-bordered graph-navi" id="srtPrc">
            <div className="row">
                <div className="col-xl-2 col-3">
                    <div className="d-flex justify-content-between">
                        <label className="col-form-label label-left">
                            <span className="hint-text section-label"> {t('Export Settings')}</span>
                        </label>
                    </div>
                </div>
                <div className="col-xl-10 col-9">
                    <div className="export-settings">
                        <div className="export-metadata-section">
                            <div>
                                <Input
                                    id="exportTitle"
                                    title={t('ExportSettingTitle')}
                                    name="exportTitle"
                                    required={true}
                                    value={formValue.export_config.title}
                                    onChange={(e) => handleOnChangeFrom('title', e.target.value)}
                                    isInvalid={!errors?.title?.isValid}
                                    errorMessage={errors?.title?.message || ''}
                                />
                            </div>
                            <div>
                                <Input
                                    id="exportCreatedBy"
                                    title={t('Created by')}
                                    name="exportCreatedBy"
                                    value={formValue.export_config.created_by}
                                    onChange={(e) => handleOnChangeFrom('created_by', e.target.value)}
                                />
                            </div>
                            <div>
                                <Input
                                    id="exportDescription"
                                    title={t('Description')}
                                    name="exportDescription"
                                    value={formValue.export_config.description}
                                    onChange={(e) => handleOnChangeFrom('description', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="export-non-metadata-section">
                            <div>
                                <Input
                                    id="exportFolder"
                                    className="flex-grow-1"
                                    title={t('Folder')}
                                    name="exportFolder"
                                    required={true}
                                    value={formValue.export_config.folder_path}
                                    onChange={(e) => handleOnChangeFrom('folder_path', e.target.value)}
                                    onBlur={(e) => {
                                        trimQuotesSpacesAndUpdate(e.currentTarget);
                                        handleOnChangeFrom('folder_path', e.currentTarget.value);
                                    }}
                                    isInvalid={!errors?.folder_path?.isValid}
                                    errorMessage={errors?.folder_path?.message || ''}
                                />
                            </div>
                            <div>
                                <Select
                                    options={SUB_FOLDER_OPTION}
                                    value={formValue.export_config.sub_folder}
                                    onChange={(e) => handleOnChangeFrom('sub_folder', e.target.value)}
                                    title={t('Sub-folder')}
                                    name="exportSubFolder"
                                    hoverText={t('ExportSubfolderTooltipText')}
                                ></Select>
                            </div>

                            <div>
                                <Input
                                    id="exportFilenameIdentifier"
                                    title={t('Filename identifier')}
                                    onChange={(e) => handleOnChangeFrom('filename_identifier', e.target.value)}
                                    name="exportFilenameIdentifier"
                                    value={formValue.export_config.filename_identifier}
                                    hoverText={t('ExportFileNameIdentifierTooltipText')}
                                />
                            </div>
                            <div>
                                <Select
                                    options={FILE_EXTENSION_OPTION}
                                    title={t('File format')}
                                    name="exportFileFormat"
                                    value={formValue.export_config.file_format}
                                    onChange={(e) => handleOnChangeFrom('file_format', e.target.value)}
                                ></Select>
                            </div>
                            <div>
                                <div className="form-group d-flex flex-column">
                                    <div className="d-flex w-100">
                                        <label
                                            style={{ marginTop: '5px', height: 'fit-content' }}
                                            htmlFor="title"
                                            className="section-title d-flex hint-text"
                                            title={t('ExportFileNameStructureTooltipText')}
                                        >
                                            {t('Filename format')}
                                            <span className="color-yellow">*</span>
                                        </label>
                                        <div className="flex-1">
                                            <DragAndDropInput
                                                sourceItems={SOURCE_ITEMS}
                                                value={selectedItems}
                                                isInvalid={!errors?.filename_format?.isValid}
                                                onChange={onChangeDragDropItems}
                                                errorMessage={errors?.filename_format?.message}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Select
                                    options={ROW_SPLIT_OPTION}
                                    title={t('Split file by')}
                                    id="exportSplitRow"
                                    value={formValue.export_config.split_file_by ?? ''}
                                    onChange={(e) => handleOnChangeFrom('split_file_by', e.target.value || null)}
                                    hoverText={t('ExportFileSplitTooltipText')}
                                ></Select>
                            </div>
                            <div>
                                <div className="form-group">
                                    <label>{t('Filename Preview')}: </label>
                                    <div className="d-flex flex-column">
                                        <span id="exportFilenameFormatPreview">{fileNamePreview}</span>
                                        {!errors?.filename_preview?.isValid && errors?.filename_preview?.message && (
                                            <small className="text-danger">
                                                {t(errors?.filename_preview?.message)}
                                            </small>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Select
                                    options={COLUMN_TYPE_NAME_OPTION}
                                    title={t('Column Name Type')}
                                    id="exportColumnNameType"
                                    name="exportColumnNameType"
                                    value={formValue.export_config.export_column_name_type}
                                    onChange={(e) => handleOnChangeFrom('export_column_name_type', e.target.value)}
                                ></Select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
