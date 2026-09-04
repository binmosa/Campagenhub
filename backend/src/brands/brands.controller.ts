import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamPermission, TeamPermissionGuard } from '../auth/team-permission.guard';
import { UserRole } from '../users/user.entity';

/**
 * Brand profile + the people on the account. Team members read the parent
 * brand's profile (they act for it everywhere) but only the owner can edit
 * it or manage who is on the team.
 */
@Controller('api/brands')
@UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get('profile')
  @Roles(UserRole.BRAND)
  async getProfile(@Request() req: any) {
    return this.brandsService.getProfile(req.user.brandId);
  }

  @Post('profile')
  @Roles(UserRole.BRAND)
  @TeamPermission('owner')
  async updateProfile(@Request() req: any, @Body() data: any) {
    return this.brandsService.updateProfile(req.user.userId, data);
  }

  // ===== Team Management (owner only) =====

  @Get('team')
  @Roles(UserRole.BRAND)
  @TeamPermission('owner')
  async getTeam(@Request() req: any) {
    return this.brandsService.getTeamMembers(req.user.userId);
  }

  @Post('team')
  @Roles(UserRole.BRAND)
  @TeamPermission('owner')
  async createTeamMember(@Request() req: any, @Body() body: { email: string; password: string; permissions: Record<string, boolean> }) {
    return this.brandsService.createTeamMember(req.user.userId, body.email, body.password, body.permissions);
  }

  @Patch('team/:id')
  @Roles(UserRole.BRAND)
  @TeamPermission('owner')
  async updateTeamMember(@Request() req: any, @Param('id') id: string, @Body() body: { permissions: Record<string, boolean> }) {
    return this.brandsService.updateTeamMember(req.user.userId, id, body.permissions);
  }

  @Delete('team/:id')
  @Roles(UserRole.BRAND)
  @TeamPermission('owner')
  async removeTeamMember(@Request() req: any, @Param('id') id: string) {
    return this.brandsService.removeTeamMember(req.user.userId, id);
  }
}
