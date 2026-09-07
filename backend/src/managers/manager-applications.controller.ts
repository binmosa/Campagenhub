import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ManagerApplicationsService } from './manager-applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/manager-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManagerApplicationsController {
  constructor(private readonly service: ManagerApplicationsService) {}

  /** Manager offers to run one of a brand's campaigns. */
  @Post()
  @Roles(UserRole.MANAGER)
  async apply(@Request() req: any, @Body() body: { campaignId: string; pitch?: string; proposed_fee?: number; currency?: string; fee_frequency?: string }) {
    return this.service.apply(req.user.userId, body);
  }

  @Get('mine')
  @Roles(UserRole.MANAGER)
  async mine(@Request() req: any, @Query('status') status?: string) {
    return this.service.mine(req.user.userId, status);
  }

  /** The brands this manager works for, with how much of each grant is used. */
  @Get('engagements')
  @Roles(UserRole.MANAGER)
  async engagements(@Request() req: any) {
    return this.service.engagements(req.user.userId);
  }

  @Get()
  @Roles(UserRole.BRAND)
  async forBrand(@Request() req: any, @Query('campaignId') campaignId?: string, @Query('status') status?: string) {
    return this.service.forBrand(req.user.brandId, { campaignId, status });
  }

  @Patch(':id/withdraw')
  @Roles(UserRole.MANAGER)
  async withdraw(@Request() req: any, @Param('id') id: string) {
    return this.service.withdraw(req.user.userId, id);
  }

  /** Brand accepts (with a grant) or declines. */
  @Patch(':id/decide')
  @Roles(UserRole.BRAND)
  async decide(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { action: 'accept' | 'reject'; note?: string; campaign_limit?: number | null; budget_cap?: number | null; permissions?: Record<string, boolean>; payment_amount?: number; currency?: string; payment_frequency?: string; payment_day?: number },
  ) {
    return this.service.decide(req.user.brandId, id, body);
  }
}
