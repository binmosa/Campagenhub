import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorProfile } from './creator-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowerVerificationService } from './follower-verification.service';
import { decideClaim, parseSocialLinks, publicSocialLinks, reconcileSocialLinks } from './social-links';
import { User, type OnboardingState } from '../users/user.entity';
import { withDerivedFullName } from '../core/name.util';
import { cleanFollowed, parseWelcomePostUrl } from './onboarding';

const CREATOR_WRITABLE = [
  'first_name', 'last_name', 'full_name', 'username', 'category', 'location',
  'country', 'country_code', 'state', 'state_code', 'city',
  'follower_range', 'social_links', 'bio', 'avatar_url', 'phone',
] as const;

/** Creator handles: 3–30 chars of a-z 0-9 _ . — and nothing that reads as staff. */
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_.]{1,28})[a-z0-9]$/;
const RESERVED_HANDLES = new Set(['admin', 'administrator', 'support', 'campaignhubz', 'campaign_hubz', 'staff', 'official', 'root', 'system', 'help', 'moderator', 'mod']);

const pickWritableProfile = (data: any): Partial<CreatorProfile> => {
  const out: any = {};
  if (!data || typeof data !== 'object') return out;
  for (const k of CREATOR_WRITABLE) if (data[k] !== undefined) out[k] = data[k];
  return out;
};

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(CreatorProfile)
    private profileRepository: Repository<CreatorProfile>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
      private readonly notificationsService: NotificationsService,
    private readonly followerVerification: FollowerVerificationService,
  ) {}

  async getProfile(userId: string): Promise<CreatorProfile | null> {
    return this.profileRepository.findOne({ where: { user: { id: userId } } });
  }

  /**
   * Public creator directory — filtered, sorted, and paginated in SQL so it
   * stays fast at hundreds/thousands of records.
   *
   * `follower_range` is a display string ("10K-100K"), so numeric comparisons
   * use a SQL expression that strips non-digits and casts — the same lossy
   * parse the old in-memory code did, but done by Postgres with LIMIT/OFFSET.
   *
   * Returns { items, total, limit, offset, hasMore }.
   */
  /**
   * Location facets — the distinct (country, city) pairs of ACTIVE creators
   * with counts, so filter dropdowns only offer places creators actually are.
   */
  async getCreatorLocations(): Promise<{ country: string; city: string | null; count: number }[]> {
    const rows = await this.profileRepository
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .where('u.account_status = :status', { status: 'active' })
      .andWhere('u.role = :role', { role: 'creator' })
      .andWhere("COALESCE(p.country, '') != ''")
      .select('p.country', 'country')
      .addSelect('p.country_code', 'country_code')
      .addSelect('p.city', 'city')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.country')
      .addGroupBy('p.country_code')
      .addGroupBy('p.city')
      .orderBy('p.country', 'ASC')
      .addOrderBy('p.city', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      country: r.country,
      country_code: r.country_code || null,
      city: r.city || null,
      count: Number(r.count) || 0,
    }));
  }

  async getAllPublicCreators(filters: {
    search?: string;
    category?: string;
    location?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    minFollowers?: string;
    maxFollowers?: string;
    platforms?: string;
    sort?: string;
    limit?: string;
    offset?: string;
  }): Promise<{ items: any[]; total: number; limit: number; offset: number; hasMore: boolean }> {
    // Lower bound of the follower_range string with proper K/M units:
    // "500K+" -> 500000, "100K-500K" -> 100000, "1M+" -> 1000000.
    const FIRST_NUM =
      "COALESCE(NULLIF(SUBSTRING(COALESCE(p.follower_range,'') FROM '(\\d+(?:\\.\\d+)?)'), '')::numeric, 0)";
    const FOLLOWERS_SQL = `(CASE
      WHEN COALESCE(p.follower_range,'') ~* '^\\s*\\d+(\\.\\d+)?\\s*M' THEN ${FIRST_NUM} * 1000000
      WHEN COALESCE(p.follower_range,'') ~* '^\\s*\\d+(\\.\\d+)?\\s*K' THEN ${FIRST_NUM} * 1000
      ELSE ${FIRST_NUM}
    END)`;

    const limit = Math.min(Math.max(parseInt(filters.limit || '24') || 24, 1), 100);
    const offset = Math.max(parseInt(filters.offset || '0') || 0, 0);

    const qb = this.profileRepository
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .where('u.account_status = :status', { status: 'active' })
      .andWhere('u.role = :role', { role: 'creator' })
      .select([
        'p.id', 'p.first_name', 'p.last_name', 'p.full_name', 'p.username', 'p.bio', 'p.category',
        'p.location', 'p.country', 'p.country_code', 'p.state', 'p.state_code', 'p.city',
        'p.follower_range', 'p.avatar_url', 'p.social_links',
        'u.id',
      ]);

    if (filters.search) {
      qb.andWhere(
        '(p.full_name ILIKE :s OR p.username ILIKE :s OR p.bio ILIKE :s OR p.category ILIKE :s)',
        { s: `%${filters.search}%` },
      );
    }
    if (filters.category) {
      qb.andWhere('p.category ILIKE :cat', { cat: `%${filters.category}%` });
    }
    if (filters.location) {
      qb.andWhere('p.location ILIKE :loc', { loc: `%${filters.location}%` });
    }
    if (filters.country) {
      qb.andWhere('LOWER(p.country) = LOWER(:country)', { country: filters.country });
    }
    if (filters.countryCode) {
      qb.andWhere('LOWER(p.country_code) = LOWER(:cc)', { cc: filters.countryCode });
    }
    if (filters.city) {
      qb.andWhere('LOWER(p.city) = LOWER(:city)', { city: filters.city });
    }
    if (filters.minFollowers) {
      qb.andWhere(`${FOLLOWERS_SQL} >= :minF`, { minF: parseInt(filters.minFollowers) || 0 });
    }
    if (filters.maxFollowers) {
      qb.andWhere(`${FOLLOWERS_SQL} <= :maxF`, { maxF: parseInt(filters.maxFollowers) || 0 });
    }
    if (filters.platforms) {
      // CSV of platform keys; matched against the creator's social links JSON.
      const keys = filters.platforms.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 6);
      if (keys.length) {
        const clauses = keys.map((_, i) => `p.social_links ILIKE :pf${i}`);
        const params: Record<string, string> = {};
        keys.forEach((k, i) => { params[`pf${i}`] = `%${k}%`; });
        qb.andWhere(`(${clauses.join(' OR ')})`, params);
      }
    }

    const total = await qb.getCount();

    if (filters.sort === 'name') {
      qb.orderBy('p.full_name', 'ASC', 'NULLS LAST');
    } else if (filters.sort === 'followers_asc') {
      qb.orderBy(FOLLOWERS_SQL, 'ASC');
    } else {
      qb.orderBy(FOLLOWERS_SQL, 'DESC'); // default: biggest audiences first
    }
    qb.addOrderBy('p.id', 'ASC'); // stable tiebreak so pages never overlap

    // .offset/.limit (raw SQL) rather than .skip/.take: take() builds a
    // pagination subquery that cannot parse the raw ORDER BY expression, and
    // the user join is 1:1 so raw LIMIT/OFFSET is exact here.
    const rows = await qb.offset(offset).limit(limit).getMany();

    const parseFollowers = (range: string | null): number => {
      if (!range) return 0;
      const m = range.match(/(\d+(?:\.\d+)?)\s*([KkMm]?)/);
      if (!m) return 0;
      const unit = (m[2] || '').toLowerCase();
      return Math.round(parseFloat(m[1]) * (unit === 'm' ? 1_000_000 : unit === 'k' ? 1000 : 1));
    };

    const items = rows.map((c) => ({
      id: c.user?.id || c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      full_name: c.full_name,
      username: c.username,
      bio: c.bio,
      category: c.category,
      location: c.location,
      country: c.country,
      country_code: c.country_code,
      state: c.state,
      state_code: c.state_code,
      city: c.city,
      follower_range: c.follower_range,
      follower_count: parseFollowers(c.follower_range),
      avatar_url: c.avatar_url,
      social_links: publicSocialLinks(c.social_links),
    }));

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }
  async updateProfile(userId: string, data: Partial<CreatorProfile>): Promise<CreatorProfile> {
    // `merge` copies every column it is handed, primary key included, so an
    // unfiltered body could carry `id` and rewrite somebody else's profile.
    // Only these presentation fields are ever client-writable.
    data = withDerivedFullName(pickWritableProfile(data));
    if (typeof data.username === 'string') {
      const handle = data.username.trim().toLowerCase().replace(/^@+/, '');
      if (handle && !HANDLE_RE.test(handle)) throw new BadRequestException('Handles are 3–30 letters, numbers, dots or underscores.');
      if (RESERVED_HANDLES.has(handle)) throw new BadRequestException('That handle is reserved — pick another one.');
      data.username = handle || (null as any);
    }
    if (typeof data.phone === 'string') {
      const digits = data.phone.replace(/[^\d+]/g, '');
      if (digits && !/^\+\d{6,15}$/.test(digits)) throw new BadRequestException('Enter the phone number with its country code.');
      data.phone = digits || (null as any);
    }
    let profile = await this.getProfile(userId);

    // Follower counts are claims: the server decides their verification
    // state from what changed — clients can't mark themselves verified.
    if (data.social_links !== undefined) {
      data.social_links = reconcileSocialLinks(profile?.social_links, data.social_links);
    }

    if (!profile) {
      // Create new profile mapped to user
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      profile = this.profileRepository.create({ ...data, user });
    } else {
      // Update existing
      this.profileRepository.merge(profile, data);
    }
    
    let saved: CreatorProfile;
    try {
      saved = await this.profileRepository.save(profile);
    } catch (e: any) {
      // Postgres unique violation — the only unique presentation field is `username`.
      if (e?.code === '23505') throw new ConflictException('That handle is already taken — try another one.');
      throw e;
    }
    this.followerVerification.autoVerify(userId);
    return saved;
  }

  /* ── Follower claims (admin) ─────────────────────────────────────── */

  /**
   * Every platform entry currently awaiting review, newest claim first.
   * "Pending" also includes channels with a link but no follower count
   * (`unverified`) — creators from guided onboarding never type a number,
   * so the reviewer looks the account up and enters the count they verify.
   */
  async listFollowerClaims(status: 'pending' | 'rejected' | 'verified' = 'pending'): Promise<any[]> {
    const qb = this.profileRepository
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select(['p.id', 'p.full_name', 'p.username', 'p.avatar_url', 'p.category', 'p.location', 'p.social_links', 'p.updated_at', 'u.id', 'u.email']);
    if (status === 'pending') {
      qb.where('(p.social_links ILIKE :s1 OR p.social_links ILIKE :s2)', { s1: '%"status":"pending"%', s2: '%"status":"unverified"%' });
    } else {
      qb.where('p.social_links ILIKE :s', { s: `%"status":"${status}"%` });
    }
    const rows = await qb.getMany();
    const claims: any[] = [];
    for (const p of rows) {
      const map = parseSocialLinks(p.social_links);
      for (const [platform, e] of Object.entries(map)) {
        const unclaimed = e.status === 'unverified' && !!e.url;
        if (!(e.status === status || (status === 'pending' && unclaimed))) continue;
        claims.push({
          user_id: p.user?.id,
          email: p.user?.email,
          full_name: p.full_name,
          username: p.username,
          avatar_url: p.avatar_url,
          category: p.category,
          location: p.location,
          platform,
          url: e.url,
          followers: e.followers,
          verified_followers: e.verified_followers,
          claimed_at: e.claimed_at || (e.status === 'unverified' ? p.updated_at?.toISOString?.() : undefined),
          verified_at: e.verified_at,
          evidence_url: e.evidence_url,
          note: e.note,
          status: e.status === 'unverified' ? 'pending' : e.status,
          /** false = the creator gave a link only; the reviewer supplies the count. */
          has_count: !!e.followers,
        });
      }
    }
    return claims.sort((a, b) => new Date(b.claimed_at || 0).getTime() - new Date(a.claimed_at || 0).getTime());
  }

  async decideFollowerClaim(
    userId: string,
    platform: string,
    decision: { action: 'verify' | 'reject'; verified_followers?: number; note?: string },
    adminEmail?: string,
  ): Promise<any> {
    const profile = await this.getProfile(userId);
    if (!profile) throw new NotFoundException('Creator profile not found');
    const result = decideClaim(profile.social_links, platform, { ...decision, by: adminEmail ? `Verified by ${adminEmail}` : undefined });
    if (!result) throw new NotFoundException('No claim for that platform');
    profile.social_links = result.raw;
    await this.profileRepository.save(profile);
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    await this.notificationsService
      .createNotification(
        userId,
        decision.action === 'verify' ? 'FOLLOWERS_VERIFIED' : 'FOLLOWERS_REJECTED',
        decision.action === 'verify'
          ? `Your ${label} audience of ${Number(result.entry.verified_followers || 0).toLocaleString()} followers is now verified — brands see the badge on your profile.`
          : `We couldn't verify your ${label} follower count${decision.note ? `: ${decision.note}` : ''}. Update the number or add a screenshot of your analytics and resubmit.`,
      )
      .catch(() => {});
    return { platform, ...result.entry };
  }

  /** Live availability for a creator handle (case-insensitive, own handle allowed). */
  async checkHandle(userId: string, raw: unknown): Promise<{ handle: string; available: boolean; reason?: 'format' | 'reserved' | 'taken' }> {
    const handle = String(raw || '').trim().toLowerCase().replace(/^@+/, '');
    if (!HANDLE_RE.test(handle)) return { handle, available: false, reason: 'format' };
    if (RESERVED_HANDLES.has(handle)) return { handle, available: false, reason: 'reserved' };
    const other = await this.profileRepository
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .where('LOWER(p.username) = :h', { h: handle })
      .andWhere('u.id != :me', { me: userId })
      .getCount();
    return other > 0 ? { handle, available: false, reason: 'taken' } : { handle, available: true };
  }

  /* ── Onboarding ──────────────────────────────────────────────────── */

  /** Where a creator is in their first-session setup. */
  async getOnboarding(userId: string): Promise<{ completed: boolean; completed_at: Date | null; state: OnboardingState; has_channels: boolean; terms_accepted_at: Date | null; terms_version: string | null }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const profile = await this.getProfile(userId);
    const hasChannels = Object.keys(parseSocialLinks(profile?.social_links)).length > 0;
    return {
      completed: !!user.onboarding_completed_at,
      completed_at: user.onboarding_completed_at,
      state: user.onboarding || {},
      has_channels: hasChannels,
      terms_accepted_at: user.terms_accepted_at,
      terms_version: user.terms_version,
    };
  }

  async recordFollowed(userId: string, platforms: unknown): Promise<OnboardingState> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.onboarding = { ...(user.onboarding || {}), followed: cleanFollowed(platforms) };
    await this.usersRepository.save(user);
    return user.onboarding;
  }

  /** The creator's post about Campaign Hubz — queued for an admin to check. */
  async submitWelcomePost(userId: string, rawUrl: unknown): Promise<OnboardingState> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const { url, platform } = parseWelcomePostUrl(rawUrl);
    const prev = user.onboarding || {};
    // Re-submitting the same approved link is a no-op; anything new is reviewed again.
    if (prev.post_status === 'approved' && prev.post_url === url) return prev;
    user.onboarding = { ...prev, post_url: url, post_platform: platform, post_submitted_at: new Date().toISOString(), post_status: 'pending', post_note: undefined, post_reviewed_at: undefined };
    await this.usersRepository.save(user);
    return user.onboarding;
  }

  /** Record acceptance of the creator agreement (version, time, origin). Idempotent per version. */
  async acceptTerms(userId: string, version: unknown, origin: { ip?: string; userAgent?: string }): Promise<{ terms_accepted_at: Date; terms_version: string }> {
    const v = String(version || '').trim().slice(0, 32);
    if (!v) throw new BadRequestException('Terms version is required.');
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.terms_accepted_at || user.terms_version !== v) {
      await this.usersRepository.update(
        { id: userId },
        {
          terms_accepted_at: new Date(),
          terms_version: v,
          terms_accepted_ip: (origin.ip || '').slice(0, 64) || null,
          terms_accepted_user_agent: (origin.userAgent || '').slice(0, 512) || null,
        },
      );
      const fresh = await this.usersRepository.findOne({ where: { id: userId } });
      return { terms_accepted_at: fresh!.terms_accepted_at!, terms_version: fresh!.terms_version! };
    }
    return { terms_accepted_at: user.terms_accepted_at, terms_version: user.terms_version! };
  }

  /** Finish onboarding. Needs at least one channel so verification has something to check. */
  async completeOnboarding(userId: string): Promise<{ completed: boolean; completed_at: Date | null }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.onboarding_completed_at) {
      const profile = await this.getProfile(userId);
      if (Object.keys(parseSocialLinks(profile?.social_links)).length === 0) {
        throw new BadRequestException('Add at least one social media channel first.');
      }
      if (!user.terms_accepted_at) throw new BadRequestException('Please accept the creator agreement first.');
      user.onboarding_completed_at = new Date();
      await this.usersRepository.save(user);
    }
    return { completed: true, completed_at: user.onboarding_completed_at };
  }

  /* ── Welcome posts (admin) ───────────────────────────────────────── */

  async listWelcomePosts(status: 'pending' | 'approved' | 'rejected' = 'pending'): Promise<any[]> {
    const rows = await this.usersRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.creatorProfile', 'p')
      .where('u.role = :role', { role: 'creator' })
      .andWhere('u.onboarding IS NOT NULL')
      .andWhere("u.onboarding::text ILIKE :s", { s: `%"post_status":"${status}"%` })
      .getMany();
    return rows
      .filter((u) => u.onboarding?.post_status === status && u.onboarding?.post_url)
      .map((u) => ({
        user_id: u.id,
        email: u.email,
        full_name: u.creatorProfile?.full_name,
        username: u.creatorProfile?.username,
        avatar_url: u.creatorProfile?.avatar_url,
        category: u.creatorProfile?.category,
        location: u.creatorProfile?.location,
        followed: u.onboarding?.followed || [],
        url: u.onboarding?.post_url,
        platform: u.onboarding?.post_platform,
        submitted_at: u.onboarding?.post_submitted_at,
        reviewed_at: u.onboarding?.post_reviewed_at,
        note: u.onboarding?.post_note,
        status: u.onboarding?.post_status,
      }))
      .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
  }

  async decideWelcomePost(userId: string, decision: { action: 'approve' | 'reject'; note?: string }): Promise<OnboardingState> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || !user.onboarding?.post_url) throw new NotFoundException('No welcome post for that creator');
    const approved = decision.action === 'approve';
    user.onboarding = { ...user.onboarding, post_status: approved ? 'approved' : 'rejected', post_note: decision.note?.slice(0, 500) || undefined, post_reviewed_at: new Date().toISOString() };
    await this.usersRepository.save(user);
    await this.notificationsService
      .createNotification(
        userId,
        approved ? 'WELCOME_POST_APPROVED' : 'WELCOME_POST_REJECTED',
        approved
          ? 'Thanks for sharing Campaign Hubz with your audience — your welcome post is approved.'
          : `We could not accept your welcome post${decision.note ? `: ${decision.note}` : ''}. Share a new link from your home page.`,
      )
      .catch(() => {});
    return user.onboarding;
  }

  async getPublicProfile(userId: string): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['creatorProfile', 'brandProfile'],
    });
    if (!user) return null;

    if (user.creatorProfile) {
      return {
        id: user.id,
        role: user.role,
        full_name: user.creatorProfile.full_name,
        username: user.creatorProfile.username,
        category: user.creatorProfile.category,
        location: user.creatorProfile.location,
        follower_range: user.creatorProfile.follower_range,
        bio: user.creatorProfile.bio,
        avatar_url: user.creatorProfile.avatar_url,
        social_links: publicSocialLinks(user.creatorProfile.social_links),
        joined: user.created_at,
      };
    }

    if (user.brandProfile) {
      return {
        id: user.id,
        role: user.role,
        full_name: user.brandProfile.company_name,
        username: null,
        category: user.brandProfile.industry,
        location: null,
        follower_range: null,
        bio: user.brandProfile.description,
        avatar_url: user.brandProfile.logo_url,
        social_links: null,
        joined: user.created_at,
      };
    }

    return {
      id: user.id,
      role: user.role,
      full_name: user.email.split('@')[0],
      username: null,
      category: null,
      location: null,
      follower_range: null,
      bio: null,
      avatar_url: null,
      social_links: null,
      joined: user.created_at,
    };
  }
}
