import React from 'react';
import { useTranslation } from 'react-i18next';

interface InputOptions extends React.ComponentPropsWithoutRef<'input'> {
    title?: string;
    errorMessage?: string;
    isInvalid?: boolean;
    error?: object;
    hoverText?: string;
}

export default function Input({
    title = '',
    id,
    name,
    type = 'text',
    required = false,
    disabled = false,
    placeholder = '',
    className = '',
    errorMessage = '',
    isInvalid = false,
    style = {},
    onChange,
    value = '',
    hoverText = '',
    ...rest // Get all remaining native props of <input>
}: InputOptions) {
    const { t } = useTranslation();

    return (
        <div className={`${className} form-group`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
            <label
                htmlFor={id}
                className={`section-title align-self-center ${hoverText.length && 'hint-text'}`}
                title={hoverText}
            >
                {t(title)}
                {required && <span style={{ color: 'yellow' }}>*</span>}
            </label>
            <input
                {...rest}
                onChange={onChange}
                type={type}
                name={name}
                id={id}
                value={value}
                className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
                style={isInvalid ? { ...style, borderColor: 'red' } : style}
                disabled={disabled}
                placeholder={placeholder}
                autoComplete="off"
            />

            {isInvalid && errorMessage && (
                <>
                    <span />
                    <small className="text-danger error-text">{t(errorMessage)}</small>
                </>
            )}
        </div>
    );
}
