import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
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
  async getAllUsers(): Promise<any[]> {
    const users = await this.usersRepository.find({
      relations: ['creatorProfile', 'brandProfile', 'managerProfile'],
      order: { created_at: 'DESC' },
    });
    return users.map((u) => {
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

  async getAllCampaigns(): Promise<Campaign[]> {
    return this.campaignsRepository.find({
      relations: ['brand', 'brand.brandProfile'],
      order: { created_at: 'DESC' },
    });
  }

  async getAllApplications(): Promise<Application[]> {
    return this.applicationsRepository.find({
      relations: ['campaign', 'campaign.brand', 'creator', 'creator.creatorProfile'],
      order: { created_at: 'DESC' },
    });
  }

  async getAllPayouts(): Promise<any[]> {
    // Reconcile missed webhook/verify cases so completed transactions appear for approval.
    await this.paymentService.reconcileMissingPayoutRequests();

    const payouts = await this.payoutsRepository.find({
      relations: ['creator', 'creator.creatorProfile', 'campaign'],
      order: { created_at: 'DESC' },
    });

    // Stitch PayoutAccount statically into the response
    const enrichedPayouts = await Promise.all(payouts.map(async (p) => {
      let payoutAccount = null;
      if (p.creator?.id) {
        payoutAccount = await this.payoutAccountRepo.findOne({ where: { user: { id: p.creator.id } } });
      }
      return { ...p, payoutAccount };
    }));

    return enrichedPayouts;
  }

  async toggleCampaignStatus(campaignId: string, status: string): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.status = status;
    return this.campaignsRepository.save(campaign);
  }

  private async computeCampaignEscrow(campaignId: string): Promise<{ deposited: number; committed: number; available: number }> {
    const depositedRaw = await this.paymentTransactionRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.campaign = :campaignId', { campaignId })
      .andWhere('tx.status = :status', { status: 'completed' })
      .getRawOne();
    const deposited = Number(depositedRaw?.total || 0);

    const committedRaw = await this.payoutsRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .where('payout.campaign = :campaignId', { campaignId })
      .andWhere('payout.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
      .getRawOne();
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
      const escrow = await this.computeCampaignEscrow(payout.campaign.id);
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
      const escrow = await this.computeCampaignEscrow(payout.campaign.id);
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
  async getAuditLogs(): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
      take: 200,
    });
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
    const normalizedRole = (role || '').toLowerCase().trim();
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

    if (data.role) user.role = data.role;
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
