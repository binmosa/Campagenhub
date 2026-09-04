import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright — end-to-end tests for the whole portal, driven through a real
 * browser (the installed Google Chrome), role by role.
 *
 *   npm run e2e            headless run, HTML report in playwright-report/
 *   npm run e2e:headed     watch it happen
 *   npm run e2e:ui         Playwright's UI mode (pick tests, time-travel)
 *
 * The run is self-contained: it builds and starts the API on :3101 and
 * Vite on :5199 with `/api` proxied to that API, so nothing collides with
 * the servers you use for development. Both are reused if already up.
 *
 * Data: tests run against the local Postgres and the seeded *@test.com
 * accounts (password from E2E_PASSWORD, default matches SEED_PASSWORD in
 * backend/.env for local dev). e2e/global-setup.ts checks the accounts and
 * tops up the rows the flows need (a pending payout, an open ticket…).
 */
const WEB_PORT = 5199;
const API_PORT = 3101;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      command: 'npm run build && node dist/main',
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/api/public/settings`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}`,
        ENABLE_TELEGRAM_POLLING: 'false',
        ENABLE_SEED: 'false',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        VITE_API_BASE_URL: '/api',
        VITE_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
      },
    },
  ],
});
