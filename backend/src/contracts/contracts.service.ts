import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './contract.entity';
import { Application } from '../applications/application.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Invitation } from '../invitations/invitation.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { toPublicUser } from '../users/public-user';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private contractsRepo: Repository<Contract>,
    @InjectRepository(Application)
    private applicationsRepo: Repository<Application>,
    @InjectRepository(Invitation)
    private invRepo: Repository<Invitation>,
    @InjectRepository(BrandTeam)
    private teamRepo: Repository<BrandTeam>,
    private notificationsService: NotificationsService,
  ) {}

  async getMyContracts(userId: string): Promise<any[]> {
    // Return contracts where user is either brand or creator side
    const all = await this.contractsRepo.find({
      relations: ['application', 'application.creator', 'application.campaign', 'application.campaign.brand'],
      order: { created_at: 'DESC' } as any,
    });
    const appContracts = all.filter(c => {
      try {
        return (
          c.application?.creator?.id === userId ||
          c.application?.campaign?.brand?.id === userId
        );
      } catch { return false; }
    });

    // Also fetch live team memberships acting as active agreements
    const teams = await this.teamRepo.find({
      where: [
        { brand: { id: userId } },
        { member: { id: userId } }
      ],
      relations: ['brand', 'member']
    });

    const teamContracts: any[] = [];
    for (const t of teams) {
      if (!t.invitation_id) continue; // Skip members added via Applications (handled by appContracts)

      let terms = 'STANDARD COLLABORATION AGREEMENT';
      try {
        const inv = await this.invRepo.findOne({ where: { id: t.invitation_id } });
        if (inv?.contract_content) terms = inv.contract_content;
      } catch {}

      // Avoid duplicates if multiple records have same invitation_id
      if (teamContracts.some(c => c.id === t.invitation_id)) continue;

      const isMeMember = t.member?.id === userId;
      const opponentEmail = isMeMember ? t.brand?.email : t.member?.email;

      teamContracts.push({
        id: t.invitation_id, // Use invitation_id so endContract can process it
        status: t.is_active ? 'active' : 'ended',
        type: t.member_type === 'creator' ? 'brand_creator' : 'brand_manager',
        created_at: t.joined_at,
        currency: t.currency,
        payment_amount: t.payment_amount,
        payment_frequency: t.payment_frequency,
        payment_day: t.payment_day,
        terms: terms,
        title: `Contract with ${opponentEmail ? opponentEmail.split('@')[0] : 'User'}`,
        opponent_id: isMeMember ? t.brand?.id : t.member?.id,
        opponent_email: opponentEmail
      });
    }

    const unifiedContracts = [
      ...appContracts.map(c => {
        const isCreator = c.application?.creator?.id === userId;
        const opponentEmail = isCreator ? c.application?.campaign?.brand?.email : c.application?.creator?.email;
        // Never ship the User rows (password hash, KYC blobs) hanging off the
        // application — only their public shape.
        const application = c.application
          ? {
              ...c.application,
              creator: toPublicUser(c.application.creator),
              campaign: c.application.campaign
                ? { ...c.application.campaign, brand: toPublicUser(c.application.campaign.brand) }
                : c.application.campaign,
            }
          : c.application;
        return {
          ...c,
          application,
          // Payment terms live on the application (set when the brand accepted).
          currency: c.application?.currency || 'USD',
          payment_frequency: c.application?.payment_frequency || undefined,
          payment_day: c.application?.payment_day || undefined,
          title: `Contract with ${opponentEmail ? opponentEmail.split('@')[0] : 'User'}`,
          opponent_id: isCreator ? c.application?.campaign?.brand?.id : c.application?.creator?.id,
          opponent_email: opponentEmail
        };
      }),
      ...teamContracts
    ];

    return unifiedContracts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getContractForApplication(userId: string, applicationId: string): Promise<Contract | null> {
    const application = await this.applicationsRepo.findOne({
      where: { id: applicationId },
      relations: ['creator', 'campaign', 'campaign.brand']
    });

    if (!application) throw new BadRequestException('Application not found');

    if (application.creator.id !== userId && application.campaign.brand.id !== userId) {
      throw new BadRequestException('Not authorized');
    }

    return this.contractsRepo.findOne({
      where: { application: { id: applicationId } }
    });
  }

  async upsertContract(brandId: string, applicationId: string, terms: string, paymentAmount: number, contractLength?: string): Promise<Contract> {
    const application = await this.applicationsRepo.findOne({
      where: { id: applicationId },
      relations: ['campaign', 'campaign.brand', 'creator']
    });

    if (!application) throw new BadRequestException('Application not found');
    if (application.campaign.brand.id !== brandId) {
      throw new BadRequestException('Only the brand can modify the contract terms');
    }

    let contract = await this.contractsRepo.findOne({ where: { application: { id: applicationId } } });

    if (!contract) {
      contract = this.contractsRepo.create({
        application: { id: applicationId },
        status: 'pending_signature',
        terms,
        payment_amount: paymentAmount,
        contract_length: contractLength
      });
    } else {
      contract.terms = terms;
      contract.payment_amount = paymentAmount;
      if (contractLength !== undefined) {
        contract.contract_length = contractLength;
      }
      contract.status = 'pending_signature'; // Reset status if terms change
    }

    const saved = await this.contractsRepo.save(contract);
    
    await this.notificationsService.createNotification(
      application.creator.id,
      'CONTRACT_UPDATED',
      `A contract has been proposed/updated for campaign: ${application.campaign.title}`,
      applicationId
    );

    return saved;
  }

  async respondToContract(creatorId: string, applicationId: string, status: string): Promise<Contract> {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const application = await this.applicationsRepo.findOne({
      where: { id: applicationId },
      relations: ['creator', 'campaign', 'campaign.brand']
    });

    if (!application || application.creator.id !== creatorId) {
      throw new BadRequestException('Application not found or unauthorized');
    }

    const contract = await this.contractsRepo.findOne({ where: { application: { id: applicationId } } });
    if (!contract) throw new BadRequestException('Contract not found');

    contract.status = status === 'approved' ? 'active' : status;
    const saved = await this.contractsRepo.save(contract);

    await this.notificationsService.createNotification(
      application.campaign.brand.id,
      'CONTRACT_UPDATED',
      `The creator has ${status} the contract for campaign: ${application.campaign.title}`,
      applicationId
    );

    return saved;
  }

  async endContract(userId: string, docId: string): Promise<any> {
    // Check if docId is a Contract
    let contract = await this.contractsRepo.findOne({
      where: { id: docId },
      relations: ['application', 'application.creator', 'application.campaign', 'application.campaign.brand'],
    });

    if (contract) {
       // Validate user is brand or creator
       if (contract.application.creator.id !== userId && contract.application.campaign.brand.id !== userId) {
         throw new BadRequestException('Unauthorized');
       }
       contract.status = 'ended';
       await this.contractsRepo.save(contract);

       // Notify the other party
       const notifyId = contract.application.creator.id === userId ? contract.application.campaign.brand.id : contract.application.creator.id;
       await this.notificationsService.createNotification(
         notifyId,
         'CONTRACT_ENDED',
         `The collaboration contract for "${contract.application.campaign.title}" has been ended/terminated.`,
         contract.id
       );
       return contract;
    }

    // Checking if docId is an Invitation (BrandTeam contract)
    const inv = await this.invRepo.findOne({
      where: { id: docId },
      relations: ['sender', 'receiver', 'brand']
    });

    if (inv) {
       // Validate user
       const isSender = inv.sender?.id === userId;
       const isReceiver = inv.receiver?.id === userId;
       const isBrand = inv.brand?.id === userId;
       if (!isSender && !isReceiver && !isBrand) throw new BadRequestException('Unauthorized');

       inv.status = 'expired'; // act as ended
       await this.invRepo.save(inv);

       // Find logic: A brand team might have been created from this invitation. If so, deactivate it.
       const teamEntry = await this.teamRepo.findOne({
         where: { invitation_id: inv.id, is_active: true }
       });
       
       if (teamEntry) {
         teamEntry.is_active = false;
         teamEntry.removed_at = new Date();
         teamEntry.removal_reason = "Contract ended";
         await this.teamRepo.save(teamEntry);
       }

       const notifyId = inv.receiver.id === userId ? (inv.brand?.id || inv.sender.id) : inv.receiver.id;
       await this.notificationsService.createNotification(
         notifyId,
         'CONTRACT_ENDED',
         `Your collaboration agreement has been ended/terminated.`,
         inv.id
       );
       return inv;
    }

    throw new BadRequestException('Contract not found');
  }
}
