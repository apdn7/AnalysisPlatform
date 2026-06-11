import { createRoot } from 'react-dom/client';
import React, { lazy, Suspense } from 'react';
import './shared/i18n';
const REACT_ROOT = '.react-root';
const DATA_COMPONENT = 'data-component';
const DATA_PROPS = 'data-props';
const components = {
    SideBarComponent: lazy(() => import('./shared/components/layout/side_bar')),
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
