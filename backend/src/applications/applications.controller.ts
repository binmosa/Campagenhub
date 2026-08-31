import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(UserRole.CREATOR)
  async apply(@Request() req: any, @Body() body: { campaignId: string; pitch: string; videoPitchUrl?: string }) {
    return this.applicationsService.applyToCampaign(req.user.userId, body.campaignId, body.pitch, body.videoPitchUrl);
  }

  @Get()
  async getMyApplications(@Request() req: any) {
    return this.applicationsService.getApplications(req.user);
  }

  @Get('mine')
  async getMine(@Request() req: any) {
    return this.applicationsService.getApplications(req.user);
  }

  @Patch(':id/status')
  @Roles(UserRole.BRAND)
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.applicationsService.updateStatus(id, req.user.userId, body.status);
  }

  @Patch(':id/payment-schedule')
  @Roles(UserRole.BRAND)
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
    return this.applicationsService.setPaymentSchedule(id, req.user.userId, body);
  }
}
