import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { request, type FullConfig } from '@playwright/test';
import { ACCOUNTS, PASSWORD } from './accounts';

/**
 * Global setup — runs once before the suite.
 *
 *   1. waits for the API behind the Vite proxy,
 *   2. checks every seeded role account can sign in,
 *   3. tops up the rows the admin flows need so the suite is repeatable:
 *      an open support ticket, a pending payout with escrow behind it.
 *
 * Uses the backend's own `pg` dependency and DB settings from backend/.env
 * so there is nothing extra to configure.
 */
const require = createRequire(import.meta.url);
const BACKEND = path.resolve(process.cwd(), '..', 'backend');

const readEnv = (): Record<string, string> => {
  const file = path.join(BACKEND, '.env');
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
      }),
  );
};

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const api = await request.newContext({ baseURL });

  // 1. API reachable through the proxy
  const settings = await api.get('/api/public/settings');
  if (!settings.ok()) throw new Error(`API not reachable via ${baseURL}/api (status ${settings.status()})`);

  // 2. every role account signs in
  const ids: Record<string, string> = {};
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    const res = await api.post('/api/auth/login', { data: { email, password: PASSWORD } });
    if (!res.ok()) throw new Error(`Cannot sign in as ${role} (${email}). Set E2E_PASSWORD to the seeded password, or re-run the seed. Status ${res.status()}`);
    const body = await res.json();
    ids[role] = body.user?.id;
  }
  await api.dispose();

  // 3. top-up rows for the admin flows (idempotent)
  const env = readEnv();
  const { Client } = require(path.join(BACKEND, 'node_modules', 'pg'));
  const db = new Client({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  await db.connect();
  try {
    const camp = await db.query(`SELECT id FROM campaigns WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`);
    const campaignId: string | undefined = camp.rows[0]?.id;
    if (campaignId) {
      // escrow so approvals pass the balance check
      await db.query(
        `INSERT INTO payment_transactions (tx_ref, amount, currency, payment_method, status, provider_reference, payer_id, campaign_id)
         VALUES ('E2E-ESCROW-1', 50000.00, 'USD', 'flutterwave', 'completed', 'e2e', $1, $2)
         ON CONFLICT (tx_ref) DO NOTHING`,
        [ids.brand, campaignId],
      );
      const pending = await db.query(`SELECT COUNT(*)::int AS n FROM payouts WHERE status = 'pending'`);
      if (pending.rows[0].n === 0) {
        await db.query(`INSERT INTO payouts (creator_id, campaign_id, amount, status) VALUES ($1, $2, 125.00, 'pending')`, [ids.creator, campaignId]);
      }
    }
    const open = await db.query(`SELECT COUNT(*)::int AS n FROM support_tickets WHERE status = 'open'`);
    if (open.rows[0].n === 0) {
      await db.query(
        `INSERT INTO support_tickets (sender_name, sender_email, subject, message, status) VALUES ('E2E Tester', 'e2e@example.com', 'E2E open ticket', 'Automated ticket used by the Playwright suite.', 'open')`,
      );
    }
  } finally {
    await db.end();
  }
}
