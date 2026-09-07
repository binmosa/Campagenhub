import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { UserRole } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Contract } from '../contracts/contract.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { toPublicUser } from '../users/public-user';
import { ContractsService } from '../contracts/contracts.service';
import { assignedCampaignIds, engagementFor, isManager, managedBrandIds } from '../managers/manager-access';
import { In } from 'typeorm';

/** Applicant pipeline: pending → shortlisted → offered (contract sent) → accepted | rejected.
 *  `accepted` is only reached when the creator signs the contract; `refunded` is set by the payments flow. */
export const APPLICATION_STATUSES = ['pending', 'shortlisted', 'offered', 'accepted', 'rejected', 'refunded'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const normalizeApplicationStatus = (s?: string | null): ApplicationStatus | undefined => {
  if (!s) return undefined;
  const k = String(s).toLowerCase().trim();
  if (k === 'approved') return 'accepted';
  if (k === 'declined') return 'rejected';
  return (APPLICATION_STATUSES as readonly string[]).includes(k) ? (k as ApplicationStatus) : undefined;
};

/** Flatten the contract list: `contract` = the main agreement, `addenda` = extra-work proposals (newest first). */
const withContracts = (rows: Application[]): Application[] =>
  rows.map((a: any) => {
    const list: any[] = Array.isArray(a.contracts) ? a.contracts : [];
    const { contracts, ...rest } = a;
    return {
      ...rest,
      contract: list.find((c) => (c.kind || 'main') === 'main') || null,
      addenda: list.filter((c) => c.kind === 'addendum').sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()),
    };
  });

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private applicationsRepository: Repository<Application>,
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
    @InjectRepository(BrandTeam)
    private teamRepository: Repository<BrandTeam>,
    private notificationsService: NotificationsService,
    private contractsService: ContractsService,
  ) {}

  async applyToCampaign(userId: string, campaignId: string, pitch: string, videoPitchUrl?: string): Promise<Application> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    // A written pitch is always required; the video link only when the brief asks for it.
    const text = String(pitch || '').trim();
    if (!text) throw new BadRequestException('Write a short pitch — tell the brand why you fit this brief.');
    const mode = (campaign as any).video_pitch || 'none';
    let videoUrl = String(videoPitchUrl || '').trim();
    if (mode === 'none') videoUrl = '';
    else if (videoUrl && !/^https?:\/\/\S+$/i.test(videoUrl) && !videoUrl.startsWith('/')) {
      throw new BadRequestException('The video pitch must be a full link starting with http:// or https://.');
    }
    if (mode === 'required' && !videoUrl) throw new BadRequestException('This brief requires a link to a short video pitch.');

    try {
      const application = this.applicationsRepository.create({
        campaign: { id: campaignId },
        creator: { id: userId },
        pitch: text.slice(0, 5000),
        video_pitch_url: videoUrl || undefined,
        status: 'pending',
      });
      return await this.applicationsRepository.save(application);
    } catch (error: any) {
      if (error.code === '23505') { // Postgres unique constraint violation
        throw new BadRequestException('You have already applied to this campaign');
      }
      throw error;
    }
  }

  /**
   * Applications visible to the caller, newest first.
   *  - creators: their own, with the campaign + a SAFE brand summary;
   *  - brands: everything on their campaigns, with a SAFE creator summary
   *    (id/email/status + creator profile — never the User row's password
   *    hash or KYC documents), filterable by campaign and status.
   */

  /** Campaigns an engaged manager may act on: assigned by the brand, or created by them. */
  private async managedCampaignIds(user: any): Promise<string[]> {
    const brands = managedBrandIds(user);
    if (brands.length === 0) return [];
    const assigned = brands.flatMap((b) => assignedCampaignIds(engagementFor(user, b)));
    const created = await this.campaignsRepository.find({ where: { created_by: { id: user.userId }, brand: { id: In(brands) } } });
    return [...new Set([...assigned, ...created.map((c) => c.id)])];
  }

  async getApplications(
    user: any,
    filters: { campaignId?: string; status?: string } = {},
  ): Promise<Application[]> {
    if (user.role === UserRole.CREATOR) {
      return this.applicationsRepository
        .createQueryBuilder('a')
        .innerJoin('a.campaign', 'c')
        .leftJoin('c.brand', 'b')
        .leftJoin('b.brandProfile', 'bp')
        .leftJoin('a.creator', 'u')
        .where('u.id = :uid', { uid: user.userId })
        .select(['a', 'c', 'b.id', 'b.account_status', 'bp.id', 'bp.company_name', 'bp.logo_url', 'bp.industry'])
        .leftJoinAndSelect('a.contracts', 'ct')
        .orderBy('a.created_at', 'DESC')
        .getMany()
        .then(withContracts);
    }
    // An account manager sees only the applicants on campaigns inside their engagements.
    if (isManager(user)) {
      const ids = await this.managedCampaignIds(user);
      if (ids.length === 0) return [];
      const target = filters.campaignId && ids.includes(filters.campaignId) ? [filters.campaignId] : filters.campaignId ? [] : ids;
      if (target.length === 0) return [];
      const qb = this.applicationsRepository
        .createQueryBuilder('a')
        .innerJoin('a.campaign', 'c')
        .leftJoin('a.creator', 'u')
        .leftJoin('u.creatorProfile', 'cp')
        .where('c.id IN (:...ids)', { ids: target })
        .select(['a', 'c', 'u.id', 'u.email', 'u.account_status', 'u.created_at', 'cp'])
        .leftJoinAndSelect('a.contracts', 'ct')
        .orderBy('a.created_at', 'DESC');
      const st = normalizeApplicationStatus(filters.status);
      if (st) qb.andWhere('LOWER(a.status) = :st', { st });
      return qb.getMany().then(withContracts);
    }
    if (user.role === UserRole.BRAND) {
      const qb = this.applicationsRepository
        .createQueryBuilder('a')
        .innerJoin('a.campaign', 'c')
        .innerJoin('c.brand', 'b')
        .leftJoin('a.creator', 'u')
        .leftJoin('u.creatorProfile', 'cp')
        .where('b.id = :brandId', { brandId: user.userId })
        .select(['a', 'c', 'u.id', 'u.email', 'u.account_status', 'u.created_at', 'cp'])
        .leftJoinAndSelect('a.contracts', 'ct')
        .orderBy('a.created_at', 'DESC');
      if (filters.campaignId) qb.andWhere('c.id = :cid', { cid: filters.campaignId });
      const status = normalizeApplicationStatus(filters.status);
      if (status) qb.andWhere('LOWER(a.status) = :st', { st: status });
      return qb.getMany().then(withContracts);
    }
    return [];
  }

  /** Delegates to the contracts flow, which knows a manager's engagement. */
  actingBrandFor(user: any, applicationId: string): Promise<string> {
    return this.contractsService.actingBrandFor(user, applicationId);
  }

  async updateStatus(applicationId: string, brandId: string, rawStatus: string): Promise<Application> {
    const status = normalizeApplicationStatus(rawStatus);
    if (!status) {
      throw new BadRequestException(`Status must be one of: ${APPLICATION_STATUSES.join(', ')}`);
    }

    const application = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: ['campaign', 'campaign.brand', 'creator'],
    });

    if (!application) throw new BadRequestException('Application not found');
    if (application.campaign.brand.id !== brandId) {
      throw new BadRequestException('Not authorized');
    }

    if (status === 'accepted' || status === 'offered') {
      throw new BadRequestException('Send a contract from the applicant inbox — the application is accepted when the creator signs it.');
    }

    const previous = application.status;
    application.status = status;
    const saved = await this.applicationsRepository.save(application);

    if (status === 'rejected') {
      const open = await this.contractsRepository.find({ where: { application: { id: applicationId } } });
      for (const contract of open) {
        if (!['pending_signature', 'countered'].includes(contract.status)) continue;
        contract.status = 'rejected';
        contract.counter = null;
        contract.history = [...(contract.history || []), { at: new Date().toISOString(), by: 'brand', action: 'withdrawn' }];
        await this.contractsRepository.save(contract);
      }
    }

    if (status !== previous) {
      const title = application.campaign.title;
      const notify = (type: string, message: string) =>
        this.notificationsService
          .createNotification(application.creator.id, type, message, application.id)
          .catch(() => {});
      if (status === 'shortlisted') {
        await notify(
          'APPLICATION_SHORTLISTED',
          `Good news — you've been shortlisted for "${title}". The brand is reviewing final candidates.`,
        );
      } else if (status === 'rejected') {
        await notify(
          'APPLICATION_REJECTED',
          `Your application for "${title}" wasn't selected this time. Keep an eye on new briefs — more are posted every week.`,
        );
      }
    }

    // Never echo the brand's User row back to the client.
    const { campaign, creator, ...rest } = saved as any;
    return {
      ...rest,
      campaign: campaign ? { id: campaign.id, title: campaign.title, status: campaign.status } : undefined,
      creator: toPublicUser(creator),
    } as Application;
  }

  /** Brand accepts with terms = sends the contract. The creator still has to sign. */
  async setPaymentSchedule(
    applicationId: string,
    brandId: string,
    data: { payment_amount: number; currency: string; payment_frequency: string; payment_day: number; notes?: string; terms?: string; ends_at?: string | null },
  ): Promise<any> {
    const { application } = await this.contractsService.offer(brandId, applicationId, data);
    return application;
  }

}

