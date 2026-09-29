type EventName =
    | 'EXPORT_CONFIG_UPDATING'
    | 'EXPORT_CONFIG_RELOADING'
    | 'EXPORT_CONFIG_ROW_CLICKED'
    | 'EXPORT_CONFIG_RESETTING'
    | 'DELETE_EXPORT_CONFIG'
    | 'EXPORT_CONFIG_ROW_UNSELECTED';

export const eventBus = {
    emit(event: EventName, data?: any) {
        const customEvent = new CustomEvent(event, { detail: data });
        window.dispatchEvent(customEvent);
    },

    on(event: EventName, callback: (data: any) => void) {
        const handler = (e: Event) => callback((e as CustomEvent).detail);
        window.addEventListener(event, handler);
        return () => window.removeEventListener(event, handler);
    },
};
