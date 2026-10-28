import {
    type LayoutState,
    buildLayoutStateKey,
    buildReindexMapping,
    buildSwapMapping,
    compactLayoutState,
    getItemIdFromKey,
    getNextAvailableSubplot,
    getValueFromKey,
    isPrimaryValue,
} from '@/pages/multi-axis-plot/layoutStateLogic.ts';

import type { VariableItemUiState } from './endProcessSelection.ts';

/**
 * Pure draft reducer for the MAP layout column of the Variable Select modal.
 *
 * The draft lives in `cachedItemUiStates[columnId].additionalColumn` (the same string the end
 * process hidden `layoutInput` holds), so validation always covers every known column, not only
 * the page currently rendered. Every function returns a new record; callers must not mutate.
 */
export type DraftStates = Record<string, VariableItemUiState>;

/** Ordered candidates used by bulk selection, in the order the modal displays them. */
export interface LayoutCandidate {
    columnId: number;
    /** Datetime (CT) columns are skipped by the legacy MAP "select all", see components.js. */
    isGetDate: boolean;
    /** Defaults to true; false excludes the column from a bulk tick (e.g. key column with Key除く). */
    selectable?: boolean;
}

const DEFAULT_UI_STATE: VariableItemUiState = {
    facetState: '',
    filterState: '0',
    additionalColumn: '',
    dynamicState: false,
};

export const MAX_PRIMARY_SUBPLOTS = 6;

export const getLayoutValue = (state?: VariableItemUiState): string =>
    typeof state?.additionalColumn === 'string' ? state.additionalColumn : '';

/** Builds the `${value}_${columnId}` state consumed by layoutStateLogic validations. */
export function toLayoutState(states: DraftStates): LayoutState {
    const layoutState: LayoutState = {};
    Object.entries(states).forEach(([columnId, state]) => {
        const value = getLayoutValue(state);
        if (value) layoutState[buildLayoutStateKey(value, columnId)] = columnId;
    });
    return layoutState;
}

/**
 * Filter follows the layout value exactly like useLayoutConfigData does for the end process:
 * a non-numeric role ticks Filter, clearing the layout unticks it, a primary number keeps it.
 */
const nextFilterState = (current: VariableItemUiState, value: string): VariableItemUiState['filterState'] => {
    if (value === '') return '0';
    if (!Number(value)) return '1';
    return current.filterState;
};

const writeLayoutValue = (states: DraftStates, columnId: string, value: string): DraftStates => {
    const current = states[columnId] ?? DEFAULT_UI_STATE;
    if (getLayoutValue(current) === value) return states;
    return {
        ...states,
        [columnId]: { ...current, additionalColumn: value, filterState: nextFilterState(current, value) },
    };
};

/** Sets one column's layout value without any validation or renumbering. */
export function applyLayoutValue(states: DraftStates, columnId: string | number, value: string): DraftStates {
    return writeLayoutValue(states, String(columnId), value);
}

/** Clears several columns at once. Callers run compactDraft afterwards to renumber. */
export function clearLayoutValues(states: DraftStates, columnIds: Array<string | number>): DraftStates {
    return columnIds.reduce<DraftStates>((next, columnId) => writeLayoutValue(next, String(columnId), ''), states);
}

const applyValueMapping = (states: DraftStates, mapping: Record<string, string>): DraftStates => {
    if (Object.keys(mapping).length === 0) return states;
    return Object.keys(states).reduce<DraftStates>((next, columnId) => {
        const value = getLayoutValue(next[columnId]);
        const newValue = value ? mapping[value] : undefined;
        return newValue === undefined ? next : writeLayoutValue(next, columnId, newValue);
    }, states);
};

/**
 * Gives a newly plotted column the smallest free primary subplot.
 * Returns null when all 6 primaries are taken, so the caller leaves the row unticked.
 */
export function assignPrimaryOnCheck(states: DraftStates, columnId: string | number): DraftStates | null {
    const order = getNextAvailableSubplot(toLayoutState(states));
    if (order === null) return null;
    return writeLayoutValue(states, String(columnId), String(order));
}

/** Clears one column and, when it held a primary, renumbers the remaining subplots. */
export function clearOnUncheck(states: DraftStates, columnId: string | number): DraftStates {
    const key = String(columnId);
    const removedValue = getLayoutValue(states[key]);
    const cleared = writeLayoutValue(states, key, '');
    if (!isPrimaryValue(removedValue)) return cleared;
    return applyValueMapping(cleared, buildReindexMapping(toLayoutState(cleared), Number(removedValue)));
}

/**
 * Ticking Plot for one more variable than the 6 subplots, like the end process card does with
 * `limitedCheckedList` in components.js: the variable ticked first is unticked, the remaining
 * subplots are renumbered, and the new variable takes the freed slot.
 *
 * Subplot 1 always belongs to the variable ticked first, because every tick takes the smallest
 * free order and removing one renumbers the rest, so the primary order is the tick order.
 */
export function assignPrimaryEvictingOldest(
    states: DraftStates,
    columnId: string | number,
): { states: DraftStates; evictedColumnId: number | null } | null {
    const assigned = assignPrimaryOnCheck(states, columnId);
    if (assigned) return { states: assigned, evictedColumnId: null };

    const [oldest] = getPrimaryColumnIds(states);
    if (oldest === undefined || String(oldest) === String(columnId)) return null;

    const reassigned = assignPrimaryOnCheck(clearOnUncheck(states, oldest), columnId);
    return reassigned ? { states: reassigned, evictedColumnId: oldest } : null;
}

/** Swaps two primary subplots together with every field assigned to them. */
export function swapPrimary(states: DraftStates, fromOrder: number, toOrder: number): DraftStates {
    return applyValueMapping(states, buildSwapMapping(toLayoutState(states), fromOrder, toOrder));
}

/** Clears the conflicting columns reported by validateLayoutChange, then applies the new value. */
export function overrideConflicts(
    states: DraftStates,
    columnId: string | number,
    value: string,
    conflictItemIds: string[],
): DraftStates {
    return writeLayoutValue(clearLayoutValues(states, conflictItemIds), String(columnId), value);
}

/** Renumbers primaries to a gap-free 1..n and drops fields whose subplot no longer exists. */
export function compactDraft(states: DraftStates): DraftStates {
    const layoutState = toLayoutState(states);
    const { mapping, itemMapping } = compactLayoutState(layoutState);
    return Object.keys(layoutState).reduce<DraftStates>((next, key) => {
        const columnId = getItemIdFromKey(key);
        const value = getValueFromKey(key);
        const newValue = itemMapping[columnId] ?? mapping[value];
        return newValue === undefined ? next : writeLayoutValue(next, columnId, newValue);
    }, states);
}

const comparePrimaryOrder = (states: DraftStates) => (a: number, b: number) =>
    Number(getLayoutValue(states[String(a)])) - Number(getLayoutValue(states[String(b)]));

/** Column ids holding a primary subplot, ordered by that subplot number. */
export function getPrimaryColumnIds(states: DraftStates): number[] {
    return Object.keys(states)
        .filter((columnId) => isPrimaryValue(getLayoutValue(states[columnId])))
        .map(Number)
        .sort(comparePrimaryOrder(states));
}

/**
 * Aligns the draft with a selection computed by the backend (select all / exclude key).
 * Columns that keep a primary stay selected, the remaining slots are filled from the displayed
 * order while skipping datetime columns, and every extra column is dropped from the selection.
 */
export function reconcileWithSelection(
    states: DraftStates,
    selectedColumnIds: number[],
    candidates: LayoutCandidate[],
): { states: DraftStates; selectedColumnIds: number[] } {
    const selected = new Set(selectedColumnIds);
    const kept = getPrimaryColumnIds(states).filter((columnId) => selected.has(columnId));
    const keptSet = new Set(kept);

    candidates.forEach((candidate) => {
        if (kept.length >= MAX_PRIMARY_SUBPLOTS) return;
        if (candidate.isGetDate || keptSet.has(candidate.columnId) || !selected.has(candidate.columnId)) return;
        kept.push(candidate.columnId);
        keptSet.add(candidate.columnId);
    });

    // Only primaries are dropped: roles such as x_axis or 1main belong to unplotted variables.
    const dropped = getPrimaryColumnIds(states).filter((columnId) => !keptSet.has(columnId));
    let nextStates = clearLayoutValues(states, dropped);
    kept.forEach((columnId) => {
        if (isPrimaryValue(getLayoutValue(nextStates[String(columnId)]))) return;
        const assigned = assignPrimaryOnCheck(nextStates, columnId);
        if (assigned) nextStates = assigned;
    });

    return { states: compactDraft(nextStates), selectedColumnIds: kept };
}

/**
 * Reproduces the MAP "すべて選択" of an end process card (components.js) for a bulk scope, which is
 * either every matching variable or every variable of one process, across all pages.
 *
 * Ticking deselects the whole scope and then walks it in display order until the 6 primary
 * subplots are full; unticking only deselects it. Datetime (CT) rows and everything outside the
 * scope keep their state, and primaries kept outside the scope count towards the 6 slots.
 */
export function applyBulkMapSelection(
    states: DraftStates,
    selectedColumnIds: number[],
    scope: LayoutCandidate[],
    checked: boolean,
): { states: DraftStates; selectedColumnIds: number[] } {
    const affected = scope.filter((candidate) => !candidate.isGetDate);
    const affectedIds = new Set(affected.map((candidate) => candidate.columnId));

    // Selections outside the scope survive; ordering them by primary keeps the layout numbering stable.
    const untouchedIds = new Set(selectedColumnIds.filter((columnId) => !affectedIds.has(columnId)));
    const kept = getPrimaryColumnIds(states).filter((columnId) => untouchedIds.has(columnId));
    kept.forEach((columnId) => untouchedIds.delete(columnId));
    kept.push(...Array.from(untouchedIds));

    if (checked) {
        affected.forEach((candidate) => {
            if (kept.length >= MAX_PRIMARY_SUBPLOTS) return;
            if (candidate.selectable === false) return;
            kept.push(candidate.columnId);
        });
    }

    const keptSet = new Set(kept);
    const dropped = getPrimaryColumnIds(states).filter(
        (columnId) => affectedIds.has(columnId) && !keptSet.has(columnId),
    );
    let nextStates = clearLayoutValues(states, dropped);
    kept.forEach((columnId) => {
        if (isPrimaryValue(getLayoutValue(nextStates[String(columnId)]))) return;
        const assigned = assignPrimaryOnCheck(nextStates, columnId);
        if (assigned) nextStates = assigned;
    });

    return { states: compactDraft(nextStates), selectedColumnIds: kept };
}
