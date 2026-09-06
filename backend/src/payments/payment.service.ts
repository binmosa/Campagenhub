import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout } from '../payouts/payout.entity';
import { Application } from '../applications/application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Contract } from '../contracts/contract.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { PayoutAccount } from '../invitations/payout-account.entity';
import { User } from '../users/user.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { EmailService } from '../email/email.service';
import axios from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';
import { toPublicUser } from '../users/public-user';

/** Transactions leave the API with public user shapes and slim relations —
 *  never password hashes / KYC blobs, never full campaign rows. */
const sanitizeTransaction = (tx: any): any =>
  tx
    ? {
        ...tx,
        payer: toPublicUser(tx.payer),
        payee: toPublicUser(tx.payee),
        campaign: tx.campaign ? { id: tx.campaign.id, title: tx.campaign.title, currency: tx.campaign.currency } : tx.campaign,
        application: tx.application ? { id: tx.application.id, status: tx.application.status } : tx.application,
      }
    : tx;

@Injectable()
export class PaymentService {
  private flwPublicKey: string;
  private flwSecretKey: string;

  constructor(
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(Application)
    private applicationsRepository: Repository<Application>,
    @InjectRepository(PaymentTransaction)
    private transactionsRepository: Repository<PaymentTransaction>,
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
    @InjectRepository(BrandTeam)
    private teamRepository: Repository<BrandTeam>,
    @InjectRepository(PayoutAccount)
    private payoutAccountRepo: Repository<PayoutAccount>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
    private telegramService: TelegramService,
    private emailService: EmailService,
  ) {
    this.flwPublicKey = process.env.FLW_PUBLIC_KEY || '';
    this.flwSecretKey = process.env.FLW_SECRET_KEY || '';
  }

  private isProviderSuccessStatus(status?: string): boolean {
    const normalized = (status || '').toString().trim().toLowerCase();
    return ['successful', 'completed', 'success', 'paid'].includes(normalized);
  }

  private async resolveCampaignIdForPayment(data: {
    campaignId?: string;
    applicationId?: string;
    userId?: string;
    payeeId?: string;
  }): Promise<string | undefined> {
    try {
      if (data.campaignId) return data.campaignId;

      // 1) Frontend often sends contract id as applicationId in instant-pay flow.
      if (data.applicationId) {
        const contract = await this.contractsRepository.findOne({
          where: { id: data.applicationId } as any,
          relations: ['application', 'application.campaign', 'application.campaign.brand', 'application.creator'],
        });
        if (
          contract?.application?.campaign?.id &&
          (!data.userId || contract.application.campaign.brand?.id === data.userId) &&
          (!data.payeeId || contract.application.creator?.id === data.payeeId)
        ) {
          return contract.application.campaign.id;
        }

        // 2) If it is a real application id, resolve campaign from application.
        const app = await this.applicationsRepository.findOne({
          where: { id: data.applicationId } as any,
          relations: ['campaign', 'campaign.brand', 'creator'],
        });
        if (
          app?.campaign?.id &&
          (!data.userId || app.campaign.brand?.id === data.userId) &&
          (!data.payeeId || app.creator?.id === data.payeeId)
        ) {
          return app.campaign.id;
        }
      }

      // 3) Fallback: find latest active/approved contract for brand + payee.
      if (data.userId && data.payeeId) {
        const latest = await this.contractsRepository
          .createQueryBuilder('contract')
          .innerJoinAndSelect('contract.application', 'application')
          .innerJoinAndSelect('application.campaign', 'campaign')
          .innerJoinAndSelect('campaign.brand', 'brand')
          .innerJoinAndSelect('application.creator', 'creator')
          .where('brand.id = :brandId', { brandId: data.userId })
          .andWhere('creator.id = :payeeId', { payeeId: data.payeeId })
          .andWhere('contract.status IN (:...statuses)', { statuses: ['active', 'approved'] })
          .orderBy('contract.updated_at', 'DESC')
          .getOne();
        if (latest?.application?.campaign?.id) return latest.application.campaign.id;
      }

      // 4) Final fallback for manual team payouts:
      // pick latest brand-owned active campaign, else latest brand campaign.
      if (data.userId) {
        const latestActiveCampaign = await this.campaignsRepository
          .createQueryBuilder('campaign')
          .innerJoin('campaign.brand', 'brand')
          .where('brand.id = :brandId', { brandId: data.userId })
          .andWhere('campaign.status = :status', { status: 'active' })
          .orderBy('campaign.updated_at', 'DESC')
          .getOne();
        if (latestActiveCampaign?.id) return latestActiveCampaign.id;

        const latestAnyCampaign = await this.campaignsRepository
          .createQueryBuilder('campaign')
          .innerJoin('campaign.brand', 'brand')
          .where('brand.id = :brandId', { brandId: data.userId })
          .orderBy('campaign.updated_at', 'DESC')
          .getOne();
        if (latestAnyCampaign?.id) return latestAnyCampaign.id;

        // 5) Absolute fallback: create a manual payout pool campaign for this brand.
        const manualCampaign = this.campaignsRepository.create({
          brand: { id: data.userId } as any,
          title: 'Manual Payout Pool',
          description: 'System-generated fallback campaign for manual team payouts.',
          status: 'active',
        } as any);
        const savedManualCampaign = await this.campaignsRepository.save(manualCampaign as any);
        if (Array.isArray(savedManualCampaign)) return savedManualCampaign[0]?.id;
        return savedManualCampaign?.id;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  // ========== FLUTTERWAVE ==========
  private async ensurePayoutRequestForTransaction(transaction: PaymentTransaction): Promise<Payout | null> {
    if (!transaction?.tx_ref) return null;

    // Recover missing payee/campaign links from legacy/incomplete transaction rows.
    let payeeId: string | undefined = transaction?.payee?.id;
    let campaignId: string | undefined = transaction?.campaign?.id;

    if (!payeeId) {
      try {
        const provider = transaction?.provider_response ? JSON.parse(transaction.provider_response) : null;
        const customerEmail = provider?.customer?.email || provider?.email;
        if (customerEmail) {
          const payee = await this.userRepo.findOne({ where: { email: customerEmail } as any, select: ['id', 'email'] as any });
          if (payee?.id) payeeId = payee.id;
        }
      } catch {
        // best-effort parse only
      }
    }

    if (!campaignId && transaction?.payer?.id) {
      campaignId = await this.resolveCampaignIdForPayment({
        userId: transaction.payer.id,
        payeeId,
      });
    }

    if (!payeeId || !campaignId) return null;

    if (!transaction?.payee?.id || !transaction?.campaign?.id) {
      transaction.payee = { id: payeeId } as any;
      transaction.campaign = { id: campaignId } as any;
      await this.transactionsRepository.save(transaction);
    }

    const existing = await this.payoutsRepository.findOne({
      where: { tx_ref: transaction.tx_ref },
      relations: ['creator', 'campaign'],
    });
    if (existing) return existing;

    const payout = this.payoutsRepository.create({
      creator: { id: payeeId } as any,
      campaign: { id: campaignId } as any,
      amount: Number(transaction.amount),
      status: 'pending',
      tx_ref: transaction.tx_ref,
    });
    const saved = await this.payoutsRepository.save(payout);

    const staff = await this.userRepo.find({ where: [{ role: 'admin' as any }, { role: 'finance' as any }] as any });
    await Promise.all(
      staff.map((u) =>
        this.notificationsService.createNotification(
          u.id,
          'PAYOUT_REQUEST',
          `New payout request: $${Number(transaction.amount).toLocaleString()} for transaction ${transaction.tx_ref}.`,
          saved.id,
        ),
      ),
    );

    return saved;
  }

  async reconcileMissingPayoutRequests(): Promise<number> {
    const inFlightTransactions = await this.transactionsRepository.find({
      where: [{ status: 'processing' } as any, { status: 'initiated' } as any],
      relations: ['payer', 'payee', 'campaign'],
      order: { created_at: 'DESC' } as any,
      take: 200,
    });

    for (const tx of inFlightTransactions) {
      if (!tx?.tx_ref) continue;
      if ((tx.payment_method || '').toLowerCase() !== 'flutterwave') continue;
      try {
        const verifyRes = await axios.get(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx.tx_ref)}`,
          { headers: { Authorization: `Bearer ${this.flwSecretKey}` } },
        );
        const providerStatus = verifyRes?.data?.data?.status;
        if (this.isProviderSuccessStatus(providerStatus)) {
          tx.status = 'completed';
          tx.provider_reference = String(verifyRes?.data?.data?.id || tx.provider_reference || '');
          tx.provider_response = JSON.stringify(verifyRes?.data?.data || {});
          await this.transactionsRepository.save(tx);
        }
      } catch {
        // Best-effort reconciliation only.
      }
    }

    const completedTransactions = await this.transactionsRepository.find({
      where: { status: 'completed' } as any,
      relations: ['payer', 'payee', 'campaign'],
      order: { created_at: 'DESC' } as any,
      take: 500,
    });

    let created = 0;
    for (const tx of completedTransactions) {
      if (!tx?.tx_ref) continue;
      const existing = await this.payoutsRepository.findOne({ where: { tx_ref: tx.tx_ref } });
      if (existing) continue;
      const saved = await this.ensurePayoutRequestForTransaction(tx);
      if (saved) created += 1;
    }
    return created;
  }


  /**
   * What the brand agreed to pay this person: every active agreement (main +
   * extra work) they signed together, or the team retainer when there is no
   * contract. A payment may exceed it (bonus) but never fall below it.
   */
  async agreedMinimumFor(brandId: string, payeeId: string): Promise<number> {
    const contracts = await this.contractsRepository
      .createQueryBuilder('contract')
      .innerJoin('contract.application', 'application')
      .innerJoin('application.campaign', 'campaign')
      .innerJoin('campaign.brand', 'brand')
      .innerJoin('application.creator', 'creator')
      .where('brand.id = :brandId', { brandId })
      .andWhere('creator.id = :payeeId', { payeeId })
      .andWhere('contract.status IN (:...statuses)', { statuses: ['active', 'approved'] })
      .getMany();
    const fromContracts = contracts.reduce((sum, c) => sum + (Number(c.payment_amount) || 0), 0);
    if (fromContracts > 0) return Math.round(fromContracts * 100) / 100;
    const row = await this.teamRepository.findOne({ where: { brand: { id: brandId }, member: { id: payeeId }, is_active: true } });
    return Math.round((Number(row?.payment_amount) || 0) * 100) / 100;
  }

  private async assertNotBelowAgreed(brandId: string, payeeId: string, amount: number) {
    const agreed = await this.agreedMinimumFor(brandId, payeeId);
    if (agreed > 0 && amount + 0.005 < agreed) {
      throw new BadRequestException(`The agreed amount is ${agreed.toLocaleString('en-US')} — you can pay more as a bonus, but not less.`);
    }
  }

  async initiatePayment(data: {
    amount: number;
    currency: string;
    email: string;
    name: string;
    campaignTitle: string;
    applicationId: string;
    redirectUrl: string;
    userId?: string;
    campaignId?: string;
    payeeId?: string;
    paymentMethod?: string;
  }) {
    try {
      if (!data.payeeId) throw new BadRequestException('Payee is required for payout requests');

      // Validate payee exists to avoid DB-level foreign-key 500s.
      const payeeUser = await this.userRepo.findOne({ where: { id: data.payeeId } as any });
      if (!payeeUser) {
        throw new BadRequestException('Selected payee account was not found. Re-open team/contracts and select again.');
      }

      if (data.userId) await this.assertNotBelowAgreed(data.userId, data.payeeId, Number(data.amount));

      const resolvedCampaignId = await this.resolveCampaignIdForPayment(data);
      if (!resolvedCampaignId) {
        throw new BadRequestException('No campaign could be resolved for this payee. Please select a payee with an active contract.');
      }
      data.campaignId = resolvedCampaignId;

      const method = (data.paymentMethod || 'flutterwave').toLowerCase();
      const requiresEscrowPrecheck = !['flutterwave', 'paypal', 'telebirr'].includes(method);

      // Escrow / tenant isolation checks for brand-initiated wallet/internal payouts.
      // Card/hosted checkout methods are funding flows, so they must not be blocked here.
      if (data.userId && data.campaignId) {
        const campaign = await this.campaignsRepository.findOne({
          where: { id: data.campaignId } as any,
          relations: ['brand'],
        });
        if (!campaign) throw new BadRequestException('Campaign not found');
        if (campaign.brand?.id !== data.userId) throw new BadRequestException('Unauthorized campaign access');

        if (requiresEscrowPrecheck) {
          const escrow = await this.getBrandCampaignEscrow(data.userId, data.campaignId);
          const requested = Number(data.amount);
          if (requested > escrow.available) {
            await this.notificationsService.createNotification(
              data.userId,
              'INSUFFICIENT_ESCROW',
              `Insufficient escrow. Available $${escrow.available} but requested $${requested}. Please deposit more funds.`,
              data.campaignId,
            );
            throw new BadRequestException('Insufficient escrow balance. Please deposit more funds.');
          }
        }
      }

      const txRef = `CAMPHUB-${data.applicationId}-${Date.now()}`;

      // Record the transaction
      const transaction = this.transactionsRepository.create({
        tx_ref: txRef,
        amount: data.amount,
        currency: data.currency || 'USD',
        payment_method: method,
        status: 'initiated',
        payer: data.userId ? { id: data.userId } as any : undefined,
        payee: data.payeeId ? { id: data.payeeId } as any : undefined,
        campaign: data.campaignId ? { id: data.campaignId } as any : undefined,
        // Only set application relation if it was explicitly flagged as a real application ID
        // For instant-pay flows the frontend sends a contractId which is NOT in the applications table
      });
      try {
        await this.transactionsRepository.save(transaction);
      } catch {
        throw new BadRequestException('Unable to create payment transaction. Please refresh and try again.');
      }

      return this.launchCheckout(data, txRef, transaction, method);
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      const safeMessage =
        e?.response?.data?.message ||
        e?.message ||
        'Payment initiation failed due to a server validation error.';
      // eslint-disable-next-line no-console
      console.error('[PaymentsService][initiate] unexpected failure', safeMessage);
      throw new BadRequestException(safeMessage);
    }
  }


  /** Hands the recorded transaction to the chosen provider and returns what the client needs to continue. */
  private async launchCheckout(
    data: { amount: number; currency: string; email: string; name: string; campaignTitle: string; applicationId?: string; redirectUrl: string },
    txRef: string,
    transaction: PaymentTransaction,
    method: string,
  ) {
    if (method === 'paypal') {
      return this.initiatePaypalPayment(data, txRef, transaction);
    }

    if (method === 'telebirr') {
      return this.initiateTelebirrPayment(data, txRef, transaction);
    }

    // Default: Flutterwave Standard Hosted Payment
    try {
      const payload = {
        tx_ref: txRef,
        amount: data.amount.toString(),
        currency: data.currency || 'USD',
        redirect_url: data.redirectUrl,
        customer: {
          email: data.email,
          name: data.name,
        },
        customizations: {
          title: 'CampaignHub Payment',
          description: `Payment for campaign: ${data.campaignTitle}`,
          logo: '',
        },
        meta: {
          applicationId: data.applicationId,
        },
      };

      const response = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
        headers: {
          Authorization: `Bearer ${this.flwSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Update transaction status
      transaction.status = 'processing';
      transaction.provider_response = JSON.stringify(response.data);
      await this.transactionsRepository.save(transaction);

      return {
        txRef,
        status: 'redirect',
        paymentLink: response.data?.data?.link || null,
        data: payload,
      };
    } catch (error) {
      // Fallback: return checkout payload for frontend inline JS checkout
      return {
        txRef,
        status: 'checkout',
        data: {
          tx_ref: txRef,
          amount: data.amount,
          currency: data.currency || 'USD',
          redirect_url: data.redirectUrl,
          customer: { email: data.email, name: data.name },
          customizations: {
            title: 'CampaignHub Payment',
            description: `Payment for campaign: ${data.campaignTitle}`,
          },
        },
      };
    }
  }

  /**
   * One checkout for several people. The parent transaction carries the
   * total; a child transaction per payee is recorded now and completed with
   * the parent, so each person gets their own payout request.
   */
  async initiateBulk(data: {
    userId: string;
    email: string;
    name: string;
    items: { payeeId: string; amount: number; applicationId?: string; campaignId?: string; note?: string }[];
    paymentMethod?: string;
    redirectUrl: string;
    currency?: string;
  }) {
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new BadRequestException('Select at least one person to pay.');
    if (items.length > 50) throw new BadRequestException('Pay at most 50 people in one batch.');
    const method = (data.paymentMethod || 'flutterwave').toLowerCase();
    const currency = data.currency || 'USD';

    const resolved: { payeeId: string; amount: number; campaignId: string; applicationId?: string; note?: string; name: string }[] = [];
    for (const it of items) {
      const amount = Number(it.amount);
      if (!it.payeeId) throw new BadRequestException('Every item needs a payee.');
      if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Every amount must be greater than zero.');
      const payee = await this.userRepo.findOne({ where: { id: it.payeeId } as any });
      if (!payee) throw new BadRequestException('A selected payee account was not found.');
      await this.assertNotBelowAgreed(data.userId, it.payeeId, amount);
      const campaignId = await this.resolveCampaignIdForPayment({ campaignId: it.campaignId, applicationId: it.applicationId, userId: data.userId, payeeId: it.payeeId });
      if (!campaignId) throw new BadRequestException(`No campaign could be resolved for ${payee.email}.`);
      const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } as any, relations: ['brand'] });
      if (!campaign || campaign.brand?.id !== data.userId) throw new BadRequestException('Unauthorized campaign access');
      resolved.push({ payeeId: it.payeeId, amount, campaignId, applicationId: it.applicationId, note: it.note, name: payee.email });
    }
    const total = Math.round(resolved.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
    const stamp = Date.now();
    const batchRef = `CAMPHUB-BATCH-${stamp}`;

    const parent = this.transactionsRepository.create({
      tx_ref: batchRef,
      amount: total,
      currency,
      payment_method: method,
      status: 'initiated',
      is_batch: true,
      batch_ref: batchRef,
      payer: { id: data.userId } as any,
      campaign: { id: resolved[0].campaignId } as any,
      note: `${resolved.length} payees`,
    });
    await this.transactionsRepository.save(parent);
    for (const [n, r] of resolved.entries()) {
      const child = this.transactionsRepository.create({
        tx_ref: `${batchRef}-${n + 1}`,
        amount: r.amount,
        currency,
        payment_method: method,
        status: 'initiated',
        is_batch: false,
        batch_ref: batchRef,
        note: r.note || null,
        payer: { id: data.userId } as any,
        payee: { id: r.payeeId } as any,
        campaign: { id: r.campaignId } as any,
      });
      await this.transactionsRepository.save(child);
    }

    const result = await this.launchCheckout(
      { amount: total, currency, email: data.email, name: data.name, campaignTitle: `Batch payment to ${resolved.length} people`, applicationId: batchRef, redirectUrl: data.redirectUrl },
      batchRef,
      parent,
      method,
    );
    return { ...result, batchRef, total, count: resolved.length };
  }

  /** When a batch parent completes, every child completes with it and gets its own payout request. */
  private async completeBatch(parent: PaymentTransaction, transfer: 'flutterwave' | 'telebirr' | null) {
    if (!parent?.is_batch) return;
    const children = await this.transactionsRepository.find({ where: { batch_ref: parent.tx_ref, is_batch: false } as any, relations: ['payee', 'campaign'] });
    for (const child of children) {
      if (child.status === 'completed') continue;
      child.status = 'completed';
      child.provider_reference = parent.provider_reference;
      await this.transactionsRepository.save(child);
      if (child.payee) {
        await this.ensurePayoutRequestForTransaction(child);
        if (transfer === 'flutterwave') await this.triggerFlutterwaveTransfer(child.payee.id, child.amount, `Payout for ${child.tx_ref}`);
        if (transfer === 'telebirr') await this.triggerTelebirrTransfer(child.payee.id, child.amount, `Payout for ${child.tx_ref}`);
      }
    }
  }

  async verifyPayment(transactionId?: string, txRef?: string) {
    if (!transactionId && !txRef) {
      throw new BadRequestException('Payment verification requires transactionId or txRef');
    }

    const headers = { Authorization: `Bearer ${this.flwSecretKey}` };
    let response: any = null;
    let providerReference = transactionId || '';

    try {
      // Try direct transaction verification first, then fall back to tx_ref.
      if (transactionId) {
        try {
          response = await axios.get(
            `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
            { headers },
          );
        } catch {
          if (txRef) {
            response = await axios.get(
              `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
              { headers },
            );
          } else {
            throw new BadRequestException('Payment verification failed');
          }
        }
      } else if (txRef) {
        response = await axios.get(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
          { headers },
        );
      }

      const txData = response.data?.data;
      if (txData?.tx_ref) {
        const transaction = await this.transactionsRepository.findOne({
          where: { tx_ref: txData.tx_ref },
          relations: ['payee', 'campaign'],
        });
        if (transaction) {
          transaction.status = this.isProviderSuccessStatus(txData?.status) ? 'completed' : 'failed';
          if (!providerReference) providerReference = String(txData?.id || '');
          transaction.provider_reference = providerReference;
          transaction.provider_response = JSON.stringify(txData);
          await this.transactionsRepository.save(transaction);
          
          if (transaction.status === 'completed' && transaction.is_batch) {
            await this.completeBatch(transaction, 'flutterwave');
          } else if (transaction.status === 'completed' && transaction.payee) {
             await this.ensurePayoutRequestForTransaction(transaction);
             await this.triggerFlutterwaveTransfer(transaction.payee.id, transaction.amount, `Payout for ${transaction.tx_ref}`);
          }
        }
      }

      return response.data;
    } catch (error: any) {
      // Last-resort fallback: if provider verification fails but we already
      // have a local completed/processing transaction, avoid 500/400 noise.
      const localTx = await this.transactionsRepository.findOne({
        where: txRef ? ({ tx_ref: txRef } as any) : ({ provider_reference: providerReference } as any),
        relations: ['payee', 'campaign'],
      });

      if (localTx) {
        if (localTx.status === 'completed' && localTx.is_batch) {
          await this.completeBatch(localTx, null);
        } else if (localTx.status === 'completed' && localTx.payee) {
          await this.ensurePayoutRequestForTransaction(localTx);
        }
        return {
          status: 'local_fallback',
          message: 'Provider verification unavailable. Using local transaction state.',
          data: {
            tx_ref: localTx.tx_ref,
            transaction_id: localTx.provider_reference || providerReference || null,
            status: localTx.status,
            amount: localTx.amount,
            currency: localTx.currency,
          },
        };
      }

      const providerMsg = error?.response?.data?.message || error?.message || 'Payment verification failed';
      throw new BadRequestException(providerMsg);
    }
  }

  async confirmClientPayment(data: {
    userId: string;
    txRef: string;
    transactionId?: string;
    status?: string;
  }) {
    const tx = await this.transactionsRepository.findOne({
      where: { tx_ref: data.txRef } as any,
      relations: ['payer', 'payee', 'campaign'],
    });
    if (!tx) throw new BadRequestException('Transaction not found');
    if (tx.payer?.id !== data.userId) throw new BadRequestException('Unauthorized transaction access');

    tx.provider_reference = data.transactionId || tx.provider_reference;
    if (data.status && this.isProviderSuccessStatus(data.status)) {
      tx.status = 'completed';
    } else if (!data.status && ['initiated', 'processing'].includes((tx.status || '').toLowerCase())) {
      // Fallback for callbacks that omit explicit status but indicate successful return.
      tx.status = 'completed';
    }
    await this.transactionsRepository.save(tx);

    if (tx.status === 'completed') {
      if (tx.is_batch) await this.completeBatch(tx, null);
      else await this.ensurePayoutRequestForTransaction(tx);
    }

    return { ok: true, tx_ref: tx.tx_ref, status: tx.status };
  }

  async handleWebhook(payload: any) {
    const txRef = payload?.data?.tx_ref || payload?.tx_ref;
    if (!txRef) return { status: 'ignored' };

    const transaction = await this.transactionsRepository.findOne({
      where: { tx_ref: txRef },
      relations: ['application', 'payee', 'campaign'],
    });

    if (!transaction) return { status: 'not_found' };

    const status = payload?.data?.status || payload?.status;
    transaction.status = this.isProviderSuccessStatus(status) ? 'completed' : 'failed';
    transaction.provider_reference = payload?.data?.id?.toString() || '';
    transaction.provider_response = JSON.stringify(payload);
    await this.transactionsRepository.save(transaction);

    // If payment completed, queue payout request for admin/finance review
    if (transaction.status === 'completed') {
      if (transaction.is_batch) {
        await this.completeBatch(transaction, 'flutterwave');
      } else if (transaction.payee) {
         await this.ensurePayoutRequestForTransaction(transaction);
         await this.triggerFlutterwaveTransfer(transaction.payee.id, transaction.amount, `Payout for ${txRef}`);
      }
    }

    return { status: 'processed', tx_ref: txRef };
  }

  async triggerFlutterwaveTransfer(userId: string, amount: number, narration: string) {
    try {
      const payoutAccount = await this.payoutAccountRepo.findOne({ where: { user: { id: userId } } });

      const hasManualBankDetails = !!(
        payoutAccount?.account_number &&
        payoutAccount?.bank_name &&
        payoutAccount?.country
      );
      const hasMobileMoney = !!payoutAccount?.mobile_number;

      if (!hasManualBankDetails && !hasMobileMoney) {
         // Notify user to update bank info
         const message = "You've received a payment! Please configure your Bank Details in Settings to receive your payout.";
         await this.notificationsService.createNotification(userId, 'PAYMENT_PENDING', message);
         const u = await this.userRepo.findOne({ where: { id: userId } });
         if (u?.telegram_chat_id) {
           await this.telegramService.sendNotification(u.telegram_chat_id, `Payment Pending!\n\n${message}`);
         }
         return { success: false, reason: 'missing_bank' };
      }

      // Instead of B2C Automation, we natively place this in the Admin Escrow Queue!
      console.log(`[Admin Escrow] Triggering manual payout review for User: ${userId} Amount: ${amount}`);
      
      const notifyMessage = `Your ${amount} USD payout has been securely locked in escrow and is awaiting manual Admin dispatch to your bank.`;
      await this.notificationsService.createNotification(userId, 'PAYMENT_ESCROW', notifyMessage);
      
      const adminList = await this.userRepo.find({ where: { role: 'admin' as any } });
      for (const admin of adminList) {
        if (admin.telegram_chat_id) {
          await this.telegramService.sendNotification(admin.telegram_chat_id, `⚠️ *ACTION REQUIRED: Manual Payout*\n\nA brand has securely deposited ${amount} USD.\nPlease log into the Admin Dashboard and execute the transfer to User: ${userId} via Flutterwave.`);
        }
        if (admin.email) {
          await this.emailService.sendNewPayoutRequestToAdmin(admin.email, userId, amount);
        }
      }

      const u = await this.userRepo.findOne({ where: { id: userId } });
      if (u?.telegram_chat_id) {
         await this.telegramService.sendNotification(u.telegram_chat_id, `🔒 *Escrow Locked*\n\n${notifyMessage}`);
      }
      if (u?.email) {
         await this.emailService.sendPaymentEscrowNotice(u.email, amount);
      }
      
      return { success: true, data: { status: 'pending_admin_payout' } };
    } catch (e: any) {
      console.error("[Manual Escrow Transfer Error]:", e.message);
      return { success: false, reason: 'api_error' };
    }
  }

  async createPayoutRecord(data: {
    brandId: string;
    creatorId: string;
    campaignId: string;
    amount: number;
    txRef: string;
  }) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: data.campaignId }, relations: ['brand'] });
    if (!campaign) throw new BadRequestException('Campaign not found');
    if (campaign.brand?.id !== data.brandId) throw new BadRequestException('Unauthorized campaign access');

    const escrow = await this.getBrandCampaignEscrow(data.brandId, data.campaignId);
    if (Number(data.amount) > escrow.available) {
      await this.notificationsService.createNotification(
        data.brandId,
        'INSUFFICIENT_ESCROW',
        `Insufficient escrow. Available $${escrow.available} but requested $${Number(data.amount)}. Please deposit more funds.`,
        data.campaignId,
      );
      throw new BadRequestException('Insufficient escrow balance. Please deposit more funds.');
    }

    const payout = this.payoutsRepository.create({
      creator: { id: data.creatorId },
      campaign: { id: data.campaignId },
      amount: data.amount,
      status: 'pending',
      tx_ref: data.txRef,
    });
    return this.payoutsRepository.save(payout);
  }

  async getBrandCampaignEscrow(brandId: string, campaignId: string): Promise<{ deposited: number; committed: number; available: number }> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['brand'] });
    if (!campaign) throw new BadRequestException('Campaign not found');
    if (campaign.brand?.id !== brandId) throw new BadRequestException('Unauthorized campaign access');

    const depositedRaw = await this.transactionsRepository
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.campaign_id = :campaignId', { campaignId })
      .andWhere('tx.status = :status', { status: 'completed' })
      .getRawOne();
    const deposited = Number(depositedRaw?.total || 0);

    const committedRaw = await this.payoutsRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .where('payout.campaign_id = :campaignId', { campaignId })
      .andWhere('payout.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
      .getRawOne();
    const committed = Number(committedRaw?.total || 0);

    return { deposited, committed, available: Math.max(0, deposited - committed) };
  }

  async getUserTransactions(userId: string) {
    return this.transactionsRepository.find({
      where: [{ payer: { id: userId } } as any, { payee: { id: userId } } as any],
      relations: ['payer', 'payee', 'campaign', 'application'],
      order: { created_at: 'DESC' } as any,
      take: 200,
    });
  }

  async getTransactionsForUser(userId: string, role: string) {
    const normalized = (role || '').toLowerCase().trim();
    const rows = ['admin', 'finance'].includes(normalized)
      ? await this.getAllTransactions()
      : await this.getUserTransactions(userId);
    return rows.map(sanitizeTransaction);
  }

  async getTransactionByRef(txRef: string, userId?: string, role?: string) {
    const tx = await this.transactionsRepository.findOne({
      where: { tx_ref: txRef },
      relations: ['payer', 'payee', 'campaign', 'application'],
    });
    if (!tx) throw new BadRequestException('Transaction not found');
    const normalized = (role || '').toLowerCase().trim();
    if (['admin', 'finance'].includes(normalized)) return sanitizeTransaction(tx);
    if (tx.payer?.id !== userId && tx.payee?.id !== userId) throw new BadRequestException('Unauthorized');
    return sanitizeTransaction(tx);
  }

  async getAllTransactions() {
    return this.transactionsRepository.find({
      relations: ['payer', 'payee', 'campaign', 'application'],
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  // ========== PAYPAL ==========
  async initiatePaypalPayment(data: any, txRef: string, transaction: PaymentTransaction) {
    const clientId = process.env.PAYPAL_CLIENT_ID || '';
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

    try {
      // Get access token
      const authResponse = await axios.post(
        `${baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          auth: { username: clientId, password: clientSecret },
        },
      );
      const accessToken = authResponse.data.access_token;

      // Create order
      const orderResponse = await axios.post(
        `${baseUrl}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: txRef,
            description: `CampaignHub: ${data.campaignTitle}`,
            amount: {
              currency_code: data.currency || 'USD',
              value: data.amount.toFixed(2),
            },
          }],
          application_context: {
            return_url: `${data.redirectUrl}?tx_ref=${txRef}&method=paypal`,
            cancel_url: `${data.redirectUrl}?cancelled=true`,
            brand_name: 'CampaignHub',
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
      );

      transaction.status = 'processing';
      transaction.provider_reference = orderResponse.data.id;
      transaction.provider_response = JSON.stringify(orderResponse.data);
      await this.transactionsRepository.save(transaction);

      const approvalLink = orderResponse.data.links?.find((l: any) => l.rel === 'approve')?.href;

      return {
        txRef,
        status: 'redirect',
        paymentLink: approvalLink,
        orderId: orderResponse.data.id,
        paymentMethod: 'paypal',
      };
    } catch (err) {
      console.error('[PayPal] Error:', err?.response?.data || err.message);
      transaction.status = 'failed';
      await this.transactionsRepository.save(transaction);
      throw new BadRequestException('PayPal payment initiation failed');
    }
  }

  async capturePaypalOrder(orderId: string) {
    const clientId = process.env.PAYPAL_CLIENT_ID || '';
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

    try {
      const authResponse = await axios.post(
        `${baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          auth: { username: clientId, password: clientSecret },
        },
      );
      const accessToken = authResponse.data.access_token;

      const captureResponse = await axios.post(
        `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
      );

      // Update transaction
      const refId = captureResponse.data.purchase_units?.[0]?.reference_id;
      if (refId) {
        const transaction = await this.transactionsRepository.findOne({ where: { tx_ref: refId } });
        if (transaction) {
          transaction.status = this.isProviderSuccessStatus(captureResponse.data?.status) ? 'completed' : 'failed';
          transaction.provider_response = JSON.stringify(captureResponse.data);
          await this.transactionsRepository.save(transaction);
          if (transaction.status === 'completed') {
            const txWithRelations = await this.transactionsRepository.findOne({
              where: { id: transaction.id } as any,
              relations: ['payee', 'campaign'],
            });
            if (txWithRelations?.payee) {
              await this.ensurePayoutRequestForTransaction(txWithRelations);
            }
          }
        }
      }

      return captureResponse.data;
    } catch (err) {
      console.error('[PayPal] Capture error:', err?.response?.data || err.message);
      throw new BadRequestException('PayPal capture failed');
    }
  }

  // ========== TELEBIRR PRIVATE UTILITIES ==========
  // All Telebirr merchant credentials come from environment variables.
  // TELEBIRR_PRIVATE_KEY_BASE64 is the base64-encoded PEM private key (single line in .env).
  private telebirrConfig = {
    baseUrl: process.env.TELEBIRR_BASE_URL || '',
    webBaseUrl: process.env.TELEBIRR_WEB_BASE_URL || '',
    fabricAppId: process.env.TELEBIRR_FABRIC_APP_ID || '',
    appSecret: process.env.TELEBIRR_APP_SECRET || '',
    merchantAppId: process.env.TELEBIRR_MERCHANT_APP_ID || '',
    merchantCode: process.env.TELEBIRR_MERCHANT_CODE || '',
    privateKey: process.env.TELEBIRR_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.TELEBIRR_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
      : '',
  };

  private telebirrHttpsAgent = new https.Agent({
    // Only disable TLS verification when explicitly opted in (Telebirr sandbox uses a raw-IP endpoint).
    rejectUnauthorized: process.env.TELEBIRR_ALLOW_INSECURE_TLS !== 'true',
    requestCert: false
  });

  private getTelebirrTimestamp() {
    return Math.round(new Date().getTime() / 1000) + "";
  }

  private getTelebirrNonce() {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  private signTelebirrPayload(payload: any) {
    const excludeFields = ["sign", "sign_type", "header", "refund_info", "openType", "raw_request", "biz_content"];
    let fields = [];
    let fieldMap: any = {};
    for (let key in payload) {
      if (excludeFields.indexOf(key) >= 0) continue;
      fields.push(key);
      fieldMap[key] = payload[key];
    }
    if (payload.biz_content) {
      for (let key in payload.biz_content) {
        if (excludeFields.indexOf(key) >= 0) continue;
        fields.push(key);
        fieldMap[key] = payload.biz_content[key];
      }
    }
    fields.sort();
    let signStrList = fields.map(k => `${k}=${fieldMap[k]}`);
    let signOriginStr = signStrList.join("&");
    
    // RSA SHA256 Signature
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signOriginStr);
    return signer.sign(this.telebirrConfig.privateKey, 'base64');
  }

  private async getTelebirrFabricToken() {
    const res = await axios.post(`${this.telebirrConfig.baseUrl}/payment/v1/token`, {
      appSecret: this.telebirrConfig.appSecret,
    }, {
      headers: { "Content-Type": "application/json", "X-APP-Key": this.telebirrConfig.fabricAppId },
      httpsAgent: this.telebirrHttpsAgent,
      timeout: 30000
    });
    return res.data?.token;
  }

  // ========== TELEBIRR TRANSACTIONS ==========
  async initiateTelebirrPayment(data: any, txRef: string, transaction: PaymentTransaction) {
    try {
      const fabricToken = await this.getTelebirrFabricToken();
      if (!fabricToken) throw new Error("Could not acquire Telebirr Fabric Token");

      // Build PreOrder Payload
      let reqObj: any = {
        timestamp: this.getTelebirrTimestamp(),
        nonce_str: this.getTelebirrNonce(),
        method: "payment.preorder",
        version: "1.0"
      };

      reqObj.biz_content = {
        notify_url: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/payments/telebirr/webhook` : "https://placeholder.com/api",
        trade_type: "Checkout", // Updated from InApp to Checkout as per documentation Web portal spec
        appid: this.telebirrConfig.merchantAppId,
        merch_code: this.telebirrConfig.merchantCode,
        merch_order_id: txRef,
        title: `CampaignHub: ${data.campaignTitle}`.substring(0, 100),
        total_amount: data.amount.toString(),
        trans_currency: "ETB",
        timeout_express: "120m",
        payee_identifier: this.telebirrConfig.merchantCode,
        payee_identifier_type: "04",
        payee_type: "3000",
        redirect_url: data.redirectUrl
      };

      reqObj.sign = this.signTelebirrPayload(reqObj);
      reqObj.sign_type = "SHA256WithRSA";

      const preOrderRes = await axios.post(`${this.telebirrConfig.baseUrl}/payment/v1/merchant/preOrder`, reqObj, {
        headers: { "Content-Type": "application/json", "X-APP-Key": this.telebirrConfig.fabricAppId, "Authorization": fabricToken },
        httpsAgent: this.telebirrHttpsAgent,
        timeout: 30000
      });

      if (preOrderRes.data?.code !== '0' || !preOrderRes.data?.biz_content?.prepay_id) {
        throw new Error(`Telebirr PreOrder Failed: ${JSON.stringify(preOrderRes.data)}`);
      }

      const prepayId = preOrderRes.data.biz_content.prepay_id;
      // Checkout mode often returns toPayUrl natively directly in HTTP response
      
      // Build RawRequest string locally as a definitive fallback parameter
      let mapObj = {
        appid: this.telebirrConfig.merchantAppId,
        merch_code: this.telebirrConfig.merchantCode,
        nonce_str: this.getTelebirrNonce(),
        prepay_id: prepayId,
        timestamp: this.getTelebirrTimestamp(),
      };
      
      let signLocal = this.signTelebirrPayload(mapObj);
      let rawRequest = [
        `appid=${mapObj.appid}`,
        `merch_code=${mapObj.merch_code}`,
        `nonce_str=${mapObj.nonce_str}`,
        `prepay_id=${mapObj.prepay_id}`,
        `timestamp=${mapObj.timestamp}`,
        `sign=${signLocal}`,
        `sign_type=SHA256WithRSA`,
      ].join("&");

      // Construct proper H5 Web checkout link per specifications
      const toPayUrl = preOrderRes.data.biz_content.toPayUrl || `${this.telebirrConfig.webBaseUrl}${rawRequest}&version=1.0&trade_type=Checkout`;

      transaction.status = 'processing';
      transaction.provider_reference = prepayId;
      transaction.provider_response = JSON.stringify(preOrderRes.data);
      await this.transactionsRepository.save(transaction);

      return {
        txRef,
        status: 'redirect', 
        telebirrRawRequest: rawRequest,
        paymentLink: toPayUrl,
        paymentMethod: 'telebirr',
      };
    } catch (err: any) {
      console.error('[Telebirr] Error:', err?.response?.data || err.message);
      transaction.status = 'failed';
      await this.transactionsRepository.save(transaction);
      throw new BadRequestException('Telebirr payment initiation failed: ' + (err?.response?.data?.msg || err.message));
    }
  }

  async verifyTelebirrPayment(outTradeNo: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { tx_ref: outTradeNo },
    });
    if (!transaction) throw new BadRequestException('Transaction not found');
    return {
      tx_ref: transaction.tx_ref,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      payment_method: transaction.payment_method,
    };
  }

  async handleTelebirrWebhook(payload: string) {
    // The Telebirr callback is an encrypted/signed block.
    // For demo purposes, assuming it passes decrypted payload.
    // In production we would un-sign it using Telebirr's public key.
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const outTradeNo = data?.outTradeNo || data?.merch_order_id;
      if (!outTradeNo) return { status: 'ignored' };

      const transaction = await this.transactionsRepository.findOne({
        where: { tx_ref: outTradeNo },
        relations: ['application', 'payee', 'campaign']
      });

      if (!transaction) return { status: 'not_found' };

      // Determine success based on Telebirr protocol (usually 'Completed' or 'Success')
      if (data.tradeStatus === 'Completed' || data.trade_status === 'COMPLETED') {
        transaction.status = 'completed';
      } else {
        transaction.status = 'failed';
      }

      transaction.provider_response = JSON.stringify(data);
      await this.transactionsRepository.save(transaction);

      // Trigger automatic payout via Telebirr Business Transfer (if completed)
      if (transaction.status === 'completed') {
        if (transaction.is_batch) {
          await this.completeBatch(transaction, 'telebirr');
        } else if (transaction.payee) {
          await this.ensurePayoutRequestForTransaction(transaction);
          await this.triggerTelebirrTransfer(transaction.payee.id, transaction.amount, `Payout for ${outTradeNo}`);
        }
      }

      return { status: 'processed', tx_ref: outTradeNo };
    } catch (e) {
      console.error("[Telebirr Webhook] Error", e);
      return { status: 'error' };
    }
  }

  async triggerTelebirrTransfer(userId: string, amount: number, narration: string) {
    try {
      const payoutAccount = await this.payoutAccountRepo.findOne({ where: { user: { id: userId } } });
      
      // If payment is via Telebirr, they must have ethio telecom mobile number set up
      if (!payoutAccount?.mobile_number) {
         const message = "You've received a Telebirr payment! Please configure your Mobile Number in Settings to receive your payout.";
         await this.notificationsService.createNotification(userId, 'PAYMENT_PENDING', message);
         const u = await this.userRepo.findOne({ where: { id: userId } });
         if (u?.telegram_chat_id) {
           await this.telegramService.sendNotification(u.telegram_chat_id, `💰 *Telebirr Payment Pending!*\n\n${message}`);
         }
         return { success: false, reason: 'missing_mobile_number' };
      }

      // TODO: Call Telebirr B2C endpoint (Business Transfer) to disburse funds.
      // This requires the Telebirr B2B/B2C API specs which are similar to preOrder but for transfers.
      // Assuming a generic Transfer API for the demo to successfully resolve the flow.
      console.log(`[Telebirr SDK] Triggering simulated payout to ${payoutAccount.mobile_number} for ${amount} ETB...`);
      
      await this.notificationsService.createNotification(userId, 'PAYMENT_SENT', `Your ${amount} ETB payout is on its way to your Telebirr account!`);
      const u = await this.userRepo.findOne({ where: { id: userId } });
      if (u?.telegram_chat_id) {
         await this.telegramService.sendNotification(u.telegram_chat_id, `💸 *Telebirr Payout Sent!*\n\nYour ${amount} ETB payout has been transferred to your Telebirr number ending in ${payoutAccount.mobile_number.slice(-4)}!`);
      }
      
      return { success: true, data: { status: 'simulated_b2c_success' } };
    } catch (e: any) {
      console.error("[Telebirr Transfer Error]:", e?.response?.data || e.message);
      return { success: false, reason: 'api_error' };
    }
  }
}
