import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export default function DisplayGraphButton({ onClickShowGraph }) {
    const { t } = useTranslation();
    const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
    useEffect(() => {
        const node = document.getElementById('DisplayGraphButtonComponent');
        if (node) {
            setPortalNode(node);
        }
    }, []);

    const handleClickShowGraph = () => {
        if (mapTracing()) {
            onClickShowGraph();
        }
    };
    return (
        <>
            {portalNode
                ? createPortal(
                      <button
                          type="button"
                          value={t('Display graph')}
                          id="showTraceDataMapGraph"
                          onClick={handleClickShowGraph}
                          className="btn btn-primary show-graph ml-3 hotkey-button"
                          title="Shortcut key: Ctrl+Enter"
                          data-hotkey="Ctrl+Enter"
                      >
                          <i className="fas fa-chart-bar"></i> {t('Display graph')}
                      </button>,
                      portalNode,
                  )
                : ''}
        </>
    );
}
