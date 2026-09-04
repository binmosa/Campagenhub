import axios from 'axios';

/**
 * API base. `VITE_API_BASE_URL` (build-time on Vercel, or `/api` for the
 * Playwright run behind the Vite proxy) wins; otherwise the dev default of
 * the same host on :3001. Must stay a plain `import.meta.env.X` expression —
 * Vite only replaces that exact form, so optional chaining would silently
 * fall through to the default.
 */
const baseURL: string =
  import.meta.env.VITE_API_BASE_URL ||
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
