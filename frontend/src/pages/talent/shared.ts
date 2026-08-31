import type { PlatformKey } from '../landing/mocks/PlatformIcon';

/** One row in the talent directory — creator or manager. */
export type Talent = {
  id: string;
  _type: 'creator' | 'manager';
  full_name?: string;
  username?: string;
  avatar_url?: string;
  category?: string;
  specialty?: string;
  location?: string;
  bio?: string;
  social_links?: string;
  follower_count?: number;
  follower_range?: string;
  rating?: number;
  experience_years?: number;
  user?: { id?: string };
  user_id?: string;
};

export const CURRENCIES = ['NGN', 'USD', 'KES', 'GHS', 'ZAR', 'UGX', 'EUR', 'GBP'];

export const NICHES = [
  'Fashion', 'Tech', 'Food', 'Fitness', 'Beauty', 'Travel', 'Gaming',
  'Lifestyle', 'Music', 'Education', 'Business', 'Finance', 'Sports',
  'Comedy', 'E-commerce', 'SaaS', 'Healthcare',
];

export const FOLLOWER_RANGES = [
  { id: 'any', label: 'Any', min: 0, max: 0 },
  { id: 'nano', label: 'Nano · 1K–10K', min: 1000, max: 10000 },
  { id: 'micro', label: 'Micro · 10K–100K', min: 10000, max: 100000 },
  { id: 'mid', label: 'Mid · 100K–1M', min: 100000, max: 1_000_000 },
  { id: 'macro', label: 'Macro · 1M+', min: 1_000_000, max: 0 },
];

/**
 * Filterable platforms. `id` is the canonical key stored in social_links
 * JSON (and matched server-side via ILIKE); `iconKey` maps to the real
 * brand glyph in landing/mocks/PlatformIcon.
 */
export const PLATFORMS: {
  id: string;
  label: string;
  iconKey: PlatformKey;
  color: string;
}[] = [
  { id: 'instagram', label: 'Instagram', iconKey: 'instagram', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', iconKey: 'tiktok', color: '#0b1736' },
  { id: 'youtube', label: 'YouTube', iconKey: 'youtube', color: '#FF0000' },
  { id: 'twitter', label: 'X / Twitter', iconKey: 'x', color: '#0b1736' },
  { id: 'facebook', label: 'Facebook', iconKey: 'facebook', color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', iconKey: 'linkedin', color: '#0A66C2' },
  { id: 'twitch', label: 'Twitch', iconKey: 'twitch', color: '#9146FF' },
];

/** Canonical social-links id → brand glyph key. */
export const PLATFORM_ICON_KEY: Record<string, PlatformKey> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  twitter: 'x',
  facebook: 'facebook',
  linkedin: 'linkedin',
  twitch: 'twitch',
};

export const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

export const formatFollowers = (n: number): string => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
};

/** Stable accent per talent (avatar fallback + cover tint). */
export const ACCENTS = [
  { from: '#6c63ff', to: '#4f7cff' },
  { from: '#00d4c7', to: '#4f7cff' },
  { from: '#ff5a5f', to: '#ff7a45' },
  { from: '#ffb547', to: '#ff7a45' },
  { from: '#7b61ff', to: '#00d4c7' },
  { from: '#4f7cff', to: '#00cfc8' },
];

export const accentFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(h) % ACCENTS.length];
};
