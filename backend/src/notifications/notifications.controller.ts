import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Request() req: any) {
    return this.notificationsService.getMyNotifications(req.user.userId);
  }

  @Post(':id/read')
  async markRead(@Request() req: any, @Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(req.user.userId, notificationId);
  }

  @Post('read-all')
  async markAllRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  @Post('read-by-reference/:refId')
  async markReadByRef(@Request() req: any, @Param('refId') refId: string) {
    await this.notificationsService.markByReferenceAsRead(req.user.userId, refId);
    return { success: true };
  }
}
