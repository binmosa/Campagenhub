import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private telegramService: TelegramService,
  ) {}

  async createNotification(userId: string, type: string, message: string, referenceId?: string): Promise<Notification> {
    const notification = this.notificationsRepo.create({
      user: { id: userId },
      type,
      message,
      reference_id: referenceId,
    });
    
    const saved = await this.notificationsRepo.save(notification);

    // Send Telegram Notification
    try {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (user && user.telegram_chat_id) {
        await this.telegramService.sendNotification(user.telegram_chat_id, `🔔 *New Notification*\n\n${message}`);
      }
    } catch (e) {}

    return saved;
  }

  async getMyNotifications(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notificationsRepo.findOne({
      where: { id: notificationId, user: { id: userId } }
    });
    if (!notification) throw new NotFoundException('Notification not found');
    notification.is_read = true;
    return this.notificationsRepo.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepo.update({ user: { id: userId }, is_read: false }, { is_read: true });
  }

  async markByReferenceAsRead(userId: string, referenceId: string): Promise<void> {
    await this.notificationsRepo.update(
      { user: { id: userId }, reference_id: referenceId, is_read: false },
      { is_read: true }
    );
  }
}
