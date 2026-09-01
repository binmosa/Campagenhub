import { Controller, Request, Post, UseGuards, Body, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../users/user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    const { email, password, role, profile } = body;
    if (!email || !password || !role) {
      return { error: 'Email, password, and role are required' };
    }
    // Simple-signup flow: no KYC required at registration. Account starts
    // as `active`. Admin can later flip `kyc_required=true` and the user
    // then submits ID + video via POST /auth/kyc from their profile.
    return this.authService.register(email, password, role, profile, body.language, body.signup_market);
  }

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
