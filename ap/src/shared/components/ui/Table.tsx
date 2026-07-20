import React, { useEffect, useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import { useTranslation } from 'react-i18next';

export interface Column<T> {
    key: keyof T;
    label: string;
    sortable?: boolean;
    filter?: boolean;
    render?: (value: any, row: T) => React.ReactNode;
}

interface Filter<T> {
    key: keyof T;
    value: string;
}

const DEFAULT_COLUMN_CONFIG = {
    sortable: true,
    filter: true,
} as const;

// Helper function
export const defineColumn = <T,>(
    column: Omit<Column<T>, 'sortable' | 'filter'> & Partial<Pick<Column<T>, 'sortable' | 'filter'>>,
): Column<T> => ({
    ...DEFAULT_COLUMN_CONFIG,
    ...column,
});

interface DataTableProps<T> {
    id?: string;
    columns: Column<T>[];
    datas: T[];
    onRowClick?: (row: T, index: number) => void;
    selectedRowIndex?: number | null;
}

const PlayIcon = ({ className }) => (
    <span data-cn={className}>
        <i className={`fa fa-play fa-sm ${className}`}></i>
    </span>
);

export default function DataTable<T extends Record<string, any>>({
    id,
    columns,
    datas,
    onRowClick,
    selectedRowIndex,
}: DataTableProps<T>) {
    const { t } = useTranslation();
    const [selectedRow, setSelectedRow] = useState<number | null>(null);

    useEffect(() => {
        if (selectedRowIndex !== undefined) {
            setSelectedRow(selectedRowIndex);
        }
    }, [selectedRowIndex]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [filters, setFilters] = useState<Filter<T> | null>(null);
    const hasFilterColumn = columns.some((column) => column.filter);

    const handleFilterColumn = ({ key, value }: Filter<T>) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const filteredDatas = useMemo(() => {
        return datas.filter((row) => {
            if (!filters) return true;
            return Object.keys(filters).every((key) => {
                const filterValue = filters[key].toString().toLowerCase();
                if (!filterValue) return true;

                return String(row[key]).toLowerCase().includes(filterValue);
            });
        });
    }, [filters, datas]);
    const handleSort = (col) => {
        if (!col.sortable) return;
        setSortConfig((prev) => {
            if (prev.key !== col.key) return { key: col.key, direction: 'asc' };
            if (prev.direction === 'asc') return { key: col.key, direction: 'desc' };
            return { key: null, direction: null };
        });
    };

    const sortedData = [...filteredDatas].sort((a, b) => {
        if (!sortConfig.key || !sortConfig.direction) return 0;
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div>
            <Table id={id} striped bordered hover responsive className={'export-cog-table'}>
                <thead>
                    <tr>
                        {columns.map((col, index) => (
                            <th
                                key={index}
                                onClick={() => handleSort(col)}
                                style={{
                                    cursor: col.sortable ? 'pointer' : 'default',
                                    userSelect: 'none',
                                    position: 'relative',
                                }}
                                className={`export-header export-col-${String(col.key)}`}
                                title={t(col.label)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <span>{t(col.label)}</span>
                                    {col.sortable && (
                                        <div style={{ position: 'absolute', right: '-4px' }}>
                                            <span
                                                style={{ marginLeft: 8, opacity: sortConfig.key === col.key ? 1 : 0.3 }}
                                                className="mr-1 sortCol select2-sort-icon"
                                            >
                                                {sortConfig.key === col.key && sortConfig.direction === 'asc' ? (
                                                    <PlayIcon key="asc" className="asc" />
                                                ) : sortConfig.key === col.key && sortConfig.direction === 'desc' ? (
                                                    <PlayIcon key="desc" className="desc" />
                                                ) : (
                                                    <>
                                                        <PlayIcon key="asc" className="asc" />
                                                        <PlayIcon key="desc" className="desc" />
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                    {hasFilterColumn && (
                        <tr>
                            {columns.map((col, index) => (
                                <th className="p-0" key={index}>
                                    {col.filter && (
                                        <span className="deleteicon w-100">
                                            <input
                                                className="form-control filterCol"
                                                value={filters ? filters[col.key as keyof (keyof Filter<T>)] : ''}
                                                placeholder={t('Search') + '...'}
                                                onChange={(e) =>
                                                    handleFilterColumn({ key: col.key, value: e.target.value })
                                                }
                                            />
                                            <span
                                                className="remove-search"
                                                onClick={() => handleFilterColumn({ key: col.key, value: '' })}
                                            >
                                                x
                                            </span>
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    )}
                </thead>
                <tbody>
                    {sortedData.map((row, index) => (
                        <tr
                            onClick={() => {
                                setSelectedRow(index);
                                onRowClick?.(row, index);
                            }}
                            key={index}
                            style={{ backgroundColor: selectedRow == index ? 'steelblue' : '' }}
                            id={`cfg-export-${row.id}`}
                            className={selectedRow == index ? 'selected-row' : ''}
                        >
                            {columns.map((col, colIndex) => {
                                // for No. column, just show index
                                const value = col.key === 'no' ? index + 1 : row[col.key];
                                return (
                                    <td
                                        className={`export-col export-col-${String(col.key)}`}
                                        title={String(value)}
                                        key={colIndex}
                                        style={col.render ? { textAlign: 'center' } : {}}
                                    >
                                        {col.render ? col.render(value, row) : value}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
}
