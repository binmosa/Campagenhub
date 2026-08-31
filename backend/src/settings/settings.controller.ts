import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public/settings')
  async getPublicSettings() {
    return this.settingsService.getAllSettings();
  }

  @Get('public/activity')
  async getPublicActivity() {
    return this.settingsService.getRecentActivity();
  }

  @Get('public/platform-stats')
  async getPlatformStats() {
    return this.settingsService.getPlatformStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/settings')
  async updateSettings(@Body() body: Record<string, string>) {
    const results = [];
    for (const [key, value] of Object.entries(body)) {
      results.push(await this.settingsService.updateSetting(key, value));
    }
    return { success: true, updated: results.length };
  }
}
