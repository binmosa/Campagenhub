import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ========== PUBLIC TICKETS ==========
  @Post('support/tickets')
  async createTicket(@Body() body: { sender_name: string; sender_email: string; subject?: string; message: string }) {
    return this.supportService.createTicket(body);
  }

  // ========== ADMIN TICKETS ==========
  @UseGuards(JwtAuthGuard)
  @Get('support/tickets')
  async getAllTickets(@Query('status') status?: string) {
    return this.supportService.getAllTickets(status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('support/tickets/stats')
  async getTicketStats() {
    return this.supportService.getTicketStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('support/tickets/:id')
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicketById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('support/tickets/:id/reply')
  async replyToTicket(@Param('id') id: string, @Body() body: { reply: string; status?: string }) {
    return this.supportService.replyToTicket(id, body.reply, body.status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('support/tickets/:id/status')
  async updateTicketStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateTicketStatus(id, body.status);
  }

  // ========== PUBLIC REVIEWS ==========
  @Get('public/reviews')
  async getVisibleReviews() {
    return this.supportService.getVisibleReviews();
  }

  @UseGuards(JwtAuthGuard)
  @Post('public/reviews')
  async createAdminTestimonial(@Body() body: any) {
    return this.supportService.createReview(null, body);
  }

  // ========== AUTHENTICATED REVIEWS ==========
  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  async createReview(@Request() req: any, @Body() body: { rating: number; comment: string; user_name?: string }) {
    return this.supportService.createReview(req.user.userId, {
      rating: body.rating,
      comment: body.comment,
      user_name: body.user_name,
      user_role: req.user.role || 'user',
    });
  }

  // ========== ADMIN REVIEWS ==========
  @UseGuards(JwtAuthGuard)
  @Get('reviews')
  async getAllReviews() {
    return this.supportService.getAllReviews();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reviews/:id/toggle')
  async toggleReviewVisibility(@Param('id') id: string) {
    return this.supportService.toggleReviewVisibility(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    return this.supportService.deleteReview(id);
  }
}
