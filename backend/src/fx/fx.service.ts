import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { FxRate } from './fx-rate.entity';
import { MARKETS } from '../markets/markets.config';

const RATES_URL = process.env.FX_RATES_URL || 'https://open.er-api.com/v6/latest/USD';
const REFRESH_MS = 24 * 60 * 60 * 1000; // daily

/** Currencies we track: every market currency + the majors we already display. */
const TRACKED = Array.from(
  new Set(['USD', 'EUR', 'GBP', ...MARKETS.map((m) => m.currency)]),
);

/**
 * FxService — USD-canonical exchange rates.
 *
 * Money rule: a campaign's `budget_usd` is computed ONCE at post time with
 * the rate of that day and stored on the campaign (`fx_rate`, `fx_rate_at`).
 * Rates here move daily; posted campaigns never do.
 */
@Injectable()
export class FxService implements OnModuleInit {
  private cache = new Map<string, number>(); // currency → effective per_usd
  private readyResolve: () => void;
  private readyPromise = new Promise<void>((res) => (this.readyResolve = res));

  constructor(
    @InjectRepository(FxRate)
    private fxRepository: Repository<FxRate>,
  ) {}

  async onModuleInit() {
    await this.loadCacheFromDb(); // survive API downtime with last snapshot
    this.refresh().finally(() => this.readyResolve());
    setInterval(() => this.refresh().catch(() => {}), REFRESH_MS).unref?.();
  }

  /** Resolves after the first refresh attempt (success or failure). */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Units of `currency` per 1 USD, or null when unknown. Manual override wins. */
  getPerUsd(currency: string): number | null {
    const c = (currency || 'USD').toUpperCase();
    if (c === 'USD') return 1;
    return this.cache.get(c) ?? null;
  }

  /** Convert an amount in `currency` to USD. Null when the rate is unknown. */
  toUsd(amount: number, currency: string): number | null {
    const rate = this.getPerUsd(currency);
    if (rate == null || !Number.isFinite(amount)) return null;
    return Math.round((amount / rate) * 100) / 100;
  }

  /** Public snapshot for the frontend: { ETB: 140.5, ... } (per USD). */
  async getRates(): Promise<{ base: string; rates: Record<string, number>; fetched_at: Date | null }> {
    const rows = await this.fxRepository.find();
    const rates: Record<string, number> = { USD: 1 };
    let fetchedAt: Date | null = null;
    for (const r of rows) {
      const eff = r.manual_per_usd ?? r.per_usd;
      if (eff != null) rates[r.currency] = Number(eff);
      if (r.fetched_at && (!fetchedAt || r.fetched_at > fetchedAt)) fetchedAt = r.fetched_at;
    }
    return { base: 'USD', rates, fetched_at: fetchedAt };
  }

  private async loadCacheFromDb() {
    try {
      const rows = await this.fxRepository.find();
      for (const r of rows) {
        const eff = r.manual_per_usd ?? r.per_usd;
        if (eff != null) this.cache.set(r.currency, Number(eff));
      }
    } catch {
      /* table may not exist on the very first sync pass */
    }
  }

  private async refresh() {
    try {
      const res = await axios.get(RATES_URL, { timeout: 15_000 });
      const rates = res.data?.rates;
      if (!rates || typeof rates !== 'object') throw new Error('no rates in response');

      const now = new Date();
      for (const currency of TRACKED) {
        if (currency === 'USD') continue;
        const perUsd = Number(rates[currency]);
        if (!Number.isFinite(perUsd) || perUsd <= 0) continue;
        const existing = await this.fxRepository.findOne({ where: { currency } });
        if (existing) {
          existing.per_usd = perUsd;
          existing.fetched_at = now;
          await this.fxRepository.save(existing);
        } else {
          await this.fxRepository.save(
            this.fxRepository.create({ currency, per_usd: perUsd, fetched_at: now }),
          );
        }
      }
      await this.loadCacheFromDb(); // re-read so manual overrides stay in effect
      console.log(`[FX] rates refreshed (${this.cache.size} currencies, base USD)`);
    } catch (err: any) {
      console.error('[FX] rate refresh failed:', err?.message, '— using last snapshot');
    }
  }
}
