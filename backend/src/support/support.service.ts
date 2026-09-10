import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { Review } from './review.entity';
import { PlatformSetting } from '../settings/setting.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private ticketsRepo: Repository<SupportTicket>,
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(PlatformSetting)
    private settingsRepo: Repository<PlatformSetting>,
    private readonly emailService: EmailService,
  ) {}

  // ========== TICKETS ==========
  /**
   * Public contact form → a support ticket (Admin → Support) AND an email to
   * the team inbox, so nobody has to watch the admin queue. The inbox is
   * SUPPORT_INBOX, else the public `contact_email` site setting, else the
   * sending Gmail account. Reply-To is the visitor, so replying in the mail
   * client answers them directly.
   */
  async createTicket(data: { sender_name: string; sender_email: string; subject?: string; message: string }) {
    const ticket = await this.ticketsRepo.save(this.ticketsRepo.create(data));
    void this.notifyTeam(ticket).catch((e) => console.error('[support] contact email failed:', e?.message));
    return ticket;
  }

  private async notifyTeam(ticket: SupportTicket): Promise<void> {
    const setting = await this.settingsRepo.findOne({ where: { key: 'contact_email' } });
    const inbox = (process.env.SUPPORT_INBOX || setting?.value || process.env.GMAIL_USER || '').trim();
    if (!inbox) return;
    await this.emailService.sendContactMessageToTeam(inbox, {
      name: ticket.sender_name,
      email: ticket.sender_email,
      subject: ticket.subject,
      message: ticket.message,
      ticketId: ticket.id,
    });
  }

  async getAllTickets(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.ticketsRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async getTicketById(id: string) {
    return this.ticketsRepo.findOne({ where: { id } });
  }

  async replyToTicket(id: string, reply: string, newStatus?: string) {
    const ticket = await this.ticketsRepo.findOne({ where: { id } });
    if (!ticket) return null;
    ticket.admin_reply = reply;
    if (newStatus) ticket.status = newStatus;
    else ticket.status = 'resolved';
    return this.ticketsRepo.save(ticket);
  }

  async updateTicketStatus(id: string, status: string) {
    const ticket = await this.ticketsRepo.findOne({ where: { id } });
    if (!ticket) return null;
    ticket.status = status;
    return this.ticketsRepo.save(ticket);
  }

  async getTicketStats() {
    const total = await this.ticketsRepo.count();
    const open = await this.ticketsRepo.count({ where: { status: 'open' } });
    const inProgress = await this.ticketsRepo.count({ where: { status: 'in_progress' } });
    const resolved = await this.ticketsRepo.count({ where: { status: 'resolved' } });
    return { total, open, inProgress, resolved };
  }

  // ========== REVIEWS ==========
  async createReview(userId: string | null, data: { rating: number; comment: string; user_name?: string; user_role?: string }) {
    const review = this.reviewsRepo.create({
      user: userId ? ({ id: userId } as any) : null,
      rating: Math.min(5, Math.max(1, data.rating)),
      comment: data.comment,
      user_name: data.user_name || 'Anonymous',
      user_role: data.user_role || 'user',
      is_visible: true,
    });
    return this.reviewsRepo.save(review);
  }

  async getVisibleReviews() {
    return this.reviewsRepo.find({
      where: { is_visible: true },
      order: { created_at: 'DESC' },
      take: 20,
    });
  }

  async getAllReviews() {
    return this.reviewsRepo.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async toggleReviewVisibility(id: string) {
    const review = await this.reviewsRepo.findOne({ where: { id } });
    if (!review) return null;
    review.is_visible = !review.is_visible;
    return this.reviewsRepo.save(review);
  }

  async deleteReview(id: string) {
    return this.reviewsRepo.delete(id);
  }
}
