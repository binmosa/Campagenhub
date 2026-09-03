import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CreatorProfile } from './creator-profile.entity';
import { parseSocialLinks, serializeSocialLinks } from './social-links';

/**
 * FollowerVerificationService — automated checks for follower claims.
 *
 * Only YouTube has a free, public, keyed API for subscriber counts
 * (YouTube Data API v3). Set YOUTUBE_API_KEY and pending YouTube claims
 * are checked on save: a claim within 15% of (or below) the API figure is
 * verified automatically with the API figure recorded; anything else
 * stays in the admin queue with the API figure noted for the reviewer.
 * Instagram / TikTok / X have no public follower endpoint without a
 * business app review, so those stay manual.
 */
@Injectable()
export class FollowerVerificationService {
  constructor(
    @InjectRepository(CreatorProfile)
    private readonly profiles: Repository<CreatorProfile>,
  ) {}

  get youtubeEnabled(): boolean {
    return !!process.env.YOUTUBE_API_KEY;
  }

  /** Subscriber count for a channel URL, or null when unknown / disabled. */
  async fetchYoutubeSubscribers(url: string): Promise<number | null> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key || !url) return null;
    const m = url.match(/youtube\.com\/(?:@([^/?#]+)|channel\/([^/?#]+)|c\/([^/?#]+)|user\/([^/?#]+))/i);
    if (!m) return null;
    const params: Record<string, string> = { part: 'statistics', key };
    if (m[1]) params.forHandle = `@${decodeURIComponent(m[1])}`;
    else if (m[2]) params.id = m[2];
    else params.forUsername = decodeURIComponent(m[3] || m[4]);
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', { params, timeout: 8000 });
      const count = Number(res.data?.items?.[0]?.statistics?.subscriberCount);
      return Number.isFinite(count) ? count : null;
    } catch {
      return null;
    }
  }

  /** Fire-and-forget after a profile save. */
  autoVerify(userId: string): void {
    if (!this.youtubeEnabled) return;
    void this.run(userId).catch((e) => console.error('[followers] auto-verify failed:', e?.message));
  }

  private async run(userId: string): Promise<void> {
    const profile = await this.profiles.findOne({ where: { user: { id: userId } } });
    if (!profile) return;
    const map = parseSocialLinks(profile.social_links);
    const yt = map.youtube;
    if (!yt || yt.status !== 'pending' || !yt.followers) return;
    const api = await this.fetchYoutubeSubscribers(yt.url);
    if (api == null) return;
    if (yt.followers <= api * 1.15) {
      map.youtube = { ...yt, followers: api, verified_followers: api, status: 'verified', verified_at: new Date().toISOString(), note: 'Auto-verified via YouTube Data API' };
    } else {
      map.youtube = { ...yt, note: `Auto-check: YouTube reports ${api.toLocaleString()} subscribers` };
    }
    profile.social_links = serializeSocialLinks(map);
    await this.profiles.save(profile);
  }
}
