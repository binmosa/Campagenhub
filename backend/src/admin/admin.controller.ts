import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  /* The back-office lists are paged: ?limit&offset&search plus each
     screen's own filters. Every response carries `total` and whole-table
     `stats`, so the KPI tiles stay true while only one page is loaded. */
  @Get('users')
  async getAllUsers(@Query() query: any) {
    return this.adminService.getAllUsers(query);
  }

  @Get('users/pending')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getPendingUsers() {
    return this.adminService.getPendingUsers();
  }

  @Patch('users/:id/validate')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async validateUserStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.adminService.validateUserStatus(id, body.status);
  }

  @Patch('users/:id/require-kyc')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async requireKyc(@Param('id') id: string, @Body() body: { required: boolean }) {
    return this.adminService.requireKyc(id, body?.required ?? true);
  }

  @Get('campaigns')
  async getAllCampaigns(@Query() query: any) {
    return this.adminService.getAllCampaigns(query);
  }

  @Get('applications')
  async getAllApplications(@Query() query: any) {
    return this.adminService.getAllApplications(query);
  }

  @Get('payouts')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async getAllPayouts(@Query() query: any) {
    return this.adminService.getAllPayouts(query);
  }

  @Patch('campaigns/:id/status')
  async toggleCampaignStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.adminService.toggleCampaignStatus(id, body.status);
  }

  @Patch('payouts/:id')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async updatePayoutStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.adminService.updatePayoutStatus(id, body.status, req.user.userId, req.user.role);
  }

  @Post('payouts/:id/execute')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async executePayoutTransfer(@Request() req: any, @Param('id') id: string) {
    return this.adminService.executePayoutTransfer(id, req.user.userId, req.user.role);
  }

  @Get('brand-balances')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async getBrandBalances() {
    return this.adminService.getBrandBalances();
  }

  @Get('audit-logs')
  @Roles(UserRole.ADMIN)
  async getAuditLogs(@Query() query: any) {
    return this.adminService.getAuditLogs(query);
  }

  // ===== User Management CRUD =====

  @Post('users')
  async createUser(@Body() body: { email: string; password: string; role: string }) {
    return this.adminService.createUser(body.email, body.password, body.role);
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Patch('users/:id/ban')
  async toggleBan(@Param('id') id: string) {
    return this.adminService.toggleBan(id);
  }

  @Patch('users/:id/permissions')
  async updatePermissions(@Param('id') id: string, @Body() body: { permissions: Record<string, boolean> }) {
    return this.adminService.updatePermissions(id, body.permissions);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
