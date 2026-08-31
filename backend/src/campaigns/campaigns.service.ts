import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { User, UserRole } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService,
    private telegramService: TelegramService,
  ) {}

  /** Safe field list for PUBLIC campaign responses — never the full brand
   *  User row (which carries password_hash + KYC documents). */
  private publicCampaignQb() {
    return this.campaignsRepository
      .createQueryBuilder('c')
      .leftJoin('c.brand', 'b')
      .leftJoin('b.brandProfile', 'bp')
      .where('c.status = :status', { status: 'active' })
      .select([
        'c.id', 'c.title', 'c.description', 'c.budget', 'c.platform',
        'c.target_audience', 'c.deadline', 'c.status', 'c.cover_image',
        'c.contract_template', 'c.created_at',
        'b.id', 'b.account_status',
        'bp.id', 'bp.company_name', 'bp.logo_url', 'bp.industry',
      ]);
  }

  async getActiveCampaigns(): Promise<Campaign[]> {
    return this.publicCampaignQb().orderBy('c.created_at', 'DESC').getMany();
  }

  /**
   * Public campaign directory — filtered, sorted, and paginated in SQL,
   * with an applicant count per campaign. Returns { items, total, hasMore }.
   */
  async getPublicCampaigns(filters: {
    search?: string;
    platform?: string;
    sort?: string;
    limit?: string;
    offset?: string;
  }): Promise<{ items: any[]; total: number; limit: number; offset: number; hasMore: boolean }> {
    const limit = Math.min(Math.max(parseInt(filters.limit || '18') || 18, 1), 100);
    const offset = Math.max(parseInt(filters.offset || '0') || 0, 0);

    const qb = this.publicCampaignQb();

    if (filters.search) {
      qb.andWhere(
        '(c.title ILIKE :s OR c.description ILIKE :s OR bp.company_name ILIKE :s)',
        { s: `%${filters.search}%` },
      );
    }
    if (filters.platform) {
      const p = filters.platform.toLowerCase().trim();
      if (p === 'twitter') {
        qb.andWhere("(c.platform ILIKE '%twitter%' OR LOWER(TRIM(c.platform)) = 'x')");
      } else if (p === 'other') {
        qb.andWhere(
          "(c.platform IS NULL OR (c.platform NOT ILIKE '%tiktok%' AND c.platform NOT ILIKE '%instagram%' AND c.platform NOT ILIKE '%youtube%' AND c.platform NOT ILIKE '%twitter%' AND LOWER(TRIM(c.platform)) != 'x' AND c.platform NOT ILIKE '%twitch%' AND c.platform NOT ILIKE '%linkedin%'))",
        );
      } else {
        qb.andWhere('c.platform ILIKE :pf', { pf: `%${p}%` });
      }
    }

    const total = await qb.getCount();

    if (filters.sort === 'budget') {
      qb.orderBy('c.budget', 'DESC', 'NULLS LAST');
    } else if (filters.sort === 'deadline') {
      qb.orderBy('c.deadline', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('c.created_at', 'DESC'); // default: newest briefs first
    }
    qb.addOrderBy('c.id', 'ASC'); // stable tiebreak so pages never overlap

    // Applicant count per campaign (applications has FK column campaign_id).
    qb.addSelect(
      (sub) =>
        sub.select('COUNT(*)').from('applications', 'a').where('a.campaign_id = c.id'),
      'applicants_count',
    );

    const { entities, raw } = await qb.offset(offset).limit(limit).getRawAndEntities();

    const items = entities.map((c, i) => ({
      ...c,
      applicants_count: Number(raw[i]?.applicants_count) || 0,
    }));

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  async getCampaignsByBrand(brandId: string): Promise<Campaign[]> {
    return this.campaignsRepository.find({
      where: { brand: { id: brandId } },
      relations: ['brand', 'brand.brandProfile'],
      order: { created_at: 'DESC' },
    });
  }

  // Stock cover images by category (from Unsplash)
  private readonly COVER_IMAGES: Record<string, string[]> = {
    fashion: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=400&fit=crop',
    ],
    tech: [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=400&fit=crop',
    ],
    food: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=400&fit=crop',
    ],
    fitness: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=400&fit=crop',
    ],
    beauty: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&h=400&fit=crop',
    ],
    general: [
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=400&fit=crop',
    ],
  };

  private pickCoverImage(title: string, description?: string): string {
    const text = ((title || '') + ' ' + (description || '')).toLowerCase();
    const categories: Record<string, string[]> = {
      fashion: ['fashion', 'style', 'clothing', 'apparel', 'wear', 'outfit'],
      tech: ['tech', 'software', 'app', 'gadget', 'digital', 'ai', 'saas'],
      food: ['food', 'restaurant', 'recipe', 'cooking', 'organic', 'snack', 'beverage'],
      fitness: ['fitness', 'gym', 'workout', 'health', 'wellness', 'sport'],
      beauty: ['beauty', 'skincare', 'makeup', 'cosmetic', 'hair', 'fragrance'],
    };
    for (const [cat, kws] of Object.entries(categories)) {
      if (kws.some(k => text.includes(k))) {
        const imgs = this.COVER_IMAGES[cat];
        return imgs[Math.floor(Math.random() * imgs.length)];
      }
    }
    const gen = this.COVER_IMAGES.general;
    return gen[Math.floor(Math.random() * gen.length)];
  }

  async createCampaign(user: any, data: Partial<Campaign>): Promise<Campaign> {
    const campaign = this.campaignsRepository.create({
      ...data,
      brand: { id: user.userId } as User,
      status: 'active',
      cover_image: (data as any).cover_image || this.pickCoverImage(data.title || '', data.description),
    });
    
    const saved = await this.campaignsRepository.save(campaign);

    // Notify creators via in-app notifications
    const creators = await this.usersRepository.find({ where: { role: UserRole.CREATOR } });
    for (const creator of creators) {
      await this.notificationsService.createNotification(
        creator.id,
        'NEW_CAMPAIGN',
        `A new campaign "${saved.title}" was just posted! Check it out and apply.`,
        saved.id
      );
    }

    // Broadcast to Telegram if enabled
    if ((data as any).post_to_telegram) {
      const budgetStr = saved.budget ? `$${Number(saved.budget).toLocaleString()}` : 'TBD';
      const msg = `🚀 *New Campaign Alert!*\n\n📋 *${saved.title}*\n💰 Budget: ${budgetStr}\n📱 Platform: ${saved.platform || 'Multiple'}\n\n${saved.description ? saved.description.substring(0, 200) : 'Check out this opportunity!'}\n\n🔗 Apply here: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/campaigns`;
      this.telegramService.broadcastToRole('creator', msg).catch(e => console.error('Telegram broadcast error:', e));
    }

    return saved;
  }

  async updateCampaign(campaignId: string, brandId: string, data: Partial<Campaign>): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['brand'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.brand.id !== brandId) throw new UnauthorizedException('Not authorized');

    Object.assign(campaign, data);
    return this.campaignsRepository.save(campaign);
  }

  async deleteCampaign(campaignId: string, brandId: string): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['brand'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.brand.id !== brandId) throw new UnauthorizedException('Not authorized');

    await this.campaignsRepository.remove(campaign);
  }
}
