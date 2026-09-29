import { useEffect, useState } from 'react';

import styles from './GroupButton.module.scss';

interface Props {
    group: string[];
    onChange?: (value: string) => void;
    activeValue?: string;
    labels?: string[];
}

export default function GroupButton({ onChange, group = [], labels = [], activeValue = '' }: Props) {
    const [active, setActive] = useState(activeValue);

    useEffect(() => {
        setActive(activeValue);
    }, [activeValue]);

    useEffect(() => {
        onChange?.(active);
    }, [active]);
    return (
        <div className={`d-flex flex-row ${styles['group-btn-set']}`}>
            {group.map((value, index) => {
                const activeClass = active === value ? styles.active : '';
                return (
                    <button
                        type="button"
                        onClick={() => setActive(value)}
                        className={`btn btn-sm ${styles['group-btn']} ${activeClass}`}
                        data-active={active === value}
                    >
                        {labels[index] || value}
                    </button>
                );
            })}
        </div>
    );
}
