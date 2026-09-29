import { type ChangeEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const CATEGORY_AGGREGATE = {
    AGGREGATED: 'aggregated',
    KEEP_DUPLICATES: 'keepDuplicates',
} as const;

const TERM_CATEGORY_AGGREGATE_SYNC_EVENT = 'map-sync-term-category-aggregated';

export default function CategoryAggregate({ prefix = '', isShow }) {
    const [categoryAggregateNode, setCategoryAggregateNode] = useState<HTMLElement | null>(null);
    const [categoryAggregate, setCategoryAggregate] = useState<string>('');
    const { t } = useTranslation();

    useEffect(() => {
        const categoryAggregateNodeEL = document.getElementById(prefix + 'categoryAggregateArea');
        if (categoryAggregateNodeEL) {
            setCategoryAggregateNode(categoryAggregateNodeEL);
        }
        setCategoryAggregate(CATEGORY_AGGREGATE.AGGREGATED);
    }, []);

    useEffect(() => {
        if (prefix !== 'term') {
            return;
        }

        const handleSyncTermCategoryAggregate = (event: Event) => {
            const customEvent = event as CustomEvent<{ value?: string }>;
            const nextValue = customEvent.detail?.value;
            if (nextValue === CATEGORY_AGGREGATE.AGGREGATED || nextValue === CATEGORY_AGGREGATE.KEEP_DUPLICATES) {
                setCategoryAggregate(nextValue);
            }
        };

        window.addEventListener(TERM_CATEGORY_AGGREGATE_SYNC_EVENT, handleSyncTermCategoryAggregate);
        return () => {
            window.removeEventListener(TERM_CATEGORY_AGGREGATE_SYNC_EVENT, handleSyncTermCategoryAggregate);
        };
    }, [prefix]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setCategoryAggregate(event.target.value as keyof typeof CATEGORY_AGGREGATE);
    };

    if (!isShow) {
        return null;
    }

    return (
        <div>
            {categoryAggregateNode &&
                createPortal(
                    <div id="categoryAggregate" className="d-flex mb-3 align-items-center" style={{ color: 'white' }}>
                        <p className="mr-3 mx-0 my-0">{t('Category Aggregation')}</p>
                        <div className="custom-control custom-radio grp-height-align mr-3">
                            <input
                                type="radio"
                                name={prefix + 'categoryAggregated'}
                                className="custom-control-input"
                                id={prefix + 'radioAggregated'}
                                value={CATEGORY_AGGREGATE.AGGREGATED}
                                checked={categoryAggregate === CATEGORY_AGGREGATE.AGGREGATED}
                                onChange={handleChange}
                            />
                            <label className="custom-control-label" title="" htmlFor={prefix + 'radioAggregated'}>
                                <span className="sub-label">{t('Aggregated')}</span>
                            </label>
                        </div>

                        <div className="custom-control custom-radio grp-height-align mr-3">
                            <input
                                type="radio"
                                name={prefix + 'categoryAggregated'}
                                className="custom-control-input"
                                id={prefix + 'radioKeepDuplicates'}
                                value={CATEGORY_AGGREGATE.KEEP_DUPLICATES}
                                checked={categoryAggregate === CATEGORY_AGGREGATE.KEEP_DUPLICATES}
                                onChange={handleChange}
                            />
                            <label className="custom-control-label" title="" htmlFor={prefix + 'radioKeepDuplicates'}>
                                <span className="sub-label">{t('Keep Duplicates')}</span>
                            </label>
                        </div>
                    </div>,
                    categoryAggregateNode,
                )}
        </div>
    );
}
