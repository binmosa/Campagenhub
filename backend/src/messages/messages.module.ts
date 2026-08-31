import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { Application } from '../applications/application.entity';
import { Invitation } from '../invitations/invitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Application, Invitation]),
    NotificationsModule
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
