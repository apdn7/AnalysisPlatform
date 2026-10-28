import { useEffect, useRef, useState } from 'react';

export type PlotStyleUpdate = () => void | Promise<unknown>;

const waitForFrame = (signal: AbortSignal) =>
    new Promise<void>((resolve) => {
        if (signal.aborted) {
            resolve();
            return;
        }
        const finish = () => {
            cancelAnimationFrame(frame);
            signal.removeEventListener('abort', finish);
            resolve();
        };
        const frame = requestAnimationFrame(finish);
        signal.addEventListener('abort', finish, { once: true });
    });

export const usePlotStyleUpdate = () => {
    const [isUpdating, setIsUpdating] = useState(false);
    const mountedRef = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);
    const loadingRef = useRef<ReturnType<typeof loadingHandler> | null>(null);
    const runRef = useRef<Promise<void> | null>(null);

    const cancelStyleUpdate = () => {
        controllerRef.current?.abort();
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            cancelStyleUpdate();
            loadingRef.current?.hide();
            loadingRef.current = null;
        };
    }, []);

    const runStyleUpdate = async (createUpdates: () => PlotStyleUpdate[], afterUpdate?: () => void) => {
        if (!mountedRef.current) return;
        cancelStyleUpdate();
        const controller = new AbortController();
        controllerRef.current = controller;
        loadingRef.current ??= loadingHandler();
        loadingRef.current.show();
        setIsUpdating(true);
        const previousRun = runRef.current;
        let finishRun: () => void;
        const currentRun = new Promise<void>((resolve) => {
            finishRun = resolve;
        });
        runRef.current = currentRun;

        try {
            // Plotly updates already in flight cannot be cancelled; wait before replacing their style.
            await previousRun;
            if (controller.signal.aborted) return;
            // Two frames let the loading overlay paint before chart work starts.
            await waitForFrame(controller.signal);
            await waitForFrame(controller.signal);
            if (controller.signal.aborted) return;

            const updates = createUpdates();
            for (let index = 0; index < updates.length; index++) {
                if (controller.signal.aborted) return;
                await updates[index]();
                if (index < updates.length - 1) await waitForFrame(controller.signal);
            }
            if (!controller.signal.aborted) afterUpdate?.();
        } catch (error) {
            console.error('Failed to update plot style', error);
        } finally {
            finishRun();
            if (runRef.current === currentRun) runRef.current = null;
            // An older request must not hide loading or unlock a newer selection.
            if (controllerRef.current === controller) {
                controllerRef.current = null;
                loadingRef.current?.hide();
                loadingRef.current = null;
                if (mountedRef.current) setIsUpdating(false);
            }
        }
    };

    return { isUpdating, runStyleUpdate, cancelStyleUpdate };
};
