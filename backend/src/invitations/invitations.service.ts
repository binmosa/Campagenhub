import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Invitation } from './invitation.entity';
import { BrandTeam } from './brand-team.entity';
import { User } from '../users/user.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { toPublicUser } from '../users/public-user';

/** Strip User rows on an invitation / team row down to their public shape. */
const sanitizeInvitation = (inv: any): any => {
  if (!inv) return inv;
  const out = { ...inv };
  if (out.sender) out.sender = toPublicUser(out.sender);
  if (out.receiver) out.receiver = toPublicUser(out.receiver);
  if (out.brand) out.brand = toPublicUser(out.brand);
  if (out.member) out.member = toPublicUser(out.member);
  return out;
};

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation) private invRepo: Repository<Invitation>,
    @InjectRepository(BrandTeam) private teamRepo: Repository<BrandTeam>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ManagerProfile) private managerRepo: Repository<ManagerProfile>,
    private notifications: NotificationsService,
  ) {}

  // ─── AI Smart Manager Assignment on Brand Approval ─────────────────────────
  async autoAssignManagerToBrand(brandUserId: string): Promise<void> {
    try {
      const brand = await this.userRepo.findOne({ where: { id: brandUserId } });
      if (!brand) return;

      // Get brand profile to know industry
      const brandProfile = await this.userRepo.query(
        `SELECT bp.industry, bp.company_name FROM brand_profiles bp WHERE bp.user_id = $1`, [brandUserId]
      );
      const industry = brandProfile?.[0]?.industry || 'General';

      // Get all active managers with their current client count
      const managers = await this.managerRepo.find({
        where: { user: { account_status: 'active' } },
        relations: ['user'],
      });

      if (!managers.length) return;

      // Score: specialty match + workload balance (fewer active clients = better)
      const teamCounts = await this.teamRepo
        .createQueryBuilder('bt')
        .select('bt.brand_id', 'brand_id')
        .addSelect('COUNT(*)', 'count')
        .where('bt.is_active = true AND bt.member_type = :type', { type: 'manager' })
        .groupBy('bt.brand_id')
        .getRawMany();

      // Count per manager_user_id
      const clientCountMap: Record<string, number> = {};
      for (const row of teamCounts) {
        clientCountMap[row.brand_id] = parseInt(row.count, 10);
      }

      // Score managers
      const scored = managers.map(m => {
        const specialty = (m.specialty || '').toLowerCase();
        const ind = industry.toLowerCase();
        const specialtyMatch = specialty.includes(ind) || ind.includes(specialty) ? 1 : 0.3;
        const clientLoad = clientCountMap[m.user.id] || 0;
        const availabilityScore = Math.max(0, 1 - clientLoad / 10);
        const ratingScore = Number(m.rating) / 5;
        const score = specialtyMatch * 0.4 + availabilityScore * 0.4 + ratingScore * 0.2;
        return { manager: m, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0]?.manager;
      if (!best) return;

      // Create invitation from system
      const inv = this.invRepo.create({
        sender: { id: brandUserId } as any,    // brand sends to manager
        receiver: { id: best.user.id } as any,
        brand: { id: brandUserId } as any,
        type: 'manager_assign',
        message: `Welcome to the CampaignHub team! You have been matched as the dedicated Social Manager for ${brand.email}. Please review and accept this collaboration.`,
        contract_content: `SOCIAL MANAGER ENGAGEMENT AGREEMENT\n\nThis agreement is between the Brand (${brand.email}) and Social Manager (${best.full_name || best.user.id}). The manager agrees to provide campaign management services as assigned by CampaignHub platform. Terms are subject to platform policies.`,
        payment_approved: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await this.invRepo.save(inv);

      await this.notifications.createNotification(
        best.user.id,
        'invitation',
        `🎉 You have been matched with a new brand as their Social Manager. Check your invitations to accept.`,
        inv.id,
      );
    } catch (e) {
      console.error('Auto-assign manager error:', e.message);
    }
  }

  // ─── Send Invitation ────────────────────────────────────────────────────────
  async sendInvitation(senderId: string, body: any): Promise<Invitation> {
    const { receiver_id, brand_id, type, message, contract_content,
            payment_amount, payment_frequency, payment_day, currency, permissions, video_link } = body;

    const sender = await this.userRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    const receiver = await this.userRepo.findOne({ where: { id: receiver_id } });
    if (!receiver) throw new NotFoundException('Recipient not found');

    // Check not already invited
    const existing = await this.invRepo.findOne({
      where: { sender: { id: senderId }, receiver: { id: receiver_id }, status: 'pending' },
    });
    if (existing) throw new BadRequestException('You already have a pending invitation to this user');

    // Creators cannot send invitations at all
    if (sender.role === 'creator') {
      throw new BadRequestException('Creators cannot send invitations. Only Brands and Managers can recruit talent.');
    }

    const effectiveBrandId = brand_id || (sender.role === 'brand' ? senderId : null);
    const isMgrSending = sender.role === 'manager';

    const inv = this.invRepo.create({
      sender: { id: senderId } as any,
      receiver: { id: receiver_id } as any,
      brand: effectiveBrandId ? { id: effectiveBrandId } as any : undefined,
      type: type || 'creator_collab',
      message,
      contract_content,
      payment_amount,
      payment_frequency: payment_frequency || 'monthly',
      payment_day: payment_day || 1,
      currency: currency || 'NGN',
      permissions,
      video_link,
      payment_approved: !isMgrSending, // requires brand approval if manager sends
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const saved = await this.invRepo.save(inv);

    await this.notifications.createNotification(
      receiver_id,
      'invitation',
      `📩 You have a new collaboration invitation from ${sender.email}. Review it in your Invitations.`,
      saved.id,
    );

    // If manager sent, notify brand to approve payment
    if (isMgrSending && effectiveBrandId) {
      await this.notifications.createNotification(
        effectiveBrandId,
        'payment_approval',
        `💰 Your manager sent an invitation to a creator with payment terms. Please review and approve.`,
        saved.id,
      );
    }

    return saved;
  }

  // ─── Get Single Invitation ────────────────────────────────────────────────
  async findOne(userId: string, invId: string): Promise<Invitation> {
    const inv = await this.invRepo.findOne({
      where: [
        { id: invId, receiver: { id: userId } },
        { id: invId, sender: { id: userId } },
        { id: invId, brand: { id: userId } },
      ],
      relations: ['sender', 'receiver', 'brand'],
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    return inv;
  }

  // ─── Get Received Invitations ───────────────────────────────────────────────
  async getReceived(userId: string): Promise<Invitation[]> {
    const rows = await this.invRepo.find({
      where: { receiver: { id: userId } },
      relations: ['sender', 'sender.brandProfile', 'sender.managerProfile', 'brand', 'brand.brandProfile'],
      order: { created_at: 'DESC' },
    });
    return rows.map(sanitizeInvitation);
  }

  // ─── Get Sent Invitations ───────────────────────────────────────────────────
  async getSent(userId: string): Promise<Invitation[]> {
    const rows = await this.invRepo.find({
      where: [
        { sender: { id: userId } },
        { brand: { id: userId } },
      ],
      relations: ['receiver', 'receiver.creatorProfile', 'receiver.managerProfile', 'sender'],
      order: { created_at: 'DESC' },
    });
    return rows.map(sanitizeInvitation);
  }

  // ─── Accept Invitation ──────────────────────────────────────────────────────
  async accept(userId: string, invId: string): Promise<BrandTeam> {
    const inv = await this.invRepo.findOne({
      where: { id: invId, receiver: { id: userId } },
      relations: ['sender', 'receiver', 'brand'],
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'pending') throw new BadRequestException('Invitation is no longer pending');

    // Check payment approved
    if (!inv.payment_approved) {
      throw new BadRequestException('Payment terms must be approved by the brand before you can accept');
    }

    inv.status = 'accepted';
    await this.invRepo.save(inv);

    // Determine brand
    const brandId = inv.brand?.id || inv.sender?.id;
    const memberType = inv.type === 'manager_assign' ? 'manager' : 'creator';

    // Create team membership
    const team = this.teamRepo.create({
      brand: { id: brandId } as any,
      member: { id: userId } as any,
      member_type: memberType,
      invitation_id: inv.id,
      permissions: inv.permissions || {},
      payment_amount: inv.payment_amount,
      payment_frequency: inv.payment_frequency,
      payment_day: inv.payment_day,
      currency: inv.currency,
      is_active: true,
    });
    const savedTeam = await this.teamRepo.save(team);

    // Notify brand
    await this.notifications.createNotification(
      brandId,
      'invitation_accepted',
      `✅ ${inv.receiver?.email} accepted your collaboration invitation and joined your team!`,
      inv.id,
    );

    return savedTeam;
  }

  // ─── Decline Invitation ─────────────────────────────────────────────────────
  async decline(userId: string, invId: string): Promise<void> {
    const inv = await this.invRepo.findOne({
      where: { id: invId, receiver: { id: userId } },
      relations: ['sender', 'brand'],
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    inv.status = 'declined';
    await this.invRepo.save(inv);

    const brandId = inv.brand?.id || inv.sender?.id;
    await this.notifications.createNotification(
      brandId,
      'invitation_declined',
      `❌ Your collaboration invitation was declined.`,
      inv.id,
    );
  }

  // ─── Cancel Invitation ──────────────────────────────────────────────────────
  async cancel(userId: string, invId: string): Promise<void> {
    const inv = await this.invRepo.findOne({
      where: { sender: { id: userId }, id: invId },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'pending') throw new BadRequestException('Cannot cancel a non-pending invitation');
    inv.status = 'cancelled';
    await this.invRepo.save(inv);
  }

  // ─── Brand Approves Payment Terms (when manager sent invite) ────────────────
  async approvePayment(brandId: string, invId: string): Promise<Invitation> {
    const inv = await this.invRepo.findOne({
      where: { id: invId, brand: { id: brandId } },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    inv.payment_approved = true;
    return this.invRepo.save(inv);
  }

  // ─── Check if already invited ───────────────────────────────────────────────
  async checkStatus(senderId: string, receiverId: string): Promise<{ status: string | null }> {
    const inv = await this.invRepo.findOne({
      where: [
        { sender: { id: senderId }, receiver: { id: receiverId }, status: 'pending' },
        { sender: { id: senderId }, receiver: { id: receiverId }, status: 'accepted' },
      ],
    });
    return { status: inv ? inv.status : null };
  }

  // ─── Get Pending Approvals for brand ────────────────────────────────────────
  async getPendingApprovals(brandId: string): Promise<Invitation[]> {
    return this.invRepo.find({
      where: { brand: { id: brandId }, payment_approved: false, status: 'pending' },
      relations: ['sender', 'receiver'],
      order: { created_at: 'DESC' },
    });
  }

  // ─── Get My Team ────────────────────────────────────────────────────────────
  async getMyTeam(brandId: string): Promise<any[]> {
    const rows = await this.teamRepo.find({
      where: { brand: { id: brandId }, is_active: true },
      relations: ['member', 'member.creatorProfile', 'member.managerProfile'],
      order: { joined_at: 'DESC' },
    });
    // Members arrive with their profile (name, avatar, socials) and nothing
    // sensitive from the User row.
    return rows.map(sanitizeInvitation);
  }

  // ─── Update Team Member Permissions ─────────────────────────────────────────
  async updatePermissions(brandId: string, teamId: string, permissions: any): Promise<BrandTeam> {
    const entry = await this.teamRepo.findOne({
      where: { id: teamId, brand: { id: brandId } },
    });
    if (!entry) throw new NotFoundException('Team member not found');
    entry.permissions = permissions;
    return this.teamRepo.save(entry);
  }

  // ─── Update Payment Terms ────────────────────────────────────────────────────
  async updatePaymentTerms(brandId: string, teamId: string, terms: any): Promise<BrandTeam> {
    const entry = await this.teamRepo.findOne({
      where: { id: teamId, brand: { id: brandId } },
      relations: ['member'],
    });
    if (!entry) throw new NotFoundException('Team member not found');
    entry.payment_amount = terms.payment_amount;
    entry.payment_frequency = terms.payment_frequency;
    entry.payment_day = terms.payment_day;
    entry.currency = terms.currency;
    const saved = await this.teamRepo.save(entry);

    // Notify member
    await this.notifications.createNotification(
      entry.member.id,
      'payment_updated',
      `💰 Your payment terms have been updated by the brand. New amount: ${terms.currency} ${terms.payment_amount} / ${terms.payment_frequency}.`,
      teamId,
    );

    return saved;
  }

  // ─── Remove Team Member ──────────────────────────────────────────────────────
  async removeMember(brandId: string, teamId: string, reason?: string): Promise<void> {
    const entry = await this.teamRepo.findOne({
      where: { id: teamId, brand: { id: brandId } },
      relations: ['member'],
    });
    if (!entry) throw new NotFoundException('Team member not found');
    entry.is_active = false;
    entry.removed_at = new Date();
    entry.removal_reason = reason || 'Removed by brand';
    await this.teamRepo.save(entry);

    await this.notifications.createNotification(
      entry.member.id,
      'removed_from_team',
      `📋 You have been removed from the brand's team. Your active collaboration contract has ended.`,
      teamId,
    );
  }

  // ─── Negotiate Invitation Terms ──────────────────────────────────────────────
  async negotiateInvitation(userId: string, invId: string, terms: any): Promise<Invitation> {
    const inv = await this.invRepo.findOne({
      where: [
        { id: invId, sender: { id: userId } },
        { id: invId, receiver: { id: userId } },
        { id: invId, brand: { id: userId } },
      ],
      relations: ['sender', 'receiver', 'brand'],
    });

    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'pending') throw new BadRequestException('Cannot negotiate non-pending invitation');

    // Update terms
    if (terms.payment_amount !== undefined) inv.payment_amount = terms.payment_amount;
    if (terms.currency !== undefined) inv.currency = terms.currency;
    if (terms.payment_frequency !== undefined) inv.payment_frequency = terms.payment_frequency;
    if (terms.payment_day !== undefined) inv.payment_day = terms.payment_day;
    if (terms.contract_content !== undefined) inv.contract_content = terms.contract_content;

    // Reset brand approval if a manager/creator changes terms (optional, based on logic)
    // If sender is NOT the brand, then payment_approved might need to be false
    const brandId = inv.brand?.id || (inv.sender.role === 'brand' ? inv.sender.id : null);
    if (brandId && userId !== brandId) {
      inv.payment_approved = false;
    }

    const saved = await this.invRepo.save(inv);

    // Notify counterparty
    const counterpartyId = inv.sender.id === userId ? inv.receiver.id : inv.sender.id;
    await this.notifications.createNotification(
      counterpartyId,
      'negotiation_updated',
      `📑 The invitation terms have been updated to ${inv.currency} ${inv.payment_amount} / ${inv.payment_frequency}.`,
      inv.id,
    );

    return saved;
  }
}
