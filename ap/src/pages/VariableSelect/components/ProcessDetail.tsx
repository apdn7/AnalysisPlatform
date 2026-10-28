import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    type ProcessDetailColumnsResponse,
    type ProcessDetailData,
    variableServices,
} from '@/services/VariableServices.ts';
import { showDataTypeShort } from '@/services/dataType.ts';
import { convertUtcToLocal } from '@/shared/utils/helpers.ts';

interface ProcessDetailProps {
    processId?: string;
    selectedCount: number;
}

export default function ProcessDetail({ processId, selectedCount }: ProcessDetailProps) {
    const { t } = useTranslation();
    const [detail, setDetail] = useState<ProcessDetailData | null>(null);
    const [columns, setColumns] = useState<ProcessDetailColumnsResponse | null>(null);
    const [detailError, setDetailError] = useState(false);
    const [columnsError, setColumnsError] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [loadingColumns, setLoadingColumns] = useState(false);
    const columnsScrollRef = useRef<HTMLDivElement>(null);
    const [virtualWindow, setVirtualWindow] = useState({ start: 0, end: 10, rowHeight: 26 });
    const [retryDetail, setRetryDetail] = useState(0);
    const [retryColumns, setRetryColumns] = useState(0);

    useEffect(() => {
        if (!processId) return;
        let cancelled = false;
        const controller = new AbortController();
        setLoadingDetail(true);
        setDetailError(false);
        const timer = window.setTimeout(async () => {
            try {
                const response = await variableServices.getProcessDetail(processId, controller.signal);
                if (!cancelled) setDetail(response.data);
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch process details.', error);
                    setDetailError(true);
                }
            } finally {
                if (!cancelled) setLoadingDetail(false);
            }
        }, 150);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [processId, retryDetail]);

    useEffect(() => {
        if (!processId) return;
        let cancelled = false;
        const controller = new AbortController();
        setLoadingColumns(true);
        setColumnsError(false);
        const timer = window.setTimeout(async () => {
            try {
                const response = await variableServices.getProcessDetailColumns(processId, controller.signal);
                if (!cancelled) {
                    setColumns(response);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch process columns.', error);
                    setColumnsError(true);
                }
            } finally {
                if (!cancelled) setLoadingColumns(false);
            }
        }, 150);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [processId, retryColumns]);

    useLayoutEffect(() => {
        const scroller = columnsScrollRef.current;
        if (!scroller || loadingColumns || columnsError) return;
        let frame: number | null = null;
        const count = columns?.items.length ?? 0;
        const measure = () => {
            frame = null;
            const rowHeight = scroller.querySelector('tr[data-column-id]')?.getBoundingClientRect().height || 26;
            const headerHeight = scroller.querySelector('thead')?.getBoundingClientRect().height ?? 0;
            const first = Math.min(count, Math.floor(Math.max(0, scroller.scrollTop - headerHeight) / rowHeight));
            // Match the existing virtual tables: spacer rows and five overscan rows on each side.
            const start = Math.max(0, first - 5);
            const end = Math.min(count, first + Math.ceil(scroller.clientHeight / rowHeight) + 5);
            setVirtualWindow((current) =>
                current.start === start && current.end === end && current.rowHeight === rowHeight
                    ? current
                    : { start, end, rowHeight },
            );
        };
        const schedule = () => {
            if (frame === null) frame = window.requestAnimationFrame(measure);
        };
        const observer = new ResizeObserver(schedule);
        observer.observe(scroller);
        scroller.addEventListener('scroll', schedule, { passive: true });
        measure();
        return () => {
            observer.disconnect();
            scroller.removeEventListener('scroll', schedule);
            if (frame !== null) window.cancelAnimationFrame(frame);
        };
    }, [columns, loadingColumns, columnsError]);

    const columnCount = columns?.items.length ?? 0;
    const columnNumberDigits = String(columnCount).length;
    const windowEnd = Math.min(columnCount, virtualWindow.end);
    const fields = detail
        ? [
              ['Process', detail.name],
              ['Path', detail.path],
              ['Ref', detail.ref],
              [
                  'Option',
                  Object.entries(detail.option)
                      .map(([key, value]) => `${key}: ${value ?? '-'}`)
                      .join(', ') || null,
              ],
              ['Source', detail.source?.type],
              ['From', detail.from ? convertUtcToLocal(detail.from) : null],
              ['Latest', detail.latest ? convertUtcToLocal(detail.latest) : null],
              ['nRow', detail.data_count],
              ['Selected', selectedCount],
          ]
        : [];

    return (
        <aside className="variable-select-detail process-detail">
            <div className="detail-head">{t('Process Detail')}</div>
            {!processId ? (
                <span>No data</span>
            ) : (
                <div className="detail-body">
                    <div className="process-detail-metadata" aria-busy={loadingDetail}>
                        {detailError ? (
                            <div role="alert">
                                {t('Failed to fetch process details.')}
                                <button
                                    type="button"
                                    className="btn simple-btn"
                                    onClick={() => setRetryDetail((n) => n + 1)}
                                >
                                    {t('Retry')}
                                </button>
                            </div>
                        ) : loadingDetail ? (
                            <span role="status">{t('Loading...')}</span>
                        ) : (
                            <div className="kv">
                                {fields.map(([label, value]) => (
                                    <React.Fragment key={label}>
                                        <div>{label}</div>
                                        <div title={value == null ? undefined : String(value)}>{value ?? '-'}</div>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                    <section className="process-detail-links">
                        <div className="sample-title">Link Process</div>
                        <div className="process-detail-scroll">
                            {!loadingDetail &&
                                !detailError &&
                                (detail?.linked_processes.length ? (
                                    <ul>
                                        {detail.linked_processes.map((process) => (
                                            <li key={process.id} title={process.name}>
                                                {process.name}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span>No data Link</span>
                                ))}
                        </div>
                    </section>
                    <section className="process-detail-columns" aria-busy={loadingColumns}>
                        <div className="sample-title">{t('Variable List')}</div>
                        {columnsError ? (
                            <div role="alert">
                                {t('Failed to fetch process columns.')}
                                <button
                                    type="button"
                                    className="btn simple-btn"
                                    onClick={() => setRetryColumns((n) => n + 1)}
                                >
                                    {t('Retry')}
                                </button>
                            </div>
                        ) : (
                            <div
                                className="process-detail-scroll"
                                ref={columnsScrollRef}
                                tabIndex={0}
                                role="region"
                                aria-label={t('Variable List')}
                            >
                                {loadingColumns ? (
                                    <span role="status">{t('Loading...')}</span>
                                ) : (
                                    <table className="sample-mini" aria-rowcount={columnCount + 1}>
                                        <thead>
                                            <tr>
                                                <th
                                                    style={{ width: `max(40px, calc(${columnNumberDigits}ch + 12px))` }}
                                                >
                                                    idx
                                                </th>
                                                <th>{t('Variable name')}</th>
                                                <th>{t('Data Type')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="process-detail-spacer" aria-hidden="true">
                                                <td
                                                    colSpan={3}
                                                    style={{ height: virtualWindow.start * virtualWindow.rowHeight }}
                                                />
                                            </tr>
                                            {columns?.items
                                                .slice(virtualWindow.start, windowEnd)
                                                .map((column, index) => (
                                                    <tr
                                                        key={column.id}
                                                        data-column-id={column.id}
                                                        aria-rowindex={virtualWindow.start + index + 2}
                                                    >
                                                        <td>
                                                            {String(virtualWindow.start + index + 1).padStart(
                                                                columnNumberDigits,
                                                                '0',
                                                            )}
                                                        </td>
                                                        <td title={column.shown_name ?? column.name_en ?? undefined}>
                                                            {column.shown_name ?? column.name_en ?? '-'}
                                                        </td>
                                                        <td title={column.data_type ?? undefined}>
                                                            {showDataTypeShort({
                                                                ...column,
                                                                datatype: column.data_type,
                                                            }) || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            <tr className="process-detail-spacer" aria-hidden="true">
                                                <td
                                                    colSpan={3}
                                                    style={{
                                                        height: (columnCount - windowEnd) * virtualWindow.rowHeight,
                                                    }}
                                                />
                                            </tr>
                                            {columns?.items.length === 0 && (
                                                <tr>
                                                    <td colSpan={3}>{t('No data')}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </aside>
    );
}
