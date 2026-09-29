import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

import type { GraphSetting } from '../plotBuilder';
import { type ExportImageSize, savePlotAsPng } from '../plotExport';
import type { PlotSeries } from '../types';

type Props = {
    graphSettings: GraphSetting;
    visiblePlotDataGroups: PlotSeries[][];
};

const getContextTargetExportSizes = (): ExportImageSize[] =>
    Array.from(document.querySelectorAll<HTMLElement>('.multi-axis-plot__context-target')).map((contextTarget) => {
        const bounds = contextTarget.getBoundingClientRect();

        return {
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
        };
    });

export default function SaveAllButton({ graphSettings, visiblePlotDataGroups }: Props) {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveAll = async () => {
        if (isSaving || visiblePlotDataGroups.length === 0) {
            return;
        }

        setIsSaving(true);

        try {
            const exportSizes = getContextTargetExportSizes();

            for (const [index, plotData] of visiblePlotDataGroups.entries()) {
                const exportSize = exportSizes[index];

                if (exportSize) {
                    await savePlotAsPng(plotData, graphSettings, `multi-axis-plot-panel-${index + 1}`, exportSize);
                } else {
                    await savePlotAsPng(plotData, graphSettings, `multi-axis-plot-panel-${index + 1}`);
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Button
            type="button"
            className="btn btn-sm border-white ml-3"
            disabled={isSaving || visiblePlotDataGroups.length === 0}
            onClick={handleSaveAll}
            title={t('MAP save all hover msg')}
        >
            {isSaving ? `${t('Saving')}...` : t('Save all')}
        </Button>
    );
}
