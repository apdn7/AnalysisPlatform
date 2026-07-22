import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import './shared/i18n';
import './styles/main.scss';

const REACT_ROOT = '.react-root';
const DATA_COMPONENT = 'data-component';
const DATA_PROPS = 'data-props';
const components = {
    SideBarComponent: lazy(() => import('@/shared/components/layout/SideBar.tsx')),
    ExportSettingTableComponent: lazy(() => import('@/pages/export-config/components/ExportSettingTable.tsx')),
    ExportConfig: lazy(() => import('@/pages/export-config/components/ExportConfig.tsx')),
};
function mountAllComponents() {
    const containers = document.querySelectorAll(REACT_ROOT);

    containers.forEach((container) => {
        const componentName = container.getAttribute(DATA_COMPONENT);
        const LazyComponent = components[componentName as keyof typeof components];
        if (!LazyComponent) {
            return;
        }

        const dataProps = container.getAttribute(DATA_PROPS);
        let props = {};
        if (dataProps) {
            props = JSON.parse(dataProps);
        }
        const root = createRoot(container);
        root.render(
            <Suspense>
                <LazyComponent {...props} />
            </Suspense>,
        );
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAllComponents);
} else {
    mountAllComponents();
}
