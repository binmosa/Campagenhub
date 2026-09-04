import { test, expect, expectHero, expectNoRawKeys } from './fixtures';

test.describe('manager', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('manager');
  });

  test('dashboard shows clients, roster and reputation', async ({ page }) => {
    await page.goto('/dashboard');
    await expectHero(page, /Good (morning|afternoon|evening),/);
    await expect(page.locator('.v-hero-band [data-slot="kpi"], .v-hero-band .kpi').first()).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('every manager page opens on the shared anatomy', async ({ page }) => {
    for (const path of ['/dashboard/invitations', '/dashboard/workspace', '/dashboard/offers', '/dashboard/talent', '/dashboard/contracts', '/dashboard/payments', '/dashboard/messages', '/dashboard/ai']) {
      await page.goto(path);
      await expectHero(page);
      await expectNoRawKeys(page);
    }
  });

  test('profile edit round-trips the website field', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await expectHero(page, /Manager profile/i);
    await page.getByRole('button', { name: /edit profile/i }).first().click();
    const website = page.locator('input[inputmode="url"]').first();
    await expect(website).toBeVisible();
    const original = await website.inputValue();
    await website.fill('https://e2e.example.com');
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByRole('button', { name: /edit profile/i }).first()).toBeVisible();
    await expect(page.locator('body')).toContainText('e2e.example.com');

    await page.getByRole('button', { name: /edit profile/i }).first().click();
    await page.locator('input[inputmode="url"]').first().fill(original);
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByRole('button', { name: /edit profile/i }).first()).toBeVisible();
  });
});
