import { flushSync } from 'react-dom';

import { variableServices } from '@/services/VariableServices.ts';
import type { VariableSelectPageType } from '@/services/dataType.ts';

export interface VariableItemUiState {
    facetState: '' | '0' | '1' | '2';
    filterState: '0' | '1' | '2';
    additionalColumn: string | boolean;
    dynamicState?: string | boolean;
}

const ADDITIONAL_CONTROL_SELECTORS: Partial<Record<VariableSelectPageType, string>> = {
    fpp: 'input[id^="categoryLabel-"]',
    rlp: 'input[name="judgeVar"]',
    skd: 'input[name="objectiveVar"]',
    gl: 'input[name="objectiveVar"]',
    wfp: 'input[name^="colorVar"]',
    hmp: 'input[name^="colorVar"]',
    scp: 'input[name^="colorVar"]',
    agp: 'select[name="colorVar"]',
    map: 'input[name="layoutInput"]',
    pcp: 'input[name="objectiveVar"]',
};

function getEndProcessRows(pageType: VariableSelectPageType) {
    return Array.from(
        document.querySelectorAll<HTMLElement>('.grouplist-checkbox-with-search[id^="list-end-proc-val"]'),
    ).flatMap((list) => {
        const selector = 'li.list-group-item.form-check:not(.keep-header)';
        const rows = list._virtualList?.querySelectorAll(selector) ?? Array.from(list.querySelectorAll(selector));
        return rows.flatMap((row) => {
            const plot = row.querySelector<HTMLInputElement>('input[name^="GET02_VALS_SELECT"]');
            const category = row.querySelector<HTMLInputElement>('input[name^="GET02_CATE_SELECT"]');
            const facet = row.querySelector<HTMLSelectElement>('select[name="catExpBox"]');
            const selector = ADDITIONAL_CONTROL_SELECTORS[pageType];
            const additional = selector ? row.querySelector<HTMLInputElement | HTMLSelectElement>(selector) : null;
            // Categorical rows may have roles without a plot checkbox.
            const id =
                plot?.value ??
                category?.value ??
                facet?.id.replace('catExpItem-', '') ??
                (pageType === 'agp'
                    ? additional?.getAttribute('data-target-var-id')
                    : pageType === 'map'
                      ? additional?.id.replace('reactlayout-', '')
                      : additional?.value);
            if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return [];
            const filter = row.querySelector<HTMLInputElement>('input[id^="categoryFilter-"]');
            return [{ list, row, id, plot, facet, filter, additional }];
        });
    });
}

// Read the legacy-owned controls only when opening the modal. The virtual-list
// API also includes detached rows hidden by scrolling or a card's search filter.
export function readEndProcessSelection(pageType: VariableSelectPageType): {
    selectedProcessIds: number[];
    selectedColumnIds: number[];
    columnStates: Record<string, VariableItemUiState>;
} {
    const selectedProcessIds = Array.from(
        new Set(
            Array.from(document.querySelectorAll<HTMLSelectElement>('select[id^="end-proc-process-"]'))
                .map((select) => Number(select.value))
                .filter((id) => Number.isSafeInteger(id) && id > 0),
        ),
    );
    const selectedColumnIds = new Set<number>();
    const columnStates: Record<string, VariableItemUiState> = {};

    getEndProcessRows(pageType).forEach(({ id, plot, facet, filter, additional }) => {
        if (plot?.checked) selectedColumnIds.add(Number(id));
        const facetState = facet?.value === '3' ? '0' : facet?.value;
        const additionalColumn =
            pageType === 'agp' || pageType === 'map'
                ? (additional?.value ?? '')
                : ((additional as HTMLInputElement | null)?.checked ?? false);
        const state: VariableItemUiState = {
            facetState: facetState === '0' || facetState === '1' || facetState === '2' ? facetState : '',
            filterState: filter?.checked ? '1' : '0',
            additionalColumn,
            dynamicState: typeof additionalColumn === 'boolean' ? additionalColumn : false,
        };
        if (state.facetState !== '' || state.filterState === '1' || additionalColumn) columnStates[id] = state;
    });
    return { selectedProcessIds, selectedColumnIds: [...selectedColumnIds], columnStates };
}

// The process selector's legacy handler exposes asynchronous card loading via waitUntil.
async function ensureEndProcessCards(columnIds: number[], selectedProcessIds: number[]) {
    const processIds = new Set(selectedProcessIds.map(String));
    let page = 1;
    let totalPages = columnIds.length ? 1 : 0;
    while (page <= totalPages) {
        const response = await variableServices.getProcessColumns({
            page,
            limit: 100,
            show_mode: 'selected',
            selected_column_ids: columnIds,
        });
        response.items.forEach((item) => processIds.add(String(item.process_id)));
        totalPages = response.pagination.total_pages;
        ++page;
    }

    for (const processId of processIds) {
        const getSelectors = () =>
            Array.from(document.querySelectorAll<HTMLSelectElement>('select[id^="end-proc-process-"]'));
        if (getSelectors().some((select) => select.value === processId)) continue;
        let select = getSelectors().find((item) => !item.value);
        if (!select) {
            document.getElementById('btn-add-end-proc')?.click();
            select = getSelectors().find((item) => !item.value);
        }
        if (!select || !Array.from(select.options).some((option) => option.value === processId)) {
            throw new Error('End process card is unavailable.');
        }
        select.value = processId;
        const pending: Promise<unknown>[] = [];
        const event = $.Event('change');
        event.waitUntil = (task: Promise<unknown>) => pending.push(Promise.resolve(task));
        $(select).trigger(event);
        await Promise.all(pending);
    }
}

type EndProcessRow = ReturnType<typeof getEndProcessRows>[number];

/**
 * Writes one legacy-owned control and lets its jQuery/React handlers run.
 * Legacy handlers need a form/list ancestor, so only the row being changed is attached,
 * leaving its search/scroll state untouched.
 */
function applyControlValue(
    entry: EndProcessRow,
    control: HTMLInputElement | HTMLSelectElement,
    value: string | boolean,
    pageType: VariableSelectPageType,
    colorLabels: Record<string, string>,
): void {
    const current = typeof value === 'boolean' ? (control as HTMLInputElement).checked : control.value;
    if (current === value || control.disabled) return;
    const { row, list } = entry;
    const detached = !row.isConnected;
    if (detached) list.appendChild(row);
    try {
        if (typeof value === 'boolean') {
            (control as HTMLInputElement).checked = value;
        } else if (control.name === 'layoutInput') {
            // Use React's existing input bridge rather than mutating its controlled state.
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
            setter.call(control, value);
            flushSync(() => control.dispatchEvent(new Event('input', { bubbles: true })));
            return;
        } else {
            if (
                pageType === 'agp' &&
                control.name === 'colorVar' &&
                value &&
                !Array.from((control as HTMLSelectElement).options).some((option) => option.value === value)
            ) {
                (control as HTMLSelectElement).add(new Option(colorLabels[value] ?? value, value));
            }
            control.value = value;
        }
        flushSync(() => $(control).trigger('change'));
    } finally {
        if (detached) row.remove();
    }
}

const isPrimaryLayoutValue = (value: string): boolean => /^[1-6]$/.test(value);

const LAYOUT_CELL_SELECTOR = '.react-root[data-component="LayoutDropDown"]';
const LAYOUT_CELL_TIMEOUT_MS = 5000;

const isLayoutCellReady = (row: Element): boolean =>
    !row.querySelector(LAYOUT_CELL_SELECTOR) ||
    Boolean(row.querySelector('input[name="layoutInput"][data-layout-ready]'));

/**
 * The layout cell is a React root that main.tsx mounts only once its row is attached to the DOM.
 * Virtual-list rows that were never scrolled into view, and rows of cards added just before, have
 * no mounted cell yet, so writing their layout would be lost. Mount them and wait until every
 * cell is listening before the draft is replayed.
 */
async function prepareLayoutCells(rows: EndProcessRow[]): Promise<void> {
    const pending = rows.filter(({ row }) => !isLayoutCellReady(row));
    if (!pending.length) return;

    const attached = pending.filter(({ row }) => !row.isConnected);
    const displays = attached.map(({ row }) => (row as HTMLElement).style.display);
    attached.forEach(({ list, row }) => {
        (row as HTMLElement).style.display = 'none';
        list.appendChild(row);
    });
    try {
        const deadline = Date.now() + LAYOUT_CELL_TIMEOUT_MS;
        while (pending.some(({ row }) => !isLayoutCellReady(row))) {
            if (Date.now() > deadline) throw new Error('Layout cells of the end process cards are not ready.');
            await new Promise((resolve) => window.setTimeout(resolve, 16));
        }
    } finally {
        attached.forEach(({ row }, index) => {
            row.remove();
            (row as HTMLElement).style.display = displays[index];
        });
    }
}

/**
 * MAP cannot reuse the generic write loop: the end process panel reassigns and renumbers primary
 * subplots on every Plot change. The draft already describes the final layout, so it is replayed
 * in a fixed order while `__layoutBulkOperation` suppresses intermediate renumbering.
 */
function applyMapSelection(
    rows: EndProcessRow[],
    selected: Set<string>,
    columnStates: Record<string, VariableItemUiState>,
): void {
    const apply = (entry: EndProcessRow, control: HTMLInputElement | HTMLSelectElement, value: string | boolean) =>
        applyControlValue(entry, control, value, 'map', {});
    const layoutValue = (id: string) => String(columnStates[id]?.additionalColumn || '');
    const applyFilters = () =>
        rows.forEach((entry) => {
            if (entry.filter) apply(entry, entry.filter, columnStates[entry.id]?.filterState === '1');
        });
    const bulkWindow = window as unknown as { __layoutBulkOperation?: boolean };

    bulkWindow.__layoutBulkOperation = true;
    try {
        // 1. Untick every Plot checkbox first: unticking a plotted row already clears its own layout
        // value, so writing '' beforehand would trigger uncheckColumn() and a second layoutchange.
        rows.forEach((entry) => {
            if (entry.plot) apply(entry, entry.plot, false);
        });
        // Then clear the rows that still hold a layout value, so no subplot survives.
        rows.forEach((entry) => {
            if (entry.additional) apply(entry, entry.additional, '');
        });

        // 2. Facet and Filter, before Plot, because the legacy Plot handler reads the facet value.
        rows.forEach((entry) => {
            const facetState = columnStates[entry.id]?.facetState;
            if (entry.facet) apply(entry, entry.facet, facetState === '0' ? '3' : (facetState ?? ''));
        });
        applyFilters();

        // 3. Plot in draft primary order: the panel assigns the next free subplot to each tick,
        // which reproduces the draft numbering because the draft is compacted to 1..n.
        const primaryOrder = (id: string) => {
            const value = layoutValue(id);
            return isPrimaryLayoutValue(value) ? Number(value) : Number.MAX_SAFE_INTEGER;
        };
        rows.filter((entry) => entry.plot && selected.has(entry.id))
            .sort((a, b) => primaryOrder(a.id) - primaryOrder(b.id))
            .forEach((entry) => apply(entry, entry.plot!, true));

        // 4. Roles that are not primary subplots belong to unplotted variables.
        rows.forEach((entry) => {
            const value = layoutValue(entry.id);
            if (!entry.additional || !value || isPrimaryLayoutValue(value)) return;
            apply(entry, entry.additional, value);
        });

        // 5. Ticking Plot and writing a layout value both rewrite the Filter checkbox.
        applyFilters();
    } finally {
        bulkWindow.__layoutBulkOperation = false;
    }

    const mismatch = getEndProcessRows('map').find(
        ({ id, additional }) => (additional?.value ?? '') !== layoutValue(id),
    );
    if (mismatch) {
        console.error('Layout mismatch after applying the draft.', {
            columnId: mismatch.id,
            expected: layoutValue(mismatch.id),
            actual: mismatch.additional?.value ?? '',
        });
        throw new Error('Layout could not be applied to the end process cards.');
    }
}

export async function applyEndProcessSelection(
    pageType: VariableSelectPageType,
    selectedColumnIds: number[],
    columnStates: Record<string, VariableItemUiState>,
    colorLabels: Record<string, string> = {},
    selectedProcessIds: number[] = [],
): Promise<void> {
    const selected = new Set(selectedColumnIds.map(String));
    const requiredIds = new Set(selected);
    Object.entries(columnStates).forEach(([id, state]) => {
        if (state.facetState !== '' || state.filterState === '1' || state.additionalColumn) requiredIds.add(id);
    });
    const existingIds = new Set(getEndProcessRows(pageType).map(({ id }) => id));
    await ensureEndProcessCards([...requiredIds].filter((id) => !existingIds.has(id)).map(Number), selectedProcessIds);
    if (pageType === 'map') await prepareLayoutCells(getEndProcessRows(pageType));
    const rows = getEndProcessRows(pageType);
    const availableIds = new Set(rows.map(({ id }) => id));
    if ([...requiredIds].some((id) => !availableIds.has(id))) {
        throw new Error('Selected columns are unavailable in end process cards.');
    }

    if (pageType === 'map') {
        applyMapSelection(rows, selected, columnStates);
    } else {
        type Change = {
            entry: EndProcessRow;
            control: HTMLInputElement | HTMLSelectElement;
            value: string | boolean;
        };
        const changes: Change[] = [];
        rows.forEach((entry) => {
            const { id, plot, facet, filter, additional } = entry;
            const state = columnStates[id];
            if (plot) changes.push({ entry, control: plot, value: selected.has(id) });
            // Absent states mean no role; explicit false/empty states must clear old roles too.
            if (facet)
                changes.push({
                    entry,
                    control: facet,
                    value: state?.facetState === '0' ? '3' : (state?.facetState ?? ''),
                });
            if (filter) changes.push({ entry, control: filter, value: state?.filterState === '1' });
            if (additional) {
                changes.push({
                    entry,
                    control: additional,
                    value:
                        pageType === 'agp' ? String(state?.additionalColumn || '') : Boolean(state?.additionalColumn),
                });
            }
        });

        // Clear old roles first, including detached radios, before enabling their replacements.
        changes.sort((a, b) => Number(Boolean(a.value)) - Number(Boolean(b.value)));
        for (const { entry, control, value } of changes) {
            applyControlValue(entry, control, value, pageType, colorLabels);
        }
    }

    // Explicit process selections survive even when none of their variables are selected.
    const selectedProcesses = new Set(selectedProcessIds.map(String));
    // Read the applied state: legacy handlers and disabled system filters may
    // retain selections that differ from the draft. Include detached rows too.
    const retainedCards = new Set<Element>();
    getEndProcessRows(pageType).forEach(({ list, plot, facet, filter, additional }) => {
        const hasAdditionalRole =
            pageType === 'agp' || pageType === 'map'
                ? Boolean(additional?.value)
                : Boolean((additional as HTMLInputElement | null)?.checked);
        if (plot?.checked || facet?.value || filter?.checked || hasAdditionalRole) {
            const card = list.closest('.card.end-proc');
            if (card) retainedCards.add(card);
        }
    });
    document.querySelectorAll<HTMLElement>('#end-proc-row .card.end-proc').forEach((card) => {
        const process = card.querySelector<HTMLSelectElement>('select[id^="end-proc-process-"]');
        if (!retainedCards.has(card) && !selectedProcesses.has(process?.value ?? '')) {
            const close = card.querySelector<HTMLElement>('.close-icon');
            if (close) $(close).trigger($.Event('click', { removeEmptyProcessCard: true }));
        }
    });
}
