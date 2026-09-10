import { expect, test, expectNoRawKeys } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

/**
 * Creator onboarding — a brand-new creator is sent to /onboarding after
 * signup, walks four steps (about · channels · follow & share · done) and
 * lands on the simplified starter home. Existing creators (seeded, with
 * channels already on file) skip it entirely.
 */
test.describe('creator onboarding', () => {
  test('a new creator is guided through setup and lands on the starter home', async ({ page, request, baseURL }) => {
    const stamp = Date.now();
    const email = `onb-${stamp}@test.com`;
    const handle = `sara${stamp}`;
    // Signup is email + password only for creators; the profile is empty until onboarding.
    const reg = await request.post(`${baseURL}/api/auth/register`, { data: { email, password: PASSWORD, role: 'creator', profile: {} } });
    expect(reg.ok(), 'register a fresh creator').toBeTruthy();

    // Signing in through the form sends an unfinished creator to /onboarding.
    await page.goto('/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/onboarding$/);
    await expect(page.getByTestId('onb-step-about')).toBeVisible();
    await expectNoRawKeys(page);

    // 1 · about — name, live-checked handle, location, phone with dial code.
    await page.getByTestId('onb-next').click();
    await expect(page.getByTestId('onb-error')).toContainText(/first name/i);
    await page.getByTestId('onb-first').fill('Sara');
    await page.getByTestId('onb-username').fill('linaeats'); // the seeded creator's handle
    await expect(page.getByTestId('onb-handle-hint')).toHaveAttribute('data-status', 'bad');
    await expect(page.getByTestId('onb-handle-hint')).toContainText(/already taken/i);
    await page.getByTestId('onb-username').fill(handle);
    await expect(page.getByTestId('onb-handle-hint')).toHaveAttribute('data-status', 'ok');
    await expect(page.getByTestId('onb-handle-hint')).toContainText(/available/i);

    // The cascade's closed state is a plain div: click the placeholder text, then type + Enter.
    const choose = async (placeholder: string, option: string) => {
      await page.getByText(placeholder, { exact: true }).first().click();
      const box = page.getByRole('textbox', { name: placeholder });
      await box.fill(option);
      await box.press('Enter');
    };
    await choose('Country', 'Ethiopia');
    await choose('State / region', 'Addis Ababa');
    await choose('City', 'Addis Ababa');
    // Picking Ethiopia set the dial code to +251 automatically.
    await expect(page.getByTestId('onb-dial')).toContainText('+251');
    await page.getByTestId('onb-phone').fill('911223344');
    await page.getByTestId('onb-next').click();

    // 2 · agreement — one tick for everything; Continue stays disabled until it is ticked.
    await expect(page.getByTestId('onb-step-terms')).toBeVisible();
    await expect(page.getByTestId('onb-terms-text')).toContainText(/Creator Agreement|Acceptance of these terms/);
    await expect(page.getByTestId('onb-terms-text')).toContainText(/audience verification/i);
    await expect(page.getByTestId('onb-next')).toBeDisabled();
    await page.getByTestId('onb-terms-agree').click();
    await expect(page.getByTestId('onb-next')).toBeEnabled();
    await page.getByTestId('onb-next').click();

    // 3 · platforms — tap a tile, type only the name after the prefix; a tick reuses the FIRST
    // social handle typed (not the Campaign Hubz handle) on every platform switched on after it.
    await expect(page.getByTestId('onb-step-platforms')).toBeVisible();
    await page.getByTestId('onb-next').click();
    await expect(page.getByTestId('onb-error')).toContainText(/at least one/i);
    await page.getByRole('button', { name: 'Music' }).click();
    await page.getByTestId('onb-platform-instagram').click();
    await expect(page.getByTestId('onb-same-handle')).toHaveCount(0); // nothing typed yet
    await page.getByTestId('onb-handle-instagram').fill('binmosa');
    await expect(page.getByTestId('onb-same-handle')).toContainText('Use binmosa for all');
    await page.getByTestId('onb-same-handle').click();
    await page.getByTestId('onb-platform-tiktok').click();
    await page.getByTestId('onb-platform-linkedin').click();
    await expect(page.getByTestId('onb-handles')).toContainText('linkedin.com/in/');
    await expect(page.getByTestId('onb-handle-tiktok')).toHaveValue('binmosa');
    await expect(page.getByTestId('onb-handle-linkedin')).toHaveValue('binmosa');
    await page.getByTestId('onb-handle-tiktok').fill('@sara.et'); // still editable; leading @ is stripped
    await expect(page.getByTestId('onb-handle-tiktok')).toHaveValue('sara.et');
    await page.getByTestId('onb-next').click();

    // Follow & share is off by default (admin switch), so this is the last step.
    await expect(page.getByTestId('onb-step-done')).toBeVisible();
    await expect(page.getByTestId('onb-telegram')).toBeVisible();
    await page.getByTestId('onb-finish').click();
    await page.waitForURL(/\/dashboard$/);
    const cta = page.getByTestId('starter-cta');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('data-kind', 'wait');
    await expect(page.getByTestId('starter-steps').locator('li[data-status="done"]')).toHaveCount(1);
    await expect(page.getByTestId('starter-steps')).not.toContainText(/welcome post/i);
    await expectNoRawKeys(page);

    // Finished creators cannot land back in onboarding by deep link.
    await page.goto('/onboarding');
    await page.waitForURL(/\/dashboard$/);

    // The full board is one click away and remembered.
    await page.getByTestId('starter-show-full').click();
    await expect(page.getByTestId('starter-show-simple')).toBeVisible();
    await expect(page.locator('.v-hero-band h1')).toBeVisible();

    // What got saved: profile fields, E.164 phone, three link-only channels in the admin queue.
    const admin = await request.post(`${baseURL}/api/auth/login`, { data: { email: ACCOUNTS.admin, password: PASSWORD } });
    const { access_token } = await admin.json();
    const headers = { Authorization: `Bearer ${access_token}` };
    const claims = await (await request.get(`${baseURL}/api/creators/admin/follower-claims?status=pending`, { headers })).json();
    const mine = claims.filter((c: any) => c.username === handle);
    expect(mine.map((c: any) => c.url).sort()).toEqual(['https://instagram.com/binmosa', 'https://linkedin.com/in/binmosa', 'https://tiktok.com/@sara.et'].sort());
    expect(mine.every((c: any) => c.has_count === false)).toBeTruthy();
    const login = await request.post(`${baseURL}/api/auth/login`, { data: { email, password: PASSWORD } });
    const token = (await login.json()).access_token;
    const profile = await (await request.get(`${baseURL}/api/creators/profile`, { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(profile).toMatchObject({ first_name: 'Sara', username: handle, country_code: 'ET', city: 'Addis Ababa', phone: '+251911223344', category: 'Music' });
    // The legal record: version + timestamp on the user.
    const me = await (await request.get(`${baseURL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(me.terms_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(me.terms_accepted_at).toBeTruthy();
  });

  test('a creator who skipped the agreement cannot finish onboarding', async ({ request, baseURL }) => {
    const email = `onb-noterms-${Date.now()}@test.com`;
    const reg = await request.post(`${baseURL}/api/auth/register`, { data: { email, password: PASSWORD, role: 'creator', profile: {} } });
    const token = (await reg.json()).access_token;
    const headers = { Authorization: `Bearer ${token}` };
    await request.post(`${baseURL}/api/creators/profile`, { headers, data: { social_links: JSON.stringify({ instagram: { url: 'https://instagram.com/noterms' } }) } });
    const done = await request.post(`${baseURL}/api/creators/onboarding/complete`, { headers });
    expect(done.status()).toBe(400);
    expect((await done.json()).message).toMatch(/agreement/i);
  });

  test('a creator who already has channels skips onboarding', async ({ page, loginAs }) => {
    await loginAs('creator');
    await page.goto('/dashboard');
    await expect(page.locator('.v-hero-band h1')).toBeVisible();
    await expect(page).not.toHaveURL(/onboarding/);
    await page.goto('/onboarding');
    await page.waitForURL(/\/dashboard$/);
  });
});
