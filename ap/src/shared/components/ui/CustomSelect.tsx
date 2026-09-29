import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function CustomSelect({ id, name, label, value, options, className, onChange }) {
    const { t } = useTranslation();
    const [selectedValue, setSelectedValue] = useState(value);
    const [hideSelectList, setHideSelectList] = useState(true);
    const selectRef = useRef<HTMLSelectElement>(null);
    const handleToggleSelectList = (e) => {
        e.stopPropagation();
        setHideSelectList((isHidden) => !isHidden);
    };

    const handleClickSelectItem = (e, itemValue: string) => {
        e.stopPropagation();
        setSelectedValue(itemValue);
        setHideSelectList(true);
        triggerProgrammaticChange(itemValue);
        onChange?.(itemValue);
    };

    const selectedOption = useMemo(() => {
        return options.find((option) => option.value === selectedValue) ?? options[0];
    }, [options, selectedValue]);

    const text = useMemo(() => {
        return selectedOption ? t(selectedOption.text) : '';
    }, [selectedOption, t]);

    const handleOnchangeSelect = (itemValue) => {
        setSelectedValue(itemValue);
    };

    useEffect(() => {
        setSelectedValue(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = () => {
            setHideSelectList(true);
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const triggerProgrammaticChange = (newValue) => {
        const selectElement = selectRef.current;
        if (!selectElement) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            'value',
        )?.set;

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(selectElement, newValue);

            const event = new Event('change', { bubbles: true });
            selectElement.dispatchEvent(event);
        }
    };

    return (
        <div className="d-flex align-items-center">
            {label && (
                <span className="mr-2 " title="">
                    {t(label)}
                </span>
            )}
            <div className="dn-custom-select react" onClick={handleToggleSelectList}>
                <select
                    ref={selectRef}
                    className="form-control"
                    id={id}
                    name={name}
                    value={selectedOption?.value ?? ''}
                    onChange={(e) => handleOnchangeSelect(e.target.value)}
                >
                    {options.map((option, index) => (
                        <option key={index} value={option.value}>
                            {option.text}
                        </option>
                    ))}
                </select>

                <div
                    className={`dn-custom-select--select form-control ${className ?? ''}`}
                    data-value={selectedOption?.value ?? ''}
                >
                    {text}
                </div>

                <div className={`dn-custom-select--select--list ${hideSelectList ? 'select-hide' : ''}`}>
                    {options.map((option) => {
                        return (
                            <div
                                key={option.value}
                                className="dn-custom-select--select--list--item"
                                data-value={option.value}
                                onClick={(e) => handleClickSelectItem(e, option.value)}
                            >
                                <span className="">{t(option.text)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
