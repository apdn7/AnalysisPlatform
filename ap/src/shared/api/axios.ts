import axios from 'axios';

export const axiosInstance = axios.create({
    baseURL: '/ap/api',
    headers: {
        'Content-Type': 'application/json',
    },
});
