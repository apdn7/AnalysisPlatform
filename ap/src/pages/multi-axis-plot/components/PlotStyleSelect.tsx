import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Select, { type SelectOption } from '@/shared/components/ui/Select.tsx';

const options: SelectOption[] = [
    {
        value: 'auto',
        text: '― Auto',
    },
    {
        value: 'lines',
        text: '― Line',
    },
    {
        value: 'lines+markers',
        text: '-・- Line+Marker',
    },
    {
        value: 'markers',
        text: '・ Marker',
    },
];

interface Props {
    id?: string;
    name?: string;
    plotStypeValue?: string;
    onChange?: (plotStypeValue: string) => void;
}

export default function PlotStyleSelect({ id, name, plotStypeValue, onChange }: Props) {
    const { t } = useTranslation();
    const [plotStyle, setPlotStyle] = useState('auto');
    useEffect(() => {
        setPlotStyle(plotStypeValue);
    }, [plotStypeValue]);
    return (
        <div className="fit-content ml-2">
            <Select
                id={id}
                name={name}
                options={options}
                value={plotStyle}
                title="Plot style"
                className="mb-0"
                hoverText={t('MAP plot style hover msg')}
                selectClassName="border-white w-auto scale-dropdown"
                onChange={(e) => {
                    setPlotStyle(e.target.value);
                    onChange?.(e.target.value);
                }}
            />
        </div>
    );
}
