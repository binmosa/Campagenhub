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

/**
 * A fresh deploy used to claim Nike, Adidas and Apple as customers, quote
 * 12,847 creators and $2.4M paid, and list a 555 phone number — all seeded
 * defaults, none of it true. Nothing on the public site may assert a
 * customer, a figure or a contact detail the platform cannot evidence.
 */
test('the public site makes no claim it cannot back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.v-hero-band, h1').first()).toBeVisible();
  const text = await page.locator('body').innerText();

  const brands = ['Nike', 'Adidas', 'Apple', 'Microsoft', 'Spotify', 'LVMH', 'Gymshark', 'Sephora', 'Glossier'];
  for (const brand of brands) {
    expect(text, `"${brand}" must not appear as a customer`).not.toContain(brand);
  }
  for (const figure of ['12,847', '$2.4M', '1.8B', '1,287 collabs']) {
    expect(text, `the invented figure ${figure} must be gone`).not.toContain(figure);
  }
  for (const contact of ['555) 123-4567', 'campgainshub.com', 'San Francisco, CA']) {
    expect(text, `the placeholder contact ${contact} must be gone`).not.toContain(contact);
  }
});
