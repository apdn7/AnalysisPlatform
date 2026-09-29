import type { AxiosResponse } from 'axios';

import type {
    ExportAPIFetchResponse,
    ExportAPIResponse,
    ExportConfigData,
    ExportConfigRecords,
    ExportPeriodic,
    FormValue,
} from '@/pages/export-config/components/ExportConfig.tsx';
import { apiClient } from '@/shared/api/apiClient.ts';

export const exportConfigService = {
    getConfigs: async (page: number, limit: number): Promise<ExportAPIFetchResponse<ExportConfigRecords>> =>
        apiClient.get(`/setting/export_config?page=${page}&limit=${limit}`),
    deleteConfig: async (id) => apiClient.delete(`/setting/export_config/${id}`),
    previewScheduler: async (data: ExportPeriodic): Promise<AxiosResponse<string[]>> =>
        apiClient.post('/setting/export_config_preview', data),
    saveConfig: async (data: FormValue): Promise<ExportAPIResponse<ExportConfigData>> => {
        try {
            return await apiClient.post<ExportAPIResponse<ExportConfigData>>('/setting/export_config', data);
        } catch (error: any) {
            throw error?.response || error;
        }
    },
    getConfigDetail: async (export_config_id: number): Promise<FormValue> =>
        apiClient.get(`/setting/get_export_config_detail/${export_config_id}`),
};
