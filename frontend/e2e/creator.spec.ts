import { test, expect, expectHero, expectNoRawKeys } from './fixtures';

test.describe('creator', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('creator');
  });

  test('dashboard greets by first name with KPIs', async ({ page }) => {
    await page.goto('/dashboard');
    await expectHero(page, /Good (morning|afternoon|evening),/);
    await expect(page.locator('.v-hero-band [data-slot="kpi"], .v-hero-band .kpi').first()).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('campaign pages and money pages open on the shared anatomy', async ({ page }) => {
    for (const path of ['/dashboard/campaigns', '/dashboard/invitations', '/dashboard/workspace', '/dashboard/offers', '/dashboard/contracts', '/dashboard/payments', '/dashboard/messages', '/dashboard/ai']) {
      await page.goto(path);
      await expectHero(page);
      await expectNoRawKeys(page);
    }
  });

  test('profile: follower count with K unit saves and shows compact', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await expectHero(page, /Creator profile/i);
    await page.getByRole('button', { name: /edit profile/i }).first().click();

    const amount = page.locator('input[aria-label$=" Followers"]').first();
    await expect(amount).toBeVisible();
    const platform = (await amount.getAttribute('aria-label'))!.replace(' Followers', '');
    const original = { amount: await amount.inputValue(), unit: await page.locator('[role="radiogroup"]').first().locator('[aria-checked="true"], [data-active]').first().innerText().catch(() => 'K') };

    await amount.fill('77');
    const group = amount.locator('xpath=ancestor::*[.//*[@role="radiogroup"]][1]').locator('[role="radiogroup"]').first();
    await group.getByRole('radio', { name: /^K$/ }).click();
    await page.getByRole('button', { name: /save profile/i }).click();

    await expect(page.getByRole('button', { name: /edit profile/i }).first()).toBeVisible();
    await expect(page.locator('body')).toContainText('77K');

    // restore
    await page.getByRole('button', { name: /edit profile/i }).first().click();
    const again = page.locator(`input[aria-label="${platform} Followers"]`);
    await again.fill(original.amount || '0');
    const group2 = again.locator('xpath=ancestor::*[.//*[@role="radiogroup"]][1]').locator('[role="radiogroup"]').first();
    await group2.getByRole('radio', { name: new RegExp(`^${original.unit.trim().replace('×', '\\×')}$`) }).click().catch(() => {});
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByRole('button', { name: /edit profile/i }).first()).toBeVisible();
  });
});
