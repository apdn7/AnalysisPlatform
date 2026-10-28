/**
 * Type definitions for SearchSelect component
 */

export interface TwoColumnOption {
    value: string | number;
    col1: string;
    col2: string;
}

export interface SearchSelectProps {
    id?: string;
    name?: string;
    value?: string | number | null;
    options: TwoColumnOption[];
    onChange?: (value: string | number | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    searchPlaceholder?: string;
    selectedDisplayMode?: 'col1' | 'col2' | 'both';
}
