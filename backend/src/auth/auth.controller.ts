import { Controller, Request, Post, UseGuards, Body, Get, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TurnstileGuard } from './turnstile.guard';
import { AuthService } from './auth.service';
import { UserRole } from '../users/user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';


/** Same idea as the app-wide ceilings: production defaults, raisable for a test run. */
const authLimit = (key: string, fallback: number): number => {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /* Credential endpoints are the ones worth guessing at, so they get a
     much tighter allowance than the app-wide default. */
  @Throttle({ short: { ttl: 60_000, limit: authLimit('THROTTLE_REGISTER', 5) }, medium: { ttl: 3_600_000, limit: authLimit('THROTTLE_REGISTER_HOUR', 20) } })
  @UseGuards(TurnstileGuard)
  @Post('register')
  async register(@Body() body: any) {
    const { email, password, role, profile } = body;
    if (!email || !password || !role) {
      // A 201 carrying `{ error }` reads as success to every client — the
      // frontend would store an undefined token and land on a blank app.
      throw new BadRequestException('Email, password, and role are required');
    }
    // Simple-signup flow: no KYC required at registration. Account starts
    // as `active`. Admin can later flip `kyc_required=true` and the user
    // then submits ID + video via POST /auth/kyc from their profile.
    return this.authService.register(email, password, role, profile, body.language, body.signup_market);
  }

  /* Asking for a link is rate-limited hard: it sends mail, and answering
     the same way for every address is what keeps it from confirming who
     has an account. */
  @Throttle({ short: { ttl: 60_000, limit: authLimit('THROTTLE_FORGOT', 3) }, medium: { ttl: 3_600_000, limit: authLimit('THROTTLE_FORGOT_HOUR', 10) } })
  @UseGuards(TurnstileGuard)
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    await this.authService.requestPasswordReset(body?.email);
    return { ok: true, message: 'If that address has an account, a reset link is on its way.' };
  }

  @Throttle({ short: { ttl: 60_000, limit: authLimit('THROTTLE_RESET', 5) }, medium: { ttl: 3_600_000, limit: authLimit('THROTTLE_RESET_HOUR', 20) } })
  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; token: string; password: string }) {
    return this.authService.resetPassword(body?.email, body?.token, body?.password);
  }

  @Throttle({ short: { ttl: 60_000, limit: authLimit('THROTTLE_LOGIN', 10) }, medium: { ttl: 900_000, limit: authLimit('THROTTLE_LOGIN_QUARTER', 40) } })
  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.blocked_reason === 'REJECTED') throw new UnauthorizedException('Account rejected');
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.authService['usersService'].findByIdWithProfiles(req.user.userId);
    const displayName =
      user?.creatorProfile?.full_name ||
      user?.managerProfile?.full_name ||
      user?.brandProfile?.company_name ||
      user?.brandProfile?.contact_person ||
      user?.email?.split('@')[0] ||
      'User';

    return {
      ...req.user,
      account_status: user?.account_status,
      kyc_required: user?.kyc_required ?? false,
      kyc_status: user?.kyc_status,
      has_kyc_submission: !!(user?.kyc_video_url || user?.kyc_id_front),
      display_name: displayName,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('kyc')
  async submitKyc(
    @Request() req: any,
    @Body()
    body: { kyc_id_front: string; kyc_id_back: string; kyc_video_url: string },
  ) {
    return this.authService.submitKyc(
      req.user.userId,
      body.kyc_id_front,
      body.kyc_id_back,
      body.kyc_video_url,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  async changeEmail(@Request() req: any, @Body() body: { newEmail: string; currentPassword: string }) {
    return this.authService.changeEmail(req.user.userId, body.newEmail, body.currentPassword);
  }
}
