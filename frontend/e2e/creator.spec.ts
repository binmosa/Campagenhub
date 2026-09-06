import { test, expect, expectHero, expectNoRawKeys } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

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
    for (const path of ['/dashboard/campaigns', '/dashboard/applications', '/dashboard/invitations', '/dashboard/workspace', '/dashboard/offers', '/dashboard/contracts', '/dashboard/payments', '/dashboard/messages']) {
      await page.goto(path);
      await expectHero(page);
      await expectNoRawKeys(page);
    }
  });

  test('AI Studio is hidden for creators and a deep link goes home', async ({ page }) => {
    await page.goto('/dashboard');
    await expectHero(page);
    await expect(page.locator('nav, aside').getByRole('link', { name: /ai studio/i })).toHaveCount(0);
    await page.goto('/dashboard/ai');
    await expect(page).toHaveURL(/\/dashboard\/?$/);
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

  test('apply form asks for a written pitch, and a video pitch link only when the brief asks', async ({ page, request, baseURL }) => {
    // the brand owner posts a throwaway brief through the API and flips its apply setting
    const login = await request.post(`${baseURL}/api/auth/login`, { data: { email: ACCOUNTS.brand, password: PASSWORD } });
    const brandAuth = { Authorization: `Bearer ${(await login.json()).access_token}` };
    const title = `E2E video pitch brief ${Date.now()}`;
    const created = await request.post(`${baseURL}/api/campaigns`, {
      headers: brandAuth,
      data: { title, description: 'Throwaway brief used by the e2e suite.', platforms: ['Instagram'], budget: 500, currency: 'USD', status: 'active', video_pitch: 'required', content_type: 'Video', objective: 'Awareness' },
    });
    expect(created.ok(), 'brief created').toBeTruthy();
    const brief = await created.json();
    const setMode = (video_pitch: string) => request.patch(`${baseURL}/api/campaigns/${brief.id}`, { headers: brandAuth, data: { video_pitch } });
    const openApply = async () => {
      await page.goto('/dashboard/campaigns?tab=browse');
      await expectHero(page);
      await page.locator('article.v-talent-card', { hasText: title }).getByRole('button', { name: /^apply$/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      return dialog;
    };

    try {
      let dialog = await openApply();
      await expect(dialog.locator('#apply-pitch')).toBeVisible();
      await expect(dialog.locator('#apply-video')).toBeVisible();
      await expect(dialog).toContainText(/video pitch link \(required\)/i);
      await expect(dialog.getByText(/ai pitch/i)).toHaveCount(0);
      await expect(dialog.locator('video, [aria-label*="record" i]')).toHaveCount(0);
      // the form itself refuses a non-link before anything reaches the API
      await dialog.locator('#apply-pitch').fill('I make daily streetwear fits for a Dakar audience.');
      await dialog.locator('#apply-video').fill('not a link');
      await dialog.getByRole('button', { name: /confirm|send/i }).click();
      await expect(dialog.getByRole('alert')).toContainText(/full video link/i);
      await dialog.getByRole('button', { name: /cancel/i }).click();
      await expect(dialog).toBeHidden();

      await setMode('none');
      dialog = await openApply();
      await expect(dialog.locator('#apply-pitch')).toBeVisible();
      await expect(dialog.locator('#apply-video')).toHaveCount(0);
      await dialog.getByRole('button', { name: /cancel/i }).click();
    } finally {
      await request.delete(`${baseURL}/api/campaigns/${brief.id}`, { headers: brandAuth });
    }
  });
});
