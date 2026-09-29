import type { Datum } from 'plotly.js';

export type SubplotCount = 1 | 2 | 3 | 4 | 5 | 6;

export type PlotSeries = {
    key: string;
    array_x: Datum[];
    array_y: number[];
    original_array_x: Datum[];
    text: string[] | null;
    name: string;
    end_col_id: number; // column id
    plot_no: number;
    is_xaxis: boolean;
    x_axis_title?: string;
    x_process_name?: string;
    class: PlotPriority;
    color: string;
    is_log_scale_available?: boolean;
    marker_size?: number;
    line_width?: number;
    color_group?: string | number | null;
    is_numeric_dtype?: boolean;
    is_xaxis_category?: boolean;
    x_axis_datatype?: string;
    x_axis_numeric?: boolean;
    is_sort_by_data_order?: string;
    category_boundaries?: CategoryBoundary[];
    x_axis_tickvals?: Datum[];
    x_axis_ticktext?: string[];
    chart_infos?: ChartInfo[];
    chart_infos_org?: ChartInfo[];
    chart_infos_ci?: ChartInfo[];
    chart_infos_org_ci?: any[];
    y_axis_title?: string;
    facet_label?: string | null;
    y_process_name?: string;
    times: string[];
    yColor: string;
    is_datetime_label?: boolean;
    is_color_imb_group?: boolean;
    is_x_axis_binned?: boolean;
    is_y_axis_binned?: boolean;
    x_bin_labels?: string[] | null;
    x_bin_mins?: Datum[] | null;
    x_bin_maxs?: Datum[] | null;
    category_hover_values?: string[] | null;
    encoded_x_values?: boolean;
    y_fmt?: string;
    y_axis_category?: boolean;
    show_x_axis_with_index?: boolean;
};

export type CategoryBoundary = {
    level: number;
    indexes: number[];
    labels: string[];
};

export type PlotSeriesCollection = PlotSeries[] | PlotSeries[][];

export enum PlotPriority {
    MAIN = 'main',
    SUB = 'sub',
    ADD = 'add',
    PRIMARY = 'primary',
    STEP = 'step',
}

export type ChartInfo = {
    'act-from': string | number;
    'act-to': string | number;
    'is-out-of-range'?: boolean;
    'eng_name'?: string;
    'name'?: string;
    'prc-max'?: number;
    'prc-min'?: number;
    'thresh-high'?: number;
    'thresh-low'?: number;
    'type'?: any;
    'value'?: any;
    'y-max'?: number;
    'y-min'?: number;
};
