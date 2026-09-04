import { test as base, expect, type Page } from '@playwright/test';
import { ACCOUNTS, APP_ROLE, PASSWORD, type Role } from './accounts';

/**
 * Shared fixtures.
 *
 *   loginAs(role)       — signs in through the API and primes localStorage the
 *                         way the login page does, so a test starts on the
 *                         dashboard without going through the form each time.
 *   consoleErrors       — every console error / page error seen during the
 *                         test; the auto-fixture fails the test if any leaked.
 *
 * Helpers: expectHero, expectNoRawKeys, toastText, confirmDialog.
 */
type Fixtures = {
  loginAs: (role: Role, opts?: { lang?: 'en' | 'am' }) => Promise<void>;
  consoleErrors: string[];
  /** Extra console-error patterns a test expects (e.g. a deliberate 401). Set with `test.use({ ignoreConsole: [/401/] })`. */
  ignoreConsole: RegExp[];
};

const IGNORED = [/favicon/i, /ResizeObserver loop/i, /net::ERR_ABORTED/i];

export const test = base.extend<Fixtures>({
  ignoreConsole: [[], { option: true }],
  consoleErrors: [
    async ({ page, ignoreConsole }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if ([...IGNORED, ...ignoreConsole].some((re) => re.test(text))) return;
        errors.push(text.slice(0, 300));
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
      await use(errors);
      expect(errors, 'no console errors during the test').toEqual([]);
    },
    { auto: true },
  ],
  loginAs: async ({ page, request, baseURL }, use) => {
    await use(async (role, opts) => {
      const res = await request.post(`${baseURL}/api/auth/login`, { data: { email: ACCOUNTS[role], password: PASSWORD } });
      expect(res.ok(), `login as ${role}`).toBeTruthy();
      const { access_token } = await res.json();
      await page.context().addInitScript(
        ({ token, appRole, lang }) => {
          localStorage.setItem('token', token);
          localStorage.setItem('role', appRole);
          localStorage.setItem('onboarding_completed', 'true');
          localStorage.setItem('lang', lang);
        },
        { token: access_token, appRole: APP_ROLE[role], lang: opts?.lang || 'en' },
      );
    });
  },
});

export { expect };

/** Every dashboard page opens with the gradient hero band and an h1. */
export const expectHero = async (page: Page, h1?: RegExp | string) => {
  await expect(page.locator('.v-hero-band')).toBeVisible();
  if (h1) await expect(page.locator('.v-hero-band h1')).toContainText(h1);
};

/** Untranslated keys look like `adm.users.title` — none may reach the DOM. */
export const expectNoRawKeys = async (page: Page) => {
  const text = await page.locator('body').innerText();
  const raw = text.match(/\b(adm|side|dash|cdash|mdash|common|board|apps|profile|cprof|mprof|social|shell)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) || [];
  expect(raw, 'raw i18n keys in page text').toEqual([]);
};

/** Text of the most recent toast strip. */
export const toast = (page: Page) => page.locator('[role="status"], [role="alert"]').last();

/** The shared ConfirmModal: press its confirm button by label. */
export const confirmDialog = async (page: Page, label: RegExp | string) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: label }).click();
};
