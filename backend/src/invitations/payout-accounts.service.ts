import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutAccount } from './payout-account.entity';
import { User } from '../users/user.entity';
import { BrandTeam } from './brand-team.entity';
import { Application } from '../applications/application.entity';
import { engagementsOf, isManager } from '../managers/manager-access';

/** Bank details a client may set. `is_verified` is the platform's word, never the account holder's. */
const ACCOUNT_WRITABLE = [
  'account_type', 'bank_name', 'bank_code', 'account_number', 'account_name',
  'mobile_number', 'mobile_network', 'country', 'currency',
] as const;
import axios from 'axios';

@Injectable()
export class PayoutAccountsService {
  private readonly flwKey = process.env.FLW_SECRET_KEY || '';
  private normalizeCountryCode(raw?: string): string {
    const value = (raw || '').trim().toUpperCase();
    const map: Record<string, string> = {
      NIGERIA: 'NG',
      KENYA: 'KE',
      GHANA: 'GH',
      'SOUTH AFRICA': 'ZA',
      UGANDA: 'UG',
      TANZANIA: 'TZ',
      ETHIOPIA: 'ET',
      'UNITED STATES': 'US',
      USA: 'US',
      'UNITED KINGDOM': 'GB',
      UK: 'GB',
      EUROPE: 'EU',
    };
    if (value.length === 2) return value;
    return map[value] || 'NG';
  }

  constructor(
    @InjectRepository(PayoutAccount) private repo: Repository<PayoutAccount>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(BrandTeam) private teamRepo: Repository<BrandTeam>,
    @InjectRepository(Application) private appRepo: Repository<Application>,
  ) {}

  async getMine(userId: string): Promise<PayoutAccount | null> {
    return this.repo.findOne({ where: { user: { id: userId } } });
  }

  /**
   * `trusted` is only ever true for the internal call from
   * `verifyBankAccount`. A client body is filtered to the bank fields and
   * can never set `is_verified`, `id` or `user` — assigning it whole used
   * to let anyone self-verify or write over another user's row.
   */
  async save(userId: string, data: Partial<PayoutAccount>, trusted = false): Promise<PayoutAccount> {
    const clean: any = {};
    for (const k of ACCOUNT_WRITABLE) if ((data as any)?.[k] !== undefined) clean[k] = (data as any)[k];
    if (trusted && (data as any)?.is_verified !== undefined) clean.is_verified = (data as any).is_verified;

    let existing = await this.repo.findOne({ where: { user: { id: userId } } });
    if (existing) {
      Object.assign(existing, clean);
      // Editing the destination invalidates any previous verification.
      if (!trusted) existing.is_verified = false;
      return this.repo.save(existing);
    }
    const account = this.repo.create({ ...clean, user: { id: userId }, is_verified: trusted ? !!clean.is_verified : false } as any) as unknown as PayoutAccount;
    return this.repo.save(account);
  }

  /**
   * Whether a payout destination is set up, for the party about to pay it.
   * The route behind this used to take any user id from any signed-in
   * caller, handing out the bank and the account holder's legal name.
   */
  async statusFor(actor: any, targetUserId: string) {
    await this.assertMaySeeStatus(actor, targetUserId);
    const account = await this.getMine(targetUserId);
    const hasSavedBank = !!(account?.account_number && account?.bank_name && account?.country);
    const hasMobileMoney = !!(account?.account_type === 'mobile_money' && account?.mobile_number);
    return {
      has_bank: hasSavedBank || hasMobileMoney,
      account_type: hasMobileMoney ? 'mobile_money' : hasSavedBank ? 'bank' : null,
      bank_verified: !!(account?.is_verified && hasSavedBank),
      bank_name: account?.bank_name || null,
    };
  }

  private async assertMaySeeStatus(actor: any, targetUserId: string): Promise<void> {
    if (!targetUserId) throw new NotFoundException('User not found');
    if (actor?.userId === targetUserId) return;
    const role = String(actor?.role || '').toLowerCase();
    if (role === 'admin' || role === 'finance') return;

    const brandIds = isManager(actor)
      ? engagementsOf(actor).map((e) => e.brandId)
      : role === 'brand'
        ? [actor?.brandId || actor?.userId]
        : [];
    if (!brandIds.length) throw new ForbiddenException('You can only check the payout details of someone you pay.');

    const onTeam = await this.teamRepo.count({
      where: brandIds.map((b) => ({ brand: { id: b }, member: { id: targetUserId }, is_active: true })) as any,
    });
    if (onTeam) return;

    const hired = await this.appRepo.count({
      where: brandIds.map((b) => ({ campaign: { brand: { id: b } }, creator: { id: targetUserId }, status: 'accepted' })) as any,
    });
    if (hired) return;

    throw new ForbiddenException('You can only check the payout details of someone you pay.');
  }

  // Verify bank account via Flutterwave Resolve API
  async verifyBankAccount(userId: string, account_number: string, bank_code: string, country: string = 'NG'): Promise<any> {
    try {
      const response = await axios.get(`https://api.flutterwave.com/v3/accounts/resolve`, {
        params: { account_number, account_bank: bank_code },
        headers: { Authorization: `Bearer ${this.flwKey}` },
      });
      const data = response.data?.data;
      if (data?.account_name) {
        await this.save(userId, { account_number, bank_code, account_name: data.account_name, is_verified: true }, true);
      }
      return { account_name: data?.account_name, verified: true };
    } catch {
      return { verified: false, message: 'Could not verify account. Check details and try again.' };
    }
  }

  // Get list of banks for a country from Flutterwave
  async getBanksForCountry(country: string): Promise<any[]> {
    try {
      const normalizedCountry = this.normalizeCountryCode(country);
      const res = await axios.get(`https://api.flutterwave.com/v3/banks/${normalizedCountry}`, {
        headers: { Authorization: `Bearer ${this.flwKey}` },
      });
      return res.data?.data || [];
    } catch {
      return [];
    }
  }
}
