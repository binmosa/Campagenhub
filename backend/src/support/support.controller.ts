import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

/**
 * Tickets come from a public form, so the inbox holds the name, email and
 * message of anyone who ever wrote in — staff-only data. The same goes for
 * the review desk: what is visible on the landing page is a staff decision,
 * not something any signed-in account may set.
 */
const STAFF = [UserRole.ADMIN, UserRole.SUPPORT] as const;

@Controller('api')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ========== PUBLIC TICKETS ==========
  @Post('support/tickets')
  async createTicket(@Body() body: { sender_name: string; sender_email: string; subject?: string; message: string }) {
    return this.supportService.createTicket(body);
  }

  // ========== ADMIN TICKETS ==========
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('support/tickets')
  async getAllTickets(@Query('status') status?: string) {
    return this.supportService.getAllTickets(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('support/tickets/stats')
  async getTicketStats() {
    return this.supportService.getTicketStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('support/tickets/:id')
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicketById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('support/tickets/:id/reply')
  async replyToTicket(@Param('id') id: string, @Body() body: { reply: string; status?: string }) {
    return this.supportService.replyToTicket(id, body.reply, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('support/tickets/:id/status')
  async updateTicketStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateTicketStatus(id, body.status);
  }

  // ========== PUBLIC REVIEWS ==========
  @Get('public/reviews')
  async getVisibleReviews() {
    return this.supportService.getVisibleReviews();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('reviews')
  async getAllReviews() {
    return this.supportService.getAllReviews();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('reviews/:id/toggle')
  async toggleReviewVisibility(@Param('id') id: string) {
    return this.supportService.toggleReviewVisibility(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    return this.supportService.deleteReview(id);
  }
}
