import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Cloudflare Turnstile — proof that a human filled the form.
 *
 * Rate limiting stops one address hammering an endpoint; it does nothing
 * about a bot net spread across hundreds of addresses, each staying politely
 * under the limit. That is what fills a creator directory with junk accounts
 * and burns an email-sending reputation on password-reset floods.
 *
 * The guard is inert until TURNSTILE_SECRET_KEY is set, so local development
 * and the test suite run without Cloudflare. That is deliberate: a guard
 * that cannot be switched off breaks every environment that is not
 * production, and one that silently passes in production is worse — so the
 * boot log says plainly which mode is active.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private static announced = false;

  private get secret(): string {
    return process.env.TURNSTILE_SECRET_KEY || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!TurnstileGuard.announced) {
      TurnstileGuard.announced = true;
      console.log(
        this.secret
          ? '[Boot] Turnstile is protecting sign-up and password reset.'
          : '[Boot] TURNSTILE_SECRET_KEY is unset — sign-up and password reset are unprotected by a challenge.',
      );
    }
    if (!this.secret) return true;

    const request = context.switchToHttp().getRequest();
    const token: string =
      request.body?.turnstileToken || request.body?.['cf-turnstile-response'] || '';

    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Please complete the verification challenge and try again.');
    }

    try {
      const form = new URLSearchParams({ secret: this.secret, response: token });
      // The client IP sharpens Cloudflare's own scoring. It is only correct
      // when TRUST_PROXY is set behind a reverse proxy; sending a proxy
      // address would make every request look like the same visitor, so it
      // is left out rather than sent wrong.
      const ip = request.ip;
      if (ip && ip !== '::1' && ip !== '127.0.0.1') form.append('remoteip', ip);

      const { data } = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        form.toString(),
        { headers: { 'content-type': 'application/x-www-form-urlencoded' }, timeout: 8000 },
      );

      if (data?.success) return true;

      const codes: string[] = Array.isArray(data?.['error-codes']) ? data['error-codes'] : [];
      // A token is single-use and short-lived; both cases just need a retry.
      if (codes.includes('timeout-or-duplicate')) {
        throw new BadRequestException('That verification has expired. Please try again.');
      }
      console.warn(`[Turnstile] Rejected a submission: ${codes.join(', ') || 'no error code'}`);
      throw new BadRequestException('Verification failed. Please try again.');
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      // Cloudflare unreachable. Refusing would lock everyone out of sign-up
      // over someone else's outage, so the request proceeds — rate limiting
      // is still in front of it — and the failure is logged loudly.
      console.error(`[Turnstile] Could not reach Cloudflare, allowing the request: ${e?.message}`);
      return true;
    }
  }
}
