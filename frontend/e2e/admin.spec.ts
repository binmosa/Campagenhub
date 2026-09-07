import { test, expect, expectHero, expectNoRawKeys, confirmDialog, toast } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

const ADMIN_PAGES: [string, RegExp][] = [
  ['/dashboard', /Good (morning|afternoon|evening),/],
  ['/dashboard/users', /People on the platform/],
  ['/dashboard/campaigns', /Every campaign/],
  ['/dashboard/applications', /All applications/],
  ['/dashboard/payouts', /Payout desk/],
  ['/dashboard/roles', /Role studio/],
  ['/dashboard/support', /Support center/],
  ['/dashboard/site-control', /Site control/],
  ['/dashboard/telegram', /Telegram studio/],
  ['/dashboard/profile', /Your account/],
  ['/dashboard/follower-claims', /Follower claims/],
];

test.describe('admin', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('every admin page renders the hero anatomy', async ({ page }) => {
    for (const [path, h1] of ADMIN_PAGES) {
      await page.goto(path);
      await expectHero(page, h1);
      await expectNoRawKeys(page);
    }
  });

  test('overview surfaces the queues that need a human', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('.v-hero-band [data-slot="kpi"], .v-hero-band .kpi')).toHaveCount(4);
    await expect(page.getByRole('link', { name: /manage users/i })).toBeVisible();
    await expect(page.locator('text=Community mix')).toBeVisible();
  });

  /**
   * The back office is server-paged. These screens used to fetch whole
   * tables and slice them in the browser, so "Load more" only revealed rows
   * already downloaded — fine on seed data, fatal on a real database.
   */
  test('back-office lists are paged by the API, and the totals still count the whole table', async ({ page, request, baseURL }) => {
    const login = await request.post(`${baseURL}/api/auth/login`, { data: { email: ACCOUNTS.admin, password: PASSWORD } });
    const token = (await login.json()).access_token as string;
    const auth = { headers: { authorization: `Bearer ${token}` } };

    for (const path of ['users', 'campaigns', 'applications', 'payouts']) {
      const res = await request.get(`${baseURL}/api/admin/${path}?limit=2`, auth);
      expect(res.ok(), `${path} responds`).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.items), `${path} returns a page`).toBeTruthy();
      expect(body.items.length, `${path} respects limit`).toBeLessThanOrEqual(2);
      expect(typeof body.total, `${path} reports a total`).toBe('number');
      expect(body.total, `${path} total covers more than the page`).toBeGreaterThanOrEqual(body.items.length);
      expect(body.stats, `${path} carries whole-table stats`).toBeTruthy();
    }

    // a second page never repeats the first
    const first = await (await request.get(`${baseURL}/api/admin/payouts?limit=3&offset=0`, auth)).json();
    if (first.total > 3) {
      const second = await (await request.get(`${baseURL}/api/admin/payouts?limit=3&offset=3`, auth)).json();
      const ids = new Set(first.items.map((p: any) => p.id));
      expect(second.items.some((p: any) => ids.has(p.id)), 'pages must not overlap').toBeFalsy();
    }

    // and the browser asks for one page, then appends the next
    const calls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/admin/payouts')) calls.push(r.url().split('/api')[1]);
    });
    await page.goto('/dashboard/payouts');
    await expectHero(page, /Payout desk/);
    const rows = page.locator('ul > li.v-talent-card');
    await expect(rows.first()).toBeVisible();
    const shown = await rows.count();
    expect(calls.some((c) => c.includes('limit=')), 'the page requests a limit').toBeTruthy();

    const more = page.getByRole('button', { name: /load more/i });
    if (await more.count()) {
      await more.click();
      await expect.poll(() => rows.count(), { timeout: 10_000 }).toBeGreaterThan(shown);
      expect(calls.some((c) => /offset=[1-9]/.test(c)), 'load more asks for the next page').toBeTruthy();
    }
    await expectNoRawKeys(page);
  });

  test('users: role chips filter and KYC requirement round-trips with confirmation', async ({ page }) => {
    await page.goto('/dashboard/users');
    const rows = page.locator('ul > li.v-talent-card');
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();

    // The directory is server-paged, so a filter narrows the query rather
    // than the rendered array — assert what is true at any table size.
    await page.getByRole('button', { name: /^Brand/ }).click();
    await expect(rows.filter({ hasText: ACCOUNTS.brand })).toHaveCount(1);
    const roleChips = page.locator('ul > li.v-talent-card [data-slot="chip"]').filter({ hasText: /^(Creator|Brand|Manager)$/ });
    await expect(roleChips.filter({ hasText: 'Creator' })).toHaveCount(0);
    await page.getByRole('button', { name: /^All roles/ }).click();
    await expect(rows).toHaveCount(total);

    const row = rows.filter({ hasText: ACCOUNTS.creator2 });
    await row.getByRole('button', { name: /require kyc/i }).click();
    await confirmDialog(page, /^Require KYC$/);
    await expect(toast(page)).toContainText(/KYC now required/);
    await expect(row.getByRole('button', { name: /clear kyc/i })).toBeVisible();

    await row.getByRole('button', { name: /clear kyc/i }).click();
    await confirmDialog(page, /^Clear KYC$/);
    await expect(toast(page)).toContainText(/cleared/);
    await expect(row.getByRole('button', { name: /require kyc/i })).toBeVisible();
  });

  test('users: create-user modal opens, validates and closes', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.getByRole('button', { name: /create user/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[type="email"]')).toBeVisible();
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('campaigns: moderation cards, platform filter and brief modal', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    const cards = page.locator('article.v-talent-card');
    await expect(cards.first()).toBeVisible();
    await page.getByRole('button', { name: /YouTube/ }).click();
    await expect(cards.first()).toBeVisible();
    await page.getByRole('button', { name: /All platforms/ }).click();
    await cards.first().getByRole('button', { name: /^Open$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Brief/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /close campaign/i })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog).toBeHidden();
  });

  test('applications: pitch modal opens from a row', async ({ page }) => {
    await page.goto('/dashboard/applications');
    const rows = page.locator('ul > li.v-talent-card');
    await expect(rows.first()).toBeVisible();
    await rows.first().getByRole('button', { name: /^Open$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Pitch/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('payouts: approving a pending payout writes the audit trail', async ({ page }) => {
    await page.goto('/dashboard/payouts');
    await expectHero(page, /Payout desk/);
    await page.getByRole('radio', { name: /^Pending/ }).or(page.getByRole('tab', { name: /^Pending/ })).first().click();
    const pending = page.locator('li.v-talent-card').filter({ hasText: /Pending/ });
    await expect(pending.first()).toBeVisible();
    await pending.first().getByRole('button', { name: /^Approve$/ }).click();
    await confirmDialog(page, /^Approve$/);
    await expect(toast(page)).toContainText(/approved/);
    await expect(page.locator('ol li').filter({ hasText: /Approved payout/ }).first()).toBeVisible();
  });

  test('roles: create with the checklist editor, then delete', async ({ page }) => {
    const name = `E2E Role ${Date.now()}`;
    await page.goto('/dashboard/roles');
    await page.getByRole('button', { name: /new role/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/Content Moderator/).fill(name);
    const key = dialog.getByPlaceholder(/permission key/);
    await key.fill('can_run_e2e');
    await key.press('Enter');
    await expect(dialog.locator('code', { hasText: 'can_run_e2e' })).toBeVisible();
    await dialog.getByRole('button', { name: /^New role$/ }).click();
    await expect(toast(page)).toContainText(/created/);
    const card = page.locator('article.v-talent-card').filter({ hasText: name });
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: /delete role/i }).click();
    await confirmDialog(page, /delete role/i);
    await expect(toast(page)).toContainText(/deleted/);
    await expect(card).toHaveCount(0);
  });

  test('support: ticket status round-trips and validations queue renders', async ({ page }) => {
    await page.goto('/dashboard/support');
    await expectHero(page, /Support center/);
    await page.getByText(/^Tickets ·/).click();
    await page.getByText(/^Open ·/).click();
    const open = page.locator('li.v-talent-card').first();
    await expect(open).toBeVisible();
    await open.getByRole('button', { name: /mark in progress/i }).click();
    await expect(toast(page)).toContainText(/In progress/);
    await page.getByText(/^In progress ·/).click();
    const inProgress = page.locator('li.v-talent-card').first();
    await inProgress.getByRole('button', { name: /mark resolved/i }).click();
    await expect(toast(page)).toContainText(/Resolved/);
    await page.getByText(/^Resolved ·/).click();
    await page.locator('li.v-talent-card').first().getByRole('button', { name: /^Reopen$/ }).click();
    await expect(toast(page)).toContainText(/Open/);
    await page.getByText(/^Validations ·/).click();
    await expect(page.locator('li.v-talent-card, .v-empty').first()).toBeVisible();
  });

  test('site control: a toggle counts as unsaved and discard restores it', async ({ page }) => {
    await page.goto('/dashboard/site-control');
    await expect(page.getByText(/Everything is saved/).first()).toBeVisible();
    // the checkbox itself is visually hidden; the control span takes the click
    await page.locator('[data-slot="switch-control"]').nth(1).click();
    await expect(page.getByText(/1 unsaved changes/)).toBeVisible();
    await page.getByRole('button', { name: /^Discard$/ }).click();
    await expect(page.getByText(/Everything is saved/).first()).toBeVisible();
  });

  test('telegram: composer previews markdown', async ({ page }) => {
    await page.goto('/dashboard/telegram');
    await page.locator('textarea').fill('Hello **creators** — new _briefs_ dropped!');
    await expect(page.locator('strong', { hasText: 'creators' })).toBeVisible();
    await expect(page.locator('em', { hasText: 'briefs' })).toBeVisible();
    await expect(page.getByRole('button', { name: /send broadcast/i })).toBeEnabled();
  });
});
