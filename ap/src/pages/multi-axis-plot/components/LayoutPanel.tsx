import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as Popover from '@radix-ui/react-popover';

import { getDisplayLabel } from '@/pages/multi-axis-plot/layoutLabels.ts';
import {
    type ValidationResult,
    getItemIdFromKey,
    getLayoutPriorityOrder,
    getMaxUsedOrder,
    getNextAvailableSubplot,
    getValueFromKey,
    isPrimaryValue,
    validateLayoutChange,
} from '@/pages/multi-axis-plot/layoutStateLogic.ts';
import ConfirmModal from '@/shared/components/ui/ConfirmModal.tsx';
import { isActiveReactContainer } from '@/shared/virtualListLifecycle';

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
    restoreLayout?: boolean;
};

type LayoutChangeMeta = Pick<
    Required<LayoutVariableCellProps>,
    'itemId' | 'groupId' | 'datatype' | 'isCategory' | 'isDummyDatetime' | 'layoutOrder'
>;

// Virtual-list rows are unmounted and mounted again with a new React root when they scroll back
// into view, so the initial value is restored from the layout store instead of starting empty.
const getStoredLayoutValue = (itemId: string | number): string => {
    const layoutState = window.getLayoutState?.() ?? {};
    const key = Object.keys(layoutState).find((stateKey) => getItemIdFromKey(stateKey) === String(itemId));
    return key ? getValueFromKey(key) : '';
};

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

    const [storedValue] = useState(() => getStoredLayoutValue(itemId));
    const [selected, setSelected] = useState(storedValue ? isPrimaryValue(storedValue) : isSelected);
    const [currentValue, setCurrentValue] = useState(storedValue);
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
        setOrder(getLayoutPriorityOrder(currentValue));
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
            if (!isPanelActive()) return;
            const { mapping, itemMapping } = (e as CustomEvent).detail;
            const newValue = itemMapping?.[String(itemId)] ?? mapping[currentValueRef.current];

            if (newValue === undefined) return;
            currentValueRef.current = newValue;

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
            if (!isPanelActive()) return;
            const { itemId: targetItemId, value } = (e as CustomEvent).detail;
            if (String(targetItemId) !== String(itemId)) return;
            currentValueRef.current = value;
            setCurrentValue(value);
        };

        document.addEventListener('layoutDefaultSelected', handleDefaultSelected);
        return () => document.removeEventListener('layoutDefaultSelected', handleDefaultSelected);
    }, [itemId]);

    useEffect(() => {
        const handleCheckChange = (e: Event) => {
            if (!isPanelActive()) return;
            const detail = (e as CustomEvent<LayoutCheckChangeDetail>).detail;
            if (!detail || !isCheckChangeForCurrentPanel(detail)) return;

            if (detail.restoreLayout) {
                selectedRef.current = detail.isChecked;
                setSelected(detail.isChecked);
                return;
            }
            applyCheckedState(detail.isChecked);
        };

        document.addEventListener('layoutCheckChange', handleCheckChange);
        return () => document.removeEventListener('layoutCheckChange', handleCheckChange);
    }, [groupId, itemId]);

    useEffect(() => {
        const handleForceReset = (e: Event) => {
            if (!isPanelActive()) return;
            const { targetItemId } = (e as CustomEvent).detail;
            if (String(targetItemId) !== String(itemId)) return;

            resetCurrentValue(true);
        };

        document.addEventListener('layoutForceReset', handleForceReset);
        return () => document.removeEventListener('layoutForceReset', handleForceReset);
    }, [itemId]);

    const dispatchLayoutChange = (value: string, previousValue: string, skipSwap = false) => {
        const { itemId, groupId, datatype, isCategory, isDummyDatetime, layoutOrder } = layoutChangeMetaRef.current;
        const row = inputRef.current?.closest('li');
        if (row) {
            if (value) {
                delete row.dataset.recentlyUnchecked;
            } else if (previousValue) {
                row.dataset.recentlyUnchecked = 'true';
            }
        }
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

    const isPanelActive = () => isActiveReactContainer(inputRef.current);

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
        currentValueRef.current = String(nextOrder);
        setCurrentValue(String(nextOrder));
    };

    const rollbackCheckedState = () => {
        setSelected(false);
        uncheckColumn();
    };

    const resetCurrentValue = (skipSwap: boolean) => {
        const removedValue = currentValueRef.current;
        currentValueRef.current = '';
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
        // The default may have been selected before this virtual row mounted.
        const key = Object.keys(window.getLayoutState?.() ?? {}).find(
            (key) => getItemIdFromKey(key) === String(itemId),
        );
        const value = key === undefined ? '' : getValueFromKey(key);
        currentValueRef.current = value;
        setCurrentValue(value);
        selectedRef.current = isPrimaryValue(value);
        setSelected(isPrimaryValue(value));
        // Declared after the event listeners above, so every listener is attached at this point.
        // Variable Select waits for this marker before writing layout values from outside.
        inputRef.current?.setAttribute('data-layout-ready', 'true');
    }, [itemId, groupId, datatype, isCategory, isDummyDatetime, layoutOrder]);

    const applyValue = (newValue: string, skipSwap = false) => {
        dispatchLayoutChange(newValue, currentValueRef.current, skipSwap);
        currentValueRef.current = newValue;
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

    const overrideLayoutValue = (newValue: string, result: ValidationResult, skipSwap = false) => {
        for (const targetItemId of result.conflictItemIds) {
            document.dispatchEvent(
                new CustomEvent('layoutForceReset', {
                    detail: { targetItemId },
                }),
            );
        }
        // Apply new value
        applyValue(newValue, skipSwap);

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

    const handleInputChangeLayoutValue = (e: SyntheticEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        // Restoring a saved value must not toggle selection or swap an entire subplot.
        const result = validateLayoutChange(value, itemId, window.getLayoutState?.() ?? {});
        if (result.isValid) {
            applyValue(value, true);
        } else {
            overrideLayoutValue(value, result, true);
        }
        const isPrimary = /^[1-6]$/.test(value);
        selectedRef.current = isPrimary;
        setSelected(isPrimary);
        setOrder(getLayoutPriorityOrder(value));
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
        const virtualCheckbox = inputRef.current
            ?.closest('li[data-virtual-row]')
            ?.querySelector<HTMLInputElement>('.main-checkbox');
        const checkbox = virtualCheckbox
            ? $(virtualCheckbox)
            : $(`input[name=GET02_VALS_SELECT${groupId}][value="${itemId}"]`);
        checkbox.prop('checked', false).trigger('change');
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
                            readOnly
                            onInput={handleInputChangeLayoutValue}
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
