import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface SelectOption {
    value: string | number | null;
    text: string;
    hoverMsg?: string;
}

interface SelectProps {
    title?: string;
    value?: string;
    id?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    selectClassName?: string;
    style?: React.CSSProperties;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: SelectOption[];
    hoverText?: string;
}

export default function Select({
    title = '',
    value = '',
    id,
    name,
    required = false,
    disabled = false,
    className = '',
    selectClassName = '',
    style = {},
    onChange,
    options,
    hoverText = '',
}: SelectProps) {
    const { t } = useTranslation();

    return (
        <div className={className + ' form-group d-flex  align-items-center'}>
            {title && (
                <label htmlFor={id} className={`section-title ${hoverText.length && 'hint-text'}`} title={hoverText}>
                    {t(title)}
                    {required && <span style={{ color: 'yellow' }}>*</span>}
                </label>
            )}
            <select
                className={'form-control ' + selectClassName}
                value={value}
                name={name}
                id={id}
                disabled={disabled}
                onChange={onChange}
                style={style}
            >
                {options.map((option, index) => (
                    <option value={option.value} key={index} title={t(option.hoverMsg)}>
                        {t(option.text)}
                    </option>
                ))}
            </select>
        </div>
    );
}
