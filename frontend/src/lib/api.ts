import axios from 'axios';

const baseURL =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  `http://${window.location.hostname}:3001/api`;

export const serverOrigin = baseURL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
