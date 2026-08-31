/**
 * campaignFormat — shared display helpers for campaign cards
 * (public /campaigns board + landing ActiveCampaigns).
 */

export const formatBudget = (raw?: number | string | null): string => {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
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
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  if (days <= 60) return `${days} days left`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** "today" / "3d ago" / "2w ago" for the posted date. */
export const postedLabel = (createdAt?: string | null): string | null => {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};
