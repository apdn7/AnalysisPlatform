import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as Popover from '@radix-ui/react-popover';

import {
    type ValidationResult,
    getMaxUsedOrder,
    getNextAvailableSubplot,
    validateLayoutChange,
} from '@/pages/multi-axis-plot/layoutStateLogic.ts';
import ConfirmModal from '@/shared/components/ui/ConfirmModal.tsx';

import LayoutPanelContent from './LayoutPanelContent.tsx';

export type LayoutVariableCellProps = {
    itemId?: string | number;
    groupId?: string | number;
    isSelected?: boolean;
    datatype?: string;
    isCategory?: boolean;
    isDummyDatetime?: boolean;
    layoutOrder?: number;
};

type LayoutCheckChangeDetail = {
    checkedItemId: string | number;
    checkedGroupId?: string | number;
    isChecked: boolean;
};

type LayoutChangeMeta = Pick<
    Required<LayoutVariableCellProps>,
    'itemId' | 'groupId' | 'datatype' | 'isCategory' | 'isDummyDatetime' | 'layoutOrder'
>;

const VALUE_LABEL_MAP: Record<string, string> = {
    x_axis: 'X-axis',
    lab: 'Lab',
    lab_x: 'LabX',
    color: 'Color',
    color_x: 'ColorX',
    color_imb: 'ColImb',
    color_imb_x: 'ColImbX',
};

function getDisplayLabel(value: string): string {
    if (!value) return '---';
    if (VALUE_LABEL_MAP[value]) return VALUE_LABEL_MAP[value];

    const match = value.match(/^([1-6])(.+)$/);
    if (match) {
        const [, num, field] = match;
        const fieldLabelMap: Record<string, string> = {
            lab: 'Lab',
            step: 'Step',
            main: 'Main',
            sub: '-2nd',
            add: 'Auto',
            color: 'Color',
            color_imb: 'ColImb',
        };
        return `${num}${fieldLabelMap[field] ?? field}`;
    }

    return value;
}

export default function LayoutPanel({
    itemId = '',
    groupId = '',
    isSelected = false,
    datatype = '',
    isCategory = false,
    isDummyDatetime = false,
    layoutOrder = 0,
}: LayoutVariableCellProps) {
    const { t } = useTranslation();

    const [selected, setSelected] = useState(isSelected);
    const [currentValue, setCurrentValue] = useState('');
    const currentValueRef = useRef(currentValue);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [order, setOrder] = useState(null);
    const selectedRef = useRef(selected);
    const layoutChangeMetaRef = useRef<LayoutChangeMeta>({
        itemId,
        groupId,
        datatype,
        isCategory,
        isDummyDatetime,
        layoutOrder,
    });
    const [open, setOpen] = useState(false);
    const [maxOrder, setMaxOrder] = useState(0);

    const [pendingValue, setPendingValue] = useState<string | null>(null);
    const [conflictInfo, setConflictInfo] = useState<ValidationResult | null>(null);

    const inputId = 'reactlayout-' + itemId;

    useEffect(() => {
        currentValueRef.current = currentValue;
        setOrder(getOrderDropDown(currentValue));
    }, [currentValue]);

    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    useEffect(() => {
        layoutChangeMetaRef.current = {
            itemId,
            groupId,
            datatype,
            isCategory,
            isDummyDatetime,
            layoutOrder,
        };
    }, [datatype, groupId, isCategory, isDummyDatetime, itemId, layoutOrder]);

    useEffect(() => {
        const handleReindex = (e: Event) => {
            if (!isPanelConnected()) return;
            const { mapping, itemMapping } = (e as CustomEvent).detail;
            const newValue = itemMapping?.[String(itemId)] ?? mapping[currentValueRef.current];

            if (newValue === undefined) return;

            if (newValue === '') {
                setCurrentValue('');
            } else {
                setCurrentValue(newValue);
            }
        };

        document.addEventListener('layoutReindex', handleReindex);
        return () => document.removeEventListener('layoutReindex', handleReindex);
    }, [itemId]);

    useEffect(() => {
        const handleDefaultSelected = (e: Event) => {
            if (!isPanelConnected()) return;
            const { itemId: targetItemId, value } = (e as CustomEvent).detail;
            if (String(targetItemId) !== String(itemId)) return;
            setCurrentValue(value);
        };

        document.addEventListener('layoutDefaultSelected', handleDefaultSelected);
        return () => document.removeEventListener('layoutDefaultSelected', handleDefaultSelected);
    }, [itemId]);

    useEffect(() => {
        const handleCheckChange = (e: Event) => {
            if (!isPanelConnected()) return;
            const detail = (e as CustomEvent<LayoutCheckChangeDetail>).detail;
            if (!detail || !isCheckChangeForCurrentPanel(detail)) return;

            applyCheckedState(detail.isChecked);
        };

        document.addEventListener('layoutCheckChange', handleCheckChange);
        return () => document.removeEventListener('layoutCheckChange', handleCheckChange);
    }, [groupId, itemId]);

    useEffect(() => {
        const handleForceReset = (e: Event) => {
            if (!isPanelConnected()) return;
            const { targetItemId } = (e as CustomEvent).detail;
            if (String(targetItemId) !== String(itemId)) return;

            resetCurrentValue(true);
        };

        document.addEventListener('layoutForceReset', handleForceReset);
        return () => document.removeEventListener('layoutForceReset', handleForceReset);
    }, [itemId]);

    const dispatchLayoutChange = (value: string, previousValue: string, skipSwap = false) => {
        const { itemId, groupId, datatype, isCategory, isDummyDatetime, layoutOrder } = layoutChangeMetaRef.current;
        document.dispatchEvent(
            new CustomEvent('layoutchange', {
                detail: {
                    value,
                    previousValue,
                    itemId,
                    groupId,
                    datatype,
                    isCategory,
                    isDummyDatetime,
                    layoutOrder,
                    skipSwap,
                },
            }),
        );
    };

    const isPanelConnected = () => inputRef.current?.isConnected ?? false;

    const isCheckChangeForCurrentPanel = (detail: LayoutCheckChangeDetail) => {
        if (String(detail.checkedItemId) !== String(itemId)) return false;
        if (detail.checkedGroupId === undefined) return false;
        return String(detail.checkedGroupId) === String(groupId);
    };

    const applyCheckedState = (isChecked: boolean) => {
        setSelected(isChecked);

        if (!isChecked) {
            resetCurrentValue(false);
            return;
        }

        assignNextPrimarySubplot();
    };

    const assignNextPrimarySubplot = () => {
        const layoutState = window.getLayoutState?.() ?? {};
        const nextOrder = getNextAvailableSubplot(layoutState);

        if (nextOrder === null) {
            rollbackCheckedState();
            return;
        }

        dispatchLayoutChange(String(nextOrder), currentValueRef.current, true);
        setCurrentValue(String(nextOrder));
    };

    const rollbackCheckedState = () => {
        setSelected(false);
        uncheckColumn();
    };

    const resetCurrentValue = (skipSwap: boolean) => {
        const removedValue = currentValueRef.current;
        if (removedValue) {
            dispatchLayoutChange('', removedValue, skipSwap);
            const isBulk = (window as any).__layoutBulkOperation;
            // Send event reOrder
            if (/^[1-6]$/.test(removedValue) && !isBulk) {
                document.dispatchEvent(
                    new CustomEvent('layoutRemovePrimary', {
                        detail: { removedOrder: Number(removedValue) },
                    }),
                );
            }
        }
        setCurrentValue('');
    };

    useEffect(() => {
        const columnMeta = {
            itemId,
            groupId,
            datatype,
            isCategory,
            isDummyDatetime,
            layoutOrder,
        };
        if (window.registerLayoutColumn) {
            window.registerLayoutColumn(columnMeta);
        } else {
            window.pendingLayoutColumns = [...(window.pendingLayoutColumns ?? []), columnMeta];
        }
        document.dispatchEvent(
            new CustomEvent('layoutColumnRegistered', {
                detail: columnMeta,
            }),
        );
    }, [itemId, groupId, datatype, isCategory, isDummyDatetime, layoutOrder]);

    const applyValue = (newValue: string) => {
        dispatchLayoutChange(newValue, currentValue);
        setCurrentValue(newValue);
        setOpen(false);
    };

    const handleValueChange = (newValue: string, forceResetLayout: boolean = false) => {
        // Panel primary
        if (selected) {
            // Click '---' or currentValue → uncheck column
            if (newValue === '' || newValue === currentValue) {
                uncheckColumn();
                setOpen(false);
                return;
            }
            // Swap with the other primary → swap the whole subplot (primary + all config fields)
            document.dispatchEvent(
                new CustomEvent('layoutSwapSubplot', {
                    detail: { fromOrder: Number(currentValue), toOrder: Number(newValue) },
                }),
            );
            setOpen(false);
            return;
        }

        // Panel subplot fields: '---' → reset to ''
        if (newValue === '') {
            dispatchLayoutChange('', currentValue);
            setCurrentValue('');
            setOpen(false);
            return;
        }

        // Validate subplot fields
        const layoutState = window.getLayoutState?.() ?? {};
        const result = validateLayoutChange(newValue, itemId, layoutState);

        if (!result.isValid) {
            if (!forceResetLayout) {
                setPendingValue(newValue);
                setConflictInfo(result);
                setOpen(false);
                return;
            } else {
                overrideLayoutValue(newValue, result);
                return;
            }
        }

        applyValue(newValue);
    };

    const overrideLayoutValue = (newValue: string, result: ValidationResult) => {
        for (const targetItemId of result.conflictItemIds) {
            document.dispatchEvent(
                new CustomEvent('layoutForceReset', {
                    detail: { targetItemId },
                }),
            );
        }
        // Apply new value
        applyValue(newValue);

        setPendingValue(null);
        setConflictInfo(null);
    };

    const handleConfirmOverride = () => {
        if (pendingValue === null || conflictInfo === null) return;

        overrideLayoutValue(pendingValue, conflictInfo);
    };

    const handleCancelOverride = () => {
        setPendingValue(null);
        setConflictInfo(null);
    };

    const getOrderDropDown = (value) => {
        if (!value) return undefined;

        const orderPriority = ['', 'lab', 'step', 'main', 'sub', 'add', 'color', 'color_imb'];
        const match = value.match(/^(\d+)(lab|step|main|sub|add|color|color_imb)?$/);

        if (!match) {
            return 1;
        }

        const group = Number(match[1]) + 1;
        const offset = match[2] ?? '';

        return group + orderPriority.indexOf(offset) * 0.01;
    };

    const handleInputChangeLayoutValue = (e) => {
        const value = e.target.value;
        dispatchLayoutChange(value, currentValue);
        setCurrentValue(value);
        setOpen(false);
        setOrder(getOrderDropDown(value));
        handleValueChange(value, true);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            const layoutState = window.getLayoutState?.() ?? {};
            setMaxOrder(getMaxUsedOrder(layoutState));
        }
        setOpen(isOpen);
    };

    // Uncheck checkbox
    const uncheckColumn = () => {
        const $ = (window as any).$;
        if (!$) return;
        $(`input[name=GET02_VALS_SELECT${groupId}][value="${itemId}"]`).prop('checked', false).trigger('change');
    };

    return (
        <>
            <Popover.Root open={open} onOpenChange={handleOpenChange}>
                <Popover.Trigger asChild>
                    <button type="button" className="layout-variable-cell__trigger">
                        <input
                            ref={inputRef}
                            id={inputId}
                            name="layoutInput"
                            hidden={true}
                            type="text"
                            onChange={handleInputChangeLayoutValue}
                            value={currentValue}
                            data-priority-order={order}
                        />
                        <span className="display-layout-value">{getDisplayLabel(currentValue)}</span>
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        className={`layout-variable-cell__panel-wrapper ${selected ? 'layout-variable-cell__panel-wrapper--small' : ''}`}
                        align="start"
                        avoidCollisions
                        sticky="always"
                        sideOffset={4}
                        collisionPadding={8}
                        data-layout-ui
                    >
                        <LayoutPanelContent
                            currentValue={currentValue}
                            selected={selected}
                            maxOrder={maxOrder}
                            isCategory={isCategory}
                            datatype={datatype}
                            onSelect={(value) => handleValueChange(value)}
                        />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>

            <ConfirmModal
                isOpen={conflictInfo !== null}
                title="Layout conflict"
                onClose={handleCancelOverride}
                onConfirm={handleConfirmOverride}
                confirmLabel="Override"
                cancelLabel="Cancel"
                maxWidth={530}
            >
                <p className="mb-0 text-left" style={{ overflowWrap: 'anywhere' }}>
                    {conflictInfo ? t(conflictInfo.messageKey, conflictInfo.messageParams) : ''}
                </p>
            </ConfirmModal>
        </>
    );
}
