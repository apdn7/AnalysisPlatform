import { useCallback, useEffect, useRef, useState } from 'react';

import {
    buildLayoutStateKey,
    buildReindexMapping,
    buildSwapMapping,
    compactLayoutState,
    getItemIdFromKey,
    getValueFromKey,
    isPrimaryValue,
    parseAnySubplotValue,
} from '@/pages/multi-axis-plot/layoutStateLogic.ts';

export type LayoutData = {
    x_axis: number | null;
    lab: number | null;
    lab_x: number | null;
    color: number | null;
    color_x: number | null;
    color_imb: number | null;
    color_imb_x: number | null;
    y_axis_mode?: string;
    sub_plots: SubPlot[];
    x_datatype: any;
};

type LayoutItemMeta = {
    itemId: string | number;
    groupId?: string | number;
    datatype: string;
    isCategory: boolean;
    isDummyDatetime: boolean;
    layoutOrder: number;
};

export type SubPlot = {
    order: number;
    primary?: number;
    lab?: number;
    color?: number;
    color_imb?: number;
    main?: number[];
    sub?: number[];
    add?: number[];
    step?: number[];
};

const COMMON_FIELD_MAP: Record<string, keyof Omit<LayoutData, 'sub_plots' | 'x_datatype' | 'y_axis_mode'>> = {
    x_axis: 'x_axis',
    lab: 'lab',
    lab_x: 'lab_x',
    color: 'color',
    color_x: 'color_x',
    color_imb: 'color_imb',
    color_imb_x: 'color_imb_x',
};

const X_AXIS_LAYOUT_FIELDS = ['x_axis', 'lab_x', 'color_x', 'color_imb_x'] as const;
type XAxisLayoutField = (typeof X_AXIS_LAYOUT_FIELDS)[number];

const isXAxisLayoutField = (value?: string): value is XAxisLayoutField =>
    X_AXIS_LAYOUT_FIELDS.includes(value as XAxisLayoutField);

const SUBPLOT_SINGLE_FIELD_MAP: Record<string, keyof Pick<SubPlot, 'lab' | 'color' | 'color_imb'>> = {
    lab: 'lab',
    color: 'color',
    color_imb: 'color_imb',
};

const SUBPLOT_MULTI_FIELD_MAP: Record<string, keyof Pick<SubPlot, 'main' | 'sub' | 'add' | 'step'>> = {
    main: 'main',
    sub: 'sub',
    add: 'add',
    step: 'step',
};

const hasLayoutGroup = (groupId: string | number | undefined | null): groupId is string | number =>
    groupId !== undefined && groupId !== null;

export function useLayoutConfigData() {
    const layoutStateRef = useRef<Record<string, string>>({});
    const layoutMetaRef = useRef<Record<string, LayoutItemMeta>>({});
    const autoSelectedXAxisRef = useRef<string | null>(null);
    const [layout, setLayout] = useState<Partial<LayoutData>>({
        sub_plots: [],
    });

    const stringifyLayoutItem = (meta: LayoutItemMeta) =>
        JSON.stringify({
            itemId: meta.itemId,
            groupId: meta.groupId,
            datatype: meta.datatype,
            isCategory: meta.isCategory,
            isDummyDatetime: meta.isDummyDatetime,
            layoutOrder: meta.layoutOrder,
        });

    const collectLayoutData = useCallback((): Partial<LayoutData> => {
        const layout: Partial<LayoutData> = {
            sub_plots: [],
        };

        const subPlotsMap: Record<number, SubPlot> = {};
        let xDateType: string = 'DATETIME';
        for (const [key, item] of Object.entries(layoutStateRef.current)) {
            const { itemId, datatype, isCategory } = JSON.parse(item);
            const columnId = Number(itemId);
            const value = getValueFromKey(key);

            // Common layout fields
            if (COMMON_FIELD_MAP[value] !== undefined) {
                layout[COMMON_FIELD_MAP[value]] = columnId;
                if (isXAxisLayoutField(value)) {
                    xDateType = isCategory ? 'CAT' : datatype;
                }
                continue;
            }

            // Primary: value is '1'~'6'
            if (isPrimaryValue(value)) {
                const order = Number(value);
                if (!subPlotsMap[order]) subPlotsMap[order] = { order };
                subPlotsMap[order].primary = columnId;
                continue;
            }

            // Sub-plot fields: '1lab', '2color_imb', '3add'...
            const parsed = parseAnySubplotValue(value);
            if (parsed) {
                const { order, field: fieldKey } = parsed;
                if (!subPlotsMap[order]) subPlotsMap[order] = { order };

                // Single value fields: lab, color, color_imb
                if (SUBPLOT_SINGLE_FIELD_MAP[fieldKey] !== undefined) {
                    const field = SUBPLOT_SINGLE_FIELD_MAP[fieldKey];
                    subPlotsMap[order][field] = columnId;
                    continue;
                }

                // Multi value fields: main, sub, add, step
                if (SUBPLOT_MULTI_FIELD_MAP[fieldKey] !== undefined) {
                    const field = SUBPLOT_MULTI_FIELD_MAP[fieldKey];
                    if (!subPlotsMap[order][field]) {
                        subPlotsMap[order][field] = [];
                    }
                    (subPlotsMap[order][field] as number[]).push(columnId);
                    continue;
                }
            }
        }

        layout.sub_plots = Object.values(subPlotsMap).sort((a, b) => a.order - b.order);
        layout.x_datatype = xDateType;
        return layout;
    }, []);

    const selectDefaultXAxis = useCallback(() => {
        const currentXAxisKey = Object.keys(layoutStateRef.current).find((key) =>
            isXAxisLayoutField(getValueFromKey(key)),
        );
        if (currentXAxisKey && currentXAxisKey !== autoSelectedXAxisRef.current) return;

        const columns = Object.values(layoutMetaRef.current)
            .filter((column) => String(column.groupId) === '1')
            .sort((a, b) => a.layoutOrder - b.layoutOrder);
        const datetimeColumn = columns.find((column) => column.datatype === 'DATETIME' && !column.isDummyDatetime);
        const labXColumn = columns.find((column) => column.isCategory);
        const defaultColumn = datetimeColumn ?? labXColumn;
        if (!defaultColumn) return;

        const defaultValue = datetimeColumn ? 'x_axis' : 'lab_x';
        const defaultKey = buildLayoutStateKey(defaultValue, defaultColumn.itemId);
        if (currentXAxisKey === defaultKey) return;

        if (currentXAxisKey) {
            delete layoutStateRef.current[currentXAxisKey];
            const previousItemId = getItemIdFromKey(currentXAxisKey);
            document.dispatchEvent(
                new CustomEvent('layoutDefaultSelected', {
                    detail: {
                        itemId: previousItemId,
                        value: '',
                    },
                }),
            );
        }

        layoutStateRef.current[defaultKey] = stringifyLayoutItem(defaultColumn);
        autoSelectedXAxisRef.current = defaultKey;
        document.dispatchEvent(
            new CustomEvent('layoutDefaultSelected', {
                detail: {
                    itemId: defaultColumn.itemId,
                    value: defaultValue,
                },
            }),
        );
        setLayout(collectLayoutData());
    }, [collectLayoutData]);

    const registerLayoutColumn = useCallback(
        (meta: LayoutItemMeta) => {
            layoutMetaRef.current[String(meta.itemId)] = {
                ...meta,
                layoutOrder: meta.layoutOrder ?? Number.MAX_SAFE_INTEGER,
            };
            selectDefaultXAxis();
        },
        [selectDefaultXAxis],
    );

    const resetLayoutRefs = useCallback(() => {
        layoutStateRef.current = {};
        layoutMetaRef.current = {};
        autoSelectedXAxisRef.current = null;
        window.pendingLayoutColumns = [];
    }, []);

    const removeLayoutGroup = useCallback((groupId: string | number) => {
        const targetGroupId = String(groupId);
        const nextLayoutState: Record<string, string> = {};
        for (const [key, item] of Object.entries(layoutStateRef.current)) {
            const layoutItem = JSON.parse(item);
            if (String(layoutItem.groupId) !== targetGroupId) {
                nextLayoutState[key] = item;
            } else if (key === autoSelectedXAxisRef.current) {
                autoSelectedXAxisRef.current = null;
            }
        }
        layoutStateRef.current = nextLayoutState;

        layoutMetaRef.current = Object.fromEntries(
            Object.entries(layoutMetaRef.current).filter(([, meta]) => String(meta.groupId) !== targetGroupId),
        );

        window.pendingLayoutColumns = window.pendingLayoutColumns?.filter(
            (column) => String(column.groupId) !== targetGroupId,
        );
    }, []);

    const applyReindexMapping = useCallback((mapping: Record<string, string>) => {
        if (Object.keys(mapping).length === 0) return false;

        const newState: Record<string, string> = {};
        for (const [key, item] of Object.entries(layoutStateRef.current)) {
            const value = getValueFromKey(key);
            const newValue = mapping[value];

            if (newValue === undefined) {
                newState[key] = item;
            } else if (newValue === '') {
                continue;
            } else {
                newState[buildLayoutStateKey(newValue, getItemIdFromKey(key))] = item;
            }
        }

        layoutStateRef.current = newState;
        document.dispatchEvent(new CustomEvent('layoutReindex', { detail: { mapping } }));
        return true;
    }, []);

    useEffect(() => {
        const handleColumnRegistered = (e: Event) => {
            const { itemId, groupId, datatype, isCategory, isDummyDatetime, layoutOrder } = (e as CustomEvent).detail;
            registerLayoutColumn({
                itemId,
                groupId,
                datatype,
                isCategory,
                isDummyDatetime,
                layoutOrder,
            });
        };

        document.addEventListener('layoutColumnRegistered', handleColumnRegistered);
        return () => document.removeEventListener('layoutColumnRegistered', handleColumnRegistered);
    }, [registerLayoutColumn]);

    useEffect(() => {
        window.registerLayoutColumn = registerLayoutColumn;
        window.pendingLayoutColumns?.forEach(registerLayoutColumn);
        window.pendingLayoutColumns = [];

        return () => {
            delete window.registerLayoutColumn;
        };
    }, [registerLayoutColumn]);

    useEffect(() => {
        const handleLayoutChange = (e: Event) => {
            const { value, previousValue, itemId, groupId, datatype, isCategory, isDummyDatetime, layoutOrder } = (
                e as CustomEvent
            ).detail;

            if (previousValue) {
                delete layoutStateRef.current[buildLayoutStateKey(previousValue, itemId)];
            }

            if (value !== '') {
                layoutStateRef.current[buildLayoutStateKey(value, itemId)] = stringifyLayoutItem({
                    itemId,
                    groupId,
                    datatype,
                    isCategory,
                    isDummyDatetime,
                    layoutOrder,
                });
            }

            if (isXAxisLayoutField(value) || isXAxisLayoutField(previousValue)) {
                autoSelectedXAxisRef.current = null;
            }

            setLayout(collectLayoutData());

            // check Select of MAP when layout selected
            const selectElement: HTMLInputElement = document.getElementById(
                `categoryFilter-${itemId}`,
            ) as HTMLInputElement;

            if (selectElement) {
                if (value == '') {
                    selectElement.checked = false;
                } else if (!Number(value)) {
                    selectElement.checked = true;
                }
            }
        };

        document.addEventListener('layoutchange', handleLayoutChange);
        return () => document.removeEventListener('layoutchange', handleLayoutChange);
    }, []);

    useEffect(() => {
        const handleProcessChanged = (e: Event) => {
            const { groupId } = (e as CustomEvent).detail ?? {};
            if (!hasLayoutGroup(groupId)) {
                resetLayoutRefs();
                setLayout({ sub_plots: [] });
                return;
            }

            removeLayoutGroup(groupId);
            const compacted = compactLayoutState(layoutStateRef.current);
            layoutStateRef.current = compacted.state;
            document.dispatchEvent(
                new CustomEvent('layoutReindex', {
                    detail: {
                        mapping: compacted.mapping,
                        itemMapping: compacted.itemMapping,
                    },
                }),
            );
            setLayout(collectLayoutData());
        };

        document.addEventListener('processChanged', handleProcessChanged);
        return () => document.removeEventListener('processChanged', handleProcessChanged);
    }, [collectLayoutData, removeLayoutGroup, resetLayoutRefs]);

    useEffect(() => {
        const handleRemovePrimary = (e: Event) => {
            const { removedOrder } = (e as CustomEvent).detail;

            const mapping = buildReindexMapping(layoutStateRef.current, removedOrder);
            if (!applyReindexMapping(mapping)) return;
            setLayout(collectLayoutData());
        };

        document.addEventListener('layoutRemovePrimary', handleRemovePrimary);
        return () => document.removeEventListener('layoutRemovePrimary', handleRemovePrimary);
    }, [applyReindexMapping, collectLayoutData]);

    useEffect(() => {
        const handleSwapSubplot = (e: Event) => {
            const { fromOrder, toOrder } = (e as CustomEvent).detail;
            const mapping = buildSwapMapping(layoutStateRef.current, fromOrder, toOrder);
            if (!applyReindexMapping(mapping)) return;
            setLayout(collectLayoutData());
        };

        document.addEventListener('layoutSwapSubplot', handleSwapSubplot);
        return () => document.removeEventListener('layoutSwapSubplot', handleSwapSubplot);
    }, [applyReindexMapping, collectLayoutData]);

    return { layout, collectLayoutData, getLayoutState: () => layoutStateRef.current };
}
