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

export default defineConfig(({ mode }) => {
  /*
   * A production build with no API address silently falls back to
   * `http://<hostname>:3001/api` (see src/lib/api.ts). On an HTTPS host
   * every request is then blocked as mixed content with nothing visible to
   * explain it — the app just appears dead. Better to fail the build.
   */
  if (mode === 'production' && !process.env.VITE_API_BASE_URL) {
    throw new Error(
      'VITE_API_BASE_URL is required for a production build (e.g. https://api.yourdomain.com/api). ' +
        'Set it in the Vercel project environment variables.',
    );
  }

  return {
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
      },
    },
  };
});
