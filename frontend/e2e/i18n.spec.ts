import { test, expect, expectHero, expectNoRawKeys } from './fixtures';
import type { Role } from './accounts';

/**
 * Amharic sweep — every role's pages must render with no untranslated key
 * leaking into the page text, and the hero heading itself must be in
 * Amharic (Ethiopic script), which catches hard-coded English titles.
 */
const PAGES: Record<Role, string[]> = {
  admin: ['/dashboard', '/dashboard/users', '/dashboard/campaigns', '/dashboard/applications', '/dashboard/payouts', '/dashboard/roles', '/dashboard/support', '/dashboard/site-control', '/dashboard/telegram', '/dashboard/profile'],
  brand: ['/dashboard', '/dashboard/campaigns', '/dashboard/applications', '/dashboard/profile', '/dashboard/workspace', '/dashboard/offers', '/dashboard/contracts', '/dashboard/payments', '/dashboard/messages', '/dashboard/analytics', '/dashboard/ai', '/dashboard/my-team'],
  creator: ['/dashboard', '/dashboard/campaigns', '/dashboard/profile', '/dashboard/payments', '/dashboard/invitations', '/dashboard/workspace', '/dashboard/offers', '/dashboard/contracts'],
  manager: ['/dashboard', '/dashboard/profile', '/dashboard/invitations', '/dashboard/offers', '/dashboard/messages'],
  support: ['/dashboard'],
  finance: ['/dashboard'],
  creator2: [],
};

const ETHIOPIC = /[ሀ-፿]/;

for (const [role, paths] of Object.entries(PAGES) as [Role, string[]][]) {
  if (!paths.length) continue;
  test(`${role} pages in Amharic have no raw keys and an Amharic hero`, async ({ page, loginAs }) => {
    await loginAs(role, { lang: 'am' });
    for (const path of paths) {
      await page.goto(path);
      await expectHero(page);
      await expectNoRawKeys(page);
      const h1 = await page.locator('.v-hero-band h1').innerText();
      expect(h1, `${role} ${path} hero should be in Amharic, got "${h1}"`).toMatch(ETHIOPIC);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('am');
    }
  });
}
