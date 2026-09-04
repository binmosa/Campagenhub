import { test, expect, expectHero } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

test.describe('authentication — rejected login', () => {
  // the 401 from the API is the point of this test, not a regression
  test.use({ ignoreConsole: [/401/] });

  test('wrong password is rejected on the login form', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ACCOUNTS.creator);
    await page.locator('input[type="password"]').fill('definitely-not-it');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});

test.describe('authentication', () => {
  test('login form signs a creator in and lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ACCOUNTS.creator);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expectHero(page);
    expect(await page.evaluate(() => localStorage.getItem('role'))).toBe('creator');
  });

  test('sign out clears the session and returns to the public site', async ({ page, loginAs }) => {
    await loginAs('brand');
    await page.goto('/dashboard');
    await expectHero(page);
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).not.toHaveURL(/\/dashboard/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('a signed-out visitor is sent to login from the dashboard', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await expect(page).toHaveURL(/\/login/);
  });
});
