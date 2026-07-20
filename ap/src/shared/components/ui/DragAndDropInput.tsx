import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactSortable } from 'react-sortablejs';

export interface DragDropItem {
    id: string;
    label: string;
}

interface DragAndDropInputProps {
    value?: DragDropItem[];
    onChange?: (items: DragDropItem[]) => void;
    sourceItems: DragDropItem[];
    isInvalid?: boolean;
    errorMessage?: string;
}

const DragAndDropInput: React.FC<DragAndDropInputProps> = ({
    sourceItems = [],
    value = [],
    onChange,
    isInvalid = false,
    errorMessage = '',
}) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState<DragDropItem[]>(value);

    // Sync from outside: when parent changes value (load data, reset form)
    // Use `isSame` to avoid resetting when you have just finished dragging and dropping
    useEffect(() => {
        const isSame = value.length === selected.length && value.every((v, i) => v.id === selected[i]?.id);

        if (!isSame) {
            setSelected(value);
        }
    }, [value]);

    // sync to outside: notify parent when selected changes
    useEffect(() => {
        onChange?.(selected);
    }, [selected]);

    const availableItems = sourceItems.filter((item) => !selected.some((sel) => sel.id === item.id));

    const removeItem = (id?: string) => {
        setSelected((prev) => prev.filter((i) => i.id !== id));
    };

    return (
        <div className="filename-builder">
            <ReactSortable<DragDropItem>
                list={selected}
                setList={setSelected}
                group={{ name: 'shared', pull: true, put: true }}
                animation={150}
                className={`dropzone ${isInvalid ? 'is-invalid' : ''}`}
            >
                {selected.map((item) => (
                    <span key={item.id} data-id={item.id} className="chip">
                        {t(item.label)}
                        <button type="button" className="remove-btn" onClick={() => removeItem(item.id)}>
                            ✕
                        </button>
                    </span>
                ))}
            </ReactSortable>
            <ReactSortable<DragDropItem>
                list={availableItems}
                setList={() => {}}
                group={{
                    name: 'shared',
                    pull: 'clone',
                    put: true,
                }}
                sort={false}
                className="source-list"
            >
                {availableItems.map((item) => (
                    <span key={item.id} data-id={item.id} className="source-chip">
                        {t(item?.label)}
                    </span>
                ))}
            </ReactSortable>

            <input type="hidden" name="filenameFormat" value={JSON.stringify(selected)} readOnly />
            {isInvalid && errorMessage && <small className="text-danger">{t(errorMessage)}</small>}
        </div>
    );
};

export default DragAndDropInput;
