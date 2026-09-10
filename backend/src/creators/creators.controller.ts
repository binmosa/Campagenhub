import { Controller, Get, Post, Patch, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async getProfile(@Request() req: any) {
    return this.creatorsService.getProfile(req.user.userId);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async updateProfile(@Request() req: any, @Body() data: any) {
    return this.creatorsService.updateProfile(req.user.userId, data);
  }

  // Public directory - no auth required. Paginated: returns { items, total, hasMore }.
  @Get('public-list')
  async getAllPublic(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('country') country?: string,
    @Query('countryCode') countryCode?: string,
    @Query('city') city?: string,
    @Query('minFollowers') minFollowers?: string,
    @Query('maxFollowers') maxFollowers?: string,
    @Query('platforms') platforms?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.creatorsService.getAllPublicCreators({
      search, category, location, country, countryCode, city, minFollowers, maxFollowers, platforms, sort, limit, offset,
    });
  }

  // Location facets for filter dropdowns — only places active creators are.
  @Get('locations')
  async getLocations() {
    return this.creatorsService.getCreatorLocations();
  }

  // Public read-only profile card - accessible by any authenticated user
  @Get('public/:id')
  @UseGuards(JwtAuthGuard)
  async getPublicProfile(@Param('id') id: string) {
    return this.creatorsService.getPublicProfile(id);
  }

  /** Live handle availability while the creator types (own handle counts as free). */
  @Get('handle-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async checkHandle(@Request() req: any, @Query('u') u?: string) {
    return this.creatorsService.checkHandle(req.user.userId, u);
  }

  /* ── Onboarding — the creator's first-session setup ─────────────── */
  @Get('onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async getOnboarding(@Request() req: any) {
    return this.creatorsService.getOnboarding(req.user.userId);
  }

  @Post('onboarding/followed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async recordFollowed(@Request() req: any, @Body() body: { platforms?: string[] }) {
    return this.creatorsService.recordFollowed(req.user.userId, body?.platforms);
  }

  @Post('onboarding/welcome-post')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async submitWelcomePost(@Request() req: any, @Body() body: { url?: string }) {
    return this.creatorsService.submitWelcomePost(req.user.userId, body?.url);
  }

  @Post('onboarding/accept-terms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async acceptTerms(@Request() req: any, @Body() body: { version?: string }) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return this.creatorsService.acceptTerms(req.user.userId, body?.version, { ip: forwarded || req.ip, userAgent: req.headers?.['user-agent'] });
  }

  @Post('onboarding/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async completeOnboarding(@Request() req: any) {
    return this.creatorsService.completeOnboarding(req.user.userId);
  }

  /* ── Welcome posts — admin / support review queue ───────────────── */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @Get('admin/welcome-posts')
  async listWelcomePosts(@Query('status') status?: string) {
    const s = status === 'approved' || status === 'rejected' ? status : 'pending';
    return this.creatorsService.listWelcomePosts(s);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @Patch('admin/welcome-posts/:userId')
  async decideWelcomePost(@Param('userId') userId: string, @Body() body: { action: 'approve' | 'reject'; note?: string }) {
    const action = body?.action === 'reject' ? 'reject' : 'approve';
    return this.creatorsService.decideWelcomePost(userId, { action, note: body?.note });
  }

  /* ── Follower claims — admin / support review queue ─────────────── */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @Get('admin/follower-claims')
  async listFollowerClaims(@Query('status') status?: string) {
    const s = status === 'verified' || status === 'rejected' ? status : 'pending';
    return this.creatorsService.listFollowerClaims(s);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @Patch('admin/follower-claims/:userId/:platform')
  async decideFollowerClaim(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('platform') platform: string,
    @Body() body: { action: 'verify' | 'reject'; verified_followers?: number; note?: string },
  ) {
    const action = body?.action === 'reject' ? 'reject' : 'verify';
    return this.creatorsService.decideFollowerClaim(userId, platform, { action, verified_followers: body?.verified_followers, note: body?.note }, req.user?.email);
  }
}

