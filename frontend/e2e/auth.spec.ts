import { test, expect, expectHero, expectNoRawKeys } from './fixtures';
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

test.describe('expired session', () => {
  test.use({ ignoreConsole: [/401/] });

  test('a stale token sends you back to sign in with a reason', async ({ page }) => {
    await page.context().addInitScript(() => {
      // seed once — the app clears the token itself and must not find it again on /login
      if (sessionStorage.getItem('e2e-stale-seeded')) return;
      sessionStorage.setItem('e2e-stale-seeded', '1');
      localStorage.setItem('token', 'stale.token.value');
      localStorage.setItem('role', 'creator');
      localStorage.setItem('onboarding_completed', 'true');
    });
    await page.goto('/dashboard/campaigns');
    await expect(page).toHaveURL(/\/login\?expired=1/);
    await expect(page.getByRole('alert')).toContainText(/session expired/i);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});

/**
 * Password recovery. There was no way back into a locked-out account: the
 * sign-in page's "Forgot password?" pointed at nothing and no endpoint
 * existed behind it.
 */
test.describe('password recovery', () => {
  test('the reset request never reveals who has an account', async ({ request, baseURL }) => {
    const known = await request.post(`${baseURL}/api/auth/forgot-password`, { data: { email: ACCOUNTS.creator3 } });
    const unknown = await request.post(`${baseURL}/api/auth/forgot-password`, { data: { email: 'definitely-nobody@example.com' } });
    expect(known.status()).toBe(unknown.status());
    expect(await known.text()).toBe(await unknown.text());
  });

  test('a reset link is single-use, and a bad one is refused', async ({ request, baseURL }) => {
    const bad = await request.post(`${baseURL}/api/auth/reset-password`, {
      data: { email: ACCOUNTS.creator3, token: 'f'.repeat(64), password: 'BrandNewPass1' },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).message).toMatch(/expired or has already been used/i);

    const short = await request.post(`${baseURL}/api/auth/reset-password`, {
      data: { email: ACCOUNTS.creator3, token: 'f'.repeat(64), password: 'abc' },
    });
    expect(short.status()).toBe(400);
    expect((await short.json()).message).toMatch(/at least 8 characters/i);
  });

  test('the sign-in page links to recovery, and the form confirms without leaking', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot/i }).first().click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await page.getByLabel(/email/i).first().fill(ACCOUNTS.creator3);
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.locator('body')).toContainText(/reset link is on its way/i);
    await expectNoRawKeys(page);
  });

  test('an incomplete reset link says so instead of rendering nothing', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('body')).toContainText(/that link is incomplete/i);
    await expectNoRawKeys(page);
  });
});

/** An unknown URL used to match no route and render a blank document. */
test('an unknown path renders a real not-found page', async ({ page }) => {
  await page.goto('/this/route/does/not/exist');
  await expect(page.locator('body')).toContainText(/could not find that page/i);
  await expectNoRawKeys(page);
});
