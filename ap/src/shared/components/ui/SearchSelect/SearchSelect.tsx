import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import styles from './SearchSelect.module.scss';
import type { SearchSelectProps, TwoColumnOption } from './types';

const DROPDOWN_MIN_WIDTH = 320;
const VIEWPORT_PADDING = 8;
const DROPDOWN_GAP = 2;

export default function SearchSelect({
    id,
    name,
    value = null,
    options,
    onChange,
    placeholder = 'Select an option...',
    disabled = false,
    className = '',
    searchPlaceholder,
    selectedDisplayMode = 'col1',
}: SearchSelectProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    // Get selected option
    const selectedOption = useMemo(() => {
        return options.find((opt) => opt.value === value);
    }, [options, value]);

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return options;

        const term = searchTerm.toLowerCase();
        return options.filter((opt) => opt.col1.toLowerCase().includes(term) || opt.col2.toLowerCase().includes(term));
    }, [options, searchTerm]);

    // Format selected value for display
    const getSelectedDisplayText = (): string => {
        if (!selectedOption) {
            return placeholder;
        }

        switch (selectedDisplayMode) {
            case 'col2':
                return selectedOption.col2;
            case 'both':
                return `${selectedOption.col1} - ${selectedOption.col2}`;
            case 'col1':
            default:
                return selectedOption.col1;
        }
    };

    // Handle option selection
    const handleSelectOption = (option: TwoColumnOption) => {
        onChange?.(option.value);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Handle clear button click
    const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onChange?.(null);
        setSearchTerm('');
        setIsOpen(false);
    };

    // Handle dropdown toggle
    const handleToggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleClearSearch = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setSearchTerm('');
        searchInputRef.current?.focus();
    };

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedOutsideControl = !containerRef.current?.contains(target);
            const clickedOutsideDropdown = !dropdownRef.current?.contains(target);

            if (clickedOutsideControl && clickedOutsideDropdown) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const updateDropdownPosition = useCallback(() => {
        if (!containerRef.current) return;

        const controlRect = containerRef.current.getBoundingClientRect();
        const availableWidth = Math.max(0, window.innerWidth - VIEWPORT_PADDING * 2);
        const width = Math.min(Math.max(controlRect.width, DROPDOWN_MIN_WIDTH), availableWidth);
        const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
        const left = Math.min(Math.max(controlRect.left, VIEWPORT_PADDING), maxLeft);
        const dropdownHeight = dropdownRef.current?.getBoundingClientRect().height ?? 0;
        const hasRoomAbove = controlRect.top - DROPDOWN_GAP - dropdownHeight >= VIEWPORT_PADDING;
        const hasRoomBelow =
            controlRect.bottom + DROPDOWN_GAP + dropdownHeight <= window.innerHeight - VIEWPORT_PADDING;
        const top =
            !hasRoomBelow && hasRoomAbove
                ? controlRect.top - dropdownHeight - DROPDOWN_GAP
                : controlRect.bottom + DROPDOWN_GAP;

        setDropdownPosition({ top, left, width });
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) return;
        updateDropdownPosition();
        searchInputRef.current?.focus();
    }, [filteredOptions.length, isOpen, updateDropdownPosition]);

    useEffect(() => {
        if (!isOpen) return;

        window.addEventListener('resize', updateDropdownPosition);
        window.addEventListener('scroll', updateDropdownPosition, true);
        return () => {
            window.removeEventListener('resize', updateDropdownPosition);
            window.removeEventListener('scroll', updateDropdownPosition, true);
        };
    }, [isOpen, updateDropdownPosition]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
        } else if (e.key === 'Enter' && filteredOptions.length > 0) {
            handleSelectOption(filteredOptions[0]);
        }
    };

    const portalContainer = containerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body;

    return (
        <div ref={containerRef} className={`${styles.container} ${isOpen ? styles.open : ''} ${className}`}>
            {/* Selected value display and controls */}
            <div className={styles.selectedValue} onClick={handleToggleDropdown}>
                <span className={styles.selectedText}>{getSelectedDisplayText()}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Clear button - only show when value is selected */}
                    {value !== null && value !== undefined && !disabled && (
                        <button
                            type="button"
                            className={styles.clearButton}
                            onClick={handleClear}
                            title="Clear selection"
                            aria-label="Clear selection"
                        >
                            ×
                        </button>
                    )}

                    {/* Dropdown arrow */}
                    <div className={styles.arrow} />
                </div>
            </div>

            {/* Dropdown - Rendered as Portal to avoid overflow issues */}
            {isOpen &&
                !disabled &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className={`${styles.dropdown} ${isOpen ? styles.open : ''}`}
                        style={{
                            position: 'fixed',
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`,
                        }}
                    >
                        {/* Search input */}
                        <div className={styles.inputWrapper}>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className={styles.searchInput}
                                placeholder={searchPlaceholder ?? t('Search') + '...'}
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onKeyDown={handleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    className={styles.searchClearButton}
                                    onClick={handleClearSearch}
                                    aria-label="Clear search"
                                    title="Clear search"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {/* Options list */}
                        {filteredOptions.length > 0 ? (
                            <div className={styles.dropdownContent}>
                                {filteredOptions.map((option) => (
                                    <div
                                        key={option.value}
                                        className={`${styles.dropdownItem} ${
                                            value === option.value ? styles.selected : ''
                                        }`}
                                        onClick={() => handleSelectOption(option)}
                                        title={`${option.col1} - ${option.col2}`}
                                    >
                                        <div className={styles.dropdownItemCol1}>{option.col1}</div>
                                        <div className={styles.dropdownItemCol2}>{option.col2}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.dropdownEmpty}>
                                {searchTerm ? 'No results found' : 'No options available'}
                            </div>
                        )}
                    </div>,
                    portalContainer,
                )}

            {/* Hidden select for form submission compatibility */}
            {name && (
                <select
                    id={id}
                    name={name}
                    value={value ?? ''}
                    style={{ display: 'none' }}
                    onChange={(e) => onChange?.(e.target.value ? e.target.value : null)}
                >
                    <option value="">Select an option</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.col1} - {option.col2}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
}
