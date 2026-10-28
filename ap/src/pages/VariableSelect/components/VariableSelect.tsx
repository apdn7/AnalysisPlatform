import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

import {
    type VariableItemUiState,
    applyEndProcessSelection,
    readEndProcessSelection,
} from '@/pages/VariableSelect/endProcessSelection.ts';
import {
    type DraftStates,
    type LayoutCandidate,
    applyBulkMapSelection,
    applyLayoutValue,
    assignPrimaryEvictingOldest,
    assignPrimaryOnCheck,
    clearLayoutValues,
    clearOnUncheck,
    compactDraft,
    getLayoutValue,
    getPrimaryColumnIds,
    overrideConflicts,
    reconcileWithSelection,
    swapPrimary,
    toLayoutState,
} from '@/pages/VariableSelect/layoutDraft.ts';
import { getMaxUsedOrder, isPrimaryValue, validateLayoutChange } from '@/pages/multi-axis-plot/layoutStateLogic.ts';
import {
    type ProcessColumnItem,
    type ProcessColumnSummary,
    type ProcessColumnsPagination,
    type ProcessColumnsQueryParams,
    type ProcessConfigColumnItem,
    variableServices,
} from '@/services/VariableServices.ts';
import {
    type VariableSelectPageType,
    canShowFilterCheckbox,
    canShowPageTypeControl,
    canShowPlotCheckbox,
    canUseAgpColorDropdownOption,
    getDataTypeI18nKey,
    isCategoryColumn,
    showDataTypeShort,
} from '@/services/dataType.ts';
import PaginationControls from '@/shared/components/ui/PaginationControls.tsx';
import { SearchSelect, type TwoColumnOption } from '@/shared/components/ui/SearchSelect';
import { useDebounce } from '@/shared/hooks/useDebounce.ts';
import { convertUtcToLocal } from '@/shared/utils/helpers.ts';

import { type SelectedDatetimeRange, readSelectedDatetimeRanges } from '../datetimeRange.ts';
import LayoutCell from './LayoutCell.tsx';
import ProcessDetail from './ProcessDetail.tsx';
import './VariableSelect.scss';

type ShowMode = 'all' | 'selected' | 'unselected' | 'linked';

interface VariableItem {
    columnId: number;
    kind: 'variable' | 'function';
    processId: string;
    processName: string;
    idx: number | string;
    english: string;
    dataType: string;
    dataTypeShort: string;
    columnType: number | null;
    isSerialNo: boolean;
    isIntCategory: boolean;
    isJudge: boolean;
    name: string;
    unit: string;
    samples: string[];
    uniqueValues: string[];
    plot: boolean;
    facetState: '' | '0' | '1' | '2';
    filterState: '0' | '1' | '2';
    source: string;
    system: string;
    local: string;
    filterValue: string;
    formula: string;
    raw: string;
    rawColumnName: string;
    functionText: string;
    xme: string;
    y: string;
    coeff: string;
    note: string;
    canShowFilter: boolean;
    canSelectPlot: boolean;
    additionalColumn: string | boolean;
    dynamicState?: string | boolean;
}

interface ProcessGroup {
    id: string;
    name: string;
    collapsed: boolean;
    items: VariableItem[];
    functionCollapsed: boolean;
    functionItems: VariableItem[];
    summary: ProcessColumnSummary;
}

interface GlobalPaginationState {
    page: number;
    pageSize: number;
    jumpPage: string;
}

interface VariableSelectProps {
    defaultOpen?: boolean;
    pageType?: VariableSelectPageType;
}

interface FilterState {
    idxStart: number;
    idxSize: number;
    idxInterval: number;
    regexSearch: string;
    showMode: ShowMode;
    excludeKey: boolean;
    sameFilter: boolean;
    naFilter: boolean;
}

type RangeField = 'idxStart' | 'idxSize' | 'idxInterval';

interface ColumnFilterState {
    process: string;
    idx: string;
    english: string;
    type: string;
    name: string;
    plotState: string;
    facetState: string;
    filterState: string;
    unit: string;
    samples: string[];
    additionalColumn: string;
}

const SAMPLE_HEADERS = ['S1', 'S2', 'S3', 'S4', 'S5'];
const PAGING_LIMIT_OPTIONS = [10, 25, 50, 100];
const DETAIL_SAMPLE_COUNT = 10;
const REMOTE_SEARCH_DEBOUNCE_MS = 500;
// Debounce for refetches caused only by draft selection changes (Plot / Label / Facet / Filter).
const SELECTION_SYNC_DEBOUNCE_MS = 300;
// Scope key of the MAP すべて選択 checkbox; process rows use their process id, which is numeric.

const DEFAULT_FILTERS: FilterState = {
    idxStart: 1,
    idxSize: 0,
    idxInterval: 1,
    regexSearch: '',
    showMode: 'all',
    excludeKey: false,
    sameFilter: false,
    naFilter: false,
};

const DEFAULT_RANGE_INPUT_VALUES: Record<RangeField, string> = {
    idxStart: String(DEFAULT_FILTERS.idxStart),
    idxSize: String(DEFAULT_FILTERS.idxSize),
    idxInterval: String(DEFAULT_FILTERS.idxInterval),
};

const DEFAULT_COLUMN_FILTERS: ColumnFilterState = {
    process: '',
    idx: '',
    english: '',
    type: '',
    name: '',
    plotState: '',
    facetState: '',
    filterState: '',
    unit: '',
    samples: ['', '', '', '', ''],
    additionalColumn: '',
};

interface HoverHelpProps {
    id: string;
    message: string;
    children: React.ReactNode;
}

function HoverHelp({ id, message, children }: HoverHelpProps) {
    return (
        <OverlayTrigger
            placement="bottom"
            overlay={
                <Tooltip id={id} className="variable-select-tooltip">
                    {message}
                </Tooltip>
            }
        >
            <span className="variable-select-hover-help">{children}</span>
        </OverlayTrigger>
    );
}

function buildProcessColumnsQueryParams(
    columnFilters: ColumnFilterState,
    regexSearch: string,
): Omit<ProcessColumnsQueryParams, 'page' | 'limit'> {
    return {
        process_name: columnFilters.process.trim(),
        idx: columnFilters.idx.trim(),
        english_name: columnFilters.english.trim(),
        datatype: columnFilters.type.trim(),
        shownname: columnFilters.name.trim(),
        unit: columnFilters.unit.trim(),
        sample_1: columnFilters.samples[0]?.trim() || '',
        sample_2: columnFilters.samples[1]?.trim() || '',
        sample_3: columnFilters.samples[2]?.trim() || '',
        sample_4: columnFilters.samples[3]?.trim() || '',
        sample_5: columnFilters.samples[4]?.trim() || '',
        search_regex: regexSearch.trim(),
        plot_state: columnFilters.plotState.trim(),
        facet_state: columnFilters.facetState.trim(),
        filter_state: columnFilters.filterState.trim(),
        additional_column: columnFilters.additionalColumn.trim(),
    };
}

function toVariableItemUiState(item: VariableItem): VariableItemUiState {
    return {
        facetState: item.facetState,
        filterState: item.filterState,
        additionalColumn: item.additionalColumn,
        dynamicState: item.dynamicState,
    };
}

function applyVariableItemUiState(item: VariableItem, uiState?: VariableItemUiState): VariableItem {
    if (!uiState) {
        return item;
    }

    return {
        ...item,
        ...uiState,
    };
}

/**
 * Groups the current page items while attaching the server summary for each complete process.
 */
function toProcessGroups(
    items: ProcessColumnItem[],
    processSummaries: Record<string, ProcessColumnSummary>,
    pageType: VariableSelectPageType,
): ProcessGroup[] {
    const groupMap = new Map<string, ProcessGroup>();

    const formatSampleValue = (value: string | number | boolean, dataType: string): string => {
        if (dataType.trim().toUpperCase() === 'DATETIME' && typeof value === 'string') {
            return convertUtcToLocal(value) || value;
        }
        return String(value);
    };

    const toPreviewSamples = (samples: Array<string | number | boolean> | undefined, dataType: string): string[] => {
        const normalized = (samples || []).map((value) => formatSampleValue(value, dataType));
        while (normalized.length < DETAIL_SAMPLE_COUNT) {
            normalized.push('-');
        }
        return normalized.slice(0, DETAIL_SAMPLE_COUNT);
    };

    const toUniqueValues = (values: Array<string | number | boolean> | undefined, dataType: string): string[] =>
        (values || []).map((value) => formatSampleValue(value, dataType)).slice(0, 10);

    items.forEach((item) => {
        const processId = String(item.process_id);
        const processName = item.process_name || `process_${processId}`;
        const found = groupMap.get(processId);
        const englishName = item.english_name || item.shownname || '-';
        const shownName = item.shownname || item.english_name || '-';
        const dataType = item.datatype || '-';

        // Check if this is a function column (has function_details with non-empty array)
        const isFunctionColumn = item.function_details && item.function_details.length > 0;

        // Get function details for display in detail panel
        const firstFunctionDetail = isFunctionColumn ? item.function_details[0] : null;
        const functionCoeffs = firstFunctionDetail
            ? (['a', 'b', 'c', 'n', 'k', 's', 't'] as const)
                  .filter((coef) => firstFunctionDetail[coef] !== null && firstFunctionDetail[coef] !== '')
                  .map((coef) => `${coef}=${firstFunctionDetail[coef]}`)
                  .join(', ')
            : '';

        const variable: VariableItem = {
            columnId: item.column_id,
            kind: isFunctionColumn ? 'function' : 'variable',
            processId,
            processName,
            idx: item.column_order_label || item.column_order_in_process,
            english: englishName,
            dataType,
            dataTypeShort: showDataTypeShort(item) || dataType,
            columnType: item.column_type,
            isSerialNo: item.is_serial_no,
            isIntCategory: item.is_int_category,
            isJudge: item.is_judge,
            name: shownName,
            unit: item.unit || '',
            samples: toPreviewSamples(item.sample_data, dataType),
            uniqueValues: toUniqueValues(item.unique_values, dataType),
            plot: item.selected,
            facetState: '',
            filterState: '0',
            source: '-',
            system: item.english_name || '-',
            local: item.name_local || '-',
            filterValue: item.filter || '',
            formula: item.formula || '',
            raw: item.datatype || '-',
            rawColumnName: item.raw_column_name || '-',
            functionText: isFunctionColumn
                ? firstFunctionDetail?.function_name || `Function #${firstFunctionDetail?.function_id || '?'}`
                : '(Raw)',
            xme: isFunctionColumn ? String(firstFunctionDetail?.var_x_name || firstFunctionDetail?.var_x || '-') : '-',
            y: isFunctionColumn ? String(firstFunctionDetail?.var_y_name || firstFunctionDetail?.var_y || '-') : '-',
            coeff: isFunctionColumn ? functionCoeffs || '-' : '-',
            note: isFunctionColumn ? firstFunctionDetail?.note || '-' : '-',
            canShowFilter: canShowFilterCheckbox(item),
            canSelectPlot: canShowPlotCheckbox(pageType, item),
            additionalColumn: '',
            dynamicState: false,
        };

        if (!found) {
            groupMap.set(processId, {
                id: processId,
                name: processName,
                collapsed: false,
                items: isFunctionColumn ? [] : [variable],
                functionCollapsed: false,
                functionItems: isFunctionColumn ? [variable] : [],
                summary: processSummaries[processId],
            });
            return;
        }

        if (isFunctionColumn) {
            found.functionItems.push(variable);
        } else {
            found.items.push(variable);
        }
    });

    return Array.from(groupMap.values());
}

function itemKey(item: Pick<VariableItem, 'columnId'>): string {
    return String(item.columnId);
}

function getAgpColorOptions(group: ProcessGroup): SelectOption[] {
    return group.items
        .filter((item) => canUseAgpColorDropdownOption({ datatype: item.dataType }))
        .map((item) => ({
            value: String(item.columnId),
            label: item.name,
        }));
}

function toAgpColorOptions(items: ProcessConfigColumnItem[]): SelectOption[] {
    return items
        .filter((item) => canUseAgpColorDropdownOption({ datatype: item.data_type }))
        .map((item) => ({
            value: String(item.id),
            label: item.shown_name || item.name_en || String(item.id),
        }));
}

function toAgpColorTwoColumnOptions(items: ProcessConfigColumnItem[]): TwoColumnOption[] {
    return items
        .filter((item) => canUseAgpColorDropdownOption({ datatype: item.data_type }))
        .map((item) => ({
            value: item.id,
            col1: item.name_en || String(item.id),
            col2: item.shown_name || String(item.id),
        }));
}

type PageTypeConfig = {
    columnName: string | null;
    // Same value as MAX_NUMBER_OF_SENSOR of each page.
    maxSensors: number;
    controlType: 'checkbox' | 'radio' | 'select' | 'select2' | null;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
};

type SelectOption = { value: string; label: string };

const PAGE_TYPE_CONFIG: Record<VariableSelectPageType, PageTypeConfig> = {
    fpp: { columnName: 'Label', maxSensors: 20, controlType: 'checkbox', placeholder: '0/1/other' },
    rlp: { columnName: 'Judge', maxSensors: 20, controlType: 'radio', placeholder: '0/1' },
    skd: { columnName: 'Objective', maxSensors: 512, controlType: 'radio', placeholder: '0/1' },
    wfp: { columnName: 'Color', maxSensors: 2, controlType: 'checkbox', placeholder: '0/1' },
    hmp: { columnName: 'Color', maxSensors: 2, controlType: 'checkbox', placeholder: '0/1' },
    scp: { columnName: 'Color', maxSensors: 2, controlType: 'checkbox', placeholder: '0/1' },
    agp: { columnName: 'Color', maxSensors: 18, controlType: 'select2', options: [], placeholder: 'color' },
    map: { columnName: 'Layout', maxSensors: 6, controlType: 'select', options: [], placeholder: 'layout' },
    gl: { columnName: 'Objective', maxSensors: 60, controlType: 'radio', placeholder: '0/1' },
    pcp: { columnName: 'Objective', maxSensors: 60, controlType: 'radio', placeholder: '0/1' },
    msp: { columnName: null, maxSensors: 64, controlType: null },
    pca: { columnName: null, maxSensors: 60, controlType: 'radio' },
    stp: { columnName: null, maxSensors: 8, controlType: 'radio' },
    chm: { columnName: null, maxSensors: 18, controlType: null },
};

/**
 * Renders the server-paginated variable selection modal and synchronizes its draft selection.
 */
export default function VariableSelect({ defaultOpen = false, pageType = 'fpp' }: VariableSelectProps) {
    const { t } = useTranslation();
    const pageTypeConfig = PAGE_TYPE_CONFIG[pageType];
    const [isOpen, setIsOpen] = useState(defaultOpen);
    // Datetime range(s) selected in the outer picker, captured when the modal opens. When non-empty,
    // samples are limited to those ranges and the Sample Data header shows them.
    const [selectedDatetimeRanges, setSelectedDatetimeRanges] = useState<SelectedDatetimeRange[]>(() =>
        defaultOpen ? readSelectedDatetimeRanges() : [],
    );
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedProcessIds, setExpandedProcessIds] = useState<number[]>([]);
    const [startProcessId, setStartProcessId] = useState('');
    const [startProcessOptions, setStartProcessOptions] = useState<string[]>([]);
    const [processes, setProcesses] = useState<ProcessGroup[]>([]);
    const [cachedItemUiStates, setCachedItemUiStates] = useState<Record<string, VariableItemUiState>>({});
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [rangeInputValues, setRangeInputValues] = useState(DEFAULT_RANGE_INPUT_VALUES);
    const [columnFilters, setColumnFilters] = useState<ColumnFilterState>(DEFAULT_COLUMN_FILTERS);
    const [pagination, setPagination] = useState<GlobalPaginationState>({
        page: 1,
        pageSize: 25,
        jumpPage: '1',
    });
    const [serverPagination, setServerPagination] = useState<ProcessColumnsPagination>({
        page: 1,
        limit: 25,
        total: 0,
        total_pages: 0,
    });
    const [agpColorOptionsByProcess, setAgpColorOptionsByProcess] = useState<Record<string, SelectOption[]>>({});
    const [agpColorTwoColumnOptionsByProcess, setAgpColorTwoColumnOptionsByProcess] = useState<
        Record<string, TwoColumnOption[]>
    >({});
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);
    const [isApplyingSelection, setIsApplyingSelection] = useState(false);
    const [columnsError, setColumnsError] = useState(false);
    const [selectionError, setSelectionError] = useState(false);
    const [selectedColumnIds, setSelectedColumnIds] = useState<number[]>([]);
    const [prioritizedColumnIds, setPrioritizedColumnIds] = useState<number[]>([]);
    const [allMatchingSelected, setAllMatchingSelected] = useState(false);
    // MAP bulk selection only ticks the first free subplots, so its checkboxes keep the state the
    // user chose instead of following the resulting selection count, like the end process card does.
    const [mapBulkChecked, setMapBulkChecked] = useState(false);
    const [rangeColumnIds, setRangeColumnIds] = useState<number[] | null>(null);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
    const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
    const [regexInvalid, setRegexInvalid] = useState(false);
    const committedPlotStateRef = useRef<number[]>([]);
    const fetchVersionRef = useRef(0);
    // Apply bulk visibility to later pages and responses without fetching every column at once.
    const allProcessesCollapsedRef = useRef<boolean | null>(false);
    const lastRemoteSearchKeyRef = useRef('');
    const lastViewKeyRef = useRef('');
    // Raw samples of the rows currently displayed, keyed by column id.
    const sampleCacheRef = useRef<Map<number, Pick<ProcessColumnItem, 'sample_data' | 'unique_values'>>>(new Map());
    const cachedItemUiStatesRef = useRef<Record<string, VariableItemUiState>>({});

    useEffect(
        () => () => {
            ++fetchVersionRef.current;
        },
        [],
    );

    const remoteColumnSearchParams = useMemo(
        () => buildProcessColumnsQueryParams(columnFilters, filters.regexSearch),
        [columnFilters, filters.regexSearch],
    );

    const debouncedRemoteColumnSearchParams = useDebounce(remoteColumnSearchParams, REMOTE_SEARCH_DEBOUNCE_MS);

    const remoteFilterParams = useMemo<Omit<ProcessColumnsQueryParams, 'page' | 'limit'>>(
        () => ({
            ...debouncedRemoteColumnSearchParams,
            show_mode: filters.showMode === 'linked' ? 'all' : filters.showMode,
            exclude_key: filters.excludeKey,
            idx_start: filters.idxStart,
            idx_size: filters.idxSize,
            idx_interval: filters.idxInterval,
            same_filter: isExpanded && filters.sameFilter,
            na_filter: isExpanded && filters.naFilter,
        }),
        [
            debouncedRemoteColumnSearchParams,
            filters.showMode,
            filters.excludeKey,
            filters.idxStart,
            filters.idxSize,
            filters.idxInterval,
            filters.sameFilter,
            filters.naFilter,
            isExpanded,
        ],
    );
    const visibleProcessIds = isExpanded ? expandedProcessIds : undefined;
    const datetimeRangesParam = useMemo(
        () => selectedDatetimeRanges.map(({ start, end }) => ({ start, end })),
        [selectedDatetimeRanges],
    );
    const remoteQueryParams = useMemo(
        () => ({
            ...remoteFilterParams,
            page_type: pageType,
            process_ids: visibleProcessIds,
            linked_process_ids: !isExpanded && filters.showMode === 'linked' ? expandedProcessIds : [],
            selected_column_ids: selectedColumnIds,
            selected_process_ids: expandedProcessIds,
            prioritized_column_ids: prioritizedColumnIds,
            column_states: cachedItemUiStates,
            datetime_ranges: datetimeRangesParam,
        }),
        [
            remoteFilterParams,
            pageType,
            selectedColumnIds,
            prioritizedColumnIds,
            cachedItemUiStates,
            visibleProcessIds,
            expandedProcessIds,
            isExpanded,
            filters.showMode,
            datetimeRangesParam,
        ],
    );
    // Draft selection changes refetch the current page; only filter changes (incl. the selected range) reset it.
    const remoteSearchKey = JSON.stringify([
        remoteFilterParams,
        filters.showMode,
        isExpanded,
        isExpanded || filters.showMode === 'linked' ? expandedProcessIds : [],
        datetimeRangesParam,
    ]);

    useEffect(() => {
        cachedItemUiStatesRef.current = cachedItemUiStates;
    }, [cachedItemUiStates]);

    useEffect(() => {
        if (!isOpen || pageType !== 'agp' || processes.length === 0) {
            return;
        }

        const missingProcessIds = processes
            .map((group) => group.id)
            .filter((processId) => agpColorOptionsByProcess[processId] === undefined);

        if (missingProcessIds.length === 0) return;

        let cancelled = false;

        const fetchAgpColorOptions = async () => {
            try {
                const responses = await Promise.all(
                    missingProcessIds.map(async (processId) => ({
                        processId,
                        response: await variableServices.getProcessConfigColumns(processId),
                    })),
                );

                if (cancelled) return;

                setAgpColorOptionsByProcess((prev) => {
                    const next = { ...prev };
                    responses.forEach(({ processId, response }) => {
                        next[processId] = toAgpColorOptions(response.data || []);
                    });
                    return next;
                });

                setAgpColorTwoColumnOptionsByProcess((prev) => {
                    const next = { ...prev };
                    responses.forEach(({ processId, response }) => {
                        const options = toAgpColorTwoColumnOptions(response.data || []);
                        next[processId] = options;
                    });
                    return next;
                });
            } catch (error) {
                if (!cancelled) {
                    console.error('[AGP Color] Failed to fetch AGP color options.', error);
                }
            }
        };

        void fetchAgpColorOptions();

        return () => {
            cancelled = true;
        };
    }, [agpColorOptionsByProcess, isOpen, pageType, processes]);

    useEffect(() => {
        if (!isOpen || isApplyingSelection) return;

        if (lastRemoteSearchKeyRef.current !== remoteSearchKey && pagination.page !== 1) {
            lastRemoteSearchKeyRef.current = remoteSearchKey;
            setPagination((prev) => ({ ...prev, page: 1, jumpPage: '1' }));
            return;
        }

        lastRemoteSearchKeyRef.current = remoteSearchKey;

        // A refetch caused only by a draft selection change (Plot / Label / Facet / Filter) is debounced so that
        // quick consecutive clicks are synced to the backend in a single request.
        const viewKey = JSON.stringify([remoteSearchKey, pagination.page, pagination.pageSize, refreshVersion]);
        const isSelectionOnlyChange = lastViewKeyRef.current === viewKey;
        lastViewKeyRef.current = viewKey;

        const requestVersion = ++fetchVersionRef.current;
        let cancelled = false;
        const abortController = new AbortController();

        const fetchProcessColumns = async () => {
            // Draft checkboxes already update locally; do not cover the table again while syncing them.
            setIsLoadingColumns(!isSelectionOnlyChange);
            setColumnsError(false);
            // Samples do not depend on the draft selection: reuse the ones of the rows already displayed.
            const sampleCache = sampleCacheRef.current;
            const cachedSampleIds = new Set(sampleCache.keys());
            try {
                const response = await variableServices.getProcessColumns(
                    {
                        ...remoteQueryParams,
                        pagination_mode: isExpanded ? 'columns' : 'processes',
                        cached_sample_column_ids: [...cachedSampleIds],
                        page: pagination.page,
                        limit: pagination.pageSize,
                    },
                    abortController.signal,
                );

                if (cancelled || requestVersion !== fetchVersionRef.current) return;
                const items = response.items.map((item) => {
                    const cached = cachedSampleIds.has(item.column_id) ? sampleCache.get(item.column_id) : undefined;
                    return cached ? { ...item, ...cached } : item;
                });
                sampleCacheRef.current = new Map(
                    items
                        .filter((item) => !item.sample_unavailable)
                        .map((item) => [
                            item.column_id,
                            { sample_data: item.sample_data, unique_values: item.unique_values },
                        ]),
                );
                setServerPagination(response.pagination);
                setAllMatchingSelected(response.all_selected);
                setRangeColumnIds(response.range_column_ids);
                const baseGroups: ProcessGroup[] = isExpanded
                    ? toProcessGroups(items, response.process_summaries, pageType)
                    : response.processes.map((process) => ({
                          id: String(process.id),
                          name: process.name,
                          collapsed: true,
                          items: [],
                          functionItems: [],
                          functionCollapsed: false,
                          summary: response.process_summaries[String(process.id)] ?? { selected: 0, total: 0 },
                      }));
                const cachedStates = cachedItemUiStatesRef.current;
                const grouped = baseGroups.map((group) => ({
                    ...group,
                    collapsed: !isExpanded || (allProcessesCollapsedRef.current ?? group.collapsed),
                    functionCollapsed: allProcessesCollapsedRef.current ?? group.functionCollapsed,
                    items: group.items.map((item) => applyVariableItemUiState(item, cachedStates[itemKey(item)])),
                    functionItems: group.functionItems.map((item) =>
                        applyVariableItemUiState(item, cachedStates[itemKey(item)]),
                    ),
                }));

                setProcesses((previous) => {
                    if (!isSelectionOnlyChange) return grouped;
                    const previousGroups = new Map(previous.map((group) => [group.id, group]));
                    return grouped.map((group) => {
                        const previousGroup = previousGroups.get(group.id);
                        return previousGroup
                            ? {
                                  ...group,
                                  collapsed: previousGroup.collapsed,
                                  functionCollapsed: previousGroup.functionCollapsed,
                              }
                            : group;
                    });
                });
            } catch (error) {
                if (!cancelled && requestVersion === fetchVersionRef.current) {
                    console.error('Failed to fetch process columns.', error);
                    setColumnsError(true);
                }
            } finally {
                if (!cancelled && requestVersion === fetchVersionRef.current) {
                    setIsLoadingColumns(false);
                }
            }
        };

        const timer = window.setTimeout(
            () => void fetchProcessColumns(),
            isSelectionOnlyChange ? SELECTION_SYNC_DEBOUNCE_MS : 0,
        );
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            abortController.abort();
        };
    }, [
        isOpen,
        isApplyingSelection,
        pageType,
        pagination.page,
        pagination.pageSize,
        remoteQueryParams,
        remoteSearchKey,
        refreshVersion,
    ]);

    const allItems = useMemo(() => processes.flatMap((group) => [...group.items, ...group.functionItems]), [processes]);

    // Main-table Sample Data header: shows the selected range(s) when samples are limited to them.
    const sampleDataHeader = useMemo(() => {
        const displays = selectedDatetimeRanges.map((range) => range.display);
        if (displays.length === 0) {
            return { label: t('Sample Data'), title: undefined as string | undefined };
        }
        const hasMore = displays.length > 1;
        return {
            label: `${t('Sample Data')} (${displays[0]}${hasMore ? ' …' : ''})`,
            // Hovering reveals every selected range when more than one is active.
            title: hasMore ? displays.join(', ') : undefined,
        };
    }, [selectedDatetimeRanges, t]);

    useEffect(() => {
        // Validate regex pattern for UI feedback (invalid pattern class) and to catch errors early.
        // Backend also validates and handles regex matching.
        if (!filters.regexSearch.trim()) {
            setRegexInvalid(false);
            return;
        }

        try {
            new RegExp(filters.regexSearch, 'i');
            setRegexInvalid(false);
        } catch {
            setRegexInvalid(true);
        }
    }, [filters.regexSearch]);

    const visibleByProcess = useMemo(() => {
        return processes.map((group) => {
            const selectedCount = group.summary.selected;

            return {
                ...group,
                selectedCount,
                selectableCount: group.summary.total,
                filteredItems: group.items,
                filteredFunctionItems: group.functionItems,
            };
        });
    }, [processes, isExpanded]);

    const filteredOrderedItems = useMemo(
        () => visibleByProcess.flatMap((group) => [...group.filteredItems, ...group.filteredFunctionItems]),
        [visibleByProcess],
    );

    const totalPages = useMemo(() => Math.max(serverPagination.total_pages, 1), [serverPagination.total_pages]);

    const currentPage = Math.min(pagination.page, totalPages);
    const pageStartIndex = serverPagination.total === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1;
    const pageEndIndex =
        serverPagination.total === 0
            ? 0
            : Math.min(pageStartIndex + (isExpanded ? allItems.length : processes.length) - 1, serverPagination.total);

    useEffect(() => {
        setPagination((prev) => {
            const page = Math.min(prev.page, totalPages);
            const jumpPage = String(page);
            if (page === prev.page && jumpPage === prev.jumpPage) {
                return prev;
            }
            return { ...prev, page, jumpPage };
        });
    }, [totalPages]);

    const firstVisibleItem = useMemo(() => filteredOrderedItems[0] ?? null, [filteredOrderedItems]);

    const activeItem = useMemo(() => {
        const fallback = firstVisibleItem;
        if (!activeRowKey) {
            return fallback;
        }
        return allItems.find((item) => itemKey(item) === activeRowKey) ?? fallback;
    }, [activeRowKey, allItems, firstVisibleItem]);

    const activeProcess = processes.find((process) => process.id === activeProcessId) ?? processes[0];

    useEffect(() => {
        if (!activeItem) {
            setActiveRowKey(null);
            return;
        }
        setActiveRowKey(itemKey(activeItem));
    }, [activeItem]);

    // While 表示する項目 is set, only selected variables inside that range are counted and plotted.
    const effectiveSelectedIds = useMemo(() => {
        if (!rangeColumnIds) return selectedColumnIds;
        const rangeIdSet = new Set(rangeColumnIds);
        return selectedColumnIds.filter((columnId) => rangeIdSet.has(columnId));
    }, [rangeColumnIds, selectedColumnIds]);
    const selectedTotal = effectiveSelectedIds.length;
    const maxSensors = pageTypeConfig.maxSensors;
    const remainingSensors = maxSensors - selectedTotal;
    const displayTotal = isExpanded
        ? visibleByProcess.reduce(
              (sum, group) => sum + group.filteredItems.length + group.filteredFunctionItems.length,
              0,
          )
        : processes.length;

    const detailUniqueSamples = useMemo(() => {
        if (!activeItem) return [] as string[];
        if (activeItem.uniqueValues.length > 0) {
            return activeItem.uniqueValues;
        }
        return Array.from(new Set(activeItem.samples.filter((sample) => sample && sample.toUpperCase() !== 'NA')));
    }, [activeItem]);

    const isMapPage = pageType === 'map';
    // The draft layout is derived from every known column, so validation does not depend on the
    // page or the filters currently displayed.
    const layoutState = useMemo(
        () => (isMapPage ? toLayoutState(cachedItemUiStates) : {}),
        [cachedItemUiStates, isMapPage],
    );
    const layoutMaxOrder = useMemo(() => getMaxUsedOrder(layoutState), [layoutState]);

    const updateItems = (updater: (item: VariableItem) => VariableItem) => {
        const next = processes.map((group) => ({
            ...group,
            items: group.items.map(updater),
            functionItems: group.functionItems.map(updater),
        }));
        const nextSelectedIds = new Set(selectedColumnIds);
        const nextUiStates = { ...cachedItemUiStates };
        next.forEach((group) => {
            [...group.items, ...group.functionItems].forEach((item) => {
                if (item.plot) nextSelectedIds.add(item.columnId);
                else nextSelectedIds.delete(item.columnId);
                nextUiStates[itemKey(item)] = toVariableItemUiState(item);
            });
        });
        setProcesses(next);
        setSelectedColumnIds(Array.from(nextSelectedIds));
        setCachedItemUiStates(nextUiStates);
    };

    // Layout validation and bulk assignment must see every column the modal knows about, so the
    // rendered page is merged into the cached states before each draft change.
    const seedDraftStates = (): DraftStates => {
        const states = { ...cachedItemUiStates };
        allItems.forEach((item) => {
            states[itemKey(item)] = toVariableItemUiState(item);
        });
        return states;
    };

    const commitDraft = (states: DraftStates, nextSelectedIds?: number[]) => {
        const selected = nextSelectedIds ? new Set(nextSelectedIds) : null;
        const syncItem = (item: VariableItem): VariableItem => {
            const next = applyVariableItemUiState(item, states[itemKey(item)]);
            return selected ? { ...next, plot: selected.has(item.columnId) } : next;
        };
        setCachedItemUiStates(states);
        setProcesses((prev) =>
            prev.map((group) => ({
                ...group,
                items: group.items.map(syncItem),
                functionItems: group.functionItems.map(syncItem),
            })),
        );
        if (nextSelectedIds) setSelectedColumnIds(nextSelectedIds);
    };

    // MAP keeps Plot and primary subplots in sync: every plotted variable owns a primary 1-6.
    // `evictOldest` reproduces the end process limit: ticking one more variable unticks the one
    // ticked first instead of refusing the new one.
    const setMapPlotByPredicate = (predicate: (item: VariableItem) => boolean, value: boolean, evictOldest = false) => {
        const targets = filteredOrderedItems.filter(predicate);
        if (targets.length === 0) return;
        const selected = new Set(selectedColumnIds);
        let states = seedDraftStates();
        if (value) {
            targets.forEach((item) => {
                if (selected.has(item.columnId)) return;
                if (evictOldest) {
                    const result = assignPrimaryEvictingOldest(states, item.columnId);
                    if (!result) return;
                    if (result.evictedColumnId !== null) selected.delete(result.evictedColumnId);
                    states = result.states;
                    selected.add(item.columnId);
                    return;
                }
                const assigned = assignPrimaryOnCheck(states, item.columnId);
                if (!assigned) return;
                states = assigned;
                selected.add(item.columnId);
            });
        } else {
            const removed = targets.filter((item) => selected.has(item.columnId));
            removed.forEach((item) => selected.delete(item.columnId));
            states = clearLayoutValues(
                states,
                removed.map((item) => item.columnId),
            );
        }
        commitDraft(compactDraft(states), Array.from(selected));
    };

    const setPlotByPredicate = (predicate: (item: VariableItem) => boolean, value: boolean, evictOldest = false) => {
        if (isMapPage) {
            setMapPlotByPredicate(predicate, value, evictOldest);
            return;
        }
        // Rows without the Plot checkbox can never be plotted.
        updateItems((item) => (item.canSelectPlot && predicate(item) ? { ...item, plot: value } : item));
    };

    const handleRangeInputChange = (field: RangeField, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const next = Number(value);
        if (value !== '' && !Number.isSafeInteger(next)) return;
        setRangeInputValues((prev) => ({ ...prev, [field]: value }));
        // Keep the applied range while the user clears or replaces a value.
        if (value !== '' && next >= DEFAULT_FILTERS[field]) {
            setFilters((prev) => ({ ...prev, [field]: next }));
        }
    };

    const handleRangeInputBlur = (field: RangeField, value: string) => {
        const next = Math.max(DEFAULT_FILTERS[field], Number(value) || DEFAULT_FILTERS[field]);
        setRangeInputValues((prev) => ({ ...prev, [field]: String(next) }));
        setFilters((prev) => ({ ...prev, [field]: next }));
    };

    const handleSetMatched = (value: boolean) => {
        return handleSelectAll(value);
    };

    const handleProcessCollapse = (processId: string) => {
        allProcessesCollapsedRef.current = null;
        setProcesses((prev) =>
            prev.map((group) => (group.id === processId ? { ...group, collapsed: !group.collapsed } : group)),
        );
    };

    const handleFunctionCollapse = (processId: string) => {
        allProcessesCollapsedRef.current = null;
        setProcesses((prev) =>
            prev.map((group) =>
                group.id === processId ? { ...group, functionCollapsed: !group.functionCollapsed } : group,
            ),
        );
    };

    const handleAllProcessesCollapse = (collapsed: boolean) => {
        allProcessesCollapsedRef.current = collapsed;
        setProcesses((prev) => prev.map((group) => ({ ...group, collapsed, functionCollapsed: collapsed })));
    };

    const handleItemPlotChange = (targetKey: string, checked: boolean) => {
        // A single tick behaves like the end process checkbox: over the limit, the oldest one is dropped.
        setPlotByPredicate((item) => itemKey(item) === targetKey, checked, true);
    };

    const validateLayoutValue = (item: VariableItem) => (value: string) =>
        validateLayoutChange(value, item.columnId, layoutState);

    const handleLayoutSelect = (item: VariableItem, value: string) => {
        const states = seedDraftStates();
        const current = getLayoutValue(states[itemKey(item)]);

        if (item.plot) {
            // Clearing or re-picking the current subplot unticks Plot, like the end process panel.
            if (value === '' || value === current || !isPrimaryValue(current) || !isPrimaryValue(value)) {
                commitDraft(
                    clearOnUncheck(states, item.columnId),
                    selectedColumnIds.filter((columnId) => columnId !== item.columnId),
                );
                return;
            }
            commitDraft(swapPrimary(states, Number(current), Number(value)));
            return;
        }

        commitDraft(applyLayoutValue(states, item.columnId, value));
    };

    const handleLayoutOverride = (item: VariableItem, value: string, conflictItemIds: string[]) => {
        commitDraft(overrideConflicts(seedDraftStates(), item.columnId, value, conflictItemIds));
    };

    const handleItemFilterChange = (targetKey: string, checked: boolean) => {
        updateItems((item) =>
            itemKey(item) === targetKey
                ? {
                      ...item,
                      filterState: checked ? '1' : '0',
                  }
                : item,
        );
    };

    const handleItemSelectControlChange = (targetKey: string, value: string) => {
        updateItems((item) => (itemKey(item) === targetKey ? { ...item, additionalColumn: value } : item));
    };

    const updateRoleStates = (updater: (state: VariableItemUiState, key: string) => VariableItemUiState) => {
        const states = { ...cachedItemUiStates };
        allItems.forEach((item) => {
            states[itemKey(item)] = toVariableItemUiState(item);
        });
        const next = Object.fromEntries(Object.entries(states).map(([key, state]) => [key, updater(state, key)]));
        setCachedItemUiStates(next);
        setProcesses((prev) =>
            prev.map((group) => ({
                ...group,
                items: group.items.map((item) => applyVariableItemUiState(item, next[itemKey(item)])),
                functionItems: group.functionItems.map((item) => applyVariableItemUiState(item, next[itemKey(item)])),
            })),
        );
    };

    const handleItemFacetChange = (targetKey: string, value: VariableItem['facetState']) => {
        updateRoleStates((state, key) => {
            if (key === targetKey)
                return {
                    ...state,
                    facetState: value,
                    ...(pageType === 'rlp' && value !== '' ? { additionalColumn: false, dynamicState: false } : {}),
                };
            return value !== '' && state.facetState === value ? { ...state, facetState: '' } : state;
        });
    };

    const handleItemAdditionalColumnChange = (targetKey: string, value: string | boolean) => {
        updateRoleStates((state, key) => {
            if (key === targetKey)
                return {
                    ...state,
                    additionalColumn: value,
                    dynamicState: value,
                    ...(pageType === 'rlp' && value ? { facetState: '' as const } : {}),
                };
            return pageTypeConfig.controlType === 'radio' && value
                ? { ...state, additionalColumn: false, dynamicState: false }
                : state;
        });
    };

    const applySelectionChange = async (
        selectionParams: Pick<
            ProcessColumnsQueryParams,
            'select_all' | 'exclude_key' | 'deselect_keys' | 'process_ids'
        >,
        ignoreFilters = false,
    ) => {
        const requestVersion = ++fetchVersionRef.current;
        setIsApplyingSelection(true);
        setSelectionError(false);
        // Give immediate feedback while the server resolves the all-pages selection.
        if (!ignoreFilters && selectionParams.select_all !== undefined) {
            setAllMatchingSelected(selectionParams.select_all);
        }
        try {
            const response = await variableServices.getProcessColumns({
                ...(ignoreFilters
                    ? {
                          page_type: pageType,
                          selected_column_ids: selectedColumnIds,
                          pagination_mode: 'processes' as const,
                      }
                    : { ...remoteQueryParams, ...remoteColumnSearchParams }),
                page: 1,
                limit: pagination.pageSize,
                ...selectionParams,
            });
            if (requestVersion !== fetchVersionRef.current) return false;
            if (isMapPage) {
                // Bulk selection ignores the MAP limit, so the draft keeps at most 6 primaries in
                // display order (skipping datetime columns) and drops the rest of the selection.
                const candidates: LayoutCandidate[] = filteredOrderedItems.map((item) => ({
                    columnId: item.columnId,
                    isGetDate: item.dataTypeShort === 'CT',
                }));
                const reconciled = reconcileWithSelection(seedDraftStates(), response.selected_column_ids, candidates);
                commitDraft(reconciled.states, reconciled.selectedColumnIds);
            } else {
                setSelectedColumnIds(response.selected_column_ids);
                const selected = new Set(response.selected_column_ids);
                setProcesses((previous) =>
                    previous.map((group) => ({
                        ...group,
                        items: group.items.map((item) => ({ ...item, plot: selected.has(item.columnId) })),
                        functionItems: group.functionItems.map((item) => ({
                            ...item,
                            plot: selected.has(item.columnId),
                        })),
                    })),
                );
            }
            if (!ignoreFilters) {
                // Resetting the page is part of the bulk draft, not a separate user navigation.
                lastViewKeyRef.current = JSON.stringify([remoteSearchKey, 1, pagination.pageSize, refreshVersion]);
                setPagination((prev) => ({ ...prev, page: 1, jumpPage: '1' }));
            }
            return true;
        } catch (error) {
            if (requestVersion === fetchVersionRef.current) {
                if (!ignoreFilters && selectionParams.select_all !== undefined) {
                    setAllMatchingSelected(allMatchingSelected);
                }
                console.error('Failed to select process columns.', error);
                setSelectionError(true);
            }
            return false;
        } finally {
            if (requestVersion === fetchVersionRef.current) setIsApplyingSelection(false);
        }
    };

    const handleProcessSelect = async (processId: string, checked: boolean) => {
        setActiveProcessId(processId);
        if (!checked && selectedColumnIds.length > 0) {
            // Process mode has no column rows: clear the entire process, including filtered/off-page columns.
            const applied = await applySelectionChange({ select_all: false, process_ids: [Number(processId)] }, true);
            if (!applied) return;
        }
        setExpandedProcessIds((ids) =>
            checked
                ? ids.includes(Number(processId))
                    ? ids
                    : [...ids, Number(processId)]
                : ids.filter((id) => id !== Number(processId)),
        );
        if (!checked) setStartProcessId((current) => (current === processId ? '' : current));
    };

    const handleStartProcessSelect = (processId: string) => {
        if (startProcessId === processId) {
            setStartProcessId('');
            return;
        }
        setStartProcessId(processId);
        void handleProcessSelect(processId, true);
    };

    const handleProcessRowClick = (event: React.MouseEvent<HTMLTableRowElement>, processId: string) => {
        if (isExpanded || isApplyingSelection) return;
        // Labels already toggle their associated controls; the row must not toggle them again.
        if (event.target instanceof Element && event.target.closest('input, label, .custom-control')) return;
        void handleProcessSelect(processId, !expandedProcessIds.includes(Number(processId)));
    };

    /**
     * MAP "select all" must behave like すべて選択 of the end process
     * card: the scope covers every matching variable on all
     * pages, so the ordered candidates are read from the server instead of the rendered page.
     */
    const applyMapBulkSelection = async (checked: boolean, excludeKey = remoteQueryParams.exclude_key) => {
        const requestVersion = ++fetchVersionRef.current;
        setIsApplyingSelection(true);
        setSelectionError(false);
        setMapBulkChecked(checked);
        try {
            const response = await variableServices.getProcessColumns({
                ...remoteQueryParams,
                ...remoteColumnSearchParams,
                exclude_key: excludeKey,
                page: 1,
                limit: 1,
                include_layout_candidates: true,
            });
            if (requestVersion !== fetchVersionRef.current) return;
            const candidates = response.layout_candidates ?? [];
            const scope: LayoutCandidate[] = candidates.map((candidate) => ({
                columnId: candidate.column_id,
                isGetDate: candidate.is_get_date,
                selectable: candidate.selectable,
            }));
            const result = applyBulkMapSelection(seedDraftStates(), selectedColumnIds, scope, checked);
            commitDraft(result.states, result.selectedColumnIds);
            lastViewKeyRef.current = JSON.stringify([remoteSearchKey, 1, pagination.pageSize, refreshVersion]);
            setPagination((prev) => ({ ...prev, page: 1, jumpPage: '1' }));
        } catch (error) {
            if (requestVersion === fetchVersionRef.current) {
                setMapBulkChecked(mapBulkChecked);
                console.error('Failed to select process columns.', error);
                setSelectionError(true);
            }
        } finally {
            if (requestVersion === fetchVersionRef.current) setIsApplyingSelection(false);
        }
    };

    const handleSelectAll = (checked: boolean) =>
        isMapPage ? applyMapBulkSelection(checked) : applySelectionChange({ select_all: checked });

    // Key除く keeps key columns visible and only removes them from the selection.
    const handleExcludeKeyChange = (checked: boolean) => {
        setFilters((prev) => ({ ...prev, excludeKey: checked }));
        if (checked) {
            void applySelectionChange({ exclude_key: true, deselect_keys: true });
        } else if (isMapPage ? mapBulkChecked : allMatchingSelected) {
            void (isMapPage
                ? applyMapBulkSelection(true, false)
                : applySelectionChange({ select_all: true, exclude_key: false }));
        }
    };

    const handleOpen = () => {
        const selection = readEndProcessSelection(pageType);
        if (selection.selectedProcessIds.length > 0) {
            setFilters((prev) => (prev.showMode === 'linked' ? { ...prev, showMode: 'all' } : prev));
        }
        setIsExpanded(selection.selectedProcessIds.length > 0);
        setExpandedProcessIds(selection.selectedProcessIds);
        const startProcess = document.querySelector<HTMLSelectElement>('select[name="start_proc"]');
        setStartProcessId(startProcess?.value ?? '');
        setStartProcessOptions(
            startProcess && !startProcess.disabled
                ? Array.from(startProcess.options)
                      .map((option) => option.value)
                      .filter((value) => Number(value) > 0)
                : [],
        );
        const roleColumnIds = Object.keys(selection.columnStates).map(Number);
        lastRemoteSearchKeyRef.current = '';
        lastViewKeyRef.current = '';
        allProcessesCollapsedRef.current = false;
        sampleCacheRef.current = new Map();
        committedPlotStateRef.current = [...selection.selectedColumnIds];
        cachedItemUiStatesRef.current = selection.columnStates;
        setAgpColorOptionsByProcess({});
        setSelectedColumnIds(selection.selectedColumnIds);
        // Prioritize processes selected only by a role as well as those with checked columns.
        setPrioritizedColumnIds(Array.from(new Set([...selection.selectedColumnIds, ...roleColumnIds])));
        setAllMatchingSelected(false);
        setMapBulkChecked(false);
        setRangeColumnIds(null);
        setSelectionError(false);
        setCachedItemUiStates(selection.columnStates);
        setProcesses([]);
        setActiveProcessId(null);
        setServerPagination({
            page: 1,
            limit: pagination.pageSize,
            total: 0,
            total_pages: 0,
        });
        setPagination((prev) => ({ ...prev, page: 1, jumpPage: '1' }));
        // Snapshot the outer datetime range selection at open time, before the first fetch.
        setSelectedDatetimeRanges(readSelectedDatetimeRanges());
        setIsOpen(true);
    };

    const handleClose = () => {
        if (isApplyingSelection) return;
        ++fetchVersionRef.current;
        setIsOpen(false);
    };

    const handleOk = async () => {
        if (isApplyingSelection) return;
        const requestVersion = ++fetchVersionRef.current;
        setIsApplyingSelection(true);
        setSelectionError(false);
        try {
            const colorLabels = Object.fromEntries(
                Object.values(agpColorOptionsByProcess)
                    .flat()
                    .map(({ value, label }) => [value, label]),
            );
            let statesToApply = cachedItemUiStates;
            // Bulk drafts span all matching pages. Limit before loading legacy cards,
            // rather than letting each checkbox evict earlier selections during replay.
            // MAP already limits primary subplots separately from its other layout roles.
            const selectedIdsToApply = isMapPage
                ? effectiveSelectedIds
                : effectiveSelectedIds.slice(0, pageTypeConfig.maxSensors);
            if (isMapPage) {
                // Variables outside 表示する項目 are not plotted, so they must not keep a primary.
                const plotted = new Set(effectiveSelectedIds);
                const orphanPrimaries = getPrimaryColumnIds(statesToApply).filter((columnId) => !plotted.has(columnId));
                statesToApply = compactDraft(clearLayoutValues(statesToApply, orphanPrimaries));
                setCachedItemUiStates(statesToApply);
            }
            await withProcessSelectionBatch(async () => {
                await applyEndProcessSelection(
                    pageType,
                    selectedIdsToApply,
                    statesToApply,
                    colorLabels,
                    expandedProcessIds,
                );
                const startProcess = document.querySelector<HTMLSelectElement>('select[name="start_proc"]');
                if (startProcess && startProcessOptions.length && startProcess.value !== startProcessId) {
                    startProcess.value = startProcessId;
                    $(startProcess).trigger('change');
                }
            });
            if (requestVersion !== fetchVersionRef.current) return;
            committedPlotStateRef.current = [...selectedIdsToApply];
            setIsOpen(false);
        } catch (error) {
            if (requestVersion === fetchVersionRef.current) {
                console.error('Failed to apply process columns.', error);
                setSelectionError(true);
            }
        } finally {
            if (requestVersion === fetchVersionRef.current) setIsApplyingSelection(false);
        }
    };

    const handleCancel = () => {
        setSelectedColumnIds([...committedPlotStateRef.current]);
        handleClose();
    };

    const switchMode = (nextExpanded: boolean) => {
        if (nextExpanded === isExpanded) return;
        ++fetchVersionRef.current;
        if (nextExpanded) {
            setFilters((prev) => (prev.showMode === 'linked' ? { ...prev, showMode: 'all' } : prev));
        }
        setIsExpanded(nextExpanded);
        setProcesses([]);
        setPagination((prev) => ({ ...prev, page: 1, jumpPage: '1' }));
    };

    const facetText = (facetState: VariableItem['facetState']) => {
        if (facetState === '1') return 'LV1';
        if (facetState === '2') return 'LV2';
        if (facetState === '0') return 'DIV';
        return '-';
    };

    return (
        <div className="variable-select-page">
            <Button id="openVariableSelectModal" className="btn btn-sm" onClick={handleOpen}>
                {t('Select')}
            </Button>

            <Modal
                show={isOpen}
                onHide={handleClose}
                size="xl"
                dialogClassName="variable-select-modal"
                backdrop="static"
                keyboard={false}
            >
                <Modal.Header>
                    <Modal.Title>{t('Variable Select')}</Modal.Title>
                    <button
                        type="button"
                        className="variable-select-close-button"
                        aria-label={t('Close')}
                        onClick={handleClose}
                    >
                        ×
                    </button>
                </Modal.Header>
                <Modal.Body inert={isApplyingSelection}>
                    <div className={`variable-select-layout${isExpanded ? '' : ' is-process-mode'}`}>
                        <section className="variable-select-main">
                            <div className="variable-select-top">
                                <div className="variable-select-top--button-wrap">
                                    <div
                                        className="btn-group variable-select-mode-actions"
                                        role="group"
                                        aria-label={t('Variable Select')}
                                    >
                                        <button
                                            type="button"
                                            id="variable-select-process-mode"
                                            className={`btn btn-sm variable-select-mode-button${!isExpanded ? ' is-active' : ''}`}
                                            aria-pressed={!isExpanded}
                                            onClick={() => switchMode(false)}
                                        >
                                            {t('Process')}
                                        </button>
                                        <button
                                            type="button"
                                            id="variable-select-variable-mode"
                                            className={`btn btn-sm variable-select-mode-button${isExpanded ? ' is-active' : ''}`}
                                            aria-pressed={isExpanded}
                                            onClick={() => switchMode(true)}
                                        >
                                            {t('Variable')}
                                        </button>
                                    </div>
                                    <div className="variable-select-expand-actions">
                                        <button
                                            type="button"
                                            id="variable-select-expand-all"
                                            className="btn simple-btn btn-setting"
                                            disabled={
                                                !isExpanded || isLoadingColumns || columnsError || !processes.length
                                            }
                                            onClick={() => handleAllProcessesCollapse(false)}
                                        >
                                            {t('Expand All')}
                                        </button>
                                        <button
                                            type="button"
                                            id="variable-select-collapse-all"
                                            className="btn simple-btn btn-setting"
                                            disabled={
                                                !isExpanded || isLoadingColumns || columnsError || !processes.length
                                            }
                                            onClick={() => handleAllProcessesCollapse(true)}
                                        >
                                            {t('Collapse All')}
                                        </button>
                                    </div>
                                </div>
                                <div className="variable-select-toolbar">
                                    <div className="variable-select-toolbar-row">
                                        <span id="variable-select-show-items-label" className="label">
                                            {t('Show items')}
                                        </span>
                                        <label className="variable-select-range-label" htmlFor="variable-select-from">
                                            From
                                        </label>
                                        <input
                                            id="variable-select-from"
                                            className="form-control small-number"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={rangeInputValues.idxStart}
                                            onChange={(event) => handleRangeInputChange('idxStart', event.target.value)}
                                            onBlur={(event) => handleRangeInputBlur('idxStart', event.target.value)}
                                        />
                                        <label className="variable-select-range-label" htmlFor="variable-select-size">
                                            Size
                                        </label>
                                        <input
                                            id="variable-select-size"
                                            className="form-control small-number small-number--size"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={rangeInputValues.idxSize}
                                            onChange={(event) => handleRangeInputChange('idxSize', event.target.value)}
                                            onBlur={(event) => handleRangeInputBlur('idxSize', event.target.value)}
                                        />
                                        <label className="variable-select-range-label" htmlFor="variable-select-step">
                                            Step
                                        </label>
                                        <input
                                            id="variable-select-step"
                                            className="form-control small-number small-number--step"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={rangeInputValues.idxInterval}
                                            onChange={(event) =>
                                                handleRangeInputChange('idxInterval', event.target.value)
                                            }
                                            onBlur={(event) => handleRangeInputBlur('idxInterval', event.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="btn simple-btn btn-setting"
                                            onClick={() => {
                                                setRangeInputValues(DEFAULT_RANGE_INPUT_VALUES);
                                                setFilters((prev) => ({
                                                    ...prev,
                                                    idxStart: 1,
                                                    idxSize: 0,
                                                    idxInterval: 1,
                                                }));
                                            }}
                                        >
                                            <HoverHelp
                                                id="variable-select-all-tooltip"
                                                message={t('Variable select All hover')}
                                            >
                                                All
                                            </HoverHelp>
                                        </button>

                                        <div className="step"></div>

                                        <div className="search-input-wrapper">
                                            <input
                                                className={`form-control search-input ${regexInvalid ? 'invalid' : ''}`}
                                                placeholder={t('Search')}
                                                value={filters.regexSearch}
                                                id="searchRegexInput"
                                                onChange={(event) => {
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        regexSearch: event.target.value,
                                                    }));
                                                }}
                                            />
                                            {filters.regexSearch && (
                                                <button
                                                    type="button"
                                                    className="btn-clear-search"
                                                    onClick={() => {
                                                        setFilters((prev) => ({ ...prev, regexSearch: '' }));
                                                    }}
                                                    aria-label={t('Clear search')}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="btn simple-btn btn-setting"
                                            onClick={() => handleSetMatched(true)}
                                            disabled={!isExpanded}
                                        >
                                            <HoverHelp
                                                id="variable-select-set-tooltip"
                                                message={t('Variable select Set hover')}
                                            >
                                                Set
                                            </HoverHelp>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn simple-btn btn-setting"
                                            onClick={() => handleSetMatched(false)}
                                            disabled={!isExpanded}
                                        >
                                            Reset
                                        </button>
                                        <div className="step"></div>
                                        <span>
                                            {t('Display')}:{' '}
                                            <span title={String(displayTotal)}>{String(displayTotal).slice(0, 6)}</span>
                                        </span>

                                        <PaginationControls
                                            variant="compact"
                                            className="ml-auto"
                                            total={serverPagination.total}
                                            totalPages={totalPages}
                                            currentPage={currentPage}
                                            start={pageStartIndex}
                                            end={pageEndIndex}
                                            jumpPage={pagination.jumpPage}
                                            onJumpPageChange={(jumpPage) =>
                                                setPagination((prev) => ({ ...prev, jumpPage }))
                                            }
                                            onPageChange={(page) =>
                                                setPagination((prev) => ({ ...prev, page, jumpPage: String(page) }))
                                            }
                                        >
                                            <label className="page-size-label mb-0">
                                                <select
                                                    className="page-size"
                                                    value={pagination.pageSize}
                                                    onChange={(event) => {
                                                        const pageSize = Number(event.target.value);
                                                        setPagination((prev) => ({
                                                            ...prev,
                                                            pageSize,
                                                            page: 1,
                                                            jumpPage: '1',
                                                        }));
                                                    }}
                                                >
                                                    {PAGING_LIMIT_OPTIONS.map((size) => (
                                                        <option key={size} value={size}>
                                                            {size}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </PaginationControls>
                                    </div>

                                    <div className="variable-select-toolbar-row">
                                        <div className="custom-control custom-radio grp-height-align mr-3">
                                            <input
                                                type="radio"
                                                className="custom-control-input"
                                                id="variable-select-show-all"
                                                name="variable-select-show-mode"
                                                checked={filters.showMode === 'all'}
                                                onChange={() => setFilters((prev) => ({ ...prev, showMode: 'all' }))}
                                            />
                                            <label
                                                className="custom-control-label text-nowrap"
                                                htmlFor="variable-select-show-all"
                                            >
                                                {t('Show all')}
                                            </label>
                                        </div>
                                        <div className="custom-control custom-radio grp-height-align mr-3">
                                            <input
                                                type="radio"
                                                className="custom-control-input"
                                                id="variable-select-show-selected"
                                                name="variable-select-show-mode"
                                                checked={filters.showMode === 'selected'}
                                                onChange={() =>
                                                    setFilters((prev) => ({ ...prev, showMode: 'selected' }))
                                                }
                                            />
                                            <label
                                                className="custom-control-label text-nowrap"
                                                htmlFor="variable-select-show-selected"
                                            >
                                                {t('Show selected only')}
                                            </label>
                                        </div>
                                        <div className="custom-control custom-radio grp-height-align mr-3">
                                            <input
                                                type="radio"
                                                className="custom-control-input"
                                                id="variable-select-show-unselected"
                                                name="variable-select-show-mode"
                                                checked={filters.showMode === 'unselected'}
                                                onChange={() =>
                                                    setFilters((prev) => ({ ...prev, showMode: 'unselected' }))
                                                }
                                            />
                                            <label
                                                className="custom-control-label text-nowrap"
                                                htmlFor="variable-select-show-unselected"
                                            >
                                                {t('Show unselected only')}
                                            </label>
                                        </div>
                                        {!isExpanded && (
                                            <div className="custom-control custom-radio grp-height-align mr-3">
                                                <input
                                                    type="radio"
                                                    className="custom-control-input"
                                                    id="variable-select-show-linked"
                                                    name="variable-select-show-mode"
                                                    checked={filters.showMode === 'linked'}
                                                    onChange={() =>
                                                        setFilters((prev) => ({ ...prev, showMode: 'linked' }))
                                                    }
                                                />
                                                <label
                                                    className="custom-control-label text-nowrap"
                                                    htmlFor="variable-select-show-linked"
                                                >
                                                    {t('Show DataLink items only')}
                                                </label>
                                            </div>
                                        )}

                                        {isExpanded && (
                                            <>
                                                <div className="custom-control custom-checkbox grp-height-align mr-3">
                                                    <input
                                                        type="checkbox"
                                                        className="custom-control-input"
                                                        id="variable-select-check-all"
                                                        checked={isMapPage ? mapBulkChecked : allMatchingSelected}
                                                        disabled={isLoadingColumns || columnsError}
                                                        onChange={(event) => void handleSelectAll(event.target.checked)}
                                                    />
                                                    <label
                                                        className="custom-control-label text-nowrap"
                                                        htmlFor="variable-select-check-all"
                                                    >
                                                        {t('Select all')}
                                                    </label>
                                                </div>

                                                <div className="custom-control custom-checkbox grp-height-align mr-3">
                                                    <input
                                                        type="checkbox"
                                                        className="custom-control-input"
                                                        id="variable-select-exclude-key"
                                                        checked={filters.excludeKey}
                                                        onChange={(event) =>
                                                            handleExcludeKeyChange(event.target.checked)
                                                        }
                                                    />
                                                    <label
                                                        className="custom-control-label text-nowrap"
                                                        htmlFor="variable-select-exclude-key"
                                                    >
                                                        <HoverHelp
                                                            id="variable-select-exclude-key-tooltip"
                                                            message={t('Variable select Exclude key hover')}
                                                        >
                                                            {t('Exclude key')}
                                                        </HoverHelp>
                                                    </label>
                                                </div>
                                            </>
                                        )}
                                        <div className="step"></div>
                                        <span className="selected-count">
                                            {`${t('Selected')}: `}
                                            {isExpanded ? (
                                                <>
                                                    <span className={remainingSensors < 0 ? 'over-limit' : ''}>
                                                        {selectedTotal}
                                                    </span>
                                                    {`/${maxSensors} (`}
                                                    <span className={remainingSensors < 0 ? 'over-limit' : ''}>
                                                        {t('Variable select remaining', { count: remainingSensors })}
                                                    </span>
                                                    {')'}
                                                </>
                                            ) : (
                                                `${expandedProcessIds.length}/${serverPagination.total}`
                                            )}
                                        </span>

                                        {isExpanded && (
                                            <div className="simple-filter">
                                                <HoverHelp
                                                    id="variable-select-simple-filter-tooltip"
                                                    message={t('Variable select Simple filter hover')}
                                                >
                                                    <strong>{t('Simple filter')}</strong>
                                                </HoverHelp>
                                                <div className="custom-control custom-checkbox grp-height-align mb-0">
                                                    <input
                                                        type="checkbox"
                                                        className="custom-control-input"
                                                        id="variable-select-same-only"
                                                        checked={filters.sameFilter}
                                                        onChange={(event) => {
                                                            setFilters((prev) => ({
                                                                ...prev,
                                                                sameFilter: event.target.checked,
                                                            }));
                                                        }}
                                                    />
                                                    <label
                                                        className="custom-control-label text-nowrap"
                                                        htmlFor="variable-select-same-only"
                                                    >
                                                        {t('All same values')}
                                                    </label>
                                                </div>
                                                <div className="custom-control custom-checkbox grp-height-align mb-0">
                                                    <input
                                                        type="checkbox"
                                                        className="custom-control-input"
                                                        id="variable-select-na-only"
                                                        checked={filters.naFilter}
                                                        onChange={(event) => {
                                                            setFilters((prev) => ({
                                                                ...prev,
                                                                naFilter: event.target.checked,
                                                            }));
                                                        }}
                                                    />
                                                    <label
                                                        className="custom-control-label text-nowrap"
                                                        htmlFor="variable-select-na-only"
                                                    >
                                                        {t('All empty (NA)')}
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                        <div className="toolbar-actions">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-success"
                                                onClick={() => void handleOk()}
                                                disabled={isApplyingSelection}
                                            >
                                                OK
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-light"
                                                onClick={handleCancel}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="variable-select-table-shell table-shell">
                                {selectionError && <div role="alert">{t('Failed to select process columns.')}</div>}
                                {columnsError && (
                                    <div role="alert">
                                        {t('Failed to fetch process columns.')}
                                        <button
                                            type="button"
                                            className="btn simple-btn"
                                            onClick={() => setRefreshVersion((prev) => prev + 1)}
                                        >
                                            {t('Retry')}
                                        </button>
                                    </div>
                                )}
                                <table className="variable-select-table">
                                    <colgroup>
                                        <col style={{ width: '45px' }} />
                                        <col style={{ width: '58px' }} />
                                        <col style={{ width: '170px' }} />
                                        <col style={{ width: '70px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '40px' }} />
                                        {pageTypeConfig.columnName && <col style={{ width: '38px' }} />}
                                        <col style={{ width: '38px' }} />
                                        <col style={{ width: '44px' }} />
                                        <col style={{ width: '70px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '120px' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>
                                                {isExpanded ? (
                                                    t('Process')
                                                ) : (
                                                    <HoverHelp
                                                        id="variable-select-process-tooltip"
                                                        message={t('Variable select Process header hover')}
                                                    >
                                                        {t('Process')}
                                                    </HoverHelp>
                                                )}
                                            </th>
                                            <th>{t('idx')}</th>
                                            <th>{t('Variable name')}</th>
                                            <th>{t('Data Type')}</th>
                                            <th>{t('System Name')}</th>
                                            <th>
                                                <HoverHelp
                                                    id="variable-select-plot-tooltip"
                                                    message={t('Variable select Plot hover')}
                                                >
                                                    {t('Plot')}
                                                </HoverHelp>
                                            </th>
                                            {pageTypeConfig.columnName && <th>{t(pageTypeConfig.columnName)}</th>}
                                            <th>Facet</th>
                                            <th>Filter</th>
                                            <th>{t('Unit')}</th>
                                            <th colSpan={SAMPLE_HEADERS.length} title={sampleDataHeader.title}>
                                                {sampleDataHeader.label}
                                            </th>
                                        </tr>
                                        <tr className="filter-row">
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder={t('Filter')}
                                                        value={columnFilters.process}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, process: value }));
                                                        }}
                                                    />
                                                    {columnFilters.process && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({ ...prev, process: '' }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder="idx"
                                                        value={columnFilters.idx}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, idx: value }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.idx && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({ ...prev, idx: '' }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder={t('Variable name')}
                                                        value={columnFilters.name}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, name: value }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.name && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({ ...prev, name: '' }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder={t('Data Type')}
                                                        value={columnFilters.type}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, type: value }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.type && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({ ...prev, type: '' }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>

                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder={t('System Name')}
                                                        value={columnFilters.english}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, english: value }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.english && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({ ...prev, english: '' }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder="0/1/other"
                                                        value={columnFilters.plotState}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, plotState: value }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.plotState && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({
                                                                    ...prev,
                                                                    plotState: '',
                                                                }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            {pageTypeConfig.columnName && (
                                                <th>
                                                    <div className="filter-input-wrapper">
                                                        <input
                                                            className="filter-input"
                                                            placeholder={pageTypeConfig.placeholder}
                                                            value={columnFilters.additionalColumn}
                                                            disabled={!isExpanded}
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                setColumnFilters((prev) => ({
                                                                    ...prev,
                                                                    additionalColumn: value,
                                                                }));
                                                            }}
                                                        />
                                                        {isExpanded && columnFilters.additionalColumn && (
                                                            <button
                                                                type="button"
                                                                className="btn-clear-filter"
                                                                onClick={() => {
                                                                    setColumnFilters((prev) => ({
                                                                        ...prev,
                                                                        additionalColumn: '',
                                                                    }));
                                                                }}
                                                                aria-label={t('Clear')}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                </th>
                                            )}
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder="0/1/2/lv/div/other"
                                                        value={columnFilters.facetState}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({
                                                                ...prev,
                                                                facetState: value,
                                                            }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.facetState && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({
                                                                    ...prev,
                                                                    facetState: '',
                                                                }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder="0/1/other"
                                                        value={columnFilters.filterState}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({
                                                                ...prev,
                                                                filterState: value,
                                                            }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.filterState && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({
                                                                    ...prev,
                                                                    filterState: '',
                                                                }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder={t('Unit')}
                                                        value={columnFilters.unit}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({ ...prev, unit: value }));
                                                        }}
                                                    />
                                                    {isExpanded && columnFilters.unit && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({ ...prev, unit: '' }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            <th colSpan={SAMPLE_HEADERS.length}>
                                                <div className="filter-input-wrapper">
                                                    <input
                                                        className="filter-input"
                                                        placeholder={`Sample${SAMPLE_HEADERS.length > 1 ? ' Values' : ''}`}
                                                        value={columnFilters.samples[0] ?? ''}
                                                        disabled={!isExpanded}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setColumnFilters((prev) => ({
                                                                ...prev,
                                                                samples: Array(SAMPLE_HEADERS.length).fill(value),
                                                            }));
                                                        }}
                                                    />
                                                    {isExpanded && (columnFilters.samples[0] ?? '') && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-filter"
                                                            onClick={() => {
                                                                setColumnFilters((prev) => ({
                                                                    ...prev,
                                                                    samples: Array(SAMPLE_HEADERS.length).fill(''),
                                                                }));
                                                            }}
                                                            aria-label={t('Clear')}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleByProcess.map((group) => {
                                            const plotItems = [
                                                ...group.filteredItems,
                                                ...group.filteredFunctionItems,
                                            ].filter((item) => item.canSelectPlot);
                                            const selectedPlotCount = plotItems.filter((item) => item.plot).length;
                                            return (
                                                <React.Fragment key={group.id}>
                                                    <tr
                                                        className={`process-row${isExpanded ? '' : ' process-selectable'}`}
                                                        onClick={(event) => handleProcessRowClick(event, group.id)}
                                                        onMouseEnter={() => {
                                                            if (!isExpanded) setActiveProcessId(group.id);
                                                        }}
                                                        onFocus={() => {
                                                            if (!isExpanded) setActiveProcessId(group.id);
                                                        }}
                                                    >
                                                        <td
                                                            colSpan={
                                                                isExpanded ? 5 : pageTypeConfig.columnName ? 15 : 14
                                                            }
                                                        >
                                                            <div className="process-row-inner">
                                                                {isExpanded ? (
                                                                    <span
                                                                        className="chevron"
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        id={`process-collapse-${group.id}`}
                                                                        aria-label={`${t('Show items')} ${group.name}`}
                                                                        aria-expanded={!group.collapsed}
                                                                        onClick={() => handleProcessCollapse(group.id)}
                                                                        onKeyDown={(event) => {
                                                                            if (
                                                                                event.key === 'Enter' ||
                                                                                event.key === ' '
                                                                            ) {
                                                                                event.preventDefault();
                                                                                handleProcessCollapse(group.id);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {group.collapsed ? '▸' : '▾'}
                                                                    </span>
                                                                ) : (
                                                                    <div className="custom-control custom-checkbox mb-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="custom-control-input"
                                                                            id={`process-check-${group.id}`}
                                                                            aria-label={`${t('Show items')} ${group.name}`}
                                                                            checked={expandedProcessIds.includes(
                                                                                Number(group.id),
                                                                            )}
                                                                            onChange={(event) =>
                                                                                handleProcessSelect(
                                                                                    group.id,
                                                                                    event.target.checked,
                                                                                )
                                                                            }
                                                                        />
                                                                        <label
                                                                            className="custom-control-label"
                                                                            htmlFor={`process-check-${group.id}`}
                                                                        ></label>
                                                                    </div>
                                                                )}
                                                                {!isExpanded &&
                                                                    startProcessOptions.includes(group.id) && (
                                                                        <div
                                                                            className="custom-control custom-radio mb-0"
                                                                            title={t(
                                                                                'The process selected with the radio button will be used as the starting point.',
                                                                            )}
                                                                        >
                                                                            <input
                                                                                type="radio"
                                                                                className="custom-control-input"
                                                                                name="variable-select-start-process"
                                                                                id={`start-process-${group.id}`}
                                                                                aria-label={`${t('Start point')} ${group.name}`}
                                                                                checked={startProcessId === group.id}
                                                                                onClick={() =>
                                                                                    handleStartProcessSelect(group.id)
                                                                                }
                                                                                onChange={() => {}}
                                                                            />
                                                                            <label
                                                                                className="custom-control-label"
                                                                                htmlFor={`start-process-${group.id}`}
                                                                            ></label>
                                                                        </div>
                                                                    )}
                                                                <label
                                                                    htmlFor={
                                                                        isExpanded
                                                                            ? undefined
                                                                            : `process-check-${group.id}`
                                                                    }
                                                                    className="mb-0"
                                                                >
                                                                    {group.name}
                                                                </label>
                                                                <span className="process-summary">
                                                                    {`${group.summary.selected} / ${group.summary.total}`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {isExpanded && (
                                                            <>
                                                                <td className="plot-cell">
                                                                    <div className="custom-control custom-checkbox mb-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="custom-control-input"
                                                                            id={`process-plot-check-${group.id}`}
                                                                            checked={
                                                                                plotItems.length > 0 &&
                                                                                selectedPlotCount === plotItems.length
                                                                            }
                                                                            disabled={
                                                                                isLoadingColumns ||
                                                                                isApplyingSelection ||
                                                                                columnsError ||
                                                                                plotItems.length === 0
                                                                            }
                                                                            ref={(input) => {
                                                                                if (input) {
                                                                                    input.indeterminate =
                                                                                        selectedPlotCount > 0 &&
                                                                                        selectedPlotCount <
                                                                                            plotItems.length;
                                                                                }
                                                                            }}
                                                                            onChange={(event) =>
                                                                                setPlotByPredicate(
                                                                                    (item) =>
                                                                                        item.processId === group.id &&
                                                                                        item.canSelectPlot,
                                                                                    event.target.checked,
                                                                                )
                                                                            }
                                                                        />
                                                                        <label
                                                                            className="custom-control-label"
                                                                            htmlFor={`process-plot-check-${group.id}`}
                                                                            aria-label={`${t('Select all')} ${group.name} ${t('Plot')}`}
                                                                        ></label>
                                                                    </div>
                                                                </td>
                                                                <td colSpan={pageTypeConfig.columnName ? 9 : 8}></td>
                                                            </>
                                                        )}
                                                    </tr>

                                                    {!group.collapsed &&
                                                        group.filteredItems.map((item) => {
                                                            const key = itemKey(item);
                                                            const plotCheckboxId = `plot-check-${item.processId}-${item.idx}`;
                                                            const filterCheckboxId = `filter-check-${item.processId}-${item.idx}`;
                                                            const colorVariablesOptions =
                                                                pageType === 'agp'
                                                                    ? (agpColorOptionsByProcess[group.id] ??
                                                                      getAgpColorOptions(group))
                                                                    : (pageTypeConfig?.options ?? []);
                                                            const canShowPageTypeColumnControl = canShowPageTypeControl(
                                                                pageType,
                                                                {
                                                                    datatype: item.dataType,
                                                                    column_type: item.columnType,
                                                                    is_serial_no: item.isSerialNo,
                                                                    is_int_category: item.isIntCategory,
                                                                    is_judge: item.isJudge,
                                                                },
                                                            );
                                                            const active = activeItem
                                                                ? itemKey(activeItem) === key
                                                                : false;
                                                            return (
                                                                <tr
                                                                    key={key}
                                                                    className={active ? 'active-row' : ''}
                                                                    onMouseEnter={() => setActiveRowKey(key)}
                                                                >
                                                                    <td></td>
                                                                    <td>{item.idx}</td>
                                                                    <td>{item.name}</td>
                                                                    <td>{item.dataTypeShort}</td>
                                                                    <td className="english-name-cell">
                                                                        {item.english}
                                                                    </td>
                                                                    <td className="plot-cell">
                                                                        {item.canSelectPlot && (
                                                                            <div className="custom-control custom-checkbox mb-0">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="custom-control-input"
                                                                                    id={plotCheckboxId}
                                                                                    checked={item.plot}
                                                                                    onChange={(event) => {
                                                                                        handleItemPlotChange(
                                                                                            key,
                                                                                            event.target.checked,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="custom-control-label"
                                                                                    htmlFor={plotCheckboxId}
                                                                                    aria-label={`${item.english} plot`}
                                                                                ></label>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    {pageTypeConfig.columnName && (
                                                                        <td className="plot-cell">
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'checkbox' && (
                                                                                    <div className="custom-control custom-checkbox mb-0">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            className="custom-control-input"
                                                                                            id={`dynamic-${key}`}
                                                                                            checked={Boolean(
                                                                                                item.dynamicState,
                                                                                            )}
                                                                                            onChange={(event) => {
                                                                                                handleItemAdditionalColumnChange(
                                                                                                    key,
                                                                                                    event.target
                                                                                                        .checked,
                                                                                                );
                                                                                            }}
                                                                                        />
                                                                                        <label
                                                                                            className="custom-control-label"
                                                                                            htmlFor={`dynamic-${key}`}
                                                                                            aria-label={`${item.english} ${pageTypeConfig.columnName}`}
                                                                                        ></label>
                                                                                    </div>
                                                                                )}
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'radio' && (
                                                                                    <div className="custom-control custom-radio mb-0">
                                                                                        <input
                                                                                            type="radio"
                                                                                            className="custom-control-input"
                                                                                            id={`dynamic-${key}`}
                                                                                            name="variable-select-dynamic"
                                                                                            checked={Boolean(
                                                                                                item.dynamicState,
                                                                                            )}
                                                                                            onChange={(event) => {
                                                                                                if (
                                                                                                    event.target.checked
                                                                                                ) {
                                                                                                    handleItemAdditionalColumnChange(
                                                                                                        key,
                                                                                                        true,
                                                                                                    );
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                        <label
                                                                                            className="custom-control-label"
                                                                                            htmlFor={`dynamic-${key}`}
                                                                                            aria-label={`${item.english} ${pageTypeConfig.columnName}`}
                                                                                        ></label>
                                                                                    </div>
                                                                                )}
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'select' &&
                                                                                (isMapPage ? (
                                                                                    <LayoutCell
                                                                                        value={String(
                                                                                            item.additionalColumn || '',
                                                                                        )}
                                                                                        selected={item.plot}
                                                                                        maxOrder={layoutMaxOrder}
                                                                                        isCategory={isCategoryColumn({
                                                                                            datatype: item.dataType,
                                                                                            column_type:
                                                                                                item.columnType,
                                                                                            is_int_category:
                                                                                                item.isIntCategory,
                                                                                            is_judge: item.isJudge,
                                                                                        })}
                                                                                        datatype={item.dataType}
                                                                                        validate={validateLayoutValue(
                                                                                            item,
                                                                                        )}
                                                                                        onSelect={(value) =>
                                                                                            handleLayoutSelect(
                                                                                                item,
                                                                                                value,
                                                                                            )
                                                                                        }
                                                                                        onOverride={(
                                                                                            value,
                                                                                            conflictItemIds,
                                                                                        ) =>
                                                                                            handleLayoutOverride(
                                                                                                item,
                                                                                                value,
                                                                                                conflictItemIds,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <select
                                                                                        className="form-control small-select"
                                                                                        value={String(
                                                                                            item.additionalColumn || '',
                                                                                        )}
                                                                                        onChange={(event) => {
                                                                                            handleItemSelectControlChange(
                                                                                                key,
                                                                                                event.target.value,
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        <option value="">---</option>
                                                                                        {colorVariablesOptions.map(
                                                                                            (opt) => (
                                                                                                <option
                                                                                                    key={opt.value}
                                                                                                    value={opt.value}
                                                                                                >
                                                                                                    {opt.label}
                                                                                                </option>
                                                                                            ),
                                                                                        )}
                                                                                    </select>
                                                                                ))}
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'select2' && (
                                                                                    <SearchSelect
                                                                                        value={
                                                                                            item.additionalColumn
                                                                                                ? Number(
                                                                                                      item.additionalColumn,
                                                                                                  )
                                                                                                : null
                                                                                        }
                                                                                        options={
                                                                                            agpColorTwoColumnOptionsByProcess[
                                                                                                group.id
                                                                                            ] ?? []
                                                                                        }
                                                                                        onChange={(value) => {
                                                                                            handleItemSelectControlChange(
                                                                                                key,
                                                                                                value
                                                                                                    ? String(value)
                                                                                                    : '',
                                                                                            );
                                                                                        }}
                                                                                        placeholder="---"
                                                                                        selectedDisplayMode="col2"
                                                                                        className="small-search-select"
                                                                                    />
                                                                                )}
                                                                        </td>
                                                                    )}
                                                                    <td className="plot-cell">
                                                                        {item.canShowFilter && (
                                                                            <select
                                                                                className="form-control small-select"
                                                                                value={item.facetState}
                                                                                onChange={(event) => {
                                                                                    handleItemFacetChange(
                                                                                        key,
                                                                                        event.target
                                                                                            .value as VariableItem['facetState'],
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <option value="">---</option>
                                                                                <option value="1">LV1</option>
                                                                                <option value="2">LV2</option>
                                                                                <option value="0">DIV</option>
                                                                            </select>
                                                                        )}
                                                                    </td>
                                                                    <td className="plot-cell">
                                                                        {item.canShowFilter && (
                                                                            <div className="custom-control custom-checkbox mb-0">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="custom-control-input"
                                                                                    id={filterCheckboxId}
                                                                                    checked={item.filterState === '1'}
                                                                                    onChange={(event) => {
                                                                                        handleItemFilterChange(
                                                                                            key,
                                                                                            event.target.checked,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="custom-control-label"
                                                                                    htmlFor={filterCheckboxId}
                                                                                    aria-label={`${item.english} filter`}
                                                                                ></label>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td>{item.unit}</td>
                                                                    {item.samples
                                                                        .slice(0, SAMPLE_HEADERS.length)
                                                                        .map((sample, index) => (
                                                                            <td key={`${key}-${index}`}>{sample}</td>
                                                                        ))}
                                                                </tr>
                                                            );
                                                        })}

                                                    {!group.collapsed && group.functionItems.length > 0 && (
                                                        <tr className="function-head">
                                                            <td colSpan={5}>
                                                                <div className="process-row-inner">
                                                                    <span
                                                                        className="chevron"
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        onClick={() => handleFunctionCollapse(group.id)}
                                                                        onKeyDown={(event) => {
                                                                            if (
                                                                                event.key === 'Enter' ||
                                                                                event.key === ' '
                                                                            ) {
                                                                                event.preventDefault();
                                                                                handleFunctionCollapse(group.id);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {group.functionCollapsed ? '▸' : '▾'}
                                                                    </span>
                                                                    <span>{t('Function')}</span>
                                                                    <span className="process-summary">
                                                                        {`${group.filteredFunctionItems.length} / ${group.functionItems.length}`}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="plot-cell">
                                                                <div className="custom-control custom-checkbox mb-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="custom-control-input"
                                                                        id={`function-check-${group.id}`}
                                                                        checked={
                                                                            group.functionItems.length > 0 &&
                                                                            group.functionItems.every(
                                                                                (item) => item.plot,
                                                                            )
                                                                        }
                                                                        ref={(input) => {
                                                                            if (input) {
                                                                                const selected =
                                                                                    group.functionItems.filter(
                                                                                        (item) => item.plot,
                                                                                    ).length;
                                                                                input.indeterminate =
                                                                                    selected > 0 &&
                                                                                    selected <
                                                                                        group.functionItems.length;
                                                                            }
                                                                        }}
                                                                        onChange={(event) => {
                                                                            const checked = event.target.checked;
                                                                            setPlotByPredicate(
                                                                                (item) =>
                                                                                    item.processId === group.id &&
                                                                                    item.kind === 'function',
                                                                                checked,
                                                                            );
                                                                        }}
                                                                    />
                                                                    <label
                                                                        className="custom-control-label"
                                                                        htmlFor={`function-check-${group.id}`}
                                                                        aria-label={`function-${group.name}`}
                                                                    ></label>
                                                                </div>
                                                            </td>
                                                            <td colSpan={pageTypeConfig.columnName ? 9 : 8}></td>
                                                        </tr>
                                                    )}

                                                    {!group.collapsed &&
                                                        !group.functionCollapsed &&
                                                        group.filteredFunctionItems.map((item) => {
                                                            const key = itemKey(item);
                                                            const plotCheckboxId = `plot-check-${item.processId}-${item.idx}`;
                                                            const filterCheckboxId = `filter-check-${item.processId}-${item.idx}`;
                                                            const colorVariablesOptions =
                                                                pageType === 'agp'
                                                                    ? (agpColorOptionsByProcess[group.id] ??
                                                                      getAgpColorOptions(group))
                                                                    : (pageTypeConfig?.options ?? []);
                                                            const canShowPageTypeColumnControl = canShowPageTypeControl(
                                                                pageType,
                                                                {
                                                                    datatype: item.dataType,
                                                                    column_type: item.columnType,
                                                                    is_serial_no: item.isSerialNo,
                                                                    is_int_category: item.isIntCategory,
                                                                    is_judge: item.isJudge,
                                                                },
                                                            );
                                                            const active = activeItem
                                                                ? itemKey(activeItem) === key
                                                                : false;
                                                            return (
                                                                <tr
                                                                    key={key}
                                                                    className={active ? 'active-row' : ''}
                                                                    onMouseEnter={() => setActiveRowKey(key)}
                                                                >
                                                                    <td></td>
                                                                    <td>{item.idx}</td>
                                                                    <td>{item.name}</td>
                                                                    <td>{item.dataTypeShort}</td>
                                                                    <td className="english-name-cell">
                                                                        {item.english}
                                                                    </td>
                                                                    <td className="plot-cell">
                                                                        {item.canSelectPlot && (
                                                                            <div className="custom-control custom-checkbox mb-0">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="custom-control-input"
                                                                                    id={plotCheckboxId}
                                                                                    checked={item.plot}
                                                                                    onChange={(event) => {
                                                                                        handleItemPlotChange(
                                                                                            key,
                                                                                            event.target.checked,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="custom-control-label"
                                                                                    htmlFor={plotCheckboxId}
                                                                                    aria-label={`${item.english} plot`}
                                                                                ></label>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    {pageTypeConfig.columnName && (
                                                                        <td className="plot-cell">
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'checkbox' && (
                                                                                    <div className="custom-control custom-checkbox mb-0">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            className="custom-control-input"
                                                                                            id={`dynamic-${key}`}
                                                                                            checked={Boolean(
                                                                                                item.dynamicState,
                                                                                            )}
                                                                                            onChange={(event) => {
                                                                                                handleItemAdditionalColumnChange(
                                                                                                    key,
                                                                                                    event.target
                                                                                                        .checked,
                                                                                                );
                                                                                            }}
                                                                                        />
                                                                                        <label
                                                                                            className="custom-control-label"
                                                                                            htmlFor={`dynamic-${key}`}
                                                                                            aria-label={`${item.english} ${pageTypeConfig.columnName}`}
                                                                                        ></label>
                                                                                    </div>
                                                                                )}
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'radio' && (
                                                                                    <div className="custom-control custom-radio mb-0">
                                                                                        <input
                                                                                            type="radio"
                                                                                            className="custom-control-input"
                                                                                            id={`dynamic-${key}`}
                                                                                            name="variable-select-dynamic"
                                                                                            checked={Boolean(
                                                                                                item.dynamicState,
                                                                                            )}
                                                                                            onChange={(event) => {
                                                                                                if (
                                                                                                    event.target.checked
                                                                                                ) {
                                                                                                    handleItemAdditionalColumnChange(
                                                                                                        key,
                                                                                                        true,
                                                                                                    );
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                        <label
                                                                                            className="custom-control-label"
                                                                                            htmlFor={`dynamic-${key}`}
                                                                                            aria-label={`${item.english} ${pageTypeConfig.columnName}`}
                                                                                        ></label>
                                                                                    </div>
                                                                                )}
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'select' &&
                                                                                (isMapPage ? (
                                                                                    <LayoutCell
                                                                                        value={String(
                                                                                            item.additionalColumn || '',
                                                                                        )}
                                                                                        selected={item.plot}
                                                                                        maxOrder={layoutMaxOrder}
                                                                                        isCategory={isCategoryColumn({
                                                                                            datatype: item.dataType,
                                                                                            column_type:
                                                                                                item.columnType,
                                                                                            is_int_category:
                                                                                                item.isIntCategory,
                                                                                            is_judge: item.isJudge,
                                                                                        })}
                                                                                        datatype={item.dataType}
                                                                                        validate={validateLayoutValue(
                                                                                            item,
                                                                                        )}
                                                                                        onSelect={(value) =>
                                                                                            handleLayoutSelect(
                                                                                                item,
                                                                                                value,
                                                                                            )
                                                                                        }
                                                                                        onOverride={(
                                                                                            value,
                                                                                            conflictItemIds,
                                                                                        ) =>
                                                                                            handleLayoutOverride(
                                                                                                item,
                                                                                                value,
                                                                                                conflictItemIds,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <select
                                                                                        className="form-control small-select"
                                                                                        value={String(
                                                                                            item.additionalColumn || '',
                                                                                        )}
                                                                                        onChange={(event) => {
                                                                                            handleItemSelectControlChange(
                                                                                                key,
                                                                                                event.target.value,
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        <option value="">---</option>
                                                                                        {colorVariablesOptions.map(
                                                                                            (opt) => (
                                                                                                <option
                                                                                                    key={opt.value}
                                                                                                    value={opt.value}
                                                                                                >
                                                                                                    {opt.label}
                                                                                                </option>
                                                                                            ),
                                                                                        )}
                                                                                    </select>
                                                                                ))}
                                                                            {canShowPageTypeColumnControl &&
                                                                                pageTypeConfig.controlType ===
                                                                                    'select2' && (
                                                                                    <SearchSelect
                                                                                        value={
                                                                                            item.additionalColumn
                                                                                                ? Number(
                                                                                                      item.additionalColumn,
                                                                                                  )
                                                                                                : null
                                                                                        }
                                                                                        options={
                                                                                            agpColorTwoColumnOptionsByProcess[
                                                                                                group.id
                                                                                            ] ?? []
                                                                                        }
                                                                                        onChange={(value) => {
                                                                                            handleItemSelectControlChange(
                                                                                                key,
                                                                                                value
                                                                                                    ? String(value)
                                                                                                    : '',
                                                                                            );
                                                                                        }}
                                                                                        placeholder="---"
                                                                                        selectedDisplayMode="col2"
                                                                                        className="small-search-select"
                                                                                    />
                                                                                )}
                                                                        </td>
                                                                    )}
                                                                    <td className="plot-cell">
                                                                        {item.canShowFilter && (
                                                                            <select
                                                                                className="form-control small-select"
                                                                                value={item.facetState}
                                                                                onChange={(event) => {
                                                                                    handleItemFacetChange(
                                                                                        key,
                                                                                        event.target
                                                                                            .value as VariableItem['facetState'],
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <option value="">---</option>
                                                                                <option value="1">LV1</option>
                                                                                <option value="2">LV2</option>
                                                                                <option value="0">DIV</option>
                                                                            </select>
                                                                        )}
                                                                    </td>
                                                                    <td className="plot-cell">
                                                                        {item.canShowFilter && (
                                                                            <div className="custom-control custom-checkbox mb-0">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="custom-control-input"
                                                                                    id={filterCheckboxId}
                                                                                    checked={item.filterState === '1'}
                                                                                    onChange={(event) => {
                                                                                        handleItemFilterChange(
                                                                                            key,
                                                                                            event.target.checked,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="custom-control-label"
                                                                                    htmlFor={filterCheckboxId}
                                                                                    aria-label={`${item.english} filter`}
                                                                                ></label>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td>{item.unit}</td>
                                                                    {item.samples
                                                                        .slice(0, SAMPLE_HEADERS.length)
                                                                        .map((sample, index) => (
                                                                            <td key={`${key}-${index}`}>{sample}</td>
                                                                        ))}
                                                                </tr>
                                                            );
                                                        })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {!isExpanded ? (
                            <ProcessDetail
                                key={activeProcess?.id ?? 'empty'}
                                processId={activeProcess?.id}
                                selectedCount={activeProcess?.summary.selected ?? 0}
                            />
                        ) : (
                            <aside className="variable-select-detail">
                                <div className="detail-head">
                                    {t('Variable Detail')}{' '}
                                    <span className="detail-type">
                                        {activeItem?.kind === 'function' ? `- ${t('Function')}` : `- ${t('Variable')}`}
                                    </span>
                                </div>
                                <div className="detail-body">
                                    {activeItem ? (
                                        <>
                                            <div className="detail-block">
                                                <div className="kv">
                                                    <div>Process</div>
                                                    <div>{activeItem.processName}</div>
                                                    <div>Source</div>
                                                    <div>{activeItem.rawColumnName || '-'}</div>
                                                    <div>System</div>
                                                    <div>{activeItem.system || '-'}</div>
                                                    <div>Name</div>
                                                    <div>{activeItem.name}</div>
                                                    <div>Local</div>
                                                    <div>{activeItem.local || '-'}</div>
                                                </div>
                                            </div>

                                            <div className="detail-block">
                                                <div className="kv">
                                                    <div>Unit</div>
                                                    <div>{activeItem.unit || '-'}</div>
                                                    <div>Filter</div>
                                                    <div>{activeItem.filterValue || '-'}</div>
                                                    <div>Formula</div>
                                                    <div>{activeItem.formula || '-'}</div>
                                                    <div>DataType</div>
                                                    <div>{activeItem.dataTypeShort}</div>
                                                </div>
                                                <div className="secondary">
                                                    {activeItem.raw
                                                        ? t(getDataTypeI18nKey(activeItem.raw, activeItem.columnType))
                                                        : '-'}
                                                </div>
                                            </div>

                                            <div className="detail-block">
                                                <div className="kv">
                                                    <div>Function</div>
                                                    <div>{activeItem.functionText || '-'}</div>
                                                    <div>X/me</div>
                                                    <div>{activeItem.xme || '-'}</div>
                                                    <div>Y</div>
                                                    <div>{activeItem.y || '-'}</div>
                                                    <div>Coeff</div>
                                                    <div>{activeItem.coeff || '-'}</div>
                                                    <div>Note</div>
                                                    <div>{activeItem.note || '-'}</div>
                                                </div>
                                            </div>

                                            <div className="assignment">
                                                <div className="assignment-title">Assignment</div>
                                                <div className="kv">
                                                    <div>Plot</div>
                                                    <div>{activeItem.plot ? 'Yes' : 'No'}</div>
                                                    <div>Facet</div>
                                                    <div>{facetText(activeItem.facetState)}</div>
                                                    <div>Filter</div>
                                                    <div>{activeItem.filterState === '1' ? 'Yes' : 'No'}</div>
                                                </div>
                                            </div>

                                            <div className="detail-block sample-block">
                                                <div className="sample-title">{t('Sample Data')}</div>
                                                <table className="sample-mini">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '32px' }} title={t('No.')}>
                                                                {t('No.')}
                                                            </th>
                                                            <th title={t('Record')}>{t('Record')}</th>
                                                            <th title={t('Unique')}>{t('Unique')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {activeItem.samples.map((sample, index) => (
                                                            <tr key={`sample-mini-${index}`}>
                                                                <td>{index + 1}</td>
                                                                <td title={sample}>{sample}</td>
                                                                <td title={detailUniqueSamples[index] || '-'}>
                                                                    {detailUniqueSamples[index] || '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    ) : (
                                        <span>{t('No data')}</span>
                                    )}
                                </div>
                            </aside>
                        )}
                    </div>
                    {(isLoadingColumns || isApplyingSelection) && (
                        <div className="variable-select-loading-overlay" role="status" aria-live="polite">
                            <div className="variable-select-loading-content">
                                <span className="variable-select-loading-spinner" aria-hidden="true"></span>
                                <span>{t('Loading...')}</span>
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
}
