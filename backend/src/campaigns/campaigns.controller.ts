import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Delete, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('active')
  async getActive(@Query('lang') lang?: string) {
    return this.campaignsService.getActiveCampaigns(lang);
  }

  // Public directory - no auth required. Paginated: returns { items, total, hasMore }.
  @Get('public-list')
  async getPublicList(
    @Query('search') search?: string,
    @Query('platform') platform?: string,
    @Query('minBudget') minBudget?: string,
    @Query('maxBudget') maxBudget?: string,
    @Query('industry') industry?: string,
    @Query('objective') objective?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('lang') lang?: string,
  ) {
    return this.campaignsService.getPublicCampaigns({
      search, platform, minBudget, maxBudget, industry, objective, sort, limit, offset, lang,
    });
  }

  // Filter facets (brand sectors + campaign orientations that exist).
  @Get('facets')
  async getFacets() {
    return this.campaignsService.getCampaignFacets();
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
