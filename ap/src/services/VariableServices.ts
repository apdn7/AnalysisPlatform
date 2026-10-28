import { apiClient } from '@/shared/api/apiClient.ts';

export interface ProcessColumnItem {
    column_id: number;
    selected: boolean;
    process_id: number;
    process_name: string;
    /** Legacy key: a fixed index across selected processes in the variable view. */
    column_order_in_process: number;
    /** idx zero-padded by the complete index scope (e.g. "03", "007"). */
    column_order_label?: string;
    english_name: string | null;
    datatype: string;
    column_type: number | null;
    is_serial_no: boolean;
    is_int_category: boolean;
    is_judge: boolean;
    shownname: string | null;
    name_local?: string | null;
    unit: string | null;
    filter?: string | null;
    formula?: string | null;
    sample_data: Array<string | number | boolean>;
    unique_values: Array<string | number | boolean>;
    /** Samples could not be read (transaction file busy with an import); they must not be cached. */
    sample_unavailable?: boolean;
    raw_column_name?: string | null;
    function_details: Array<{
        function_id: number;
        function_name?: string | null;
        var_x: number;
        var_x_name?: string | null;
        var_y: number | null;
        var_y_name?: string | null;
        return_type: string;
        a: string | null;
        b: string | null;
        c: string | null;
        n: string | null;
        k: string | null;
        s: string | null;
        t: string | null;
        note: string | null;
        order: number;
    }>;
}

export interface ProcessColumnsPagination {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}

export interface ProcessColumnSummary {
    selected: number;
    total: number;
}

export interface LayoutCandidateItem {
    column_id: number;
    process_id: number;
    /** True for CT (datetime) rows, which MAP bulk selection leaves untouched. */
    is_get_date: boolean;
    /** False when the column cannot be selected in bulk, e.g. a key column while Key除く is on. */
    selectable: boolean;
}

export interface ProcessColumnsResponse {
    status: number;
    items: ProcessColumnItem[];
    processes: Array<{ id: number; name: string }>;
    pagination: ProcessColumnsPagination;
    selected_column_ids: number[];
    selected_process_ids: number[];
    /** Column ids inside 表示する項目 (From/Size/Step); null when no display range is set. */
    range_column_ids: number[] | null;
    all_selected: boolean;
    /** Ordered matching columns across every page; null unless include_layout_candidates was set. */
    layout_candidates: LayoutCandidateItem[] | null;
    process_summaries: Record<string, ProcessColumnSummary>;
}

export interface ProcessConfigColumnItem {
    id: number;
    data_type: string;
    shown_name: string | null;
    name_en: string | null;
}

export interface ProcessConfigColumnsResponse {
    status: number;
    data: ProcessConfigColumnItem[];
}

export interface ProcessDetailData {
    id: number;
    name: string;
    source: { id: number; name: string; type: string } | null;
    path: string | null;
    ref: string | null;
    option: Record<string, string | number | boolean | null>;
    from: string | null;
    latest: string | null;
    data_count: number | null;
    last_import_at: string | null;
    linked_processes: Array<{ id: number; name: string }>;
}

export interface ProcessDetailColumn {
    id: number;
    name_en: string | null;
    shown_name: string | null;
    data_type: string | null;
    column_type: number | null;
    is_serial_no: boolean;
    is_int_category: boolean;
    is_judge: boolean;
}

export interface ProcessDetailColumnsResponse {
    status: number;
    items: ProcessDetailColumn[];
}

export interface ProcessColumnsQueryParams {
    page: number;
    limit: number;
    pagination_mode?: 'columns' | 'processes';
    /** In column mode, defines the fixed global idx scope before filtering or pagination. */
    process_ids?: number[];
    /** Process-mode anchors: retain these processes and the union of their linked processes. */
    linked_process_ids?: number[];
    process_name?: string;
    idx?: string;
    english_name?: string;
    datatype?: string;
    shownname?: string;
    unit?: string;
    sample_1?: string;
    sample_2?: string;
    sample_3?: string;
    sample_4?: string;
    sample_5?: string;
    search_regex?: string;
    show_mode?: 'all' | 'selected' | 'unselected';
    exclude_key?: boolean;
    deselect_keys?: boolean;
    selected_column_ids?: number[];
    /** Checkbox IDs for process-mode Show selected/unselected; ignored in column mode. */
    selected_process_ids?: number[];
    prioritized_column_ids?: number[];
    select_all?: boolean;
    idx_start?: number;
    idx_size?: number;
    idx_interval?: number;
    same_filter?: boolean;
    na_filter?: boolean;
    plot_state?: string;
    facet_state?: string;
    filter_state?: string;
    additional_column?: string;
    /** Variable Select page type; decides which rows show the page-specific control (e.g. fpp Label). */
    page_type?: string;
    column_states?: Record<string, { facetState: string; filterState: string; additionalColumn: string | boolean }>;
    /** Columns whose samples the client already holds; the server returns empty samples for them. */
    cached_sample_column_ids?: number[];
    /** Ask for the ordered ids of every matching column (all pages), used by MAP bulk selection. */
    include_layout_candidates?: boolean;
    /** UTC datetime range(s) selected in the outer picker; limits which transaction rows samples come from. */
    datetime_ranges?: Array<{ start: string; end: string }>;
}

export const variableServices = {
    getProcessDetail: async (
        processId: string,
        signal?: AbortSignal,
    ): Promise<{ status: number; data: ProcessDetailData }> =>
        apiClient.get(`/setting/process_detail/${processId}`, { signal }),
    getProcessDetailColumns: async (processId: string, signal?: AbortSignal): Promise<ProcessDetailColumnsResponse> =>
        apiClient.get(`/setting/process_detail/${processId}/columns`, { signal }),
    getProcessColumns: async (
        params: ProcessColumnsQueryParams,
        signal?: AbortSignal,
    ): Promise<ProcessColumnsResponse> => apiClient.post('/setting/process_columns', params, { signal }),
    getProcessConfigColumns: async (processId: string): Promise<ProcessConfigColumnsResponse> =>
        apiClient.get(`/setting/proc_config/${processId}/columns`),
};
