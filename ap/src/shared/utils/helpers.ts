import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const DATETIME_FORMATS = {
    NORMAL: 'YYYY-MM-DD HH:mm:ss',
};

/**
 * @description Sanitizes a string and ensures the string not includes invalid character
 * @param text
 * @return {string} The sanitized and potentially truncated string
 */
export const sanitizeString = (text: string): string => {
    // Remove invalid filesystem characters
    return text.replace(/[\\/:*?"<>|]/g, '').trim();
};

/**
 * Sanitizes a subfolder name and ensures the total path length stays within safety limits.
 * * * Logic:
 * 1. Sanitize the subfolder name (remove illegal chars).
 * * @param {string} parentPath - The existing directory path (e.g., "C:\Users\Project").
 * @param {string} name - The desired subfolder name.
 * @returns {string} - The sanitized and potentially truncated subfolder name.
 */
export const sanitizeFolderName = (name: string): string => {
    if (!name) return 'unnamed_folder';

    const sanitizedName = sanitizeString(name);

    if (!sanitizedName) return 'unnamed_folder';

    return sanitizedName;
};

export function convertUtcToLocal(time: string | Date, format = DATETIME_FORMATS.NORMAL): string {
    if (!time) return '';
    const d = dayjs.utc(time);
    if (!d.isValid()) return '';

    return d.local().format(format);
}

/**
 * Triggers a native change/input event on a DOM element in a way that React can detect.
 * This explicitly bypasses React's internal value tracking by invoking the browser's
 * native setter based on the specific element type.
 *
 * @example
 * // For Text Input or Textarea:
 * triggerNativeChange(inputRef.current, "New Value");
 *
 * @example
 * // For Checkbox/Radio:
 * triggerNativeChange(checkboxRef.current, true);
 *
 * @param {HTMLElement | null} element - The DOM element to trigger the change on.
 * @param {string | boolean} value - The new value (string) or checked state (boolean).
 */
export const triggerNativeChange = (element: HTMLElement | null, value: string | boolean): void => {
    if (!element) return;

    // 1. Determine if the element is checkable and define the target attribute
    const isInput = element instanceof HTMLInputElement;
    const isCheckable =
        isInput &&
        ((element as HTMLInputElement).type === 'checkbox' || (element as HTMLInputElement).type === 'radio');

    const attribute = isCheckable ? 'checked' : 'value';

    // 2. Identify the correct native browser prototype for the specific element
    // This prevents "Illegal invocation" errors by ensuring the setter matches the element type
    let nativePrototype: any = null;

    if (element instanceof HTMLInputElement) {
        nativePrototype = window.HTMLInputElement.prototype;
    } else if (element instanceof HTMLTextAreaElement) {
        nativePrototype = window.HTMLTextAreaElement.prototype;
    } else if (element instanceof HTMLSelectElement) {
        nativePrototype = window.HTMLSelectElement.prototype;
    } else {
        // Fallback for custom Web Components or generic elements
        nativePrototype = Object.getPrototypeOf(element);
    }

    // 3. Retrieve the native setter from the identified prototype
    const descriptor = Object.getOwnPropertyDescriptor(nativePrototype, attribute);
    const nativeSetter = descriptor?.set;

    if (nativeSetter) {
        // Forcefully apply the value to the actual DOM bypassing React's logic
        nativeSetter.call(element, value);

        // 4. Dispatch the appropriate events to bubble up to React's event delegation root
        const eventType = isCheckable ? 'click' : 'input';
        element.dispatchEvent(new Event(eventType, { bubbles: true }));

        // Always dispatch 'change' to ensure compatibility with standard DOM listeners
        element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        console.warn(`[triggerNativeChange] Could not find native setter for '${attribute}'`);
    }
};
