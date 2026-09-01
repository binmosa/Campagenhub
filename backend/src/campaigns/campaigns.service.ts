import { Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { User, UserRole } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { FxService } from '../fx/fx.service';
import { TranslationsService } from '../translations/translations.service';

/** SQL expression for the canonical USD budget: the stored budget_usd,
 *  falling back to the raw budget for legacy USD rows not yet backfilled. */
const BUDGET_USD_SQL = "COALESCE(c.budget_usd, CASE WHEN c.currency = 'USD' THEN c.budget END)";

@Injectable()
export class CampaignsService implements OnModuleInit {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService,
    private telegramService: TelegramService,
    private fxService: FxService,
    private translationsService: TranslationsService,
  ) {}

  onModuleInit() {
    // FX backfill for pre-existing rows, then a periodic translation sweep
    // that retries anything the inline post-time pass missed.
    this.fxService.whenReady().then(() => {
      this.backfillBudgetUsd().catch((e) => console.error('[FX] backfill failed:', e?.message));
      this.sweepTranslations().catch(() => {});
      setInterval(() => this.sweepTranslations().catch(() => {}), 15 * 60 * 1000).unref?.();
    });
  }

  /** Lock the USD value + rate on a campaign from today's snapshot. */
  private applyFx(campaign: Campaign): void {
    const budget = Number(campaign.budget);
    if (!Number.isFinite(budget)) return;
    const currency = (campaign.currency || 'USD').toUpperCase();
    const rate = this.fxService.getPerUsd(currency);
    if (rate == null) return; // backfilled later once rates are available
    campaign.budget_usd = Math.round((budget / rate) * 100) / 100;
    campaign.fx_rate = rate;
    campaign.fx_rate_at = new Date();
  }

  /** One-time: compute budget_usd for campaigns posted before the FX layer. */
  private async backfillBudgetUsd(): Promise<void> {
    const rows = await this.campaignsRepository
      .createQueryBuilder('c')
      .where('c.budget IS NOT NULL AND c.budget_usd IS NULL')
      .getMany();
    let done = 0;
    for (const c of rows) {
      this.applyFx(c);
      if (c.budget_usd != null) {
        await this.campaignsRepository.save(c);
        done++;
      }
    }
    if (rows.length) console.log(`[FX] budget_usd backfill: ${done}/${rows.length} campaigns`);
  }

  /** Fire-and-forget: derive title/description translations for a campaign. */
  private queueTranslation(campaign: Campaign): void {
    const source =
      campaign.source_language ||
      this.translationsService.detectLanguage(`${campaign.title || ''} ${campaign.description || ''}`);
    void this.translationsService
      .syncEntity('campaign', campaign.id, {
        title: campaign.title,
        description: campaign.description,
      }, source)
      .catch((e) => console.error('[i18n] campaign translation failed:', e?.message));
  }

  /** Periodic retry: keep ACTIVE campaigns' translations complete + fresh.
   *  Also backfills source_language for campaigns posted before the column. */
  private async sweepTranslations(): Promise<void> {
    const active = await this.campaignsRepository.find({ where: { status: 'active' } });
    for (const c of active) {
      if (!c.source_language) {
        c.source_language = this.translationsService.detectLanguage(
          `${c.title || ''} ${c.description || ''}`,
        );
        await this.campaignsRepository.save(c);
      }
      this.queueTranslation(c);
    }
  }

  /** Attach `title_translated` / `description_translated` for `lang` viewers. */
  private async attachTranslations(items: any[], lang?: string): Promise<any[]> {
    if (!lang || items.length === 0) return items;
    const needs = items.filter((c) => c.source_language && c.source_language !== lang);
    if (needs.length === 0) return items;
    const trMap = await this.translationsService.getFor(
      'campaign',
      needs.map((c) => c.id),
      lang,
    );
    for (const c of items) {
      const tr = trMap.get(c.id);
      if (!tr) continue;
      if (tr.title) c.title_translated = tr.title;
      if (tr.description) c.description_translated = tr.description;
      if (tr.title || tr.description) c.is_translated = true;
    }
    return items;
  }

  /** Safe field list for PUBLIC campaign responses — never the full brand
   *  User row (which carries password_hash + KYC documents). */
  private publicCampaignQb() {
    return this.campaignsRepository
      .createQueryBuilder('c')
      .leftJoin('c.brand', 'b')
      .leftJoin('b.brandProfile', 'bp')
      .where('c.status = :status', { status: 'active' })
      .select([
        'c.id', 'c.title', 'c.description', 'c.budget', 'c.currency', 'c.platform',
        'c.target_audience', 'c.deadline', 'c.status', 'c.cover_image',
        'c.contract_template', 'c.created_at', 'c.content_type', 'c.objective',
        'c.budget_usd', 'c.fx_rate', 'c.source_language',
        'b.id', 'b.account_status',
        'bp.id', 'bp.company_name', 'bp.logo_url', 'bp.industry',
      ]);
  }

  async getActiveCampaigns(lang?: string): Promise<Campaign[]> {
    const items = await this.publicCampaignQb().orderBy('c.created_at', 'DESC').getMany();
    return this.attachTranslations(items as any[], lang);
  }

  /**
   * Public campaign directory — filtered, sorted, and paginated in SQL,
   * with an applicant count per campaign. Returns { items, total, hasMore }.
   */
  /**
   * Facets for the campaign filters: distinct brand sectors (industry) and
   * campaign orientations (objective) among ACTIVE campaigns, with counts —
   * dropdowns only ever offer values that exist.
   */
  async getCampaignFacets(): Promise<{
    sectors: { value: string; count: number }[];
    objectives: { value: string; count: number }[];
  }> {
    const base = () =>
      this.campaignsRepository
        .createQueryBuilder('c')
        .leftJoin('c.brand', 'b')
        .leftJoin('b.brandProfile', 'bp')
        .where('c.status = :status', { status: 'active' });

    const sectorRows = await base()
      .andWhere("COALESCE(bp.industry, '') != ''")
      .select('bp.industry', 'value')
      .addSelect('COUNT(*)', 'count')
      .groupBy('bp.industry')
      .orderBy('bp.industry', 'ASC')
      .getRawMany();

    const objectiveRows = await base()
      .andWhere("COALESCE(c.objective, '') != ''")
      .select('c.objective', 'value')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.objective')
      .orderBy('c.objective', 'ASC')
      .getRawMany();

    const shape = (rows: any[]) =>
      rows.map((r) => ({ value: r.value, count: Number(r.count) || 0 }));
    return { sectors: shape(sectorRows), objectives: shape(objectiveRows) };
  }

  async getPublicCampaigns(filters: {
    search?: string;
    platform?: string;
    minBudget?: string;
    maxBudget?: string;
    industry?: string;
    objective?: string;
    sort?: string;
    limit?: string;
    offset?: string;
    lang?: string;
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

    // Budget bands compare in canonical USD so an ETB 250,000 brief lands
    // in the ~$1.8K band, not the "$20K+" one.
    if (filters.minBudget) {
      qb.andWhere(`${BUDGET_USD_SQL} >= :minB`, { minB: parseFloat(filters.minBudget) || 0 });
    }
    if (filters.maxBudget) {
      qb.andWhere(`${BUDGET_USD_SQL} <= :maxB`, { maxB: parseFloat(filters.maxBudget) || 0 });
    }
    if (filters.industry) {
      qb.andWhere('LOWER(bp.industry) = LOWER(:ind)', { ind: filters.industry });
    }
    if (filters.objective) {
      qb.andWhere('LOWER(c.objective) = LOWER(:obj)', { obj: filters.objective });
    }

    const total = await qb.getCount();

    if (filters.sort === 'budget') {
      qb.orderBy(BUDGET_USD_SQL, 'DESC', 'NULLS LAST');
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
    await this.attachTranslations(items, filters.lang);

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

  /**
   * Campaigns can target MULTIPLE platforms. The `platform` column stores a
   * comma-separated list ("TikTok, Instagram") — every substring-based
   * reader and the ILIKE platform filter keep working unchanged. Clients may
   * send either `platform` (string) or `platforms` (string[]).
   */
  private normalizePlatformInput(data: Partial<Campaign>): Partial<Campaign> {
    const platforms = (data as any).platforms;
    if (Array.isArray(platforms)) {
      const clean = platforms.map((p) => String(p).trim()).filter(Boolean);
      const { platforms: _drop, ...rest } = data as any;
      return { ...rest, platform: clean.join(', ') };
    }
    return data;
  }

  async createCampaign(user: any, data: Partial<Campaign>): Promise<Campaign> {
    data = this.normalizePlatformInput(data);
    const campaign = this.campaignsRepository.create({
      ...data,
      brand: { id: user.userId } as User,
      status: 'active',
      cover_image: (data as any).cover_image || this.pickCoverImage(data.title || '', data.description),
    });
    campaign.currency = (campaign.currency || 'USD').toUpperCase();
    this.applyFx(campaign); // USD value + rate locked at post time
    campaign.source_language = this.translationsService.detectLanguage(
      `${campaign.title || ''} ${campaign.description || ''}`,
    );

    const saved = await this.campaignsRepository.save(campaign);
    this.queueTranslation(saved);

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

    const moneyChanged = data.budget !== undefined || data.currency !== undefined;
    const textChanged = data.title !== undefined || data.description !== undefined;

    Object.assign(campaign, this.normalizePlatformInput(data));
    if (moneyChanged) {
      campaign.currency = (campaign.currency || 'USD').toUpperCase();
      this.applyFx(campaign); // re-lock at today's rate — the brand changed the money
    }
    if (textChanged) {
      campaign.source_language = this.translationsService.detectLanguage(
        `${campaign.title || ''} ${campaign.description || ''}`,
      );
    }
    const saved = await this.campaignsRepository.save(campaign);
    if (textChanged) this.queueTranslation(saved);
    return saved;
  }

  async deleteCampaign(campaignId: string, brandId: string): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['brand'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.brand.id !== brandId) throw new UnauthorizedException('Not authorized');

    await this.campaignsRepository.remove(campaign);
    await this.translationsService.removeEntity('campaign', campaignId);
  }
}
