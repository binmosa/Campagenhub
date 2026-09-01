import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/campaign.entity';
import { User, UserRole } from '../users/user.entity';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { BrandProfile } from '../brands/brand-profile.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';
import * as bcrypt from 'bcrypt';
import { State } from 'country-state-city';

/** Resolve ISO-3166-2 state codes from the dataset so seed rows carry
 *  the same stable join keys real registrations do. */
const withGeoCodes = (data: Record<string, any>) => {
  if (data.country_code && data.state && !data.state_code) {
    const s = State.getStatesOfCountry(data.country_code).find((x) => x.name === data.state);
    if (s) data.state_code = s.isoCode;
  }
  return data;
};

const SUPER_ADMIN_PERMISSIONS: Record<string, boolean> = {
  view_users: true,
  manage_users: true,
  view_campaigns: true,
  manage_campaigns: true,
  view_applications: true,
  manage_applications: true,
  view_payouts: true,
  manage_payouts: true,
  view_payments: true,
  manage_payments: true,
  view_kyc: true,
  approve_kyc: true,
  manage_roles: true,
  manage_permissions: true,
  manage_settings: true,
  view_reports: true,
  view_support: true,
  manage_support: true,
  view_finance: true,
  manage_finance: true,
};

interface SeedAccount {
  email: string;
  role: UserRole;
  permissions?: Record<string, boolean>;
  profile?: 'creator' | 'brand' | 'manager';
  /** Demo profile fields; applied on create, or onto an existing EMPTY profile. */
  profileData?: Record<string, any>;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    email: 'creator@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Lina', last_name: 'Benali', full_name: 'Lina Benali', username: 'linaeats', category: 'Food',
      location: 'Casablanca, Morocco', country: 'Morocco', country_code: 'MA', state: 'Casablanca-Settat', city: 'Casablanca', follower_range: '100K-500K',
      bio: 'Street food and slow recipes for people who cook on a Tuesday. I turn brand products into dishes my audience actually makes.',
      avatar_url: 'https://i.pravatar.cc/150?img=47',
      social_links: JSON.stringify({
        instagram: { url: 'https://instagram.com/linaeats', followers: 240000 },
        tiktok: { url: 'https://tiktok.com/@linaeats', followers: 180000 },
        youtube: { url: 'https://youtube.com/@linaeats', followers: 45000 },
      }),
    },
  },
  {
    email: 'creator2@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Omar', last_name: 'Diallo', full_name: 'Omar Diallo', username: 'omarjourneys', category: 'Travel',
      location: 'Dakar, Senegal', country: 'Senegal', country_code: 'SN', state: 'Dakar', city: 'Dakar', follower_range: '500K+',
      bio: 'Long-form travel films across West Africa. Gear reviews, hidden stays, and honest cost breakdowns.',
      avatar_url: 'https://i.pravatar.cc/150?img=12',
      social_links: JSON.stringify({
        youtube: { url: 'https://youtube.com/@omarjourneys', followers: 620000 },
        instagram: { url: 'https://instagram.com/omarjourneys', followers: 210000 },
        twitter: { url: 'https://x.com/omarjourneys', followers: 80000 },
      }),
    },
  },
  {
    email: 'creator3@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Ada', last_name: 'Okafor', full_name: 'Ada Okafor', username: 'code.with.ada', category: 'Tech',
      location: 'Lagos, Nigeria', country: 'Nigeria', country_code: 'NG', state: 'Lagos', city: 'Lagos', follower_range: '100K-500K',
      bio: 'Software career content and dev-tool deep dives. My audience buys what I can defend in a code review.',
      avatar_url: 'https://i.pravatar.cc/150?img=32',
      social_links: JSON.stringify({
        youtube: { url: 'https://youtube.com/@codewithada', followers: 155000 },
        twitter: { url: 'https://x.com/codewithada', followers: 95000 },
        linkedin: { url: 'https://linkedin.com/in/codewithada', followers: 60000 },
      }),
    },
  },
  {
    email: 'creator4@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Maya', last_name: 'Haddad', full_name: 'Maya Haddad', username: 'studioveda', category: 'Beauty',
      location: 'Dubai, United Arab Emirates', country: 'United Arab Emirates', country_code: 'AE', state: 'Dubai', city: 'Dubai', follower_range: '500K+',
      bio: 'No-filter skincare testing, four-week verdicts. If it stays in my routine, it earns the review.',
      social_links: JSON.stringify({
        instagram: { url: 'https://instagram.com/studioveda', followers: 830000 },
        tiktok: { url: 'https://tiktok.com/@studioveda', followers: 460000 },
        facebook: { url: 'https://facebook.com/studioveda', followers: 120000 },
      }),
    },
  },
  {
    email: 'creator5@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Jonas', last_name: 'Weber', full_name: 'Jonas Weber', username: 'jonaslifts', category: 'Fitness',
      location: 'Berlin, Germany', country: 'Germany', country_code: 'DE', state: 'Berlin', city: 'Berlin', follower_range: '10K-50K',
      bio: 'Strength training for desk workers. Small audience, absurd engagement — my comment section does my selling.',
      avatar_url: 'https://i.pravatar.cc/150?img=59',
      social_links: JSON.stringify({
        tiktok: { url: 'https://tiktok.com/@jonaslifts', followers: 28000 },
        instagram: { url: 'https://instagram.com/jonaslifts', followers: 14000 },
      }),
    },
  },
  {
    email: 'creator6@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Sofia', last_name: 'Reyes', full_name: 'Sofia Reyes', username: 'sofiaplays', category: 'Gaming',
      location: 'Mexico City, Mexico', country: 'Mexico', country_code: 'MX', state: 'Ciudad de Mexico', city: 'Mexico City', follower_range: '50K-100K',
      bio: 'Cozy games, chaotic streams. Bilingual community across six platforms with a Discord that never sleeps.',
      avatar_url: 'https://i.pravatar.cc/150?img=44',
      social_links: JSON.stringify({
        twitch: { url: 'https://twitch.tv/sofiaplays', followers: 38000 },
        youtube: { url: 'https://youtube.com/@sofiaplays', followers: 22000 },
        tiktok: { url: 'https://tiktok.com/@sofiaplays', followers: 15000 },
        instagram: { url: 'https://instagram.com/sofiaplays', followers: 9000 },
        twitter: { url: 'https://x.com/sofiaplays', followers: 5000 },
        facebook: { url: 'https://facebook.com/sofiaplays', followers: 3000 },
      }),
    },
  },
  {
    email: 'creator7@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Hanna', last_name: 'Tesfaye', full_name: 'Hanna Tesfaye',
      username: 'hanna.addis', category: 'Beauty',
      location: 'Addis Ababa, Ethiopia', country: 'Ethiopia', country_code: 'ET', state: 'Addis Ababa', city: 'Addis Ababa', follower_range: '100K-500K',
      bio: 'Habesha beauty and skincare in Amharic and English. My audience trusts what I put on my own skin first.',
      avatar_url: 'https://i.pravatar.cc/150?img=25',
      social_links: JSON.stringify({
        tiktok: { url: 'https://tiktok.com/@hanna.addis', followers: 320000 },
        instagram: { url: 'https://instagram.com/hanna.addis', followers: 110000 },
        youtube: { url: 'https://youtube.com/@hannaaddis', followers: 40000 },
      }),
    },
  },
  {
    email: 'creator8@test.com', role: UserRole.CREATOR, profile: 'creator',
    profileData: {
      first_name: 'Dawit', last_name: 'Bekele', full_name: 'Dawit Bekele',
      username: 'dawit.films', category: 'Comedy',
      location: 'Addis Ababa, Ethiopia', country: 'Ethiopia', country_code: 'ET', state: 'Addis Ababa', city: 'Addis Ababa', follower_range: '50K-100K',
      bio: 'Sketch comedy about Addis life. Telegram community of 60K that shares everything I post.',
      avatar_url: 'https://i.pravatar.cc/150?img=68',
      social_links: JSON.stringify({
        youtube: { url: 'https://youtube.com/@dawitfilms', followers: 85000 },
        tiktok: { url: 'https://tiktok.com/@dawit.films', followers: 54000 },
        facebook: { url: 'https://facebook.com/dawitfilms', followers: 30000 },
      }),
    },
  },
  {
    email: 'brand@test.com', role: UserRole.BRAND, profile: 'brand',
    profileData: {
      company_name: 'Northwind Labs', industry: 'Consumer Tech',
      description: 'Demo brand running creator campaigns across platforms.',
    },
  },
  { email: 'manager@test.com', role: UserRole.MANAGER, profile: 'manager' },
  { email: 'superadmin@test.com', role: UserRole.ADMIN, permissions: SUPER_ADMIN_PERMISSIONS },
];

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CreatorProfile)
    private creatorProfiles: Repository<CreatorProfile>,
    @InjectRepository(BrandProfile)
    private brandProfiles: Repository<BrandProfile>,
    @InjectRepository(ManagerProfile)
    private managerProfiles: Repository<ManagerProfile>,
  ) {}

  async onModuleInit() {
    if (process.env.ENABLE_SEED !== 'true') return;
    if (!process.env.SEED_PASSWORD) {
      throw new Error('SEED_PASSWORD is required when ENABLE_SEED=true');
    }
    await this.seedAccounts();
    await this.seedCampaigns();
  }

  private async seedAccounts() {
    const hashedPassword = await bcrypt.hash(process.env.SEED_PASSWORD as string, 10);

    for (const account of SEED_ACCOUNTS) {
      let user = await this.usersRepository.findOne({ where: { email: account.email } });

      const desiredState = {
        email: account.email,
        password_hash: hashedPassword,
        role: account.role,
        account_status: 'active',
        kyc_status: 'approved',
        is_banned: false,
        permissions: account.permissions ?? null,
      };

      if (!user) {
        user = this.usersRepository.create(desiredState);
        await this.usersRepository.save(user);
      } else {
        Object.assign(user, desiredState);
        await this.usersRepository.save(user);
      }

      if (account.profile === 'creator') {
        const exists = await this.creatorProfiles.findOne({ where: { user: { id: user.id } }, relations: ['user'] });
        if (!exists) {
          await this.creatorProfiles.save(
            this.creatorProfiles.create({ user: { id: user.id }, ...withGeoCodes({ ...(account.profileData || {}) }) } as any),
          );
        } else if (
          account.profileData &&
          (!exists.full_name || !(exists.social_links || '').includes('"url"') || !exists.country || !exists.country_code || !exists.first_name)
        ) {
          // Fill demo data on empty profiles, and upgrade seed profiles still
          // carrying the old link format. Real (non-empty, upgraded) profiles
          // are never stomped.
          Object.assign(exists, withGeoCodes({ ...account.profileData }));
          await this.creatorProfiles.save(exists);
        }
      } else if (account.profile === 'brand') {
        const exists = await this.brandProfiles.findOne({ where: { user: { id: user.id } }, relations: ['user'] });
        if (!exists) {
          await this.brandProfiles.save(
            this.brandProfiles.create({ user: { id: user.id }, ...(account.profileData || {}) } as any),
          );
        } else if (account.profileData && !exists.industry) {
          Object.assign(exists, account.profileData);
          await this.brandProfiles.save(exists);
        }
      } else if (account.profile === 'manager') {
        const exists = await this.managerProfiles.findOne({ where: { user: { id: user.id } }, relations: ['user'] });
        if (!exists) {
          await this.managerProfiles.save(this.managerProfiles.create({ user: { id: user.id } as any }));
        }
      }
    }

    console.log('[Seed] Test accounts ready:');
    SEED_ACCOUNTS.forEach((a) => console.log(`  ${a.role.padEnd(8)} → ${a.email}`));
  }

  private async seedCampaigns() {
    const count = await this.campaignsRepository.count();
    if (count > 0) return;

    const brand = await this.usersRepository.findOne({ where: { email: 'brand@test.com' } });
    if (!brand) return;

    const dummyCampaigns = [
      {
        title: 'Summer Fitness Challenge',
        description: 'Looking for energetic fitness creators to showcase our new summer line. Must involve outdoor workout routines.',
        budget: 250000,
        currency: 'ETB',
        platform: 'TikTok, Instagram',
        content_type: 'Video',
        objective: 'Awareness',
        target_audience: 'Fitness enthusiasts, 18-35',
        status: 'active',
        brand,
      },
      {
        title: 'Tech Unboxing Series',
        description: 'Tech reviewers needed for unboxing our latest smart home devices. Authentic opinions valued.',
        budget: 3500,
        platform: 'YouTube, Instagram',
        content_type: 'Video',
        objective: 'Conversions',
        target_audience: 'Tech savvy, homeowners',
        status: 'active',
        brand,
      },
      {
        title: 'Streetwear Lifestyle Campaign',
        description: 'Fashion/Streetwear creators to seamlessly integrate our fall drop into your daily vlog or outfit checks.',
        budget: 12000,
        platform: 'Instagram',
        target_audience: 'Fashion forward, urban',
        status: 'active',
        brand,
      },
    ];

    for (const campaign of dummyCampaigns) {
      await this.campaignsRepository.save(this.campaignsRepository.create(campaign));
    }
  }
}
