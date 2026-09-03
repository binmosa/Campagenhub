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

/** Applicant pipeline: pending → shortlisted → accepted | rejected.
 *  `refunded` is set by the payments flow after a cancelled engagement. */
export const APPLICATION_STATUSES = ['pending', 'shortlisted', 'accepted', 'rejected', 'refunded'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const normalizeApplicationStatus = (s?: string | null): ApplicationStatus | undefined => {
  if (!s) return undefined;
  const k = String(s).toLowerCase().trim();
  if (k === 'approved') return 'accepted';
  if (k === 'declined') return 'rejected';
  return (APPLICATION_STATUSES as readonly string[]).includes(k) ? (k as ApplicationStatus) : undefined;
};

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
  ) {}

  async applyToCampaign(userId: string, campaignId: string, pitch: string, videoPitchUrl?: string): Promise<Application> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    try {
      const application = this.applicationsRepository.create({
        campaign: { id: campaignId },
        creator: { id: userId },
        pitch,
        video_pitch_url: videoPitchUrl,
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
        .orderBy('a.created_at', 'DESC')
        .getMany();
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
        .orderBy('a.created_at', 'DESC');
      if (filters.campaignId) qb.andWhere('c.id = :cid', { cid: filters.campaignId });
      const status = normalizeApplicationStatus(filters.status);
      if (status) qb.andWhere('LOWER(a.status) = :st', { st: status });
      return qb.getMany();
    }
    return [];
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

    const previous = application.status;
    application.status = status;
    const saved = await this.applicationsRepository.save(application);

    if (status !== previous) {
      const title = application.campaign.title;
      const notify = (type: string, message: string) =>
        this.notificationsService
          .createNotification(application.creator.id, type, message, application.id)
          .catch(() => {});
      if (status === 'accepted') {
        await notify(
          'APPLICATION_APPROVED',
          `Your application for campaign "${title}" has been accepted! You can now view your contract or message the brand.`,
        );
      } else if (status === 'shortlisted') {
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

  async setPaymentSchedule(
    applicationId: string,
    brandId: string,
    data: { payment_amount: number; currency: string; payment_frequency: string; payment_day: number; notes?: string },
  ): Promise<Application> {
    const application = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: ['campaign', 'campaign.brand', 'creator'],
    });

    if (!application) throw new BadRequestException('Application not found');
    if (application.campaign.brand.id !== brandId) throw new BadRequestException('Not authorized');

    // Persist payment schedule fields onto application (stored as JSON extra or direct columns)
    application.payment_amount = data.payment_amount;
    application.currency = data.currency;
    application.payment_frequency = data.payment_frequency;
    application.payment_day = data.payment_day;
    if (data.notes) application.notes = data.notes;

    const saved = await this.applicationsRepository.save(application);

    // 1. Create or update Contract for this application
    let contract = await this.contractsRepository.findOne({ where: { application: { id: applicationId } } });
    const terms = `COLLABORATION AGREEMENT\n\nThis agreement is between the Brand and Creator (${application.creator.email}) for campaign "${application.campaign.title}".\n\nPAYMENT TERMS\nCompensation: ${data.currency} ${data.payment_amount} per ${data.payment_frequency}.\nPayment Day: Day ${data.payment_day}\n\nAdditional Notes: ${data.notes || 'None'}`;
    
    if (!contract) {
      contract = this.contractsRepository.create({
        application: { id: applicationId },
        status: 'active',
        terms,
        payment_amount: data.payment_amount
      });
    } else {
      contract.terms = terms;
      contract.payment_amount = data.payment_amount;
      contract.status = 'active'; // Also set to active if it was already created (e.g. pending_signature)
    }
    await this.contractsRepository.save(contract);

    // 2. Add Creator to Brand's Team so they show up in "My Team"
    const existingTeam = await this.teamRepository.findOne({
      where: { brand: { id: brandId }, member: { id: application.creator.id }, is_active: true }
    });

    if (!existingTeam) {
      const team = this.teamRepository.create({
        brand: { id: brandId } as any,
        member: { id: application.creator.id } as any,
        member_type: 'creator',
        payment_amount: data.payment_amount,
        payment_frequency: data.payment_frequency as any,
        payment_day: data.payment_day,
        currency: data.currency,
        is_active: true
      });
      await this.teamRepository.save(team);
    } else {
      existingTeam.payment_amount = data.payment_amount;
      existingTeam.payment_frequency = data.payment_frequency as any;
      existingTeam.payment_day = data.payment_day;
      existingTeam.currency = data.currency;
      await this.teamRepository.save(existingTeam);
    }

    await this.notificationsService.createNotification(
      application.creator.id,
      'CONTRACT_UPDATED',
      `Your payment schedule and contract have been finalized for campaign: ${application.campaign.title}.`,
      application.id,
    );

    return saved;
  }
}

