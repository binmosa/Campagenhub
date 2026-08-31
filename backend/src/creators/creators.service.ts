import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(CreatorProfile)
    private profileRepository: Repository<CreatorProfile>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
  async getAllPublicCreators(filters: {
    search?: string;
    category?: string;
    location?: string;
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
        'p.id', 'p.full_name', 'p.username', 'p.bio', 'p.category',
        'p.location', 'p.follower_range', 'p.avatar_url', 'p.social_links',
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
      full_name: c.full_name,
      username: c.username,
      bio: c.bio,
      category: c.category,
      location: c.location,
      follower_range: c.follower_range,
      follower_count: parseFollowers(c.follower_range),
      avatar_url: c.avatar_url,
      social_links: c.social_links,
    }));

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }
  async updateProfile(userId: string, data: Partial<CreatorProfile>): Promise<CreatorProfile> {
    let profile = await this.getProfile(userId);
    
    if (!profile) {
      // Create new profile mapped to user
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      profile = this.profileRepository.create({ ...data, user });
    } else {
      // Update existing
      this.profileRepository.merge(profile, data);
    }
    
    return this.profileRepository.save(profile);
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
        social_links: user.creatorProfile.social_links,
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
