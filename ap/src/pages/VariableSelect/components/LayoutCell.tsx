import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as Popover from '@radix-ui/react-popover';

import LayoutPanelContent from '@/pages/multi-axis-plot/components/LayoutPanelContent.tsx';
import { getDisplayLabel } from '@/pages/multi-axis-plot/layoutLabels.ts';
import type { ValidationResult } from '@/pages/multi-axis-plot/layoutStateLogic.ts';
import ConfirmModal from '@/shared/components/ui/ConfirmModal.tsx';

export interface LayoutCellProps {
    value: string;
    /** The row is plotted, so the panel offers primary subplots only, like the end process cell. */
    selected: boolean;
    maxOrder: number;
    isCategory?: boolean;
    datatype?: string;
    /** Validates a subplot field against the whole draft; not used while the row is plotted. */
    validate: (value: string) => ValidationResult;
    onSelect: (value: string) => void;
    onOverride: (value: string, conflictItemIds: string[]) => void;
}

/**
 * Layout cell of the Variable Select modal. It reuses the end process panel UI and validation but
 * keeps every change inside the modal draft: no document events, no `layoutInput` element.
 */
export default function LayoutCell({
    value,
    selected,
    maxOrder,
    isCategory,
    datatype,
    validate,
    onSelect,
    onOverride,
}: LayoutCellProps) {
    const { t } = useTranslation();
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const [pendingValue, setPendingValue] = useState<string | null>(null);
    const [conflictInfo, setConflictInfo] = useState<ValidationResult | null>(null);

    const handleValueChange = (newValue: string) => {
        setOpen(false);
        // Plotted rows own a primary subplot; swapping and clearing are decided by the parent.
        if (selected || newValue === '') {
            onSelect(newValue);
            return;
        }

        const result = validate(newValue);
        if (!result.isValid) {
            setPendingValue(newValue);
            setConflictInfo(result);
            return;
        }

        onSelect(newValue);
    };

    const handleCancelOverride = () => {
        setPendingValue(null);
        setConflictInfo(null);
    };

    const handleConfirmOverride = () => {
        if (pendingValue === null || conflictInfo === null) return;
        onOverride(pendingValue, conflictInfo.conflictItemIds);
        handleCancelOverride();
    };

    return (
        <>
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button
                        ref={triggerRef}
                        type="button"
                        className="layout-variable-cell__trigger variable-select-layout-cell"
                        data-layout-value={value}
                    >
                        <span className="display-layout-value">{getDisplayLabel(value)}</span>
                    </button>
                </Popover.Trigger>

                {/* Portal inside the Bootstrap modal element: its focus trap would otherwise move
                    focus out of the popover and Radix would dismiss it immediately. */}
                <Popover.Portal container={triggerRef.current?.closest<HTMLElement>('.modal') ?? undefined}>
                    <Popover.Content
                        className={`layout-variable-cell__panel-wrapper ${
                            selected ? 'layout-variable-cell__panel-wrapper--small' : ''
                        }`}
                        align="start"
                        avoidCollisions
                        sticky="always"
                        sideOffset={4}
                        collisionPadding={8}
                        data-layout-ui
                    >
                        <LayoutPanelContent
                            currentValue={value}
                            selected={selected}
                            maxOrder={maxOrder}
                            isCategory={isCategory}
                            datatype={datatype}
                            onSelect={handleValueChange}
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
