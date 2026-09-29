import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { YAxisShowModes } from '@/pages/multi-axis-plot/plotBuilder.ts';
import Select, { type SelectOption } from '@/shared/components/ui/Select.tsx';

const standardOptions: SelectOption[] = [
    {
        value: YAxisShowModes.Normal,
        text: 'Normal',
        hoverMsg: 'Standard line chart (raw values) Auto Log Scale',
    },
    {
        value: YAxisShowModes.Stack,
        text: 'Stack',
        hoverMsg: 'Stacked line chart (raw values)',
    },
    {
        value: YAxisShowModes.Percent,
        text: '%',
        hoverMsg: 'Percentage line chart',
    },
    {
        value: YAxisShowModes.PercentStack,
        text: '%Stack',
        hoverMsg: '100% stacked line chart (composition ratio)',
    },
];

const binOptions: SelectOption[] = [
    {
        value: YAxisShowModes.BinStack,
        text: 'BinStack',
        hoverMsg: 'Stacked line chart grouped by bins',
    },
    {
        value: YAxisShowModes.BinPercent,
        text: 'Bin%',
        hoverMsg: 'Percentage line chart grouped by bins',
    },
    {
        value: YAxisShowModes.BinPercentStack,
        text: 'Bin%Stack',
        hoverMsg: '100% stacked line chart grouped by bins',
    },
];

const logOptions: SelectOption[] = [
    {
        value: YAxisShowModes.LogOff,
        text: 'Log Off',
        hoverMsg: 'Linear scale',
    },
    {
        value: YAxisShowModes.LogOn,
        text: 'Log On',
        hoverMsg: 'Log scale (orders of magnitude)',
    },
];

const optionsWhenGetDisabled: SelectOption[] = [
    {
        value: YAxisShowModes.Normal,
        text: 'Normal',
        hoverMsg: 'Standard line chart (raw values) Auto Log Scale',
    },
    ...logOptions,
];

interface Props {
    id?: string;
    name: string;
    yOptionValue?: YAxisShowModes;
    isDisableOptions?: boolean;
    xOptionValue?: string;
    onChange?: (yOptionValue: YAxisShowModes) => void;
}

export default function YAxisSelect({ id, name, onChange, isDisableOptions, xOptionValue, yOptionValue }: Props) {
    const [yOption, setYOption] = useState<YAxisShowModes>(YAxisShowModes.Normal);
    const { t } = useTranslation();
    const canUseBinYAxis = xOptionValue === 'EQUAL_WIDTH_BIN';
    const availableOptions = useMemo(() => {
        if (isDisableOptions) {
            return canUseBinYAxis
                ? [optionsWhenGetDisabled[0], ...binOptions, ...optionsWhenGetDisabled.slice(1)]
                : optionsWhenGetDisabled;
        }
        return canUseBinYAxis
            ? [...standardOptions, ...binOptions, ...logOptions]
            : [...standardOptions, ...logOptions];
    }, [canUseBinYAxis, isDisableOptions]);

    useEffect(() => {
        const nextYOption = yOptionValue ?? YAxisShowModes.Normal;
        if (!availableOptions.some((option) => option.value === nextYOption)) {
            setYOption(YAxisShowModes.Normal);
            onChange?.(YAxisShowModes.Normal);
            return;
        }
        setYOption(nextYOption);
    }, [availableOptions, onChange, yOptionValue]);

    return (
        <div className="ml-2">
            <Select
                id={id}
                name={name}
                title="Y Axis"
                className="mb-0"
                selectClassName="border-white w-auto scale-dropdown"
                options={availableOptions}
                value={yOption}
                hoverText={t('MAP y-axis hover msg')}
                onChange={(e) => {
                    const yAxis = e.target.value as YAxisShowModes;
                    setYOption(yAxis);
                    onChange?.(yAxis);
                }}
            />
        </div>
    );
}
