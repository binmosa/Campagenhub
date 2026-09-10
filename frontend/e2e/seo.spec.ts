import { test, expect } from '@playwright/test';

/**
 * Launch checklist: per-route meta, social card, robots/sitemap, cookie
 * banner. Uses the raw Playwright test (no fixtures) so the banner is NOT
 * pre-answered here.
 */
test.describe('seo + cookie banner', () => {
  test('home page carries title, description, canonical and social card', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Campaign Hubz/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /creators/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://campaignhubz.com/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const og = await page.request.get('/og-image.png');
    expect(og.ok()).toBeTruthy();
  });

  test('public routes override the meta and auth routes are noindex', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveTitle(/Open campaigns/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://campaignhubz.com/campaigns');
    await page.goto('/talent');
    await expect(page).toHaveTitle(/Creator directory/);
    await page.goto('/login');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', 'noindex');
    await page.goto('/no/such-page');
    await expect(page).toHaveTitle(/Page not found/);
  });

  test('robots.txt and sitemap.xml are served', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(await robots.text()).toMatch(/Disallow: \/dashboard/);
    const sitemap = await page.request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('https://campaignhubz.com/campaigns');
  });

  test('cookie banner shows once and remembers the answer', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByTestId('cookie-banner');
    await expect(banner).toBeVisible();
    await page.getByTestId('cookie-decline').click();
    await expect(banner).toBeHidden();
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('cookie-banner')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cookie_consent'))).toBe('declined');
  });
});
