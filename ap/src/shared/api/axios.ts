import axios from 'axios';

export const axiosInstance = axios.create({
    baseURL: '/ap/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// request
axiosInstance.interceptors.request.use(
    (config) => {
        // attach token
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// response
axiosInstance.interceptors.response.use(
    (response) => response.data,
    (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
    },
);
