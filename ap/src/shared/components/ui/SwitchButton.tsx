import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as Switch from '@radix-ui/react-switch';

interface Props {
    id: string;
    label: string;
    title?: string;
    isChecked: boolean;
    onChange?: (transposeValue: boolean) => void;
}

export default function SwitchButton({ id, label, title, isChecked, onChange }: Props) {
    const { t } = useTranslation();
    const [checked, setChecked] = useState(isChecked);
    const handleOnChangeInput = (e) => {
        setChecked(e.target.checked);
        onChange(e.target.checked);
    };

    useEffect(() => {
        setChecked(isChecked);
    }, [isChecked]);
    return (
        <div className="switch-button ml-3">
            <label htmlFor={id} className={title && 'hint-text'} title={t(title)}>
                {t(label)}
            </label>
            <input
                hidden={true}
                checked={checked}
                id={id}
                name={id}
                type="checkbox"
                value="ON"
                onChange={handleOnChangeInput}
            />
            <Switch.Root id={id} className="switch-button-switch" checked={checked} onCheckedChange={onChange}>
                <Switch.Thumb className="switch-button-thumb" />
            </Switch.Root>
        </div>
    );
}
