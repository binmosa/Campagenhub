import { Injectable, BadRequestException, ForbiddenException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './contract.entity';
import { Application } from '../applications/application.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Invitation } from '../invitations/invitation.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { toPublicUser } from '../users/public-user';

/**
 * A contract row carries the whole application graph — creator and brand as
 * raw User entities, i.e. password hashes and KYC blobs. These two helpers
 * are what any contract or invitation leaving this service goes through.
 */
const publicContract = (c: any) =>
  !c
    ? c
    : {
        ...c,
        application: c.application
          ? {
              ...c.application,
              creator: toPublicUser(c.application.creator),
              campaign: c.application.campaign
                ? { ...c.application.campaign, brand: toPublicUser(c.application.campaign.brand) }
                : c.application.campaign,
            }
          : c.application,
      };

const publicInvitation = (inv: any) =>
  !inv ? inv : { ...inv, sender: toPublicUser(inv.sender), receiver: toPublicUser(inv.receiver), brand: toPublicUser(inv.brand) };
import { Task } from '../tasks/task.entity';
import { LessThan } from 'typeorm';
import { amendmentText, buildAddendum, buildAgreement } from './agreement';
import { assignedCampaignIds, engagementFor, isManager, requireManagerPermission } from '../managers/manager-access';

/** Human name for the other party of a contract: company, creator or manager name, else the email prefix. */
const displayName = (u: any): string =>
  u?.brandProfile?.company_name ||
  u?.creatorProfile?.full_name ||
  u?.managerProfile?.full_name ||
  (u?.email ? String(u.email).split('@')[0] : '') ||
  'User';
const avatarOf = (u: any): string | null =>
  u?.brandProfile?.logo_url || u?.creatorProfile?.avatar_url || u?.managerProfile?.avatar_url || null;

@Injectable()
export class ContractsService implements OnModuleInit {
  constructor(
    @InjectRepository(Contract)
    private contractsRepo: Repository<Contract>,
    @InjectRepository(Application)
    private applicationsRepo: Repository<Application>,
    @InjectRepository(Invitation)
    private invRepo: Repository<Invitation>,
    @InjectRepository(BrandTeam)
    private teamRepo: Repository<BrandTeam>,
    @InjectRepository(Task)
    private tasksRepo: Repository<Task>,
    private notificationsService: NotificationsService,
  ) {}

  /** Recurring contracts end themselves the day after `ends_at`. Checked hourly. */
  onModuleInit() {
    setTimeout(() => this.sweepExpired().catch(() => {}), 20_000).unref?.();
    setInterval(() => this.sweepExpired().catch(() => {}), 60 * 60 * 1000).unref?.();
  }

  async sweepExpired(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const due = await this.contractsRepo.find({
      where: { status: 'active', ends_at: LessThan(today) },
      relations: ContractsService.APP_RELATIONS.map((r) => `application.${r}`).concat(['application']),
    });
    for (const contract of due) {
      const application = contract.application;
      contract.status = 'ended';
      this.pushHistory(contract, { at: new Date().toISOString(), by: 'system', action: 'ended', note: `Scheduled end ${contract.ends_at}` });
      await this.contractsRepo.save(contract);
      if (!application) continue;
      const brandId = application.campaign?.brand?.id;
      const creatorId = application.creator?.id;
      // Only the main agreement ending takes someone off the brand's team.
      // An extra-work addendum expiring used to do it too, quietly removing
      // a creator whose main contract was still running.
      if (contract.kind === 'main' && brandId && creatorId) {
        const row = await this.teamRepo.findOne({ where: { brand: { id: brandId }, member: { id: creatorId }, is_active: true } });
        if (row) {
          row.is_active = false;
          await this.teamRepo.save(row);
        }
      }
      const title = application.campaign?.title || 'campaign';
      const msg =
        contract.kind === 'main'
          ? `The contract for "${title}" reached its end date (${contract.ends_at}) and has ended. Payments already released are untouched.`
          : `The extra work on "${title}" reached its end date (${contract.ends_at}) and has ended. The main agreement is unaffected.`;
      if (creatorId) await this.notify(creatorId, 'CONTRACT_ENDED', msg, contract.id);
      if (brandId) await this.notify(brandId, 'CONTRACT_ENDED', msg, contract.id);
    }
    return due.length;
  }

  async getMyContracts(userId: string): Promise<any[]> {
    // Return contracts where user is either brand or creator side
    const all = await this.contractsRepo.find({
      relations: ['application', 'application.creator', 'application.creator.creatorProfile', 'application.campaign', 'application.campaign.brand', 'application.campaign.brand.brandProfile'],
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
      relations: ['brand', 'brand.brandProfile', 'member', 'member.creatorProfile', 'member.managerProfile']
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
      const opponent = isMeMember ? t.brand : t.member;
      const opponentEmail = opponent?.email;

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
        title: `Contract with ${displayName(opponent)}`,
        opponent_id: opponent?.id,
        opponent_email: opponentEmail,
        opponent_name: displayName(opponent),
        opponent_avatar: avatarOf(opponent),
      });
    }

    const unifiedContracts = [
      ...appContracts.map(c => {
        const isCreator = c.application?.creator?.id === userId;
        const opponent = isCreator ? c.application?.campaign?.brand : c.application?.creator;
        const opponentEmail = opponent?.email;
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
          title: c.kind === 'addendum' ? `Extra work: ${c.title || 'proposal'}` : `Contract with ${displayName(opponent)}`,
          opponent_id: opponent?.id,
          opponent_email: opponentEmail,
          opponent_name: displayName(opponent),
          opponent_avatar: avatarOf(opponent),
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

    const contract = await this.mainContract(applicationId);
    if (!contract) return null;
    const full = await this.loadApplication(applicationId);
    return {
      ...contract,
      parties: this.partiesOf(full),
      campaign: { id: full.campaign.id, title: full.campaign.title },
      application_status: full.status,
    } as any;
  }

  /* ── Offer → accept / decline / counter → lock-in ───────────────── */

  private static readonly FREQUENCIES = ['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
  private static readonly APP_RELATIONS = ['creator', 'creator.creatorProfile', 'campaign', 'campaign.brand', 'campaign.brand.brandProfile', 'campaign.created_by'];

  /** The signed (or pending) collaboration agreement — never an addendum. */
  private mainContract(applicationId: string): Promise<Contract | null> {
    return this.contractsRepo.findOne({ where: { application: { id: applicationId }, kind: 'main' } });
  }

  private async loadApplication(applicationId: string): Promise<Application> {
    const application = await this.applicationsRepo.findOne({ where: { id: applicationId }, relations: ContractsService.APP_RELATIONS });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /** Who signs: names, account emails and avatars for both sides. */
  partiesOf(application: Application) {
    const brandUser: any = application.campaign?.brand || {};
    const bp: any = brandUser.brandProfile || {};
    const creatorUser: any = application.creator || {};
    const cp: any = creatorUser.creatorProfile || {};
    return {
      brand: {
        id: brandUser.id,
        name: bp.company_name || (brandUser.email ? String(brandUser.email).split('@')[0] : 'Brand'),
        contact: bp.contact_person || null,
        email: brandUser.email,
        country: bp.country || null,
        avatar: bp.logo_url || null,
      },
      creator: {
        id: creatorUser.id,
        name: cp.full_name || [cp.first_name, cp.last_name].filter(Boolean).join(' ') || (creatorUser.email ? String(creatorUser.email).split('@')[0] : 'Creator'),
        email: creatorUser.email,
        country: cp.country || null,
        avatar: cp.avatar_url || null,
      },
    };
  }

  private validateTerms(d: { payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null }) {
    const amount = Number(d.payment_amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a payment amount greater than zero.');
    const currency = String(d.currency || 'USD').toUpperCase().slice(0, 3);
    const frequency = ContractsService.FREQUENCIES.includes(String(d.payment_frequency)) ? String(d.payment_frequency) : 'one_time';
    const rawDay = Number(d.payment_day);
    const day = ['monthly', 'quarterly', 'yearly'].includes(frequency) ? Math.min(28, Math.max(1, Number.isFinite(rawDay) ? Math.round(rawDay) : 1)) : null;
    let ends_at: string | null = null;
    if (frequency !== 'one_time') {
      const raw = String(d.ends_at || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(raw).getTime())) {
        throw new BadRequestException('Recurring payments need an end date — set when the contract runs until.');
      }
      const today = new Date().toISOString().slice(0, 10);
      if (raw < today) throw new BadRequestException('The end date must be today or later.');
      ends_at = raw;
    }
    return { amount, currency, frequency, day, ends_at };
  }

  private agreementFor(application: Application, t: { amount: number; currency: string; frequency: string; day: number | null; ends_at?: string | null }, notes?: string | null): string {
    const parties = this.partiesOf(application);
    const c: any = application.campaign;
    return buildAgreement({
      brand: { company: parties.brand.name, contact: parties.brand.contact, email: parties.brand.email, country: parties.brand.country },
      creator: { name: parties.creator.name, email: parties.creator.email, country: parties.creator.country },
      campaign: {
        title: c.title,
        description: c.description,
        platform: c.platform,
        content_type: c.content_type,
        deadline: c.deadline,
        script_required: !!c.script_required,
        contract_template: c.contract_template,
      },
      terms: { amount: t.amount, currency: t.currency, frequency: t.frequency, day: t.day, ends_at: t.ends_at || null },
      notes,
    });
  }

  private assertBrand(application: Application, brandId: string) {
    if (application.campaign?.brand?.id !== brandId) throw new BadRequestException('Only the brand that posted the brief can do this.');
  }

  /**
   * Which brand this request acts for on a given application. A brand acts
   * for itself; an account manager acts only for a brand that engaged them,
   * and only on a campaign inside that engagement.
   */
  async actingBrandFor(user: any, applicationId: string): Promise<string> {
    if (!isManager(user)) return user.brandId || user.userId;
    const application = await this.loadApplication(applicationId);
    const brandId = application.campaign?.brand?.id;
    if (!brandId) throw new NotFoundException('Campaign not found');
    const engagement = engagementFor(user, brandId);
    requireManagerPermission(engagement, 'can_manage_applications', 'review applicants and send contracts');
    const managed = assignedCampaignIds(engagement).includes(application.campaign.id) || (application.campaign as any).created_by?.id === user.userId;
    if (!managed) throw new ForbiddenException('This campaign is not part of your engagement.');
    return brandId;
  }

  /**
   * Nobody may commit more than the campaign's own budget. Everything signed
   * or waiting for signature on the brief counts, extra work included.
   */
  private async assertWithinCampaignBudget(application: Application, amount: number, excludeContractId?: string) {
    const campaign: any = application.campaign;
    const budget = Number(campaign?.budget) || 0;
    if (!budget) return;
    const rows = await this.contractsRepo
      .createQueryBuilder('c')
      .innerJoin('c.application', 'a')
      .innerJoin('a.campaign', 'camp')
      .where('camp.id = :cid', { cid: campaign.id })
      .andWhere('c.status IN (:...open)', { open: ['pending_signature', 'countered', 'active', 'approved'] })
      .getMany();
    const committed = rows.filter((r) => r.id !== excludeContractId).reduce((sum, r) => sum + (Number(r.payment_amount) || 0), 0);
    const total = Math.round((committed + amount) * 100) / 100;
    if (total > budget + 0.005) {
      const cur = campaign.currency || 'USD';
      throw new BadRequestException(
        `This campaign's budget is ${cur} ${budget.toLocaleString('en-US')} and ${cur} ${committed.toLocaleString('en-US')} is already committed. Raise the campaign budget or lower this amount.`,
      );
    }
  }

  private pushHistory(contract: Contract, entry: NonNullable<Contract['history']>[number]) {
    contract.history = [...(contract.history || []), entry];
  }

  private notify(userId: string, type: string, message: string, referenceId?: string) {
    return this.notificationsService.createNotification(userId, type, message, referenceId).catch(() => {});
  }

  /** The agreement text the brand will see (and may edit) before sending. */
  async draftTerms(
    brandId: string,
    applicationId: string,
    d: { payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null; notes?: string | null },
  ): Promise<{ terms: string }> {
    const application = await this.loadApplication(applicationId);
    this.assertBrand(application, brandId);
    const t = this.validateTerms(d);
    return { terms: this.agreementFor(application, t, d.notes) };
  }

  /**
   * Brand sends (or re-sends) the contract. Nothing is final yet: the
   * application moves to `offered`, the contract waits for the creator, and
   * the creator joins the team only when both sides have accepted.
   */
  async offer(
    brandId: string,
    applicationId: string,
    d: { payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null; notes?: string | null; terms?: string | null },
  ): Promise<{ application: any; contract: Contract }> {
    const application = await this.loadApplication(applicationId);
    this.assertBrand(application, brandId);
    if (String(application.status).toLowerCase() === 'rejected') throw new BadRequestException('Reconsider the application before sending a contract.');
    const existing = await this.mainContract(applicationId);
    if (existing && ['active', 'approved'].includes(existing.status)) {
      throw new BadRequestException('This agreement is signed and locked. To ask for more work, propose extra work — the creator accepts or declines it separately.');
    }
    const t = this.validateTerms(d);
    await this.assertWithinCampaignBudget(application, t.amount, existing?.id);

    application.payment_amount = t.amount;
    application.currency = t.currency;
    application.payment_frequency = t.frequency;
    application.payment_day = t.day ?? 1;
    application.notes = d.notes ? String(d.notes).slice(0, 5000) : application.notes;
    const wasAccepted = String(application.status).toLowerCase() === 'accepted';
    if (!wasAccepted) application.status = 'offered';
    await this.applicationsRepo.save(application);

    let contract = existing;
    if (!contract) contract = this.contractsRepo.create({ application: { id: applicationId } as any, kind: 'main' });
    const terms = d.terms && String(d.terms).trim() ? String(d.terms).trim().slice(0, 60000) : this.agreementFor(application, t, d.notes);
    contract.terms = terms;
    contract.payment_amount = t.amount;
    contract.currency = t.currency;
    contract.payment_frequency = t.frequency;
    contract.payment_day = t.day;
    contract.ends_at = t.ends_at;
    contract.notes = d.notes ? String(d.notes).slice(0, 5000) : null;
    contract.status = 'pending_signature';
    contract.offered_at = new Date();
    contract.signed_at = null;
    contract.counter = null;
    this.pushHistory(contract, { at: new Date().toISOString(), by: 'brand', action: 'offered', payment_amount: t.amount, currency: t.currency, payment_frequency: t.frequency, payment_day: t.day, note: d.notes || null });
    const saved = await this.contractsRepo.save(contract);

    const parties = this.partiesOf(application);
    await this.notify(
      application.creator.id,
      'APPLICATION_CONTRACT_OFFERED',
      `${parties.brand.name} sent you a contract for "${application.campaign.title}" — ${t.currency} ${t.amount} ${t.frequency === 'one_time' ? 'one-time' : 'per ' + t.frequency.replace('ly', '')}. Read it and accept, decline or counter.`,
      application.id,
    );

    const { campaign, creator, ...rest } = application as any;
    return {
      application: { ...rest, campaign: { id: campaign.id, title: campaign.title, status: campaign.status }, creator: toPublicUser(creator), contract: saved },
      contract: saved,
    };
  }

  /** Both sides accepted: the contract is active and the creator is on the team. */
  private async lockIn(application: Application, contract: Contract, by: 'brand' | 'creator'): Promise<Contract> {
    contract.status = 'active';
    contract.signed_at = new Date();
    this.pushHistory(contract, { at: new Date().toISOString(), by, action: 'signed' });
    const saved = await this.contractsRepo.save(contract);

    if (contract.kind === 'addendum') {
      // Extra work rides on the signed agreement: no status or team change, only its own deliverables.
      const parties = this.partiesOf(application);
      const title = application.campaign.title;
      const created = await this.seedTasks(application, contract, contract.tasks || [], 'brief');
      const who = by === 'creator' ? parties.creator.name : parties.brand.name;
      const other = by === 'creator' ? application.campaign.brand.id : application.creator.id;
      await this.notify(other, 'APPLICATION_CONTRACT_SIGNED', `${who} accepted the extra work "${contract.title || 'proposal'}" for "${title}". It is now active${created ? ` — ${created} task${created === 1 ? '' : 's'} added to the workspace` : ''}.`, application.id);
      if (created) await this.notify(application.creator.id, 'TASK_ASSIGNED', `${created} task${created === 1 ? '' : 's'} for the extra work "${contract.title || 'proposal'}" ${created === 1 ? 'is' : 'are'} waiting in your workspace.`, contract.id);
      return saved;
    }

    application.status = 'accepted';
    await this.applicationsRepo.save(application);

    const brandId = application.campaign.brand.id;
    const existing = await this.teamRepo.findOne({ where: { brand: { id: brandId }, member: { id: application.creator.id }, is_active: true } });
    const terms = { payment_amount: contract.payment_amount, payment_frequency: (contract.payment_frequency || 'one_time') as any, payment_day: contract.payment_day ?? 1, currency: contract.currency || 'USD' };
    if (existing) {
      Object.assign(existing, terms, { contract_id: contract.id });
      await this.teamRepo.save(existing);
    } else {
      await this.teamRepo.save(this.teamRepo.create({ brand: { id: brandId } as any, member: { id: application.creator.id } as any, member_type: 'creator', is_active: true, contract_id: contract.id, ...terms }));
    }

    const parties = this.partiesOf(application);
    const title = application.campaign.title;
    if (by === 'creator') {
      await this.notify(brandId, 'APPLICATION_CONTRACT_SIGNED', `${parties.creator.name} accepted your contract for "${title}". The agreement is now active and they are on your team.`, application.id);
    } else {
      await this.notify(application.creator.id, 'APPLICATION_CONTRACT_SIGNED', `${parties.brand.name} accepted your proposed terms for "${title}". The agreement is now active.`, application.id);
    }

    // The brief's deliverables become the creator's tasks right away.
    const created = await this.seedTasksFromBrief(application, contract);
    if (created > 0) {
      await this.notify(application.creator.id, 'TASK_ASSIGNED', `${created} task${created === 1 ? '' : 's'} for "${title}" ${created === 1 ? 'is' : 'are'} waiting in your workspace.`, contract.id);
    } else {
      await this.notify(application.creator.id, 'TASK_ASSIGNED', `Next step for "${title}": ${parties.brand.name} will assign your deliverables in the workspace — you will be notified for each one.`, contract.id);
      await this.notify(brandId, 'TASK_ASSIGNED', `Next step: assign ${parties.creator.name}'s deliverables for "${title}" in your workspace.`, contract.id);
    }
    return saved;
  }

  /** Copies the campaign's defined tasks onto this contract (once). Returns how many were created. */
  private async seedTasksFromBrief(application: Application, contract: Contract): Promise<number> {
    const raw = (application.campaign as any)?.tasks;
    let list: any[] = [];
    try {
      list = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    } catch {
      list = [];
    }
    return this.seedTasks(application, contract, list, 'brief');
  }

  /** Creates task rows for a contract from a template list (once per contract). */
  private async seedTasks(application: Application, contract: Contract, list: any[], source: string): Promise<number> {
    if (!Array.isArray(list) || list.length === 0) return 0;
    const existing = await this.tasksRepo.count({ where: { contract_id: contract.id, source } });
    if (existing > 0) return 0;
    const brandId = application.campaign.brand.id;
    let n = 0;
    for (const tpl of list.slice(0, 30)) {
      if (!tpl || !tpl.title) continue;
      const dueDays = Number(tpl.due_days);
      let due: Date | undefined;
      if (Number.isFinite(dueDays) && dueDays > 0) due = new Date(Date.now() + dueDays * 86_400_000);
      else if ((application.campaign as any).deadline) due = new Date((application.campaign as any).deadline);
      const task = this.tasksRepo.create({
        contract_id: contract.id,
        campaign: { id: application.campaign.id } as any,
        application_id: application.id,
        title: String(tpl.title).slice(0, 200),
        description: tpl.description ? String(tpl.description).slice(0, 4000) : undefined,
        platform: tpl.platform ? String(tpl.platform).slice(0, 40) : null,
        source,
        template_key: tpl.key ? String(tpl.key).slice(0, 40) : null,
        assignedBy: { id: brandId } as any,
        assignedTo: { id: application.creator.id } as any,
        due_date: due,
        status: 'pending',
      });
      await this.tasksRepo.save(task as any);
      n++;
    }
    return n;
  }

  /** Creator answers the brand's contract: accept, decline, or propose other terms. */
  async creatorRespond(
    creatorId: string,
    applicationId: string,
    action: 'accept' | 'decline' | 'counter',
    counter?: { payment_amount: number; currency?: string; payment_frequency?: string; payment_day?: number | null; ends_at?: string | null; note?: string | null },
  ): Promise<Contract> {
    const contract = await this.mainContract(applicationId);
    if (!contract) throw new NotFoundException('No contract has been sent for this application yet.');
    return this.creatorRespondOn(creatorId, contract.id, action, counter);
  }

  /** Same, addressed by contract id — works for the main agreement and for extra-work addenda. */
  async creatorRespondOn(
    creatorId: string,
    contractId: string,
    action: 'accept' | 'decline' | 'counter',
    counter?: { payment_amount: number; currency?: string; payment_frequency?: string; payment_day?: number | null; ends_at?: string | null; note?: string | null },
  ): Promise<Contract> {
    const contract = await this.contractsRepo.findOne({ where: { id: contractId }, relations: ['application'] });
    if (!contract?.application) throw new NotFoundException('Contract not found.');
    const application = await this.loadApplication(contract.application.id);
    if (application.creator?.id !== creatorId) throw new BadRequestException('Only the creator who applied can respond to this contract.');
    if (!['pending_signature', 'countered'].includes(contract.status)) throw new BadRequestException('This contract is not waiting for your answer.');
    const parties = this.partiesOf(application);
    const title = application.campaign.title;
    const brandId = application.campaign.brand.id;

    if (action === 'accept') {
      if (contract.status !== 'pending_signature') throw new BadRequestException('Your counter-offer is still with the brand. Withdraw it by declining, or wait for their answer.');
      return this.lockIn(application, contract, 'creator');
    }
    if (action === 'decline') {
      contract.status = 'rejected';
      contract.counter = null;
      this.pushHistory(contract, { at: new Date().toISOString(), by: 'creator', action: 'declined', note: counter?.note || null });
      const saved = await this.contractsRepo.save(contract);
      if (contract.kind === 'main' && String(application.status).toLowerCase() === 'offered') {
        application.status = 'shortlisted';
        await this.applicationsRepo.save(application);
      }
      await this.notify(brandId, 'APPLICATION_CONTRACT_DECLINED', `${parties.creator.name} declined the contract for "${title}".${counter?.note ? ` Note: ${counter.note}` : ''} You can send new terms from the applicant inbox.`, application.id);
      return saved;
    }
    // counter-offer
    if (!counter) throw new BadRequestException('Add the terms you are proposing.');
    const t = this.validateTerms({
      payment_amount: counter.payment_amount,
      currency: counter.currency || contract.currency || application.currency || 'USD',
      payment_frequency: counter.payment_frequency || contract.payment_frequency || application.payment_frequency || 'one_time',
      payment_day: counter.payment_day ?? contract.payment_day,
      ends_at: counter.ends_at || contract.ends_at,
    });
    contract.status = 'countered';
    contract.counter = { payment_amount: t.amount, currency: t.currency, payment_frequency: t.frequency, payment_day: t.day, ends_at: t.ends_at, note: counter.note ? String(counter.note).slice(0, 2000) : null, by: 'creator', at: new Date().toISOString() };
    this.pushHistory(contract, { at: new Date().toISOString(), by: 'creator', action: 'countered', payment_amount: t.amount, currency: t.currency, payment_frequency: t.frequency, payment_day: t.day, note: counter.note || null });
    const saved = await this.contractsRepo.save(contract);
    await this.notify(brandId, 'APPLICATION_CONTRACT_COUNTERED', `${parties.creator.name} proposed different terms for "${title}": ${t.currency} ${t.amount} ${t.frequency === 'one_time' ? 'one-time' : 'per ' + t.frequency.replace('ly', '')}. Review the counter-offer in your applicant inbox.`, application.id);
    return saved;
  }

  /** Brand answers a creator's counter-offer. Accepting it locks the agreement in with the new money. */
  async brandRespond(brandId: string, applicationId: string, action: 'accept_counter' | 'decline_counter'): Promise<Contract> {
    const contract = await this.mainContract(applicationId);
    if (!contract) throw new NotFoundException('No contract has been sent for this application yet.');
    return this.brandRespondOn(brandId, contract.id, action);
  }

  async brandRespondOn(brandId: string, contractId: string, action: 'accept_counter' | 'decline_counter'): Promise<Contract> {
    const contract = await this.contractsRepo.findOne({ where: { id: contractId }, relations: ['application'] });
    if (!contract?.application) throw new NotFoundException('Contract not found.');
    const application = await this.loadApplication(contract.application.id);
    this.assertBrand(application, brandId);
    if (contract.status !== 'countered' || !contract.counter) throw new BadRequestException('There is no open counter-offer on this contract.');
    const c = contract.counter;
    const parties = this.partiesOf(application);
    const title = application.campaign.title;

    if (action === 'decline_counter') {
      contract.status = 'pending_signature';
      contract.counter = null;
      this.pushHistory(contract, { at: new Date().toISOString(), by: 'brand', action: 'counter_declined' });
      const saved = await this.contractsRepo.save(contract);
      await this.notify(application.creator.id, 'APPLICATION_CONTRACT_COUNTER_DECLINED', `${parties.brand.name} kept the original terms for "${title}". You can still accept them, decline, or propose again.`, application.id);
      return saved;
    }

    // accept the counter: money moves to the creator's numbers, the text gets an amendment, then lock in
    await this.assertWithinCampaignBudget(application, c.payment_amount, contract.id);
    contract.payment_amount = c.payment_amount;
    contract.currency = c.currency;
    contract.payment_frequency = c.payment_frequency;
    contract.payment_day = c.payment_day ?? null;
    if (c.ends_at !== undefined) contract.ends_at = c.ends_at ?? null;
    contract.terms = `${contract.terms || ''}\n\n${amendmentText({ amount: c.payment_amount, currency: c.currency, frequency: c.payment_frequency, day: c.payment_day, ends_at: contract.ends_at, by: 'creator' })}`;
    contract.counter = null;
    this.pushHistory(contract, { at: new Date().toISOString(), by: 'brand', action: 'counter_accepted', payment_amount: c.payment_amount, currency: c.currency, payment_frequency: c.payment_frequency, payment_day: c.payment_day });
    if (contract.kind === 'main') {
      application.payment_amount = c.payment_amount;
      application.currency = c.currency;
      application.payment_frequency = c.payment_frequency;
      application.payment_day = c.payment_day ?? 1;
    }
    return this.lockIn(application, contract, 'brand');
  }

  /** Everything on this application: the main agreement first, then extra-work proposals (newest first). */
  async listForApplication(userId: string, applicationId: string): Promise<any[]> {
    const application = await this.loadApplication(applicationId);
    if (application.creator?.id !== userId && application.campaign?.brand?.id !== userId) throw new BadRequestException('Not authorized');
    const list = await this.contractsRepo.find({ where: { application: { id: applicationId } }, order: { created_at: 'DESC' } });
    return list.sort((a, b) => (a.kind === 'main' ? -1 : b.kind === 'main' ? 1 : 0)).map((c) => ({ ...c, application: undefined }));
  }

  /** One contract (main or addendum) with both parties — for the contract modal. */
  async getContractDetail(userId: string, contractId: string): Promise<any> {
    const contract = await this.contractsRepo.findOne({ where: { id: contractId }, relations: ['application'] });
    if (!contract?.application) throw new NotFoundException('Contract not found.');
    const full = await this.loadApplication(contract.application.id);
    if (full.creator?.id !== userId && full.campaign?.brand?.id !== userId) throw new BadRequestException('Not authorized');
    const { application, ...rest } = contract as any;
    return { ...rest, parties: this.partiesOf(full), campaign: { id: full.campaign.id, title: full.campaign.title }, application_id: full.id, application_status: full.status };
  }

  private cleanTemplates(list: any): NonNullable<Contract['tasks']> {
    return (Array.isArray(list) ? list : [])
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t, i) => {
        const days = Number(t.due_days);
        return {
          key: String(t.key || `x${i + 1}`).slice(0, 40),
          title: String(t.title).trim().slice(0, 200),
          ...(t.description ? { description: String(t.description).slice(0, 4000) } : {}),
          ...(t.platform ? { platform: String(t.platform).slice(0, 40) } : {}),
          ...(Number.isFinite(days) && days > 0 ? { due_days: Math.min(365, Math.round(days)) } : {}),
        };
      })
      .slice(0, 30);
  }

  private addendumText(application: Application, main: Contract, d: { title: string; scope?: string | null; tasks?: any; notes?: string | null }, t: { amount: number; currency: string; frequency: string; day: number | null; ends_at?: string | null }): string {
    const parties = this.partiesOf(application);
    return buildAddendum({
      brand: { company: parties.brand.name, email: parties.brand.email },
      creator: { name: parties.creator.name, email: parties.creator.email },
      campaign: { title: application.campaign.title },
      mainAcceptedOn: main.signed_at,
      title: d.title,
      scope: d.scope,
      tasks: this.cleanTemplates(d.tasks),
      terms: { amount: t.amount, currency: t.currency, frequency: t.frequency, day: t.day, ends_at: t.ends_at || null },
      notes: d.notes,
    });
  }

  /** The addendum text the brand will see before proposing extra work. */
  async draftAddendum(
    brandId: string,
    applicationId: string,
    d: { title: string; scope?: string | null; tasks?: any; payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null; notes?: string | null },
  ): Promise<{ terms: string }> {
    const application = await this.loadApplication(applicationId);
    this.assertBrand(application, brandId);
    const main = await this.mainContract(applicationId);
    if (!main || !['active', 'approved'].includes(main.status)) throw new BadRequestException('Extra work can only be proposed on a signed agreement.');
    if (!d.title || !String(d.title).trim()) throw new BadRequestException('Give the extra work a title.');
    const t = this.validateTerms(d);
    return { terms: this.addendumText(application, main, { ...d, title: String(d.title).trim() }, t) };
  }

  /**
   * Brand proposes extra work on a signed agreement. The main contract is
   * untouched; the creator accepts, declines or counters this addendum on its own.
   */
  async proposeAddendum(
    brandId: string,
    applicationId: string,
    d: { title: string; scope?: string | null; tasks?: any; payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null; notes?: string | null; terms?: string | null },
  ): Promise<Contract> {
    const application = await this.loadApplication(applicationId);
    this.assertBrand(application, brandId);
    const main = await this.mainContract(applicationId);
    if (!main || !['active', 'approved'].includes(main.status)) throw new BadRequestException('Extra work can only be proposed on a signed agreement.');
    const title = String(d.title || '').trim();
    if (!title) throw new BadRequestException('Give the extra work a title.');
    const t = this.validateTerms(d);
    await this.assertWithinCampaignBudget(application, t.amount);
    const tasks = this.cleanTemplates(d.tasks);
    const contract = this.contractsRepo.create({
      application: { id: applicationId } as any,
      kind: 'addendum',
      parent_id: main.id,
      title: title.slice(0, 200),
      scope: d.scope ? String(d.scope).slice(0, 5000) : null,
      tasks: tasks.length ? tasks : null,
      terms: d.terms && String(d.terms).trim() ? String(d.terms).trim().slice(0, 60000) : this.addendumText(application, main, { title, scope: d.scope, tasks, notes: d.notes }, t),
      payment_amount: t.amount,
      currency: t.currency,
      payment_frequency: t.frequency,
      payment_day: t.day,
      ends_at: t.ends_at,
      notes: d.notes ? String(d.notes).slice(0, 5000) : null,
      status: 'pending_signature',
      offered_at: new Date(),
      counter: null,
      history: [{ at: new Date().toISOString(), by: 'brand', action: 'offered', payment_amount: t.amount, currency: t.currency, payment_frequency: t.frequency, payment_day: t.day, note: d.notes || null }],
    });
    const saved = await this.contractsRepo.save(contract);
    const parties = this.partiesOf(application);
    await this.notify(
      application.creator.id,
      'APPLICATION_CONTRACT_OFFERED',
      `${parties.brand.name} proposed extra work on "${application.campaign.title}": ${title} — ${t.currency} ${t.amount} ${t.frequency === 'one_time' ? 'one-time' : 'per ' + t.frequency.replace('ly', '')}. Read it and accept, decline or counter; your signed agreement stays as it is.`,
      application.id,
    );
    return saved;
  }

  /**
   * A creator accepted a campaign invitation whose terms the brand already
   * set: create (or reuse) the application, write the agreement, and lock it
   * in as if both had signed — tasks and the team row follow from lockIn.
   */
  async signFromInvitation(d: {
    campaignId: string;
    creatorId: string;
    brandId: string;
    payment_amount: number;
    currency: string;
    payment_frequency: string;
    payment_day?: number | null;
    ends_at?: string | null;
    message?: string | null;
    offeredAt?: Date | null;
  }): Promise<Contract> {
    let application = await this.applicationsRepo.findOne({ where: { campaign: { id: d.campaignId }, creator: { id: d.creatorId } } });
    if (!application) {
      application = await this.applicationsRepo.save(
        this.applicationsRepo.create({ campaign: { id: d.campaignId } as any, creator: { id: d.creatorId } as any, pitch: 'Invited by the brand.', status: 'accepted' }),
      );
    }
    const existing = await this.mainContract(application.id);
    if (existing && ['active', 'approved'].includes(existing.status)) throw new BadRequestException('You already have a signed agreement for this campaign.');
    const full = await this.loadApplication(application.id);
    if (full.campaign?.brand?.id !== d.brandId) throw new BadRequestException('This campaign belongs to another brand.');
    const t = this.validateTerms({ payment_amount: d.payment_amount, currency: d.currency, payment_frequency: d.payment_frequency, payment_day: d.payment_day, ends_at: d.ends_at });
    await this.assertWithinCampaignBudget(full, t.amount, existing?.id);

    full.payment_amount = t.amount;
    full.currency = t.currency;
    full.payment_frequency = t.frequency;
    full.payment_day = t.day ?? 1;
    full.status = 'accepted';
    await this.applicationsRepo.save(full);

    const contract = existing || this.contractsRepo.create({ application: { id: full.id } as any, kind: 'main' });
    contract.terms = this.agreementFor(full, t, d.message);
    contract.payment_amount = t.amount;
    contract.currency = t.currency;
    contract.payment_frequency = t.frequency;
    contract.payment_day = t.day;
    contract.ends_at = t.ends_at;
    contract.notes = d.message ? String(d.message).slice(0, 5000) : null;
    contract.offered_at = d.offeredAt || new Date();
    contract.counter = null;
    contract.history = [{ at: (d.offeredAt || new Date()).toISOString(), by: 'brand', action: 'offered', payment_amount: t.amount, currency: t.currency, payment_frequency: t.frequency, payment_day: t.day, note: 'Campaign invitation' }];
    await this.contractsRepo.save(contract);
    return this.lockIn(full, contract, 'creator');
  }

  /** Legacy text-only update from the contract modal — re-sends for signature with the current money. */
  async upsertContract(brandId: string, applicationId: string, terms: string, paymentAmount: number, contractLength?: string): Promise<Contract> {
    const application = await this.loadApplication(applicationId);
    this.assertBrand(application, brandId);
    const { contract } = await this.offer(brandId, applicationId, {
      payment_amount: paymentAmount,
      currency: application.currency || 'USD',
      payment_frequency: application.payment_frequency || 'one_time',
      payment_day: application.payment_day,
      ends_at: (await this.mainContract(applicationId))?.ends_at || null,
      notes: application.notes,
      terms,
    });
    if (contractLength !== undefined) {
      contract.contract_length = contractLength;
      return this.contractsRepo.save(contract);
    }
    return contract;
  }

  /** Legacy body `{ status: 'approved' | 'rejected' }` from older clients. */
  async respondToContract(creatorId: string, applicationId: string, status: string): Promise<Contract> {
    if (status === 'approved') return this.creatorRespond(creatorId, applicationId, 'accept');
    if (status === 'rejected') return this.creatorRespond(creatorId, applicationId, 'decline');
    throw new BadRequestException('Invalid status');
  }

  async endContract(userId: string, docId: string): Promise<any> {
    // Check if docId is a Contract
    let contract = await this.contractsRepo.findOne({
      where: { id: docId },
      relations: ['application', 'application.creator', 'application.creator.creatorProfile', 'application.campaign', 'application.campaign.brand', 'application.campaign.brand.brandProfile'],
    });

    if (contract) {
       // Validate user is brand or creator
       if (contract.application.creator.id !== userId && contract.application.campaign.brand.id !== userId) {
         throw new BadRequestException('Unauthorized');
       }
       contract.status = 'ended';
       contract.history = [...(contract.history || []), { at: new Date().toISOString(), by: contract.application.creator.id === userId ? 'creator' : 'brand', action: 'ended' }];
       await this.contractsRepo.save(contract);
       if (contract.kind === 'main') {
         const addenda = await this.contractsRepo.find({ where: { parent_id: contract.id } });
         for (const a of addenda) {
           if (!['active', 'pending_signature', 'countered'].includes(a.status)) continue;
           a.status = 'ended';
           a.history = [...(a.history || []), { at: new Date().toISOString(), by: 'system', action: 'ended', note: 'Main agreement ended' }];
           await this.contractsRepo.save(a);
         }
       }
       const teamRow = contract.kind === 'main' ? await this.teamRepo.findOne({ where: { brand: { id: contract.application.campaign.brand.id }, member: { id: contract.application.creator.id }, is_active: true } }) : null;
       if (teamRow) {
         teamRow.is_active = false;
         await this.teamRepo.save(teamRow);
       }

       // Notify the other party
       const notifyId = contract.application.creator.id === userId ? contract.application.campaign.brand.id : contract.application.creator.id;
       await this.notificationsService.createNotification(
         notifyId,
         'CONTRACT_ENDED',
         `The collaboration contract for "${contract.application.campaign.title}" has been ended/terminated.`,
         contract.id
       );
       // Both parties' User rows are loaded here; strip them before returning.
       return publicContract(contract);
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
       return publicInvitation(inv);
    }

    throw new BadRequestException('Contract not found');
  }
}
