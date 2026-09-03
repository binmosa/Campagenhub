/**
 * socialLinks — one canonical way to read/write a profile's social presence.
 *
 * `creator_profiles.social_links` is a text column. Shapes seen in the wild:
 *   1. legacy: one free-text URL                     "instagram.com/x"
 *   2. v1 JSON: url per platform                     {"instagram":"https://…"}
 *   3. v2 JSON: url + follower count per platform    {"instagram":{"url":"https://…","followers":450000}}
 *   4. v3 JSON: v2 + verification state               {"instagram":{"url":…,"followers":…,"status":"verified",…}}
 *
 * A follower count is a CLAIM until an admin (or an automated check)
 * verifies it — `status` is decided by the server; clients may send it
 * but it is ignored and recomputed on save.
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

export type ClaimStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type SocialEntry = {
  url: string;
  followers?: number;
  status?: ClaimStatus;
  verified_followers?: number;
  verified_at?: string;
  claimed_at?: string;
  evidence_url?: string;
  note?: string;
};
export type SocialMap = Partial<Record<SocialPlatformId, SocialEntry>>;

export const CLAIM_STATUSES: ClaimStatus[] = ['unverified', 'pending', 'verified', 'rejected'];

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

/** "45k" / "1.2M" / "980" / "45,000" -> integer (0 when unparseable). */
export const parseCompactNumber = (raw: string): number => {
  const s = String(raw || '').trim().toLowerCase().replace(/[,\s_]/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!m) return 0;
  const mult = m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : m[2] === 'b' ? 1_000_000_000 : 1;
  return Math.round(parseFloat(m[1]) * mult);
};

export type CompactUnit = 'x' | 'K' | 'M';
export const UNIT_MULT: Record<CompactUnit, number> = { x: 1, K: 1_000, M: 1_000_000 };

/** Split an integer into the friendliest {amount, unit} for an editor. */
export const splitCompact = (n?: number): { amount: string; unit: CompactUnit } => {
  if (!n || n <= 0) return { amount: '', unit: 'K' };
  const trim = (v: number) => String(Math.round(v * 100) / 100);
  if (n >= 1_000_000) return { amount: trim(n / 1_000_000), unit: 'M' };
  if (n >= 1_000) return { amount: trim(n / 1_000), unit: 'K' };
  return { amount: String(n), unit: 'x' };
};

const detectFromUrl = (url: string): SocialPlatformId | null => {
  const lower = url.toLowerCase();
  for (const p of SOCIAL_PLATFORMS) {
    if (p.domains.some((d) => lower.includes(d))) return p.id;
  }
  return null;
};

const toInt = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

const toEntry = (v: unknown): SocialEntry | null => {
  if (typeof v === 'string') {
    return v.trim() ? { url: normalizeUrl(v), status: 'unverified' } : null;
  }
  if (v && typeof v === 'object') {
    const e = v as any;
    const url = typeof e.url === 'string' ? e.url.trim() : '';
    const followers = toInt(e.followers);
    if (!url && !followers) return null;
    const status: ClaimStatus = CLAIM_STATUSES.includes(e.status) ? e.status : followers ? 'pending' : 'unverified';
    return {
      url: url ? normalizeUrl(url) : '',
      followers,
      status,
      verified_followers: toInt(e.verified_followers),
      verified_at: typeof e.verified_at === 'string' ? e.verified_at : undefined,
      claimed_at: typeof e.claimed_at === 'string' ? e.claimed_at : undefined,
      evidence_url: typeof e.evidence_url === 'string' ? e.evidence_url : undefined,
      note: typeof e.note === 'string' ? e.note : undefined,
    };
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
  if (id) map[id] = { url: normalizeUrl(value), status: 'unverified' };
  return map;
};

/** Serialize a map back into the column value ('' when empty). Keeps the
 *  verification fields so an unrelated edit doesn't drop a badge; the
 *  server recomputes status anyway. */
export const serializeSocialLinks = (map: SocialMap): string => {
  const out: Record<string, SocialEntry> = {};
  for (const p of SOCIAL_PLATFORMS) {
    const e = map[p.id];
    if (!e) continue;
    const url = e.url?.trim() ? normalizeUrl(e.url) : '';
    const followers = e.followers && e.followers > 0 ? Math.round(e.followers) : 0;
    if (!url && !followers) continue;
    const clean: SocialEntry = { url, status: e.status || (followers ? 'pending' : 'unverified') };
    if (followers) clean.followers = followers;
    if (e.verified_followers) clean.verified_followers = e.verified_followers;
    if (e.verified_at) clean.verified_at = e.verified_at;
    if (e.claimed_at) clean.claimed_at = e.claimed_at;
    if (e.evidence_url) clean.evidence_url = e.evidence_url;
    if (e.note) clean.note = e.note;
    out[p.id] = clean;
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
};

export const isVerified = (e?: SocialEntry | null): boolean => !!e && e.status === 'verified' && !!(e.verified_followers || e.followers);

/** Ordered platform entries for display. */
export const socialEntries = (raw?: string | null) => {
  const map = parseSocialLinks(raw);
  return SOCIAL_PLATFORMS.filter((p) => map[p.id]).map((p) => ({
    ...p,
    url: map[p.id]!.url,
    followers: map[p.id]!.followers,
    status: map[p.id]!.status || 'unverified',
    verified: isVerified(map[p.id]),
    verified_followers: map[p.id]!.verified_followers,
  }));
};

/** Sum of per-platform follower counts (0 when none are recorded). */
export const totalFollowers = (raw?: string | null): number => {
  const map = parseSocialLinks(raw);
  return Object.values(map).reduce((sum, e) => sum + (e?.followers || 0), 0);
};

/** Sum of VERIFIED follower counts only. */
export const verifiedFollowers = (raw?: string | null): number => {
  const map = parseSocialLinks(raw);
  return Object.values(map).reduce((sum, e) => sum + (isVerified(e) ? e!.verified_followers || e!.followers || 0 : 0), 0);
};
