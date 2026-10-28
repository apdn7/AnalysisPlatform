/**
 * Legacy helper from ap/static/common/js/utils.js. It is the same conversion the graph request flow
 * (Data Finder, trace data) uses, so the sample filter and the plotted data share one timezone handling.
 */
declare const convertLocalToUTC: (datetimeLocal: string) => string;

/** A datetime range the user actively selected in the outer picker. */
export interface SelectedDatetimeRange {
    /** Raw local value shown by the picker (e.g. "2026-10-01 00:00 – 2026-10-01 23:59"), used for the header. */
    display: string;
    /** UTC start, in the format stored in the transaction datetime column. */
    start: string;
    /** UTC end, in the format stored in the transaction datetime column. */
    end: string;
}

// EN DASH wrapped in spaces; used only when daterangepicker-utils.js is not loaded on the page.
const FALLBACK_SEPARATOR = ' \u2013 ';

/** moment formats an unparsable value as "Invalid date", which convertLocalToUTC passes through. */
function toUtc(localValue: string): string {
    const utcValue = convertLocalToUTC(localValue);
    return utcValue.startsWith('Invalid') ? '' : utcValue;
}

/**
 * Reads the datetime range picker inputs rendered by the legacy page and returns the ranges the user
 * actually selected. A range counts as selected only when its current value differs from the default
 * value captured at init (the picker always auto-fills the current time, which must not count), so
 * values set by the picker, manual typing, Data Finder, loading a bookmark/user setting, or jump all
 * qualify. Multiple visible ranges (e.g. term mode) are all returned so the backend can union them.
 */
export function readSelectedDatetimeRanges(): SelectedDatetimeRange[] {
    // The modal may be mounted on a page that does not load utils.js: without the legacy converter a
    // local value cannot be turned into UTC, so no filter is sent and samples keep default behaviour.
    if (typeof convertLocalToUTC !== 'function') return [];

    const separator = typeof DATETIME_PICKER_SEPARATOR === 'string' ? DATETIME_PICKER_SEPARATOR : FALLBACK_SEPARATOR;
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="DATETIME_RANGE_PICKER"]'));
    const ranges: SelectedDatetimeRange[] = [];

    for (const input of inputs) {
        // Approximate jQuery ':visible': skip inputs not laid out (hidden term rows, detached nodes).
        if (input.offsetParent === null) continue;

        const value = (input.value || '').trim();
        const defaultValue = (input.getAttribute('data-default-datetime-range') || '').trim();
        if (!value || value === defaultValue) continue;

        const parts = value.split(separator);
        if (parts.length !== 2) continue;

        const start = toUtc(parts[0].trim());
        const end = toUtc(parts[1].trim());
        if (!start || !end) continue;

        ranges.push({ display: value, start, end });
    }

    return ranges;
}
