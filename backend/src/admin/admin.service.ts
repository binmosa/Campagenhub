import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { toPublicUser } from '../users/public-user';
import { Page, asPage, likeTerm, readPageParams } from '../core/pagination';
import { normalizeCampaignStatus } from '../campaigns/campaigns.service';
import { Campaign } from '../campaigns/campaign.entity';
import { Application } from '../applications/application.entity';
import { Payout } from '../payouts/payout.entity';
import { InvitationsService } from '../invitations/invitations.service';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../email/email.service';
import { PayoutAccount } from '../invitations/payout-account.entity';
import { PaymentTransaction } from '../payments/payment-transaction.entity';
import { PaymentService } from '../payments/payment.service';
import { AuditLog } from './audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as bcrypt from 'bcrypt';

/** Roles the app ships with; anything else is a brand's custom role. */
const STAFF_ROLES = ['admin', 'support', 'finance'];
const KNOWN_ROLES = ['creator', 'brand', 'manager', ...STAFF_ROLES];

/** Every spelling that means this status, so a filter also finds legacy rows. */
const campaignStatusAliases = (status: string): string[] => {
  const wanted = normalizeCampaignStatus(status) || status;
  const aliases = new Set<string>([wanted]);
  for (const legacy of ['inactive', 'open', 'completed', 'archived', 'cancelled']) {
    if (normalizeCampaignStatus(legacy) === wanted) aliases.add(legacy);
  }
  return [...aliases];
};

/**
 * A role has to be one the app actually knows — RolesGuard compares against
 * these strings, so a typo'd or invented role silently locks an account out
 * of everything (or, worse, out of the checks that name it).
 */
const assertKnownRole = (role?: string): string => {
  const normalized = String(role || '').toLowerCase().trim();
  if (!Object.values(UserRole).includes(normalized as UserRole)) {
    throw new BadRequestException(`Unknown role "${role}". Use one of: ${Object.values(UserRole).join(', ')}.`);
  }
  return normalized;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(Application)
    private applicationsRepository: Repository<Application>,
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(PayoutAccount)
    private payoutAccountRepo: Repository<PayoutAccount>,
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    private paymentService: PaymentService,
    private invitationsService: InvitationsService,
    private telegramService: TelegramService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * The back-office user directory. Strips what no admin screen needs and
   * no client should ever hold: the password hash, KYC document blobs,
   * Telegram identifiers/tokens and the referral code.
   */
  async getAllUsers(query: any = {}): Promise<Page<any> & { stats: Record<string, number> }> {
    const { limit, offset, search } = readPageParams(query);
    const status = String(query?.status || 'all').toLowerCase();
    const role = String(query?.role || 'all').toLowerCase();

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.creatorProfile', 'cp')
      .leftJoinAndSelect('u.brandProfile', 'bp')
      .leftJoinAndSelect('u.managerProfile', 'mp');

    if (search) {
      qb.andWhere(
        '(u.email ILIKE :q OR cp.full_name ILIKE :q OR cp.username ILIKE :q OR bp.company_name ILIKE :q OR mp.full_name ILIKE :q OR u.role ILIKE :q)',
        { q: likeTerm(search) },
      );
    }
    if (status === 'active') qb.andWhere("u.account_status = 'active' AND u.is_banned = false");
    if (status === 'pending') qb.andWhere("u.account_status = 'pending_verification'");
    if (status === 'banned') qb.andWhere('u.is_banned = true');
    if (status === 'staff') qb.andWhere('LOWER(u.role) IN (:...staff)', { staff: STAFF_ROLES });
    if (role !== 'all') {
      if (role === 'custom') qb.andWhere('LOWER(u.role) NOT IN (:...known)', { known: KNOWN_ROLES });
      else qb.andWhere('LOWER(u.role) = :role', { role });
    }

    const [rows, total] = await qb.orderBy('u.created_at', 'DESC').addOrderBy('u.id', 'ASC').skip(offset).take(limit).getManyAndCount();

    const items = rows.map((u) => {
      const {
        password_hash,
        identity_document,
        kyc_id_front,
        kyc_id_back,
        kyc_video_url,
        telegram_chat_id,
        telegram_connect_token,
        referral_code,
        ...safe
      } = u as any;
      return { ...safe, has_kyc_submission: !!(kyc_video_url || kyc_id_front || identity_document), telegram_linked: !!telegram_chat_id };
    });

    return { ...asPage(items, total, limit, offset), stats: await this.userStats() };
  }

  /**
   * Directory tallies. These feed the KPI tiles, which have to describe the
   * whole table and not just the page in front of you — so they are counted
   * in SQL rather than derived from the loaded array.
   */
  private async userStats(): Promise<Record<string, number>> {
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const row = await this.usersRepository
      .createQueryBuilder('u')
      .select('COUNT(*)', 'all')
      .addSelect("COUNT(*) FILTER (WHERE u.account_status = 'active' AND u.is_banned = false)", 'active')
      .addSelect("COUNT(*) FILTER (WHERE u.account_status = 'pending_verification')", 'pending')
      .addSelect('COUNT(*) FILTER (WHERE u.is_banned = true)', 'banned')
      .addSelect(`COUNT(*) FILTER (WHERE LOWER(u.role) IN ('${STAFF_ROLES.join("','")}'))`, 'staff')
      .addSelect('COUNT(*) FILTER (WHERE u.created_at >= :week)', 'new7')
      .setParameter('week', week)
      .getRawOne();
    const byRole = await this.usersRepository
      .createQueryBuilder('u')
      .select('LOWER(u.role)', 'role')
      .addSelect('COUNT(*)', 'n')
      .groupBy('LOWER(u.role)')
      .getRawMany();
    const roles = Object.fromEntries(byRole.map((r: any) => [`role_${r.role}`, Number(r.n)]));
    const custom = byRole.filter((r: any) => !KNOWN_ROLES.includes(r.role)).reduce((sum: number, r: any) => sum + Number(r.n), 0);
    return {
      all: Number(row?.all || 0),
      active: Number(row?.active || 0),
      pending: Number(row?.pending || 0),
      banned: Number(row?.banned || 0),
      staff: Number(row?.staff || 0),
      new7: Number(row?.new7 || 0),
      custom,
      ...roles,
    };
  }

  async getPendingUsers(): Promise<User[]> {
    return this.usersRepository.find({
      where: { account_status: 'pending_verification' },
      relations: ['creatorProfile', 'brandProfile', 'managerProfile'],
      order: { created_at: 'ASC' },
      select: ['id', 'email', 'role', 'account_status', 'identity_document', 'kyc_id_front', 'kyc_id_back', 'kyc_video_url', 'created_at']
    });
  }

  async validateUserStatus(id: string, status: string): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      relations: ['brandProfile']
    });
    if (!user) throw new NotFoundException('User not found');
    user.account_status = status; // active or rejected
    user.kyc_status = status === 'active' ? 'approved' : 'rejected';

    if (status === 'active') {
      if (user.telegram_chat_id) {
        await this.telegramService.sendNotification(user.telegram_chat_id, `🎉 *Verification Approved!*\n\nYour account on CampaignHub has been fully verified. You can now access all features.`);
      }
      await this.emailService.sendVerificationApproved(user.email);
    } else if (status === 'rejected') {
      if (user.telegram_chat_id) {
        await this.telegramService.sendNotification(user.telegram_chat_id, `❌ *Verification Rejected*\n\nUnfortunately, your KYC verification was rejected. Your account cannot proceed.\nConnection closed.`);
      }
      await this.emailService.sendVerificationRejected(user.email);
      await this.telegramService.disconnectUser(user.id);
    }

    if (status === 'active' && user.role === 'brand') {
      // Trigger AI-based manager matching and auto-invite
      this.invitationsService.autoAssignManagerToBrand(user.id).catch(e =>
        console.error('Auto-assign manager failed:', e.message)
      );
    }

    if (status === 'active' && user.role === 'manager') {
       const managerProfileRepo = this.usersRepository.manager.getRepository('ManagerProfile');
       const existingProfile = await managerProfileRepo.findOne({ where: { user: { id: user.id } } });
       
       if (!existingProfile) {
         let fallbackName = user.email.split('@')[0];
         fallbackName = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
         const newProfile = managerProfileRepo.create({
           user: user,
           full_name: fallbackName,
           bio: 'Expert Social Media Manager ready to scale your enterprise brand with verified ROI strategies.',
           rating: 5.0,
           blacklisted_brand_ids: []
         });
         await managerProfileRepo.save(newProfile);
       }
    }

    return this.usersRepository.save(user);
  }

  /**
   * Flag (or unflag) a user as needing to complete KYC. When `required=true`
   * we also flip the account_status back to `pending_verification` and reset
   * any previously-approved kyc_status so the user re-submits. The user is
   * NOT logged out — they can keep using the platform but will see a banner
   * + a KYC card in their profile.
   */
  async requireKyc(id: string, required: boolean): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.kyc_required = required;
    if (required) {
      user.kyc_status = 'pending';
      if (user.account_status === 'active') {
        user.account_status = 'pending_verification';
      }
      try {
        if (user.telegram_chat_id) {
          await this.telegramService.sendNotification(
            user.telegram_chat_id,
            `🔒 *Identity verification required*\n\nPlease open your profile on CampaignHub and complete KYC to keep your account active.`,
          );
        }
      } catch (e) {
        console.error('KYC required notification failed', e);
      }
    } else {
      user.kyc_required = false;
      if (user.account_status === 'pending_verification') {
        user.account_status = 'active';
      }
    }
    return this.usersRepository.save(user);
  }

  /* Staff pages read other people's rows, so every User that rides along is
     reduced to its public shape first — the entity carries password_hash,
     KYC blobs and referral codes. */
  async getAllCampaigns(query: any = {}): Promise<Page<any> & { stats: any }> {
    const { limit, offset, search } = readPageParams(query, 24);
    const status = String(query?.status || 'all').toLowerCase();
    const platform = String(query?.platform || 'all');
    const sort = String(query?.sort || 'newest');

    const qb = this.campaignsRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.brand', 'b')
      .leftJoinAndSelect('b.brandProfile', 'bp');

    if (search) {
      qb.andWhere('(c.title ILIKE :q OR c.description ILIKE :q OR b.email ILIKE :q OR bp.company_name ILIKE :q)', { q: likeTerm(search) });
    }
    if (status !== 'all') qb.andWhere('LOWER(c.status) IN (:...statuses)', { statuses: campaignStatusAliases(status) });
    if (platform !== 'all') qb.andWhere('c.platform ILIKE :platform', { platform: likeTerm(platform) });

    if (sort === 'budget') {
      qb.addSelect('COALESCE(c.budget_usd, c.budget)', 'sort_budget').orderBy('sort_budget', 'DESC', 'NULLS LAST');
    } else if (sort === 'applicants') {
      qb.addSelect('(SELECT COUNT(*) FROM applications app WHERE app.campaign_id = c.id)', 'sort_apps').orderBy('sort_apps', 'DESC');
    } else {
      qb.orderBy('c.created_at', 'DESC');
    }
    qb.addOrderBy('c.id', 'ASC');

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    /*
     * The applicant funnel per brief. This screen used to fetch every
     * application in the database to count these in the browser; now one
     * grouped query covers just the campaigns on this page.
     */
    const ids = rows.map((c) => c.id);
    const funnel = new Map<string, { n: number; pending: number; accepted: number }>();
    if (ids.length) {
      const counts = await this.applicationsRepository
        .createQueryBuilder('a')
        .select('a.campaign_id', 'campaignId')
        .addSelect('COUNT(*)', 'n')
        .addSelect("COUNT(*) FILTER (WHERE LOWER(a.status) IN ('pending','shortlisted'))", 'pending')
        .addSelect("COUNT(*) FILTER (WHERE LOWER(a.status) = 'accepted')", 'accepted')
        .where('a.campaign_id IN (:...ids)', { ids })
        .groupBy('a.campaign_id')
        .getRawMany();
      for (const r of counts) {
        funnel.set(r.campaignId, { n: Number(r.n), pending: Number(r.pending), accepted: Number(r.accepted) });
      }
    }

    const items = rows.map((c) => {
      const f = funnel.get(c.id) || { n: 0, pending: 0, accepted: 0 };
      return { ...c, brand: toPublicUser(c.brand), applicants_count: f.n, pending_count: f.pending, accepted_count: f.accepted };
    });

    return { ...asPage(items, total, limit, offset), stats: await this.campaignStats() };
  }

  private async campaignStats(): Promise<any> {
    const byStatus = await this.campaignsRepository
      .createQueryBuilder('c')
      .select('LOWER(c.status)', 'status')
      .addSelect('COUNT(*)', 'n')
      .groupBy('LOWER(c.status)')
      .getRawMany();
    const liveAliases = campaignStatusAliases('active');
    const totals = await this.campaignsRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(COALESCE(c.budget_usd, 0)) FILTER (WHERE LOWER(c.status) IN (:...live)), 0)', 'liveUsd')
      .addSelect('COUNT(DISTINCT c.brand_id)', 'brands')
      .addSelect('COUNT(*)', 'all')
      .setParameter('live', liveAliases)
      .getRawOne();

    // Rows still carry legacy spellings ("inactive", "completed"); the tabs
    // count under the names the UI shows, so the tallies normalize too.
    const by: Record<string, number> = {};
    for (const r of byStatus) {
      const key = normalizeCampaignStatus(r.status) || r.status;
      by[key] = (by[key] || 0) + Number(r.n);
    }
    return {
      by,
      liveUsd: Number(totals?.liveUsd || 0),
      brands: Number(totals?.brands || 0),
      all: Number(totals?.all || 0),
    };
  }

  async getAllApplications(query: any = {}): Promise<Page<any> & { stats: any }> {
    const { limit, offset, search } = readPageParams(query);
    const status = String(query?.status || 'all').toLowerCase();
    const campaignId = String(query?.campaignId || '');

    const qb = this.applicationsRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.campaign', 'c')
      .leftJoinAndSelect('c.brand', 'b')
      .leftJoinAndSelect('b.brandProfile', 'bp')
      .leftJoinAndSelect('a.creator', 'cr')
      .leftJoinAndSelect('cr.creatorProfile', 'cp');

    if (search) {
      qb.andWhere(
        '(cr.email ILIKE :q OR cp.full_name ILIKE :q OR cp.username ILIKE :q OR c.title ILIKE :q OR bp.company_name ILIKE :q OR a.pitch ILIKE :q)',
        { q: likeTerm(search) },
      );
    }
    if (status !== 'all') {
      const aliases = status === 'accepted' ? ['accepted', 'approved'] : [status];
      qb.andWhere('LOWER(a.status) IN (:...statuses)', { statuses: aliases });
    }
    if (campaignId) qb.andWhere('c.id = :campaignId', { campaignId });

    const [rows, total] = await qb.orderBy('a.created_at', 'DESC').addOrderBy('a.id', 'ASC').skip(offset).take(limit).getManyAndCount();

    const items = rows.map((a) => ({
      ...a,
      creator: toPublicUser(a.creator),
      campaign: a.campaign ? { ...a.campaign, brand: toPublicUser((a.campaign as any).brand) } : a.campaign,
    }));

    return { ...asPage(items, total, limit, offset), stats: await this.applicationStats() };
  }

  private async applicationStats(): Promise<any> {
    const byStatus = await this.applicationsRepository
      .createQueryBuilder('a')
      .select('LOWER(a.status)', 'status')
      .addSelect('COUNT(*)', 'n')
      .groupBy('LOWER(a.status)')
      .getRawMany();
    const totals = await this.applicationsRepository
      .createQueryBuilder('a')
      .select('COUNT(*)', 'all')
      .addSelect('COUNT(DISTINCT a.campaign_id)', 'campaigns')
      .getRawOne();
    const by: Record<string, number> = {};
    for (const r of byStatus) {
      const key = r.status === 'approved' ? 'accepted' : r.status;
      by[key] = (by[key] || 0) + Number(r.n);
    }
    const decided = (by.accepted || 0) + (by.rejected || 0);
    return {
      by,
      all: Number(totals?.all || 0),
      campaigns: Number(totals?.campaigns || 0),
      rate: decided ? Math.round(((by.accepted || 0) / decided) * 100) : 0,
    };
  }

  /** True while a reconciliation sweep is already running, so opening the
   *  desk twice does not start a second one. */
  private reconciling = false;

  async getAllPayouts(query: any = {}): Promise<Page<any> & { stats: any }> {
    const { limit, offset, search } = readPageParams(query);

    /*
     * Reconcile missed webhook/verify cases so completed transactions turn
     * up for approval. This calls Flutterwave for every in-flight payment,
     * so it is kicked off in the background rather than awaited: the desk
     * used to sit on "Searching…" for as long as those round-trips took,
     * and anything it recovers appears on the next refresh anyway.
     */
    if (offset === 0 && !this.reconciling) {
      this.reconciling = true;
      this.paymentService
        .reconcileMissingPayoutRequests()
        .catch((e) => console.error('[Admin] Payout reconciliation failed:', e?.message))
        .finally(() => {
          this.reconciling = false;
        });
    }

    const status = String(query?.status || 'all').toLowerCase();

    // A payee is a creator or an account manager, so both profiles load.
    const qb = this.payoutsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'u')
      .leftJoinAndSelect('u.creatorProfile', 'cp')
      .leftJoinAndSelect('u.managerProfile', 'mp')
      .leftJoinAndSelect('p.campaign', 'c');

    if (search) {
      qb.andWhere(
        '(u.email ILIKE :q OR cp.full_name ILIKE :q OR mp.full_name ILIKE :q OR c.title ILIKE :q OR p.tx_ref ILIKE :q OR p.status ILIKE :q)',
        { q: likeTerm(search) },
      );
    }
    if (status !== 'all') qb.andWhere('LOWER(p.status) = :status', { status });

    const [rows, total] = await qb.orderBy('p.created_at', 'DESC').addOrderBy('p.id', 'ASC').skip(offset).take(limit).getManyAndCount();

    /*
     * Payout accounts for this page in one query. Fetching them per row was
     * an N+1 that scaled with the whole queue.
     */
    const payeeIds = [...new Set(rows.map((p) => p.creator?.id).filter(Boolean))] as string[];
    const accounts = payeeIds.length
      ? await this.payoutAccountRepo.find({ where: { user: { id: In(payeeIds) } }, relations: ['user'] })
      : [];
    const byUser = new Map(accounts.map((a: any) => [a.user?.id, a]));

    // The payee is reduced to its public shape — the raw User row carries
    // password_hash and KYC blobs, which no client may ever see.
    const items = rows.map((p) => ({
      ...p,
      creator: toPublicUser(p.creator),
      payoutAccount: byUser.get(p.creator?.id) || null,
    }));

    return { ...asPage(items, total, limit, offset), stats: await this.payoutStats() };
  }

  private async payoutStats(): Promise<any> {
    const byStatus = await this.payoutsRepository
      .createQueryBuilder('p')
      .select('LOWER(p.status)', 'status')
      .addSelect('COUNT(*)', 'n')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .groupBy('LOWER(p.status)')
      .getRawMany();
    const by: Record<string, number> = {};
    let paidVolume = 0;
    let all = 0;
    for (const r of byStatus) {
      by[r.status] = Number(r.n);
      all += Number(r.n);
      if (r.status === 'paid') paidVolume = Number(r.amount);
    }
    return { by, all, paidVolume };
  }

  async toggleCampaignStatus(campaignId: string, status: string): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.status = status;
    return this.campaignsRepository.save(campaign);
  }

  /**
   * What a campaign holds and what is already spoken for.
   *
   * Two things this has to get right, both of which used to be wrong:
   *  - `excludePayoutId` keeps the payout being decided out of `committed`.
   *    Without it every payout counts against itself, so releasing $500 on
   *    a campaign funded with exactly $500 was rejected as "insufficient
   *    escrow" — the normal case never worked.
   *  - `paid` stays in `committed` forever. Dropping it once the money left
   *    made the same funds spendable a second time.
   *  - a batch parent row carries the total of its children, so counting
   *    both doubles the deposit.
   */
  private async computeCampaignEscrow(
    campaignId: string,
    excludePayoutId?: string,
  ): Promise<{ deposited: number; committed: number; available: number }> {
    const depositedRaw = await this.paymentTransactionRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.campaign = :campaignId', { campaignId })
      .andWhere('tx.status = :status', { status: 'completed' })
      .andWhere('(tx.is_batch IS NULL OR tx.is_batch = false)')
      .getRawOne();
    const deposited = Number(depositedRaw?.total || 0);

    const committedQb = this.payoutsRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .where('payout.campaign = :campaignId', { campaignId })
      .andWhere('payout.status IN (:...statuses)', { statuses: ['pending', 'approved', 'paid'] });
    if (excludePayoutId) committedQb.andWhere('payout.id != :excludePayoutId', { excludePayoutId });
    const committedRaw = await committedQb.getRawOne();
    const committed = Number(committedRaw?.total || 0);

    return { deposited, committed, available: Math.max(0, deposited - committed) };
  }

  async getBrandBalances(): Promise<any[]> {
    const brands = await this.usersRepository.find({
      where: { role: 'brand' },
      order: { created_at: 'DESC' },
      select: ['id', 'email', 'role', 'created_at'],
    });

    const results = await Promise.all(
      brands.map(async (b) => {
        const depositedRaw = await this.paymentTransactionRepo
          .createQueryBuilder('tx')
          .select('COALESCE(SUM(tx.amount), 0)', 'total')
          .innerJoin('tx.campaign', 'campaign')
          .innerJoin('campaign.brand', 'brand')
          .where('brand.id = :brandId', { brandId: b.id })
          .andWhere('tx.status = :status', { status: 'completed' })
          .getRawOne();
        const deposited = Number(depositedRaw?.total || 0);

        const committedRaw = await this.payoutsRepository
          .createQueryBuilder('payout')
          .select('COALESCE(SUM(payout.amount), 0)', 'total')
          .innerJoin('payout.campaign', 'campaign')
          .innerJoin('campaign.brand', 'brand')
          .where('brand.id = :brandId', { brandId: b.id })
          .andWhere('payout.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
          .getRawOne();
        const committed = Number(committedRaw?.total || 0);

        return {
          brandId: b.id,
          brandEmail: b.email,
          deposited,
          committed,
          available: Math.max(0, deposited - committed),
        };
      }),
    );

    return results;
  }

  async updatePayoutStatus(payoutId: string, status: string, actorId?: string, actorRole?: string): Promise<Payout> {
    const payout = await this.payoutsRepository.findOne({
      where: { id: payoutId },
      relations: ['creator', 'campaign'],
    });
    if (!payout) throw new NotFoundException('Payout not found');

    const normalizedRole = (actorRole || '').toLowerCase().trim();
    if (normalizedRole === 'finance') {
      // finance can reject anytime; can only approve by executing transfer (admin approves)
      if (!['rejected', 'paid'].includes(status)) {
        throw new BadRequestException('Finance can only reject or execute approved payouts');
      }
      if (status === 'paid' && payout.status !== 'approved') {
        throw new BadRequestException('Finance can only execute payouts after admin approval');
      }
    }

    if (payout.campaign?.id && ['approved', 'paid'].includes(status)) {
      const escrow = await this.computeCampaignEscrow(payout.campaign.id, payout.id);
      if (Number(payout.amount) > escrow.available) {
        // notify admin/finance that brand escrow is insufficient
        const staff = await this.usersRepository.find({ where: [{ role: 'admin' }, { role: 'finance' }] as any, select: ['id', 'email', 'role'] });
        await Promise.all(
          staff.map((u) =>
            this.notificationsService.createNotification(
              u.id,
              'INSUFFICIENT_ESCROW',
              `Insufficient escrow for payout ${payout.id}. Requested $${Number(payout.amount)} but available is $${escrow.available}. Brand must deposit more.`,
              payout.id,
            ),
          ),
        );
        throw new BadRequestException('Insufficient escrow available for this payout. Brand must deposit more funds.');
      }
    }

    payout.status = status;
    await this.payoutsRepository.save(payout);

    // Write audit log
    if (actorId) {
      const log = this.auditLogRepo.create({
        user: { id: actorId } as any,
        action: status === 'paid' ? 'EXECUTED_PAYOUT' : status === 'approved' ? 'APPROVED_PAYOUT' : status === 'rejected' ? 'REJECTED_PAYOUT' : `SET_PAYOUT_${status.toUpperCase()}`,
        details: JSON.stringify({
          payoutId: payout.id,
          amount: payout.amount,
          creatorEmail: payout.creator?.email,
          campaignTitle: payout.campaign?.title,
        }),
      });
      await this.auditLogRepo.save(log);
    }

    // Send Telegram & Email notifications to the creator
    const amountNum = Number(payout.amount);
    const campaignTitle = payout.campaign?.title || 'Campaign';
    
    if (payout.creator?.telegram_chat_id) {
      if (status === 'paid') {
        await this.telegramService.sendNotification(
          payout.creator.telegram_chat_id,
          `✅ *Payment Received!*\n\nYour payout of $${amountNum.toLocaleString()} for "${campaignTitle}" has been successfully transferred to your bank account!\n\nThank you for your work on CampaignHub.`
        );
      } else if (status === 'approved') {
        await this.telegramService.sendNotification(
          payout.creator.telegram_chat_id,
          `🔄 *Payout Approved!*\n\nYour payout of $${amountNum.toLocaleString()} has been approved and is being processed. You'll be notified once it hits your bank.`
        );
      } else if (status === 'rejected') {
        await this.telegramService.sendNotification(
          payout.creator.telegram_chat_id,
          `❌ *Payout Rejected*\n\nUnfortunately, your payout of $${amountNum.toLocaleString()} has been rejected. Please contact support for more information.`
        );
      }
    }

    if (payout.creator?.email) {
      if (status === 'paid') {
        await this.emailService.sendPayoutCompleted(payout.creator.email, amountNum, campaignTitle);
      } else if (status === 'approved') {
        await this.emailService.sendPayoutApproved(payout.creator.email, amountNum, campaignTitle);
      } else if (status === 'rejected') {
        await this.emailService.sendPayoutRejected(payout.creator.email, amountNum);
      }
    }

    return payout;
  }

  async executePayoutTransfer(payoutId: string, actorId?: string, actorRole?: string): Promise<any> {
    const payout = await this.payoutsRepository.findOne({
      where: { id: payoutId },
      relations: ['creator', 'campaign'],
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'paid') throw new BadRequestException('Payout is already paid');
    if (payout.status !== 'approved') throw new BadRequestException('Payout must be approved before execution');

    // 1. Escrow Budget Check
    if (payout.campaign?.id) {
      const escrow = await this.computeCampaignEscrow(payout.campaign.id, payout.id);
      if (Number(payout.amount) > escrow.available) {
        const staff = await this.usersRepository.find({ where: [{ role: 'admin' }, { role: 'finance' }] as any, select: ['id'] });
        await Promise.all(
          staff.map((u) =>
            this.notificationsService.createNotification(
              u.id,
              'INSUFFICIENT_ESCROW',
              `Insufficient escrow for payout ${payout.id}. Requested $${Number(payout.amount)} but available is $${escrow.available}. Brand must deposit more.`,
              payout.id,
            ),
          ),
        );
        throw new BadRequestException('Insufficient escrow funds validated for this campaign. Brand must deposit more.');
      }
    }

    // 2. Execute Flutterwave Transfer
    console.log(`[Escrow Transfer] Executing automated B2C payout for ${payout.amount} USD to user ${payout.creator.id}`);
    
    const payoutAccount = await this.payoutAccountRepo.findOne({ where: { user: { id: payout.creator.id } } });
    const hasManualBankDetails = !!(
      payoutAccount?.account_number &&
      payoutAccount?.bank_name &&
      payoutAccount?.country
    );
    const hasMobileMoney = !!payoutAccount?.mobile_number;
    if (!hasManualBankDetails && !hasMobileMoney) {
       throw new BadRequestException('Cannot execute transfer: recipient payout details are missing.');
    }

    const transferResult = await this.paymentService.triggerFlutterwaveTransfer(payout.creator.id, Number(payout.amount), `Escrow Payout for ${payout.campaign?.title}`);
    
    if (!transferResult.success) {
      throw new BadRequestException(`Escrow payout failed: ${transferResult.reason}`);
    }

    // 3. Mark as Paid and Notify (pass actorId for audit logging)
    return this.updatePayoutStatus(payout.id, 'paid', actorId, actorRole);
  }

  // ===== Audit Logs =====
  async getAuditLogs(query: any = {}): Promise<Page<any>> {
    const { limit, offset } = readPageParams(query, 25, 200);
    const [rows, total] = await this.auditLogRepo.findAndCount({
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });
    return asPage(rows.map((l) => ({ ...l, user: toPublicUser(l.user) })), total, limit, offset);
  }

  async getStats() {
    const totalUsers = await this.usersRepository.count();
    const totalCampaigns = await this.campaignsRepository.count();
    const activeCampaigns = await this.campaignsRepository.count({ where: { status: 'active' } });
    const totalApplications = await this.applicationsRepository.count();
    const pendingApplications = await this.applicationsRepository.count({ where: { status: 'pending' } });
    const totalPayouts = await this.payoutsRepository.count();
    const payoutSum = await this.payoutsRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .getRawOne();

    return {
      totalUsers,
      totalCampaigns,
      activeCampaigns,
      totalApplications,
      pendingApplications,
      totalPayouts,
      totalPayoutAmount: Number(payoutSum.total),
    };
  }

  // ===== User Management CRUD =====

  async createUser(email: string, password: string, role: string): Promise<any> {
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already exists');

    const password_hash = await bcrypt.hash(password, 10);
    const normalizedRole = assertKnownRole(role);
    const user = this.usersRepository.create({
      email,
      password_hash,
      role: normalizedRole as any,
      account_status: ['admin', 'support', 'finance'].includes(normalizedRole) ? 'active' : 'pending_verification',
    });
    const saved = await this.usersRepository.save(user);
    return { id: saved.id, email: saved.email, role: saved.role, created_at: saved.created_at };
  }

  async updateUser(id: string, data: any): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (data.role) user.role = assertKnownRole(data.role);
    if (data.email) user.email = data.email;
    if (data.password) {
      user.password_hash = await bcrypt.hash(data.password, 10);
    }
    if (data.permissions !== undefined) user.permissions = data.permissions;
    if (data.is_banned !== undefined) user.is_banned = data.is_banned;

    await this.usersRepository.save(user);
    return { success: true, id: user.id, email: user.email, role: user.role, is_banned: user.is_banned };
  }

  async toggleBan(id: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.is_banned = !user.is_banned;
    await this.usersRepository.save(user);
    return { id: user.id, is_banned: user.is_banned };
  }

  async updatePermissions(id: string, permissions: Record<string, boolean>): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.permissions = permissions;
    await this.usersRepository.save(user);
    return { id: user.id, permissions: user.permissions };
  }

  async deleteUser(id: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepository.remove(user);
    return { success: true };
  }
}
