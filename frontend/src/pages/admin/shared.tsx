import React from 'react';
import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { formatBudget } from '../../lib/campaignFormat';

/**
 * shared — helpers every admin / support / finance page leans on so the
 * back-office reads as one product: how a user is named and pictured, how
 * a role or status is coloured, how money and dates are printed.
 */

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  account_status?: string;
  kyc_status?: string;
  kyc_required?: boolean;
  is_banned?: boolean;
  permissions?: Record<string, unknown> | null;
  created_at?: string;
  telegram_username?: string | null;
  points?: number;
  creatorProfile?: { full_name?: string; username?: string; avatar_url?: string; category?: string; location?: string; social_links?: string } | null;
  brandProfile?: { company_name?: string; logo_url?: string; industry?: string; location?: string } | null;
  managerProfile?: { full_name?: string; avatar_url?: string; specialty?: string } | null;
};

export const STAFF_ROLES = ['admin', 'support', 'finance'] as const;
export const ALL_ROLES = ['creator', 'brand', 'manager', 'support', 'finance', 'admin'] as const;

/** Display name + picture for any user row, whatever the role. */
export const userIdentity = (u?: AdminUser | any) => {
  const p = u?.creatorProfile;
  const b = u?.brandProfile;
  const m = u?.managerProfile;
  const name: string = p?.full_name || b?.company_name || m?.full_name || u?.display_name || u?.email?.split('@')[0] || '';
  const avatar: string | undefined = p?.avatar_url || b?.logo_url || m?.avatar_url || undefined;
  const handle: string | undefined = p?.username ? `@${p.username}` : undefined;
  const sub: string | undefined = p?.category || b?.industry || m?.specialty || undefined;
  return { name, avatar, handle, sub };
};

export const ROLE_COLOR: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'default'> = {
  creator: 'accent',
  brand: 'success',
  manager: 'warning',
  admin: 'danger',
  support: 'default',
  finance: 'default',
};

export const RoleChip: React.FC<{ role?: string; size?: 'sm' | 'md' }> = ({ role, size = 'sm' }) => {
  const { t } = useTranslation();
  const r = String(role || '').toLowerCase();
  return (
    <Chip color={ROLE_COLOR[r] || 'default'} variant="soft" size={size}>
      <Chip.Label>{t(`adm.roles.${r}`, { defaultValue: r || '—' })}</Chip.Label>
    </Chip>
  );
};

export const ACCOUNT_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  pending_verification: 'warning',
  rejected: 'danger',
};

export const PAYOUT_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
  pending: 'warning',
  approved: 'accent',
  paid: 'success',
  rejected: 'danger',
};

export const TICKET_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
  open: 'accent',
  in_progress: 'warning',
  resolved: 'success',
};

export const money = (n?: number | string | null, currency = 'USD') => formatBudget(Number(n) || 0, currency);

export const dateShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Section heading used above every list block on admin pages. */
export const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ icon, children, action, className = 'mb-3' }) => (
  <div className={`flex items-center justify-between gap-3 ${className}`}>
    <h2 className="v-ink font-medium inline-flex items-center gap-2" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
      <span style={{ color: 'var(--color-campaign-purple)' }}>{icon}</span> {children}
    </h2>
    {action}
  </div>
);

/** Small key/value tile used in "at a glance" grids. */
export const Fact: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-lg p-2.5" style={{ background: 'var(--color-cool-gray)' }}>
    <dt className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{label}</dt>
    <dd className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{children}</dd>
  </div>
);

/** Row skeletons for list pages. */
export const RowSkeletons: React.FC<{ n?: number }> = ({ n = 3 }) => (
  <div className="space-y-3" aria-hidden>
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="v-talent-card p-4 flex items-center gap-3">
        <div className="v-skel h-10 w-10 !rounded-full" />
        <div className="flex-1">
          <div className="v-skel h-4 w-1/3 mb-2" />
          <div className="v-skel h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

/** Card panel with a title row — the admin equivalent of a settings section. */
export const Panel: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  desc?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
  children: React.ReactNode;
}> = ({ icon, title, desc, action, tone = 'default', className = '', children }) => (
  <section
    className={`v-talent-card p-5 ${className}`}
    style={tone === 'danger' ? { borderColor: 'rgba(255,90,95,0.35)', background: 'linear-gradient(180deg, rgba(255,90,95,0.06) 0%, var(--color-paper) 100%)' } : undefined}
  >
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="v-hero-icon shrink-0" style={{ width: 32, height: 32, borderRadius: 10, ...(tone === 'danger' ? { color: '#b3261e', background: 'rgba(255,90,95,0.12)' } : {}) }}>{icon}</span>
        <div className="min-w-0">
          <h3 className="v-ink font-medium" style={{ fontSize: 15, letterSpacing: '-0.012em' }}>{title}</h3>
          {desc && <p className="v-caption v-quiet mt-0.5" style={{ fontSize: 12 }}>{desc}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </section>
);

/** Label + control pairing used inside admin forms. */
export const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ label, hint, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>
      {label}
      {hint && <span className="v-quiet font-normal"> · {hint}</span>}
    </span>
    {children}
  </label>
);
