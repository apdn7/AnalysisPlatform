export type LayoutState = Record<string, string>; // key: `${value}_${itemId}`. ex: 1_12, 1main_23...

export type ParsedSubplot = { order: number; field: string };

// ═══ Key helpers (single source of truth for the key format) ═══
// '1main_12' → '1main'
export const getValueFromKey = (key: string): string => key.substring(0, key.lastIndexOf('_'));

// '1main_12' → '12'
export const getItemIdFromKey = (key: string): string => key.substring(key.lastIndexOf('_') + 1);

// ('1main', 12) → '1main_12'
export const buildLayoutStateKey = (value: string, itemId: string | number): string => `${value}_${itemId}`;

// ═══ Value parsing ═══
// Primary value: '1'~'6'
export const isPrimaryValue = (value: string): boolean => /^[1-6]$/.test(value);

// Any per-subplot value '<order><field>' → { order, field }. '1main'→{1,'main'}, '2lab'→{2,'lab'}.
// Returns null for primary values ('1'~'6') and non-subplot values.
export const parseAnySubplotValue = (value: string): ParsedSubplot | null => {
    const match = value.match(/^([1-6])(.+)$/);
    return match ? { order: Number(match[1]), field: match[2] } : null;
};

// Validation-specific: parses ONLY overlay/color fields (used by Rule 3 exclusion).
// '1main' → { order: 1, field: 'main' }; '1lab'/'1step' → null.
const parseSubplotValue = (value: string): ParsedSubplot | null => {
    const match = value.match(/^([1-6])(main|sub|add|color|color_imb)$/);
    return match ? { order: Number(match[1]), field: match[2] } : null;
};

// '1lab' → {order:1, field:'lab', group:'lab'}; '1color_imb' → {..., group:'color'}; null if not single-per-subplot.
const parseSinglePerSubplotValue = (value: string): (ParsedSubplot & { group: string }) | null => {
    const parsed = parseAnySubplotValue(value);
    if (!parsed) return null;
    const group = SINGLE_PER_SUBPLOT_GROUP[parsed.field];
    if (!group) return null;
    return { ...parsed, group };
};

// ═══ State queries ═══
const getUsedOrders = (state: LayoutState): number[] =>
    Object.keys(state).map(getValueFromKey).filter(isPrimaryValue).map(Number);

// Smallest unused primary subplot number (1-6), null if all are taken.
export function getNextAvailableSubplot(state: LayoutState): number | null {
    const usedOrders = new Set(getUsedOrders(state));
    for (let order = 1; order <= 6; order++) {
        if (!usedOrders.has(order)) return order;
    }
    return null;
}

// Highest primary subplot order currently in use (0 if none).
export function getMaxUsedOrder(state: LayoutState): number {
    return Math.max(0, ...getUsedOrders(state));
}

// Collect all values currently used by OTHER variables (excluding the given itemId)
const getValuesUsedByOthers = (state: LayoutState, itemId: string | number): Set<string> =>
    new Set(
        Object.keys(state)
            .filter((key) => getItemIdFromKey(key) !== String(itemId))
            .map(getValueFromKey),
    );

// itemIds holding any of these values (excl. excludeItemId) — the ones to reset.
const resolveItemIdsHoldingValues = (
    state: LayoutState,
    values: string[],
    excludeItemId: string | number,
): string[] => {
    const valueSet = new Set(values);
    return Object.keys(state)
        .filter((key) => valueSet.has(getValueFromKey(key)) && getItemIdFromKey(key) !== String(excludeItemId))
        .map(getItemIdFromKey);
};

// Keys in subplot `order` whose field is in `fields` (excl. current itemId); oldest first.
const getOverlayKeysInSubplot = (
    state: LayoutState,
    order: number,
    fields: Set<string>,
    excludeItemId: string | number,
): string[] =>
    Object.keys(state).filter((key) => {
        if (getItemIdFromKey(key) === String(excludeItemId)) return false;
        const p = parseAnySubplotValue(getValueFromKey(key));
        return p !== null && p.order === order && fields.has(p.field);
    });

// ═══ Validation rules ═══
const SINGLE_USE_FIELDS = new Set(['x_axis', 'lab', 'lab_x', 'color', 'color_x', 'color_imb', 'color_imb_x', 'step']);

const EXCLUSIVE_GROUPS = [
    ['x_axis', 'lab_x', 'color_x', 'color_imb_x'], // X-axis
    ['color', 'color_imb', 'color_x', 'color_imb_x'], // Color
    ['lab', 'lab_x'], // Label
];

// Per-subplot capacity limits
const MAX_SUB_PER_SUBPLOT = 3;
const MAX_OVERLAY_PER_SUBPLOT = 8;

// Per-subplot field groups
const SUBPLOT_OVERLAY_FIELDS = new Set(['main', 'sub', 'add']); // Rule 3: exclusive with color
const SUBPLOT_COLOR_FIELDS = new Set(['color', 'color_imb']);
const CAPACITY_FIELDS = new Set(['main', 'sub', 'add', 'step']); // Rule 4: counted toward the ≤ 8 limit

// Fields limited to one per subplot. Fields sharing a group are mutually exclusive within a subplot
// (iColor + iColImb share the "color" slot → only one of them per subplot).
const SINGLE_PER_SUBPLOT_GROUP: Record<string, string> = {
    lab: 'lab',
    color: 'color',
    color_imb: 'color',
};

const SINGLE_PER_SUBPLOT_GROUP_LABEL: Record<string, string> = {
    lab: 'Label',
    color: 'Color setting',
};

export type ValidationResult = {
    isValid: boolean;
    messageKey: string; // i18n key; '' when valid
    messageParams?: Record<string, string | number>; // interpolation params for t(messageKey, params)
    conflictItemIds: string[]; // itemIds to reset on Override; [] when valid
};

export function validateLayoutChange(newValue: string, itemId: string | number, state: LayoutState): ValidationResult {
    if (!newValue) return { isValid: true, messageKey: '', conflictItemIds: [] };

    const usedValues = getValuesUsedByOthers(state, itemId);

    // Rule 1: single-use field
    if (SINGLE_USE_FIELDS.has(newValue) && usedValues.has(newValue)) {
        return {
            isValid: false,
            messageKey: 'layout.error.alreadyUsed',
            messageParams: { value: newValue },
            conflictItemIds: resolveItemIdsHoldingValues(state, [newValue], itemId),
        };
    }

    // Rule 2: exclusive groups
    for (const group of EXCLUSIVE_GROUPS) {
        if (!group.includes(newValue)) continue;
        const conflicts = group.filter((f) => f !== newValue && usedValues.has(f));
        if (conflicts.length) {
            return {
                isValid: false,
                messageKey: 'layout.error.cannotUseWith',
                messageParams: { value: newValue, conflicts: conflicts.join(', ') },
                conflictItemIds: resolveItemIdsHoldingValues(state, conflicts, itemId),
            };
        }
    }

    // Rule 5: single-per-subplot slots (lab; color/color_imb share one color slot)
    const singlePerSubplot = parseSinglePerSubplotValue(newValue);
    if (singlePerSubplot) {
        const conflicts = [...usedValues].filter((v) => {
            const p = parseSinglePerSubplotValue(v);
            return p?.order === singlePerSubplot.order && p?.group === singlePerSubplot.group;
        });
        if (conflicts.length) {
            const label = SINGLE_PER_SUBPLOT_GROUP_LABEL[singlePerSubplot.group] ?? singlePerSubplot.group;
            return {
                isValid: false,
                messageKey: 'layout.error.onlyOnePerSubplot',
                messageParams: { order: singlePerSubplot.order, label },
                conflictItemIds: resolveItemIdsHoldingValues(state, conflicts, itemId),
            };
        }
    }

    // Rule 3: per-subplot overlay ↔ color are mutually exclusive
    const target = parseSubplotValue(newValue);
    if (target) {
        const sameSubplotValues = [...usedValues].filter((v) => parseSubplotValue(v)?.order === target.order);

        const isOverlay = SUBPLOT_OVERLAY_FIELDS.has(target.field);
        const isColor = SUBPLOT_COLOR_FIELDS.has(target.field);

        if (isOverlay || isColor) {
            const oppositeFields = isOverlay ? SUBPLOT_COLOR_FIELDS : SUBPLOT_OVERLAY_FIELDS;
            const conflicts = sameSubplotValues.filter((v) => oppositeFields.has(parseSubplotValue(v)!.field));
            if (conflicts.length) {
                return {
                    isValid: false,
                    messageKey: 'layout.error.overlayColorExclusive',
                    messageParams: { order: target.order },
                    conflictItemIds: resolveItemIdsHoldingValues(state, conflicts, itemId),
                };
            }
        }
    }

    // Rule 4: per-subplot capacity — Sub ≤ 3, Main + Sub + Add + Step ≤ 8.
    // Uses parseAnySubplotValue so step is included (parseSubplotValue's narrow regex skips it).
    // Override replaces the OLDEST variable → conflictItemIds holds a single oldest itemId.
    const capacityTarget = parseAnySubplotValue(newValue);
    if (capacityTarget && CAPACITY_FIELDS.has(capacityTarget.field)) {
        // Sub ≤ 3
        if (capacityTarget.field === 'sub') {
            const subKeys = getOverlayKeysInSubplot(state, capacityTarget.order, new Set(['sub']), itemId);
            if (subKeys.length >= MAX_SUB_PER_SUBPLOT) {
                return {
                    isValid: false,
                    messageKey: 'layout.error.maxSub',
                    messageParams: { order: capacityTarget.order, max: MAX_SUB_PER_SUBPLOT },
                    conflictItemIds: [getItemIdFromKey(subKeys[0])],
                };
            }
        }

        // Main + Sub + Add + Step ≤ 8
        const capacityKeys = getOverlayKeysInSubplot(state, capacityTarget.order, CAPACITY_FIELDS, itemId);
        if (capacityKeys.length >= MAX_OVERLAY_PER_SUBPLOT) {
            return {
                isValid: false,
                messageKey: 'layout.error.maxOverlay',
                messageParams: { order: capacityTarget.order, max: MAX_OVERLAY_PER_SUBPLOT },
                conflictItemIds: [getItemIdFromKey(capacityKeys[0])],
            };
        }
    }

    return { isValid: true, messageKey: '', conflictItemIds: [] };
}

// ═══ State transforms (pure: take state, return mappings/new state) ═══
// Builds the value changes after removing primary subplot `removedOrder`:
// - fields in the removed subplot → '' (reset)
// - subplots with order > removedOrder → shift down by 1
// Returns a mapping of oldValue → newValue ('' means reset).
export function buildReindexMapping(state: LayoutState, removedOrder: number): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const key of Object.keys(state)) {
        const value = getValueFromKey(key);

        if (isPrimaryValue(value)) {
            const order = Number(value);
            if (order > removedOrder) mapping[value] = String(order - 1);
            continue;
        }

        const parsed = parseAnySubplotValue(value);
        if (parsed) {
            if (parsed.order === removedOrder) mapping[value] = '';
            else if (parsed.order > removedOrder) mapping[value] = `${parsed.order - 1}${parsed.field}`;
        }
    }

    return mapping;
}

// Swaps two primary subplots, including ALL their config fields
// (primary + main/sub/add/lab/color/color_imb/step). Returns a mapping of oldValue → newValue.
export function buildSwapMapping(state: LayoutState, orderA: number, orderB: number): Record<string, string> {
    const mapping: Record<string, string> = {};
    const swapOrder = (order: number) => (order === orderA ? orderB : order === orderB ? orderA : null);

    for (const key of Object.keys(state)) {
        const value = getValueFromKey(key);

        if (isPrimaryValue(value)) {
            const swapped = swapOrder(Number(value));
            if (swapped !== null) mapping[value] = String(swapped);
            continue;
        }

        const parsed = parseAnySubplotValue(value);
        if (parsed) {
            const swapped = swapOrder(parsed.order);
            if (swapped !== null) mapping[value] = `${swapped}${parsed.field}`;
        }
    }

    return mapping;
}

// Rebuilds layout state so primary subplot values are unique and compacted to 1..6.
// Duplicate primaries are assigned the next available order by their current state order.
export function compactLayoutState(state: LayoutState): {
    state: LayoutState;
    mapping: Record<string, string>;
    itemMapping: Record<string, string>;
} {
    const nextState: LayoutState = {};
    const mapping: Record<string, string> = {};
    const itemMapping: Record<string, string> = {};
    const primaryKeys = Object.keys(state)
        .filter((key) => isPrimaryValue(getValueFromKey(key)))
        .sort((a, b) => Number(getValueFromKey(a)) - Number(getValueFromKey(b)));
    const primaryOrderByKey = new Map(primaryKeys.map((key, index) => [key, index + 1]));
    const newOrdersByOldOrder = new Map<number, number[]>();

    primaryKeys.forEach((key) => {
        const oldOrder = Number(getValueFromKey(key));
        const newOrder = primaryOrderByKey.get(key)!;
        newOrdersByOldOrder.set(oldOrder, [...(newOrdersByOldOrder.get(oldOrder) ?? []), newOrder]);
    });

    for (const [key, item] of Object.entries(state)) {
        const value = getValueFromKey(key);
        const itemId = getItemIdFromKey(key);

        if (isPrimaryValue(value)) {
            const newValue = String(primaryOrderByKey.get(key));
            mapping[value] = newValue;
            itemMapping[itemId] = newValue;
            nextState[buildLayoutStateKey(newValue, itemId)] = item;
            continue;
        }

        const parsed = parseAnySubplotValue(value);
        if (parsed) {
            const newOrder = newOrdersByOldOrder.get(parsed.order)?.[0];
            if (newOrder === undefined) {
                mapping[value] = '';
                itemMapping[itemId] = '';
                continue;
            }
            const newValue = `${newOrder}${parsed.field}`;
            mapping[value] = newValue;
            itemMapping[itemId] = newValue;
            nextState[buildLayoutStateKey(newValue, itemId)] = item;
            continue;
        }

        nextState[key] = item;
    }

    return { state: nextState, mapping, itemMapping };
}
