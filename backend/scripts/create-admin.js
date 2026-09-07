#!/usr/bin/env node
/**
 * Create (or promote) a staff account.
 *
 * Public registration only ever grants creator, brand or manager — staff
 * roles are deliberately unreachable from outside, which means the very
 * first administrator has to be made here. It is also how you add a support
 * or finance colleague later without the seed.
 *
 *   node scripts/create-admin.js you@yourdomain.com
 *   node scripts/create-admin.js money@yourdomain.com --role finance
 *
 * The password is typed at the prompt, never passed as an argument — an
 * argument would sit in your shell history and in the process list.
 *
 * Reads the database connection from the same .env the API uses. Pass
 * DOTENV_CONFIG_PATH if that file lives elsewhere (it does on Forge):
 *
 *   DOTENV_CONFIG_PATH=/home/forge/yourdomain.com/.env \
 *     node scripts/create-admin.js you@yourdomain.com
 */
require('dotenv/config');
const readline = require('readline');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const STAFF_ROLES = ['admin', 'support', 'finance'];

/** What a full administrator can do — mirrors the seed's super-admin set. */
const ADMIN_PERMISSIONS = {
  view_users: true,
  manage_users: true,
  view_campaigns: true,
  manage_campaigns: true,
  view_applications: true,
  manage_applications: true,
  view_payouts: true,
  manage_payouts: true,
  view_payments: true,
  manage_payments: true,
  view_kyc: true,
  approve_kyc: true,
  manage_roles: true,
  manage_permissions: true,
  manage_settings: true,
  view_reports: true,
  view_support: true,
  manage_support: true,
  view_finance: true,
  manage_finance: true,
};

/** Support reviews people; finance moves money. Neither administers the platform. */
const SUPPORT_PERMISSIONS = { view_users: true, view_kyc: true, approve_kyc: true, view_support: true, manage_support: true };
const FINANCE_PERMISSIONS = { view_payouts: true, manage_payouts: true, view_payments: true, manage_payments: true, view_finance: true, manage_finance: true };

const permissionsFor = (role) =>
  role === 'admin' ? ADMIN_PERMISSIONS : role === 'support' ? SUPPORT_PERMISSIONS : FINANCE_PERMISSIONS;

/*
 * Prompting.
 *
 * On a terminal this is an ordinary readline session with the password
 * echo suppressed. When stdin is a pipe (a setup script, `printf | node`)
 * readline delivers only the first line before hitting EOF, so in that case
 * the whole of stdin is read up front and answers are served from it.
 */
const piped = !process.stdin.isTTY;
let pipedLines = [];
let pipedAt = 0;

const readAllStdin = () =>
  new Promise((resolve) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (buffer += chunk));
    process.stdin.on('end', () => resolve(buffer.split(/\r?\n/)));
  });

const rl = piped ? null : readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

const ask = (question) => {
  if (piped) {
    process.stdout.write(question);
    const answer = String(pipedLines[pipedAt++] ?? '').trim();
    process.stdout.write('\n');
    return Promise.resolve(answer);
  }
  return new Promise((resolve) => rl.question(question, (answer) => resolve(String(answer).trim())));
};

/** Ask for a password, echoing nothing when we are on a real terminal. */
const askHidden = async (question) => {
  if (piped) return ask(question);
  const onData = () => process.stdout.write(`\r\x1b[2K${question}`);
  process.stdin.on('data', onData);
  const answer = await ask(question);
  process.stdin.removeListener('data', onData);
  process.stdout.write('\n');
  return answer;
};

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  if (rl) rl.close();
  process.exit(1);
};

(async () => {
  if (piped) pipedLines = await readAllStdin();

  const args = process.argv.slice(2);
  const email = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();
  const roleFlag = args.indexOf('--role');
  const role = roleFlag > -1 ? String(args[roleFlag + 1] || '').toLowerCase() : 'admin';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail('Usage: node scripts/create-admin.js you@yourdomain.com [--role admin|support|finance]');
  }
  if (!STAFF_ROLES.includes(role)) {
    fail(`Unknown role "${role}". Use one of: ${STAFF_ROLES.join(', ')}.`);
  }
  if (!process.env.DB_NAME) {
    fail('No database configuration found. Run this from backend/, or set DOTENV_CONFIG_PATH to your .env file.');
  }

  const password = await askHidden(`  Password for ${email}: `);
  if (password.length < 12) {
    fail('Use at least 12 characters — this account can move money and read every user record.');
  }
  const again = await askHidden('  Type it again: ');
  if (password !== again) fail('Those did not match.');

  const db = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await db.connect();
  } catch (e) {
    fail(`Could not reach the database: ${e.message}`);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const permissions = JSON.stringify(permissionsFor(role));
    const existing = await db.query('SELECT id, role FROM users WHERE LOWER(email) = $1', [email]);

    if (existing.rowCount) {
      const current = existing.rows[0].role;
      const answer = await ask(`  ${email} already exists as "${current}". Promote to ${role} and reset the password? [y/N] `);
      if (answer.toLowerCase() !== 'y') {
        console.log('\n  Nothing changed.\n');
        return;
      }
      await db.query(
        `UPDATE users
            SET role = $2, password_hash = $3, permissions = $4,
                account_status = 'active', is_banned = false
          WHERE id = $1`,
        [existing.rows[0].id, role, hash, permissions],
      );
      console.log(`\n  ${email} is now ${role}.\n`);
      return;
    }

    await db.query(
      `INSERT INTO users (email, password_hash, role, account_status, permissions, kyc_required)
       VALUES ($1, $2, $3, 'active', $4, false)`,
      [email, hash, role, permissions],
    );
    console.log(`\n  Created ${email} as ${role}. Sign in at your site's /login.\n`);
  } catch (e) {
    fail(`Failed: ${e.message}`);
  } finally {
    await db.end();
    if (rl) rl.close();
  }
})();
