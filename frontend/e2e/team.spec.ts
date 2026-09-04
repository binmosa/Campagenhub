import { test, expect } from './fixtures';
import { ACCOUNTS, PASSWORD } from './accounts';

/**
 * Team-member permissions are enforced by the API, not just hidden in the
 * UI. A brand adds a person to its account with no flags: they can read the
 * brand's campaigns but every write is refused until the owner grants the
 * matching permission — and what they create belongs to the brand.
 */
test.describe('brand team permissions (API)', () => {
  test('a team member needs the owner-granted flag to act for the brand', async ({ request, baseURL }) => {
    const api = (path: string) => `${baseURL}/api${path}`;
    const login = async (email: string) => {
      const r = await request.post(api('/auth/login'), { data: { email, password: PASSWORD } });
      expect(r.ok(), `login ${email}`).toBeTruthy();
      return (await r.json()).access_token as string;
    };
    const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

    const owner = await login(ACCOUNTS.brand);
    const memberEmail = `e2e-member-${Date.now()}@test.com`;
    const created = await request.post(api('/brands/team'), { ...auth(owner), data: { email: memberEmail, password: PASSWORD, permissions: {} } });
    expect(created.status(), 'create team member').toBe(201);
    const memberId = (await created.json()).id as string;
    let campaignId: string | undefined;

    try {
      const member = await login(memberEmail);

      // reads act for the parent brand
      const mine = await request.get(api('/campaigns/mine'), auth(member));
      expect(mine.ok()).toBeTruthy();
      const ownerMine = await request.get(api('/campaigns/mine'), auth(owner));
      expect((await mine.json()).length).toBe((await ownerMine.json()).length);

      // writes are refused without the flag
      const draft = { title: `E2E team draft ${Date.now()}`, description: 'created by a team member', status: 'draft', platform: 'Instagram', budget: 100, currency: 'USD' };
      const denied = await request.post(api('/campaigns'), { ...auth(member), data: draft });
      expect(denied.status()).toBe(403);
      expect((await denied.json()).message).toMatch(/can_add_campaigns/);
      expect((await request.get(api('/campaigns/brand/stats'), auth(member))).status()).toBe(403);
      // and team management stays with the owner
      expect((await request.get(api('/brands/team'), auth(member))).status()).toBe(403);

      // owner grants the flag → the member can create, and the brand owns it
      const granted = await request.patch(api(`/brands/team/${memberId}`), { ...auth(owner), data: { permissions: { can_add_campaigns: true } } });
      expect(granted.ok()).toBeTruthy();
      const allowed = await request.post(api('/campaigns'), { ...auth(member), data: draft });
      expect(allowed.status(), await allowed.text()).toBe(201);
      const campaign = await allowed.json();
      campaignId = campaign.id;
      const ownerList = await (await request.get(api('/campaigns/mine'), auth(owner))).json();
      expect(ownerList.some((c: any) => c.id === campaignId)).toBeTruthy();

      // still no analytics without that flag
      expect((await request.get(api('/campaigns/brand/stats'), auth(member))).status()).toBe(403);
    } finally {
      if (campaignId) await request.delete(api(`/campaigns/${campaignId}`), auth(owner));
      await request.delete(api(`/brands/team/${memberId}`), auth(owner));
    }
  });
});
