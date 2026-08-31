import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('application/:applicationId')
  async getMessages(@Request() req: any, @Param('applicationId') applicationId: string) {
    return this.messagesService.getMessagesForApplication(req.user.userId, applicationId);
  }

  @Post('application/:applicationId')
  async sendMessage(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Body('content') content: string,
  ) {
    return this.messagesService.sendMessage(req.user.userId, applicationId, content);
  }
  @Get('conversations')
  async getConversations(@Request() req: any) {
    return this.messagesService.getConversations(req.user.userId);
  }

  @Get('direct/:userId')
  async getDirectMessages(@Request() req: any, @Param('userId') otherUserId: string) {
    return this.messagesService.getDirectMessages(req.user.userId, otherUserId);
  }

  @Post('direct/:userId')
  async sendDirectMessage(
    @Request() req: any,
    @Param('userId') receiverId: string,
    @Body('content') content: string,
  ) {
    return this.messagesService.sendDirectMessage(req.user.userId, receiverId, content);
  }
}
