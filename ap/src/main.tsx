import React, { Suspense, lazy } from 'react';
import { type Root, createRoot } from 'react-dom/client';

import { i18nReady } from './shared/i18n';
import './styles/main.scss';

const REACT_ROOT = '.react-root';
const DATA_COMPONENT = 'data-component';
const DATA_PROPS = 'data-props';
const components = {
    SideBarComponent: lazy(() => import('@/shared/components/layout/SideBar.tsx')),
    ExportSettingTableComponent: lazy(() => import('@/pages/export-config/components/ExportSettingTable.tsx')),
    ExportConfig: lazy(() => import('@/pages/export-config/components/ExportConfig.tsx')),
    PCPPlotStyleSetting: lazy(() => import('@/pages/parallel_plot/components/PCPPlotStyleSetting')),
    MultiAxisPlot: lazy(() => import('@/pages/multi-axis-plot/components/MultiAxisPlot.tsx')),
    LayoutDropDown: lazy(() => import('@/pages/multi-axis-plot/components/LayoutPanel')),
};

const mountedComponents = new WeakMap<Element, Root>();

function isMountedContainer(container: Element) {
    return mountedComponents.has(container);
}

function getReactRootContainers(root: ParentNode): Element[] {
    const containers: Element[] = [];
    if (root instanceof Element && root.matches(REACT_ROOT)) {
        containers.push(root);
    }
    root.querySelectorAll?.(REACT_ROOT).forEach((container) => containers.push(container));
    return containers;
}

function parseDataProps<T extends object = Record<string, unknown>>(container: Element): T {
    const dataProps = container.getAttribute(DATA_PROPS);
    if (!dataProps) {
        return {} as T;
    }

    return JSON.parse(dataProps) as T;
}

function mountComponents(root: ParentNode = document) {
    getReactRootContainers(root).forEach((container) => {
        if (mountedComponents.has(container)) return;
        const componentName = container.getAttribute(DATA_COMPONENT);
        const LazyComponent = components[componentName as keyof typeof components];
        if (!LazyComponent) {
            return;
        }

        const props = parseDataProps(container);
        const reactRoot = createRoot(container);
        mountedComponents.set(container, reactRoot);
        reactRoot.render(
            <Suspense>
                <LazyComponent {...props} />
            </Suspense>,
        );
    });
}

function forgetRemovedRoot(container: Element) {
    if (container.isConnected) return;

    mountedComponents.delete(container);
}

function scheduleForgetRemovedRoots(root: ParentNode) {
    const containers = getReactRootContainers(root).filter(isMountedContainer);
    if (!containers.length) return;

    window.setTimeout(() => {
        containers.forEach(forgetRemovedRoot);
    }, 0);
}

i18nReady
    .catch((error) => {
        console.error('Failed to initialize i18n. ', error);
    })
    .finally(() => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                mountComponents();
            });
            return;
        }

        mountComponents();
    });

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            mountComponents(node);
        }

        for (const node of mutation.removedNodes) {
            if (!(node instanceof Element)) continue;
            scheduleForgetRemovedRoots(node);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
});
