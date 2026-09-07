import { test, expect, expectHero, expectNoRawKeys } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

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
    for (const path of ['/dashboard/campaigns', '/dashboard/invitations', '/dashboard/workspace', '/dashboard/offers', '/dashboard/talent', '/dashboard/contracts', '/dashboard/payments', '/dashboard/messages', '/dashboard/ai']) {
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

/**
 * The money side of an engagement.
 *
 * A manager is a service provider: nothing opens until a brand accepts one
 * of their offers, and what the brand grants then — how many briefs, how
 * much budget — is enforced on every write. A campaign's own budget is the
 * second ceiling: no contract may commit more than the brief holds.
 */
test.describe('manager engagements', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('manager');
  });

  test('a brand caps what the manager may create, and contracts stay inside the campaign budget', async ({ page, request, baseURL }) => {
    const api = (path: string) => `${baseURL}/api${path}`;
    const login = async (email: string) => {
      const r = await request.post(api('/auth/login'), { data: { email, password: PASSWORD } });
      expect(r.ok(), `login ${email}`).toBeTruthy();
      const body = await r.json();
      return { token: body.access_token as string, id: body.user?.id as string };
    };
    const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
    const brief = (title: string, budget: number) => ({
      title, description: 'Opened by the Playwright suite.', platforms: ['TikTok'], status: 'active',
      budget, currency: 'USD', content_type: 'Reel', objective: 'Awareness',
    });

    const brand = await login(ACCOUNTS.brand);
    const manager = await login(ACCOUNTS.manager);
    const creator = await login(ACCOUNTS.creator2);

    // Usage is counted from the campaigns still on file, so clear the ones a
    // previous run left behind before pinning a limit of one.
    const managerCampaigns = await (await request.get(api('/campaigns/mine'), auth(manager.token))).json();
    for (const c of managerCampaigns as any[]) {
      if (c?.created_by?.id === manager.id) await request.delete(api(`/campaigns/${c.id}`), auth(brand.token));
    }

    const made: string[] = [];
    try {
      // 1. the brand posts a brief and the manager offers to run it
      const posted = await request.post(api('/campaigns'), { ...auth(brand.token), data: brief(`E2E brand brief ${Date.now()}`, 1000) });
      expect(posted.status(), await posted.text()).toBe(201);
      const campaign = await posted.json();
      made.push(campaign.id);

      const offered = await request.post(api('/manager-applications'), {
        ...auth(manager.token),
        data: { campaignId: campaign.id, pitch: 'I would source, brief and report on this end to end.', proposed_fee: 400, currency: 'USD', fee_frequency: 'one_time' },
      });
      expect(offered.status(), await offered.text()).toBe(201);
      const offer = await offered.json();
      expect(offer.status).toBe('pending');

      // the brand sees it in their inbox
      const inbox = await (await request.get(api('/manager-applications?status=pending'), auth(brand.token))).json();
      expect((inbox as any[]).some((o) => o.id === offer.id)).toBeTruthy();

      // 2. the brand accepts and sets the grant: one campaign, $1,500
      const decided = await request.patch(api(`/manager-applications/${offer.id}/decide`), {
        ...auth(brand.token),
        data: {
          action: 'accept', campaign_limit: 1, budget_cap: 1500,
          permissions: { can_add_campaigns: true, can_manage_applications: true },
          payment_amount: 400, currency: 'USD', payment_frequency: 'one_time',
        },
      });
      expect(decided.status(), await decided.text()).toBe(200);
      expect((await decided.json()).status).toBe('accepted');

      // the grant only reaches the manager's claims on a fresh sign-in
      const engaged = await login(ACCOUNTS.manager);

      // 3. the grant is enforced on create — budget first, then the count
      const tooRich = await request.post(api('/campaigns'), { ...auth(engaged.token), data: { ...brief('E2E over cap', 2000), brand_id: brand.id } });
      expect(tooRich.status()).toBe(400);
      expect((await tooRich.json()).message).toMatch(/capped you at 1,500/);

      const withinGrant = await request.post(api('/campaigns'), { ...auth(engaged.token), data: { ...brief(`E2E manager brief ${Date.now()}`, 1000), brand_id: brand.id } });
      expect(withinGrant.status(), await withinGrant.text()).toBe(201);
      const managed = await withinGrant.json();
      made.push(managed.id);

      const tooMany = await request.post(api('/campaigns'), { ...auth(engaged.token), data: { ...brief('E2E over count', 50), brand_id: brand.id } });
      expect(tooMany.status()).toBe(400);
      expect((await tooMany.json()).message).toMatch(/used all 1 campaign/);

      // 4. the campaign's own budget caps the contract the brand may offer
      const applied = await request.post(api('/applications'), { ...auth(creator.token), data: { campaignId: managed.id, pitch: 'Happy to shoot this.' } });
      expect(applied.status(), await applied.text()).toBe(201);
      const applicationId = (await applied.json()).id;

      const overBudget = await request.patch(api(`/applications/${applicationId}/payment-schedule`), {
        ...auth(brand.token),
        data: { payment_amount: 1500, currency: 'USD', payment_frequency: 'one_time', payment_day: 1 },
      });
      expect(overBudget.status()).toBe(400);
      expect((await overBudget.json()).message).toMatch(/budget is USD 1,000/);

      const inBudget = await request.patch(api(`/applications/${applicationId}/payment-schedule`), {
        ...auth(brand.token),
        data: { payment_amount: 900, currency: 'USD', payment_frequency: 'one_time', payment_day: 1 },
      });
      expect(inBudget.status(), await inBudget.text()).toBe(200);

      // 5. the manager's own page reads the grant back
      await page.goto('/dashboard/campaigns');
      await expectHero(page, /Campaigns/i);
      const row = page.getByTestId('engagement-row').first();
      await expect(row).toContainText('1 of 1 campaigns created');
      await expect(row).toContainText(/\$1k of \$1\.5k used/);
      await expect(page.getByTestId('managed-campaign').first()).toBeVisible();
      await expectNoRawKeys(page);
    } finally {
      for (const id of made.reverse()) await request.delete(api(`/campaigns/${id}`), auth(brand.token));
    }
  });
});

test.describe('manager with no brand', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('manager2');
  });

  test('cannot reach the talent directory until a brand engages them', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await expectHero(page);
    // the directory is not even offered in the sidebar
    await expect(page.getByRole('link', { name: 'Talent', exact: true })).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/talent directory and campaign creation open with your first engagement/i);

    // and the page itself explains how to open it
    await page.goto('/dashboard/talent');
    await expectHero(page);
    await expect(page.locator('body')).toContainText(/opens with your first brand/i);
    await expectNoRawKeys(page);
  });
});
