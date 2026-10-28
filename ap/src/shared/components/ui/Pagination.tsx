import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import PaginationControls from '@/shared/components/ui/PaginationControls.tsx';

const options = [10, 20, 50, 100];

type PaginationProps = {
    total: number;
    limit: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    siblingCount?: number;
};

const Pagination = ({ total, limit, currentPage, onPageChange, onLimitChange, siblingCount = 1 }: PaginationProps) => {
    const { t } = useTranslation();
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const [jumpPage, setJumpPage] = useState(String(currentPage));

    useEffect(() => {
        setJumpPage(String(currentPage));
    }, [currentPage, totalPages]);

    return (
        <PaginationControls
            variant="compact"
            className="w-100 justify-content-end px-2 mt-1"
            total={total}
            totalPages={totalPages}
            currentPage={currentPage}
            start={total === 0 ? 0 : (currentPage - 1) * limit + 1}
            end={total === 0 ? 0 : Math.min(currentPage * limit, total)}
            jumpPage={jumpPage}
            onJumpPageChange={setJumpPage}
            onPageChange={onPageChange}
            siblingCount={siblingCount}
        >
            <select
                className="app-pagination__page-size"
                aria-label={t('Number of Data')}
                value={limit}
                onChange={(event) => onLimitChange?.(Number(event.target.value))}
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </PaginationControls>
    );
};

export default Pagination;
