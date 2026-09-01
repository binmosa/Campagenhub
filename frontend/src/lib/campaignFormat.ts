import i18n from '../i18n';

/**
 * campaignFormat — shared display helpers for campaign cards
 * (public /campaigns board + landing ActiveCampaigns).
 */

/** ISO-4217 → display symbol for the markets CampaignHub operates in. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  ETB: 'Br ',
  NGN: '₦',
  KES: 'KSh ',
  GHS: '₵',
  XOF: 'CFA ',
  EUR: '€',
  GBP: '£',
};

export const formatBudget = (
  raw?: number | string | null,
  currency: string = 'USD',
): string => {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${sym}${n}`;
};

export const brandName = (camp: any): string =>
  camp?.brand?.brandProfile?.company_name ||
  camp?.brand?.email?.split?.('@')[0] ||
  'Brand';

export const brandInitials = (name?: string): string =>
  (name || 'CH')
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

/** "3d left" / "Due today" / null (no deadline or already past). */
export const deadlineLabel = (deadline?: string | null): string | null => {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return i18n.t('time.dueToday');
  if (days === 1) return i18n.t('time.oneDayLeft');
  if (days <= 60) return i18n.t('time.daysLeft', { n: days });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** "today" / "3d ago" / "2w ago" for the posted date. */
export const postedLabel = (createdAt?: string | null): string | null => {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return i18n.t('time.today');
  if (days < 7) return i18n.t('time.dAgo', { n: days });
  if (days < 30) return i18n.t('time.wAgo', { n: Math.floor(days / 7) });
  return i18n.t('time.moAgo', { n: Math.floor(days / 30) });
};
