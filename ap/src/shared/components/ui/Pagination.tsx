import React, { useMemo } from 'react';

import Select, { type SelectOption } from '@/shared/components/ui/Select.tsx';
import { docCookies } from '@/shared/utils/cookies.ts';

const options: SelectOption[] = [
    { value: 10, text: '10' },
    { value: 20, text: '20' },
    { value: 50, text: '50' },
    { value: 100, text: '100' },
];

type PaginationItem = number | 'start-ellipsis' | 'end-ellipsis';

type PaginationProps = {
    total: number;
    limit: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    siblingCount?: number;
};

const Pagination = ({ total, limit, currentPage, onPageChange, onLimitChange, siblingCount = 1 }: PaginationProps) => {
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const locale = docCookies.getLocale();

    const startItem = total === 0 ? 0 : (currentPage - 1) * limit + 1;

    const endItem = total === 0 ? 0 : Math.min(currentPage * limit, total);

    const infoText =
        locale === 'ja'
            ? `全${total}件のうち、${startItem}から
                ${endItem}件まで表示しています。
                ページ当たり最大`
            : `Showing ${startItem} to ${endItem} of all ${total} rows.`;

    const paginationItems = useMemo<PaginationItem[]>(() => {
        if (totalPages === 1) {
            return [1];
        }

        const pages: PaginationItem[] = [];

        const startPage = Math.max(2, currentPage - siblingCount);

        const endPage = Math.min(totalPages - 1, currentPage + siblingCount);

        pages.push(1);

        if (startPage > 2) {
            pages.push('start-ellipsis');
        }

        for (let page = startPage; page <= endPage; page += 1) {
            pages.push(page);
        }

        if (endPage < totalPages - 1) {
            pages.push('end-ellipsis');
        }

        pages.push(totalPages);

        return pages;
    }, [currentPage, siblingCount, totalPages]);

    const changePage = (page: number) => {
        if (page < 1 || page > totalPages || page === currentPage) {
            return;
        }

        onPageChange(page);
    };

    const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = Number(event.target.value);

        onLimitChange?.(newLimit);
    };

    return (
        <div className="d-flex justify-content-between w-100 px-2 mt-3">
            <div className="d-flex align-items-center">
                {infoText}{' '}
                <Select value={String(limit)} options={options} onChange={handleLimitChange} className="mx-2 my-0" />{' '}
                {locale === 'ja' ? '件' : 'rows per page'}
            </div>

            <nav className="data-table-pagination" aria-label="Pagination">
                <button
                    type="button"
                    className="pagination__button"
                    disabled={currentPage <= 1}
                    onClick={() => changePage(currentPage - 1)}
                    aria-label="Previous page"
                >
                    &lt;
                </button>

                {paginationItems.map((item) => {
                    if (item === 'start-ellipsis' || item === 'end-ellipsis') {
                        return (
                            <span key={item} className="pagination__ellipsis">
                                ...
                            </span>
                        );
                    }

                    return (
                        <button
                            key={item}
                            type="button"
                            className={['pagination__button', item === currentPage ? 'pagination__button--active' : '']
                                .filter(Boolean)
                                .join(' ')}
                            aria-current={item === currentPage ? 'page' : undefined}
                            onClick={() => changePage(item)}
                        >
                            {item}
                        </button>
                    );
                })}

                <button
                    type="button"
                    className="pagination__button"
                    disabled={currentPage >= totalPages}
                    onClick={() => changePage(currentPage + 1)}
                    aria-label="Next page"
                >
                    &gt;
                </button>
            </nav>
        </div>
    );
};

export default Pagination;
