import { test, expect, expectNoRawKeys } from './fixtures';

test.describe('public site', () => {
  test('landing renders hero, nav and footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('campaign board lists live briefs', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('article.v-talent-card').first()).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('talent directory lists creators', async ({ page }) => {
    await page.goto('/talent');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('article.v-talent-card').first()).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('legal pages open', async ({ page }) => {
    await page.goto('/legal/terms');
    await expect(page.locator('h1').first()).toBeVisible();
    await page.goto('/legal/privacy');
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
