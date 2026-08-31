import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { UserRole } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Contract } from '../contracts/contract.entity';
import { BrandTeam } from '../invitations/brand-team.entity';

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

  async getApplications(user: any): Promise<Application[]> {
    if (user.role === UserRole.CREATOR) {
      return this.applicationsRepository.find({
        where: { creator: { id: user.userId } },
        relations: ['campaign', 'campaign.brand', 'campaign.brand.brandProfile'],
        order: { created_at: 'DESC' },
      });
    } else if (user.role === UserRole.BRAND) {
      return this.applicationsRepository.find({
        where: { campaign: { brand: { id: user.userId } } },
        relations: ['campaign', 'creator', 'creator.creatorProfile'],
        order: { created_at: 'DESC' },
      });
    }
    return [];
  }

  async updateStatus(applicationId: string, brandId: string, status: string): Promise<Application> {
    const application = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: ['campaign', 'campaign.brand', 'creator'],
    });

    if (!application) throw new BadRequestException('Application not found');
    if (application.campaign.brand.id !== brandId) {
      throw new BadRequestException('Not authorized');
    }

    application.status = status;
    const saved = await this.applicationsRepository.save(application);

    if (status === 'accepted') {
      await this.notificationsService.createNotification(
        application.creator.id,
        'APPLICATION_APPROVED',
        `Your application for campaign "${application.campaign.title}" has been accepted! You can now view your contract or message the brand.`,
        application.id
      );
    }

    return saved;
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

