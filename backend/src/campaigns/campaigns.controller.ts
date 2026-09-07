import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Delete, Query, ForbiddenException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamPermission, TeamPermissionGuard } from '../auth/team-permission.guard';
import { UserRole } from '../users/user.entity';
import { engagementFor, isManager, requireManagerPermission } from '../managers/manager-access';

/**
 * Brand-owned routes act for `req.user.brandId` — the owner itself, or the
 * parent brand when a team member is signed in — and team members must hold
 * the matching permission flag (see TeamPermissionGuard).
 *
 * An account manager is not a brand: they act only for brands that engaged
 * them, name the brand explicitly, and are capped by that brand's grant.
 */

/** The brand a request acts for: the account itself, or — for a manager — the brand they named. */
const actingBrand = (req: any, brandId?: string, permission?: { key: string; label: string }): string => {
  if (!isManager(req.user)) return req.user.brandId;
  const target = brandId || (req.user.managedBrands || [])[0]?.brandId;
  if (!target) throw new ForbiddenException('No brand has engaged you yet. Offer to manage a campaign first.');
  const engagement = engagementFor(req.user, target);
  if (permission) requireManagerPermission(engagement, permission.key, permission.label);
  return target;
};

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
  @Roles(UserRole.BRAND, UserRole.MANAGER)
  @TeamPermission('can_view_analytics')
  async getBrandStats(@Request() req: any, @Query('brandId') brandId?: string) {
    return this.campaignsService.getBrandStats(actingBrand(req, brandId, { key: 'can_view_analytics', label: 'see analytics' }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('brand')
  @Roles(UserRole.BRAND, UserRole.MANAGER)
  async getBrandCampaigns(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
  ) {
    if (isManager(req.user)) return this.campaignsService.getCampaignsForManager(req.user, { status, search, brandId });
    return this.campaignsService.getCampaignsByBrand(req.user.brandId, { status, search });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  /** The campaigns this account works on: a brand's own, a manager's managed set. */
  @Get('mine')
  @Roles(UserRole.BRAND, UserRole.MANAGER)
  async getMineCampaigns(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
  ) {
    if (isManager(req.user)) return this.campaignsService.getCampaignsForManager(req.user, { status, search, brandId });
    return this.campaignsService.getCampaignsByBrand(req.user.brandId, { status, search });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  @Post()
  @Roles(UserRole.BRAND, UserRole.MANAGER)
  @TeamPermission('can_add_campaigns')
  async createCampaign(@Request() req: any, @Body() body: any) {
    const brandId = actingBrand(req, body?.brand_id, { key: 'can_add_campaigns', label: 'create campaigns' });
    return this.campaignsService.createCampaign({ ...req.user, userId: brandId }, body, isManager(req.user) ? req.user : null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  @Patch(':id')
  @Roles(UserRole.BRAND, UserRole.MANAGER)
  @TeamPermission('can_add_campaigns')
  async updateCampaign(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    if (isManager(req.user)) return this.campaignsService.updateCampaignAsManager(id, req.user, body);
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
