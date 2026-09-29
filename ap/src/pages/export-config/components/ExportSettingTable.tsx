import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { exportConfigService } from '@/services/exportConfig.ts';
import ConfirmModal from '@/shared/components/ui/ConfirmModal.tsx';
import DataTable, { type Column, defineColumn } from '@/shared/components/ui/Table.tsx';
import { useToast } from '@/shared/hooks/useToast';
import { eventBus } from '@/shared/utils/eventBus';
import { convertUtcToLocal } from '@/shared/utils/helpers.ts';

const EXPORT_CONFIG_DEFAULT_LIMIT = 10;
export default function ExportSettingTable() {
    const { t } = useTranslation();
    const columns: Column<Record<string, any>>[] = [
        defineColumn({ key: 'no', label: 'No.' }),
        defineColumn({
            key: 'title',
            label: 'Title',
        }),
        defineColumn({
            key: 'created_by',
            label: 'Creator',
        }),
        defineColumn({
            key: 'updated_at',
            label: 'Update',
        }),
        defineColumn({
            key: 'description',
            label: 'Description',
        }),
        defineColumn({
            key: 'folder_path',
            label: 'Folder',
        }),
        defineColumn({
            key: 'cycle_name',
            label: 'Cycle',
        }),
        defineColumn({
            key: 'timing',
            label: 'Timing',
        }),
        defineColumn({
            key: 'main_process_name',
            label: 'Main Process',
        }),
        defineColumn({
            key: 'parameters',
            label: 'Parameters',
        }),
        defineColumn({
            key: 'last_run',
            label: 'Last run',
        }),
        defineColumn({
            key: 'last_export_data',
            label: 'Latest export data',
        }),
        defineColumn({
            key: 'next_run',
            label: 'Next run',
        }),
        defineColumn({
            key: 'delete',
            label: '',
            sortable: false,
            filter: false,
            render: (value, row) => (
                <button
                    className="btn btn-secondary icon-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModel(row.id);
                    }}
                    title={t('Delete')}
                >
                    <i className="fas fa-trash-alt icon-secondary"></i>
                </button>
            ),
        }),
    ] as const;

    const [isDeleteModelOpen, setIsDeleteModalOpen] = useState(false);
    const [configIdToDelete, setConfigIdToDelete] = useState<number | null>(null);
    const [exportData, setExportData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(EXPORT_CONFIG_DEFAULT_LIMIT);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
    const [scrollToId, setScrollToId] = useState<string | null>(null);
    const { error, success, closeAllToast } = useToast();
    const totalRef = useRef(0);
    const limitRef = useRef(limit);
    const exportDataRef = useRef([]);

    const fetchInitialData = async (nextPage: number, limitChange: number) => {
        try {
            const response = await exportConfigService.getConfigs(nextPage, limitChange);
            const data = response?.export_configs;
            const convertedData = data.map((export_config) => ({
                ...export_config,
                updated_at: convertUtcToLocal(export_config.updated_at),
                next_run: convertUtcToLocal(export_config.next_run),
                last_run: convertUtcToLocal(export_config.last_run),
                last_export_data: convertUtcToLocal(export_config.last_export_data),
            }));
            setExportData(convertedData);
            setTotal(response.total);
            setCurrentPage(nextPage);
            totalRef.current = response.total;
            limitRef.current = limitChange;
            exportDataRef.current = convertedData;
        } catch (err) {
            error(t('Error when trying to fetch export config records: '));
            closeAllToast();
        } finally {
        }
    };

    const reloadTableAfterAddNewRow = async () => {
        const currentLimit = limitRef.current;
        const expectedTotal = totalRef.current + 1;
        const lastPage = Math.ceil(expectedTotal / currentLimit);
        setPage(lastPage);
        setCurrentPage(lastPage);
        await fetchInitialData(lastPage, limit);
        setSelectedRowIndex(exportDataRef.current.length - 1);
    };
    useEffect(() => {
        void fetchInitialData(page, limit);

        const unsubscribe = eventBus.on('EXPORT_CONFIG_UPDATING', (newRecord) => {
            void reloadTableAfterAddNewRow();
        });

        const unsubscribeReset = eventBus.on('EXPORT_CONFIG_RESETTING', () => {
            setSelectedRowIndex(null);
        });

        // Cleanup when the component unmounts to avoid memory leaks
        return () => {
            unsubscribe();
            unsubscribeReset();
        };
    }, []);

    // Scroll when created new record
    useEffect(() => {
        if (scrollToId) {
            const element = document.getElementById(`cfg-export-${scrollToId}`);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
        setScrollToId(null);
    }, [exportData, scrollToId]);

    useEffect(() => {
        totalRef.current = total;
    }, [total]);

    useEffect(() => {
        limitRef.current = limit;
    }, [limit]);

    const deleteExportConfig = async () => {
        if (configIdToDelete === null) return;
        try {
            await exportConfigService.deleteConfig(configIdToDelete);
            setExportData((prevRecords) => prevRecords.filter((record: any) => record.id !== configIdToDelete));
            success(t('Delete export config successfully.'));

            totalRef.current = totalRef.current - 1;
            eventBus.emit('DELETE_EXPORT_CONFIG');
        } catch (err) {
            error(t('Error when trying to delete export config: '));
        } finally {
            closeAllToast();
            setIsDeleteModalOpen(false);
            setConfigIdToDelete(null);
        }
    };

    const openDeleteModel = (id: number) => {
        setConfigIdToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
    };

    const handleRowClick = async (rowData: any, index: number) => {
        setSelectedRowIndex(index);
        let export_config = await exportConfigService.getConfigDetail(rowData.id);
        if (export_config == null) {
            error(t('There do not exist selected export config in system.'));
            closeAllToast();
            return;
        }

        export_config = {
            ...export_config,
            export_config: {
                ...export_config.export_config,
                export_from: convertUtcToLocal(export_config.export_config.export_from, 'YYYY-MM-DD HH:mm'),
                export_to: convertUtcToLocal(export_config.export_config.export_to, 'YYYY-MM-DD HH:mm'),
            },
            export_periodic: {
                ...export_config.export_periodic,
                ...(export_config.export_periodic?.start_time && {
                    start_time: convertUtcToLocal(export_config.export_periodic.start_time, 'YYYY-MM-DD HH:mm'),
                }),
            },
        };

        eventBus.emit('EXPORT_CONFIG_ROW_CLICKED', export_config);
    };

    const handleOnChangePage = (changePage: number, changeLimit: number) => {
        setPage(changePage);
        setSelectedRowIndex(null);
        eventBus.emit('EXPORT_CONFIG_ROW_UNSELECTED');
        void fetchInitialData(changePage, changeLimit);
    };
    return (
        <div>
            <DataTable
                id="exportConfigDataTable"
                columns={columns}
                datas={exportData}
                onRowClick={(data, index) => {
                    void handleRowClick(data, index);
                }}
                selectedRowIndex={selectedRowIndex}
                total={total}
                limit={limit}
                currentPage={currentPage}
                onLimitChange={(limitChange) => {
                    limitRef.current = limitChange;
                    setLimit(limitChange);
                    handleOnChangePage(1, limitChange);
                }}
                onPageChange={(page) => {
                    handleOnChangePage(page, limit);
                }}
            ></DataTable>
            <ConfirmModal
                isOpen={isDeleteModelOpen}
                title="Delete Export Config"
                children="Delete this export config ?"
                onClose={closeDeleteModal}
                onConfirm={deleteExportConfig}
            />
        </div>
    );
}
