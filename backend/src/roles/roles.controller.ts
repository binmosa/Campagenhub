import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Super Admin: Get all global roles
  @Get('global')
  @Roles(UserRole.ADMIN)
  async getGlobalRoles() {
    return this.rolesService.getGlobalRoles();
  }

  // Super Admin: Create global role
  @Post('global')
  @Roles(UserRole.ADMIN)
  async createGlobalRole(@Body() body: { name: string; permissions: Record<string, boolean> }) {
    return this.rolesService.createRole(body.name, body.permissions);
  }

  // Brand: Get local roles for this brand
  @Get('brand')
  @Roles(UserRole.BRAND)
  async getBrandRoles(@Request() req: any) {
    return this.rolesService.getBrandRoles(req.user.userId);
  }

  // Brand: Create local role
  @Post('brand')
  @Roles(UserRole.BRAND)
  async createBrandRole(@Request() req: any, @Body() body: { name: string; permissions: Record<string, boolean> }) {
    return this.rolesService.createRole(body.name, body.permissions, req.user.userId);
  }

  // Common: Update role permissions (Need to ensure they own it)
  @Patch(':id')
  async updateRole(@Param('id') id: string, @Body() body: { permissions: Record<string, boolean> }) {
    return this.rolesService.updateRole(id, body.permissions);
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }
}
