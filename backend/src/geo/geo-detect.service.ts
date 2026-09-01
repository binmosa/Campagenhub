import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import axios from 'axios';
import { MARKETS } from '../markets/markets.config';

/**
 * GeoDetectService — "which country is this visitor in?"
 *
 * Resolution order:
 *   1. Trusted edge headers (Cloudflare `cf-ipcountry`, Vercel
 *      `x-vercel-ip-country`) — free and instant when a CDN fronts us.
 *   2. IP lookup via ip-api.com (free tier, in-memory cached 24h per IP).
 *      This backend path is only the FALLBACK — in production the Vercel
 *      edge middleware does the routing before the SPA even loads, so the
 *      free tier's rate limit is comfortably enough. If this ever becomes
 *      the primary path, swap in a local GeoLite2 database.
 *   3. Private/localhost IPs (dev) → unknown, so `/` stays the default.
 */
@Injectable()
export class GeoDetectService {
  private cache = new Map<string, { code: string | null; expires: number }>();

  async detect(req: Request, mock?: string): Promise<{
    country_code: string | null;
    market: (typeof MARKETS)[number] | null;
  }> {
    let code: string | null = null;

    // Dev-only mock so the flow is testable without leaving localhost.
    if (mock && process.env.NODE_ENV !== 'production') {
      code = mock.toUpperCase();
    }

    if (!code) {
      const header =
        (req.headers['cf-ipcountry'] as string) ||
        (req.headers['x-vercel-ip-country'] as string);
      if (header && /^[A-Z]{2}$/i.test(header)) code = header.toUpperCase();
    }

    if (!code) {
      const ip = this.clientIp(req);
      if (ip && !this.isPrivate(ip)) code = await this.lookup(ip);
    }

    const market = code
      ? MARKETS.find((m) => m.code.toUpperCase() === code) || null
      : null;
    return { country_code: code, market };
  }

  private clientIp(req: Request): string | null {
    const fwd = (req.headers['x-forwarded-for'] as string) || '';
    const first = fwd.split(',')[0]?.trim();
    return first || req.socket?.remoteAddress || null;
  }

  private isPrivate(ip: string): boolean {
    const v4 = ip.replace(/^::ffff:/, '');
    return (
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(v4) ||
      ip === '::1' ||
      /^f[cd]/i.test(ip)
    );
  }

  private async lookup(ip: string): Promise<string | null> {
    const hit = this.cache.get(ip);
    if (hit && hit.expires > Date.now()) return hit.code;

    let code: string | null = null;
    try {
      const res = await axios.get(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
        { timeout: 3000 },
      );
      if (res.data?.status === 'success' && /^[A-Z]{2}$/.test(res.data.countryCode)) {
        code = res.data.countryCode;
      }
    } catch {
      /* lookup down → treat as unknown, never block the page */
    }

    if (this.cache.size > 10_000) this.cache.clear(); // crude but sufficient cap
    this.cache.set(ip, { code, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return code;
  }
}
