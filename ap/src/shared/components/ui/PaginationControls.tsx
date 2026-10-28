import React from 'react';
import { useTranslation } from 'react-i18next';

type PaginationControlsProps = {
    total: number;
    totalPages: number;
    currentPage: number;
    start: number;
    end: number;
    jumpPage: string;
    onJumpPageChange: (value: string) => void;
    onPageChange: (page: number) => void;
    siblingCount?: number;
    children?: React.ReactNode;
    className?: string;
    variant?: 'default' | 'compact';
};

export default function PaginationControls({
    total,
    totalPages,
    currentPage,
    start,
    end,
    jumpPage,
    onJumpPageChange,
    onPageChange,
    siblingCount = 1,
    children,
    className = '',
    variant = 'default',
}: PaginationControlsProps) {
    const { t } = useTranslation();
    const compact = variant === 'compact';
    const empty = total === 0 || totalPages === 0;
    const visiblePages = new Set<number>();
    if (!empty && !compact) {
        visiblePages.add(1);
        visiblePages.add(totalPages);
        for (
            let page = Math.max(1, currentPage - siblingCount);
            page <= Math.min(totalPages, currentPage + siblingCount);
            page += 1
        ) {
            visiblePages.add(page);
        }
    }
    const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    // Keep the page window width stable while navigating, without reserving nonexistent pages.
    const pages = compact
        ? Array.from({ length: empty ? 0 : Math.min(5, totalPages) }, (_, index) => firstVisiblePage + index)
        : [...visiblePages].sort((a, b) => a - b);
    const pageNumberStyle = compact ? { width: `calc(${Math.max(5, String(totalPages).length)}ch)` } : undefined;
    const changePage = (page: number) => {
        if (!empty && Number.isInteger(page) && page >= 1 && page <= totalPages && page !== currentPage) {
            onPageChange(page);
        }
    };
    const jump = () => {
        if (jumpPage.trim() !== '') {
            const page = Number(jumpPage);
            if (compact && !empty && Number.isInteger(page) && page > totalPages) {
                onJumpPageChange(String(totalPages));
                changePage(totalPages);
            } else {
                changePage(page);
            }
        }
    };

    return (
        <nav
            className={`app-pagination${compact ? ' app-pagination--compact' : ''} ${className}`.trim()}
            aria-label={t('Pagination')}
        >
            {children}
            {compact ? (
                <span
                    className="app-pagination__range"
                    style={{ minWidth: `${Math.max(5, String(total).length)}ch` }}
                    title={`${empty ? 0 : start}-${empty ? 0 : end}`}
                >
                    <span>{empty ? 0 : start}</span>
                    <span>{empty ? 0 : end}</span>
                </span>
            ) : (
                <span className="app-pagination__range">{`${empty ? 0 : start}-${empty ? 0 : end} / ${total}`}</span>
            )}
            <div className="app-pagination__pages">
                <button
                    type="button"
                    className="app-pagination__button"
                    aria-label={t('First page')}
                    disabled={empty || currentPage <= 1}
                    onClick={() => changePage(1)}
                >
                    <i className="fa fa-step-backward" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="app-pagination__button"
                    aria-label={t('Previous page')}
                    disabled={empty || currentPage <= 1}
                    onClick={() => changePage(currentPage - 1)}
                >
                    {'<'}
                </button>
                {pages.map((page, index) => (
                    <React.Fragment key={compact ? `slot-${index}` : page}>
                        {!compact && index > 0 && page - pages[index - 1] > 1 && (
                            <span className="app-pagination__ellipsis">...</span>
                        )}
                        <button
                            type="button"
                            className={`app-pagination__button${page === currentPage ? ' is-active' : ''}`}
                            style={pageNumberStyle}
                            aria-current={page === currentPage ? 'page' : undefined}
                            onClick={() => changePage(page)}
                        >
                            {page}
                        </button>
                    </React.Fragment>
                ))}
                <button
                    type="button"
                    className="app-pagination__button"
                    aria-label={t('Next page')}
                    disabled={empty || currentPage >= totalPages}
                    onClick={() => changePage(currentPage + 1)}
                >
                    {'>'}
                </button>
                <button
                    type="button"
                    className="app-pagination__button"
                    aria-label={t('Last page')}
                    disabled={empty || currentPage >= totalPages}
                    onClick={() => changePage(totalPages)}
                >
                    <i className="fa fa-step-forward" aria-hidden="true" />
                </button>
            </div>
            <input
                type="number"
                className="app-pagination__jump form-control"
                aria-label={t('Page')}
                min={1}
                max={Math.max(1, totalPages)}
                step={1}
                value={jumpPage}
                disabled={empty}
                onChange={(event) => onJumpPageChange(event.target.value)}
                onBlur={compact ? jump : undefined}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        jump();
                    }
                }}
            />
            {compact ? (
                <span className="app-pagination__total-pages">/{empty ? 0 : totalPages}</span>
            ) : (
                <button
                    type="button"
                    className="app-pagination__jump-button btn simple-btn"
                    disabled={empty}
                    onClick={jump}
                >
                    {t('Jump')}
                </button>
            )}
        </nav>
    );
}
