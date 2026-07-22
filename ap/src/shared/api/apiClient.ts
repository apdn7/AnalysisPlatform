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
            return await axiosInstance.get(url, { ...defaultConfig, ...config });
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async post<T>(url: string, data?: any, config?: any): Promise<T> {
        try {
            return await axiosInstance.post(url, data, { ...defaultConfig, ...config });
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async put<T>(url: string, data?: any, config?: any): Promise<T> {
        try {
            return await axiosInstance.put(url, data, { ...defaultConfig, ...config });
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async delete<T>(url: string, config?: any): Promise<T> {
        // Add data via the config (following AxiosRequestConfig) if need
        try {
            return await axiosInstance.delete(url, { ...defaultConfig, ...config });
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },
};
