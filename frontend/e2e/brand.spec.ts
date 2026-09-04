import { test, expect, expectHero, expectNoRawKeys } from './fixtures';

test.describe('brand', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('brand');
  });

  test('dashboard welcomes the company with KPIs', async ({ page }) => {
    await page.goto('/dashboard');
    await expectHero(page, /Welcome back/i);
    await expect(page.locator('.v-hero-band [data-slot="kpi"], .v-hero-band .kpi').first()).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('campaigns: cards render and the wizard opens and closes', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await expectHero(page, /campaigns/i);
    await expect(page.locator('article.v-talent-card').first()).toBeVisible();
    await page.getByRole('button', { name: /new campaign/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input').first()).toBeVisible();
    // the wizard guards against accidental dismissal, so close it explicitly
    await dialog.locator('[data-slot="modal-close-trigger"], button[aria-label="Close"]').first().click();
    await expect(dialog).toBeHidden();
  });

  test('ending a contract asks for confirmation first', async ({ page }) => {
    await page.goto('/dashboard/contracts');
    await expectHero(page, /contracts/i);
    const end = page.getByRole('button', { name: /end contract/i }).first();
    if (!(await end.count())) test.skip(true, 'no active contract to end');
    await end.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/end this contract/i);
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('applicant inbox, team, talent and insights pages open', async ({ page }) => {
    for (const path of ['/dashboard/applications', '/dashboard/my-team', '/dashboard/talent', '/dashboard/analytics', '/dashboard/contracts', '/dashboard/payments', '/dashboard/profile']) {
      await page.goto(path);
      await expectHero(page);
      await expectNoRawKeys(page);
    }
  });
});
