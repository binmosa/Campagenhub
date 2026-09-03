/**
 * Server-side social links: the ONE place that decides what a creator's
 * follower numbers mean.
 *
 * `creator_profiles.social_links` is a JSON map keyed by platform:
 *   { "instagram": { url, followers, status, verified_followers, verified_at,
 *                    claimed_at, evidence_url, note } }
 *
 * A follower count typed by the creator is a CLAIM. It starts `pending`
 * and stays that way until an admin (or an automated check) verifies it.
 * Clients can never set `status`/`verified_*` themselves — `reconcile()`
 * derives them from what changed.
 */
export type ClaimStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type SocialEntry = {
  url: string;
  followers?: number;
  status: ClaimStatus;
  verified_followers?: number;
  verified_at?: string;
  claimed_at?: string;
  evidence_url?: string;
  note?: string;
};
export type SocialMap = Record<string, SocialEntry>;

export const SOCIAL_KEYS = ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'twitch'] as const;

const KEY_ALIASES: Record<string, string> = {
  instagram: 'instagram', insta: 'instagram', ig: 'instagram',
  tiktok: 'tiktok', tt: 'tiktok',
  youtube: 'youtube', yt: 'youtube',
  twitter: 'twitter', x: 'twitter',
  facebook: 'facebook', fb: 'facebook',
  linkedin: 'linkedin',
  twitch: 'twitch',
};

const normalizeUrl = (u: string): string => {
  const t = String(u || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const toInt = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

const STATUSES: ClaimStatus[] = ['unverified', 'pending', 'verified', 'rejected'];

export const parseSocialLinks = (raw?: string | null): SocialMap => {
  const map: SocialMap = {};
  const value = String(raw || '').trim();
  if (!value) return map;
  if (value.startsWith('{')) {
    try {
      const obj = JSON.parse(value);
      for (const [key, v] of Object.entries(obj || {})) {
        const id = KEY_ALIASES[key.toLowerCase()];
        if (!id || map[id]) continue;
        if (typeof v === 'string') {
          if (v.trim()) map[id] = { url: normalizeUrl(v), status: 'unverified' };
          continue;
        }
        if (v && typeof v === 'object') {
          const e: any = v;
          const url = normalizeUrl(e.url || '');
          const followers = toInt(e.followers);
          if (!url && !followers) continue;
          map[id] = {
            url,
            followers,
            status: STATUSES.includes(e.status) ? e.status : followers ? 'pending' : 'unverified',
            verified_followers: toInt(e.verified_followers),
            verified_at: typeof e.verified_at === 'string' ? e.verified_at : undefined,
            claimed_at: typeof e.claimed_at === 'string' ? e.claimed_at : undefined,
            evidence_url: typeof e.evidence_url === 'string' ? e.evidence_url.slice(0, 2048) : undefined,
            note: typeof e.note === 'string' ? e.note.slice(0, 500) : undefined,
          };
        }
      }
      return map;
    } catch {
      /* fall through */
    }
  }
  // Legacy single URL
  const lower = value.toLowerCase();
  for (const k of SOCIAL_KEYS) if (lower.includes(k)) return { [k]: { url: normalizeUrl(value), status: 'unverified' } };
  if (lower.includes('x.com')) return { twitter: { url: normalizeUrl(value), status: 'unverified' } };
  return map;
};

export const serializeSocialLinks = (map: SocialMap): string => {
  const out: Record<string, SocialEntry> = {};
  for (const k of SOCIAL_KEYS) {
    const e = map[k];
    if (!e) continue;
    if (!e.url && !e.followers) continue;
    const clean: SocialEntry = { url: e.url, status: e.status || 'unverified' };
    if (e.followers) clean.followers = e.followers;
    if (e.verified_followers) clean.verified_followers = e.verified_followers;
    if (e.verified_at) clean.verified_at = e.verified_at;
    if (e.claimed_at) clean.claimed_at = e.claimed_at;
    if (e.evidence_url) clean.evidence_url = e.evidence_url;
    if (e.note) clean.note = e.note;
    out[k] = clean;
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
};

/**
 * Merge a client submission into the stored map. The client may change
 * url / followers / evidence_url. Verification state is derived:
 *   - same url + same followers as the verified record → stays verified
 *   - a (new) positive follower count                → pending (a claim)
 *   - no follower count                              → unverified
 * A rejected claim resubmitted unchanged stays rejected (admin's note kept)
 * unless the creator attaches new evidence, which re-opens it as pending.
 */
export const reconcileSocialLinks = (existingRaw: string | null | undefined, incomingRaw: unknown): string => {
  const existing = parseSocialLinks(existingRaw);
  const incoming = parseSocialLinks(typeof incomingRaw === 'string' ? incomingRaw : JSON.stringify(incomingRaw ?? {}));
  const now = new Date().toISOString();
  const next: SocialMap = {};
  for (const k of SOCIAL_KEYS) {
    const inc = incoming[k];
    if (!inc) continue;
    const prev = existing[k];
    const url = inc.url;
    const followers = inc.followers;
    const evidence = inc.evidence_url || prev?.evidence_url;
    if (!url && !followers) continue;

    if (prev && prev.status === 'verified' && prev.url === url && followers === (prev.verified_followers ?? prev.followers)) {
      next[k] = { ...prev, evidence_url: evidence };
      continue;
    }
    if (!followers) {
      next[k] = { url, status: 'unverified', evidence_url: evidence };
      continue;
    }
    if (prev && prev.status === 'rejected' && prev.url === url && prev.followers === followers && !(inc.evidence_url && inc.evidence_url !== prev.evidence_url)) {
      next[k] = { ...prev, evidence_url: evidence };
      continue;
    }
    if (prev && prev.status === 'pending' && prev.url === url && prev.followers === followers) {
      next[k] = { ...prev, evidence_url: evidence, note: prev.note };
      continue;
    }
    next[k] = { url, followers, status: 'pending', claimed_at: now, evidence_url: evidence };
  }
  return serializeSocialLinks(next);
};

/** What everyone else may see: no evidence screenshots, no admin notes. */
export const publicSocialLinks = (raw?: string | null): string => {
  const map = parseSocialLinks(raw);
  for (const k of Object.keys(map)) {
    delete map[k].evidence_url;
    delete map[k].note;
  }
  return serializeSocialLinks(map);
};

/** Apply a verification decision to one platform entry. */
export const decideClaim = (
  raw: string | null | undefined,
  platform: string,
  decision: { action: 'verify' | 'reject'; verified_followers?: number; note?: string; by?: string },
): { raw: string; entry: SocialEntry } | null => {
  const map = parseSocialLinks(raw);
  const id = KEY_ALIASES[String(platform).toLowerCase()];
  const entry = id ? map[id] : undefined;
  if (!id || !entry) return null;
  const now = new Date().toISOString();
  if (decision.action === 'verify') {
    const count = toInt(decision.verified_followers) ?? entry.followers;
    map[id] = { ...entry, followers: count, verified_followers: count, status: 'verified', verified_at: now, note: decision.note || decision.by || undefined };
  } else {
    map[id] = { ...entry, status: 'rejected', verified_followers: undefined, verified_at: undefined, note: decision.note || undefined };
  }
  return { raw: serializeSocialLinks(map), entry: map[id] };
};
