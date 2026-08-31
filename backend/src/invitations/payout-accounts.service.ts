import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutAccount } from './payout-account.entity';
import { User } from '../users/user.entity';
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
  ) {}

  async getMine(userId: string): Promise<PayoutAccount | null> {
    return this.repo.findOne({ where: { user: { id: userId } } });
  }

  async save(userId: string, data: Partial<PayoutAccount>): Promise<PayoutAccount> {
    let existing = await this.repo.findOne({ where: { user: { id: userId } } });
    if (existing) {
      Object.assign(existing, data);
      return this.repo.save(existing);
    }
    const account = this.repo.create({ ...data, user: { id: userId } as any, is_verified: false });
    return this.repo.save(account);
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
        await this.save(userId, { account_number, bank_code, account_name: data.account_name, is_verified: true });
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
