import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from 'country-state-city';
import { Campaign } from './campaign.entity';
import { User, UserRole } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { FxService } from '../fx/fx.service';
import { TranslationsService } from '../translations/translations.service';

/** SQL expression for the canonical USD budget: the stored budget_usd,
 *  falling back to the raw budget for legacy USD rows not yet backfilled. */
const BUDGET_USD_SQL = "COALESCE(c.budget_usd, CASE WHEN c.currency = 'USD' THEN c.budget END)";

/** Campaign lifecycle. `draft` is invisible to creators, `active` is open
 *  for applications, `paused` hides it without losing applicants, `closed`
 *  is final (kept for records / contracts). */
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'closed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Values older clients wrote — mapped so filters and the UI stay sane. */
const LEGACY_STATUS: Record<string, CampaignStatus> = {
  inactive: 'paused',
  open: 'active',
  completed: 'closed',
  archived: 'closed',
  cancelled: 'closed',
};

export const normalizeCampaignStatus = (s?: string | null): CampaignStatus | undefined => {
  if (!s) return undefined;
  const k = String(s).toLowerCase().trim();
  if ((CAMPAIGN_STATUSES as readonly string[]).includes(k)) return k as CampaignStatus;
  return LEGACY_STATUS[k];
};

/** Fields a brand may set on its own campaign. Everything else — id, brand,
 *  budget_usd / fx_rate (locked server-side), source_language, timestamps —
 *  is server-owned and silently dropped from client payloads. */
const WRITABLE_FIELDS = [
  'title', 'description', 'budget', 'currency', 'platform', 'platforms',
  'target_audience', 'targeting', 'media_links', 'script', 'script_required',
  'content_type', 'objective', 'deadline', 'cover_image',
  'contract_template', 'post_to_telegram', 'status',
] as const;

const pickWritable = (data: any): Partial<Campaign> => {
  const out: any = {};
  if (!data || typeof data !== 'object') return out;
  for (const k of WRITABLE_FIELDS) if (data[k] !== undefined) out[k] = data[k];
  if (out.deadline === '') out.deadline = null;
  if (out.budget === '' || out.budget === null) out.budget = null;
  return out;
};

/* ── Structured targeting + creator assets ──────────────────────── */
export const TARGET_GENDERS = ['all', 'female', 'male'] as const;
export const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export const MEDIA_TYPES = ['video', 'image', 'article'] as const;

export type Targeting = {
  gender: (typeof TARGET_GENDERS)[number];
  age_groups: string[];
  countries: { code: string; name: string }[];
  cities: { country_code: string; city: string }[];
};

const EMPTY_TARGETING: Targeting = { gender: 'all', age_groups: [], countries: [], cities: [] };

const countryName = (code: string): string => Country.getCountryByCode(code)?.name || code;

/** Resolve a `country` filter value — ISO-2 code or a country name — to a code. */
export const resolveCountryCode = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const hit = Country.getAllCountries().find((c) => c.name.toLowerCase() === v.toLowerCase());
  return hit?.isoCode;
};

const parseJson = <T,>(raw: any, fallback: T): T => {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
};

/** Validate + serialize client targeting / media / script fields in place. */
const normalizeAssets = (data: any): void => {
  if (data.targeting !== undefined) {
    const t = parseJson<any>(data.targeting, {}) || {};
    const gender = (TARGET_GENDERS as readonly string[]).includes(String(t.gender)) ? t.gender : 'all';
    const age_groups: string[] = Array.isArray(t.age_groups)
      ? [
          ...new Set<string>(
            t.age_groups
              .map((a: unknown) => String(a))
              .filter((a: string) => (AGE_GROUPS as readonly string[]).includes(a)),
          ),
        ]
      : [];
    const countries = (Array.isArray(t.countries) ? t.countries : [])
      .map((c: any) => (typeof c === 'string' ? { code: c } : c))
      .filter((c: any) => c && /^[A-Za-z]{2}$/.test(String(c.code || '')))
      .map((c: any) => {
        const code = String(c.code).toUpperCase();
        return { code, name: String(c.name || countryName(code)).slice(0, 80) };
      })
      .filter((c: any, i: number, arr: any[]) => arr.findIndex((x) => x.code === c.code) === i)
      .slice(0, 30);
    const codes = new Set(countries.map((c: any) => c.code));
    const cities = (Array.isArray(t.cities) ? t.cities : [])
      .filter((c: any) => c && c.city && /^[A-Za-z]{2}$/.test(String(c.country_code || '')))
      .map((c: any) => ({ country_code: String(c.country_code).toUpperCase(), city: String(c.city).trim().slice(0, 120) }))
      .filter((c: any) => codes.size === 0 || codes.has(c.country_code))
      .slice(0, 60);
    const targeting: Targeting = { gender, age_groups, countries, cities };
    data.targeting = JSON.stringify(targeting);
    data.target_countries = countries.map((c: any) => c.code).join(',');
    // Legacy summary for readers that still show free text.
    const parts: string[] = [];
    parts.push(gender === 'all' ? 'All genders' : gender === 'female' ? 'Women' : 'Men');
    if (age_groups.length) parts.push(age_groups.join(', '));
    if (countries.length) {
      const cityNames = cities.map((c: any) => c.city);
      parts.push(countries.map((c: any) => c.name).join(', ') + (cityNames.length ? ` (${cityNames.join(', ')})` : ''));
    } else parts.push('Anywhere');
    data.target_audience = parts.join(' · ');
  }
  if (data.media_links !== undefined) {
    const list = parseJson<any[]>(data.media_links, []);
    const clean = (Array.isArray(list) ? list : [])
      .filter((m) => m && typeof m.url === 'string' && /^https?:\/\/\S+$/i.test(m.url.trim()))
      .map((m) => ({
        type: (MEDIA_TYPES as readonly string[]).includes(m.type) ? m.type : 'article',
        url: m.url.trim().slice(0, 2048),
        ...(m.label ? { label: String(m.label).slice(0, 120) } : {}),
      }))
      .slice(0, 20);
    data.media_links = JSON.stringify(clean);
  }
  if (data.script !== undefined) data.script = data.script == null ? null : String(data.script).slice(0, 20000);
  if (data.script_required !== undefined) data.script_required = !!data.script_required;
};

/** Parse the JSON columns for API consumers (strings in the DB, objects out). */
export const hydrateCampaign = <T extends Record<string, any>>(c: T): T => {
  if (!c || typeof c !== 'object') return c;
  const out: any = { ...c };
  if ('targeting' in out) out.targeting = parseJson<Targeting>(out.targeting, EMPTY_TARGETING) || EMPTY_TARGETING;
  if ('media_links' in out) {
    const list = parseJson<any[]>(out.media_links, []);
    out.media_links = Array.isArray(list) ? list : [];
  }
  return out;
};

const ASSET_COLUMNS = [
  'c.targeting', 'c.target_countries', 'c.media_links', 'c.script', 'c.script_required',
];

/** Safe select list for a brand's own campaigns (all statuses). */
const OWNER_SELECT = [
  'c.id', 'c.title', 'c.description', 'c.budget', 'c.currency', 'c.platform',
  'c.target_audience', 'c.deadline', 'c.status', 'c.cover_image',
  'c.contract_template', 'c.post_to_telegram', 'c.created_at', 'c.updated_at',
  'c.content_type', 'c.objective', 'c.budget_usd', 'c.fx_rate', 'c.fx_rate_at',
  'c.source_language',
  ...ASSET_COLUMNS,
  'b.id', 'b.account_status',
  'bp.id', 'bp.company_name', 'bp.logo_url', 'bp.industry',
];

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
        ...ASSET_COLUMNS,
        'b.id', 'b.account_status',
        'bp.id', 'bp.company_name', 'bp.logo_url', 'bp.industry',
      ]);
  }

  async getActiveCampaigns(lang?: string): Promise<Campaign[]> {
    const items = await this.publicCampaignQb().orderBy('c.created_at', 'DESC').getMany();
    return this.attachTranslations(items.map(hydrateCampaign) as any[], lang);
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
    countries: { value: string; label: string; count: number }[];
  }> {
    const base = () =>
      this.campaignsRepository
        .createQueryBuilder('c')
        .leftJoin('c.brand', 'b')
        .leftJoin('b.brandProfile', 'bp')
        .where('c.status = :status', { status: 'active' });

    // Target countries: comma lists in SQL, so count them in JS (small set).
    const countryRows = await base()
      .andWhere("COALESCE(c.target_countries, '') != ''")
      .select('c.target_countries', 'codes')
      .getRawMany();
    const countryCounts = new Map<string, number>();
    for (const r of countryRows) {
      for (const code of String(r.codes).split(',').map((s) => s.trim()).filter(Boolean)) {
        countryCounts.set(code, (countryCounts.get(code) || 0) + 1);
      }
    }
    const countries = [...countryCounts.entries()]
      .map(([value, count]) => ({ value, label: countryName(value), count }))
      .sort((a, b) => a.label.localeCompare(b.label));

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
    return { sectors: shape(sectorRows), objectives: shape(objectiveRows), countries };
  }

  async getPublicCampaigns(filters: {
    search?: string;
    platform?: string;
    minBudget?: string;
    maxBudget?: string;
    industry?: string;
    objective?: string;
    /** ISO-2 code or country name: briefs targeting it OR open to anywhere. */
    country?: string;
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
    const countryCode = resolveCountryCode(filters.country);
    if (countryCode) {
      // Briefs that target this country, plus briefs open to anywhere.
      qb.andWhere(
        "(COALESCE(c.target_countries, '') = '' OR (',' || c.target_countries || ',') ILIKE :cc)",
        { cc: `%,${countryCode},%` },
      );
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
      ...hydrateCampaign(c),
      applicants_count: Number(raw[i]?.applicants_count) || 0,
    }));
    await this.attachTranslations(items, filters.lang);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  /** Per-campaign applicant funnel as correlated subqueries. */
  private addApplicantCounts<T>(qb: any): T {
    const count = (extra = '') => (sub: any) =>
      sub.select('COUNT(*)').from('applications', 'a').where(`a.campaign_id = c.id${extra}`);
    qb.addSelect(count(), 'applicants_count');
    qb.addSelect(count(" AND a.status = 'pending'"), 'pending_count');
    qb.addSelect(count(" AND a.status = 'shortlisted'"), 'shortlisted_count');
    qb.addSelect(count(" AND a.status = 'accepted'"), 'accepted_count');
    return qb;
  }

  private withCounts(entities: any[], raw: any[]): any[] {
    return entities.map((c, i) => ({
      ...hydrateCampaign(c),
      status: normalizeCampaignStatus(c.status) ?? c.status,
      applicants_count: Number(raw[i]?.applicants_count) || 0,
      pending_count: Number(raw[i]?.pending_count) || 0,
      shortlisted_count: Number(raw[i]?.shortlisted_count) || 0,
      accepted_count: Number(raw[i]?.accepted_count) || 0,
    }));
  }

  /**
   * A brand's own campaigns — every status, newest first, with the
   * applicant funnel per campaign. Safe field list: never the brand's User
   * row (password hash, KYC documents) that `relations: ['brand']` leaked.
   */
  async getCampaignsByBrand(
    brandId: string,
    filters: { status?: string; search?: string } = {},
  ): Promise<any[]> {
    const qb = this.campaignsRepository
      .createQueryBuilder('c')
      .leftJoin('c.brand', 'b')
      .leftJoin('b.brandProfile', 'bp')
      .where('b.id = :brandId', { brandId })
      .select(OWNER_SELECT);

    const status = normalizeCampaignStatus(filters.status);
    if (status) {
      const aliases = [status, ...Object.entries(LEGACY_STATUS).filter(([, v]) => v === status).map(([k]) => k)];
      qb.andWhere('LOWER(c.status) IN (:...st)', { st: aliases });
    }
    if (filters.search) {
      qb.andWhere('(c.title ILIKE :s OR c.description ILIKE :s)', { s: `%${filters.search}%` });
    }

    this.addApplicantCounts(qb);
    qb.orderBy('c.created_at', 'DESC').addOrderBy('c.id', 'ASC');

    const { entities, raw } = await qb.getRawAndEntities();
    return this.withCounts(entities, raw);
  }

  /**
   * One campaign. Owners (and admins) see it in any status with the
   * applicant funnel; everyone else only while it is active, with
   * translations attached for `lang` viewers.
   */
  async getCampaignById(
    id: string,
    viewer?: { userId?: string; role?: string },
    lang?: string,
  ): Promise<any> {
    const qb = this.campaignsRepository
      .createQueryBuilder('c')
      .leftJoin('c.brand', 'b')
      .leftJoin('b.brandProfile', 'bp')
      .where('c.id = :id', { id })
      .select(OWNER_SELECT);
    this.addApplicantCounts(qb);

    const { entities, raw } = await qb.getRawAndEntities();
    const campaign = entities[0];
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isOwner = !!viewer?.userId && campaign.brand?.id === viewer.userId;
    const isAdmin = viewer?.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin && normalizeCampaignStatus(campaign.status) !== 'active') {
      throw new NotFoundException('Campaign not found');
    }

    const [item] = this.withCounts([campaign], raw);
    if (!isOwner) {
      // Non-owners never need the private Telegram flag.
      delete item.post_to_telegram;
      await this.attachTranslations([item], lang);
    }
    return item;
  }

  /**
   * Brand overview numbers: campaign + applicant funnels, committed budget
   * in canonical USD, and 12 weekly buckets for the dashboard sparklines.
   * One round-trip per table — no per-campaign fan-out.
   */
  async getBrandStats(brandId: string): Promise<any> {
    const campaigns = await this.campaignsRepository
      .createQueryBuilder('c')
      .leftJoin('c.brand', 'b')
      .where('b.id = :brandId', { brandId })
      .select(['c.id', 'c.status', 'c.budget', 'c.currency', 'c.budget_usd', 'c.created_at', 'c.deadline'])
      .getMany();

    const apps: { status: string; created_at: Date }[] = await this.campaignsRepository.manager
      .createQueryBuilder()
      .select('a.status', 'status')
      .addSelect('a.created_at', 'created_at')
      .from('applications', 'a')
      .innerJoin('campaigns', 'c', 'c.id = a.campaign_id')
      .where('c.brand_id = :brandId', { brandId })
      .getRawMany();

    const byStatus: Record<CampaignStatus, number> = { draft: 0, active: 0, paused: 0, closed: 0 };
    let committedUsd = 0;
    let activeUsd = 0;
    const now = Date.now();
    let closingSoon = 0;
    for (const c of campaigns) {
      const s = normalizeCampaignStatus(c.status) ?? 'active';
      byStatus[s]++;
      const usd =
        c.budget_usd != null
          ? Number(c.budget_usd)
          : c.currency === 'USD' && c.budget != null
            ? Number(c.budget)
            : 0;
      if (Number.isFinite(usd)) {
        committedUsd += usd;
        if (s === 'active') activeUsd += usd;
      }
      if (s === 'active' && c.deadline) {
        const days = (new Date(c.deadline as any).getTime() - now) / 86_400_000;
        if (days >= 0 && days <= 7) closingSoon++;
      }
    }

    const funnel = { total: apps.length, pending: 0, shortlisted: 0, accepted: 0, rejected: 0, other: 0 };
    for (const a of apps) {
      const s = (a.status || '').toLowerCase();
      if (s in funnel && s !== 'total' && s !== 'other') (funnel as any)[s]++;
      else funnel.other++;
    }

    // 12 weekly buckets ending this week (Monday-based), oldest → newest.
    const WEEKS = 12;
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const starts: Date[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const d = new Date(monday);
      d.setDate(monday.getDate() - i * 7);
      starts.push(d);
    }
    const bucketOf = (t: Date | string) => {
      const ms = new Date(t).getTime();
      if (ms < starts[0].getTime()) return -1;
      const idx = Math.floor((ms - starts[0].getTime()) / (7 * 86_400_000));
      return Math.min(idx, WEEKS - 1);
    };
    // Local calendar dates (toISOString would shift the label by the TZ offset).
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const series = {
      weeks: starts.map(ymd),
      campaigns: new Array(WEEKS).fill(0) as number[],
      applications: new Array(WEEKS).fill(0) as number[],
      accepted: new Array(WEEKS).fill(0) as number[],
    };
    for (const c of campaigns) {
      const i = bucketOf(c.created_at);
      if (i >= 0) series.campaigns[i]++;
    }
    for (const a of apps) {
      const i = bucketOf(a.created_at);
      if (i < 0) continue;
      series.applications[i]++;
      if ((a.status || '').toLowerCase() === 'accepted') series.accepted[i]++;
    }

    return {
      campaigns: { total: campaigns.length, by_status: byStatus, closing_soon: closingSoon },
      applications: funnel,
      budget: {
        committed_usd: Math.round(committedUsd * 100) / 100,
        active_usd: Math.round(activeUsd * 100) / 100,
      },
      series,
      generated_at: new Date().toISOString(),
    };
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

  /**
   * Announce a newly published brief to creators — in-app for everyone,
   * Telegram when the brand opted in. Runs after the response is sent; a
   * brand with thousands of creators on the platform must not wait on
   * N notification inserts to see "Campaign posted".
   */
  private announceToCreators(saved: Campaign, telegram: boolean): void {
    void (async () => {
      try {
        const creators = await this.usersRepository.find({
          where: { role: UserRole.CREATOR },
          select: ['id'],
        });
        const message = `A new campaign "${saved.title}" was just posted! Check it out and apply.`;
        // Small parallel batches: fast, but never a thundering herd on Telegram.
        const BATCH = 20;
        for (let i = 0; i < creators.length; i += BATCH) {
          await Promise.allSettled(
            creators
              .slice(i, i + BATCH)
              .map((c) => this.notificationsService.createNotification(c.id, 'NEW_CAMPAIGN', message, saved.id)),
          );
        }
      } catch (e: any) {
        console.error('[campaigns] creator notifications failed:', e?.message);
      }
    })();

    if (telegram) {
      const budgetStr =
        saved.budget != null
          ? `${saved.currency || 'USD'} ${Number(saved.budget).toLocaleString()}`
          : 'TBD';
      const msg = `🚀 *New Campaign Alert!*\n\n📋 *${saved.title}*\n💰 Budget: ${budgetStr}\n📱 Platform: ${saved.platform || 'Multiple'}\n\n${saved.description ? saved.description.substring(0, 200) : 'Check out this opportunity!'}\n\n🔗 Apply here: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/campaigns`;
      this.telegramService
        .broadcastToRole('creator', msg)
        .catch((e) => console.error('Telegram broadcast error:', e));
    }
  }

  private validateWritable(data: Partial<Campaign>): void {
    if (data.title !== undefined && !String(data.title).trim()) {
      throw new BadRequestException('Title is required');
    }
    if (data.budget != null && data.budget !== undefined) {
      const n = Number(data.budget);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Budget must be a positive number');
    }
    if (data.currency !== undefined && !/^[A-Za-z]{3}$/.test(String(data.currency))) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }
    if (data.status !== undefined && !normalizeCampaignStatus(data.status)) {
      throw new BadRequestException(`Status must be one of: ${CAMPAIGN_STATUSES.join(', ')}`);
    }
  }

  async createCampaign(user: any, input: any): Promise<Campaign> {
    const data = this.normalizePlatformInput(pickWritable(input));
    normalizeAssets(data);
    this.validateWritable(data);
    if (!data.title) throw new BadRequestException('Title is required');

    // Brands may save a draft (invisible to creators) or publish straight away.
    const status: CampaignStatus = normalizeCampaignStatus(data.status) === 'draft' ? 'draft' : 'active';

    const campaign = this.campaignsRepository.create({
      ...data,
      brand: { id: user.userId } as User,
      status,
      cover_image: data.cover_image || this.pickCoverImage(data.title || '', data.description),
    });
    campaign.currency = (campaign.currency || 'USD').toUpperCase();
    this.applyFx(campaign); // USD value + rate locked at post time
    campaign.source_language = this.translationsService.detectLanguage(
      `${campaign.title || ''} ${campaign.description || ''}`,
    );

    const saved = await this.campaignsRepository.save(campaign);
    this.queueTranslation(saved);
    if (status === 'active') this.announceToCreators(saved, !!data.post_to_telegram);
    return hydrateCampaign(saved);
  }

  async updateCampaign(campaignId: string, brandId: string, input: any): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['brand'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.brand.id !== brandId) throw new UnauthorizedException('Not authorized');

    const data = this.normalizePlatformInput(pickWritable(input));
    normalizeAssets(data);
    this.validateWritable(data);

    const moneyChanged = data.budget !== undefined || data.currency !== undefined;
    const textChanged = data.title !== undefined || data.description !== undefined;
    const wasDraft = normalizeCampaignStatus(campaign.status) === 'draft';
    if (data.status !== undefined) data.status = normalizeCampaignStatus(data.status)!;

    Object.assign(campaign, data);
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
    // First publish of a draft is the moment creators should hear about it.
    if (wasDraft && normalizeCampaignStatus(saved.status) === 'active') {
      this.announceToCreators(saved, !!saved.post_to_telegram);
    }
    // Strip the brand relation (loaded for the ownership check) from the response.
    const { brand: _brand, ...rest } = saved as any;
    return { ...hydrateCampaign(rest), brand: { id: brandId } } as Campaign;
  }

  async deleteCampaign(campaignId: string, brandId: string): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['brand'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.brand.id !== brandId) throw new UnauthorizedException('Not authorized');

    await this.campaignsRepository.remove(campaign);
    await this.translationsService.removeEntity('campaign', campaignId);
  }
}
