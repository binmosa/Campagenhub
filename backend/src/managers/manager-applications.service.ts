import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ManagerApplication } from './manager-application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { toPublicUser } from '../users/public-user';

const FREQUENCIES = ['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const publicCampaign = (c: any) =>
  c ? { id: c.id, title: c.title, status: c.status, budget: c.budget, budget_usd: c.budget_usd, currency: c.currency, platform: c.platform, deadline: c.deadline, cover_image: c.cover_image } : c;

const shape = (a: ManagerApplication): any => ({
  ...a,
  manager: toPublicUser(a.manager),
  brand: toPublicUser(a.brand),
  campaign: publicCampaign(a.campaign),
});

/**
 * Managers offer to run a brand's campaign; the brand answers by granting
 * them a budget. Everything a manager may later do for that brand — create
 * briefs, review applicants, see the talent directory — starts here.
 */
@Injectable()
export class ManagerApplicationsService {
  constructor(
    @InjectRepository(ManagerApplication) private readonly repo: Repository<ManagerApplication>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(BrandTeam) private readonly teams: Repository<BrandTeam>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  private notify(userId: string, type: string, message: string, ref?: string) {
    return this.notifications.createNotification(userId, type, message, ref).catch(() => {});
  }

  async apply(
    managerId: string,
    body: { campaignId: string; pitch?: string; proposed_fee?: number; currency?: string; fee_frequency?: string },
  ): Promise<any> {
    const campaign = await this.campaigns.findOne({ where: { id: body.campaignId }, relations: ['brand', 'brand.brandProfile'] });
    if (!campaign?.brand?.id) throw new NotFoundException('Campaign not found');
    if (String(campaign.status).toLowerCase() !== 'active') throw new BadRequestException('This campaign is not open.');

    const existing = await this.repo.findOne({ where: { manager: { id: managerId }, campaign: { id: campaign.id } } });
    if (existing && ['pending', 'accepted'].includes(existing.status)) {
      throw new BadRequestException(existing.status === 'accepted' ? 'You already manage this campaign.' : 'You already offered to manage this campaign.');
    }

    const fee = Number(body.proposed_fee);
    const row =
      existing ||
      this.repo.create({ manager: { id: managerId } as any, campaign: { id: campaign.id } as any, brand: { id: campaign.brand.id } as any });
    row.pitch = body.pitch ? String(body.pitch).slice(0, 4000) : '';
    row.proposed_fee = Number.isFinite(fee) && fee > 0 ? fee : null;
    row.currency = String(body.currency || campaign.currency || 'USD').toUpperCase().slice(0, 3);
    row.fee_frequency = FREQUENCIES.includes(String(body.fee_frequency)) ? String(body.fee_frequency) : 'one_time';
    row.status = 'pending';
    row.decision_note = null;
    row.decided_at = null;
    const saved = await this.repo.save(row);

    const manager = await this.users.findOne({ where: { id: managerId }, relations: ['managerProfile'] });
    const who = (manager as any)?.managerProfile?.full_name || manager?.email?.split('@')[0] || 'A manager';
    await this.notify(
      campaign.brand.id,
      'MANAGER_APPLICATION',
      `${who} offered to manage "${campaign.title}". Review their offer in My team and set what they may spend.`,
      saved.id,
    );
    return this.one(saved.id);
  }

  private async one(id: string): Promise<any> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['manager', 'manager.managerProfile', 'brand', 'brand.brandProfile', 'campaign'],
    });
    return row ? shape(row) : null;
  }

  async mine(managerId: string, status?: string): Promise<any[]> {
    const rows = await this.repo.find({
      where: { manager: { id: managerId }, ...(status ? { status } : {}) },
      relations: ['brand', 'brand.brandProfile', 'campaign', 'manager', 'manager.managerProfile'],
      order: { created_at: 'DESC' } as any,
    });
    return rows.map(shape);
  }

  async forBrand(brandId: string, filters: { campaignId?: string; status?: string } = {}): Promise<any[]> {
    const rows = await this.repo.find({
      where: {
        brand: { id: brandId },
        ...(filters.campaignId ? { campaign: { id: filters.campaignId } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      relations: ['manager', 'manager.managerProfile', 'campaign', 'brand'],
      order: { created_at: 'DESC' } as any,
    });
    return rows.map(shape);
  }

  async withdraw(managerId: string, id: string): Promise<any> {
    const row = await this.repo.findOne({ where: { id }, relations: ['manager', 'campaign'] });
    if (!row || row.manager?.id !== managerId) throw new NotFoundException('Offer not found');
    if (row.status !== 'pending') throw new BadRequestException('Only a pending offer can be withdrawn.');
    row.status = 'withdrawn';
    await this.repo.save(row);
    return this.one(id);
  }

  /**
   * The brand answers. Accepting engages the manager for that campaign with
   * an explicit grant: how many briefs they may create and how much budget
   * they may commit (null on either means unlimited).
   */
  async decide(
    brandId: string,
    id: string,
    body: {
      action: 'accept' | 'reject';
      note?: string;
      campaign_limit?: number | null;
      budget_cap?: number | null;
      permissions?: Record<string, boolean>;
      payment_amount?: number;
      currency?: string;
      payment_frequency?: string;
      payment_day?: number;
    },
  ): Promise<any> {
    const row = await this.repo.findOne({ where: { id }, relations: ['manager', 'brand', 'campaign'] });
    if (!row) throw new NotFoundException('Offer not found');
    if (row.brand?.id !== brandId) throw new ForbiddenException('This offer was sent to another brand.');
    if (row.status !== 'pending') throw new BadRequestException('This offer has already been answered.');

    if (body.action === 'reject') {
      row.status = 'rejected';
      row.decision_note = body.note ? String(body.note).slice(0, 2000) : null;
      row.decided_at = new Date();
      await this.repo.save(row);
      await this.notify(row.manager.id, 'MANAGER_APPLICATION_DECIDED', `Your offer to manage "${row.campaign?.title}" was declined.${body.note ? ` Note: ${body.note}` : ''}`, row.id);
      return this.one(id);
    }

    const limit = body.campaign_limit == null || body.campaign_limit === ('' as any) ? null : Math.max(0, Math.round(Number(body.campaign_limit)));
    const cap = body.budget_cap == null || body.budget_cap === ('' as any) ? null : Math.max(0, Number(body.budget_cap));
    if (limit != null && !Number.isFinite(limit)) throw new BadRequestException('Campaign limit must be a whole number.');
    if (cap != null && !Number.isFinite(cap)) throw new BadRequestException('Budget cap must be a number.');

    let team = await this.teams.findOne({ where: { brand: { id: brandId }, member: { id: row.manager.id }, member_type: 'manager' } });
    if (!team) {
      team = this.teams.create({ brand: { id: brandId } as any, member: { id: row.manager.id } as any, member_type: 'manager' });
    }
    const campaigns = new Set([...(team.grant?.campaigns || []), row.campaign.id]);
    team.is_active = true;
    team.removed_at = null as any;
    team.permissions = { can_manage_applications: true, can_view_analytics: true, ...(body.permissions || {}) };
    team.grant = { campaign_limit: limit, budget_cap: cap, campaigns: [...campaigns] };
    const fee = Number(body.payment_amount ?? row.proposed_fee);
    if (Number.isFinite(fee) && fee > 0) {
      team.payment_amount = fee;
      team.currency = String(body.currency || row.currency || 'USD').toUpperCase().slice(0, 3);
      team.payment_frequency = FREQUENCIES.includes(String(body.payment_frequency)) ? String(body.payment_frequency) : row.fee_frequency || 'one_time';
      team.payment_day = Number(body.payment_day) > 0 ? Math.min(28, Math.round(Number(body.payment_day))) : 1;
    }
    await this.teams.save(team);

    row.status = 'accepted';
    row.decision_note = body.note ? String(body.note).slice(0, 2000) : null;
    row.decided_at = new Date();
    await this.repo.save(row);

    const capText = cap == null ? 'no budget cap' : `a budget of ${team.currency || 'USD'} ${cap.toLocaleString('en-US')}`;
    const limitText = limit == null ? 'unlimited campaigns' : `${limit} campaign${limit === 1 ? '' : 's'}`;
    await this.notify(
      row.manager.id,
      'MANAGER_APPLICATION_DECIDED',
      `You now manage "${row.campaign?.title}". The brand gave you ${limitText} to create and ${capText}.`,
      row.id,
    );
    return this.one(id);
  }

  /** Every brand this manager works for, with what they have used of their grant. */
  async engagements(managerId: string): Promise<any[]> {
    const rows = await this.teams.find({
      where: { member: { id: managerId }, member_type: 'manager', is_active: true },
      relations: ['brand', 'brand.brandProfile'],
    });
    if (rows.length === 0) return [];
    const brandIds = rows.map((r) => r.brand?.id).filter(Boolean) as string[];
    const created = brandIds.length
      ? await this.campaigns.find({ where: { created_by: { id: managerId }, brand: { id: In(brandIds) } }, relations: ['brand'] })
      : [];
    const assignedIds = rows.flatMap((r) => r.grant?.campaigns || []);
    const assigned = assignedIds.length ? await this.campaigns.find({ where: { id: In(assignedIds) }, relations: ['brand'] }) : [];
    return rows.map((r) => {
      const mine = created.filter((c) => c.brand?.id === r.brand.id);
      const budgetUsed = mine.reduce((sum, c) => sum + (Number(c.budget_usd) || Number(c.budget) || 0), 0);
      const managed = [...mine, ...assigned.filter((c) => c.brand?.id === r.brand.id && !mine.some((m) => m.id === c.id))];
      return {
        id: r.id,
        brand: toPublicUser(r.brand),
        permissions: r.permissions || {},
        grant: r.grant || { campaign_limit: null, budget_cap: null, campaigns: [] },
        payment_amount: r.payment_amount,
        currency: r.currency,
        payment_frequency: r.payment_frequency,
        joined_at: r.joined_at,
        usage: {
          campaigns_created: mine.length,
          budget_used: Math.round(budgetUsed * 100) / 100,
          campaigns_managed: managed.length,
        },
        campaigns: managed.map(publicCampaign),
      };
    });
  }
}
