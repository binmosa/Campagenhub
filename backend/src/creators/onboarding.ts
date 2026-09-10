import { BadRequestException } from '@nestjs/common';
import type { OnboardingState } from '../users/user.entity';
import { SOCIAL_KEYS } from './social-links';

/**
 * Creator onboarding — pure helpers shared by the service and the admin
 * queue. The state itself lives on `users.onboarding` (simple-json) and
 * completion on `users.onboarding_completed_at`.
 */

/** Platforms a creator can tell us they followed us on (adds Telegram,
 *  which is not a creator-profile platform but is where Campaign Hubz
 *  publishes most). Keys match the `social_<platform>` site settings. */
export const FOLLOW_PLATFORMS = [...SOCIAL_KEYS, 'telegram'] as const;
export type FollowPlatform = (typeof FOLLOW_PLATFORMS)[number];

const POST_HOSTS: Record<string, string> = {
  'instagram.com': 'instagram',
  'instagr.am': 'instagram',
  'tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'fb.watch': 'facebook',
  'linkedin.com': 'linkedin',
  'twitch.tv': 'twitch',
  't.me': 'telegram',
  'telegram.me': 'telegram',
};

/** Accepts a public post link and says which platform it lives on. */
export const parseWelcomePostUrl = (raw: unknown): { url: string; platform: string } => {
  const text = String(raw || '').trim();
  if (!text) throw new BadRequestException('Paste the link to your post.');
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new BadRequestException('That does not look like a link. Copy it from the share button of your post.');
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, '');
  const platform = Object.entries(POST_HOSTS).find(([h]) => host === h || host.endsWith(`.${h}`))?.[1];
  if (!platform) throw new BadRequestException('Share a link from Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Twitch or Telegram.');
  if (!looksLikePost(platform, host, u)) {
    throw new BadRequestException('That looks like a profile link — open the post itself and copy its link from the share button.');
  }
  return { url: u.toString().slice(0, 2048), platform };
};

/** Post links have a recognisable shape per platform; profile links do not. */
const looksLikePost = (platform: string, host: string, u: URL): boolean => {
  const path = u.pathname;
  switch (platform) {
    case 'instagram':
      return /^\/(p|reel|reels|tv|stories)\//.test(path);
    case 'tiktok':
      return host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || /\/video\/\d+/.test(path) || /^\/t\//.test(path);
    case 'youtube':
      return host === 'youtu.be' ? path.length > 1 : /^\/(watch|shorts|live|post)\b/.test(path) || u.searchParams.has('v');
    case 'twitter':
      return /\/status\/\d+/.test(path);
    case 'facebook':
      return host === 'fb.watch' || /\/(posts|videos|reel|reels|share|photo|photos|watch|permalink\.php|story\.php)\b/.test(path) || u.searchParams.has('story_fbid') || u.searchParams.has('fbid');
    case 'linkedin':
      return /^\/(posts|feed\/update|pulse)\//.test(path);
    case 'twitch':
      return /^\/(videos|[^/]+\/clip)\//.test(path);
    case 'telegram':
      return /^\/[^/]+\/\d+/.test(path) || /^\/[cs]\/[^/]+\/\d+/.test(path);
    default:
      return path.length > 1;
  }
};

export const cleanFollowed = (raw: unknown): FollowPlatform[] => {
  const list = Array.isArray(raw) ? raw : [];
  const out = new Set<FollowPlatform>();
  for (const v of list) {
    const k = String(v || '').toLowerCase();
    if ((FOLLOW_PLATFORMS as readonly string[]).includes(k)) out.add(k as FollowPlatform);
  }
  return [...out];
};

export const emptyState = (): OnboardingState => ({});
