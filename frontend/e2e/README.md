# End-to-end tests (Playwright)

Real-browser tests for the whole portal, role by role. They run against the
local Postgres and the seeded `*@test.com` accounts.

```bash
cd frontend
npm run e2e            # headless, HTML report in playwright-report/
npm run e2e:headed     # watch the browser
npm run e2e:ui         # Playwright UI mode: pick tests, time-travel, re-run
npm run e2e:report     # open the last HTML report
npx playwright test e2e/admin.spec.ts -g "payouts"   # one file / one test
```

## What a run does

1. Builds and starts the API on **:3101** (`backend/dist/main`, Telegram
   polling off) and Vite on **:5199** with `/api` proxied to that API — so a
   run never collides with the servers you use for development. Both are
   reused if already up.
2. `global-setup.ts` checks every role account can sign in, then tops up the
   rows the admin flows need (escrow, a pending payout, an open ticket).
3. Runs the specs in one worker (they share the database), against the
   installed Google Chrome.

## Accounts and password

`e2e/accounts.ts` lists the accounts (superadmin, support, finance, brand,
creator, creator2, manager). The password defaults to the local seed value;
override it with `E2E_PASSWORD=… npm run e2e`.

## Suites

| file | covers |
| --- | --- |
| `public.spec.ts` | landing, campaign board, talent directory, legal pages |
| `auth.spec.ts` | login form (wrong + right password), sign out, auth guard |
| `creator.spec.ts` | dashboard, all creator pages, follower count with K unit |
| `brand.spec.ts` | dashboard, campaign cards + wizard, inbox / team / talent / insights |
| `manager.spec.ts` | dashboard, all manager pages, profile edit round-trip |
| `admin.spec.ts` | every admin page, users filters + KYC confirm, campaign moderation, payouts approve + audit, roles create/delete, tickets, site control, telegram preview |
| `staff.spec.ts` | support-only and finance-only views |
| `i18n.spec.ts` | Amharic sweep — no raw translation keys on any role's pages |

Every test also fails if a console error or page error is logged
(`fixtures.ts`), so regressions in data loading show up even when the page
looks fine.

## Writing a test

```ts
import { test, expect, expectHero, confirmDialog, toast } from './fixtures';

test('brand can open the wizard', async ({ page, loginAs }) => {
  await loginAs('brand');                    // API login + localStorage priming
  await page.goto('/dashboard/campaigns');
  await expectHero(page, /campaigns/i);      // gradient hero + h1
  await page.getByRole('button', { name: /new campaign/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

Prefer role/label selectors (`getByRole`, `aria-label`) over CSS; the shared
components expose them. Destructive actions go through `ConfirmModal`, so use
`confirmDialog(page, /label/)` and assert on `toast(page)`.
