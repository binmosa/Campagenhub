import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/brands')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get('profile')
  @Roles(UserRole.BRAND)
  async getProfile(@Request() req: any) {
    return this.brandsService.getProfile(req.user.userId);
  }

  @Post('profile')
  @Roles(UserRole.BRAND)
  async updateProfile(@Request() req: any, @Body() data: any) {
    return this.brandsService.updateProfile(req.user.userId, data);
  }

  // ===== Team Management =====

  @Get('team')
  @Roles(UserRole.BRAND)
  async getTeam(@Request() req: any) {
    return this.brandsService.getTeamMembers(req.user.userId);
  }

  @Post('team')
  @Roles(UserRole.BRAND)
  async createTeamMember(@Request() req: any, @Body() body: { email: string; password: string; permissions: Record<string, boolean> }) {
    return this.brandsService.createTeamMember(req.user.userId, body.email, body.password, body.permissions);
  }

  @Patch('team/:id')
  @Roles(UserRole.BRAND)
  async updateTeamMember(@Request() req: any, @Param('id') id: string, @Body() body: { permissions: Record<string, boolean> }) {
    return this.brandsService.updateTeamMember(req.user.userId, id, body.permissions);
  }

  @Delete('team/:id')
  @Roles(UserRole.BRAND)
  async removeTeamMember(@Request() req: any, @Param('id') id: string) {
    return this.brandsService.removeTeamMember(req.user.userId, id);
  }
}
