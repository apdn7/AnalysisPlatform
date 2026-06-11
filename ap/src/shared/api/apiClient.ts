import { axiosInstance } from './axios';

export const apiClient = {
    async get<T>(url: string, params?: any): Promise<T> {
        try {
            return await axiosInstance.get(url, { params });
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async post<T>(url: string, data?: any): Promise<T> {
        try {
            return await axiosInstance.post(url, data);
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async put<T>(url: string, data?: any): Promise<T> {
        try {
            return await axiosInstance.put(url, data);
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },

    async delete<T>(url: string, data?: any): Promise<T> {
        try {
            return await axiosInstance.delete(url, data);
        } catch (error: any) {
            throw error.response?.data || error;
        }
    },
};
