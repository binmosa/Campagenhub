import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Delete, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamPermission, TeamPermissionGuard } from '../auth/team-permission.guard';
import { UserRole } from '../users/user.entity';

/**
 * Brand-owned routes act for `req.user.brandId` — the owner itself, or the
 * parent brand when a team member is signed in — and team members must hold
 * the matching permission flag (see TeamPermissionGuard).
 */
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
    @Query('country') country?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('lang') lang?: string,
  ) {
    return this.campaignsService.getPublicCampaigns({
      search, platform, minBudget, maxBudget, industry, objective, country, sort, limit, offset, lang,
    });
  }

  // Filter facets (brand sectors + campaign orientations that exist).
  @Get('facets')
  async getFacets() {
    return this.campaignsService.getCampaignFacets();
  }

  // Brand overview numbers (funnels, committed budget, weekly series).
  @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  @Get('brand/stats')
  @Roles(UserRole.BRAND)
  @TeamPermission('can_view_analytics')
  async getBrandStats(@Request() req: any) {
    return this.campaignsService.getBrandStats(req.user.brandId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('brand')
  @Roles(UserRole.BRAND)
  async getBrandCampaigns(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.campaignsService.getCampaignsByBrand(req.user.brandId, { status, search });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('mine')
  @Roles(UserRole.BRAND)
  async getMineCampaigns(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.campaignsService.getCampaignsByBrand(req.user.brandId, { status, search });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  @Post()
  @Roles(UserRole.BRAND)
  @TeamPermission('can_add_campaigns')
  async createCampaign(@Request() req: any, @Body() body: any) {
    return this.campaignsService.createCampaign({ ...req.user, userId: req.user.brandId }, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  @Patch(':id')
  @Roles(UserRole.BRAND)
  @TeamPermission('can_add_campaigns')
  async updateCampaign(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.campaignsService.updateCampaign(id, req.user.brandId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  @Delete(':id')
  @Roles(UserRole.BRAND)
  @TeamPermission('can_add_campaigns')
  async deleteCampaign(@Request() req: any, @Param('id') id: string) {
    await this.campaignsService.deleteCampaign(id, req.user.brandId);
    return { success: true };
  }

  // Single campaign. Public while active; owners/admins in any status.
  // Declared last so the literal routes above are never shadowed.
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getOne(@Request() req: any, @Param('id') id: string, @Query('lang') lang?: string) {
    return this.campaignsService.getCampaignById(id, req.user ? { ...req.user, userId: req.user.brandId || req.user.userId } : undefined, lang);
  }
}
