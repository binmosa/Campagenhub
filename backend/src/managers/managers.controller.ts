import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ManagersService } from './managers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../core/roles.guard';
import { Roles } from '../core/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/managers')
export class ManagersController {
  constructor(private readonly managersService: ManagersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER)
  getProfile(@Request() req: any) {
    return this.managersService.getMyProfile(req.user.userId);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER)
  updateProfile(@Request() req: any, @Body() body: any) {
    return this.managersService.createProfile(req.user.userId, body);
  }

  @Get('public')
  getAllManagers(
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('minRating') minRating?: string,
  ) {
    return this.managersService.getAllPublicManagers({ search, sort, minRating });
  }

  @Post('feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND)
  submitFeedback(@Request() req: any, @Body() body: { manager_id: string, rating: number, feedback_text: string }) {
    return this.managersService.submitFeedback(req.user.userId, body.manager_id, body.rating, body.feedback_text);
  }

  @Get('admin/feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  getAllFeedback() {
    return this.managersService.getAllFeedback();
  }

  @Patch('admin/feedback/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  resolveFeedback(@Param('id') id: string, @Body() body: { status: string }) {
    return this.managersService.resolveFeedback(id, body.status);
  }
}
