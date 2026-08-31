import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Delete } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('active')
  async getActive() {
    return this.campaignsService.getActiveCampaigns();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('brand')
  @Roles(UserRole.BRAND)
  async getBrandCampaigns(@Request() req: any) {
    return this.campaignsService.getCampaignsByBrand(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('mine')
  @Roles(UserRole.BRAND)
  async getMineCampaigns(@Request() req: any) {
    return this.campaignsService.getCampaignsByBrand(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.BRAND)
  async createCampaign(@Request() req: any, @Body() body: any) {
    return this.campaignsService.createCampaign(req.user, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(UserRole.BRAND)
  async updateCampaign(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.campaignsService.updateCampaign(id, req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(UserRole.BRAND)
  async deleteCampaign(@Request() req: any, @Param('id') id: string) {
    await this.campaignsService.deleteCampaign(id, req.user.userId);
    return { success: true };
  }
}
