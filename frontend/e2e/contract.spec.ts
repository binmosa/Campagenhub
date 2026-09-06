import { test, expect, expectHero } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

/**
 * The agreement flow: the brand sends a contract (nothing is final), the
 * creator reads it with both parties named and counters, the brand accepts
 * the counter and only then does the application become accepted, the
 * contract active and the creator a team member.
 */
test.describe('contract flow', () => {
  test('brand sends, creator counters, brand accepts the counter, then it locks in', async ({ page, request, baseURL, loginAs }) => {
    const auth = async (email: string) => {
      const r = await request.post(`${baseURL}/api/auth/login`, { data: { email, password: PASSWORD } });
      expect(r.ok(), `login ${email}`).toBeTruthy();
      return { Authorization: `Bearer ${(await r.json()).access_token}` };
    };
    const brand = await auth(ACCOUNTS.brand);
    const creator = await auth(ACCOUNTS.creator3);
    const title = `E2E contract brief ${Date.now()}`;
    const camp = await (
      await request.post(`${baseURL}/api/campaigns`, {
        headers: brand,
        data: { title, description: 'Throwaway brief for the contract flow.', platforms: ['Instagram'], budget: 300, currency: 'USD', status: 'active', content_type: 'Reel', objective: 'Awareness' },
      })
    ).json();
    let contractId = '';

    try {
      const app = await (await request.post(`${baseURL}/api/applications`, { headers: creator, data: { campaignId: camp.id, pitch: 'Two reels in a week.' } })).json();
      expect(app.id).toBeTruthy();

      // accepting without a contract is refused
      const direct = await request.patch(`${baseURL}/api/applications/${app.id}/status`, { headers: brand, data: { status: 'accepted' } });
      expect(direct.status()).toBe(400);

      // the draft names both parties with their account emails
      const draft = await (await request.get(`${baseURL}/api/contracts/application/${app.id}/draft?payment_amount=250&currency=USD&payment_frequency=one_time`, { headers: brand })).json();
      expect(draft.terms).toContain(ACCOUNTS.brand);
      expect(draft.terms).toContain(ACCOUNTS.creator3);
      expect(draft.terms).toMatch(/USD 250/);

      const sent = await request.patch(`${baseURL}/api/applications/${app.id}/payment-schedule`, {
        headers: brand,
        data: { payment_amount: 250, currency: 'USD', payment_frequency: 'one_time', payment_day: 1, notes: 'Two reels', terms: draft.terms },
      });
      expect(sent.ok()).toBeTruthy();
      expect((await sent.json()).status).toBe('offered');

      // creator: reads the agreement and counters from the UI
      await loginAs('creator3');
      await page.goto('/dashboard/applications');
      await expectHero(page);
      const card = page.locator('article.v-talent-card', { hasText: title });
      await expect(card).toContainText(/contract sent/i);
      await expect(card).toContainText('$250');
      await card.getByRole('button', { name: /review contract/i }).click();
      const dialog = page.getByRole('dialog').first();
      await expect(dialog.getByTestId('agreement-text')).toContainText(ACCOUNTS.brand);
      await expect(dialog.getByTestId('agreement-text')).toContainText(ACCOUNTS.creator3);
      await expect(dialog).toContainText('$250');
      await expect(dialog.getByRole('button', { name: /sign & accept|accept & sign/i })).toBeVisible();
      await dialog.getByRole('button', { name: /^counter-offer$/i }).click();
      await dialog.locator('#counter-amount').fill('300');
      await dialog.locator('#counter-note').fill('Two reels plus a story set.');
      await dialog.getByRole('button', { name: /send counter-offer/i }).click();
      await expect(dialog).toContainText(/counter-offer sent/i);
      await dialog.getByRole('button', { name: /^close$/i }).last().click();

      // brand: sees the counter and accepts it — that locks the agreement
      await loginAs('brand');
      await page.goto(`/dashboard/applications?campaign=${camp.id}`);
      await expectHero(page);
      const bcard = page.locator('article.v-talent-card', { hasText: title });
      await expect(bcard).toContainText(/counter-offer/i);
      await bcard.getByRole('button', { name: /^(open|review)$/i }).click();
      await page.getByRole('dialog').first().getByRole('button', { name: /review counter-offer/i }).click();
      const contractDialog = page.getByRole('dialog').last();
      await expect(contractDialog).toContainText('$300');
      await contractDialog.getByRole('button', { name: /accept counter-offer/i }).click();
      await page.getByRole('dialog').last().getByRole('button', { name: /accept & activate/i }).click();
      await expect(page.getByRole('dialog').last()).toContainText(/counter-offer accepted/i);

      // API: accepted, active, amended, on the team
      const apps = await (await request.get(`${baseURL}/api/applications?campaignId=${camp.id}`, { headers: brand })).json();
      expect(apps[0].status).toBe('accepted');
      expect(Number(apps[0].payment_amount)).toBe(300);
      expect(apps[0].contract.status).toBe('active');
      expect(apps[0].contract.terms).toContain('AMENDMENT');
      contractId = apps[0].contract.id;
      const team = await (await request.get(`${baseURL}/api/invitations/team`, { headers: brand })).json();
      expect(team.some((m: any) => m.member?.email === ACCOUNTS.creator3 && Number(m.payment_amount) === 300)).toBeTruthy();
    } finally {
      if (contractId) await request.patch(`${baseURL}/api/contracts/${contractId}/end`, { headers: brand });
      await request.delete(`${baseURL}/api/campaigns/${camp.id}`, { headers: brand });
    }
  });

  test('signing seeds the brief\'s tasks and both workspaces group them by campaign', async ({ page, request, baseURL, loginAs }) => {
    const auth = async (email: string) => {
      const r = await request.post(`${baseURL}/api/auth/login`, { data: { email, password: PASSWORD } });
      expect(r.ok(), `login ${email}`).toBeTruthy();
      return { Authorization: `Bearer ${(await r.json()).access_token}` };
    };
    const brand = await auth(ACCOUNTS.brand);
    const creator = await auth(ACCOUNTS.creator3);
    const title = `E2E tasks brief ${Date.now()}`;
    const until = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    const camp = await (
      await request.post(`${baseURL}/api/campaigns`, {
        headers: brand,
        data: {
          title,
          description: 'Throwaway brief for the tasks flow.',
          platforms: ['Instagram', 'TikTok'],
          budget: 300,
          currency: 'USD',
          status: 'active',
          content_type: 'Reel',
          objective: 'Awareness',
          tasks: [
            { key: 'reel', title: 'Instagram Reel featuring the drop', platform: 'Instagram', due_days: 7, description: '30-60s, tag the brand.' },
            { key: 'story', title: 'Three story frames', platform: 'Instagram', due_days: 10 },
          ],
          tasks_public: true,
        },
      })
    ).json();
    let contractId = '';

    try {
      // the brief lists its deliverables publicly
      const pub = await (await request.get(`${baseURL}/api/campaigns/public-list?limit=5`, { headers: creator })).json();
      expect(pub.items.find((c: any) => c.id === camp.id)?.tasks).toHaveLength(2);

      const app = await (await request.post(`${baseURL}/api/applications`, { headers: creator, data: { campaignId: camp.id, pitch: 'On it.' } })).json();
      // recurring money needs an end date
      const noEnd = await request.get(`${baseURL}/api/contracts/application/${app.id}/draft?payment_amount=200&currency=USD&payment_frequency=monthly&payment_day=5`, { headers: brand });
      expect(noEnd.status()).toBe(400);
      const draft = await (await request.get(`${baseURL}/api/contracts/application/${app.id}/draft?payment_amount=200&currency=USD&payment_frequency=monthly&payment_day=5&ends_at=${until}`, { headers: brand })).json();
      expect(draft.terms).toContain(until);
      const sent = await request.patch(`${baseURL}/api/applications/${app.id}/payment-schedule`, {
        headers: brand,
        data: { payment_amount: 200, currency: 'USD', payment_frequency: 'monthly', payment_day: 5, ends_at: until, terms: draft.terms },
      });
      expect(sent.ok()).toBeTruthy();
      const signed = await (await request.put(`${baseURL}/api/contracts/application/${app.id}/respond`, { headers: creator, data: { action: 'accept' } })).json();
      expect(signed.status).toBe('active');
      expect(signed.ends_at).toBe(until);
      contractId = signed.id;

      // creator workspace: one panel for the campaign with the two seeded tasks
      await loginAs('creator3');
      await page.goto('/dashboard/workspace');
      await expectHero(page);
      const panel = page.locator(`#ws-${contractId}`);
      await expect(panel).toContainText(title);
      await expect(panel.getByTestId('task-item')).toHaveCount(2);
      await expect(panel).toContainText(/from the brief/i);
      await panel.getByTestId('task-item').first().getByRole('button', { name: /^start$/i }).click();
      await expect(panel.getByTestId('task-item').first()).toContainText(/in progress/i);

      // brand workspace: the deep link opens the assign modal scoped to that contract, and the panel shows the same tasks
      await loginAs('brand');
      await page.goto(`/dashboard/workspace?contract=${contractId}`);
      await expectHero(page);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('select').first()).toContainText(title);
      await dialog.locator('#task-title').fill('Bonus TikTok teaser');
      await dialog.getByRole('button', { name: /^assign$/i }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator(`#ws-${contractId}`).getByTestId('task-item')).toHaveCount(3);
      await expect(page.locator(`#ws-${contractId}`)).toContainText(/until/i);

      // API rules: submitted work cannot be deleted by the brand, the creator can withdraw and resubmit, approval locks it
      const mine = await (await request.get(`${baseURL}/api/tasks/mine`, { headers: creator })).json();
      const task = mine.find((x: any) => x.contract_id === contractId && x.status === 'in_progress');
      expect(task).toBeTruthy();
      expect((await request.patch(`${baseURL}/api/tasks/${task.id}`, { headers: creator, data: { status: 'completed', post_link: 'https://instagram.com/p/e2e-first' } })).ok()).toBeTruthy();
      expect((await request.delete(`${baseURL}/api/tasks/${task.id}`, { headers: brand })).status()).toBe(400);
      expect((await request.patch(`${baseURL}/api/tasks/${task.id}`, { headers: creator, data: { status: 'reviewed' } })).status()).toBe(400);
      expect((await request.patch(`${baseURL}/api/tasks/${task.id}`, { headers: creator, data: { status: 'in_progress', post_link: '' } })).ok()).toBeTruthy();
      expect((await request.patch(`${baseURL}/api/tasks/${task.id}`, { headers: creator, data: { status: 'completed', post_link: 'https://instagram.com/p/e2e-final' } })).ok()).toBeTruthy();
      const approved = await request.patch(`${baseURL}/api/tasks/${task.id}`, { headers: brand, data: { status: 'reviewed' } });
      expect(approved.ok()).toBeTruthy();
      expect((await approved.json()).post_link).toBe('https://instagram.com/p/e2e-final');
      expect((await request.patch(`${baseURL}/api/tasks/${task.id}`, { headers: creator, data: { status: 'in_progress', post_link: '' } })).status()).toBe(400);
      expect((await request.delete(`${baseURL}/api/tasks/${task.id}`, { headers: brand })).status()).toBe(400);
    } finally {
      if (contractId) await request.patch(`${baseURL}/api/contracts/${contractId}/end`, { headers: brand });
      await request.delete(`${baseURL}/api/campaigns/${camp.id}`, { headers: brand });
    }
  });

  test('a signed agreement is locked; extra work goes out as its own proposal the creator answers separately', async ({ page, request, baseURL, loginAs }) => {
    const auth = async (email: string) => {
      const r = await request.post(`${baseURL}/api/auth/login`, { data: { email, password: PASSWORD } });
      expect(r.ok(), `login ${email}`).toBeTruthy();
      return { Authorization: `Bearer ${(await r.json()).access_token}` };
    };
    const brand = await auth(ACCOUNTS.brand);
    const creator = await auth(ACCOUNTS.creator3);
    const title = `E2E extra work brief ${Date.now()}`;
    const camp = await (
      await request.post(`${baseURL}/api/campaigns`, {
        headers: brand,
        data: { title, description: 'Throwaway brief for the extra-work flow.', platforms: ['Instagram', 'TikTok'], budget: 300, currency: 'USD', status: 'active', content_type: 'Reel', objective: 'Awareness' },
      })
    ).json();
    let mainId = '';

    try {
      const app = await (await request.post(`${baseURL}/api/applications`, { headers: creator, data: { campaignId: camp.id, pitch: 'Ready.' } })).json();
      const draft = await (await request.get(`${baseURL}/api/contracts/application/${app.id}/draft?payment_amount=300&currency=USD&payment_frequency=one_time`, { headers: brand })).json();
      await request.patch(`${baseURL}/api/applications/${app.id}/payment-schedule`, { headers: brand, data: { payment_amount: 300, currency: 'USD', payment_frequency: 'one_time', payment_day: 1, terms: draft.terms } });
      const main = await (await request.put(`${baseURL}/api/contracts/application/${app.id}/respond`, { headers: creator, data: { action: 'accept' } })).json();
      expect(main.status).toBe('active');
      mainId = main.id;

      // the signed agreement cannot be re-proposed, and the application's money is untouched by the attempt
      const again = await request.patch(`${baseURL}/api/applications/${app.id}/payment-schedule`, { headers: brand, data: { payment_amount: 999, currency: 'USD', payment_frequency: 'one_time', payment_day: 1 } });
      expect(again.status()).toBe(400);
      const apps = await (await request.get(`${baseURL}/api/applications?campaignId=${camp.id}`, { headers: brand })).json();
      expect(Number(apps[0].payment_amount)).toBe(300);

      // brand proposes extra work from the inbox
      await loginAs('brand');
      await page.goto(`/dashboard/applications?campaign=${camp.id}`);
      await expectHero(page);
      await page.locator('article.v-talent-card', { hasText: title }).getByRole('button', { name: /^(open|review)$/i }).click();
      const review = page.getByRole('dialog').first();
      await expect(review.getByRole('button', { name: /propose new terms/i })).toHaveCount(0);
      await review.getByRole('button', { name: /propose extra work/i }).click();
      const extra = page.getByRole('dialog').last();
      await extra.locator('#extra-title').fill('Bonus TikTok teaser');
      await extra.locator('#extra-amount').fill('120');
      await extra.getByPlaceholder(/1 Instagram Reel/i).fill('TikTok teaser');
      await extra.getByRole('button', { name: /add task/i }).click();
      await expect(extra.getByTestId('addendum-editor')).toHaveValue(/ADDENDUM/);
      await extra.getByRole('button', { name: /send proposal/i }).click();
      await expect(page.getByTestId('addendum-editor')).toBeHidden();

      // creator answers it separately — the main agreement stays active
      await loginAs('creator3');
      await page.goto('/dashboard/applications');
      await expectHero(page);
      const card = page.locator('article.v-talent-card', { hasText: title });
      await expect(card).toContainText(/extra work proposed/i);
      await card.getByRole('button', { name: /review proposal/i }).click();
      const dialog = page.getByRole('dialog').first();
      await expect(dialog).toContainText(/extra work proposal/i);
      await expect(dialog).toContainText('Bonus TikTok teaser');
      await expect(dialog).toContainText('$120');
      await dialog.getByRole('button', { name: /sign & accept|accept & sign/i }).click();
      await page.getByRole('dialog').last().getByRole('button', { name: /accept & sign/i }).click();
      await expect(dialog).toContainText(/active/i);

      const all = await (await request.get(`${baseURL}/api/contracts/application/${app.id}/all`, { headers: creator })).json();
      expect(all.map((c: any) => [c.kind, c.status])).toEqual([['main', 'active'], ['addendum', 'active']]);
      const mine = await (await request.get(`${baseURL}/api/tasks/mine`, { headers: creator })).json();
      expect(mine.some((x: any) => x.title === 'TikTok teaser' && x.contract_id === all[1].id)).toBeTruthy();
    } finally {
      if (mainId) await request.patch(`${baseURL}/api/contracts/${mainId}/end`, { headers: brand });
      await request.delete(`${baseURL}/api/campaigns/${camp.id}`, { headers: brand });
    }
  });
});
