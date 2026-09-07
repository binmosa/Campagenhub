import { test, expect, expectHero, expectNoRawKeys } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

test.describe('brand', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('brand');
  });

  test('dashboard welcomes the company with KPIs', async ({ page }) => {
    await page.goto('/dashboard');
    await expectHero(page, /Welcome back/i);
    await expect(page.locator('.v-hero-band [data-slot="kpi"], .v-hero-band .kpi').first()).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('campaigns: cards render and the wizard opens and closes', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await expectHero(page, /campaigns/i);
    await expect(page.locator('article.v-talent-card').first()).toBeVisible();
    await page.getByRole('button', { name: /new campaign/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input').first()).toBeVisible();
    // the wizard guards against accidental dismissal, so close it explicitly
    await dialog.locator('[data-slot="modal-close-trigger"], button[aria-label="Close"]').first().click();
    await expect(dialog).toBeHidden();
  });

  test('ending a contract asks for confirmation first', async ({ page }) => {
    await page.goto('/dashboard/contracts');
    await expectHero(page, /contracts/i);
    const end = page.getByRole('button', { name: /end contract/i }).first();
    if (!(await end.count())) test.skip(true, 'no active contract to end');
    await end.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/end this contract/i);
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('payments: payee list with search, per-row pay and a multi-select batch with a total', async ({ page, request, baseURL }) => {
    await page.goto('/dashboard/payments');
    await expectHero(page, /payments/i);
    const rows = page.getByTestId('payee-row');
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total).toBeGreaterThan(1);
    await expect(page.locator('#payees')).not.toContainText(/\(Contract\)/);

    // search narrows the list
    const firstName = (await rows.first().locator('.v-ink').first().innerText()).trim();
    await page.getByPlaceholder(/search by name/i).fill(firstName);
    await expect(rows).toHaveCount(1);
    await page.getByPlaceholder(/search by name/i).fill('');
    await expect(rows).toHaveCount(total);

    // one person → modal lists their items and prices the button
    await rows.first().getByRole('button', { name: /^pay$/i }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(firstName);
    await expect(dialog.getByTestId('pay-amount')).toHaveCount(1);
    const agreed = Number(await dialog.getByTestId('pay-amount').inputValue());
    expect(agreed).toBeGreaterThan(0);
    // less than agreed is refused, more is a bonus
    await dialog.getByTestId('pay-amount').fill(String(agreed - 1));
    await expect(dialog.getByTestId('pay-short')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /send payment/i })).toBeDisabled();
    await dialog.getByTestId('pay-amount').fill(String(agreed + 25));
    await expect(dialog.getByTestId('pay-bonus')).toContainText('$25');
    await expect(dialog.getByRole('button', { name: new RegExp(`pay \\$${(agreed + 25).toLocaleString('en-US')}`, 'i') })).toBeEnabled();
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();

    // two people → one batch with the combined total
    const boxes = rows.getByRole('checkbox');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.getByRole('button', { name: /pay 2 people/i }).first().click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('pay-amount')).toHaveCount(2);
    const a0 = Number(await dialog.getByTestId('pay-amount').nth(0).inputValue());
    const a1 = Number(await dialog.getByTestId('pay-amount').nth(1).inputValue());
    expect(a0 + a1).toBeGreaterThan(0);
    await expect(dialog.getByTestId('pay-total')).toContainText('$');
    await expect(dialog.getByTestId('pay-short')).toHaveCount(0);
    await expect(dialog).toContainText(/one checkout/i);
    await dialog.getByRole('button', { name: /cancel/i }).click();

    // API: a batch records a parent plus one child per payee, and confirming the parent completes the children
    const login = await request.post(`${baseURL}/api/auth/login`, { data: { email: ACCOUNTS.brand, password: PASSWORD } });
    const auth = { Authorization: `Bearer ${(await login.json()).access_token}` };
    const contracts = await (await request.get(`${baseURL}/api/contracts/mine`, { headers: auth })).json();
    const payees = [...new Map(contracts.filter((c: any) => ['active', 'approved'].includes(c.status) && c.opponent_id).map((c: any) => [c.opponent_id, c])).values()].slice(0, 2) as any[];
    expect(payees.length).toBe(2);
    // the API refuses less than agreed, then accepts agreed + bonus
    const under = await request.post(`${baseURL}/api/payments/initiate-bulk`, {
      headers: auth,
      data: { items: payees.map((c: any) => ({ payeeId: c.opponent_id, amount: 1, applicationId: c.kind === 'addendum' ? undefined : c.id, campaignId: c.application?.campaign?.id })), paymentMethod: 'flutterwave' },
    });
    expect(under.status()).toBe(400);
    const agreedFor = async (payeeId: string) => {
      const all = contracts.filter((c: any) => ['active', 'approved'].includes(c.status) && c.opponent_id === payeeId);
      return all.reduce((sum: number, c: any) => sum + (Number(c.payment_amount) || 0), 0);
    };
    const items = [] as any[];
    for (const [n, c] of payees.entries()) items.push({ payeeId: c.opponent_id, amount: (await agreedFor(c.opponent_id)) + 10 + n, applicationId: c.kind === 'addendum' ? undefined : c.id, campaignId: c.application?.campaign?.id });
    const bulk = await request.post(`${baseURL}/api/payments/initiate-bulk`, { headers: auth, data: { items, paymentMethod: 'flutterwave' } });
    expect(bulk.ok(), await bulk.text()).toBeTruthy();
    const started = await bulk.json();
    expect(started.count).toBe(2);
    expect(started.total).toBe(Math.round(items.reduce((s: number, i: any) => s + i.amount, 0) * 100) / 100);
    // The payer does not get to declare their own payment successful: the
    // status is whatever the provider says on verification. Claiming
    // "successful" for a checkout that never cleared must leave the batch
    // exactly where it was, or a brand could fund payouts with nothing.
    const confirm = await request.post(`${baseURL}/api/payments/confirm`, { headers: auth, data: { txRef: started.batchRef, status: 'successful' } });
    expect(confirm.ok()).toBeTruthy();
    expect((await confirm.json()).status, 'an unverified payment must not complete itself').not.toBe('completed');

    const txs = await (await request.get(`${baseURL}/api/payments/transactions`, { headers: auth })).json();
    const children = txs.filter((x: any) => x.batch_ref === started.batchRef && !x.is_batch);
    expect(children).toHaveLength(2);
    expect(children.every((x: any) => x.status !== 'completed')).toBeTruthy();
    expect(children.reduce((s: number, x: any) => s + Number(x.amount), 0)).toBe(started.total);
    expect(txs.find((x: any) => x.tx_ref === started.batchRef)?.is_batch).toBeTruthy();
  });

  test('talent: a creator invite is a campaign invite, a manager invite is a hire', async ({ page, request, baseURL }) => {
    await page.goto('/dashboard/talent');
    await expectHero(page);
    const inviteButtons = page.getByRole('button', { name: /^invite$/i });
    await expect(inviteButtons.first()).toBeVisible();
    await inviteButtons.first().click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/to a campaign/i);
    await expect(dialog.locator('#invite-campaign')).toBeVisible();
    await expect(dialog).not.toContainText(/what they will manage/i);
    await expect(dialog.getByRole('button', { name: /send campaign invite/i })).toBeVisible();
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();

    const managersTab = page.getByRole('tab', { name: /managers/i });
    if (await managersTab.count()) await managersTab.click();
    else await page.getByRole('radio', { name: /managers/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.v-talent-card').first()).toContainText(/experience/i);
    await page.getByRole('button', { name: /^invite$/i }).first().click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/account manager/i);
    await expect(dialog).toContainText(/what they will manage/i);
    await expect(dialog.locator('#invite-campaign')).toHaveCount(0);
    await dialog.getByRole('button', { name: /cancel/i }).click();

    // API: a campaign invite, once accepted, signs the agreement and seeds the brief's tasks
    const login = async (email: string) => {
      const r = await request.post(`${baseURL}/api/auth/login`, { data: { email, password: PASSWORD } });
      return { Authorization: `Bearer ${(await r.json()).access_token}` };
    };
    const brand = await login(ACCOUNTS.brand);
    const creator = await login('creator5@test.com');
    const me = await (await request.get(`${baseURL}/api/auth/me`, { headers: creator })).json();
    const title = `E2E invite brief ${Date.now()}`;
    const camp = await (
      await request.post(`${baseURL}/api/campaigns`, {
        headers: brand,
        data: { title, description: 'Throwaway brief for the invite flow.', platforms: ['Instagram'], budget: 250, currency: 'USD', status: 'active', content_type: 'Reel', objective: 'Awareness', tasks: [{ title: 'Invite reel', platform: 'Instagram', due_days: 5 }] },
      })
    ).json();
    let contractId = '';
    try {
      const sent = await request.post(`${baseURL}/api/invitations`, { headers: brand, data: { receiver_id: me.userId, type: 'creator_collab', message: 'Join us', payment_amount: 250, payment_frequency: 'one_time', currency: 'USD', campaign_id: camp.id } });
      expect(sent.ok(), await sent.text()).toBeTruthy();
      const inv = await sent.json();
      const received = await (await request.get(`${baseURL}/api/invitations/received`, { headers: creator })).json();
      expect(received.find((x: any) => x.id === inv.id)?.campaign?.title).toBe(title);
      const accepted = await request.patch(`${baseURL}/api/invitations/${inv.id}/accept`, { headers: creator });
      expect(accepted.ok(), await accepted.text()).toBeTruthy();
      const apps = await (await request.get(`${baseURL}/api/applications?campaignId=${camp.id}`, { headers: brand })).json();
      expect(apps[0].status).toBe('accepted');
      expect(apps[0].contract.status).toBe('active');
      contractId = apps[0].contract.id;
      const tasks = await (await request.get(`${baseURL}/api/tasks/mine`, { headers: creator })).json();
      expect(tasks.some((x: any) => x.title === 'Invite reel' && x.contract_id === contractId)).toBeTruthy();
    } finally {
      if (contractId) await request.patch(`${baseURL}/api/contracts/${contractId}/end`, { headers: brand });
      await request.delete(`${baseURL}/api/campaigns/${camp.id}`, { headers: brand });
    }
  });

  test('applicant inbox, team, talent and insights pages open', async ({ page }) => {
    for (const path of ['/dashboard/applications', '/dashboard/my-team', '/dashboard/talent', '/dashboard/analytics', '/dashboard/contracts', '/dashboard/payments', '/dashboard/profile']) {
      await page.goto(path);
      await expectHero(page);
      await expectNoRawKeys(page);
    }
  });
});
