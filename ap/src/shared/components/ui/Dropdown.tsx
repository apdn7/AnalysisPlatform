import { Fragment, useEffect, useState } from 'react';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export type DropdownItem = {
    label: string;
    value: string;
};

function renderItem(item: DropdownItem, onSelect: (value: string) => void) {
    return (
        <DropdownMenu.Item
            key={item.value}
            className="layout-dropdown-item"
            textValue={item.label}
            onSelect={() => onSelect(item.value)}
        >
            {item.label}
        </DropdownMenu.Item>
    );
}

function renderDividerItem(key: string) {
    return <DropdownMenu.Separator key={key} className="layout-dropdown-separator" />;
}

export type DropdownProps = {
    value?: string;
    itemGroups?: DropdownItem[][];
    nestedGroups?: DropdownItem[];
    nestedItems?: DropdownItem[];
    onValueChange?: (value: string) => void;
};

export default function Dropdown({
    value = '',
    itemGroups = [],
    nestedGroups = [],
    nestedItems = [],
    onValueChange,
}: DropdownProps) {
    const selectedLabel = (() => {
        // Search in itemGroups first.
        const flatItem = itemGroups.flat().find((item) => item.value === value);
        if (flatItem) return flatItem.label;

        // Search nested: value = group.value + item.value
        for (const group of nestedGroups) {
            for (const item of nestedItems) {
                const nestedValue = `${group.value}${item.value}`;
                if (nestedValue === value) {
                    return `${group.label}${item.label}`;
                }
            }
        }

        return value;
    })();

    const handleSelect = (val: string) => {
        onValueChange?.(val);
    };

    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
                <button type="button" className="layout-dropdown-trigger" title={value}>
                    {selectedLabel ? selectedLabel : '---'}
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="layout-dropdown-content"
                    align="start"
                    collisionPadding={4}
                    loop
                    sideOffset={0}
                >
                    {itemGroups.length > 0 && (
                        <>
                            <DropdownMenu.Group>
                                {itemGroups[0]?.map((item) => renderItem(item, handleSelect))}
                            </DropdownMenu.Group>

                            {itemGroups.slice(1).map((items, index) => (
                                <Fragment key={`group-${index}`}>
                                    {renderDividerItem(`divider-${index}`)}
                                    <DropdownMenu.Group>
                                        {items.map((item) => renderItem(item, handleSelect))}
                                    </DropdownMenu.Group>
                                </Fragment>
                            ))}
                        </>
                    )}

                    {nestedGroups.length > 0 && (
                        <>
                            {renderDividerItem('divider-nested')}
                            {nestedGroups.map((group) => (
                                <DropdownMenu.Sub key={group.value}>
                                    <DropdownMenu.SubTrigger className="layout-dropdown-item layout-dropdown-sub-trigger">
                                        {group.label} &gt;
                                    </DropdownMenu.SubTrigger>

                                    <DropdownMenu.Portal>
                                        <DropdownMenu.SubContent
                                            className="layout-dropdown-content layout-dropdown-sub-content"
                                            alignOffset={-2}
                                            collisionPadding={4}
                                            loop
                                            sideOffset={2}
                                        >
                                            <DropdownMenu.Group>
                                                {nestedItems.map((item) =>
                                                    renderItem(
                                                        {
                                                            label: item.label,
                                                            value: `${group.value}${item.value}`,
                                                        },
                                                        handleSelect,
                                                    ),
                                                )}
                                            </DropdownMenu.Group>
                                        </DropdownMenu.SubContent>
                                    </DropdownMenu.Portal>
                                </DropdownMenu.Sub>
                            ))}
                        </>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
