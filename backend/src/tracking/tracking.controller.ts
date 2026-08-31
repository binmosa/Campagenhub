import { Controller, Post, Get, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrackingService } from './tracking.service';

@Controller('api/tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('application/:applicationId/link')
  async submitLink(
    @Param('applicationId') applicationId: string,
    @Body() body: { url: string },
  ) {
    return this.trackingService.submitLink(applicationId, body.url);
  }

  @UseGuards(JwtAuthGuard)
  @Get('application/:applicationId/submissions')
  async getSubmissions(@Param('applicationId') applicationId: string) {
    return this.trackingService.getSubmissions(applicationId);
  }

  // Get all submissions for campaigns owned by the current brand
  @UseGuards(JwtAuthGuard)
  @Get('brand/submissions')
  async getBrandSubmissions(@Request() req: any) {
    return this.trackingService.getSubmissionsForBrand(req.user.userId);
  }

  // Get all submissions for a specific campaign
  @UseGuards(JwtAuthGuard)
  @Get('campaign/:campaignId/submissions')
  async getCampaignSubmissions(@Param('campaignId') campaignId: string) {
    return this.trackingService.getSubmissionsForCampaign(campaignId);
  }
}
