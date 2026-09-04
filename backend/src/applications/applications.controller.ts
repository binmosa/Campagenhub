import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamPermission, TeamPermissionGuard } from '../auth/team-permission.guard';
import { UserRole } from '../users/user.entity';

/** Brand-side reads and decisions act for `req.user.brandId` (see JwtStrategy). */
const asBrand = (user: any) => (user?.role === UserRole.BRAND ? { ...user, userId: user.brandId } : user);

@Controller('api/applications')
@UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(UserRole.CREATOR)
  async apply(@Request() req: any, @Body() body: { campaignId: string; pitch: string; videoPitchUrl?: string }) {
    return this.applicationsService.applyToCampaign(req.user.userId, body.campaignId, body.pitch, body.videoPitchUrl);
  }

  @Get()
  async getMyApplications(
    @Request() req: any,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
  ) {
    return this.applicationsService.getApplications(asBrand(req.user), { campaignId, status });
  }

  @Get('mine')
  async getMine(
    @Request() req: any,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
  ) {
    return this.applicationsService.getApplications(asBrand(req.user), { campaignId, status });
  }

  @Patch(':id/status')
  @Roles(UserRole.BRAND)
  @TeamPermission('can_manage_applications')
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.applicationsService.updateStatus(id, req.user.brandId, body.status);
  }

  @Patch(':id/payment-schedule')
  @Roles(UserRole.BRAND)
  @TeamPermission('can_manage_applications')
  async setPaymentSchedule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      payment_amount: number;
      currency: string;
      payment_frequency: string;
      payment_day: number;
      notes?: string;
    },
  ) {
    return this.applicationsService.setPaymentSchedule(id, req.user.brandId, body);
  }
}
