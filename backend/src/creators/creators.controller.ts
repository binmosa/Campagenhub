import { Controller, Get, Post, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async getProfile(@Request() req: any) {
    return this.creatorsService.getProfile(req.user.userId);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  async updateProfile(@Request() req: any, @Body() data: any) {
    return this.creatorsService.updateProfile(req.user.userId, data);
  }

  // Public directory - no auth required
  @Get('public-list')
  async getAllPublic(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('minFollowers') minFollowers?: string,
    @Query('maxFollowers') maxFollowers?: string,
    @Query('sort') sort?: string,
  ) {
    return this.creatorsService.getAllPublicCreators({ search, category, location, minFollowers, maxFollowers, sort });
  }

  // Public read-only profile card - accessible by any authenticated user
  @Get('public/:id')
  @UseGuards(JwtAuthGuard)
  async getPublicProfile(@Param('id') id: string) {
    return this.creatorsService.getPublicProfile(id);
  }
}

