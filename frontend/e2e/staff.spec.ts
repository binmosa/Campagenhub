import { test, expect, expectHero, expectNoRawKeys } from './fixtures';

test.describe('support and finance', () => {
  test('support agent lands on the verification center and can reach follower claims', async ({ page, loginAs }) => {
    await loginAs('support');
    await page.goto('/dashboard');
    await expectHero(page, /Verification center/);
    await expectNoRawKeys(page);
    await page.goto('/dashboard/follower-claims');
    await expectHero(page, /Follower claims/);
    await page.goto('/dashboard/profile');
    await expectHero(page, /Your account/);
    await expect(page.locator('.v-hero-band')).toContainText(/Support/);
  });

  test('finance officer lands on the payout desk without admin-only controls', async ({ page, loginAs }) => {
    await loginAs('finance');
    await page.goto('/dashboard');
    await expectHero(page, /Payout desk/);
    await expectNoRawKeys(page);
    await expect(page.getByText(/Staff activity/)).toHaveCount(0);
    await page.goto('/dashboard/users');
    await expect(page.locator('.v-hero-band')).toHaveCount(0);
  });
});
