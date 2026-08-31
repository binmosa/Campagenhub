import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // Public - browse all active offers
  @Get()
  async getAll() {
    return this.offersService.getAllActive();
  }

  // Protected routes
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async getMyOffers(@Request() req: any) {
    return this.offersService.getMyOffers(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() body: { title: string; description?: string; content_type: string; price: number; currency?: string; delivery_days?: number }) {
    return this.offersService.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.offersService.update(req.user.userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  async toggleActive(@Request() req: any, @Param('id') id: string) {
    return this.offersService.toggleActive(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.offersService.remove(req.user.userId, id);
  }
}
