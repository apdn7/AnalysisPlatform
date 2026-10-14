import React, { Suspense, lazy } from 'react';
import { type Root, createRoot } from 'react-dom/client';

import { i18nReady } from './shared/i18n';
import { isActiveReactContainer } from './shared/virtualListLifecycle';
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
    HMPPlotStyleSetting: lazy(() => import('@/pages/heatmap/components/HMPPlotStyleSetting')),
    WfpPlotStyleSetting: lazy(() => import('@/pages/waveform_plot/components/WfPPlotStyleSetting')),
    SCPPlotStyleSetting: lazy(() => import('@/pages/scatter_plot/components/SCPPlotStyleSetting')),
    RidgelinePlotStyleSetting: lazy(() => import('@/pages/ridgeline_plot/components/RidgelinePlotStyleSetting')),
    CategoricalPlotStyleSetting: lazy(
        () => import('@/pages/categorical_plot/components/CategoricalPlotStyleSetting.tsx'),
    ),
    CalendarHeatmapPlotStyleSetting: lazy(
        () => import('@/pages/calendar_heatmap_plot/components/CalendarHeatmapPlotStyleSetting.tsx'),
    ),
    AggregatePlotStyleSetting: lazy(() => import('@/pages/aggregate_plot/components/AggregatePlotStyleSetting.tsx')),
    MultiScatterPlotStyleSetting: lazy(
        () => import('@/pages/multiple_scatter_plot/components/MultiScatterPlotStyleSetting.tsx'),
    ),
    SankeyPlotStyleSetting: lazy(() => import('@/pages/sankey_plot/components/SankeyPlotStyleSetting.tsx')),
    FppPlotStyleSetting: lazy(() => import('@/pages/full_points_plot/components/FppPlotStyleSetting.tsx')),
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

function unmountComponent(container: Element) {
    const reactRoot = mountedComponents.get(container);
    if (!reactRoot) return;
    mountedComponents.delete(container);
    reactRoot.unmount();
}

function unmountComponents(root: ParentNode) {
    getReactRootContainers(root).forEach(unmountComponent);
}

function scheduleUnmountRemovedRoots(root: Element) {
    const containers = getReactRootContainers(root).filter(isMountedContainer);
    const virtualLists = Array.from(root.querySelectorAll<HTMLElement>('[data-virtualized="true"]'));
    if (root instanceof HTMLElement && root.matches('[data-virtualized="true"]')) {
        virtualLists.push(root);
    }
    if (!containers.length && !virtualLists.length) return;

    window.setTimeout(() => {
        virtualLists.forEach((list) => {
            if (!list.isConnected) list._virtualList?.destroy();
        });
        containers.forEach((container) => {
            // Virtual rows are temporarily detached, but still belong to the live list.
            if (!isActiveReactContainer(container)) unmountComponent(container);
        });
    }, 0);
}

window.unmountReactComponents = unmountComponents;
window.mountLayoutDropdowns = mountComponents;

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
            scheduleUnmountRemovedRoots(node);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
});
