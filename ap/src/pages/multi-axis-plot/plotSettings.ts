import type { Config } from 'plotly.js';

export const COLOR_SCALES = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
];

export const NUMERIC_COLOR_SCALE: Array<[number, string]> = [
    [0, '#0000ff'],
    [0.1666, '#009fff'],
    [0.3333, '#00ffff'],
    [0.5, '#00ff00'],
    [0.6666, '#ffff00'],
    [0.8333, '#ff7f00'],
    [1, '#ff0000'],
];

export const plotConfig: Partial<Config> = {
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    modeBarButtons: [['resetScale2d']],
};
