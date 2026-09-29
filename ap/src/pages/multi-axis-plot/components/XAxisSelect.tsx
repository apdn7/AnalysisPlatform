import { useEffect, useMemo } from 'react';

import CustomSelect from '@/shared/components/ui/CustomSelect.tsx';
import { type SelectOption } from '@/shared/components/ui/Select.tsx';

const datetimeOptions: SelectOption[] = [
    { value: 'TIME', text: 'Timestamp' },
    { value: 'INDEX', text: 'Serial series' },
    { value: 'EQUAL_WIDTH_BIN', text: 'Equal Width Bin' },
    { value: 'EQUAL_FREQ_BIN', text: 'Equal Freq Bin' },
];

const categoryOptions: SelectOption[] = [
    {
        value: 'CAT_VALUE',
        text: 'Cat Value',
    },
    {
        value: 'DATA_VALUE',
        text: 'Original order',
    },
    {
        value: 'INDEX',
        text: 'Serial series',
    },
];

const numericOptions: SelectOption[] = [
    { value: 'NUMERIC_VALUE', text: 'Numeric Value' },
    { value: 'EQUAL_WIDTH_BIN', text: 'Equal Width Bin' },
    { value: 'EQUAL_FREQ_BIN', text: 'Equal Freq Bin' },
];
export type XDataType = 'DATETIME' | 'CAT' | 'INTEGER';

export const getXAxisOptions = (xType: XDataType | string = 'DATETIME'): SelectOption[] => {
    switch (xType) {
        case 'DATETIME':
            return datetimeOptions;
        case 'CAT':
            return categoryOptions;
        default:
            return numericOptions;
    }
};

export const getDefaultXAxisOption = (xType: XDataType | string = 'DATETIME') =>
    String(getXAxisOptions(xType)[0].value);

interface Props {
    id?: string;
    name?: string;
    xType?: XDataType;
    onChange?: (xOption: string) => void;
    xOptionValue?: string;
    cssClass?: string;
    label?: string;
}
export default function XAxisSelect({ xType = 'DATETIME', xOptionValue, onChange, cssClass, id, name, label }: Props) {
    const options = useMemo(() => getXAxisOptions(xType), [xType]);

    const value = useMemo(() => {
        return options.find((option) => option.value === xOptionValue)?.value || options[0].value;
    }, [xType, xOptionValue, options]);

    useEffect(() => {
        DataFinderService.setProcessID();
        bindXAxisEvents();
    }, [xType, options]);

    return (
        <CustomSelect
            id={id}
            name={name}
            label={label}
            value={value}
            options={options}
            className={cssClass}
            onChange={onChange}
        />
    );
}
