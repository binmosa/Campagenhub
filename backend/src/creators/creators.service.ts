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

  async getAllPublicCreators(filters: {
    search?: string;
    category?: string;
    location?: string;
    minFollowers?: string;
    maxFollowers?: string;
    sort?: string;
  }): Promise<any[]> {
    // Fetch all active creators
    const all = await this.profileRepository.find({
      relations: ['user'],
      where: { user: { account_status: 'active', role: 'creator' } },
      select: {
        id: true,
        full_name: true,
        username: true,
        bio: true,
        category: true,
        location: true,
        follower_range: true,
        avatar_url: true,
        social_links: true,
        user: { id: true, account_status: true }
      }
    });

    const parseFollowers = (range: string | null): number => {
      if (!range) return 0;
      return parseInt(range.replace(/[^0-9]/g, '')) || 0;
    };

    let results = all.map(c => ({
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

    // Apply filters
    if (filters.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(c =>
        c.full_name?.toLowerCase().includes(s) ||
        c.username?.toLowerCase().includes(s) ||
        c.bio?.toLowerCase().includes(s) ||
        c.category?.toLowerCase().includes(s)
      );
    }
    if (filters.category) {
      results = results.filter(c => c.category?.toLowerCase().includes(filters.category!.toLowerCase()));
    }
    if (filters.location) {
      results = results.filter(c => c.location?.toLowerCase().includes(filters.location!.toLowerCase()));
    }
    if (filters.minFollowers) {
      const min = parseInt(filters.minFollowers);
      results = results.filter(c => c.follower_count >= min);
    }
    if (filters.maxFollowers) {
      const max = parseInt(filters.maxFollowers);
      results = results.filter(c => c.follower_count <= max);
    }

    // Sort
    if (filters.sort === 'followers_desc') {
      results.sort((a, b) => b.follower_count - a.follower_count);
    } else if (filters.sort === 'followers_asc') {
      results.sort((a, b) => a.follower_count - b.follower_count);
    } else if (filters.sort === 'name') {
      results.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }

    return results;
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
