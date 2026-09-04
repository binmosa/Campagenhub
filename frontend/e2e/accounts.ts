/**
 * Seeded role accounts the suite signs in with. The password is the local
 * seed password (SEED_PASSWORD in backend/.env) — override with E2E_PASSWORD.
 */
export type Role = 'admin' | 'support' | 'finance' | 'brand' | 'creator' | 'creator2' | 'manager';

export const ACCOUNTS: Record<Role, string> = {
  admin: 'superadmin@test.com',
  support: 'support@test.com',
  finance: 'finance@test.com',
  brand: 'brand@test.com',
  creator: 'creator@test.com',
  creator2: 'creator2@test.com',
  manager: 'manager@test.com',
};

/** The role the app stores for the account (creator2 is a creator). */
export const APP_ROLE: Record<Role, string> = {
  admin: 'admin',
  support: 'support',
  finance: 'finance',
  brand: 'brand',
  creator: 'creator',
  creator2: 'creator',
  manager: 'manager',
};

export const PASSWORD = process.env.E2E_PASSWORD || '12345678';
