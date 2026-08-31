/**
 * socialLinks — one canonical way to read/write a profile's social presence.
 *
 * `creator_profiles.social_links` is a text column. Three shapes exist:
 *   1. legacy: one free-text URL                     "instagram.com/x"
 *   2. v1 JSON: url per platform                     {"instagram":"https://…"}
 *   3. v2 JSON: url + follower count per platform    {"instagram":{"url":"https://…","followers":450000}}
 *
 * `parseSocialLinks` accepts ALL of them; `serializeSocialLinks` writes v2
 * (falling back to the plain-string form when no follower count is set).
 *
 * Note: the canonical id for X is 'twitter' (a distinctive substring —
 * server-side platform filters match with ILIKE '%twitter%'; a key of 'x'
 * would match everything).
 */

export type SocialPlatformId =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'twitch';

export type SocialEntry = { url: string; followers?: number };
export type SocialMap = Partial<Record<SocialPlatformId, SocialEntry>>;

export const SOCIAL_PLATFORMS: {
  id: SocialPlatformId;
  label: string;
  color: string;
  domains: string[];
  placeholder: string;
}[] = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C', domains: ['instagram.com', 'instagr.am'], placeholder: 'instagram.com/you' },
  { id: 'tiktok', label: 'TikTok', color: '#0b1736', domains: ['tiktok.com'], placeholder: 'tiktok.com/@you' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000', domains: ['youtube.com', 'youtu.be'], placeholder: 'youtube.com/@you' },
  { id: 'twitter', label: 'X / Twitter', color: '#0b1736', domains: ['twitter.com', 'x.com'], placeholder: 'x.com/you' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', domains: ['facebook.com', 'fb.com'], placeholder: 'facebook.com/you' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', domains: ['linkedin.com'], placeholder: 'linkedin.com/in/you' },
  { id: 'twitch', label: 'Twitch', color: '#9146FF', domains: ['twitch.tv'], placeholder: 'twitch.tv/you' },
];

const KEY_ALIASES: Record<string, SocialPlatformId> = {
  instagram: 'instagram', insta: 'instagram', ig: 'instagram',
  tiktok: 'tiktok', tt: 'tiktok',
  youtube: 'youtube', yt: 'youtube',
  twitter: 'twitter', x: 'twitter',
  facebook: 'facebook', fb: 'facebook',
  linkedin: 'linkedin',
  twitch: 'twitch',
};

export const normalizeUrl = (u: string): string => {
  const t = u.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

/** 1234567 -> "1.2M", 45300 -> "45K", 980 -> "980". */
export const formatCompact = (n: number): string => {
  if (!n || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
};

const detectFromUrl = (url: string): SocialPlatformId | null => {
  const lower = url.toLowerCase();
  for (const p of SOCIAL_PLATFORMS) {
    if (p.domains.some((d) => lower.includes(d))) return p.id;
  }
  return null;
};

const toEntry = (v: unknown): SocialEntry | null => {
  if (typeof v === 'string') {
    return v.trim() ? { url: normalizeUrl(v) } : null;
  }
  if (v && typeof v === 'object') {
    const url = typeof (v as any).url === 'string' ? (v as any).url.trim() : '';
    const rawF = Number((v as any).followers);
    const followers = Number.isFinite(rawF) && rawF > 0 ? Math.round(rawF) : undefined;
    if (!url && !followers) return null;
    return { url: url ? normalizeUrl(url) : '', followers };
  }
  return null;
};

/** Parse the stored column value (any historical shape) into a map. */
export const parseSocialLinks = (raw?: string | null): SocialMap => {
  const map: SocialMap = {};
  const value = (raw || '').trim();
  if (!value) return map;

  if (value.startsWith('{')) {
    try {
      const obj = JSON.parse(value);
      if (obj && typeof obj === 'object') {
        for (const [key, v] of Object.entries(obj)) {
          const id = KEY_ALIASES[key.toLowerCase()];
          if (!id || map[id]) continue;
          const entry = toEntry(v);
          if (entry) map[id] = entry;
        }
        return map;
      }
    } catch {
      /* fall through to legacy handling */
    }
  }

  // Legacy: a single URL / handle string. Detect the platform by domain.
  const id = detectFromUrl(value);
  if (id) map[id] = { url: normalizeUrl(value) };
  return map;
};

/** Serialize a map back into the column value ('' when empty). */
export const serializeSocialLinks = (map: SocialMap): string => {
  const out: Record<string, string | { url: string; followers: number }> = {};
  for (const p of SOCIAL_PLATFORMS) {
    const e = map[p.id];
    if (!e) continue;
    const url = e.url?.trim() ? normalizeUrl(e.url) : '';
    const followers = e.followers && e.followers > 0 ? Math.round(e.followers) : 0;
    if (!url && !followers) continue;
    out[p.id] = followers ? { url, followers } : url;
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
};

/** Ordered platform entries for display. */
export const socialEntries = (raw?: string | null) => {
  const map = parseSocialLinks(raw);
  return SOCIAL_PLATFORMS.filter((p) => map[p.id]).map((p) => ({
    ...p,
    url: map[p.id]!.url,
    followers: map[p.id]!.followers,
  }));
};

/** Sum of per-platform follower counts (0 when none are recorded). */
export const totalFollowers = (raw?: string | null): number => {
  const map = parseSocialLinks(raw);
  return Object.values(map).reduce((sum, e) => sum + (e?.followers || 0), 0);
};
