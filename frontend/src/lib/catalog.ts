/**
 * catalog — the ONE list of enumerated values shared by every role's UI.
 *
 * Before this file, four pages each carried their own currency list (with
 * different members), two carried different payment-frequency lists (which
 * silently lost `quarterly` on edit), and statuses were free strings.
 * Import from here; never re-declare locally.
 */

/** Currencies a brand can price a brief or a payout in. USD first, then
 *  the live/upcoming market currencies, then the majors. */
export const CURRENCIES = ['USD', 'ETB', 'NGN', 'KES', 'GHS', 'ZAR', 'UGX', 'XOF', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_FREQUENCIES = ['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

/** Frequencies where "payment day of the month" makes sense. */
export const DAY_BASED_FREQUENCIES = ['monthly', 'quarterly', 'yearly'] as const;
export const hasPaymentDay = (f?: string | null) => (DAY_BASED_FREQUENCIES as readonly string[]).includes(String(f || ''));

/** Rough monthly-equivalent of a recurring amount (one-time → 0). */
export const monthlyEquivalent = (amount: number, f?: string | null): number => {
  const n = Number(amount) || 0;
  switch (f) {
    case 'daily':
      return n * 30;
    case 'weekly':
      return n * 4.33;
    case 'monthly':
      return n;
    case 'quarterly':
      return n / 3;
    case 'yearly':
      return n / 12;
    default:
      return 0;
  }
};

/** Campaign lifecycle — mirrors backend CAMPAIGN_STATUSES. */
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'closed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Applicant pipeline — mirrors backend APPLICATION_STATUSES. */
export const APPLICATION_STATUSES = ['pending', 'shortlisted', 'accepted', 'rejected', 'refunded'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Deliverable formats a brief can ask for (stored as a single string). */
export const CONTENT_TYPES = ['Photo', 'Video', 'Story', 'Reel', 'Blog', 'Live'] as const;

/** Campaign objectives (stored as a single string; localized via objectives.*). */
export const OBJECTIVES = ['Awareness', 'Engagement', 'Conversions', 'Content'] as const;

/**
 * Platforms a brief can target. `label` is what gets stored in the
 * comma-joined `campaign.platform` column ("TikTok, Instagram"); the
 * backend platform filter matches it with ILIKE, and CampaignCard parses
 * it back into glyphs.
 */
export const CAMPAIGN_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'Twitter' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'linkedin', label: 'LinkedIn' },
] as const;

/* ── Audience targeting (ads-manager style) + creator assets ─────── */
export const GENDERS = ['all', 'female', 'male'] as const;
export type Gender = (typeof GENDERS)[number];

export const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

export const MEDIA_TYPES = ['video', 'image', 'article'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export type TargetCountry = { code: string; name: string };
export type TargetCity = { country_code: string; city: string };
export type Targeting = {
  gender: Gender;
  age_groups: string[];
  countries: TargetCountry[];
  cities: TargetCity[];
};
export type MediaLink = { type: MediaType; url: string; label?: string };

export const EMPTY_TARGETING: Targeting = { gender: 'all', age_groups: [], countries: [], cities: [] };

/** Accepts the hydrated object from the API or a raw JSON string (older rows). */
export const parseTargeting = (raw: unknown): Targeting => {
  let v: any = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  if (!v || typeof v !== 'object') return EMPTY_TARGETING;
  return {
    gender: (GENDERS as readonly string[]).includes(v.gender) ? v.gender : 'all',
    age_groups: Array.isArray(v.age_groups) ? v.age_groups.map(String) : [],
    countries: Array.isArray(v.countries)
      ? v.countries.filter((c: any) => c && c.code).map((c: any) => ({ code: String(c.code), name: String(c.name || c.code) }))
      : [],
    cities: Array.isArray(v.cities)
      ? v.cities.filter((c: any) => c && c.city).map((c: any) => ({ country_code: String(c.country_code || ''), city: String(c.city) }))
      : [],
  };
};

export const parseMediaLinks = (raw: unknown): MediaLink[] => {
  let v: any = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((m: any) => m && typeof m.url === 'string')
    .map((m: any) => ({
      type: (MEDIA_TYPES as readonly string[]).includes(m.type) ? m.type : 'article',
      url: m.url,
      ...(m.label ? { label: String(m.label) } : {}),
    }));
};

/** True when the brief targets nobody in particular (no gender/age/geo). */
export const isOpenTargeting = (t: Targeting): boolean =>
  t.gender === 'all' && t.age_groups.length === 0 && t.countries.length === 0;

/** Normalize any legacy status string to the current enum (UI side). */
export const normalizeCampaignStatus = (s?: string | null): CampaignStatus => {
  const k = String(s || '').toLowerCase().trim();
  if ((CAMPAIGN_STATUSES as readonly string[]).includes(k)) return k as CampaignStatus;
  if (k === 'inactive') return 'paused';
  if (k === 'completed' || k === 'archived' || k === 'cancelled') return 'closed';
  return 'active';
};

export const normalizeApplicationStatus = (s?: string | null): ApplicationStatus => {
  const k = String(s || '').toLowerCase().trim();
  if ((APPLICATION_STATUSES as readonly string[]).includes(k)) return k as ApplicationStatus;
  if (k === 'approved') return 'accepted';
  if (k === 'declined') return 'rejected';
  return 'pending';
};

/** HeroUI Chip color per status — shared so every list agrees. */
export const CAMPAIGN_STATUS_COLOR: Record<CampaignStatus, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  closed: 'default',
};

export const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
  pending: 'warning',
  shortlisted: 'accent',
  accepted: 'success',
  rejected: 'danger',
  refunded: 'default',
};

/** What a manager can offer a brand — shown as chips on manager profiles/cards. */
export const MANAGER_SERVICES = [
  'Campaign strategy',
  'Creator sourcing',
  'Content planning',
  'Community management',
  'Paid ads',
  'Analytics & reporting',
  'Influencer negotiation',
  'Brand partnerships',
  'Event activations',
] as const;
