import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerProfile } from './manager-profile.entity';
import { ManagerFeedback } from './manager-feedback.entity';
import { ManagerApplication } from './manager-application.entity';
import { ManagersService } from './managers.service';
import { ManagersController } from './managers.controller';
import { ManagerApplicationsService } from './manager-applications.service';
import { ManagerApplicationsController } from './manager-applications.controller';
import { Campaign } from '../campaigns/campaign.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ManagerProfile, ManagerFeedback, ManagerApplication, Campaign, BrandTeam, User]),
    UsersModule,
    NotificationsModule,
  ],
  providers: [ManagersService, ManagerApplicationsService],
  controllers: [ManagersController, ManagerApplicationsController],
  exports: [ManagersService, ManagerApplicationsService],
})
export class ManagersModule {}
