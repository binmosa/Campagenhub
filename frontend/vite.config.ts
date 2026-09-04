import { defineConfig } from 'vite';

/**
 * Vite config.
 *
 * Day-to-day dev needs nothing here — the app talks to the API at
 * `http://<host>:3001/api` (see src/lib/api.ts). The proxy below only
 * matters when the app is started with `VITE_API_BASE_URL=/api`, which is
 * what the Playwright e2e run does: same-origin requests, no CORS, and the
 * backend under test can live on any port (`VITE_PROXY_TARGET`).
 */
const target = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001';

export default defineConfig({
  server: {
    proxy: {
      '/api': { target, changeOrigin: true },
      '/uploads': { target, changeOrigin: true },
    },
  },
});
