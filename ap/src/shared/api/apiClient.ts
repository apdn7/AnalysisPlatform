import { axiosInstance } from './axios';

const defaultConfig = {
    headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
    },
};
export const apiClient = {
    async get<T>(url: string, config?: any): Promise<T> {
        try {
            const response = await axiosInstance.get<T>(url, { ...defaultConfig, ...config });
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async post<T>(url: string, data?: any, config?: any): Promise<T> {
        try {
            const response = await axiosInstance.post<T>(url, data, { ...defaultConfig, ...config });
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async put<T>(url: string, data?: any, config?: any): Promise<T> {
        try {
            const response = await axiosInstance.put<T>(url, data, { ...defaultConfig, ...config });
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async delete<T>(url: string, config?: any): Promise<T> {
        // Add data via the config (following AxiosRequestConfig) if need
        try {
            const response = await axiosInstance.delete<T>(url, { ...defaultConfig, ...config });
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },
};
