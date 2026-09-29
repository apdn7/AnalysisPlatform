import Plotly from 'plotly.js/dist/plotly';

import { type GraphSetting, type PlotFigureOptions, buildPlotFigure } from './plotBuilder';
import type { PlotSeries, SubplotCount } from './types';

const EXPORT_WIDTH = 1920;
const EXPORT_HEIGHT = 1080;

export type ExportImageSize = {
    width: number;
    height: number;
};

export type ExportOptions = {
    figureOptions?: PlotFigureOptions;
};

const normalizeExportSize = (size: ExportImageSize): ExportImageSize => ({
    width: Math.max(Math.round(size.width), 1),
    height: Math.max(Math.round(size.height), 1),
});

const buildExportFigure = (
    plotData: PlotSeries[],
    graphSettings: GraphSetting,
    size: ExportImageSize,
    options: ExportOptions = {},
) =>
    buildPlotFigure(plotData, graphSettings, {
        ...options.figureOptions,
        height: options.figureOptions?.height ?? size.height,
    });

export const getPlotPngBlob = async (
    plotData: PlotSeries[],
    graphSettings: GraphSetting,
    size: ExportImageSize = { width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
    options: ExportOptions = {},
): Promise<Blob> => {
    const exportSize = normalizeExportSize(size);
    const imageUrl = await Plotly.toImage(buildExportFigure(plotData, graphSettings, exportSize, options), {
        format: 'png',
        width: exportSize.width,
        height: exportSize.height,
    });
    const response = await fetch(imageUrl);

    return response.blob();
};

export const savePlotAsPng = async (
    plotData: PlotSeries[],
    graphSettings: GraphSetting,
    filename: string,
    size: ExportImageSize = { width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
    options: ExportOptions = {},
): Promise<void> => {
    const exportSize = normalizeExportSize(size);
    await Plotly.downloadImage(buildExportFigure(plotData, graphSettings, exportSize, options), {
        format: 'png',
        filename,
        width: exportSize.width,
        height: exportSize.height,
    });
};

export const copyPlotToClipboard = async (
    plotData: PlotSeries[],
    graphSettings: GraphSetting,
    size: ExportImageSize = { width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
    options: ExportOptions = {},
): Promise<void> => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Copying images to the clipboard is not supported by this browser.');
    }

    const pngBlob = getPlotPngBlob(plotData, graphSettings, size, options);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
};
